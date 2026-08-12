export type StillImageFormat = 'jpg' | 'png';

export type MotionExportQuality = 'balanced' | 'best' | 'fast';

export type ExportDimensions = {
  height: number;
  width: number;
};

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

type GifPaletteFormat = 'rgb444' | 'rgb565';

export type GifExportOptions = MotionExportOptions & {
  colors?: number;
  paletteFormat?: GifPaletteFormat;
  paletteStrategy?: 'global' | 'per-frame';
};

export type Mp4ExportOptions = MotionExportOptions & {
  quality?: MotionExportQuality;
};

export function resolveExportDimensions({
  aspectHeight,
  aspectWidth,
  maxWidth = 3_840,
  minWidth = 320,
  width,
}: {
  aspectHeight: number;
  aspectWidth: number;
  maxWidth?: number;
  minWidth?: number;
  width: number;
}): ExportDimensions {
  if (!Number.isFinite(aspectWidth) || aspectWidth <= 0 || !Number.isFinite(aspectHeight) || aspectHeight <= 0) {
    throw new RangeError('Export aspect ratio must be greater than zero.');
  }
  if (!Number.isFinite(width)) throw new RangeError('Export width must be a finite number.');
  if (!Number.isFinite(minWidth) || !Number.isFinite(maxWidth) || minWidth <= 0 || maxWidth < minWidth) {
    throw new RangeError('Export size limits are invalid.');
  }

  const clampedWidth = Math.min(maxWidth, Math.max(minWidth, width));
  const resolvedWidth = Math.max(2, Math.round(clampedWidth / 2) * 2);
  const resolvedHeight = Math.max(2, Math.round((resolvedWidth * aspectHeight / aspectWidth) / 2) * 2);
  return { height: resolvedHeight, width: resolvedWidth };
}

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
  colors = 128,
  durationMs,
  fps,
  onProgress,
  paletteFormat = 'rgb444',
  paletteStrategy = 'per-frame',
  renderFrame,
}: GifExportOptions): Promise<Blob> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  const frames = buildMotionFrames(durationMs, fps);
  const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
  const gif = GIFEncoder();
  const paletteSize = Math.min(256, Math.max(2, Math.round(colors)));
  let globalPalette: number[][] | null = null;

  for (const frame of frames) {
    await renderFrame(frame);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = paletteStrategy === 'global'
      ? (globalPalette ??= quantize(pixels, paletteSize, { format: paletteFormat }))
      : quantize(pixels, paletteSize, { format: paletteFormat });
    gif.writeFrame(applyPalette(pixels, palette, paletteFormat), canvas.width, canvas.height, {
      delay: frame.durationMs,
      ...(paletteStrategy === 'per-frame' || frame.index === 0 ? { palette } : {}),
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
  quality: qualityLevel = 'balanced',
  renderFrame,
}: Mp4ExportOptions): Promise<Blob> {
  const {
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    Quality,
    getFirstEncodableVideoCodec,
  } = await import('mediabunny');
  const frames = buildMotionFrames(durationMs, fps);
  const quality = new Quality(
    qualityLevel === 'fast' ? 'medium' : qualityLevel === 'best' ? 'very-high' : 'high'
  );
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
    keyFrameInterval: 2,
    quality,
  });
  output.addVideoTrack(source);
  await output.start();

  for (const frame of frames) {
    await renderFrame(frame);
    await source.add(frame.timeMs / 1_000, frame.durationMs / 1_000);
    onProgress?.((frame.index + 1) / frames.length);
  }

  await output.finalize();
  if (!target.buffer || target.buffer.byteLength === 0) throw new Error('MP4 encoding returned an empty file.');
  return new Blob([target.buffer], { type: format.mimeType });
}
