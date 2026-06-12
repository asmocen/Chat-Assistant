interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isListening: boolean;
  interimText: string;
}

export function VideoPreview({ videoRef, isActive, isListening, interimText }: VideoPreviewProps) {
  return (
    <div className="video-panel">
      <div className="video-wrap">
        <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
        {!isActive && (
          <div className="video-placeholder">
            <span className="placeholder-icon">📷</span>
            <p>点击下方按钮开启摄像头</p>
          </div>
        )}
        {isListening && <div className="listening-pulse" aria-label="正在聆听" />}
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
