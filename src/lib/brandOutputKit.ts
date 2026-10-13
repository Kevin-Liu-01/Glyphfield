/**
 * Shared, framework-free building blocks for the Brand output tools (moodboard,
 * brand book, brand elements): a defensive palette, contrast helpers, text
 * fitting for SVG layout, and the generative graphic device for each identity.
 */
import type { BrandAsset, BrandIdentity } from './brandIdentity';
import { colorContrastRatio, mixHexColors, normalizeHexOrFallback } from './color';

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

export function contrastRatio(first: string, second: string): number {
  try {
    return colorContrastRatio(first, second);
  } catch {
    return 1;
  }
}

export function wcagRating(ratio: number): 'AAA' | 'AA' | 'AA large' | 'Fail' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'Fail';
}

/** The palette colour (ink or paper first) that reads best on a background. */
export function readableOn(background: string, palette: BrandPalette): string {
  const candidates = [palette.ink, palette.paper, '#FFFFFF', '#0B0B0B'];
  return candidates.reduce((best, candidate) => (
    contrastRatio(background, candidate) > contrastRatio(background, best) + 0.4 ? candidate : best
  ), candidates[0]!);
}

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

/** Typography tracking: identity letterSpacing is authored in display "units" (≈1.8% em each). */
export function trackingFor(fontSize: number, letterSpacing: number | undefined): number {
  const units = Math.max(-3, Math.min(2, letterSpacing ?? 0));
  return Number((fontSize * units * 0.018).toFixed(2));
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

type DeviceContext = {
  h: number;
  id: (name: string) => string;
  palette: BrandPalette;
  random: () => number;
  tone: BrandDeviceTone;
  w: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function deviceBackground(context: DeviceContext, dark: string, light: string): string {
  return `<rect width="${round(context.w)}" height="${round(context.h)}" fill="${context.tone === 'dark' ? dark : light}"/>`;
}

/**
 * General Translation: one quiet monochrome light field with fine dither. The
 * dither is a uniform low-opacity texture rather than a masked one, which keeps
 * large fields cheap to paint.
 */
function lightFieldDevice(context: DeviceContext): string {
  const { h, id, tone, w } = context;
  const dark = tone === 'dark';
  const stops = dark
    ? '<stop stop-color="#F7F7F7"/><stop offset=".14" stop-color="#BDBDBD"/><stop offset=".38" stop-color="#575757"/><stop offset=".66" stop-color="#171717"/><stop offset="1" stop-color="#050505"/>'
    : '<stop stop-color="#0B0B0B"/><stop offset=".12" stop-color="#5C5C5C"/><stop offset=".36" stop-color="#BDBDBD"/><stop offset=".64" stop-color="#F0F0F0"/><stop offset="1" stop-color="#FFFFFF"/>';
  const dot = Math.max(3, Math.round(Math.min(w, h) / 150));
  const ink = dark ? '#FFFFFF' : '#000000';
  return `<defs><radialGradient id="${id('field')}" cx="${w * 0.84}" cy="${h * 0.9}" r="${Math.max(w, h) * 0.86}" gradientUnits="userSpaceOnUse">${stops}</radialGradient><pattern id="${id('dither')}" width="${dot * 2}" height="${dot * 2}" patternUnits="userSpaceOnUse"><circle cx="${dot / 2}" cy="${dot / 2}" r="${round(dot * 0.22)}" fill="${ink}" fill-opacity=".1"/><circle cx="${dot * 1.5}" cy="${dot * 1.5}" r="${round(dot * 0.14)}" fill="${ink}" fill-opacity=".07"/></pattern></defs>${deviceBackground(context, '#050505', '#FFFFFF')}<rect width="${w}" height="${h}" fill="url(#${id('field')})"/><rect width="${w}" height="${h}" fill="url(#${id('dither')})"/>`;
}

type EvidenceCard = { card: string; focus: boolean; h: number; kind: 'chart' | 'note' | 'photo'; line: string; palette: BrandPalette; rule: string; stroke: number; w: number; x: number; y: number };

/** One card on Starter's research board: a photograph reduced to tone, a chart, or note lines. */
function evidenceCard({ card, focus, h, kind, line, palette, rule, stroke, w, x, y }: EvidenceCard): string {
  const inner = Math.min(w, h) * 0.1;
  const frame = `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${card}" stroke="${rule}" stroke-width="${round(stroke * 0.6)}"/>`;
  if (kind === 'photo') {
    const imageH = h * 0.58;
    const top = y + inner;
    return `${frame}<rect x="${round(x + inner)}" y="${round(top)}" width="${round(w - inner * 2)}" height="${round(imageH)}" fill="${focus ? palette.secondary : mixHexColors(card, line, 0.25)}"/><path d="M${round(x + inner)} ${round(top + imageH * 0.7)}Q${round(x + w * 0.45)} ${round(top + imageH * 0.45)} ${round(x + w - inner)} ${round(top + imageH * 0.62)}V${round(top + imageH)}H${round(x + inner)}Z" fill="${focus ? palette.deep : line}" fill-opacity="${focus ? 0.85 : 0.5}"/><rect x="${round(x + inner)}" y="${round(top + inner * 0.6 + imageH)}" width="${round((w - inner * 2) * 0.62)}" height="${round(stroke * 2.2)}" fill="${line}"/>`;
  }
  if (kind === 'chart') {
    const barW = (w - inner * 2) / 5;
    return frame + Array.from({ length: 5 }, (_, index) => {
      const barH = (h - inner * 2) * (0.3 + ((index * 37) % 60) / 100);
      return `<rect x="${round(x + inner + index * barW + barW * 0.15)}" y="${round(y + h - inner - barH)}" width="${round(barW * 0.7)}" height="${round(barH)}" fill="${index === 3 ? palette.accent : mixHexColors(card, line, 0.35)}"/>`;
    }).join('');
  }
  return frame + [0, 1, 2, 3].map((index) => `<rect x="${round(x + inner)}" y="${round(y + inner + index * h * 0.18)}" width="${round((w - inner * 2) * (index === 0 ? 0.7 : 0.9 - index * 0.12))}" height="${round(stroke * (index === 0 ? 2.6 : 1.8))}" fill="${line}" fill-opacity="${index === 0 ? 1 : 0.6}"/>`).join('');
}

/**
 * Starter: the signal window in use. A research board of evidence cards
 * (photographs reduced to tone, notes, a chart) sits quiet while one card is
 * framed by the blue window, its corner brackets and a label tab.
 */
function signalWindowDevice(context: DeviceContext): string {
  const { h, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const unit = Math.min(w, h);
  const card = dark ? mixHexColors(palette.deep, palette.paper, 0.1) : palette.paper;
  const rule = dark ? mixHexColors(palette.deep, palette.paper, 0.22) : mixHexColors(palette.paper, palette.ink, 0.12);
  const line = dark ? mixHexColors(palette.deep, palette.paper, 0.45) : mixHexColors(palette.paper, palette.ink, 0.55);
  const columns = w >= h ? 4 : 3;
  const rows = w >= h ? 3 : 4;
  const gap = unit * 0.035;
  const cellW = (w * 0.94 - gap * (columns - 1)) / columns;
  const cellH = (h * 0.9 - gap * (rows - 1)) / rows;
  const originX = w * 0.03;
  const originY = h * 0.05;
  const focus = { column: Math.min(columns - 1, Math.floor(columns * 0.55)), row: Math.min(rows - 1, Math.floor(rows * 0.4)) };
  const stroke = Math.max(1.5, unit * 0.006);
  const cards: string[] = [];
  let focusRect = { h: 0, w: 0, x: 0, y: 0 };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = originX + column * (cellW + gap);
      const y = originY + row * (cellH + gap);
      const isFocus = row === focus.row && column === focus.column;
      if (isFocus) focusRect = { h: cellH, w: cellW, x, y };
      const kind = isFocus ? 'photo' : (['note', 'photo', 'chart', 'note', 'photo'] as const)[Math.floor(random() * 5)]!;
      cards.push(evidenceCard({ card, focus: isFocus, h: cellH, kind, line, palette, rule, stroke, w: cellW, x, y }));
    }
  }
  const frameStroke = Math.max(3, unit * 0.014);
  const offset = frameStroke * 2.2;
  const tick = unit * 0.05;
  const bracketColor = dark ? palette.paper : palette.ink;
  const { x, y, w: fw, h: fh } = focusRect;
  const corners = [[x - offset, y - offset, 1, 1], [x + fw + offset, y - offset, -1, 1], [x - offset, y + fh + offset, 1, -1], [x + fw + offset, y + fh + offset, -1, -1]] as const;
  const brackets = corners.map(([cx, cy, dx, dy]) => `<path d="M${round(cx)} ${round(cy + tick * dy)}V${round(cy)}H${round(cx + tick * dx)}" fill="none" stroke="${bracketColor}" stroke-width="${round(stroke)}"/>`).join('');
  const tabH = Math.max(8, unit * 0.04);
  const tab = `<rect x="${round(x - frameStroke / 2)}" y="${round(y - frameStroke / 2 - tabH)}" width="${round(Math.min(fw * 0.5, unit * 0.2))}" height="${round(tabH)}" fill="${palette.accent}"/><rect x="${round(x + tabH * 0.4)}" y="${round(y - frameStroke / 2 - tabH * 0.58)}" width="${round(Math.min(fw * 0.5, unit * 0.2) * 0.6)}" height="${round(Math.max(1.5, tabH * 0.16))}" fill="${readableOn(palette.accent, palette)}"/>`;
  return `${deviceBackground(context, palette.deep, palette.muted)}${cards.join('')}<rect x="${round(x)}" y="${round(y)}" width="${round(fw)}" height="${round(fh)}" fill="none" stroke="${palette.accent}" stroke-width="${round(frameStroke)}"/>${brackets}${tab}`;
}

/** Basement: one engineered interruption crossing a severe field. */
function interruptionDevice(context: DeviceContext): string {
  const { h, palette, tone, w } = context;
  const y = h * 0.54;
  const bar = Math.max(h * 0.11, 12);
  const cut = w * 0.43;
  const gap = Math.max(4, w * 0.012);
  const rule = mixHexColors(tone === 'dark' ? palette.paper : palette.ink, tone === 'dark' ? palette.ink : palette.paper, 0.78);
  return `${deviceBackground(context, palette.ink, palette.paper)}<rect y="${round(y)}" width="${round(cut)}" height="${round(bar)}" fill="${palette.accent}"/><rect x="${round(cut + gap)}" y="${round(y)}" width="${round(w - cut - gap)}" height="${round(bar)}" fill="${tone === 'dark' ? palette.paper : palette.ink}"/>${[0.86, 0.9].map((offset) => `<rect y="${round(h * offset)}" width="${w}" height="1" fill="${rule}"/>`).join('')}<rect x="${round(w * 0.06)}" y="${round(h * 0.865)}" width="${round(w * 0.05)}" height="${round(h * 0.03)}" fill="${palette.accent}"/>`;
}

/** Ramp: ledger rules, a highlighter row, and a rising savings staircase. */
function ledgerDevice(context: DeviceContext): string {
  const { h, palette, tone, w } = context;
  const ink = tone === 'dark' ? palette.paper : palette.ink;
  const rows = 8;
  const step = h / rows;
  const left = w * 0.1;
  const right = w * 0.9;
  const rules = Array.from({ length: rows - 1 }, (_, index) => `<rect x="0" y="${round(step * (index + 1))}" width="${w}" height="1" fill="${ink}" fill-opacity=".14"/>`).join('');
  const columns = [left, right].map((x) => `<rect x="${round(x)}" width="1" height="${h}" fill="${ink}" fill-opacity=".14"/>`).join('');
  const steps = 6;
  let path = `M${round(left)} ${round(step * 7)}`;
  const nodes: string[] = [];
  for (let index = 0; index < steps; index += 1) {
    const x = left + ((right - left) / steps) * (index + 1);
    const y = step * (6 - index);
    path += `H${round(x)}V${round(y)}`;
    nodes.push(`<rect x="${round(x - 4)}" y="${round(y - 4)}" width="8" height="8" fill="${ink}"/>`);
  }
  const stroke = Math.max(2, Math.min(w, h) * 0.008);
  return `${deviceBackground(context, palette.deep, palette.paper)}${rules}${columns}<rect x="${round(left)}" y="${round(step * 4)}" width="${round((right - left) * 0.56)}" height="${round(step)}" fill="${palette.accent}"/><path d="${path}" fill="none" stroke="${ink}" stroke-width="${round(stroke)}"/>${nodes.join('')}`;
}

/** Mintlify: a directional knowledge beam illuminating one document. */
function beamDevice(context: DeviceContext): string {
  const { h, id, palette, tone, w } = context;
  const dark = tone === 'dark';
  const sourceX = w * 0.04;
  const sourceY = h * 0.1;
  const docX = w * 0.54;
  const docY = h * 0.34;
  const docW = w * 0.36;
  const docH = h * 0.5;
  const radius = Math.min(docW, docH) * 0.05;
  const lineColor = dark ? palette.paper : palette.ink;
  const lines = [0.2, 0.34, 0.48, 0.62, 0.76].map((offset, index) => `<rect x="${round(docX + docW * 0.1)}" y="${round(docY + docH * offset)}" width="${round(docW * (index === 2 ? 0.66 : 0.78 - index * 0.06))}" height="${round(Math.max(3, docH * 0.035))}" rx="${round(Math.max(1.5, docH * 0.017))}" fill="${index === 2 ? palette.secondary : lineColor}" fill-opacity="${index === 2 ? 1 : 0.18}"/>`).join('');
  const rays = Array.from({ length: 7 }, (_, index) => {
    const t = index / 6;
    return `<path d="M${round(sourceX)} ${round(sourceY)}L${round(docX + docW * (0.1 + t * 0.8))} ${round(docY + docH * (0.05 + t * 0.9))}" stroke="${palette.secondary}" stroke-opacity="${round(0.08 + (index % 3) * 0.05)}" stroke-width="1"/>`;
  }).join('');
  return `<defs><linearGradient id="${id('beam')}" x1="${sourceX}" y1="${sourceY}" x2="${docX + docW}" y2="${docY + docH}" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.secondary}" stop-opacity="${dark ? 0.55 : 0.4}"/><stop offset=".7" stop-color="${palette.accent}" stop-opacity="${dark ? 0.16 : 0.1}"/><stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/></linearGradient></defs>${deviceBackground(context, palette.deep, palette.paper)}<path d="M${round(sourceX)} ${round(sourceY)}L${round(docX + docW * 1.05)} ${round(docY - docH * 0.08)}L${round(docX + docW * 0.7)} ${round(docY + docH * 1.12)}Z" fill="url(#${id('beam')})"/>${rays}<rect x="${round(docX)}" y="${round(docY)}" width="${round(docW)}" height="${round(docH)}" rx="${round(radius)}" fill="${dark ? mixHexColors(palette.deep, palette.paper, 0.06) : palette.paper}" stroke="${palette.accent}" stroke-opacity=".55"/>${lines}<circle cx="${round(sourceX)}" cy="${round(sourceY)}" r="${round(Math.max(3, Math.min(w, h) * 0.012))}" fill="${palette.secondary}"/>`;
}

/** Tailwind: two currents built from utility-sized segments. */
function utilityWaveDevice(context: DeviceContext): string {
  const { h, palette, w } = context;
  const segments = 30;
  const amplitude = h * 0.16;
  const stroke = Math.max(3, h * 0.034);
  const wave = (phase: number, offset: number, color: string, opacity: number) => Array.from({ length: segments }, (_, index) => {
    const x1 = (w / segments) * index;
    const x2 = x1 + (w / segments) * 0.46;
    const y = (x: number) => h * offset + Math.sin((x / w) * Math.PI * 2.2 + phase) * amplitude * (0.55 + 0.45 * (x / w));
    return `<path d="M${round(x1)} ${round(y(x1))}L${round(x2)} ${round(y(x2))}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${round(stroke)}" stroke-linecap="round"/>`;
  }).join('');
  return `${deviceBackground(context, palette.deep, palette.paper)}${wave(0.4, 0.46, palette.accent, 1)}${wave(1.5, 0.58, palette.secondary, 0.7)}`;
}

/** Vite+: many tool paths bending into one accelerated center. */
function convergenceDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const cx = w * 0.62;
  const cy = h * 0.5;
  const paths = Array.from({ length: 26 }, (_, index) => {
    const t = index / 25;
    const startY = h * (-0.1 + t * 1.2);
    const control = `${round(w * (0.18 + random() * 0.2))} ${round(startY * 0.6 + cy * 0.4)}`;
    const color = index % 5 === 0 ? palette.progress : palette.accent;
    return `<path d="M0 ${round(startY)}Q${control} ${round(cx)} ${round(cy)}" fill="none" stroke="${color}" stroke-opacity="${round(0.18 + random() * 0.5)}" stroke-width="${round(1 + random() * 1.4)}"/>`;
  }).join('');
  const glow = Math.min(w, h) * 0.34;
  return `<defs><radialGradient id="${id('glow')}" cx="${cx}" cy="${cy}" r="${glow}" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.accent}" stop-opacity=".7"/><stop offset=".45" stop-color="${palette.progress}" stop-opacity=".18"/><stop offset="1" stop-color="${palette.progress}" stop-opacity="0"/></radialGradient></defs>${deviceBackground(context, palette.ink, palette.paper)}${tone === 'dark' ? `<rect width="${w}" height="${h}" fill="url(#${id('glow')})"/>` : ''}${paths}<path d="M${round(cx)} ${round(cy)}H${w}" stroke="${palette.secondary}" stroke-width="${round(Math.max(2, h * 0.012))}"/><circle cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.max(4, Math.min(w, h) * 0.018))}" fill="${palette.secondary}"/>`;
}

