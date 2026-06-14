import type { WebSearchInfo } from '../lib/api';

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
  memoryHit?: boolean;
  toolsUsed?: string[];
  webSearchEnabled?: boolean | null;
  mcpConnected?: boolean | null;
  ttsEnabled?: boolean | null;
  qiniuConfigured?: boolean | null;
  sentImage?: boolean;
  webSearch?: WebSearchInfo | null;
  replyDetailMode?: 'brief' | 'detailed';
}

function formatProviderLabel(provider: string | null | undefined): string {
  if (!provider) return '';
  if (provider.startsWith('web_search:')) return provider.replace('web_search:', '');
  if (provider.startsWith('mcp:')) return provider.replace('mcp:', '');
  return provider;
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
  memoryHit,
  toolsUsed,
  webSearchEnabled,
  mcpConnected,
  ttsEnabled,
  qiniuConfigured,
  sentImage,
  webSearch,
  replyDetailMode,
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

  const toolLabel =
    toolsUsed && toolsUsed.length > 0
      ? toolsUsed.some((t) => t.includes('web_search') || t.startsWith('mcp:'))
        ? ' · 联网查询'
        : toolsUsed.includes('memory_recall')
          ? ' · 记忆召回'
          : ` · ${toolsUsed[0]}`
      : '';

  const summary = webSearch?.webSearchSummary ?? [];
  const showWebFailed = webSearch?.webSearchFailed && summary.length === 0;
  const provider = formatProviderLabel(webSearch?.webSearchProvider);

  return (
    <div className="status-bar-wrap">
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
        {webSearchEnabled === true && ' · 联网 Skill 开'}
        {replyDetailMode === 'detailed' && ' · 回复详细'}
        {replyDetailMode === 'brief' && ' · 回复简约'}
        {ttsEnabled === true && ' · 云端 TTS'}
          {mcpConnected === true && ' · MCP 已接'}
          {mcpConnected === false && webSearchEnabled === true && ' · MCP 未接(用内置搜索)'}
        </div>
        <div className="status-item muted cost">
          请求 {requestCount} 次 · {totalTokens} tokens
          {memoryHit === true && ' · 服务端记忆'}
          {kodoHit === true && ' · Kodo 命中'}
          {qiniuConfigured === false && ' · Kodo 可选·未配置'}
          {kodoHit === false && qiniuConfigured === true && sentImage && ' · Kodo 新帧'}
          {semanticHit === true && ' · 语义命中'}
          {toolLabel}
        </div>
      </div>

      {(summary.length > 0 || showWebFailed) && (
        <div className="status-web-summary" title="本轮回答所依据的联网检索摘要">
          <span className="status-web-label">
            联网摘要{provider ? ` · ${provider}` : ''}
          </span>
          {showWebFailed ? (
            <span className="status-web-failed">未获取到有效结果</span>
          ) : (
            <ul className="status-web-list">
              {summary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
