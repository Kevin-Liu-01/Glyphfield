/**
 * Shared, framework-free building blocks for the Brand output tools (moodboard,
 * brand book, brand elements): a defensive palette, contrast helpers, text
 * fitting for SVG layout, and the generative graphic device for each identity.
 */
import type { BrandAsset, BrandIdentity } from './brandIdentity';
import { mixHexColors, normalizeHexOrFallback } from './color';
import { signalWindowDevice } from './brandDevices/signalWindow';
import { interruptionDevice } from './brandDevices/interruption';
import { ledgerDevice } from './brandDevices/ledger';
import { beamDevice } from './brandDevices/beam';
import { utilityWaveDevice } from './brandDevices/utilityWave';
import { convergenceDevice } from './brandDevices/convergence';
import { horizonDevice } from './brandDevices/horizon';
import { programmableFieldDevice } from './brandDevices/programmableField';
import { gridDevice } from './brandDevices/grid';
import { orbitDevice } from './brandDevices/orbit';
import { contrastRatio, readableOn, round, type DeviceContext } from './brandDeviceContext';

export { contrastRatio, readableOn };

export type BrandPalette = {
  accent: string;
  deep: string;
  highlight: string;
  ink: string;
  muted: string;
  paper: string;
  progress: string;
  secondary: string;
};

export const BRAND_SURFACE_TONES = ['paper', 'muted', 'ink', 'deep', 'accent'] as const;
export type BrandSurfaceTone = (typeof BRAND_SURFACE_TONES)[number];

export const BRAND_SURFACE_TONE_LABELS: Record<BrandSurfaceTone, string> = {
  accent: 'Accent',
  deep: 'Deep',
  ink: 'Ink',
  muted: 'Muted',
  paper: 'Paper',
};

export type BrandSurface = {
  background: string;
  foreground: string;
  /** Quiet secondary text that still clears 4.5:1 on the background where possible. */
  secondary: string;
  /** Hairline rule colour. */
  rule: string;
};

function paletteColor(identity: BrandIdentity, id: string, fallback: string): string {
  const colors = Array.isArray(identity.colors) ? identity.colors : [];
  return normalizeHexOrFallback(colors.find((color) => color?.id === id)?.hex, fallback);
}

export function brandPalette(identity: BrandIdentity): BrandPalette {
  const ink = paletteColor(identity, 'ink', '#181818');
  const paper = paletteColor(identity, 'paper', '#FFFFFF');
  const accent = paletteColor(identity, 'emphasis', ink);
  return {
    accent,
    deep: paletteColor(identity, 'error', ink),
    highlight: paletteColor(identity, 'warning', accent),
    ink,
    muted: paletteColor(identity, 'muted', mixHexColors(paper, ink, 0.05)),
    paper,
    progress: paletteColor(identity, 'progress', mixHexColors(ink, paper, 0.45)),
    secondary: paletteColor(identity, 'success', accent),
  };
}


export function wcagRating(ratio: number): 'AAA' | 'AA' | 'AA large' | 'Fail' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'Fail';
}

/** The palette colour (ink or paper first) that reads best on a background. */

export function isDarkColor(color: string): boolean {
  return contrastRatio(color, '#FFFFFF') > contrastRatio(color, '#000000');
}

export function brandSurface(palette: BrandPalette, tone: BrandSurfaceTone): BrandSurface {
  const background = palette[tone === 'deep' ? 'deep' : tone];
  const foreground = readableOn(background, palette);
  let secondary = mixHexColors(foreground, background, 0.32);
  if (contrastRatio(secondary, background) < 4.5) secondary = mixHexColors(foreground, background, 0.18);
  return {
    background,
    foreground,
    rule: mixHexColors(foreground, background, 0.8),
    secondary,
  };
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Text inside a block comment: comment terminators are defused and control characters are removed. */
export function commentText(value: string): string {
  let safe = '';
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code >= 0x20 && code !== 0x7f) safe += character;
  }
  return safe.replace(/\*\//g, '* /');
}

/** Text inside a single-quoted CSS string; wrap it in `'` at the sink. */
export function cssSingleQuoted(value: string): string {
  let safe = '';
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (character === '\\') safe += '\\\\';
    else if (character === "'") safe += "\\'";
    else if (character === '\n') safe += '\\a ';
    else if (code < 0x20 || code === 0x7f) safe += `\\${code.toString(16)} `;
    else safe += character;
  }
  return safe;
}

