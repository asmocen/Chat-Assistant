import type { ChatMessage } from '../services/llm.js';
import { getServerDateParts, getServerDatePrefix } from '../services/serverContext.js';
import { callMcpSearch } from '../services/mcpClient.js';
import type { Skill } from './registry.js';
const SEARCH_INTENT =
  /搜索|查一下|联网|查一查|帮我查|新闻|天气|最新|多少钱|是什么公司|网上|百度|谷歌|查询|热点|实时/i;

const WEATHER_INTENT = /天气|气温|下雨|下雪|冷不冷|热不热|多少度/i;

const FACTUAL_INTENT =
  /世界杯|对阵|赛程|比赛|赛事|比分|战报|联赛|亚洲杯|欧洲杯|今天.*(赛|杯|踢)|最新.*(赛|闻)|体育新闻/i;

function getMaxResults(): number {
  return Number(process.env.WEB_SEARCH_MAX_RESULTS) || 3;
}

function normalizeSearchQuery(query: string): string {
  return query
    .replace(/^(请|帮我|帮忙|给我)?(搜索|查一下|查一查|查询|联网查|网上查|百度|谷歌)/i, '')
    .replace(/你?(请|帮我|帮忙|给我)?(搜索|查一下|查一查|查询|联网查)/gi, '')
    .replace(/^(今天|今年|最新|一下|关于|有关)/, '')
    .replace(/[？?。！!，,]+$/u, '')
    .trim();
}

const STOP_WORDS = new Set([
  '请', '帮我', '帮忙', '给我', '搜索', '查一下', '查一查', '查询', '联网', '网上',
  '百度', '谷歌', '一下', '关于', '有关', '今天', '今年', '现在', '今日', '当前',
  '最新', '什么', '怎么', '如何', '状况', '情况', '怎么样', '呢', '吗', '的', '了',
  '是', '有', '在', '和', '与', '及', '那', '这', '你', '我', '他', '她', '它',
]);

const DOMAIN_KEYWORDS = [
  '世界杯', 'world cup', 'fifa', '对阵', '赛程', '比分', '战报', '联赛',
  '亚洲杯', '欧洲杯', '天气', 'harness', '工程',
];

function extractQueryTerms(text: string): string[] {
  const normalized = normalizeSearchQuery(text).toLowerCase();
  const terms: string[] = [];
  const en = normalized.match(/[a-z0-9][a-z0-9._-]{1,}/gi) ?? [];
  for (const w of en) {
    if (w.length >= 2) terms.push(w);
  }
  const zh = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  for (const w of zh) {
    if (!STOP_WORDS.has(w)) terms.push(w);
  }
  for (const kw of DOMAIN_KEYWORDS) {
    if (normalized.includes(kw.toLowerCase())) terms.push(kw.toLowerCase());
  }
  return [...new Set(terms)];
}

/** 按与用户问题关键词的重叠度过滤检索条目，去掉明显无关结果 */
export function filterSearchResultsByRelevance(
  userText: string,
  rawText: string,
): { text: string | null; hasRelevant: boolean } {
  const terms = extractQueryTerms(userText);
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'));

  if (lines.length === 0) {
    const one = rawText.replace(/\s+/g, ' ').trim();
    if (!one) return { text: null, hasRelevant: false };
    if (terms.length === 0) return { text: one, hasRelevant: true };
    const hay = one.toLowerCase();
    const hit = terms.some((t) => hay.includes(t.toLowerCase()));
    return { text: hit ? one : null, hasRelevant: hit };
  }

  if (terms.length === 0) return { text: lines.join('\n'), hasRelevant: true };

  const scored = lines
    .map((line) => {
      const hay = line.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t.toLowerCase())).length;
      return { line, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) return { text: null, hasRelevant: false };
  return { text: scored.map((s) => s.line).join('\n'), hasRelevant: true };
}

