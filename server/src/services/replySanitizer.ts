import type { ChatMessage } from './llm.js';
import { needsVision } from './imagePolicy.js';

const APPEARANCE_SENTENCE =
  /眼镜|T恤|衣着|衣服|发型|穿着|外貌|长相|黑框|镜框|透明|背景|灯光|画面里|摄像头|无框|卫衣|夹克|耳机|耳麦|室内|白T/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;…])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function similarityPrefix(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').slice(0, 60);
  const pa = norm(a);
  const pb = norm(b);
  if (pa.length < 20 || pb.length < 20) return false;
  return pa === pb || pb.startsWith(pa) || pa.startsWith(pb);
}

/** 非视觉问题时，剥离回复中与上一轮重复的外貌段落；详细模式保留完整回复 */
export function sanitizeReply(
  reply: string,
  history: ChatMessage[],
  userText: string,
  replyDetailMode: 'brief' | 'detailed' = 'brief',
): string {
  const trimmed = reply.trim();
  if (!trimmed || needsVision(userText) || replyDetailMode === 'detailed') return trimmed;

  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && similarityPrefix(trimmed, lastAssistant.content)) {
    const prevSentences = splitSentences(lastAssistant.content);
    let result = trimmed;
    for (const s of prevSentences) {
      if (result.startsWith(s)) {
        result = result.slice(s.length).trim();
      }
    }
    if (result.length >= 8) return result;
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 1) {
    if (APPEARANCE_SENTENCE.test(trimmed) && !needsVision(userText)) {
      return trimmed;
    }
    return trimmed;
  }

  let dropLeading = true;
  const kept: string[] = [];
  for (const s of sentences) {
    if (dropLeading && APPEARANCE_SENTENCE.test(s)) continue;
    dropLeading = false;
    kept.push(s);
  }

  const result = kept.join('').trim();
  return result.length >= 4 ? result : trimmed;
}