const CUBIC_BEZIER_TIMING = /^\s*cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i;
const TIMING_KEYWORD = /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i;
const STEPS_TIMING = /^\s*steps\(\s*\d+\s*(?:,\s*(?:jump-start|jump-end|jump-none|jump-both|start|end)\s*)?\)\s*$/i;

/**
 * A safe CSS timing function: a leading cubic-bezier is reserialized from its
 * numbers, whole-value keyword and steps() easings pass through, anything else
 * is `ease`.
 */
export function cssTimingFunction(value: string): string {
  const trimmed = value.trim();
  const bezier = CUBIC_BEZIER_TIMING.exec(trimmed);
  if (bezier) {
    const values = bezier.slice(1, 5).map(Number);
    if (values.every(Number.isFinite)) return `cubic-bezier(${values.join(', ')})`;
  }
  if (TIMING_KEYWORD.test(trimmed) || STEPS_TIMING.test(trimmed)) return trimmed;
  return 'ease';
}

/** Text inside a single-quoted JavaScript string; wrap it in `'` at the sink. */
export function jsSingleQuoted(value: string): string {
  let safe = '';
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (character === '\\') safe += '\\\\';
    else if (character === "'") safe += "\\'";
    else if (character === '\n') safe += '\\n';
    else if (code === 0x2028 || code === 0x2029) safe += `\\u${code.toString(16)}`;
    else if (code < 0x20 || code === 0x7f) continue;
    else safe += character;
  }
  return safe;
}

/** A stable 32-bit hash used to seed generative artwork. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDE_CHARACTER = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;

export type FontMetrics = { charWidth: number; monospace: boolean };

/**
 * Average lowercase advance (em) measured in Chromium for the bundled brand
 * faces, padded ~4% so estimates err toward wrapping early. Unknown families
 * fall back to a generous grotesque width.
 */
const FONT_METRICS: Readonly<Record<string, FontMetrics>> = {
  'apercu mono pro': { charWidth: 0.62, monospace: true },
  'apk protocol': { charWidth: 0.54, monospace: false },
  'arizona flare': { charWidth: 0.51, monospace: false },
  'basement grotesque': { charWidth: 0.69, monospace: false },
  flauta: { charWidth: 0.79, monospace: true },
  'ft kunst grotesk': { charWidth: 0.52, monospace: false },
  geist: { charWidth: 0.54, monospace: false },
  'geist mono': { charWidth: 0.6, monospace: true },
  'ibm plex mono': { charWidth: 0.6, monospace: true },
  inter: { charWidth: 0.56, monospace: false },
  'instrument serif': { charWidth: 0.39, monospace: false },
  'kh teka mono': { charWidth: 0.62, monospace: true },
  lausanne: { charWidth: 0.53, monospace: false },
  'mintlify geist mono': { charWidth: 0.6, monospace: true },
  'mintlify inter': { charWidth: 0.51, monospace: false },
  'paper mono': { charWidth: 0.61, monospace: true },
  'rasmus inter': { charWidth: 0.56, monospace: false },
  sohne: { charWidth: 0.52, monospace: false },
  'source code pro': { charWidth: 0.6, monospace: true },
  switzer: { charWidth: 0.52, monospace: false },
};

export function fontMetrics(family: string, weight = 400, role?: 'Accent' | 'Body' | 'Code' | 'Display'): FontMetrics {
  const known = FONT_METRICS[family.trim().toLocaleLowerCase()];
  const base = known ?? (role === 'Code' || /mono|code/i.test(family) ? { charWidth: 0.62, monospace: true } : { charWidth: 0.57, monospace: false });
  if (base.monospace) return base;
  return { charWidth: base.charWidth * (1 + Math.max(0, weight - 400) * 0.0003), monospace: false };
}