/** 增强搜索词：注入当前日期与赛事关键词 */
export function buildWebSearchQuery(userText: string): string {
  const raw = userText.trim();
  let q = normalizeSearchQuery(raw) || raw;
  const p = getServerDateParts();
  const datePrefix = getServerDatePrefix();

  if (/今天|现在|今日|当前|今年/.test(raw)) {
    q = `${datePrefix} ${q}`;
  }

  if (/世界杯|World Cup/i.test(raw)) {
    q = `${datePrefix} ${p.year} FIFA World Cup 世界杯 赛程 对阵 状况 ${q}`;
  } else if (/对阵|赛程|赛事|比分|战报/.test(raw)) {
    q = `${datePrefix} ${q} 赛程`;
  }

  return q.replace(/\s+/g, ' ').trim();
}

async function searchWeather(query: string): Promise<string | null> {
  if (!WEATHER_INTENT.test(query)) return null;
  const city = normalizeSearchQuery(query)
    .replace(/天气|怎么样|如何|查|搜索|帮我|今天|现在/g, '')
    .trim();
  const loc = encodeURIComponent(city || '');
  const url = `https://wttr.in/${loc}?format=j1&lang=zh`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'curl/8.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current_condition?: Array<{ temp_C?: string; weatherDesc?: Array<{ value?: string }> }>;
      nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>;
    };
    const cur = data.current_condition?.[0];
    const area = (data.nearest_area?.[0]?.areaName?.[0]?.value ?? city) || '当地';
    if (!cur) return null;
    const desc = cur.weatherDesc?.[0]?.value ?? '未知';
    return `${area}当前天气：${desc}，气温 ${cur.temp_C ?? '?'}°C。数据来源 wttr.in`;
  } catch {
    return null;
  }
}

async function searchBingRss(query: string): Promise<string | null> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatAssistant/1.0)', Accept: 'application/rss+xml' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const items: string[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) && items.length < getMaxResults()) {
      const block = m[1];
      const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
      const desc = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]
        ?.replace(/<[^>]+>/g, '')
        .trim();
      if (title) items.push(`- ${title}${desc ? `: ${desc.slice(0, 160)}` : ''}`);
    }
    return items.length ? items.join('\n').slice(0, 800) : null;
  } catch {
    return null;
  }
}

async function searchTavilyRest(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: getMaxResults(),
      include_answer: true,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; content?: string; url?: string }>;
  };

  const chunks: string[] = [];
  if (data.answer) chunks.push(`摘要: ${data.answer}`);
  for (const r of data.results ?? []) {
    chunks.push(`- ${r.title ?? '结果'}: ${(r.content ?? '').slice(0, 200)}${r.url ? ` (${r.url})` : ''}`);
  }
  return chunks.length ? chunks.join('\n').slice(0, 800) : null;
}

async function directWebSearch(query: string): Promise<{ text: string; provider: string } | null> {
  const weather = await searchWeather(query);
  if (weather) return { text: weather, provider: 'wttr.in' };

  const chain: Array<{ name: string; fn: () => Promise<string | null> }> = [
    { name: 'bing_rss', fn: () => searchBingRss(query) },
    { name: 'tavily', fn: () => searchTavilyRest(query) },
  ];

  for (const { name, fn } of chain) {
    try {
      const text = await fn();
      if (text) return { text, provider: name };
    } catch {
      continue;
    }
  }
  return null;
}

export function formatWebSearchResults(text: string, provider: string, userQuery?: string): string {
  const qHint = userQuery?.trim() ? `\n用户问题: ${userQuery.trim()}` : '';
  return `【联网参考 - 仅使用与「用户问题」相关的结果作答】
来源: ${provider}${qHint}
${text}
【要求】
- 先判断每条结果是否与用户问题相关；无关条目必须忽略，禁止复述
- 只引用相关结果中的具体名称、时间或数据；用 2-4 句自然口语回答
- 若全部结果都与问题无关，明确说「联网没查到与问题直接相关的信息」，不要编造
- 禁止说「让我查一下/稍等」——联网已完成`;
}

const WEB_CONTEXT_HEADER = /^【联网事实[^】]*】/;
const WEB_CONTEXT_FOOTER = /【要求】[\s\S]*$/;

