import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/api';

const STORAGE_KEY = 'chatPanelHeight';
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 160;
const MIN_MEDIA_HEIGHT = 96;

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingText?: string;
  lastTokenUsage?: number;
  lastSentImage?: boolean;
}

function readStoredHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_HEIGHT;
    const n = Number(saved);
    if (!Number.isFinite(n)) return DEFAULT_HEIGHT;
    return Math.max(MIN_HEIGHT, n);
  } catch {
    return DEFAULT_HEIGHT;
  }
}

export function ChatPanel({
  messages,
  isLoading,
  streamingText,
  lastTokenUsage,
  lastSentImage,
}: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(readStoredHeight);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_HEIGHT + 200);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const moveHandlerRef = useRef<(event: MouseEvent) => void>(() => {});
  const upHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingText, isLoading]);

  useEffect(() => {
    const parent = panelRef.current?.parentElement;
    if (!parent) return;

    const updateMax = () => {
      const nextMax = Math.max(MIN_HEIGHT, parent.clientHeight - MIN_MEDIA_HEIGHT);
      setMaxHeight(nextMax);
      setHeight((current) => Math.min(current, nextMax));
    };

    updateMax();
    const observer = new ResizeObserver(updateMax);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startY - event.clientY;
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, drag.startH + delta));
      setHeight(next);
    };

    const onUp = () => {
      dragRef.current = null;
      document.body.classList.remove('chat-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    moveHandlerRef.current = onMove;
    upHandlerRef.current = onUp;

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('chat-resizing');
    };
  }, [maxHeight]);

  const startDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startH: height };
      document.body.classList.add('chat-resizing');
      document.addEventListener('mousemove', moveHandlerRef.current);
      document.addEventListener('mouseup', upHandlerRef.current);
    },
    [height],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(height));
    } catch {
      /* ignore quota errors */
    }
  }, [height]);

  return (
    <>
      <div
        className="chat-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="向上拖动展开对话，向下拖动缩小"
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={maxHeight}
        aria-valuenow={height}
        onMouseDown={startDrag}
      >
        <span className="chat-resize-grip" />
        <span className="chat-resize-hint">向上拖动展开对话</span>
        <span className="chat-resize-grip" />
      </div>
      <div ref={panelRef} className="chat-panel" style={{ height: `${height}px` }}>
        <div className="chat-header">
          <h2>对话记录</h2>
          {(lastTokenUsage !== undefined || lastSentImage !== undefined) && (
            <div className="cost-badge">
              {lastSentImage ? '含画面' : '纯文本'}
              {lastTokenUsage !== undefined && ` · ${lastTokenUsage} tokens`}
            </div>
          )}
        </div>
        <div className="chat-messages" ref={containerRef}>
          {messages.length === 0 && !isLoading && (
            <div className="chat-empty">
              <p>开启摄像头后，直接说话即可与 AI 对话。</p>
              <p className="hint">AI 会在你说话结束时，结合当前画面进行回答。</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`bubble ${msg.role}`}>
              <span className="bubble-role">{msg.role === 'user' ? '你' : 'cc404喵'}</span>
              <p>{msg.content}</p>
            </div>
          ))}
          {(isLoading || streamingText) && (
            <div className="bubble assistant loading">
              <span className="bubble-role">cc404喵</span>
              <p className="typing">{streamingText || '正在思考…'}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </>
  );
}
