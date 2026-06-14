import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { callLlm } from '../services/llm.js';
import {
  buildCacheKey,
  getSemanticCache,
  setSemanticCache,
} from '../services/semanticCache.js';
import { resolveImageUrl } from '../services/qiniu.js';

export const chatRouter = Router();

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

chatRouter.post('/chat', authMiddleware, async (req, res) => {
  const { text, imageBase64, imageKey, history = [], skipImage }: ChatRequestBody = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: '缺少用户输入文本' });
  }

  try {
    const trimmed = text.trim();
    const { imageUrl, kodoHit, frameHash } = await resolveImageUrl(imageBase64, imageKey);
    const sentImage = Boolean(!skipImage && (imageUrl || imageBase64));
    const cacheKey = buildCacheKey(skipImage ? null : frameHash, trimmed);
    const cached = getSemanticCache(cacheKey);

    if (cached) {
      return res.json({
        reply: cached.reply,
        usage: cached.usage ?? { total_tokens: 0 },
        sentImage,
        kodoHit,
        semanticHit: true,
        imageUrl,
      });
    }

    const result = await callLlm({
      text: trimmed,
      history,
      username: req.user!.username,
      imageUrl,
      imageBase64: imageUrl ? undefined : imageBase64,
      skipImage,
    });

    setSemanticCache(cacheKey, { reply: result.reply, usage: result.usage });

    res.json({
      reply: result.reply,
      usage: result.usage,
      sentImage,
      kodoHit,
      semanticHit: false,
      imageUrl,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : '服务器内部错误' });
  }
});