/** 从联网上下文中提取供 UI 展示的摘要条目（最多 3 条） */
export function parseWebSearchSummary(webContext: string | null | undefined): string[] {
  if (!webContext?.trim()) return [];

  const body = webContext
    .replace(WEB_CONTEXT_HEADER, '')
    .replace(WEB_CONTEXT_FOOTER, '')
    .replace(/^来源:\s*.+$/m, '')
    .trim();

  const bullets = body
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length >= 4 && !line.startsWith('【') && !/^来源:/.test(line) && !/^用户问题:/.test(line));

  if (bullets.length > 0) return bullets.slice(0, 3);

  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length >= 4 ? [oneLine.slice(0, 200)] : [];
}

export function parseWebSearchProvider(webContext: string | null | undefined): string | null {
  if (!webContext) return null;
  const m = webContext.match(/^来源:\s*(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

const VAGUE_FOLLOWUP = /^(是吗|真的吗|对吗|然后呢|还有吗|是不是|嗯嗯|嗯|小熊|真的|确认)[？?。！!]*$/u;

function extractFollowupTopic(text: string): string | null {
  const t = text.trim();
  if (!/^那/.test(t)) return null;
  const rest = t
    .replace(/^那(么|位|个)?/u, '')
    .replace(/[呢吗？?。.!！，,]+$/u, '')
    .trim();
  return rest.length >= 2 ? rest : null;
}

/** 解析实际用于检索的 query（避免「那harness工程呢」误用上一轮世界杯 query） */
export function resolveSearchQuery(userText: string, history: ChatMessage[]): string {
  const t = userText.trim();
  const topic = extractFollowupTopic(t);
  if (topic) return topic;

  if (VAGUE_FOLLOWUP.test(t) && history.length > 0) {
    const prior = [...history]
      .reverse()
      .find(
        (m) =>
          m.role === 'user' &&
          (SEARCH_INTENT.test(m.content) ||
            FACTUAL_INTENT.test(m.content) ||
            WEATHER_INTENT.test(m.content)),
      );
    return prior?.content ?? t;
  }

  return t;
}

export function needsWebSearch(userText: string, history: ChatMessage[] = []): boolean {
  const t = userText.trim();
  if (SEARCH_INTENT.test(t) || WEATHER_INTENT.test(t) || FACTUAL_INTENT.test(t)) {
    return true;
  }
  if (extractFollowupTopic(t)) return true;
  if (VAGUE_FOLLOWUP.test(t) && history.length > 0) {
    return history.some(
      (m) =>
        m.role === 'user' &&
        (SEARCH_INTENT.test(m.content) ||
          FACTUAL_INTENT.test(m.content) ||
          WEATHER_INTENT.test(m.content)),
    );
  }
  return false;
}

export function isWebSearchSkillEnabled(): boolean {
  return process.env.WEB_SEARCH_ENABLED !== 'false';
}

export async function runWebSearchSkill(
  query: string,
  originalUserText?: string,
): Promise<{ text: string; toolUsed: string } | null> {
  const resolved = query.trim();
  const trimmed = buildWebSearchQuery(resolved);
  if (!trimmed) return null;
  const relevanceKey = originalUserText?.trim() || resolved;

  const mcpResult = await callMcpSearch(trimmed);
  if (mcpResult) {
    const filtered = filterSearchResultsByRelevance(relevanceKey, mcpResult.text);
    if (!filtered.hasRelevant || !filtered.text) return null;
    return {
      text: formatWebSearchResults(filtered.text, mcpResult.toolName, relevanceKey),
      toolUsed: mcpResult.toolName,
    };
  }

  const direct = await directWebSearch(trimmed);
  if (direct) {
    const filtered = filterSearchResultsByRelevance(relevanceKey, direct.text);
    if (!filtered.hasRelevant || !filtered.text) return null;
    return {
      text: formatWebSearchResults(filtered.text, direct.provider, relevanceKey),
      toolUsed: `web_search:${direct.provider}`,
    };
  }

  return null;
}

export const webSearchSkill: Skill = {
  id: 'web_search',
  enabled: isWebSearchSkillEnabled,
  needs: (text, history) => needsWebSearch(text, history),
  run: async (text, history) => runWebSearchSkill(resolveSearchQuery(text, history), text),
};
