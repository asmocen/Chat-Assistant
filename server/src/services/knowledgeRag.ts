/**
 * 轻量 RAG：关键词匹配静态知识片段，注入 System Prompt。
 * 赛题演示用；后续可替换为向量检索。
 */

interface KnowledgeEntry {
  id: string;
  patterns: RegExp[];
  content: string | (() => string);
}

function currentDateLine(): string {
  const now = new Date();
  const tz = process.env.TZ || 'Asia/Shanghai';
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, string> = {
    周日: '日',
    周一: '一',
    周二: '二',
    周三: '三',
    周四: '四',
    周五: '五',
    周六: '六',
  };
  const w = weekdayMap[get('weekday')] ?? get('weekday');
  return `今天是${get('year')}年${get('month')}月${get('day')}日，星期${w}。`;
}

const ENTRIES: KnowledgeEntry[] = [
  {
    id: 'datetime',
    patterns: [
      /今昔是何年|何年|什么年代|几月几号|今天几号|现在几点|什么时间|星期几|日期|哪天/,
    ],
    content: () => currentDateLine(),
  },
  {
    id: 'assistant',
    patterns: [/你是谁|你叫什么|cc404|介绍一下你/],
    content:
      '你是 cc404喵，AI 视觉对话助手，头戴 Claude Code 风格小章鱼发卡，擅长结合摄像头画面与语音对话。',
  },
  {
    id: 'product',
    patterns: [/这个项目|这个应用|干什么|做什么|功能/],
    content:
      '本应用是端云协同的多模态对话助手：端侧摄像头+语音，七牛 Kodo 帧缓存，语义缓存降低成本，SSE 流式回复。',
  },
  {
    id: 'humor',
    patterns: [/有趣|笑话|冷笑话|讲个|聊点|搞笑|好玩|轻松/],
    content:
      '用户想要轻松话题。请给出与上一轮不同的新内容；禁止重复「电脑有很多风扇所以很冷」这类冷笑话；可讲一条新笑话、趣味小知识或开放式聊天话题。',
  },
  {
    id: 'qiniu',
    patterns: [/七牛|kodo|缓存|语义命中/],
    content:
      '七牛 Kodo 用于帧 hash 缓存避免重复上传；语义缓存对「同画面+同问题」秒回，状态栏可看到 kodoHit / semanticHit。',
  },
];

export function retrieveKnowledge(userText: string): string | null {
  const text = userText.trim();
  if (!text) return null;

  const hits: string[] = [];
  for (const entry of ENTRIES) {
    if (entry.patterns.some((p) => p.test(text))) {
      const content = typeof entry.content === 'function' ? entry.content() : entry.content;
      hits.push(content);
    }
  }

  if (hits.length === 0) return null;
  return hits.join('\n');
}
