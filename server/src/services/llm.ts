export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function buildSystemPrompt(username?: string): string {
  const who = username ? `当前用户是「${username}」。` : '';
  return `你是虚拟助手「cc404喵」，头戴 Claude Code 风格的小章鱼发卡，性格活泼开朗。
${who}
回复要求：
1. 用简洁自然的中文口语，适合语音播报（2-4 句）
2. 结合摄像头画面与用户问题作答；看不清就诚实说明
3. 不要编造画面中不存在的内容
4. 可偶尔在句末自然使用「～」或「喵」，但不要每句都加`;
}

export function getLlmConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(
      /\/$/,
      '',
    ),
    model: process.env.OPENAI_MODEL || 'qwen-vl-plus',
  };
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

export function buildUserContent(
  text: string,
  imageUrl?: string | null,
  imageBase64?: string,
  skipImage?: boolean,
): ContentPart[] {
  const content: ContentPart[] = [{ type: 'text', text }];

  if (skipImage) return content;

  if (imageUrl) {
    content.unshift({ type: 'image_url', image_url: { url: imageUrl, detail: 'low' } });
  } else if (imageBase64) {
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    content.unshift({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } });
  }

  return content;
}

export async function callLlm(params: {
  text: string;
  history?: ChatMessage[];
  username?: string;
  imageUrl?: string | null;
  imageBase64?: string;
  skipImage?: boolean;
}): Promise<{ reply: string; usage?: { total_tokens?: number } }> {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) throw new Error('未配置 OPENAI_API_KEY');

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(params.username) },
    ...((params.history ?? []).slice(-6).map((m) => ({ role: m.role, content: m.content })) as Array<{
      role: 'user' | 'assistant';
      content: string;
    }>),
    {
      role: 'user' as const,
      content: buildUserContent(params.text, params.imageUrl, params.imageBase64, params.skipImage),
    },
  ];

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
    throw new Error(`模型 API 调用失败: ${response.status} ${errText.slice(0, 150)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  return {
    reply: data.choices?.[0]?.message?.content?.trim() || '抱歉，我暂时无法回答。',
    usage: data.usage,
  };
}

export async function* streamLlm(params: {
  text: string;
  history?: ChatMessage[];
  username?: string;
  imageUrl?: string | null;
  imageBase64?: string;
  skipImage?: boolean;
}): AsyncGenerator<string, { total_tokens?: number } | undefined> {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) throw new Error('未配置 OPENAI_API_KEY');

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(params.username) },
    ...((params.history ?? []).slice(-6).map((m) => ({ role: m.role, content: m.content })) as Array<{
      role: 'user' | 'assistant';
      content: string;
    }>),
    {
      role: 'user' as const,
      content: buildUserContent(params.text, params.imageUrl, params.imageBase64, params.skipImage),
    },
  ];

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
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(`流式 API 失败: ${response.status} ${errText.slice(0, 150)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: { total_tokens?: number } | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };
        if (json.usage) usage = json.usage;
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        /* skip malformed chunk */
      }
    }
  }

  return usage;
}
