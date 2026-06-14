import { useCallback, useEffect, useRef, useState } from 'react';

function mapMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '摄像头/麦克风权限被拒绝。请点击地址栏左侧锁图标，允许访问摄像头和麦克风后重试。';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '未检测到摄像头或麦克风，请确认设备已连接。';
      case 'NotReadableError':
      case 'TrackStartError':
        return '摄像头无法打开，可能被其他程序（如 Zoom、Teams）占用，请关闭后重试。';
      case 'OverconstrainedError':
        return '当前摄像头不支持所选分辨率，请重试（已自动降级）。';
      case 'SecurityError':
        return '浏览器安全限制：请使用 http://localhost:5173 访问（不要用 file:// 或 IP 非安全上下文）。';
      default:
        return err.message || '无法访问摄像头或麦克风';
    }
  }
  if (err instanceof Error) return err.message;
  return '无法访问摄像头或麦克风';
}

async function acquireMediaStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      '当前浏览器不支持摄像头访问，请使用 Chrome/Edge 并通过 localhost 打开',
      'NotSupportedError',
    );
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    },
    { video: true, audio: true },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
      console.warn('getUserMedia fallback:', constraints, e);
    }
  }
  throw lastError;
}

export function useMediaStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Bind stream to <video> after React commits the element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((e) => {
        console.warn('video.play():', e);
      });
    }
  }, [stream]);

  const start = useCallback(async (): Promise<boolean> => {
    if (isStarting) return false;
    setIsStarting(true);
    setError(null);

    try {
      stream?.getTracks().forEach((t) => t.stop());

      const media = await acquireMediaStream();
      setStream(media);
      setIsActive(true);
      return true;
    } catch (err) {
      setError(mapMediaError(err));
      setIsActive(false);
      setStream(null);
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, stream]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setIsActive(false);
    setError(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  return { videoRef, stream, error, isActive, isStarting, start, stop };
}
