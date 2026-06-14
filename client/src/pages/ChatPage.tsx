import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarPanel, type AvatarState } from '../components/AvatarPanel';
import { ChatPanel } from '../components/ChatPanel';
import { StatusBar } from '../components/StatusBar';
import { VideoPreview } from '../components/VideoPreview';
import { getWelcomeMessage, useAuth } from '../context/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useVoiceOutput } from '../lib/voiceOutput/useVoiceOutput';
import {
  checkHealth,
  clearStoredSessionId,
  getOrCreateSessionApi,
  getStoredSessionId,
  setStoredSessionId,
  streamChat,
  type ChatMessage,
  type ReplyDetailMode,
  type WebSearchInfo,
} from '../lib/api';
import { captureFrame, isSceneChanged } from '../lib/frameCapture';
import '../App.css';

function needsVision(text: string): boolean {
  return /画面|看到什么|看见我|摄像头|穿什么|手里|拿着|这是什么|是什么东西|看看你|识别|描述一下我|我长什么样|外貌|长相/.test(
    text,
  );
}

function shouldSkipImage(text: string): boolean {
  if (needsVision(text)) return false;
  return true;
}

const REPLY_MODE_KEY = 'reply_detail_mode';
const LEGACY_VISION_MODE_KEY = 'vision_detail_mode';

function loadReplyDetailMode(): ReplyDetailMode {
  const stored =
    localStorage.getItem(REPLY_MODE_KEY) ?? localStorage.getItem(LEGACY_VISION_MODE_KEY);
  return stored === 'detailed' ? 'detailed' : 'brief';
}

