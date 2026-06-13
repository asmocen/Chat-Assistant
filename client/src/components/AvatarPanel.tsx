import { AvatarFallback, type AvatarState } from './AvatarFallback';
import { Live2DAvatar } from './Live2DAvatar';

interface AvatarPanelProps {
  state: AvatarState;
  mode: 'fallback' | 'live2d';
}

export function AvatarPanel({ state, mode }: AvatarPanelProps) {
  return (
    <div className="avatar-panel">
      {mode === 'live2d' ? <Live2DAvatar state={state} /> : <AvatarFallback state={state} />}
    </div>
  );
}

export type { AvatarState };
