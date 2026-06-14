import { useEffect, useRef, useState } from 'react';
import {
  AVATAR_IMAGES,
  AVATAR_STATES,
  OCTOPUS_CLIP_URL,
  type AvatarState,
} from '../lib/avatarAssets';
import { AvatarFallback } from './AvatarFallback';

const CANVAS_W = 360;
const CANVAS_H = 270;
const CROSSFADE_MS = 200;

interface Live2DAvatarProps {
  state: AvatarState;
}

const STATE_LABELS: Record<AvatarState, string> = {
  idle: '待机中',
  listening: '正在听…',
  thinking: '思考中…',
  speaking: '说话中…',
};

function fitSprite(sprite: import('pixi.js').Sprite): number {
  const tex = sprite.texture;
  const scale = Math.min((CANVAS_W * 0.92) / tex.width, (CANVAS_H * 0.92) / tex.height, 1);
  sprite.scale.set(scale);
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(CANVAS_W / 2, CANVAS_H / 2 + 8);
  return scale;
}

function fitOctopus(sprite: import('pixi.js').Sprite): number {
  const tex = sprite.texture;
  const scale = Math.min(56 / tex.width, 56 / tex.height, 1);
  sprite.scale.set(scale);
  sprite.anchor.set(0.5, 0.9);
  return scale;
}

function applyStateMotion(
  sprite: import('pixi.js').Sprite,
  avatarState: AvatarState,
  t: number,
  baseScale: number,
): void {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2 + 8;

  switch (avatarState) {
    case 'idle': {
      const breath = 1 + Math.sin(t * 2) * 0.02;
      sprite.scale.set(baseScale, baseScale * breath);
      sprite.rotation = 0;
      sprite.position.set(cx, cy);
      break;
    }
    case 'listening':
      sprite.scale.set(baseScale * 1.03);
      sprite.rotation = 0;
      sprite.position.set(cx, cy - 4);
      break;
    case 'thinking':
      sprite.scale.set(baseScale);
      sprite.rotation = Math.sin(t * 1.5) * 0.02;
      sprite.position.set(cx, cy);
      break;
    case 'speaking': {
      const bounce = 1 + Math.sin(t * 8) * 0.04;
      sprite.scale.set(baseScale * bounce);
      sprite.rotation = 0;
      sprite.position.set(cx, cy);
      break;
    }
  }
}

function applyOctopusMotion(
  sprite: import('pixi.js').Sprite,
  avatarState: AvatarState,
  t: number,
  baseScale: number,
  bodyCx: number,
  bodyCy: number,
): void {
  const headX = bodyCx + 52;
  const headY = bodyCy - 72;

  switch (avatarState) {
    case 'idle':
      sprite.rotation = Math.sin(t * 3) * 0.1;
      sprite.position.set(headX, headY + Math.sin(t * 2.5) * 2);
      sprite.scale.set(baseScale);
      break;
    case 'listening':
      sprite.rotation = Math.sin(t * 4) * 0.06;
      sprite.position.set(headX + 2, headY - 3);
      sprite.scale.set(baseScale * 1.05);
      break;
    case 'thinking':
      sprite.rotation = Math.sin(t * 6) * 0.14;
      sprite.position.set(headX, headY + Math.sin(t * 5) * 3);
      sprite.scale.set(baseScale);
      break;
    case 'speaking': {
      const pulse = baseScale * (1 + Math.sin(t * 10) * 0.07);
      sprite.rotation = Math.sin(t * 8) * 0.08;
      sprite.position.set(headX, headY);
      sprite.scale.set(pulse);
      break;
    }
  }
}

