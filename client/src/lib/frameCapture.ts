const MAX_WIDTH = 512;
const JPEG_QUALITY = 0.65;

/** Downscale and compress a video frame for cloud upload (cost control). */
export function captureFrame(
  video: HTMLVideoElement,
  quality = JPEG_QUALITY,
  maxWidth = MAX_WIDTH,
): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const scale = Math.min(1, maxWidth / video.videoWidth);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Simple perceptual hash to detect scene changes and skip redundant uploads. */
export function frameFingerprint(dataUrl: string, sampleSize = 16): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      resolve(`${sampleSize}-${Math.round(sum)}`);
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

export async function isSceneChanged(
  current: string,
  previous: string | null,
  threshold = 500,
): Promise<boolean> {
  if (!previous) return true;
  const [a, b] = await Promise.all([frameFingerprint(current), frameFingerprint(previous)]);
  if (!a || !b) return true;
  const diff = Math.abs(Number(a.split('-')[1]) - Number(b.split('-')[1]));
  return diff > threshold / 100;
}