/** Approximate advance width; CJK and Hangul glyphs are full width. */
export function estimateTextWidth(value: string, fontSize: number, charWidth = 0.54, monospace = false): number {
  let width = 0;
  for (const character of value) {
    if (WIDE_CHARACTER.test(character)) width += 1;
    else if (monospace) width += charWidth;
    else if (character === ' ') width += 0.27;
    else if (/[il.,:;'|!]/.test(character)) width += charWidth * 0.5;
    else if (/[MWmw@%]/.test(character)) width += charWidth * 1.45;
    else if (/[A-Z0-9]/.test(character)) width += charWidth * 1.22;
    else width += charWidth;
  }
  return width * fontSize;
}

/** Greedy word wrap against an estimated measure. Unbreakable words keep their own line. */
function wrapToWidth(value: string, maxWidth: number, fontSize: number, charWidth = 0.54, monospace = false): string[] {
  const paragraphs = value.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && estimateTextWidth(candidate, fontSize, charWidth, monospace) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export type FittedText = { fontSize: number; lineHeight: number; lines: string[] };

/**
 * Finds the largest size (on a 2px step) whose wrapped lines fit the box and the
 * maximum line count. When even the minimum size overflows, the copy is clipped
 * at a word boundary with an ellipsis so text never spills outside its frame.
 */
export function fitText(
  value: string,
  {
    charWidth = 0.54,
    lineHeight = 1.1,
    maxHeight,
    maxLines = 6,
    maxSize,
    maxWidth,
    minSize = 10,
    monospace = false,
  }: {
    charWidth?: number;
    monospace?: boolean;
    lineHeight?: number;
    maxHeight: number;
    maxLines?: number;
    maxSize: number;
    maxWidth: number;
    minSize?: number;
  }
): FittedText {
  const text = value.trim();
  if (!text) return { fontSize: maxSize, lineHeight: maxSize * lineHeight, lines: [] };
  for (let size = Math.floor(maxSize); size >= minSize; size -= 2) {
    const lines = wrapToWidth(text, maxWidth, size, charWidth, monospace);
    const widest = Math.max(...lines.map((line) => estimateTextWidth(line, size, charWidth, monospace)));
    if (lines.length <= maxLines && lines.length * size * lineHeight <= maxHeight + size * 0.2 && widest <= maxWidth * 1.04) {
      return { fontSize: size, lineHeight: size * lineHeight, lines };
    }
  }
  const lines = wrapToWidth(text, maxWidth, minSize, charWidth, monospace);
  const capacity = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (minSize * lineHeight))));
  const clipped = lines.slice(0, capacity);
  if (lines.length > capacity) clipped[capacity - 1] = `${clipped[capacity - 1]!.replace(/[\s,.;:]+\S*$/, '')}…`;
  return { fontSize: minSize, lineHeight: minSize * lineHeight, lines: clipped };
}

/**
 * Display tracking in em. Identity letterSpacing is authored in "units" of about
 * 1.8% em; the result stays within -0.025em and 0 (never positive on lowercase)
 * and eases to 0 below 40 px so smaller headlines are not crowded.
 */
export function displayTrackingEm(letterSpacing: number | undefined, fontSize = 64): number {
  const base = Math.max(-0.025, Math.min(0, (letterSpacing ?? 0) * 0.018));
  const ease = fontSize >= 40 ? 1 : fontSize <= 16 ? 0 : (fontSize - 16) / 24;
  return Number((base * ease).toFixed(4));
}

/** Display tracking in px for a font size. */
export function trackingFor(fontSize: number, letterSpacing: number | undefined): number {
  return Number((fontSize * displayTrackingEm(letterSpacing, fontSize)).toFixed(2));
}

export type BrandImageAsset = Pick<BrandAsset, 'focalPoint' | 'id' | 'label' | 'path' | 'tags' | 'type'>;

/** Visual (non-logo, non-reference) assets that can fill an image slot. */
export function brandVisualAssets(identity: BrandIdentity): BrandAsset[] {
  const assets = Array.isArray(identity.assets) ? identity.assets : [];
  return assets.filter((asset) => (
    ['background', 'image', 'motion', 'product', 'texture'].includes(asset.type)
    && !/(?:^|\/)(?:references|screenshots)\//i.test(asset.path)
    && !asset.tags?.some((tag) => /studio-capture|screen[-_ ]?shot|site-capture/i.test(tag))
  ));
}

/**
 * Photographs and fields fill their frame; product shots and authored diagrams
 * keep their whole composition visible.
 */
