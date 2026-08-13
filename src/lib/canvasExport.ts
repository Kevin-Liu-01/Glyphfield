import {
  collectGifPaletteSample,
  gifPaletteFramePixelBudget,
  gifProtectedColors,
  gifSampleFrameIndices,
  quantizeGifPalette,
  sampleGifPixels,
  type GifPaletteFormat,
} from './gifPalette';

export type StillImageFormat = 'jpg' | 'png';

export type MotionExportQuality = 'balanced' | 'best' | 'fast';

export type MotionLoopMode = 'raw' | 'seamless';

export type MotionLoopReport = {
  closureMismatchPixels: number;
  mode: 'seamless';
  outputFrames: number;
  overlapFrames: number;
  sourceFrames: number;
  verified: boolean;
};

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

export type GifExportOptions = MotionExportOptions & {
  colors?: number;
  loopMode?: MotionLoopMode;
  onLoopReport?: (report: MotionLoopReport) => void;
  paletteFormat?: GifPaletteFormat;
  paletteStrategy?: 'global' | 'per-frame';
  protectedColors?: readonly string[];
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

const MAX_LOOP_OVERLAP_BYTES = 96 * 1024 * 1024;
const MAX_LOOP_OVERLAP_FRAMES = 18;

export function resolveSeamlessLoopOverlapFrames({
  durationMs,
  fps,
  height,
  width,
}: {
  durationMs: number;
  fps: number;
  height: number;
  width: number;
}): number {
  const outputFrames = buildMotionFrames(durationMs, fps).length;
  const bytesPerFrame = Math.max(1, Math.round(width) * Math.round(height) * 4);
  const memoryBound = Math.max(2, Math.floor(MAX_LOOP_OVERLAP_BYTES / bytesPerFrame));
  const desiredDurationMs = Math.min(700, durationMs * 0.28);
  const desiredFrames = Math.max(2, Math.round(desiredDurationMs / (1_000 / fps)));
  return Math.max(1, Math.min(outputFrames - 1, desiredFrames, memoryBound, MAX_LOOP_OVERLAP_FRAMES));
}

function blendPixelFrames(
  tail: Uint8ClampedArray,
  head: Uint8ClampedArray,
  amount: number
): Uint8ClampedArray {
  const progress = Math.max(0, Math.min(1, amount));
  const blended = new Uint8ClampedArray(tail.length);
  for (let index = 0; index < tail.length; index += 1) {
    blended[index] = Math.round(tail[index]! + (head[index]! - tail[index]!) * progress);
  }
  return blended;
}

function countMismatchedPixels(left: Uint8ClampedArray, right: Uint8ClampedArray): number {
  if (left.length !== right.length) return Math.ceil(Math.max(left.length, right.length) / 4);
  let mismatches = 0;
  for (let index = 0; index < left.length; index += 4) {
    if (
      left[index] !== right[index]
      || left[index + 1] !== right[index + 1]
      || left[index + 2] !== right[index + 2]
      || left[index + 3] !== right[index + 3]
    ) mismatches += 1;
  }
  return mismatches;
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
  loopMode = 'raw',
  onLoopReport,
  onProgress,
  paletteFormat = 'rgb444',
  paletteStrategy = 'per-frame',
  protectedColors: protectedColorValues = [],
  renderFrame,
}: GifExportOptions): Promise<Blob> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  const outputFrames = buildMotionFrames(durationMs, fps);
  const frameDurationMs = outputFrames[0]!.durationMs;
  const overlapFrames = loopMode === 'seamless'
    ? resolveSeamlessLoopOverlapFrames({ durationMs, fps, height: canvas.height, width: canvas.width })
    : 0;
  const sourceFrameCount = outputFrames.length + overlapFrames;
  const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
  const gif = GIFEncoder();
  const paletteSize = Math.min(256, Math.max(2, Math.round(colors)));
  const protectedColors = gifProtectedColors(protectedColorValues);
  let globalPalette: number[][] | null = null;
  const headFrames: Uint8ClampedArray[] = [];
  let finalOutputPixels: Uint8ClampedArray | null = null;
  let writtenFrames = 0;

  if (paletteStrategy === 'global') {
    const samples: Uint8ClampedArray[] = [];
    const sampleIndices = gifSampleFrameIndices(sourceFrameCount);
    const samplePixelBudget = gifPaletteFramePixelBudget(sampleIndices.length);
    for (const index of sampleIndices) {
      const frame: MotionFrame = {
        durationMs: frameDurationMs,
        index,
        timeMs: index * frameDurationMs,
      };
      await renderFrame(frame);
      samples.push(sampleGifPixels(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        samplePixelBudget
      ));
    }
    const sample = collectGifPaletteSample(samples);
    globalPalette = quantizeGifPalette({
      format: paletteFormat,
      maxColors: paletteSize,
      pixels: sample,
      protectedColors,
      quantize,
    });
  }

  const writePixels = (pixels: Uint8ClampedArray) => {
    finalOutputPixels = pixels.slice();
    const palette = paletteStrategy === 'global'
      ? globalPalette!
      : quantizeGifPalette({
          format: paletteFormat,
          maxColors: paletteSize,
          pixels,
          protectedColors,
          quantize,
        });
    gif.writeFrame(applyPalette(pixels, palette, paletteFormat), canvas.width, canvas.height, {
      delay: frameDurationMs,
      ...(paletteStrategy === 'per-frame' || writtenFrames === 0 ? { palette } : {}),
      ...(writtenFrames === 0 ? { repeat: 0 } : {}),
    });
    writtenFrames += 1;
  };

  for (let index = 0; index < sourceFrameCount; index += 1) {
    const frame: MotionFrame = {
      durationMs: frameDurationMs,
      index,
      timeMs: index * frameDurationMs,
    };
    await renderFrame(frame);
    let pixels: Uint8ClampedArray = new Uint8ClampedArray(
      context.getImageData(0, 0, canvas.width, canvas.height).data
    );

    if (loopMode === 'seamless' && index < overlapFrames) {
      headFrames.push(pixels);
    } else {
      if (loopMode === 'seamless' && index >= outputFrames.length) {
        const overlapIndex = index - outputFrames.length;
        const blendAmount = seamlessLoopBlendAmount(
          (overlapIndex + 1) * frameDurationMs,
          overlapFrames * frameDurationMs
        );
        pixels = blendPixelFrames(pixels, headFrames[overlapIndex]!, blendAmount);
      }
      writePixels(pixels);
    }
    onProgress?.((index + 1) / sourceFrameCount);
  }

  if (loopMode === 'seamless') {
    // The final blended frame must land exactly on the captured frame immediately
    // before the first output frame. That makes the GIF wrap reproduce a real,
    // consecutive source transition instead of duplicating the first frame.
    const capturedSeamAnchor = headFrames.at(-1) ?? null;
    const closureMismatchPixels = finalOutputPixels && capturedSeamAnchor
      ? countMismatchedPixels(finalOutputPixels, capturedSeamAnchor)
      : canvas.width * canvas.height;
    onLoopReport?.({
      closureMismatchPixels,
      mode: 'seamless',
      outputFrames: writtenFrames,
      overlapFrames,
      sourceFrames: sourceFrameCount,
      verified: closureMismatchPixels === 0,
    });
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
