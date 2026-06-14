import { fetchSpeechAudio, playAudioBlob } from './CloudTtsProvider';
import { flushRemainder, splitSentences } from './textForSpeech';

type SpeakingListener = (speaking: boolean) => void;

export class VoiceOutputController {
  private enabled = true;
  private buffer = '';
  private queue: string[] = [];
  private processing = false;
  private cancelled = false;
  private currentAudio: HTMLAudioElement | null = null;
  private speakingListeners = new Set<SpeakingListener>();

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.cancel();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onSpeakingChange(listener: SpeakingListener): () => void {
    this.speakingListeners.add(listener);
    return () => this.speakingListeners.delete(listener);
  }

  private setSpeaking(speaking: boolean): void {
    for (const fn of this.speakingListeners) fn(speaking);
  }

  feedStreamingText(chunk: string): void {
    if (!this.enabled || !chunk) return;
    this.buffer += chunk;
    const { sentences, remainder } = splitSentences(this.buffer);
    this.buffer = remainder;
    for (const s of sentences) {
      if (s) this.enqueue(s);
    }
  }

  async flushAndComplete(onComplete?: () => void): Promise<void> {
    if (!this.enabled) {
      this.buffer = '';
      onComplete?.();
      return;
    }

    const tail = flushRemainder(this.buffer);
    this.buffer = '';
    if (tail) this.enqueue(tail);

    await this.waitForQueue();
    onComplete?.();
  }

  speakImmediate(text: string, onComplete?: () => void): void {
    this.cancel(false);
    this.enqueue(text);
    void this.waitForQueue().then(() => onComplete?.());
  }

  cancel(resetBuffer = true): void {
    this.cancelled = true;
    this.queue = [];
    if (resetBuffer) this.buffer = '';
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.setSpeaking(false);
    this.processing = false;
    this.cancelled = false;
  }

  private enqueue(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.queue.push(trimmed);
    void this.processQueue();
  }

  private async waitForQueue(): Promise<void> {
    while (this.processing || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this.enabled) return;
    this.processing = true;

    while (this.queue.length > 0 && !this.cancelled) {
      const segment = this.queue.shift()!;
      this.setSpeaking(true);
      try {
        const blob = await fetchSpeechAudio(segment);
        if (this.cancelled) break;
        await this.playBlob(blob);
      } catch (err) {
        console.warn('[VoiceOutput]', err instanceof Error ? err.message : err);
      }
    }

    this.processing = false;
    if (!this.cancelled && this.queue.length === 0) {
      this.setSpeaking(false);
    } else if (this.queue.length > 0) {
      void this.processQueue();
    }
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
      };

      audio.addEventListener('ended', () => {
        cleanup();
        resolve();
      });
      audio.addEventListener('error', () => {
        cleanup();
        reject(new Error('播放失败'));
      });

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }
}

export const voiceOutputController = new VoiceOutputController();

// re-export for tests
export { playAudioBlob };
