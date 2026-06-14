/** 对话回复详略：简约 2-4 句 / 详细 5-8 句 */
export type ReplyDetailMode = 'brief' | 'detailed';

export function parseReplyDetailMode(value: unknown): ReplyDetailMode {
  return value === 'detailed' ? 'detailed' : 'brief';
}

export function countSentences(text: string): number {
  return text
    .split(/(?<=[。！？!?；;…])/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[~～喵\s]/g, '').length >= 2).length;
}

export function getDetailedMinSentences(): number {
  return Number(process.env.REPLY_DETAILED_MIN_SENTENCES) || 5;
}

export function isDetailedReplyTooShort(reply: string): boolean {
  return countSentences(reply) < getDetailedMinSentences();
}

export function getDefaultMaxTokens(): number {
  return Number(process.env.LLM_MAX_TOKENS) || 300;
}

export function getDetailedReplyMaxTokens(): number {
  return Number(process.env.REPLY_DETAILED_MAX_TOKENS) ||
    Number(process.env.VISION_DETAILED_MAX_TOKENS) ||
    1200;
}

export function resolveReplyMaxTokens(
  replyDetailMode: ReplyDetailMode,
): number {
  return replyDetailMode === 'detailed' ? getDetailedReplyMaxTokens() : getDefaultMaxTokens();
}

export function resolveReplyTemperature(
  replyDetailMode: ReplyDetailMode,
  webFactsPresent?: boolean,
): number {
  if (webFactsPresent) return replyDetailMode === 'detailed' ? 0.4 : 0.25;
  return replyDetailMode === 'detailed' ? 0.82 : 0.7;
}

export function buildReplyModeBanner(replyDetailMode: ReplyDetailMode): string {
  if (replyDetailMode !== 'detailed') return '';
  const min = getDetailedMinSentences();
  return `\n【当前：详细回复模式】用户明确要求较长回答。你必须至少写 ${min} 句完整中文（以。！？结尾），建议 ${min}-8 句；禁止只用 1-2 句敷衍。`;
}
