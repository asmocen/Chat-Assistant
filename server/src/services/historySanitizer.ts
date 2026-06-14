import type { ChatMessage } from './llm.js';
import { hasDescribedAppearance, needsVision } from './imagePolicy.js';

const APPEARANCE_SENTENCE =
  /眼镜|T恤|衣着|衣服|发型|穿着|外貌|长相|黑框|镜框|透明|背景|灯光|画面里|摄像头|无框|卫衣|夹克|耳机|耳麦|室内|白T/i;

const PLACEHOLDER = '[此前已描述过画面，此处不再重复]';

function redactAppearanceInContent(content: string): string {
  const parts = content.split(/(?<=[。！？!?；;…])/);
  const kept = parts.map((p) => p.trim()).filter((p) => p && !APPEARANCE_SENTENCE.test(p));
  if (kept.length === 0) return PLACEHOLDER;
  const merged = kept.join('');
  return merged.trim() || PLACEHOLDER;
}

/** 非视觉问题时，脱敏 history 中的外貌描述，避免模型复读 */
export function sanitizeHistoryForLlm(history: ChatMessage[], userText: string): ChatMessage[] {
  if (needsVision(userText)) return history;
  if (!hasDescribedAppearance(history)) return history;

  return history.map((m) => {
    if (m.role !== 'assistant') return m;
    if (!APPEARANCE_SENTENCE.test(m.content)) return m;
    return { ...m, content: redactAppearanceInContent(m.content) };
  });
}
