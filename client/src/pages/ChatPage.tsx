import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarPanel, type AvatarState } from '../components/AvatarPanel';
import { ChatPanel } from '../components/ChatPanel';
import { StatusBar } from '../components/StatusBar';
import { VideoPreview } from '../components/VideoPreview';
import { getWelcomeMessage, useAuth } from '../context/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { checkHealth, streamChat, type ChatMessage } from '../lib/api';
import { captureFrame, isSceneChanged } from '../lib/frameCapture';
import '../App.css';

export default function ChatPage() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const { videoRef, error: mediaError, isActive, start: startMedia, stop: stopMedia } = useMediaStream();
  const { isSpeaking, enabled: ttsEnabled, setEnabled: setTtsEnabled, speak, cancel: cancelSpeak } =
    useSpeechSynthesis();

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
  const [sessionActive, setSessionActive] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'fallback' | 'live2d'>('fallback');
  const [welcomed, setWelcomed] = useState(false);

  const lastFrameRef = useRef<string | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    checkHealth().then((h) => {
      setHasApiKey(h.hasApiKey);
      setModel(h.model);
    });
  }, []);

  useEffect(() => {
    if (username && !welcomed) {
      const welcome = getWelcomeMessage(username);
      setMessages([{ role: 'assistant', content: welcome }]);
      setWelcomed(true);
    }
  }, [username, welcomed]);

  const handleUserInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;

      processingRef.current = true;
      setIsLoading(true);
      setStreamingText('');

      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      let imageBase64: string | undefined;
      let skipImage = false;

      if (videoRef.current && isActive) {
        const frame = captureFrame(videoRef.current);
        if (frame) {
          const changed = await isSceneChanged(frame, lastFrameRef.current);
          if (changed) {
            imageBase64 = frame;
            lastFrameRef.current = frame;
          } else {
            skipImage = true;
          }
        }
      }

      let streamBuffer = '';

      try {
        await streamChat(
          { text: trimmed, imageBase64, history: historyRef.current, skipImage },
          {
            onMeta: (meta) => {
              setLastSentImage(meta.sentImage);
              setLastKodoHit(meta.kodoHit);
              setLastSemanticHit(meta.semanticHit);
            },
            onChunk: (chunk) => {
              streamBuffer += chunk;
              setStreamingText(streamBuffer);
              setIsLoading(false);
            },
            onDone: (reply, usage) => {
              const assistantMsg: ChatMessage = { role: 'assistant', content: reply };
              setMessages((prev) => [...prev, assistantMsg]);
              historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-8);
              setStreamingText('');
              const tokens = usage?.total_tokens ?? 0;
              setLastTokenUsage(tokens);
              setTotalTokens((t) => t + tokens);
              setRequestCount((c) => c + 1);
              speak(reply);
            },
            onError: (err) => {
              setMessages((prev) => [...prev, { role: 'assistant', content: `出错了：${err}` }]);
              setStreamingText('');
            },
          },
        );
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    },
    [videoRef, isActive, speak],
  );

  const { isListening, interimText, supported: speechSupported, start: startListen, stop: stopListen } =
    useSpeechRecognition(handleUserInput);

  const startSession = async () => {
    await startMedia();
    setSessionActive(true);
    startListen();
  };

  const stopSession = () => {
    stopListen();
    stopMedia();
    cancelSpeak();
    setSessionActive(false);
    lastFrameRef.current = null;
  };

  const handleLogout = () => {
    stopSession();
    logout();
    navigate('/login');
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
            Live2D
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            语音播报
          </label>
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
        <VideoPreview
          videoRef={videoRef}
          isActive={isActive}
          isListening={isListening}
          interimText={interimText}
        />
        <div className="avatar-chat-column">
          <AvatarPanel state={avatarState} mode={avatarMode} />
          <ChatPanel
            messages={messages}
            isLoading={isLoading && !streamingText}
            streamingText={streamingText}
            lastTokenUsage={lastTokenUsage}
            lastSentImage={lastSentImage}
          />
        </div>
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
      />
    </div>
  );
}
