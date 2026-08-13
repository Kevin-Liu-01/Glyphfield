export type GifPaletteFormat = 'rgb444' | 'rgb565';

export type GifRgbColor = readonly [red: number, green: number, blue: number];

type GifQuantize = (
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors: number,
  options: { format: GifPaletteFormat }
) => number[][];

const DEFAULT_SAMPLE_PIXEL_BUDGET = 262_144;
const DEFAULT_SAMPLE_FRAME_LIMIT = 8;
const MAX_PROTECTED_COLORS = 16;

function colorKey(color: readonly number[]): string {
  return `${color[0] ?? 0}:${color[1] ?? 0}:${color[2] ?? 0}`;
}

export function gifRgbFromHex(value: string): GifRgbColor | null {
  const raw = value.trim().replace(/^#/, '');
  const expanded = raw.length === 3
    ? [...raw].map((character) => `${character}${character}`).join('')
    : raw;
  if (!/^[\da-f]{6}$/i.test(expanded)) return null;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

export function gifProtectedColors(values: readonly string[]): GifRgbColor[] {
  const seen = new Set<string>();
  const colors: GifRgbColor[] = [];
  for (const value of values) {
    const color = gifRgbFromHex(value);
    if (!color) continue;
    const key = colorKey(color);
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(color);
    if (colors.length >= MAX_PROTECTED_COLORS) break;
  }
  return colors;
}

export function gifSampleFrameIndices(
  frameCount: number,
  limit = DEFAULT_SAMPLE_FRAME_LIMIT
): number[] {
  const count = Math.max(0, Math.floor(frameCount));
  const sampleCount = Math.max(0, Math.min(count, Math.floor(limit)));
  if (sampleCount === 0) return [];
  if (sampleCount === 1) return [0];
  return Array.from({ length: sampleCount }, (_, index) => (
    Math.round(index * (count - 1) / (sampleCount - 1))
  ));
}

export function sampleGifPixels(
  pixels: Uint8ClampedArray,
  maxPixels: number
): Uint8ClampedArray {
  const pixelCount = Math.floor(pixels.length / 4);
  const budget = Math.max(1, Math.floor(maxPixels));
  if (pixelCount <= budget) return pixels.slice();
  const sampled = new Uint8ClampedArray(budget * 4);
  const stride = pixelCount / budget;
  for (let index = 0; index < budget; index += 1) {
    const sourceOffset = Math.min(pixelCount - 1, Math.floor(index * stride)) * 4;
    sampled.set(pixels.subarray(sourceOffset, sourceOffset + 4), index * 4);
  }
  return sampled;
}

export function gifPaletteFramePixelBudget(
  frameCount: number,
  pixelBudget = DEFAULT_SAMPLE_PIXEL_BUDGET
): number {
  return Math.max(1, Math.floor(pixelBudget / Math.max(1, Math.floor(frameCount))));
}

export function collectGifPaletteSample(
  frames: readonly Uint8ClampedArray[],
  pixelBudget = DEFAULT_SAMPLE_PIXEL_BUDGET
): Uint8ClampedArray {
  if (frames.length === 0) return new Uint8ClampedArray();
  const perFrameBudget = gifPaletteFramePixelBudget(frames.length, pixelBudget);
  const samples = frames.map((frame) => sampleGifPixels(frame, perFrameBudget));
  const length = samples.reduce((total, sample) => total + sample.length, 0);
  const combined = new Uint8ClampedArray(length);
  let offset = 0;
  samples.forEach((sample) => {
    combined.set(sample, offset);
    offset += sample.length;
  });
  return combined;
}

export function quantizeGifPalette({
  format,
  maxColors,
  pixels,
  protectedColors = [],
  quantize,
}: {
  format: GifPaletteFormat;
  maxColors: number;
  pixels: Uint8Array | Uint8ClampedArray;
  protectedColors?: readonly GifRgbColor[];
  quantize: GifQuantize;
}): number[][] {
  const paletteSize = Math.min(256, Math.max(2, Math.floor(maxColors)));
  const seen = new Set<string>();
  const reserved = protectedColors
    .filter((color) => {
      const key = colorKey(color);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.min(MAX_PROTECTED_COLORS, paletteSize - 2))
    .map((color) => [...color]);
  const generated = quantize(pixels, Math.max(2, paletteSize - reserved.length), { format });
  const palette = [...reserved];
  generated.forEach((color) => {
    const key = colorKey(color);
    if (seen.has(key) || palette.length >= paletteSize) return;
    seen.add(key);
    palette.push(color.slice(0, 3));
  });
  return palette;
}
