export type CompositionEffectKind = 'ascii' | 'bayer' | 'halftone' | 'posterize';

export type CompositionEffectSettings = {
  background: string;
  cellSize: number;
  contrast: number;
  foreground: string;
  invert: boolean;
  kind: CompositionEffectKind;
  levels: number;
  threshold: number;
};

export type CompositionEffectPreset = {
  description: string;
  kind: CompositionEffectKind;
  label: string;
};

type PixelBuffer = {
  data: Uint8ClampedArray;
  height: number;
  width: number;
};

export type CompositionEffectScratch = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData | null;
  output: Uint8ClampedArray | null;
};

export const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
] as const;

export const COMPOSITION_EFFECT_PRESETS: readonly CompositionEffectPreset[] = [
  { description: 'Stable 8×8 ordered print texture', kind: 'bayer', label: 'Bayer' },
  { description: 'Luminance rebuilt from glyph density', kind: 'ascii', label: 'ASCII' },
  { description: 'Editorial dot-screen conversion', kind: 'halftone', label: 'Halftone' },
  { description: 'Pixelated limited-tone color field', kind: 'posterize', label: 'Posterize' },
];

const ASCII_RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'] as const;
const ASCII_GLYPHS: Record<(typeof ASCII_RAMP)[number], readonly string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
};

const DEFAULTS: Record<CompositionEffectKind, CompositionEffectSettings> = {
  ascii: {
    background: '#111216',
    cellSize: 14,
    contrast: 1.15,
    foreground: '#F5F5F2',
    invert: false,
    kind: 'ascii',
    levels: 6,
    threshold: 0.5,
  },
  bayer: {
    background: '#111216',
    cellSize: 4,
    contrast: 1.12,
    foreground: '#F5F5F2',
    invert: false,
    kind: 'bayer',
    levels: 4,
    threshold: 0.5,
  },
  halftone: {
    background: '#111216',
    cellSize: 12,
    contrast: 1.2,
    foreground: '#F5F5F2',
    invert: false,
    kind: 'halftone',
    levels: 5,
    threshold: 0.5,
  },
  posterize: {
    background: '#16171B',
    cellSize: 3,
    contrast: 1.08,
    foreground: '#F5F5F2',
    invert: false,
    kind: 'posterize',
    levels: 4,
    threshold: 0.5,
  },
};

