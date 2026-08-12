export type StillImageFormat = 'jpg' | 'png';

export type MotionFrame = {
  durationMs: number;
  index: number;
  timeMs: number;
};

export type MotionExportOptions = {
  canvas: HTMLCanvasElement;
  durationMs: number;
  fps: number;
  onProgress?: (progress: number) => void;
  renderFrame: (frame: MotionFrame) => Promise<void> | void;
};

export function buildMotionFrames(durationMs: number, fps: number): MotionFrame[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError('Motion duration must be greater than zero.');
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('Frame rate must be greater than zero.');
  const frameDurationMs = 1_000 / fps;
  const frameCount = Math.max(2, Math.round(durationMs / frameDurationMs));
  return Array.from({ length: frameCount }, (_, index) => ({
    durationMs: frameDurationMs,
    index,
    timeMs: index * frameDurationMs,
  }));
}

export function seamlessLoopBlendAmount(timeMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError('Loop duration must be greater than zero.');
  const progress = Math.min(1, Math.max(0, timeMs / durationMs));
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

export function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  format: StillImageFormat,
  quality = 0.92
): Promise<Blob> {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.size > 0) resolve(blob);
      else reject(new Error(`${format.toUpperCase()} encoding returned an empty file.`));
    }, mimeType, format === 'jpg' ? quality : undefined);
  });
}

export async function encodeCanvasGif({
  canvas,
  durationMs,
  fps,
  onProgress,
  renderFrame,
}: MotionExportOptions): Promise<Blob> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  const frames = buildMotionFrames(durationMs, fps);
  const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
  const gif = GIFEncoder();

  for (const frame of frames) {
    await renderFrame(frame);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    // A palette per frame preserves moving holographic color fields instead of
    // forcing every frame through the colors found in the opening frame.
    const palette = quantize(pixels, 256, { format: 'rgb565' });
    gif.writeFrame(applyPalette(pixels, palette, 'rgb565'), canvas.width, canvas.height, {
      delay: frame.durationMs,
      palette,
      ...(frame.index === 0 ? { repeat: 0 } : {}),
    });
    onProgress?.((frame.index + 1) / frames.length);
  }

  gif.finish();
  const bytes = Uint8Array.from(gif.bytes());
  if (bytes.length < 6) throw new Error('GIF encoding returned an empty file.');
  return new Blob([bytes], { type: 'image/gif' });
}

export async function encodeCanvasMp4({
  canvas,
  durationMs,
  fps,
  onProgress,
  renderFrame,
}: MotionExportOptions): Promise<Blob> {
  const {
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    Quality,
    getFirstEncodableVideoCodec,
  } = await import('mediabunny');
  const frames = buildMotionFrames(durationMs, fps);
  const quality = new Quality('high');
  const format = new Mp4OutputFormat({ fastStart: 'in-memory' });
  const supportedCodecs = format.getSupportedVideoCodecs();
  const codecCandidates = ['avc', ...supportedCodecs.filter((codec) => codec !== 'avc')] as typeof supportedCodecs;
  const codec = await getFirstEncodableVideoCodec(codecCandidates, {
    height: canvas.height,
    quality,
    width: canvas.width,
  });
  if (!codec) throw new Error('This browser cannot encode an MP4 video. Try Safari or a Chromium browser with H.264 enabled.');

  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec,
    keyFrameInterval: 1,
    quality,
  });
  output.addVideoTrack(source);
  await output.start();

  for (const frame of frames) {
    await renderFrame(frame);
    await source.add(frame.timeMs / 1_000, frame.durationMs / 1_000, {
      keyFrame: frame.index % Math.max(1, Math.round(fps)) === 0,
    });
    onProgress?.((frame.index + 1) / frames.length);
  }

  await output.finalize();
  if (!target.buffer || target.buffer.byteLength === 0) throw new Error('MP4 encoding returned an empty file.');
  return new Blob([target.buffer], { type: format.mimeType });
}