export function imageFits(asset: Pick<BrandAsset, 'path' | 'tags' | 'type'> | undefined): 'cover' | 'contain' {
  if (!asset) return 'contain';
  if (asset.tags?.includes('centered-product')) return 'contain';
  if (asset.type === 'background' || asset.type === 'texture' || asset.tags?.includes('background-safe')) return 'cover';
  if (asset.path.endsWith('.svg') || asset.tags?.includes('brand-diagram')) return 'contain';
  return asset.type === 'image' || asset.type === 'motion' ? 'cover' : 'contain';
}

// ---------------------------------------------------------------------------
// Graphic device
// ---------------------------------------------------------------------------

export type BrandDeviceTone = 'dark' | 'light';

export type BrandDeviceOptions = {
  height: number;
  /** Unique prefix for gradient, pattern, and mask IDs. */
  prefix: string;
  seed?: number;
  tone?: BrandDeviceTone;
  width: number;
};




// Characters from the writing systems GT ships, mixed so no script reads as the default.
const GLOBE_GLYPHS = ['a', '語', '한', 'あ', 'ب', 'अ', 'ж', 'λ', 'א', 'ก', '文', 'é', 'ñ', 'ア', 'ك', 'φ', 'ß', '字', 'ש', 'ü'];
const GLOBE_LIGHT = [-0.48, -0.56, 0.68] as const;

type GlobeContinent = { lat: number; lon: number; size: number };

/** Light and land at a point on the unit disc, or null outside the sphere. */
function globePoint(nx: number, ny: number, spin: number, continents: readonly GlobeContinent[]) {
  const edge = nx * nx + ny * ny;
  if (edge > 1) return null;
  const nz = Math.sqrt(1 - edge);
  const light = Math.max(0, nx * GLOBE_LIGHT[0] + ny * GLOBE_LIGHT[1] + nz * GLOBE_LIGHT[2]);
  const lat = Math.asin(-ny);
  const lon = Math.atan2(nx, nz) + spin;
  const land = continents.some((continent) => {
    const cosine = Math.sin(lat) * Math.sin(continent.lat) + Math.cos(lat) * Math.cos(continent.lat) * Math.cos(lon - continent.lon);
    return Math.acos(Math.min(1, Math.max(-1, cosine))) < continent.size;
  });
  return { land, light };
}

/**
 * General Translation: the glyph globe. A lit sphere drawn in characters from many writing
 * systems; land glyphs are large in paper or ink, ocean glyphs small in the signal blue, and
 * glyph size carries the light the way GT's Bayer dither carries density.
 */
function glyphGlobeDevice(context: DeviceContext): string {
  const { h, random, tone, w } = context;
  const dark = tone === 'dark';
  const ink = { land: dark ? '#F2F2F0' : '#070707', ocean: dark ? '#86A8FF' : '#2F5CE0' };
  // The globe sits beside the statement and runs off the far edge, the way GT crops the earth,
  // so copy on the left stays clear and a short band still shows a large part of the sphere.
  const wide = w / h > 1.3;
  const radius = Math.min(w, h) * (wide ? 0.56 : 0.44);
  const cx = wide ? w - radius * 0.62 : w * 0.5;
  const cy = h * (wide ? 0.6 : 0.52);
  // About one glyph per 13px keeps small tiles light and large fields dense enough to read as a sphere.
  const rows = Math.round(Math.min(34, Math.max(16, (radius * 2) / 13)));
  const cell = (radius * 2) / rows;
  const spin = random() * Math.PI * 2;
  const continents = Array.from({ length: 7 }, () => ({ lat: (random() - 0.5) * 2.2, lon: random() * Math.PI * 2, size: 0.32 + random() * 0.42 }));
  const glyphs: string[] = [];
  for (let index = 0; index < rows * rows; index += 1) {
    const nx = ((index % rows) + 0.5) / rows * 2 - 1;
    const ny = (Math.floor(index / rows) + 0.5) / rows * 2 - 1;
    const point = globePoint(nx, ny, spin, continents);
    if (!point) continue;
    const size = cell * (point.land ? 0.42 + 0.62 * point.light : 0.24 + 0.36 * point.light);
    if (size < cell * 0.28) continue;
    const glyph = GLOBE_GLYPHS[Math.floor(random() * GLOBE_GLYPHS.length)]!;
    const opacity = point.land ? 0.35 + 0.55 * point.light : 0.3 + 0.45 * point.light;
    glyphs.push(`<text x="${round(cx + nx * radius)}" y="${round(cy + ny * radius)}" font-size="${round(size)}" fill="${point.land ? ink.land : ink.ocean}" fill-opacity="${round(opacity)}">${glyph}</text>`);
  }
  // The ground runs past the view box so a globe fitted whole still fills its frame.
  const ground = `<rect x="${round(-w * 4)}" y="${round(-h * 4)}" width="${round(w * 9)}" height="${round(h * 9)}" fill="${dark ? '#070707' : '#FFFFFF'}"/>`;
  return `${ground}<g font-family="Inter, 'Noto Sans', system-ui, sans-serif" font-weight="500" text-anchor="middle" dominant-baseline="central">${glyphs.join('')}</g>`;
}