/** Cloudflare: one orange horizon where requests cross into the network. */
function horizonDevice(context: DeviceContext): string {
  const { h, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const ink = dark ? palette.paper : palette.ink;
  const horizonY = h * 0.5;
  const band = Math.max(8, h * 0.065);
  const users = Array.from({ length: 9 }, (_, index) => ({ x: w * (0.06 + index * 0.11 + random() * 0.03), y: h * (0.16 + random() * 0.14) }));
  const origins = Array.from({ length: 5 }, (_, index) => ({ x: w * (0.14 + index * 0.18), y: h * 0.82 }));
  const node = Math.max(3, Math.min(w, h) * 0.012);
  const requests = users.map((user) => `<path d="M${round(user.x)} ${round(user.y)}V${round(horizonY)}" stroke="${ink}" stroke-opacity=".28"/><circle cx="${round(user.x)}" cy="${round(user.y)}" r="${round(node)}" fill="${ink}"/><rect x="${round(user.x - 1)}" y="${round(horizonY)}" width="2" height="${round(band)}" fill="${palette.paper}"/>`).join('');
  const routes = origins.map((origin, index) => `<path d="M${round(users[index * 2]!.x)} ${round(horizonY + band)}C${round(users[index * 2]!.x)} ${round(origin.y - h * 0.1)} ${round(origin.x)} ${round(origin.y - h * 0.12)} ${round(origin.x)} ${round(origin.y)}" fill="none" stroke="${palette.accent}" stroke-opacity=".6"/><rect x="${round(origin.x - node * 1.6)}" y="${round(origin.y - node * 1.6)}" width="${round(node * 3.2)}" height="${round(node * 3.2)}" fill="none" stroke="${ink}" stroke-opacity=".7"/>`).join('');
  return `${deviceBackground(context, palette.deep, palette.paper)}${requests}<rect y="${round(horizonY)}" width="${w}" height="${round(band)}" fill="${palette.accent}"/>${routes}`;
}

/** Stripe: layered programmable ribbons framing a concrete economic object. */
function programmableFieldDevice(context: DeviceContext): string {
  const { h, id, palette, tone, w } = context;
  const ribbons = [
    [palette.accent, palette.secondary, 0.0, 0.5],
    [palette.highlight, palette.progress, 0.16, 0.2],
    [palette.secondary, palette.accent, 0.3, 0.72],
    [palette.progress, palette.highlight, 0.46, 0.38],
  ] as const;
  const gradients: string[] = [];
  const shapes = ribbons.map(([from, to, offset, bend], index) => {
    const gradient = id(`ribbon${index}`);
    const y0 = h * (1.08 - offset * 0.5);
    const y1 = h * (0.05 + offset * 0.35);
    const thickness = h * (0.24 - index * 0.035);
    const top = `M${round(-w * 0.05)} ${round(y0)}C${round(w * 0.28)} ${round(y0 - h * bend)} ${round(w * 0.6)} ${round(y1 + h * (0.7 - bend))} ${round(w * 1.05)} ${round(y1)}`;
    const bottom = `L${round(w * 1.05)} ${round(y1 + thickness * 0.6)}C${round(w * 0.6)} ${round(y1 + h * (0.7 - bend) + thickness)} ${round(w * 0.28)} ${round(y0 - h * bend + thickness * 1.3)} ${round(-w * 0.05)} ${round(y0 + thickness)}Z`;
    gradients.push(`<linearGradient id="${gradient}" x1="0" y1="${h}" x2="${w}" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`);
    return `<path d="${top}${bottom}" fill="url(#${gradient})" fill-opacity="${round((tone === 'dark' ? 0.92 : 0.82) - index * 0.12)}"/>`;
  });
  return `<defs>${gradients.join('')}</defs>${deviceBackground(context, palette.deep, palette.paper)}<g transform="skewY(-6) translate(0 ${round(h * 0.06)})">${shapes.join('')}</g>`;
}

/** Fallback for custom identities: a modular grid with one emphasised cell. */
function gridDevice(context: DeviceContext): string {
  const { h, palette, random, tone, w } = context;
  const columns = 12;
  const size = w / columns;
  const rows = Math.ceil(h / size);
  const ink = tone === 'dark' ? palette.paper : palette.ink;
  const lines = [
    ...Array.from({ length: columns - 1 }, (_, index) => `<rect x="${round(size * (index + 1))}" width="1" height="${h}" fill="${ink}" fill-opacity=".12"/>`),
    ...Array.from({ length: rows }, (_, index) => `<rect y="${round(size * (index + 1))}" width="${w}" height="1" fill="${ink}" fill-opacity=".12"/>`),
  ].join('');
  const cellX = Math.floor(columns * (0.45 + random() * 0.3));
  const cellY = Math.floor(rows * (0.3 + random() * 0.3));
  return `${deviceBackground(context, palette.deep, palette.paper)}${lines}<rect x="${round(cellX * size)}" y="${round(cellY * size)}" width="${round(size * 3)}" height="${round(size * 2)}" fill="${palette.accent}"/>`;
}

function orbitDevice(context: DeviceContext): string {
  const { h, palette, tone, w } = context;
  const ink = tone === 'dark' ? palette.paper : palette.ink;
  const cx = w * 0.62;
  const cy = h * 0.55;
  const rings = [0.18, 0.3, 0.42, 0.56].map((radius) => `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.min(w, h) * radius)}" fill="none" stroke="${ink}" stroke-opacity=".18"/>`).join('');
  return `${deviceBackground(context, palette.deep, palette.paper)}${rings}<circle cx="${round(cx + Math.min(w, h) * 0.3)}" cy="${round(cy)}" r="${round(Math.min(w, h) * 0.035)}" fill="${palette.accent}"/>`;
}

const DEVICE_RENDERERS: Record<BrandIdentity['graphicSystem']['pattern'], (context: DeviceContext) => string> = {
  blocks: interruptionDevice,
  brackets: signalWindowDevice,
  burst: convergenceDevice,
  circuit: horizonDevice,
  flow: programmableFieldDevice,
  grid: gridDevice,
  none: lightFieldDevice,
  orbit: orbitDevice,
  rays: beamDevice,
  steps: ledgerDevice,
  wave: utilityWaveDevice,
};

const DEVICE_BASES: Record<BrandIdentity['graphicSystem']['pattern'], readonly [keyof BrandPalette | string, keyof BrandPalette | string]> = {
  blocks: ['ink', 'paper'],
  brackets: ['deep', 'muted'],
  burst: ['ink', 'paper'],
  circuit: ['deep', 'paper'],
  flow: ['deep', 'paper'],
  grid: ['deep', 'paper'],
  none: ['#050505', '#FFFFFF'],
  orbit: ['deep', 'paper'],
  rays: ['deep', 'paper'],
  steps: ['deep', 'paper'],
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
  return ['brackets', 'steps', 'circuit'].includes(pattern) ? 'light' : 'dark';
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(options.width)} ${round(options.height)}" preserveAspectRatio="xMidYMid slice">${brandDeviceMarkup(identity, options)}</svg>`;
}
