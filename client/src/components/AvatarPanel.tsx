import { AvatarFallback, type AvatarState } from './AvatarFallback';
import { Live2DAvatar } from './Live2DAvatar';

interface AvatarPanelProps {
  state: AvatarState;
  mode: 'fallback' | 'live2d';
  isSpeaking?: boolean;
}

export function AvatarPanel({ state, mode, isSpeaking }: AvatarPanelProps) {
  return (
    <div className="avatar-panel">
      {mode === 'live2d' ? (
        <Live2DAvatar state={state} isSpeaking={isSpeaking} />
      ) : (
        <AvatarFallback state={state} isSpeaking={isSpeaking} />
      )}
    </div>
  );
}

export type { AvatarState };
