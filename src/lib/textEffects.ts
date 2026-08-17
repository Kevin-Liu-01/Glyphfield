import type { CSSProperties } from 'react';

export type TextEffectKind = 'solid' | 'dither' | 'halftone' | 'scanline' | 'gradient';

export type TextEffectSettings = {
  amount: number;
  angle: number;
  backgroundColor: string;
  kind: TextEffectKind;
  scale: number;
};

type PersistedTextEffectSettings = Partial<TextEffectSettings> & {
  /** Migrates text effects saved before foreground/background colors were explicit. */
  color?: string;
};

export type TextEffectPreset = {
  description: string;
  label: string;
  settings: TextEffectSettings;
};

export type TextEffectBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const DEFAULT_TEXT_EFFECT: TextEffectSettings = {
  amount: 100,
  angle: 11,
  backgroundColor: '#111216',
  kind: 'solid',
  scale: 12,
};

export const TEXT_EFFECT_PRESETS: readonly TextEffectPreset[] = [
  {
    description: 'Uninterrupted glyph fill.',
    label: 'Solid',
    settings: { ...DEFAULT_TEXT_EFFECT },
  },
  {
    description: 'Six ordered density bands inspired by ProtoTemplate.',
    label: 'Bayer sweep',
    settings: { ...DEFAULT_TEXT_EFFECT, kind: 'dither' },
  },
  {
    description: 'Printed dot screen with a second ink beneath it.',
    label: 'Halftone',
    settings: { ...DEFAULT_TEXT_EFFECT, amount: 86, angle: 0, kind: 'halftone', scale: 15 },
  },
  {
    description: 'Directional signal lines clipped inside the type.',
    label: 'Scan lines',
    settings: { ...DEFAULT_TEXT_EFFECT, amount: 82, angle: -12, kind: 'scanline', scale: 10 },
  },
  {
    description: 'A two-color directional ink fill.',
    label: 'Gradient ink',
    settings: { ...DEFAULT_TEXT_EFFECT, angle: 24, backgroundColor: '#7BFFD9', kind: 'gradient' },
  },
] as const;

const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

const DITHER_DENSITIES = [1, 0.75, 0.5, 0.3125, 0.1875, 0.0625] as const;
const DITHER_FIELD_CACHE = new Map<string, string>();

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function resolveTextEffectSettings(settings?: PersistedTextEffectSettings): TextEffectSettings {
  return {
    amount: clamp(settings?.amount ?? DEFAULT_TEXT_EFFECT.amount, 0, 100),
    angle: clamp(settings?.angle ?? DEFAULT_TEXT_EFFECT.angle, -180, 180),
    backgroundColor: settings?.backgroundColor ?? settings?.color ?? DEFAULT_TEXT_EFFECT.backgroundColor,
    kind: settings?.kind ?? DEFAULT_TEXT_EFFECT.kind,
    scale: clamp(settings?.scale ?? DEFAULT_TEXT_EFFECT.scale, 4, 36),
  };
}

function mixHexColors(foreground: string, background: string, amount: number) {
  const foregroundHex = foreground.replace('#', '');
  const backgroundHex = background.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(foregroundHex) || !/^[0-9a-f]{6}$/i.test(backgroundHex)) {
    return background;
  }
  const mix = clamp(amount, 0, 1);
  const channel = (offset: number) => Math.round(
    Number.parseInt(foregroundHex.slice(offset, offset + 2), 16) * (1 - mix)
    + Number.parseInt(backgroundHex.slice(offset, offset + 2), 16) * mix
  ).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function ditherPatternPath(density: number, tileSize: number) {
  const cellSize = tileSize / 4;
  const squareSize = cellSize * 0.88;
  return BAYER_4.flatMap((threshold, index) => {
    if ((threshold + 0.5) / 16 > density) return [];
    const column = index % 4;
    const row = Math.floor(index / 4);
    return `<rect x="${(column * cellSize).toFixed(3)}" y="${(row * cellSize).toFixed(3)}" width="${squareSize.toFixed(3)}" height="${squareSize.toFixed(3)}"/>`;
  }).join('');
}

