import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const FATAL_RECOGNITION_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

function mapRecognitionError(error: string): string | null {
  switch (error) {
    case 'not-allowed':
      return '麦克风权限被拒绝。请在浏览器地址栏允许麦克风访问后，重新点击「开始对话」。';
    case 'service-not-allowed':
      return '当前页面无法使用语音识别。请通过 http://localhost:5173 访问（Chrome/Edge）。';
    case 'audio-capture':
      return '无法访问麦克风，请确认设备已连接且未被其他程序占用。';
    case 'network':
      return '语音识别网络异常，正在自动重试…';
    default:
      return null;
  }
}

export function useSpeechRecognition(onFinalTranscript: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinalTranscript);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const startEngineRef = useRef<() => void>(() => {});

  const scheduleRestart = useCallback(() => {
    if (!shouldListenRef.current) return;
    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!shouldListenRef.current) return;
      startEngineRef.current();
    }, 250);
  }, [clearRestartTimer]);

  const startEngine = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor || !shouldListenRef.current) return;

    clearRestartTimer();
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      scheduleRestart();
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal && transcript) {
          onFinalRef.current(transcript);
          setInterimText('');
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;

      const message = mapRecognitionError(event.error);
      if (message) setError(message);

      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }

      if (FATAL_RECOGNITION_ERRORS.has(event.error)) {
        shouldListenRef.current = false;
        setIsListening(false);
        return;
      }

      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      scheduleRestart();
    }
  }, [clearRestartTimer, scheduleRestart]);

  useEffect(() => {
    startEngineRef.current = startEngine;
  }, [startEngine]);

  const start = useCallback(() => {
    if (!getSpeechRecognition()) return;
    shouldListenRef.current = true;
    setError(null);
    startEngine();
  }, [startEngine]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    recognitionRef.current?.abort();
    setIsListening(false);
    setInterimText('');
  }, [clearRestartTimer]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
    };
  }, [clearRestartTimer]);

  return { isListening, interimText, supported, error, start, stop };
}
