const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  reply: string;
  usage?: { total_tokens?: number };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 仅当用户重复提完全相同的问题时才走语义缓存（演示用） */
export function isRepeatUserQuestion(
  text: string,
  history: Array<{ role: string; content: string }>,
): boolean {
  const normalized = normalizeText(text);
  return history.some((m) => m.role === 'user' && normalizeText(m.content) === normalized);
}

export function buildCacheKey(
  frameHash: string | null,
  text: string,
  replyDetailMode: 'brief' | 'detailed' = 'brief',
): string {
  return `${replyDetailMode}:${frameHash ?? 'no-frame'}:${normalizeText(text)}`;
}

export function getSemanticCache(
  key: string,
): { reply: string; usage?: { total_tokens?: number } } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { reply: entry.reply, usage: entry.usage };
}

export function setSemanticCache(
  key: string,
  value: { reply: string; usage?: { total_tokens?: number } },
): void {
  cache.set(key, {
    reply: value.reply,
    usage: value.usage,
    expiresAt: Date.now() + TTL_MS,
  });
}
