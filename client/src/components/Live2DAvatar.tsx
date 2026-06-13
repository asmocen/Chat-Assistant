import { useEffect, useRef, useState } from 'react';
import { AvatarFallback, type AvatarState } from './AvatarFallback';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';

interface Live2DAvatarProps {
  state: AvatarState;
}

export function Live2DAvatar({ state }: Live2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let app: import('pixi.js').Application | null = null;

    (async () => {
      try {
        const PIXI = await import('pixi.js');
        const { Live2DModel } = await import('pixi-live2d-display/cubism4');

        if (!canvasRef.current || destroyed) return;

        // @ts-expect-error pixi-live2d-display global hook
        window.PIXI = PIXI;

        app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          backgroundAlpha: 0,
          width: 280,
          height: 320,
          antialias: true,
        });

        const model = await Live2DModel.from(MODEL_URL);
        if (destroyed || !app) return;

        model.scale.set(0.18);
        model.anchor.set(0.5, 0.5);
        model.position.set(app.screen.width / 2, app.screen.height * 0.55);
        app.stage.addChild(model);

        const octopus = new PIXI.Text('🐙', { fontSize: 36 });
        octopus.anchor.set(0.5);
        octopus.position.set(app.screen.width / 2 + 40, app.screen.height * 0.28);
        app.stage.addChild(octopus);
      } catch (err) {
        console.warn('Live2D load failed, use Fallback:', err);
        if (!destroyed) setFailed(true);
      }
    })();

    return () => {
      destroyed = true;
      app?.destroy(true);
    };
  }, []);

  if (failed) {
    return <AvatarFallback state={state} />;
  }

  return (
    <div className={`live2d-wrap avatar-state-${state}`}>
      <canvas ref={canvasRef} className="live2d-canvas" />
      <p className="avatar-name">cc404喵</p>
      <p className="avatar-state-label">Live2D 模式</p>
    </div>
  );
}
