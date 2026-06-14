import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { streamLlm } from '../services/llm.js';
import {
  buildCacheKey,
  getSemanticCache,
  setSemanticCache,
} from '../services/semanticCache.js';
import { resolveImageUrl } from '../services/qiniu.js';

export const chatStreamRouter = Router();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  text: string;
  imageBase64?: string;
  imageKey?: string;
  history?: ChatMessage[];
  skipImage?: boolean;
}

function sendSse(res: import('express').Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

chatStreamRouter.post('/chat/stream', authMiddleware, async (req, res) => {
  const { text, imageBase64, imageKey, history = [], skipImage }: ChatRequestBody = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: '缺少用户输入文本' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const trimmed = text.trim();
    const { imageUrl, kodoHit, frameHash } = await resolveImageUrl(imageBase64, imageKey);
    const sentImage = Boolean(!skipImage && (imageUrl || imageBase64));
    const cacheKey = buildCacheKey(skipImage ? null : frameHash, trimmed);
    const cached = getSemanticCache(cacheKey);

    if (cached) {
      sendSse(res, 'meta', {
        kodoHit,
        semanticHit: true,
        sentImage,
        imageUrl,
      });
      sendSse(res, 'done', {
        reply: cached.reply,
        usage: cached.usage ?? { total_tokens: 0 },
      });
      res.end();
      return;
    }

    sendSse(res, 'meta', {
      kodoHit,
      semanticHit: false,
      sentImage,
      imageUrl,
    });

    let fullReply = '';
    const stream = streamLlm({
      text: trimmed,
      history,
      username: req.user!.username,
      imageUrl,
      imageBase64: imageUrl ? undefined : imageBase64,
      skipImage,
    });

    while (true) {
      const { value, done } = await stream.next();
      if (done) {
        const reply = fullReply.trim() || '抱歉，我暂时无法回答。';
        const usage = value ?? { total_tokens: undefined };
        setSemanticCache(cacheKey, { reply, usage });
        sendSse(res, 'done', { reply, usage });
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
