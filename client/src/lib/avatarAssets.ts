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
