export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const AVATAR_IMAGES: Record<AvatarState, string> = {
  idle: '/avatar/cc404-idle.png',
  listening: '/avatar/cc404-listening.png',
  thinking: '/avatar/cc404-thinking.png',
  speaking: '/avatar/cc404-speaking.png',
};

export const OCTOPUS_CLIP_URL = '/avatar/octopus-clip.png';
export const AVATAR_FALLBACK_BODY = '/avatar/cc404-body.png';

export const AVATAR_STATES: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking'];

/**
 * 四态立绘是否已 baked 章鱼发卡。
 * 当前 GPT 素材含发卡 → false 叠加层，避免双章鱼。
 * 替换为「无章鱼」四态 PNG 后改为 true，由 octopus-clip.png 单独叠加到发夹位。
 */
export const USE_OCTOPUS_OVERLAY = false;
