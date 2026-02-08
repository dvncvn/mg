/**
 * Save the current canvas as a PNG download.
 */
export function savePNG(canvas: HTMLCanvasElement, seed: number): void {
  const link = document.createElement('a');
  link.download = `mg-${String(seed).padStart(3, '0')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Record one full loop as WebM using MediaRecorder.
 * Returns a promise that resolves when recording is done.
 */
export function recordWebM(
  canvas: HTMLCanvasElement,
  durationMs: number,
  seed: number,
  onStart?: () => void,
  onStop?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mg-${String(seed).padStart(3, '0')}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onStop?.();
      resolve();
    };

    recorder.onerror = (e) => {
      onStop?.();
      reject(e);
    };

    recorder.start();
    onStart?.();
    setTimeout(() => recorder.stop(), durationMs);
  });
}
