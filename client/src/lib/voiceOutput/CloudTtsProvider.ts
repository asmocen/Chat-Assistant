import { authFetch } from '../api';

export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const res = await authFetch('/tts', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `TTS 失败 (${res.status})`);
  }

  return res.blob();
}

export function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('音频播放失败'));
    };

    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);
    audio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}
