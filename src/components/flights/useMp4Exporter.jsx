import { useRef, useState, useCallback } from 'react';

// Records a <canvas> element via MediaRecorder (WebM) and converts the result
// to MP4 (H.264) using ffmpeg.wasm. Exposes a single `exportAndHandle` method
// that captures the full replay, converts it, and then either downloads or
// shares the resulting MP4. The caller provides:
//   - getCanvas():     returns the canvas element to capture
//   - resetPlayback(): rewinds the replay to the beginning and starts playback
//   - durationMs:      total length of the replay in ms (so we know when to stop)
let ffmpegSingleton = null;

async function loadFfmpeg(setStatus) {
  if (ffmpegSingleton) return ffmpegSingleton;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ff = new FFmpeg();
  setStatus?.('loading_ffmpeg');
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegSingleton = ff;
  return ff;
}

export default function useMp4Exporter() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState(null); // 'recording' | 'loading_ffmpeg' | 'converting' | null
  const [error, setError] = useState(null);

  const recordCanvasToWebm = useCallback((canvas, durationMs, fps = 30) => {
    return new Promise((resolve, reject) => {
      if (!canvas || typeof canvas.captureStream !== 'function') {
        reject(new Error('Canvas recording not supported on this device.'));
        return;
      }
      try {
        chunksRef.current = [];
        const stream = canvas.captureStream(fps);
        const candidates = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        const supported = candidates.find((t) => {
          try { return window.MediaRecorder && MediaRecorder.isTypeSupported(t); } catch { return false; }
        });
        const rec = new MediaRecorder(
          stream,
          supported ? { mimeType: supported, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 }
        );
        recorderRef.current = rec;

        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const type = supported || 'video/webm';
          const blob = new Blob(chunksRef.current, { type });
          resolve(blob);
        };
        rec.onerror = (e) => reject(e?.error || new Error('Recording error'));

        rec.start(250);
        // Stop after the replay duration plus a small tail to capture the final frame.
        setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, durationMs + 300);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  const convertToMp4 = useCallback(async (webmBlob) => {
    setStatus('loading_ffmpeg');
    const ff = await loadFfmpeg(setStatus);
    setStatus('converting');
    const inputName = 'input.webm';
    const outputName = 'output.mp4';
    const arrayBuffer = await webmBlob.arrayBuffer();
    await ff.writeFile(inputName, new Uint8Array(arrayBuffer));
    // Transcode to H.264 MP4 with broad compatibility (yuv420p, faststart).
    await ff.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outputName,
    ]);
    const data = await ff.readFile(outputName);
    try { await ff.deleteFile(inputName); } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}
    return new Blob([data.buffer], { type: 'video/mp4' });
  }, []);

  // Main entry: record + convert, then run an action with the final MP4 blob.
  // action: 'download' | 'share'
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

      // Rewind and play from start so the full replay is captured.
      resetPlayback?.();
      setStatus('recording');
      const webm = await recordCanvasToWebm(canvas, durationMs);
      const mp4 = await convertToMp4(webm);

      if (action === 'share') {
        const file = new File([mp4], filename, { type: 'video/mp4' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: title });
        } else {
          // Fallback: download if sharing unsupported.
          const url = URL.createObjectURL(mp4);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        const url = URL.createObjectURL(mp4);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
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
  }, [convertToMp4, isExporting, recordCanvasToWebm]);

  return { exportAndHandle, isExporting, status, error };
}