import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { enrichContext } from '../services/contextEnrichment.js';
import { guardFactualReply } from '../services/factualReplyGuard.js';
import {
  appendMessages,
  getMessages,
  getOrCreateSession,
} from '../services/conversationMemory.js';
import { resolveSkipImage } from '../services/imagePolicy.js';
import { parseReplyDetailMode } from '../services/replyMode.js';
import { sanitizeReply } from '../services/replySanitizer.js';
import { streamLlm, finalizeDetailedReply, type ChatMessage } from '../services/llm.js';
import {
  buildCacheKey,
  getSemanticCache,
  isRepeatUserQuestion,
  setSemanticCache,
} from '../services/semanticCache.js';
import { resolveImageUrl } from '../services/qiniu.js';

export const chatStreamRouter = Router();

interface ChatRequestBody {
  text: string;
  imageBase64?: string;
  imageKey?: string;
  history?: ChatMessage[];
  sessionId?: string;
  skipImage?: boolean;
  replyDetailMode?: 'brief' | 'detailed';
  /** @deprecated */
  visionDetailMode?: 'brief' | 'detailed';
}

function sendSse(res: import('express').Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toLlmHistory(messages: Array<{ role: string; content: string }>): ChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

chatStreamRouter.post('/chat/stream', authMiddleware, async (req, res) => {
  const {
    text,
    imageBase64,
    imageKey,
    history = [],
    sessionId,
    skipImage: clientSkip,
    replyDetailMode: clientReplyMode,
    visionDetailMode: legacyVisionMode,
  }: ChatRequestBody = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: '缺少用户输入文本' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const user = req.user!;
    const trimmed = text.trim();
    const { sessionId: activeSessionId } = getOrCreateSession(
      user.userId,
      user.username,
      sessionId,
    );
    const serverHistory = getMessages(activeSessionId, user.userId);
    const memoryHit = serverHistory.length > 0;
    const llmHistory =
      serverHistory.length > 0 ? toLlmHistory(serverHistory) : toLlmHistory(history);

    const replyDetailMode = parseReplyDetailMode(clientReplyMode ?? legacyVisionMode);
    const skipImage = resolveSkipImage(trimmed, llmHistory, clientSkip, replyDetailMode);
    const enriched = await enrichContext(trimmed, llmHistory, replyDetailMode);

    const { imageUrl, kodoHit, frameHash } = await resolveImageUrl(
      skipImage ? undefined : imageBase64,
      skipImage ? undefined : imageKey,
    );
    const sentImage = Boolean(!skipImage && (imageUrl || imageBase64));
    const cacheKey = buildCacheKey(skipImage ? null : frameHash, trimmed, replyDetailMode);
    const isFeedback = /重复|又说|再说|别描述|不要描述|衣着|不舒服|啰嗦|发现|只会|文不对题/.test(trimmed);
    const skillTools = enriched.toolsUsed.filter((t) => t !== 'server_datetime');
    const allowCache =
      replyDetailMode === 'brief' &&
      isRepeatUserQuestion(trimmed, llmHistory) &&
      !isFeedback &&
      skillTools.length === 0;
    const cached = allowCache ? getSemanticCache(cacheKey) : null;

    if (cached) {
      appendMessages(activeSessionId, user.userId, [
        { role: 'user', content: trimmed },
        { role: 'assistant', content: cached.reply },
      ]);
      sendSse(res, 'meta', {
        kodoHit,
        semanticHit: true,
        sentImage,
        imageUrl,
        sessionId: activeSessionId,
        memoryHit,
        toolsUsed: [],
        webSearchSummary: [],
      });
      sendSse(res, 'done', {
        reply: cached.reply,
        usage: cached.usage ?? { total_tokens: 0 },
        toolsUsed: [],
        webSearchSummary: [],
      });
      res.end();
      return;
    }

    sendSse(res, 'meta', {
      kodoHit,
      semanticHit: false,
      sentImage,
      imageUrl,
      sessionId: activeSessionId,
      memoryHit,
      toolsUsed: enriched.toolsUsed,
      webSearchSummary: enriched.webSearchSummary,
      webSearchProvider: enriched.webSearchProvider,
      webSearchFailed: enriched.webSearchFailed,
    });

    let fullReply = '';
    const stream = streamLlm({
      text: trimmed,
      history: llmHistory,
      username: user.username,
      imageUrl,
      imageBase64: skipImage || imageUrl ? undefined : imageBase64,
      skipImage,
      knowledge: enriched.knowledge,
      externalContext: enriched.externalContext,
      webFactsPresent: enriched.webSearchSucceeded,
      replyDetailMode,
    });

    while (true) {
      const { value, done } = await stream.next();
      if (done) {
        let reply = sanitizeReply(
          fullReply.trim() || '抱歉，我暂时无法回答。',
          llmHistory,
          trimmed,
          replyDetailMode,
        );
        reply = await finalizeDetailedReply(reply, {
          text: trimmed,
          history: llmHistory,
          username: user.username,
          imageUrl,
          imageBase64: skipImage || imageUrl ? undefined : imageBase64,
          skipImage,
          knowledge: enriched.knowledge,
          externalContext: enriched.externalContext,
          webFactsPresent: enriched.webSearchSucceeded,
          replyDetailMode,
        });
        reply = guardFactualReply(
          reply,
          enriched.webSearchContext,
          enriched.webSearchSucceeded,
          enriched.webSearchFailed,
        );
        if (!reply) reply = '抱歉，我暂时无法回答。';
        const usage = value ?? { total_tokens: undefined };
        setSemanticCache(cacheKey, { reply, usage });
        appendMessages(activeSessionId, user.userId, [
          { role: 'user', content: trimmed },
          { role: 'assistant', content: reply },
        ]);
        sendSse(res, 'done', {
          reply,
          usage,
          toolsUsed: enriched.toolsUsed,
          webSearchSummary: enriched.webSearchSummary,
          webSearchProvider: enriched.webSearchProvider,
          webSearchFailed: enriched.webSearchFailed,
        });
        break;
      }
      fullReply += value;
      sendSse(res, 'chunk', { text: value });
    }
    res.end();
  } catch (err) {
    console.error('Stream error:', err);
    sendSse(res, 'error', {
      error: err instanceof Error ? err.message : '服务器内部错误',
    });
    res.end();
  }
});
