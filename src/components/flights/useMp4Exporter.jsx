import { useRef, useState, useCallback } from 'react';

// Records a <canvas> element via MediaRecorder and saves/shares the resulting
// video. We prefer MP4 directly when the browser supports MediaRecorder output
// in H.264 (Safari, modern Chrome on Mac/iOS, recent Android). Otherwise we
// fall back to WebM (VP9/VP8), which every modern platform can play. We do NOT
// run ffmpeg.wasm transcoding anymore: it requires SharedArrayBuffer and
// cross-origin-isolation headers, which our preview iframe / mobile browsers
// often don't provide, so it silently hung. Direct MediaRecorder output is
// fast, reliable, and works everywhere.

function pickBestMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  const candidates = [
    { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch (_) { /* ignore */ }
  }
  return null;
}

export default function useMp4Exporter() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState(null); // 'recording' | null
  const [error, setError] = useState(null);

  const recordCanvas = useCallback((canvas, durationMs, fps = 45) => {
    return new Promise((resolve, reject) => {
      if (!canvas || typeof canvas.captureStream !== 'function') {
        reject(new Error('Canvas recording not supported on this device.'));
        return;
      }
      const picked = pickBestMimeType();
      if (!picked) {
        reject(new Error('MediaRecorder not supported in this browser.'));
        return;
      }
      try {
        chunksRef.current = [];
        const stream = canvas.captureStream(fps);
        const rec = new MediaRecorder(stream, {
          mimeType: picked.mime,
          videoBitsPerSecond: 10_000_000,
        });
        recorderRef.current = rec;

        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: picked.mime });
          resolve({ blob, ext: picked.ext, mime: picked.mime });
        };
        rec.onerror = (e) => reject(e?.error || new Error('Recording error'));

        rec.start(250);
        setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, durationMs + 300);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  const exportAndHandle = useCallback(async ({
    action,
    getCanvas,
    resetPlayback,
    durationMs,
    filename = 'replay.mp4',
    title = 'Flight Replay',
  }) => {
    if (isExporting) return;
    setError(null);
    setIsExporting(true);
    try {
      const canvas = getCanvas();
      if (!canvas) throw new Error('Canvas not available');

      resetPlayback?.();
      setStatus('recording');
      const { blob, ext, mime } = await recordCanvas(canvas, durationMs);

      // Swap extension if the recorder produced a different format than the
      // caller assumed (e.g. asked for .mp4 but we got webm).
      const finalName = filename.replace(/\.(mp4|webm|mov)$/i, '') + '.' + ext;

      if (action === 'share') {
        const file = new File([blob], finalName, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: title });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = finalName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Export failed');
      }
    } finally {
      setIsExporting(false);
      setStatus(null);
    }
  }, [isExporting, recordCanvas]);

  return { exportAndHandle, isExporting, status, error };
}