export default function ChatPage() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const { videoRef, error: mediaError, isActive, isStarting, start: startMedia, stop: stopMedia } =
    useMediaStream();
  const { isSpeaking, enabled: ttsEnabled, setEnabled: setTtsEnabled, feedStreamingText, flushComplete, cancel: cancelSpeak, resetStream } =
    useVoiceOutput();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualText, setManualText] = useState('');
  const [lastTokenUsage, setLastTokenUsage] = useState<number | undefined>();
  const [lastSentImage, setLastSentImage] = useState<boolean | undefined>();
  const [lastKodoHit, setLastKodoHit] = useState<boolean | undefined>();
  const [lastSemanticHit, setLastSemanticHit] = useState<boolean | undefined>();
  const [totalTokens, setTotalTokens] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [model, setModel] = useState('qwen-vl-plus');
  const [qiniuConfigured, setQiniuConfigured] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'fallback' | 'live2d'>('live2d');
  const [lastMemoryHit, setLastMemoryHit] = useState<boolean | undefined>();
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [lastWebSearch, setLastWebSearch] = useState<WebSearchInfo | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean | null>(null);
  const [mcpConnected, setMcpConnected] = useState<boolean | null>(null);
  const [ttsEnabledServer, setTtsEnabledServer] = useState<boolean | null>(null);
  const [replyDetailMode, setReplyDetailMode] = useState<ReplyDetailMode>(loadReplyDetailMode);
  const [welcomed, setWelcomed] = useState(false);

  const lastFrameRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const lastInputRef = useRef<{ text: string; at: number } | null>(null);
  const sessionActiveRef = useRef(false);
  const startListenRef = useRef<() => void>(() => {});
  const stopListenRef = useRef<() => void>(() => {});

  useEffect(() => {
    checkHealth().then((h) => {
      setHasApiKey(h.hasApiKey);
      setModel(h.model);
      setQiniuConfigured(h.qiniuConfigured ?? false);
      setWebSearchEnabled(h.webSearchEnabled ?? true);
      setMcpConnected(h.mcpConnected ?? false);
      setTtsEnabledServer(h.ttsEnabled ?? false);
    });
  }, []);

  useEffect(() => {
    if (!username || welcomed) return;

    const welcome = getWelcomeMessage(username);
    const storedSessionId = getStoredSessionId(username);

    getOrCreateSessionApi(storedSessionId)
      .then(({ sessionId: sid, messages: restored, memoryHit }) => {
        sessionIdRef.current = sid;
        setStoredSessionId(username, sid);
        if (restored.length > 0) {
          setMessages([{ role: 'assistant', content: welcome }, ...restored]);
        } else {
          setMessages([{ role: 'assistant', content: welcome }]);
        }
        if (memoryHit) setLastMemoryHit(true);
        setWelcomed(true);
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: welcome }]);
        setWelcomed(true);
      });
  }, [username, welcomed]);

  const handleUserInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;

      const last = lastInputRef.current;
      if (last && last.text === trimmed && Date.now() - last.at < 4000) return;
      lastInputRef.current = { text: trimmed, at: Date.now() };

      stopListenRef.current();
      processingRef.current = true;
      setIsLoading(true);
      setStreamingText('');
      setLastWebSearch(null);
      resetStream();

      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      let imageBase64: string | undefined;
      let skipImage = shouldSkipImage(trimmed);

      if (!skipImage && videoRef.current && isActive) {
        const frame = captureFrame(videoRef.current);
        if (frame) {
          const changed = await isSceneChanged(frame, lastFrameRef.current);
          const forceFrame = replyDetailMode === 'detailed' && needsVision(trimmed);
          if (changed || forceFrame) {
            imageBase64 = frame;
            lastFrameRef.current = frame;
          } else {
            skipImage = true;
          }
        }
      }

      let streamBuffer = '';

      const resumeListening = () => {
        if (sessionActiveRef.current) startListenRef.current();
      };

      try {
        await streamChat(
          {
            text: trimmed,
            imageBase64,
            history: [],
            sessionId: sessionIdRef.current,
            skipImage,
            replyDetailMode,
          },
          {
            onMeta: (meta) => {
              setLastSentImage(meta.sentImage);
              setLastKodoHit(meta.kodoHit);
              setLastSemanticHit(meta.semanticHit);
              if (meta.memoryHit) setLastMemoryHit(true);
              if (meta.sessionId) {
                sessionIdRef.current = meta.sessionId;
                if (username) setStoredSessionId(username, meta.sessionId);
              }
              if (meta.toolsUsed?.length) setLastToolsUsed(meta.toolsUsed);
              if (
                meta.webSearchSummary?.length ||
                meta.webSearchFailed ||
                meta.webSearchProvider
              ) {
                setLastWebSearch({
                  webSearchSummary: meta.webSearchSummary,
                  webSearchProvider: meta.webSearchProvider,
                  webSearchFailed: meta.webSearchFailed,
                });
              }
            },
            onChunk: (chunk) => {
              streamBuffer += chunk;
              setStreamingText(streamBuffer);
              setIsLoading(false);
              feedStreamingText(chunk);
            },
            onDone: (reply, usage, toolsUsed, webSearch) => {
              const assistantMsg: ChatMessage = { role: 'assistant', content: reply };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText('');
              const tokens = usage?.total_tokens ?? 0;
              setLastTokenUsage(tokens);
              setTotalTokens((t) => t + tokens);
              setRequestCount((c) => c + 1);
              if (toolsUsed?.length) setLastToolsUsed(toolsUsed);
              if (
                webSearch?.webSearchSummary?.length ||
                webSearch?.webSearchFailed ||
                webSearch?.webSearchProvider
              ) {
                setLastWebSearch(webSearch);
              }
              flushComplete(resumeListening);
            },
            onError: (err) => {
              setMessages((prev) => [...prev, { role: 'assistant', content: `出错了：${err}` }]);
              setStreamingText('');
              resumeListening();
            },
          },
        );
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    },
    [videoRef, isActive, flushComplete, feedStreamingText, resetStream, username, replyDetailMode],
  );

  const { isListening, interimText, supported: speechSupported, start: startListen, stop: stopListen } =
    useSpeechRecognition(handleUserInput);

  startListenRef.current = startListen;
  stopListenRef.current = stopListen;

  const startSession = async () => {
    const ok = await startMedia();
    if (ok) {
      sessionActiveRef.current = true;
      setSessionActive(true);
      startListen();
    }
  };

  const stopSession = () => {
    stopListen();
    stopMedia();
    cancelSpeak();
    sessionActiveRef.current = false;
    setSessionActive(false);
    lastFrameRef.current = null;
  };

  const handleLogout = () => {
    stopSession();
    if (username) clearStoredSessionId(username);
    logout();
    navigate('/login');
  };

  const handleReplyModeChange = (mode: ReplyDetailMode) => {
    setReplyDetailMode(mode);
    localStorage.setItem(REPLY_MODE_KEY, mode);
  };

  const handleManualSend = () => {
    if (!manualText.trim()) return;
    handleUserInput(manualText);
    setManualText('');
  };

  const avatarState: AvatarState = isSpeaking
    ? 'speaking'
    : isListening
      ? 'listening'
      : isLoading || streamingText
        ? 'thinking'
        : 'idle';

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>cc404喵</h1>
          <p className="subtitle">视觉对话助手 · {username}</p>
        </div>
        <div className="header-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={avatarMode === 'live2d'}
              onChange={(e) => setAvatarMode(e.target.checked ? 'live2d' : 'fallback')}
            />
            靠近一点
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            语音播报
          </label>
          <div className="reply-mode-switch" title="控制 AI 对话回复的详略程度">
            <span className="reply-mode-label">对话回复</span>
            <button
              type="button"
              className={`reply-mode-btn ${replyDetailMode === 'brief' ? 'active' : ''}`}
              onClick={() => handleReplyModeChange('brief')}
            >
              简约
            </button>
            <button
              type="button"
              className={`reply-mode-btn ${replyDetailMode === 'detailed' ? 'active' : ''}`}
              onClick={() => handleReplyModeChange('detailed')}
            >
              详细
            </button>
          </div>
          {!sessionActive ? (
            <button className="btn primary" onClick={startSession}>
              开始对话
            </button>
          ) : (
            <button className="btn danger" onClick={stopSession}>
              结束
            </button>
          )}
          <button className="btn danger" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      {mediaError && <div className="alert">{mediaError}</div>}
      {!speechSupported && (
        <div className="alert warn">
          当前浏览器不支持 Web Speech API，请使用 Chrome/Edge，或通过下方文本框输入。
        </div>
      )}

      <main className="app-main">
        <div className="media-row">
          <AvatarPanel state={avatarState} mode={avatarMode} isSpeaking={isSpeaking} />
          <VideoPreview
            videoRef={videoRef}
            isActive={isActive}
            isStarting={isStarting}
            isListening={isListening}
            interimText={interimText}
            error={mediaError}
            onRetry={startSession}
          />
        </div>
        <ChatPanel
          messages={messages}
          isLoading={isLoading && !streamingText}
          streamingText={streamingText}
          lastTokenUsage={lastTokenUsage}
          lastSentImage={lastSentImage}
        />
      </main>

      <footer className="input-bar">
        <input
          type="text"
          placeholder="也可在此输入文字（回车发送）…"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
          disabled={isLoading}
        />
        <button className="btn primary" onClick={handleManualSend} disabled={isLoading || !manualText.trim()}>
          发送
        </button>
      </footer>

      <StatusBar
        isActive={isActive}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isLoading={isLoading}
        speechSupported={speechSupported}
        hasApiKey={hasApiKey}
        model={model}
        totalTokens={totalTokens}
        requestCount={requestCount}
        kodoHit={lastKodoHit}
        semanticHit={lastSemanticHit}
        memoryHit={lastMemoryHit}
        toolsUsed={lastToolsUsed}
        webSearchEnabled={webSearchEnabled}
        mcpConnected={mcpConnected}
        ttsEnabled={ttsEnabledServer}
        qiniuConfigured={qiniuConfigured}
        sentImage={lastSentImage}
        webSearch={lastWebSearch}
        replyDetailMode={replyDetailMode}
      />
    </div>
  );
}
