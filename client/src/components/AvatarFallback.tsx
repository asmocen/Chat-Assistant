import { AVATAR_IMAGES, type AvatarState } from '../lib/avatarAssets';

export type { AvatarState };

interface AvatarFallbackProps {
  state: AvatarState;
}

const STATE_LABELS: Record<AvatarState, string> = {
  idle: '待机中',
  listening: '正在听…',
  thinking: '思考中…',
  speaking: '说话中…',
};

export function AvatarFallback({ state }: AvatarFallbackProps) {
  return (
    <div className={`avatar-fallback avatar-state-${state}`}>
      <div className="avatar-character">
        <img
          src={AVATAR_IMAGES[state]}
          alt="cc404喵"
          className="avatar-portrait"
          draggable={false}
        />
      </div>
      <p className="avatar-name">cc404喵</p>
      <p className="avatar-state-label">{STATE_LABELS[state]}</p>
    </div>
  );
}
