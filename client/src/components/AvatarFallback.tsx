export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AvatarFallbackProps {
  state: AvatarState;
}

export function AvatarFallback({ state }: AvatarFallbackProps) {
  return (
    <div className={`avatar-fallback avatar-state-${state}`}>
      <div className="avatar-character">
        <div className="avatar-octopus-clip" title="Claude Code 小章鱼发卡">
          🐙
        </div>
        <div className="avatar-face">🐱</div>
        <div className="avatar-headset" />
      </div>
      <p className="avatar-name">cc404喵</p>
      <p className="avatar-state-label">
        {state === 'idle' && '待机中'}
        {state === 'listening' && '正在听…'}
        {state === 'thinking' && '思考中…'}
        {state === 'speaking' && '说话中…'}
      </p>
    </div>
  );
}