export function defaultCompositionEffectSettings(kind: CompositionEffectKind): CompositionEffectSettings {
  return { ...DEFAULTS[kind] };
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseHexColor(value: string): readonly [number, number, number] {
  const normalized = value.replace('#', '');
  if (!/^[\dA-F]{6}$/i.test(normalized)) return [255, 255, 255];
  const packed = Number.parseInt(normalized, 16);
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

function luminance(data: Uint8ClampedArray, offset: number, settings: CompositionEffectSettings): number {
  const value = (data[offset]! * 0.2126 + data[offset + 1]! * 0.7152 + data[offset + 2]! * 0.0722) / 255;
  const adjusted = clamp((value - 0.5) * settings.contrast + settings.threshold);
  return settings.invert ? 1 - adjusted : adjusted;
}

function paintPixel(
  output: Uint8ClampedArray,
  offset: number,
  color: readonly [number, number, number],
  alpha = 255
) {
  output[offset] = color[0];
  output[offset + 1] = color[1];
  output[offset + 2] = color[2];
  output[offset + 3] = alpha;
}

function fill(output: Uint8ClampedArray, color: readonly [number, number, number]) {
  for (let offset = 0; offset < output.length; offset += 4) paintPixel(output, offset, color);
}

function sampleCellLuminance(
  source: PixelBuffer,
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number,
  settings: CompositionEffectSettings
): number {
  let sum = 0;
  let count = 0;
  const strideX = Math.max(1, Math.floor(cellWidth / 3));
  const strideY = Math.max(1, Math.floor(cellHeight / 3));
  const firstX = Math.max(0, startX);
  const firstY = Math.max(0, startY);
  for (let y = firstY; y < Math.min(source.height, startY + cellHeight); y += strideY) {
    for (let x = firstX; x < Math.min(source.width, startX + cellWidth); x += strideX) {
      sum += luminance(source.data, (y * source.width + x) * 4, settings);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function renderBayer(source: PixelBuffer, output: Uint8ClampedArray, settings: CompositionEffectSettings) {
  const foreground = parseHexColor(settings.foreground);
  const background = parseHexColor(settings.background);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      const threshold = (BAYER_8X8[y % 8]![x % 8]! + 0.5) / 64;
      paintPixel(output, offset, luminance(source.data, offset, settings) >= threshold ? foreground : background);
    }
  }
}

function renderPosterize(source: PixelBuffer, output: Uint8ClampedArray, settings: CompositionEffectSettings) {
  const foreground = parseHexColor(settings.foreground);
  const background = parseHexColor(settings.background);
  const levels = Math.max(2, Math.min(8, Math.round(settings.levels)));
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const tone = Math.round(luminance(source.data, offset, settings) * (levels - 1)) / (levels - 1);
    paintPixel(output, offset, [
      Math.round(background[0] + (foreground[0] - background[0]) * tone),
      Math.round(background[1] + (foreground[1] - background[1]) * tone),
      Math.round(background[2] + (foreground[2] - background[2]) * tone),
    ]);
  }
}

function paintAsciiGlyphBlock(
  source: PixelBuffer,
  output: Uint8ClampedArray,
  foreground: readonly [number, number, number],
  startX: number,
  endX: number,
  startY: number,
  endY: number
) {
  for (let y = startY; y < Math.min(source.height, endY); y += 1) {
    for (let x = startX; x < Math.min(source.width, endX); x += 1) {
      paintPixel(output, (y * source.width + x) * 4, foreground);
    }
  }
}

function paintAsciiGlyph({
  cellX,
  cellY,
  foreground,
  glyph,
  glyphHeight,
  glyphWidth,
  insetX,
  insetY,
  output,
  source,
}: {
  cellX: number;
  cellY: number;
  foreground: readonly [number, number, number];
  glyph: readonly string[];
  glyphHeight: number;
  glyphWidth: number;
  insetX: number;
  insetY: number;
  output: Uint8ClampedArray;
  source: PixelBuffer;
}) {
  for (let glyphY = 0; glyphY < 7; glyphY += 1) {
    for (let glyphX = 0; glyphX < 5; glyphX += 1) {
      if (glyph[glyphY]![glyphX] !== '1') continue;
      const startX = cellX + insetX + Math.floor(glyphX * glyphWidth / 5);
      const endX = cellX + insetX + Math.max(1, Math.floor((glyphX + 1) * glyphWidth / 5));
      const startY = cellY + insetY + Math.floor(glyphY * glyphHeight / 7);
      const endY = cellY + insetY + Math.max(1, Math.floor((glyphY + 1) * glyphHeight / 7));
      paintAsciiGlyphBlock(source, output, foreground, startX, endX, startY, endY);
    }
  }
}

function renderAscii(source: PixelBuffer, output: Uint8ClampedArray, settings: CompositionEffectSettings) {
  const foreground = parseHexColor(settings.foreground);
  const background = parseHexColor(settings.background);
  const cellWidth = Math.max(5, Math.round(settings.cellSize));
  const cellHeight = Math.max(7, Math.round(cellWidth * 1.25));
  const glyphWidth = Math.max(5, Math.round(cellWidth * 0.76));
  const glyphHeight = Math.max(7, Math.round(cellHeight * 0.82));
  const insetX = Math.floor((cellWidth - glyphWidth) / 2);
  const insetY = Math.floor((cellHeight - glyphHeight) / 2);
  fill(output, background);
  for (let cellY = 0; cellY < source.height; cellY += cellHeight) {
    for (let cellX = 0; cellX < source.width; cellX += cellWidth) {
      const tone = sampleCellLuminance(source, cellX, cellY, cellWidth, cellHeight, settings);
      const glyph = ASCII_GLYPHS[ASCII_RAMP[Math.round(tone * (ASCII_RAMP.length - 1))]!]!;
      paintAsciiGlyph({
        cellX,
        cellY,
        foreground,
        glyph,
        glyphHeight,
        glyphWidth,
        insetX,
        insetY,
        output,
        source,
      });
    }
  }
}

function renderHalftone(source: PixelBuffer, output: Uint8ClampedArray, settings: CompositionEffectSettings) {
  const foreground = parseHexColor(settings.foreground);
  const background = parseHexColor(settings.background);
  const cellSize = Math.max(3, Math.round(settings.cellSize));
  fill(output, background);
  for (let cellY = 0, row = 0; cellY < source.height; cellY += cellSize, row += 1) {
    const rowOffset = row % 2 === 0 ? 0 : Math.floor(cellSize / 2);
    for (let cellX = -rowOffset; cellX < source.width; cellX += cellSize) {
      const tone = sampleCellLuminance(source, cellX, cellY, cellSize, cellSize, settings);
      const radius = Math.sqrt(tone) * cellSize * 0.5;
      const centerX = cellX + cellSize / 2;
      const centerY = cellY + cellSize / 2;
      for (let y = cellY; y < Math.min(source.height, cellY + cellSize); y += 1) {
        for (let x = Math.max(0, cellX); x < Math.min(source.width, cellX + cellSize); x += 1) {
          const deltaX = x + 0.5 - centerX;
          const deltaY = y + 0.5 - centerY;
          const coverage = clamp(radius + 0.6 - Math.hypot(deltaX, deltaY));
          if (coverage <= 0) continue;
          paintPixel(output, (y * source.width + x) * 4, [
            Math.round(background[0] + (foreground[0] - background[0]) * coverage),
            Math.round(background[1] + (foreground[1] - background[1]) * coverage),
            Math.round(background[2] + (foreground[2] - background[2]) * coverage),
          ]);
        }
      }
    }
  }
}

export function renderCompositionEffect(
  source: PixelBuffer,
  settings: CompositionEffectSettings,
  reusableOutput?: Uint8ClampedArray
): PixelBuffer {
  const output = reusableOutput?.length === source.data.length
    ? reusableOutput
    : new Uint8ClampedArray(source.data.length);
  if (settings.kind === 'bayer') renderBayer(source, output, settings);
  else if (settings.kind === 'ascii') renderAscii(source, output, settings);
  else if (settings.kind === 'halftone') renderHalftone(source, output, settings);
  else renderPosterize(source, output, settings);
  return { data: output, height: source.height, width: source.width };
}

export function createCompositionEffectScratch(): CompositionEffectScratch | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return context ? { canvas, context, imageData: null, output: null } : null;
}

export function applyCompositionEffect(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: CompositionEffectSettings,
  opacity: number,
  scratch?: CompositionEffectScratch | null
) {
  const requestedCellSize = Math.max(1, Math.round(settings.cellSize));
  const resolutionScale = settings.kind === 'bayer' || settings.kind === 'posterize'
    ? 1 / requestedCellSize
    : Math.min(1, 10 / requestedCellSize);
  const effectWidth = Math.max(1, Math.ceil(width * resolutionScale));
  const effectHeight = Math.max(1, Math.ceil(height * resolutionScale));
  const workspace = scratch ?? createCompositionEffectScratch();
  if (!workspace) return;
  const sourceCanvas = workspace.canvas;
  const sourceContext = workspace.context;
  if (sourceCanvas.width !== effectWidth) sourceCanvas.width = effectWidth;
  if (sourceCanvas.height !== effectHeight) sourceCanvas.height = effectHeight;
  sourceContext.clearRect(0, 0, effectWidth, effectHeight);
  sourceContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, effectWidth, effectHeight);
  const sourceImage = sourceContext.getImageData(0, 0, effectWidth, effectHeight);
  const scaledSettings = {
    ...settings,
    cellSize: settings.kind === 'bayer' || settings.kind === 'posterize'
      ? 1
      : Math.max(5, Math.round(requestedCellSize * resolutionScale)),
  };
  const effect = renderCompositionEffect(sourceImage, scaledSettings, workspace.output ?? undefined);
  workspace.output = effect.data;
  const effectImage = workspace.imageData?.width === effect.width && workspace.imageData.height === effect.height
    ? workspace.imageData
    : sourceContext.createImageData(effect.width, effect.height);
  workspace.imageData = effectImage;
  effectImage.data.set(effect.data);
  sourceContext.putImageData(effectImage, 0, 0);

  context.save();
  context.globalAlpha = clamp(opacity);
  context.globalCompositeOperation = 'source-over';
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceCanvas, 0, 0, effectWidth, effectHeight, 0, 0, width, height);
  context.restore();
}
