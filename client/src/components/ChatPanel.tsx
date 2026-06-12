import type { ChatMessage } from '../lib/api';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  lastTokenUsage?: number;
  lastSentImage?: boolean;
}

export function ChatPanel({ messages, isLoading, lastTokenUsage, lastSentImage }: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>对话记录</h2>
        {(lastTokenUsage !== undefined || lastSentImage !== undefined) && (
          <div className="cost-badge">
            {lastSentImage ? '含画面' : '纯文本'}
            {lastTokenUsage !== undefined && ` · ${lastTokenUsage} tokens`}
          </div>
        )}
      </div>
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            <p>开启摄像头后，直接说话即可与 AI 对话。</p>
            <p className="hint">AI 会在你说话结束时，结合当前画面进行回答。</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>
            <span className="bubble-role">{msg.role === 'user' ? '你' : 'AI'}</span>
            <p>{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="bubble assistant loading">
            <span className="bubble-role">AI</span>
            <p className="typing">正在思考…</p>
          </div>
        )}
      </div>
    </div>
  );
}
