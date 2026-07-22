import { buildFrameSchedule } from './animation';
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
  config,
  onProgress,
  sources,
}: {
  config: GifExportConfig;
  onProgress?: (progress: number) => void;
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
    transitionMs: config.transitionMs,
  });
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');

  const gif = GIFEncoder();
  for (let index = 0; index < schedule.length; index += 1) {
    const frame = schedule[index];
    if (!frame) continue;
    renderFrame(context, sources, config, frame.position);
    const rgba = context.getImageData(0, 0, config.width, config.height).data;
    const palette = quantize(rgba, config.colors, { format: 'rgb444' });
    const indexed = applyPalette(rgba, palette, 'rgb444');
    gif.writeFrame(indexed, config.width, config.height, {
      delay: frame.delayMs,
      palette,
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
