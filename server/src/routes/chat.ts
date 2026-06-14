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
import { callLlm, type ChatMessage } from '../services/llm.js';
import {
  buildCacheKey,
  getSemanticCache,
  isRepeatUserQuestion,
  setSemanticCache,
} from '../services/semanticCache.js';
import { resolveImageUrl } from '../services/qiniu.js';

export const chatRouter = Router();

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

function toLlmHistory(messages: Array<{ role: string; content: string }>): ChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

chatRouter.post('/chat', authMiddleware, async (req, res) => {
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
      return res.json({
        reply: cached.reply,
        usage: cached.usage ?? { total_tokens: 0 },
        sentImage,
        kodoHit,
        semanticHit: true,
        imageUrl,
        sessionId: activeSessionId,
        memoryHit,
        toolsUsed: [],
        webSearchSummary: [],
      });
    }

    const result = await callLlm({
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

    let reply = sanitizeReply(result.reply, llmHistory, trimmed, replyDetailMode);
    reply = guardFactualReply(
      reply,
      enriched.webSearchContext,
      enriched.webSearchSucceeded,
      enriched.webSearchFailed,
    );
    setSemanticCache(cacheKey, { reply, usage: result.usage });
    appendMessages(activeSessionId, user.userId, [
      { role: 'user', content: trimmed },
      { role: 'assistant', content: reply },
    ]);

    res.json({
      reply,
      usage: result.usage,
      sentImage,
      kodoHit,
      semanticHit: false,
      imageUrl,
      sessionId: activeSessionId,
      memoryHit,
      toolsUsed: enriched.toolsUsed,
      webSearchSummary: enriched.webSearchSummary,
      webSearchProvider: enriched.webSearchProvider,
      webSearchFailed: enriched.webSearchFailed,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : '服务器内部错误' });
  }
});
