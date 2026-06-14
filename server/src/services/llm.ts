import { sanitizeHistoryForLlm } from './historySanitizer.js';
import { needsVision } from './imagePolicy.js';
import { resolveReplyMaxTokens, resolveReplyTemperature, buildReplyModeBanner, type ReplyDetailMode } from './replyMode.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function getHistoryMessageLimit(): number {
  const turns = Number(process.env.MEMORY_TURN_LIMIT) || 12;
  return turns * 2;
}

function buildReplyLengthRule(userText?: string, replyDetailMode: ReplyDetailMode = 'brief'): string {
  const visionTurn = Boolean(userText && needsVision(userText));
  if (replyDetailMode === 'detailed') {
    const min = 5;
    if (visionTurn) {
      return `1. 【详细回复模式】至少 ${min} 句、建议 5-8 句，分段描述画面（人物→前景→背景→光线）；每句只讲一个要点`;
    }
    return `1. 【详细回复模式】至少 ${min} 句、建议 5-8 句；先直接答问题，再补充背景/原因/例子/建议，禁止压缩成两句`;
  }
  if (visionTurn) {
    return '1. 用简洁自然的中文口语，适合语音播报（2-4 句）；描述画面时抓住 1-2 个最显著特征即可';
  }
  return '1. 用简洁自然的中文口语，适合语音播报（2-4 句）';
}

function buildVisionSessionRule(userText?: string, replyDetailMode: ReplyDetailMode = 'brief'): string {
  if (userText && needsVision(userText) && replyDetailMode === 'detailed') {
    return '5. 详细回复模式下，每次视觉提问可补充**新的**画面细节；不要整段复制上一轮描述';
  }
  return '5. 同一会话中，外貌/衣着/眼镜等描述**总共只能出现一次**；之后所有回复都不要再提';
}

function buildWebFactsRule(webFactsPresent?: boolean, replyDetailMode: ReplyDetailMode = 'brief'): string {
  if (!webFactsPresent) return '';
  const lengthHint = replyDetailMode === 'detailed' ? '至少 4 句、建议 4-6 句' : '2-4 句';
  return `\n\n【联网作答模式】下方已提供联网检索参考。你必须：
- 只使用与用户当前问题**相关**的检索条目；明显无关的必须忽略
- 用 ${lengthHint} 自然口语综合回答，禁止整段复述检索摘要或罗列标题
- 禁止引用训练记忆里的旧赛程或编造「A队/B队」
- 禁止说「让我查一下/稍等」——联网已完成
- 若检索结果都与问题无关，诚实说「联网没查到直接相关的信息」`;
}

export function buildSystemPrompt(
  username?: string,
  userText?: string,
  knowledgeContext?: string | null,
  externalContext?: string | null,
  webFactsPresent?: boolean,
  replyDetailMode: ReplyDetailMode = 'brief',
): string {
  const who = username ? `当前用户是「${username}」。` : '';
  const feedbackTurn =
    userText &&
    /重复|又说|再说|别描述|不要描述|衣着|衣服|T恤|眼镜|刚才|不舒服|啰嗦|发现|只会|文不对题/.test(
      userText,
    );

  const feedbackRule = feedbackTurn
    ? `\n11. 用户在反馈你重复或啰嗦：先简短认错，只回应其当前问题，禁止再次描述外貌、衣着、背景等已说过的内容。`
    : '';

  const knowledgeBlock = knowledgeContext
    ? `\n\n【参考知识库，请优先依据以下内容准确作答】\n${knowledgeContext}`
    : '';

  const webFactsRule = buildWebFactsRule(webFactsPresent, replyDetailMode);

  const externalBlock = externalContext
    ? `\n\n【外界信息（当前时间/联网事实/会话记忆）】\n${externalContext}${webFactsRule}`
    : '';

  return `你是虚拟助手「cc404喵」，头戴 Claude Code 风格的小章鱼发卡，性格活泼开朗。${buildReplyModeBanner(replyDetailMode)}
${who}
回复要求：
${buildReplyLengthRule(userText, replyDetailMode)}
2. 必须直接回答用户「当前这一轮」的新问题；禁止复制或改写上一轮回复
3. 只有用户明确问「画面里有什么/穿什么/看到什么/手里拿什么」时才描述外貌；其他话题禁止以描述发型、眼镜、衣服开头
4. 不要编造画面中不存在的内容
${buildVisionSessionRule(userText, replyDetailMode)}
6. 若 history 中已有外貌描述，**禁止**在本轮开头复述或复制上一轮内容，直接回答当前新问题
7. 可偶尔在句末自然使用「～」或「喵」，但不要每句都加
8. 回答赛事/新闻/天气/日期等事实问题时，**必须**使用【外界信息】中的当前服务器时间与联网结果；不得用训练记忆中的旧日期（如2023年）
9. 涉及世界杯：上一届为2022卡塔尔；当前年份以【当前服务器时间】为准；无具体对阵数据时诚实说查不到，禁止编造球队或比分
10. 禁止口头说「让我查一下/稍等」却不给出查询结果；若已提供联网信息则直接回答${feedbackRule}${knowledgeBlock}${externalBlock}`;
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
  replyDetailMode: ReplyDetailMode = 'brief',
): ContentPart[] {
  const content: ContentPart[] = [{ type: 'text', text }];

  if (skipImage) return content;

  const imageDetail =
    needsVision(text) && replyDetailMode === 'detailed' ? 'high' : 'low';

  if (imageUrl) {
    content.unshift({ type: 'image_url', image_url: { url: imageUrl, detail: imageDetail } });
  } else if (imageBase64) {
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    content.unshift({ type: 'image_url', image_url: { url: dataUrl, detail: imageDetail } });
  }

  return content;
}

