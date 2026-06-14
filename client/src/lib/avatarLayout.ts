import type { AvatarState } from './avatarAssets';

/** 相对 body sprite 显示宽高的归一化偏移（锚点 0.5,0.5），以 idle 立绘为基准 */
export const OCTOPUS_ANCHOR = {
  offsetX: 0.2,
  offsetY: -0.4,
  scale: 0.11,
};

/** 四态 PNG 头部构图略有偏差时的像素微调 */
export const OCTOPUS_STATE_NUDGE: Partial<Record<AvatarState, { dx: number; dy: number }>> = {
  listening: { dx: 1, dy: -3 },
  thinking: { dx: 0, dy: -1 },
  speaking: { dx: 0, dy: 0 },
};

export interface OctopusPlacement {
  x: number;
  y: number;
  scale: number;
}

export function resolveOctopusPlacement(
  bodyCx: number,
  bodyCy: number,
  bodyWidth: number,
  bodyHeight: number,
  state: AvatarState,
): OctopusPlacement {
  const nudge = OCTOPUS_STATE_NUDGE[state] ?? { dx: 0, dy: 0 };
  const scale = bodyWidth * OCTOPUS_ANCHOR.scale;
  return {
    x: bodyCx + bodyWidth * OCTOPUS_ANCHOR.offsetX + nudge.dx,
    y: bodyCy + bodyHeight * OCTOPUS_ANCHOR.offsetY + nudge.dy,
    scale,
  };
}

export const MOTION = {
  idle: { breathHz: 2, swayHz: 0.8, swayDeg: 0.015, octopusRotHz: 3, octopusBobHz: 2.5 },
  listening: { leanDeg: 0.025, liftPx: 5, octopusRotHz: 4 },
  thinking: { tiltHz: 1.5, tiltDeg: 0.025, octopusRotHz: 6, octopusBobHz: 5 },
  speaking: { bounceHz: 10, bounceAmp: 0.05, octopusRotHz: 8, octopusPulseHz: 10 },
} as const;
