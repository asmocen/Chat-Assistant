import { Router } from 'express';

export const chatRouter = Router();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestBody {
  text: string;
  imageBase64?: string;
  history?: ChatMessage[];
  skipImage?: boolean;
}

const SYSTEM_PROMPT = `你是「AI 视觉对话助手」，能同时理解用户语音转写的文字和摄像头画面。
回复要求：
1. 用简洁自然的中文口语回答，适合语音播报（2-4 句为宜）
2. 若画面中有可识别物体/场景，结合视觉信息作答；若画面模糊或无关，诚实说明
3. 不要编造画面中不存在的内容
4. 语气友好、有帮助`;

chatRouter.post('/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return res.status(500).json({ error: '未配置 OPENAI_API_KEY，请在 .env 中设置' });
  }

  const { text, imageBase64, history = [], skipImage }: ChatRequestBody = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: '缺少用户输入文本' });
  }

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [
    { type: 'text', text },
  ];

  if (imageBase64 && !skipImage) {
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    userContent.unshift({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'low' },
    });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API error:', response.status, errText);
      return res.status(response.status).json({
        error: `模型 API 调用失败: ${response.status}`,
        detail: errText.slice(0, 200),
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const reply = data.choices?.[0]?.message?.content?.trim() || '抱歉，我暂时无法回答。';

    res.json({
      reply,
      usage: data.usage,
      sentImage: Boolean(imageBase64 && !skipImage),
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});