function ditherFieldDataUrl(settings: TextEffectSettings, foregroundColor: string) {
  const cacheKey = `${settings.amount}:${settings.angle}:${settings.scale}:${foregroundColor}:${settings.backgroundColor}`;
  const cached = DITHER_FIELD_CACHE.get(cacheKey);
  if (cached) return cached;
  const tileSize = settings.scale;
  const backgroundColor = mixHexColors(foregroundColor, settings.backgroundColor, settings.amount / 100);
  const patterns = DITHER_DENSITIES.map((density, index) => (
    `<pattern id="p${index}" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse"><g fill="${foregroundColor}">${ditherPatternPath(density, tileSize)}</g></pattern>`
  )).join('');
  const bands = [
    { width: 320, x: -200 },
    { width: 64, x: 120 },
    { width: 58, x: 184 },
    { width: 54, x: 242 },
    { width: 50, x: 296 },
    { width: 88, x: 346 },
  ].map(({ width, x }, index) => (
    `<rect fill="url(#p${index})" height="700" width="${width}" x="${x}" y="-240"/>`
  )).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><defs>${patterns}</defs><rect width="400" height="225" fill="${backgroundColor}"/><g transform="rotate(${settings.angle} 200 112.5)">${bands}</g></svg>`;
  const dataUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (DITHER_FIELD_CACHE.size >= 96) {
    const oldest = DITHER_FIELD_CACHE.keys().next().value;
    if (oldest) DITHER_FIELD_CACHE.delete(oldest);
  }
  DITHER_FIELD_CACHE.set(cacheKey, dataUrl);
  return dataUrl;
}

function clippedFillStyle(backgroundImage: string, material: boolean): CSSProperties {
  return {
    backgroundClip: 'text',
    backgroundImage,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    color: 'transparent',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    ...(material ? { backgroundBlendMode: 'color, normal' } : {}),
  };
}

export function textEffectCssStyle(
  input: PersistedTextEffectSettings | undefined,
  primaryColor: string,
  materialBackgroundImage?: string
): CSSProperties {
  const settings = resolveTextEffectSettings(input);
  const materialStyle = materialBackgroundImage
    ? clippedFillStyle(materialBackgroundImage, false)
    : {};
  if (settings.kind === 'solid') return materialStyle;

  if (settings.kind === 'gradient') {
    const gradient = `linear-gradient(${settings.angle}deg, ${primaryColor}, ${settings.backgroundColor})`;
    return clippedFillStyle(
      materialBackgroundImage ? `${gradient}, ${materialBackgroundImage}` : gradient,
      Boolean(materialBackgroundImage)
    );
  }

  const backgroundColor = mixHexColors(primaryColor, settings.backgroundColor, settings.amount / 100);
  let effectField: string;
  let backgroundSize: string;
  if (settings.kind === 'dither') {
    effectField = ditherFieldDataUrl(settings, primaryColor);
    backgroundSize = 'cover';
  } else if (settings.kind === 'halftone') {
    effectField = `radial-gradient(circle, ${primaryColor} 0 34%, ${backgroundColor} 38% 100%)`;
    backgroundSize = `${settings.scale}px ${settings.scale}px`;
  } else {
    const stripeWidth = settings.scale * 0.42;
    effectField = `repeating-linear-gradient(${settings.angle}deg, ${primaryColor} 0 ${stripeWidth.toFixed(2)}px, ${backgroundColor} ${stripeWidth.toFixed(2)}px ${settings.scale}px)`;
    backgroundSize = 'auto';
  }

  const fieldStyle = clippedFillStyle(
    materialBackgroundImage ? `${effectField}, ${materialBackgroundImage}` : effectField,
    Boolean(materialBackgroundImage)
  );
  const repeats = settings.kind === 'dither' ? 'no-repeat' : 'repeat';
  return {
    ...materialStyle,
    ...fieldStyle,
    backgroundRepeat: materialBackgroundImage ? `${repeats}, no-repeat` : repeats,
    backgroundSize: materialBackgroundImage ? `${backgroundSize}, cover` : backgroundSize,
  };
}

function ditherDensity(progress: number) {
  if (progress < 0.36) return DITHER_DENSITIES[0];
  if (progress < 0.52) return DITHER_DENSITIES[1];
  if (progress < 0.665) return DITHER_DENSITIES[2];
  if (progress < 0.8) return DITHER_DENSITIES[3];
  if (progress < 0.925) return DITHER_DENSITIES[4];
  return DITHER_DENSITIES[5];
}

export function textEffectOpacityAt(
  input: PersistedTextEffectSettings | undefined,
  x: number,
  y: number,
  bounds: TextEffectBounds,
  renderScale = 1
) {
  const settings = resolveTextEffectSettings(input);
  if (settings.kind === 'solid' || settings.kind === 'gradient' || settings.amount <= 0) return 1;
  const radians = settings.angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const offsetX = x - (bounds.x + bounds.width / 2);
  const offsetY = y - (bounds.y + bounds.height / 2);
  const rotatedX = offsetX * cosine + offsetY * sine;
  const rotatedY = -offsetX * sine + offsetY * cosine;
  const strength = settings.amount / 100;
  const scale = Math.max(1, settings.scale * renderScale);
  let patternedAlpha = 1;

  if (settings.kind === 'dither') {
    const projectionWidth = Math.max(1, Math.abs(bounds.width * cosine) + Math.abs(bounds.height * sine));
    const progress = clamp(rotatedX / projectionWidth + 0.5, 0, 1);
    const density = ditherDensity(progress);
    const cellSize = scale / 4;
    const column = Math.floor(positiveModulo(rotatedX, scale) / cellSize);
    const row = Math.floor(positiveModulo(rotatedY, scale) / cellSize);
    const threshold = (BAYER_4[row * 4 + column]! + 0.5) / 16;
    patternedAlpha = threshold <= density ? 1 : 0;
  } else if (settings.kind === 'halftone') {
    const localX = positiveModulo(rotatedX, scale) - scale / 2;
    const localY = positiveModulo(rotatedY, scale) - scale / 2;
    const radius = scale * 0.36;
    const distance = Math.hypot(localX, localY);
    patternedAlpha = clamp(radius + 1 - distance, 0, 1);
  } else {
    const linePosition = positiveModulo(rotatedY, scale);
    const edge = scale * 0.42;
    patternedAlpha = clamp(edge + 1 - linePosition, 0, 1);
  }

  return 1 - strength + strength * patternedAlpha;
}

export function applyTextEffectMask(
  context: CanvasRenderingContext2D,
  bounds: TextEffectBounds,
  input: PersistedTextEffectSettings | undefined,
  renderScale = 1
) {
  const settings = resolveTextEffectSettings(input);
  if (settings.kind === 'solid' || settings.kind === 'gradient' || settings.amount <= 0) return;
  const left = clamp(Math.floor(bounds.x), 0, context.canvas.width);
  const top = clamp(Math.floor(bounds.y), 0, context.canvas.height);
  const right = clamp(Math.ceil(bounds.x + bounds.width), left, context.canvas.width);
  const bottom = clamp(Math.ceil(bounds.y + bounds.height), top, context.canvas.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return;
  const image = context.getImageData(left, top, width, height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const alphaIndex = (row * width + column) * 4 + 3;
      if (image.data[alphaIndex] === 0) continue;
      image.data[alphaIndex] = Math.round(
        image.data[alphaIndex]! * textEffectOpacityAt(settings, left + column, top + row, bounds, renderScale)
      );
    }
  }
  context.putImageData(image, left, top);
}

export function createTextEffectGradient(
  context: CanvasRenderingContext2D,
  bounds: TextEffectBounds,
  input: PersistedTextEffectSettings | undefined,
  primaryColor: string
) {
  const settings = resolveTextEffectSettings(input);
  const radians = settings.angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const extent = Math.abs(bounds.width * cosine) + Math.abs(bounds.height * sine);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const gradient = context.createLinearGradient(
    centerX - cosine * extent / 2,
    centerY - sine * extent / 2,
    centerX + cosine * extent / 2,
    centerY + sine * extent / 2
  );
  gradient.addColorStop(0, primaryColor);
  gradient.addColorStop(1, settings.backgroundColor);
  return gradient;
}
