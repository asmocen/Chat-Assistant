import { AvatarFallback, type AvatarState } from './AvatarFallback';
// TODO: 后续启用 Pixi Live2D 四态模式时取消注释
// import { Live2DAvatar } from './Live2DAvatar';

interface AvatarPanelProps {
  state: AvatarState;
  mode: 'fallback' | 'live2d';
}

export function AvatarPanel({ state, mode: _mode }: AvatarPanelProps) {
  void _mode; // 暂固定 fallback，保留 prop 便于后续恢复 Live2D 开关
  return (
    <div className="avatar-panel">
      <AvatarFallback state={state} />
      {/* TODO: 后续恢复 — mode === 'live2d' ? <Live2DAvatar state={state} /> : <AvatarFallback state={state} /> */}
    </div>
  );
}

export type { AvatarState };
