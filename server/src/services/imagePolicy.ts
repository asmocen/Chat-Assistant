import type { ChatMessage } from './llm.js';
import type { ReplyDetailMode } from './replyMode.js';

/** 用户明确要看画面/识物时才传图 */
const VISION_INTENT =
  /画面|看到什么|看见我|摄像头里|穿什么|穿什么衣服|手里拿|拿着什么|这是什么|是什么东西|看看你|识别一下|描述一下我|我长什么样|外貌|长相|look at|what am i holding/i;

const APPEARANCE_IN_REPLY =
  /眼镜|T恤|衣着|衣服|发型|穿着|戴|黑白|外貌|长相|黑框|镜框|卫衣|夹克|耳机|耳麦/i;

export function needsVision(userText: string): boolean {
  return VISION_INTENT.test(userText.trim());
}

export function hasDescribedAppearance(history: ChatMessage[]): boolean {
  return history.some(
    (m) => m.role === 'assistant' && APPEARANCE_IN_REPLY.test(m.content),
  );
}

/** 演示模式：会话中每轮都传图（需客户端 VITE_DEMO_OPEN_VISION 同步开启） */
export function isDemoOpenVision(): boolean {
  return process.env.DEMO_OPEN_VISION === 'true';
}

/** 服务端最终是否跳过图像：默认跳过，仅视觉意图时传图；详细回复模式下视觉问题可重复传图 */
export function resolveSkipImage(
  userText: string,
  history: ChatMessage[],
  clientSkip?: boolean,
  replyDetailMode: ReplyDetailMode = 'brief',
): boolean {
  if (isDemoOpenVision()) return Boolean(clientSkip);
  if (clientSkip) return true;
  if (!needsVision(userText)) return true;
  if (replyDetailMode === 'detailed') return false;
  if (hasDescribedAppearance(history)) return true;
  return false;
}

export function buildAppearanceHint(
  history: ChatMessage[],
  userText?: string,
  replyDetailMode: ReplyDetailMode = 'brief',
): string | null {
  if (userText && needsVision(userText) && replyDetailMode === 'detailed') {
    return '【详细回复模式·视觉】用户希望较完整的画面描述。请用 5-8 句分段说明（人物→前景物体→背景环境→光线/色彩）；可补充此前未提到的新细节，但不要逐句重复上一轮已说内容。';
  }
  if (!hasDescribedAppearance(history)) return null;
  if (userText && needsVision(userText)) return null;
  return '【硬性约束】本会话已描述过用户外貌/衣着/眼镜/背景。本轮禁止以任何外貌、衣着、画面背景开头或复述；禁止复制上一轮回复；必须直接、仅回答用户当前新问题。';
}
