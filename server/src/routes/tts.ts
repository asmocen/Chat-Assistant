import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getTtsConfig, isTtsEnabled, synthesizeSpeech } from '../services/tts.js';

export const ttsRouter = Router();

ttsRouter.post('/tts', authMiddleware, async (req, res) => {
  if (!isTtsEnabled()) {
    res.status(503).json({ error: 'TTS 未启用或未配置 API Key' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ error: '请提供 text 字段' });
    return;
  }

  try {
    const { buffer, contentType } = await synthesizeSpeech(text);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS 合成失败';
    console.warn('[TTS]', message);
    res.status(502).json({ error: message });
  }
});

ttsRouter.get('/tts/config', authMiddleware, (_req, res) => {
  const cfg = getTtsConfig();
  res.json({
    enabled: isTtsEnabled(),
    model: cfg.model,
    voice: cfg.voice,
    format: cfg.format,
    maxChars: cfg.maxChars,
  });
});
