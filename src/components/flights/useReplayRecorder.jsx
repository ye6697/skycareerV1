import { useRef, useState, useCallback } from 'react';

// Records a <canvas> element via MediaRecorder and produces a downloadable
// WebM blob. Also exposes a share handler using the Web Share API when the
// device supports sharing files (mobile browsers, Safari on macOS, etc.).
export default function useReplayRecorder() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  }, []);

  const start = useCallback((canvas, { fps = 30, mimeType } = {}) => {
    if (!canvas || typeof canvas.captureStream !== 'function') {
      setError('Canvas recording not supported on this device.');
      return false;
    }
    try {
      // Clean up previous recording
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setBlob(null);
      setError(null);
      chunksRef.current = [];

      const stream = canvas.captureStream(fps);
      const candidates = [
        mimeType,
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ].filter(Boolean);
      const supported = candidates.find((t) => {
        try { return window.MediaRecorder && MediaRecorder.isTypeSupported(t); } catch { return false; }
      });
      const rec = new MediaRecorder(stream, supported ? { mimeType: supported, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = supported || 'video/webm';
        const b = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(b);
        setBlob(b);
        setBlobUrl(url);
        setIsRecording(false);
      };
      rec.onerror = (e) => {
        setError(e?.error?.message || 'Recording error');
        setIsRecording(false);
      };

      rec.start(250);
      setIsRecording(true);
      return true;
    } catch (err) {
      setError(err?.message || 'Failed to start recording');
      return false;
    }
  }, [blobUrl]);

  const download = useCallback((filename = 'replay.webm') => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [blobUrl]);

  const share = useCallback(async (filename = 'replay.webm', title = 'Flight Replay') => {
    if (!blob) return false;
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text: title });
        return true;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      setError(err?.message || 'Share failed');
    }
    return false;
  }, [blob]);

  const reset = useCallback(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setBlob(null);
    chunksRef.current = [];
    setError(null);
  }, [blobUrl]);

  return { start, stop, download, share, reset, isRecording, blobUrl, blob, error };
}