import { callMcpExtract } from '../services/mcpClient.js';
import type { Skill } from './registry.js';

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;
const EXTRACT_INTENT = /提取|总结|摘要|网页内容|读一下|看看这个链接|打开这个网页/i;

function extractUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match?.[0]?.replace(/[，。！？,.!?]+$/, '') ?? null;
}

async function fallbackFetchExtract(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatAssistant/1.0)' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    return `网页 ${url} 正文摘要：\n${text.slice(0, 600)}`;
  } catch {
    return null;
  }
}

export function needsUrlExtract(userText: string): boolean {
  const trimmed = userText.trim();
  if (URL_PATTERN.test(trimmed)) return true;
  return EXTRACT_INTENT.test(trimmed) && URL_PATTERN.test(trimmed);
}

export function isUrlExtractSkillEnabled(): boolean {
  return process.env.URL_EXTRACT_ENABLED !== 'false';
}

export async function runUrlExtractSkill(
  text: string,
): Promise<{ text: string; toolUsed: string } | null> {
  const url = extractUrl(text);
  if (!url) return null;

  const mcpResult = await callMcpExtract(url);
  if (mcpResult) return { text: mcpResult.text, toolUsed: mcpResult.toolName };

  const fallback = await fallbackFetchExtract(url);
  if (fallback) return { text: fallback, toolUsed: 'url_extract:fetch' };

  return null;
}

export const urlExtractSkill: Skill = {
  id: 'url_extract',
  enabled: isUrlExtractSkillEnabled,
  needs: needsUrlExtract,
  run: async (text) => runUrlExtractSkill(text),
};
