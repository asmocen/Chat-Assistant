interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isStarting?: boolean;
  isListening: boolean;
  interimText: string;
  error?: string | null;
  onRetry?: () => void;
}

export function VideoPreview({
  videoRef,
  isActive,
  isStarting,
  isListening,
  interimText,
  error,
  onRetry,
}: VideoPreviewProps) {
  return (
    <div className="video-panel">
      <div className="video-wrap">
        <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
        {!isActive && (
          <div className="video-placeholder">
            <span className="placeholder-icon">📷</span>
            {isStarting ? (
              <p>正在请求摄像头权限…</p>
            ) : error ? (
              <>
                <p className="video-error-text">{error}</p>
                {onRetry && (
                  <button type="button" className="btn primary video-retry-btn" onClick={onRetry}>
                    重新授权
                  </button>
                )}
              </>
            ) : (
              <p>点击「开始对话」开启摄像头</p>
            )}
          </div>
        )}
        {isActive && isListening && <div className="listening-pulse" aria-label="正在聆听" />}
      </div>
      {interimText && (
        <div className="interim-bar">
          <span className="interim-label">识别中</span>
          <span className="interim-text">{interimText}</span>
        </div>
      )}
    </div>
  );
}
