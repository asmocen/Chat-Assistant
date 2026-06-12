import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { StatusBar } from './components/StatusBar';
import { VideoPreview } from './components/VideoPreview';
import { useMediaStream } from './hooks/useMediaStream';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { checkHealth, sendChat, type ChatMessage } from './lib/api';
import { captureFrame, isSceneChanged } from './lib/frameCapture';
import './App.css';

export default function App() {
  const { videoRef, error: mediaError, isActive, start: startMedia, stop: stopMedia } = useMediaStream();
  const { isSpeaking, enabled: ttsEnabled, setEnabled: setTtsEnabled, speak, cancel: cancelSpeak } =
    useSpeechSynthesis();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualText, setManualText] = useState('');
  const [lastTokenUsage, setLastTokenUsage] = useState<number | undefined>();
  const [lastSentImage, setLastSentImage] = useState<boolean | undefined>();
  const [totalTokens, setTotalTokens] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [model, setModel] = useState('gpt-4o-mini');
  const [sessionActive, setSessionActive] = useState(false);

  const lastFrameRef = useRef<string | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    checkHealth().then((h) => {
      setHasApiKey(h.hasApiKey);
      setModel(h.model);
    });
  }, []);

  const handleUserInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;

      processingRef.current = true;
      setIsLoading(true);

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

      try {
        const history = historyRef.current;
        const res = await sendChat({
          text: trimmed,
          imageBase64,
          history,
          skipImage,
        });

        const assistantMsg: ChatMessage = { role: 'assistant', content: res.reply };
        setMessages((prev) => [...prev, assistantMsg]);
        historyRef.current = [...history, userMsg, assistantMsg].slice(-8);

        const tokens = res.usage?.total_tokens ?? 0;
        setLastTokenUsage(tokens);
        setLastSentImage(res.sentImage);
        setTotalTokens((t) => t + tokens);
        setRequestCount((c) => c + 1);

        speak(res.reply);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '请求失败';
        setMessages((prev) => [...prev, { role: 'assistant', content: `出错了：${errMsg}` }]);
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

  const handleManualSend = () => {
    if (!manualText.trim()) return;
    handleUserInput(manualText);
    setManualText('');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>AI 视觉对话助手</h1>
          <p className="subtitle">看见 · 听见 · 自然回应</p>
        </div>
        <div className="header-actions">
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
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
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
      />
    </div>
  );
}
