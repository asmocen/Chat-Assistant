import { AVATAR_FALLBACK_BODY, type AvatarState } from '../lib/avatarAssets';

export type { AvatarState };

interface AvatarFallbackProps {
  state: AvatarState;
  isSpeaking?: boolean;
}

const STATE_LABELS: Record<AvatarState, string> = {
  idle: '待机中',
  listening: '正在听…',
  thinking: '思考中…',
  speaking: '说话中…',
};

export function AvatarFallback({ state, isSpeaking = false }: AvatarFallbackProps) {
  const motionState = isSpeaking ? 'speaking' : state;

  return (
    <div
      className={`avatar-fallback avatar-state-${motionState}${isSpeaking ? ' avatar-speaking-active' : ''}`}
    >
      <div className="avatar-character">
        <img
          src={AVATAR_FALLBACK_BODY}
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
