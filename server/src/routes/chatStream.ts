import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { streamLlm } from '../services/llm.js';
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
    const { imageUrl, kodoHit } = await resolveImageUrl(imageBase64, imageKey);
    const sentImage = Boolean(!skipImage && (imageUrl || imageBase64));

    sendSse(res, 'meta', {
      kodoHit,
      semanticHit: false,
      sentImage,
      imageUrl,
    });

    let fullReply = '';
    for await (const chunk of streamLlm({
      text: text.trim(),
      history,
      username: req.user!.username,
      imageUrl,
      imageBase64: imageUrl ? undefined : imageBase64,
      skipImage,
    })) {
      fullReply += chunk;
      sendSse(res, 'chunk', { text: chunk });
    }

    sendSse(res, 'done', {
      reply: fullReply.trim() || '抱歉，我暂时无法回答。',
      usage: { total_tokens: undefined },
    });
    res.end();
  } catch (err) {
    console.error('Stream error:', err);
    sendSse(res, 'error', {
      error: err instanceof Error ? err.message : '服务器内部错误',
    });
    res.end();
  }
});
