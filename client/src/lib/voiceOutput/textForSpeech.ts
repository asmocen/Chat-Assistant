const SENTENCE_END = /[。！？!?；;…]/;

export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let rest = buffer;

  while (rest.length > 0) {
    const idx = rest.search(SENTENCE_END);
    if (idx === -1) break;
    const sentence = rest.slice(0, idx + 1).trim();
    rest = rest.slice(idx + 1);
    if (sentence) sentences.push(sanitizeForSpeech(sentence));
  }

  return { sentences, remainder: rest };
}

export function flushRemainder(remainder: string): string | null {
  const cleaned = sanitizeForSpeech(remainder);
  return cleaned.length > 0 ? cleaned : null;
}