const DEVICE_RENDERERS: Record<BrandIdentity['graphicSystem']['pattern'], (context: DeviceContext) => string> = {
  blocks: interruptionDevice,
  brackets: signalWindowDevice,
  burst: convergenceDevice,
  circuit: horizonDevice,
  flow: programmableFieldDevice,
  grid: gridDevice,
  none: glyphGlobeDevice,
  orbit: orbitDevice,
  rays: beamDevice,
  steps: ledgerDevice,
  wave: utilityWaveDevice,
};

const DEVICE_BASES: Record<BrandIdentity['graphicSystem']['pattern'], readonly [keyof BrandPalette | string, keyof BrandPalette | string]> = {
  blocks: ['ink', 'paper'],
  brackets: ['deep', 'muted'],
  burst: ['progress', 'highlight'],
  circuit: ['accent', 'paper'],
  flow: ['deep', 'muted'],
  grid: ['deep', 'paper'],
  none: ['#070707', '#FFFFFF'],
  orbit: ['deep', 'paper'],
  rays: ['deep', 'paper'],
  steps: ['deep', 'muted'],
  wave: ['deep', 'paper'],
};

/** The flat colour the device is drawn on, so adjoining panels can meet it seamlessly. */
export function brandDeviceBase(identity: BrandIdentity, tone: BrandDeviceTone): string {
  const palette = brandPalette(identity);
  const bases = DEVICE_BASES[identity.graphicSystem?.pattern ?? 'grid'] ?? DEVICE_BASES.grid;
  const key = bases[tone === 'dark' ? 0 : 1];
  return key.startsWith('#') ? key : palette[key as keyof BrandPalette];
}

/** The device's natural surface: the tone it was designed on first. */
function brandDeviceDefaultTone(identity: BrandIdentity): BrandDeviceTone {
  const pattern = identity.graphicSystem?.pattern ?? 'grid';
  return ['brackets', 'steps', 'flow'].includes(pattern) ? 'light' : 'dark';
}

/**
 * Inner SVG markup (no outer `<svg>`) for the identity's graphic device. IDs are
 * prefixed so several devices can share one document or one exported board.
 */
export function brandDeviceMarkup(identity: BrandIdentity, options: BrandDeviceOptions): string {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const pattern = identity.graphicSystem?.pattern ?? 'grid';
  const renderer = DEVICE_RENDERERS[pattern] ?? gridDevice;
  const prefix = options.prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  return renderer({
    h: height,
    id: (name) => `${prefix}-${name}`,
    palette: brandPalette(identity),
    random: seededRandom(options.seed ?? hashSeed(identity.id)),
    tone: options.tone ?? brandDeviceDefaultTone(identity),
    w: width,
  });
}

export function brandDeviceSvg(identity: BrandIdentity, options: BrandDeviceOptions): string {
  // Field devices fill their box; GT's globe is an object, so it is shown whole at the far edge.
  const fit = (identity.graphicSystem?.pattern ?? 'grid') === 'none' ? 'xMaxYMid meet' : 'xMidYMid slice';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(options.width)} ${round(options.height)}" preserveAspectRatio="${fit}">${brandDeviceMarkup(identity, options)}</svg>`;
}