function pickReplyDetailMode(
  replyDetailMode?: ReplyDetailMode,
  legacyVisionDetailMode?: ReplyDetailMode,
): ReplyDetailMode {
  return replyDetailMode ?? legacyVisionDetailMode ?? 'brief';
}

function sliceHistory(
  history: ChatMessage[],
  userText: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const sanitized = sanitizeHistoryForLlm(history, userText);
  return sanitized
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-getHistoryMessageLimit())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export async function callLlm(params: {
  text: string;
  history?: ChatMessage[];
  username?: string;
  imageUrl?: string | null;
  imageBase64?: string;
  skipImage?: boolean;
  knowledge?: string | null;
  externalContext?: string | null;
  webFactsPresent?: boolean;
  replyDetailMode?: ReplyDetailMode;
  /** @deprecated use replyDetailMode */
  visionDetailMode?: ReplyDetailMode;
  skipDetailedExpand?: boolean;
}): Promise<{ reply: string; usage?: { total_tokens?: number } }> {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) throw new Error('未配置 OPENAI_API_KEY');

  const replyDetailMode = pickReplyDetailMode(params.replyDetailMode, params.visionDetailMode);

  const messages = [
    {
      role: 'system' as const,
      content: buildSystemPrompt(
        params.username,
        params.text,
        params.knowledge,
        params.externalContext,
        params.webFactsPresent,
        replyDetailMode,
      ),
    },
    ...sliceHistory(params.history ?? [], params.text),
    {
      role: 'user' as const,
      content: buildUserContent(
        params.text,
        params.imageUrl,
        params.imageBase64,
        params.skipImage,
        replyDetailMode,
      ),
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
      max_tokens: resolveReplyMaxTokens(replyDetailMode),
      temperature: resolveReplyTemperature(replyDetailMode, params.webFactsPresent),
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

  let reply = data.choices?.[0]?.message?.content?.trim() || '抱歉，我暂时无法回答。';
  if (replyDetailMode === 'detailed' && !params.skipDetailedExpand) {
    reply = await maybeExpandDetailedReply(reply, params, replyDetailMode);
  }

  return {
    reply,
    usage: data.usage,
  };
}

export type LlmCallParams = {
  text: string;
  history?: ChatMessage[];
  username?: string;
  imageUrl?: string | null;
  imageBase64?: string;
  skipImage?: boolean;
  knowledge?: string | null;
  externalContext?: string | null;
  webFactsPresent?: boolean;
  replyDetailMode?: ReplyDetailMode;
  visionDetailMode?: ReplyDetailMode;
};

/** 详细模式下若回复过短，非流式补写一次 */
export async function finalizeDetailedReply(reply: string, params: LlmCallParams): Promise<string> {
  const mode = pickReplyDetailMode(params.replyDetailMode, params.visionDetailMode);
  if (mode !== 'detailed') return reply;
  return maybeExpandDetailedReply(reply, params, mode);
}

async function maybeExpandDetailedReply(
  reply: string,
  params: LlmCallParams,
  replyDetailMode: ReplyDetailMode,
): Promise<string> {
  const { isDetailedReplyTooShort } = await import('./replyMode.js');
  if (!isDetailedReplyTooShort(reply)) return reply;

  const expanded = await callLlm({
    ...params,
    replyDetailMode,
    skipDetailedExpand: true,
    skipImage: true,
    text: `${params.text}\n\n【系统补充要求】你上一版回答过短。请在保留核心信息的前提下重写，至少 5 句完整中文，分段展开，不要只写两句。`,
    history: [
      ...(params.history ?? []),
      { role: 'user', content: params.text },
      { role: 'assistant', content: reply },
    ],
  });
  return expanded.reply.length > reply.length ? expanded.reply : reply;
}

export async function* streamLlm(params: {
  text: string;
  history?: ChatMessage[];
  username?: string;
  imageUrl?: string | null;
  imageBase64?: string;
  skipImage?: boolean;
  knowledge?: string | null;
  externalContext?: string | null;
  webFactsPresent?: boolean;
  replyDetailMode?: ReplyDetailMode;
  /** @deprecated use replyDetailMode */
  visionDetailMode?: ReplyDetailMode;
}): AsyncGenerator<string, { total_tokens?: number } | undefined> {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) throw new Error('未配置 OPENAI_API_KEY');

  const replyDetailMode = pickReplyDetailMode(params.replyDetailMode, params.visionDetailMode);

  const messages = [
    {
      role: 'system' as const,
      content: buildSystemPrompt(
        params.username,
        params.text,
        params.knowledge,
        params.externalContext,
        params.webFactsPresent,
        replyDetailMode,
      ),
    },
    ...sliceHistory(params.history ?? [], params.text),
    {
      role: 'user' as const,
      content: buildUserContent(
        params.text,
        params.imageUrl,
        params.imageBase64,
        params.skipImage,
        replyDetailMode,
      ),
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
      max_tokens: resolveReplyMaxTokens(replyDetailMode),
      temperature: resolveReplyTemperature(replyDetailMode, params.webFactsPresent),
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
