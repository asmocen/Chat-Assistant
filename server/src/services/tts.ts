import { getOpenAiApiKey } from './apiKey.js';

const TTS_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';

export function isTtsEnabled(): boolean {
  return process.env.TTS_ENABLED !== 'false' && Boolean(getTtsApiKey());
}

export function getTtsConfig() {
  return {
    model: process.env.TTS_MODEL || 'cosyvoice-v3-flash',
    voice: process.env.TTS_VOICE || 'longxiaochun_v3',
    format: (process.env.TTS_FORMAT || 'mp3') as 'mp3' | 'wav',
    maxChars: Number(process.env.TTS_MAX_CHARS) || 500,
    rate: Number(process.env.TTS_RATE) || 1.05,
  };
}

function getTtsApiKey(): string | undefined {
  return getOpenAiApiKey() || process.env.DASHSCOPE_API_KEY?.trim();
}

export async function synthesizeSpeech(text: string): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = getTtsApiKey();
  if (!apiKey) throw new Error('未配置 TTS API Key（OPENAI_API_KEY）');

  const cfg = getTtsConfig();
  const trimmed = text.trim().slice(0, cfg.maxChars);
  if (!trimmed) throw new Error('文本为空');

  const res = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      input: {
        text: trimmed,
        voice: cfg.voice,
        format: cfg.format,
        sample_rate: 22050,
        rate: cfg.rate,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`TTS 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = (await res.json()) as {
      output?: {
        audio?: string | { data?: string; url?: string };
        finish_reason?: string;
      };
      code?: string;
      message?: string;
    };
    if (data.code) throw new Error(data.message || data.code);

    const audioField = data.output?.audio;
    if (typeof audioField === 'string' && audioField) {
      return {
        buffer: Buffer.from(audioField, 'base64'),
        contentType: cfg.format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      };
    }

    if (audioField && typeof audioField === 'object') {
      if (audioField.data) {
        return {
          buffer: Buffer.from(audioField.data, 'base64'),
          contentType: cfg.format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        };
      }
      if (audioField.url) {
        const audioRes = await fetch(audioField.url, { signal: AbortSignal.timeout(30000) });
        if (!audioRes.ok) throw new Error(`TTS 音频下载失败 (${audioRes.status})`);
        const arrayBuffer = await audioRes.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          contentType: audioRes.headers.get('content-type') || 'audio/mpeg',
        };
      }
    }

    throw new Error('TTS 响应无音频数据');
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: contentType || (cfg.format === 'wav' ? 'audio/wav' : 'audio/mpeg'),
  };
}
