import { buildFrameSchedule, type FrameSchedule } from './animation';
import {
  collectGifPaletteSample,
  gifPaletteFramePixelBudget,
  gifProtectedColors,
  gifSampleFrameIndices,
  quantizeGifPalette,
  sampleGifPixels,
} from './gifPalette';
import {
  renderFrame,
  type RenderConfig,
  type StudioSource,
} from './renderFrame';

export type GifExportConfig = RenderConfig & {
  colors: 32 | 64 | 128 | 256;
  fps: number;
  holdMs: number;
  loop: boolean;
  transitionMs: number;
};

export async function exportGif({
  beforeFrame,
  config,
  onProgress,
  sampleHoldFrames = false,
  sources,
}: {
  beforeFrame?: (frame: FrameSchedule) => Promise<void> | void;
  config: GifExportConfig;
  onProgress?: (progress: number) => void;
  sampleHoldFrames?: boolean;
  sources: readonly StudioSource[];
}): Promise<Blob> {
  if (sources.length === 0) {
    throw new RangeError('At least one source is required to export a GIF.');
  }

  const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
  const schedule = buildFrameSchedule({
    fps: config.fps,
    holdMs: config.holdMs,
    itemCount: sources.length,
    sampleHoldFrames,
    transitionMs: config.transitionMs,
  });
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');

  const protectedColors = gifProtectedColors([
    config.foreground,
    ...sources.flatMap((source) => source.foreground ? [source.foreground] : []),
  ]);
  const gif = GIFEncoder();
  const sampleIndices = gifSampleFrameIndices(schedule.length);
  const samplePixelBudget = gifPaletteFramePixelBudget(sampleIndices.length);
  const samples: Uint8ClampedArray[] = [];
  for (const index of sampleIndices) {
    const frame = schedule[index];
    if (!frame) continue;
    await beforeFrame?.(frame);
    renderFrame(context, sources, config, frame.position);
    samples.push(sampleGifPixels(
      context.getImageData(0, 0, config.width, config.height).data,
      samplePixelBudget
    ));
  }
  const palette = quantizeGifPalette({
    format: 'rgb565',
    maxColors: config.colors,
    pixels: collectGifPaletteSample(samples),
    protectedColors,
    quantize,
  });
  for (let index = 0; index < schedule.length; index += 1) {
    const frame = schedule[index];
    if (!frame) continue;
    await beforeFrame?.(frame);
    renderFrame(context, sources, config, frame.position);
    const rgba = context.getImageData(0, 0, config.width, config.height).data;
    const indexed = applyPalette(rgba, palette, 'rgb565');
    gif.writeFrame(indexed, config.width, config.height, {
      delay: frame.delayMs,
      ...(index === 0 ? { palette } : {}),
      ...(index === 0 ? { repeat: config.loop ? 0 : -1 } : {}),
    });

    onProgress?.((index + 1) / schedule.length);
    if (index % 4 === 0) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  gif.finish();
  const bytes = Uint8Array.from(gif.bytes());
  return new Blob([bytes], { type: 'image/gif' });
}