export function Live2DAvatar({ state }: Live2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const swapRef = useRef<((next: AvatarState) => Promise<void>) | null>(null);

  useEffect(() => {
    let destroyed = false;
    let app: import('pixi.js').Application | null = null;
    let spriteA: import('pixi.js').Sprite | null = null;
    let spriteB: import('pixi.js').Sprite | null = null;
    let octopusSprite: import('pixi.js').Sprite | null = null;
    let activeIsA = true;
    let baseScale = 0.35;
    let octopusBaseScale = 1;
    let fading = false;
    let fadeStart = 0;
    let fadeOut: import('pixi.js').Sprite | null = null;
    let fadeIn: import('pixi.js').Sprite | null = null;
    const textures = new Map<AvatarState, import('pixi.js').Texture>();

    const getActive = () => (activeIsA ? spriteA : spriteB)!;
    const getInactive = () => (activeIsA ? spriteB : spriteA)!;

    const loadTexture = async (PIXI: typeof import('pixi.js'), url: string) => {
      const tex = PIXI.Texture.from(url);
      if (!tex.valid) {
        await new Promise<void>((resolve, reject) => {
          tex.baseTexture.once('loaded', () => resolve());
          tex.baseTexture.once('error', reject);
        });
      }
      if (destroyed) throw new Error('destroyed');
      return tex;
    };

    const loadAvatarTexture = async (PIXI: typeof import('pixi.js'), s: AvatarState) => {
      let tex = textures.get(s);
      if (tex) return tex;
      tex = await loadTexture(PIXI, AVATAR_IMAGES[s]);
      textures.set(s, tex);
      return tex;
    };

    swapRef.current = async (next: AvatarState) => {
      if (!spriteA || !spriteB || destroyed) return;

      const PIXI = await import('pixi.js');
      const tex = await loadAvatarTexture(PIXI, next);
      const active = getActive();
      if (active.texture === tex && active.alpha > 0.9) return;

      const inactive = getInactive();
      inactive.texture = tex;
      baseScale = fitSprite(inactive);
      inactive.alpha = 0;

      fadeOut = active;
      fadeIn = inactive;
      fading = true;
      fadeStart = performance.now();
      activeIsA = !activeIsA;
    };

    (async () => {
      try {
        const PIXI = await import('pixi.js');
        if (!canvasRef.current || destroyed) return;

        app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          backgroundAlpha: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          antialias: true,
        });

        await Promise.all(AVATAR_STATES.map((s) => loadAvatarTexture(PIXI, s)));
        const octopusTex = await loadTexture(PIXI, OCTOPUS_CLIP_URL);
        if (destroyed || !app) return;

        const initial = textures.get(stateRef.current)!;
        spriteA = new PIXI.Sprite(initial);
        spriteB = new PIXI.Sprite(initial);
        spriteB.alpha = 0;
        baseScale = fitSprite(spriteA);
        fitSprite(spriteB);

        octopusSprite = new PIXI.Sprite(octopusTex);
        octopusBaseScale = fitOctopus(octopusSprite);

        app.stage.addChild(spriteA, spriteB, octopusSprite);

        app.ticker.add(() => {
          if (!spriteA || !spriteB || !octopusSprite) return;
          const t = performance.now() / 1000;

          if (fading && fadeOut && fadeIn) {
            const p = Math.min(1, (performance.now() - fadeStart) / CROSSFADE_MS);
            fadeOut.alpha = 1 - p;
            fadeIn.alpha = p;
            if (p >= 1) fading = false;
          }

          const visible = spriteA.alpha >= spriteB.alpha ? spriteA : spriteB;
          applyStateMotion(visible, stateRef.current, t, baseScale);
          applyOctopusMotion(
            octopusSprite,
            stateRef.current,
            t,
            octopusBaseScale,
            visible.position.x,
            visible.position.y,
          );
        });
      } catch (err) {
        console.warn('Pixi avatar load failed, use Fallback:', err);
        if (!destroyed) setFailed(true);
      }
    })();

    return () => {
      destroyed = true;
      swapRef.current = null;
      app?.destroy(true);
    };
  }, []);

  useEffect(() => {
    void swapRef.current?.(state);
  }, [state]);

  if (failed) {
    return <AvatarFallback state={state} />;
  }

  return (
    <div className={`live2d-wrap avatar-state-${state}`}>
      <div className="live2d-stage">
        <canvas ref={canvasRef} className="live2d-canvas" width={CANVAS_W} height={CANVAS_H} />
      </div>
      <p className="avatar-name">cc404喵</p>
      <p className="avatar-state-label">{STATE_LABELS[state]}</p>
    </div>
  );
}
