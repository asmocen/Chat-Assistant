interface StatusBarProps {
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  speechSupported: boolean;
  hasApiKey: boolean | null;
  model: string;
  totalTokens: number;
  requestCount: number;
  kodoHit?: boolean;
  semanticHit?: boolean;
}

export function StatusBar({
  isActive,
  isListening,
  isSpeaking,
  isLoading,
  speechSupported,
  hasApiKey,
  model,
  totalTokens,
  requestCount,
  kodoHit,
  semanticHit,
}: StatusBarProps) {
  const status = !isActive
    ? '未启动'
    : isLoading
      ? '处理中'
      : isSpeaking
        ? '播报中'
        : isListening
          ? '聆听中'
          : '就绪';

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`dot ${status !== '未启动' ? 'on' : ''}`} />
        {status}
      </div>
      <div className="status-item muted">
        {speechSupported ? '端侧语音识别' : '语音识别不可用'}
      </div>
      <div className="status-item muted">
        {hasApiKey === false ? '⚠ 未配置 API Key' : `模型: ${model}`}
      </div>
      <div className="status-item muted cost">
        请求 {requestCount} 次 · {totalTokens} tokens
        {kodoHit === true && ' · Kodo 命中'}
        {kodoHit === false && ' · Kodo 未接入'}
        {semanticHit !== undefined && semanticHit && ' · 语义命中'}
      </div>
    </div>
  );
}
