import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceOutputController } from './VoiceOutputController';

const STORAGE_KEY = 'chat_tts_enabled';

function readEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enabled, setEnabledState] = useState(readEnabled);
  const controllerRef = useRef(voiceOutputController);

  useEffect(() => {
    const ctrl = controllerRef.current;
    ctrl.setEnabled(enabled);
    return ctrl.onSpeakingChange(setIsSpeaking);
  }, [enabled]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    controllerRef.current.setEnabled(value);
  }, []);

  const feedStreamingText = useCallback((chunk: string) => {
    controllerRef.current.feedStreamingText(chunk);
  }, []);

  const flushComplete = useCallback((onComplete?: () => void) => {
    void controllerRef.current.flushAndComplete(onComplete);
  }, []);

  const speak = useCallback((text: string, onComplete?: () => void) => {
    controllerRef.current.speakImmediate(text, onComplete);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current.cancel();
  }, []);

  const resetStream = useCallback(() => {
    controllerRef.current.cancel();
  }, []);

  return {
    isSpeaking,
    enabled,
    setEnabled,
    feedStreamingText,
    flushComplete,
    speak,
    cancel,
    resetStream,
  };
}
