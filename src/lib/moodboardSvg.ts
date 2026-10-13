import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandAsset,
  type BrandIdentity,
} from './brandIdentity';
import {
  brandDeviceBase,
  brandDeviceMarkup,
  brandPalette,
  brandSurface,
  contrastRatio,
  escapeXml,
  estimateTextWidth,
  fitText,
  fontMetrics,
  hashSeed,
  imageFits,
  isDarkColor,
  readableOn,
  trackingFor,
  wcagRating,
  type BrandPalette,
  type BrandSurface,
  type BrandSurfaceTone,
} from './brandOutputKit';
import { brandCustomers, brandMessaging, brandProducts, brandProofStatements } from './brandContent';
import { mixHexColors } from './color';
import {
  layoutMoodboardTiles,
  MOODBOARD_BOARD_SIZES,
  MOODBOARD_TILE_LABELS,
  moodboardImageAssetIds,
  resolveMoodboardBoard,
  type MoodboardBoard,
  type MoodboardCopyField,
  type MoodboardOverrides,
  type MoodboardRect,
  type MoodboardTile,
} from './moodboardBoard';
import type { MoodboardComposition } from './moodboard';
import { getEmailLifecycleTemplate } from './emailLifecycle';
import { capVisibleFontWeight } from './typography';

export type MoodboardSvgAssets = {
  accentFont?: string;
  artAssets?: readonly Pick<BrandAsset, 'focalPoint' | 'id' | 'label' | 'path' | 'tags' | 'type'>[];
  bodyFont?: string;
  codeFont?: string;
  displayFont?: string;
  /** Embedded `@font-face` rules for every brand font file (export only). */
  fontFaceCss?: string;
  logoMarks?: readonly string[];
  markDark?: string;
  proofAssets?: readonly Pick<BrandAsset, 'id' | 'label' | 'path'>[];
  markLight?: string;
  wordmark?: string;
  wordmarkLight?: string;
};

export type MoodboardTextSlot = {
  anchor: 'middle' | 'start';
  /** Surface behind the text, so an in-place editor can cover the rendered copy. */
  background: string;
  color: string;
  family: string;
  field: MoodboardCopyField;
  fontSize: number;
  height: number;
  lineHeight: number;
  tracking: number;
  weight: number;
  width: number;
  x: number;
  y: number;
};

export type MoodboardTileRender = { markup: string; slots: MoodboardTextSlot[] };

type FontRole = 'accent' | 'body' | 'code' | 'display';
type FontSpec = { charWidth: number; family: string; lineHeight: number; monospace: boolean; stack: string; tracking: number; weight: number };

type TileContext = {
  assets: MoodboardSvgAssets;
  fonts: Record<FontRole, FontSpec>;
  h: number;
  id: (name: string) => string;
  identity: BrandIdentity;
  images: readonly string[];
  palette: BrandPalette;
  slots: MoodboardTextSlot[];
  surface: BrandSurface;
  tile: MoodboardTile;
  w: number;
};

const SANS_FALLBACK = 'sans-serif';
const MONO_FALLBACK = 'monospace';

function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function fontSpec(identity: BrandIdentity, role: 'Accent' | 'Body' | 'Code' | 'Display'): FontSpec {
  const typography = brandTypographyRole(identity, role);
  const family = brandTypographyFamily(identity, role);
  const fallback = role === 'Code' ? MONO_FALLBACK : SANS_FALLBACK;
  const weight = capVisibleFontWeight(typography.weight ?? (role === 'Display' ? 500 : 400));
  const metrics = fontMetrics(family, weight, role);
  return {
    charWidth: metrics.charWidth,
    family,
    monospace: metrics.monospace,
    lineHeight: typography.lineHeight ?? (role === 'Display' ? 1 : 1.45),
    stack: `'${family.replaceAll("'", '')}', ${fallback}`,
    tracking: typography.letterSpacing ?? 0,
    weight,
  };
}

function moodboardFonts(identity: BrandIdentity): Record<FontRole, FontSpec> {
  return {
    accent: fontSpec(identity, 'Accent'),
    body: fontSpec(identity, 'Body'),
    code: fontSpec(identity, 'Code'),
    display: fontSpec(identity, 'Display'),
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function rect(x: number, y: number, width: number, height: number, fill: string, extra = ''): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, width))}" height="${n(Math.max(0, height))}" fill="${fill}"${extra}/>`;
}

function hairline(x: number, y: number, width: number, color: string): string {
  return rect(x, y, width, 1, color);
}

type TextOptions = {
  align?: 'middle' | 'start';
  anchor?: 'bottom' | 'top';
  charWidth?: number;
  color?: string;
  field?: MoodboardCopyField;
  lineHeight?: number;
  maxHeight: number;
  maxLines?: number;
  maxSize: number;
  minSize?: number;
  role: FontRole;
  uppercase?: boolean;
  weight?: number;
  width: number;
  x: number;
  y: number;
};

/** Fitted multi-line text that records an editable slot when it maps to tile copy. */
function textBlock(context: TileContext, value: string, options: TextOptions): string {
  return layoutTextBlock(context, value, options).markup;
}

/** Lay out several blocks top-down so long copy pushes the next block rather than colliding. */
function textStack(context: TileContext, x: number, y: number, width: number, blocks: Array<{ gap?: number; options: Omit<TextOptions, 'width' | 'x' | 'y'>; value: string }>): { bottom: number; markup: string } {
  let cursor = y;
  const markup = blocks.map(({ gap = 0, options, value }) => {
    const block = layoutTextBlock(context, value, { ...options, width, x, y: cursor });
    cursor += block.height + (block.height > 0 ? gap : 0);
    return block.markup;
  }).join('');
  return { bottom: cursor, markup };
}

function layoutTextBlock(context: TileContext, value: string, options: TextOptions): { height: number; markup: string } {
  const font = context.fonts[options.role];
  const text = options.uppercase ? value.toLocaleUpperCase() : value;
  const lineHeightRatio = options.lineHeight ?? (options.role === 'display' ? clamp(font.lineHeight, 0.92, 1.12) : clamp(font.lineHeight, 1.3, 1.6));
  // Uppercase labels carry 0.08em tracking; account for it so captions never collide.
  const charWidth = (options.charWidth ?? font.charWidth) + (options.uppercase ? 0.08 : 0);
  const fitted = fitText(text, {
    charWidth,
    monospace: font.monospace,
    lineHeight: lineHeightRatio,
    maxHeight: options.maxHeight,
    maxLines: options.maxLines ?? 6,
    maxSize: options.maxSize,
    maxWidth: options.width,
    minSize: options.minSize ?? Math.min(options.maxSize, 9),
  });
  const blockHeight = fitted.lines.length > 0 ? (fitted.lines.length - 1) * fitted.lineHeight + fitted.fontSize : 0;
  const top = options.anchor === 'bottom' ? options.y - blockHeight : options.y;
  const x = options.align === 'middle' ? options.x + options.width / 2 : options.x;
  const tracking = options.uppercase ? n(fitted.fontSize * 0.08) : n(trackingFor(fitted.fontSize, options.role === 'code' ? 0 : font.tracking));
  const weight = options.weight ?? font.weight;
  const color = options.color ?? context.surface.foreground;
  if (options.field) {
    context.slots.push({
      anchor: options.align ?? 'start',
      background: context.surface.background,
      color,
      family: font.stack,
      field: options.field,
      fontSize: fitted.fontSize,
      height: Math.max(blockHeight, fitted.fontSize),
      lineHeight: fitted.lineHeight,
      tracking: Number(tracking),
      weight,
      width: options.width,
      x: options.x,
      y: top,
    });
  }
  if (fitted.lines.length === 0) return { height: 0, markup: '' };
  const tspans = fitted.lines.map((line, index) => `<tspan x="${n(x)}" y="${n(top + fitted.fontSize * 0.8 + index * fitted.lineHeight)}">${escapeXml(line)}</tspan>`).join('');
  return { height: blockHeight, markup: `<text font-family="${escapeXml(font.stack)}" font-size="${n(fitted.fontSize)}" font-weight="${weight}" letter-spacing="${tracking}" fill="${color}"${options.align === 'middle' ? ' text-anchor="middle"' : ''}${options.field ? ` data-field="${options.field}"` : ''}>${tspans}</text>` };
}

function labelSize(context: TileContext): number {
  return clamp(Math.min(context.w, context.h) * 0.034, 9, 12);
}

/** One line of small uppercase metadata in the code face. */
function label(context: TileContext, value: string, x: number, y: number, options: { align?: 'end' | 'start'; color?: string; field?: MoodboardCopyField; width?: number } = {}): string {
  if (!value) return '';
  const size = labelSize(context);
  const width = options.width ?? context.w - x - pad(context);
  if (options.align === 'end') {
    return `<text x="${n(x)}" y="${n(y + size * 0.8)}" text-anchor="end" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(size)}" letter-spacing="${n(size * 0.06)}" fill="${options.color ?? context.surface.secondary}">${escapeXml(value.toLocaleUpperCase())}</text>`;
  }
  return textBlock(context, value, { color: options.color ?? context.surface.secondary, field: options.field, maxHeight: size * 1.3, maxLines: 1, maxSize: size, minSize: Math.min(size, 8), role: 'code', uppercase: true, weight: context.fonts.code.weight, width, x, y });
}

function pad(context: Pick<TileContext, 'h' | 'w'>): number {
  return Math.round(clamp(Math.min(context.w, context.h) * 0.075, 14, 44));
}

function nestedSvg(x: number, y: number, width: number, height: number, inner: string, viewBox?: string): string {
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(Math.max(1, width))}" height="${n(Math.max(1, height))}" viewBox="${viewBox ?? `0 0 ${n(Math.max(1, width))} ${n(Math.max(1, height))}`}" preserveAspectRatio="xMidYMid slice" overflow="hidden">${inner}</svg>`;
}

function deviceArt(context: TileContext, x: number, y: number, width: number, height: number, dark: boolean, seed = 0, fade?: 'left' | 'top'): string {
  const markup = brandDeviceMarkup(context.identity, {
    height,
    prefix: context.id(`device${seed}`),
    seed: hashSeed(`${context.identity.id}:${context.tile.id}:${seed}`),
    tone: dark ? 'dark' : 'light',
    width,
  });
  if (!fade) return nestedSvg(x, y, width, height, markup);
  // Feather the edge that meets a text panel so the field never ends on a hard crop.
  const maskId = context.id(`fade${seed}`);
  const gradient = fade === 'left'
    ? `<linearGradient id="${maskId}-g" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#FFF" stop-opacity="0"/><stop offset=".22" stop-color="#FFF"/></linearGradient>`
    : `<linearGradient id="${maskId}-g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFF" stop-opacity="0"/><stop offset=".22" stop-color="#FFF"/></linearGradient>`;
  return nestedSvg(x, y, width, height, `<defs>${gradient}<mask id="${maskId}"><rect width="${n(width)}" height="${n(height)}" fill="url(#${maskId}-g)"/></mask></defs><g mask="url(#${maskId})">${markup}</g>`);
}

function artAsset(context: TileContext, assetId: string) {
  return context.assets.artAssets?.find((asset) => asset.id === assetId);
}

/** Pick the tile's chosen image, then the next distinct eligible images. */
function imageIds(context: TileContext, count: number): string[] {
  const chosen = context.tile.assetId ? [context.tile.assetId] : [];
  const rest = context.images.filter((id) => !chosen.includes(id));
  return [...chosen, ...rest].slice(0, count);
}

function imageArt(context: TileContext, assetId: string | undefined, x: number, y: number, width: number, height: number): string {
  const asset = assetId ? artAsset(context, assetId) : undefined;
  if (!asset) return deviceArt(context, x, y, width, height, isDarkColor(context.surface.background), hashSeed(assetId ?? 'image'));
  const fit = imageFits(asset);
  const focalX = asset.focalPoint?.x ?? 0.5;
  const focalY = asset.focalPoint?.y ?? 0.5;
  const alignX = focalX < 0.4 ? 'xMin' : focalX > 0.6 ? 'xMax' : 'xMid';
  const alignY = focalY < 0.4 ? 'YMin' : focalY > 0.6 ? 'YMax' : 'YMid';
  const treatment = context.identity.style?.imageTreatment ?? 'natural';
  const filter = treatment !== 'natural' && !asset.path.endsWith('.svg') ? ` filter="url(#${context.id('treatment')})"` : '';
  const inset = fit === 'contain' ? Math.min(width, height) * 0.06 : 0;
  const backdrop = fit === 'contain' ? rect(0, 0, width, height, context.palette.muted) : '';
  const image = `<image href="${escapeXml(asset.path)}" x="${n(inset)}" y="${n(inset)}" width="${n(width - inset * 2)}" height="${n(height - inset * 2)}" preserveAspectRatio="${alignX}${alignY} ${fit === 'cover' ? 'slice' : 'meet'}"${filter}/>`;
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" overflow="hidden">${backdrop}${image}</svg>`;
}

function treatmentFilter(context: TileContext): string {
  const treatment = context.identity.style?.imageTreatment ?? 'natural';
  if (treatment === 'monochrome') {
    return `<filter id="${context.id('treatment')}"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.06" intercept="-.03"/><feFuncG type="linear" slope="1.06" intercept="-.03"/><feFuncB type="linear" slope="1.06" intercept="-.03"/></feComponentTransfer></filter>`;
  }
  if (treatment === 'duotone') {
    const dark = context.palette.deep.replace('#', '');
    const light = context.palette.accent.replace('#', '');
    const channel = (hex: string, offset: number) => (Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(3);
    const table = (offset: number) => `${channel(dark, offset)} ${channel(light, offset)}`;
    return `<filter id="${context.id('treatment')}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(2)}"/><feFuncB type="table" tableValues="${table(4)}"/></feComponentTransfer></filter>`;
  }
  return '';
}

type LogoKind = 'mark' | 'wordmark';

function logoHref(context: TileContext, onDark: boolean, kind: LogoKind): string | undefined {
  const { assets } = context;
  if (kind === 'wordmark') {
    const wordmark = onDark ? assets.wordmarkLight ?? assets.markLight : assets.wordmark ?? assets.markDark;
    if (wordmark) return wordmark;
  }
  return onDark ? assets.markLight ?? assets.markDark : assets.markDark ?? assets.markLight;
}

function logo(context: TileContext, background: string, x: number, y: number, width: number, height: number, options: { align?: 'middle' | 'start'; kind?: LogoKind } = {}): string {
  const href = logoHref(context, isDarkColor(background), options.kind ?? 'mark');
  const align = options.align === 'middle' ? 'xMidYMid' : 'xMinYMid';
  if (href) return `<image href="${escapeXml(href)}" x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="${align} meet"/>`;
  const font = context.fonts.display;
  return `<text x="${n(options.align === 'middle' ? x + width / 2 : x)}" y="${n(y + height * 0.78)}"${options.align === 'middle' ? ' text-anchor="middle"' : ''} font-family="${escapeXml(font.stack)}" font-size="${n(height * 0.9)}" font-weight="${font.weight}" fill="${readableOn(background, context.palette)}">${escapeXml(context.identity.shortName || context.identity.name)}</text>`;
}

function surfaceOf(context: TileContext, tone: BrandSurfaceTone): BrandSurface {
  return brandSurface(context.palette, tone);
}

/** The surface a feature application (poster, card front) is printed on. */
function featureTone(context: TileContext): BrandSurfaceTone {
  const background = context.surface.background;
  const deepIsDistinct = contrastRatio(context.palette.deep, background) > 1.6;
  return deepIsDistinct ? 'deep' : 'accent';
}

function frame(x: number, y: number, width: number, height: number, color: string): string {
  return `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${n(width - 1)}" height="${n(height - 1)}" fill="none" stroke="${color}"/>`;
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function splitHorizontally(context: TileContext): boolean {
  return context.w / context.h >= 1.25;
}

function renderCover(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const variant = tile.variant;
  if (variant === 'type') return renderTypeCover(context);
  const horizontal = splitHorizontally(context);
  const textWidth = horizontal ? w * 0.42 : w;
  const textHeight = horizontal ? h : h * 0.42;
  const artX = horizontal ? textWidth : 0;
  const artY = horizontal ? 0 : textHeight;
  const dark = isDarkColor(surface.background);
  const panel = variant === 'image' ? surface.background : brandDeviceBase(context.identity, dark ? 'dark' : 'light');
  const panelContext = { ...context, surface: { ...surface, background: panel, foreground: readableOn(panel, context.palette), secondary: brandSurfaceSecondary(panel, context.palette) } };
  const art = variant === 'image'
    ? imageArt(context, imageIds(context, 1)[0], artX, artY, w - artX, h - artY)
    : deviceArt(context, artX, artY, w - artX, h - artY, dark, 0, horizontal ? 'left' : 'top');
  const markHeight = clamp(Math.min(w, h) * 0.07, 16, 40);
  const headline = textBlock(panelContext, tile.copy.headline, {
    anchor: 'bottom', field: 'headline', maxHeight: textHeight * 0.52, maxLines: context.identity.artDirection?.titleMaxLines ?? 2,
    maxSize: clamp(textHeight * 0.2, 22, 92), minSize: 16, role: 'display', width: textWidth - p * 2, x: p, y: textHeight - p - labelSize(context) * 2.2,
  });
  return `${rect(0, 0, w, h, panel)}${art}${logo(panelContext, panel, p, p, markHeight * 3, markHeight)}${headline}${label(panelContext, tile.copy.caption, p, textHeight - p - labelSize(context), { field: 'caption', width: textWidth - p * 2 })}`;
}

function brandSurfaceSecondary(background: string, palette: BrandPalette): string {
  const foreground = readableOn(background, palette);
  const quiet = mixHexColors(foreground, background, 0.32);
  return contrastRatio(quiet, background) >= 4.5 ? quiet : mixHexColors(foreground, background, 0.18);
}

function renderTypeCover(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const markHeight = clamp(Math.min(w, h) * 0.07, 16, 40);
  return `${rect(0, 0, w, h, surface.background)}${logo(context, surface.background, p, p, markHeight * 3, markHeight)}${textBlock(context, tile.copy.headline, {
    anchor: 'bottom', field: 'headline', maxHeight: h * 0.62, maxLines: 3, maxSize: clamp(h * 0.26, 28, 150), minSize: 18, role: 'display', width: w - p * 2, x: p, y: h - p - labelSize(context) * 2.4,
  })}${label(context, tile.copy.caption, p, h - p - labelSize(context), { field: 'caption' })}`;
}

type PosterSpec = { headline: string; primary: boolean; variant: string };

function posterMarkup(context: TileContext, spec: PosterSpec, x: number, y: number, width: number, height: number, index: number): string {
  const poster = surfaceOf(context, index === 0 ? featureTone(context) : context.tile.tone === 'accent' ? 'deep' : 'accent');
  const posterContext = { ...context, surface: poster };
  const inner = Math.max(10, width * 0.08);
  const artHeight = spec.variant === 'type' ? 0 : height * 0.56;
  const art = spec.variant === 'image'
    ? imageArt(context, imageIds(context, 1)[0], x, y, width, artHeight)
    : spec.variant === 'device' ? deviceArt(context, x, y, width, artHeight, isDarkColor(poster.background), 7 + index) : '';
  const typeLed = spec.variant === 'type';
  const footReserve = labelSize(context) * 2.6 + inner;
  const headline = textBlock(posterContext, spec.headline, {
    field: spec.primary ? 'headline' : undefined, maxHeight: Math.min(height * (typeLed ? 0.6 : 0.3), height - artHeight - inner - footReserve), maxLines: typeLed ? 5 : 3,
    maxSize: clamp(width * (typeLed ? 0.16 : 0.11), 12, 72), minSize: 9, role: 'display', width: width - inner * 2, x: x + inner, y: y + artHeight + inner,
  });
  const footY = y + height - inner - labelSize(context);
  const framed = contrastRatio(poster.background, context.surface.background) < 1.3 ? frame(x, y, width, height, context.surface.rule) : '';
  return `${rect(x, y, width, height, poster.background)}${art}${headline}${logo(posterContext, poster.background, x + inner, footY - labelSize(context) * 0.4, width * 0.24, labelSize(context) * 1.6)}${label(posterContext, context.tile.copy.caption, x + width - inner, footY, { align: 'end' })}${framed}`;
}

/** A poster series: the chosen layout first, then a contrasting companion when the frame allows. */
function renderPoster(context: TileContext): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const posterH = h - p * 2 - labelSize(context) * 2.2;
  const posterW = posterH / 1.414;
  const gap = p * 0.6;
  const count = posterW < 110 ? 1 : clamp(Math.floor((w - p * 2 + gap) / (posterW + gap)), 1, 3);
  const companions = ['type', 'device', 'image'].filter((variant) => variant !== tile.variant);
  const phrases = [tile.copy.headline, ...brandMessaging(identity).phrases, ...brandProducts(identity).map(({ summary }) => summary)].filter((phrase, index, all) => phrase && all.indexOf(phrase) === index);
  const specs: PosterSpec[] = Array.from({ length: count }, (_, index) => ({
    headline: phrases[index] ?? tile.copy.headline,
    primary: index === 0,
    variant: index === 0 ? tile.variant : companions[(index - 1) % companions.length]!,
  }));
  const width = Math.min(posterW, (w - p * 2 - gap * (count - 1)) / count);
  const totalW = width * count + gap * (count - 1);
  const startX = (w - totalW) / 2;
  return `${rect(0, 0, w, h, surface.background)}${specs.map((spec, index) => posterMarkup(context, spec, startX + index * (width + gap), p, width, posterH, index)).join('')}${label(context, count > 1 ? `Poster series · A1 · ${count} of ${count}` : 'Poster · A1', startX, p + posterH + labelSize(context) * 1.1, { width: totalW })}`;
}

function renderBillboard(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const boardW = w - p * 2;
  const boardH = Math.min(h - p * 2 - labelSize(context) * 2.4, boardW / 3);
  const boardY = p;
  const board = surfaceOf(context, featureTone(context));
  const boardContext = { ...context, surface: board };
  const artW = boardW * 0.46;
  const art = tile.variant === 'image'
    ? imageArt(context, imageIds(context, 1)[0], p + boardW - artW, boardY, artW, boardH)
    : deviceArt(context, p + boardW - artW, boardY, artW, boardH, isDarkColor(board.background), 3);
  const inner = boardH * 0.12;
  const headline = textBlock(boardContext, tile.copy.headline, {
    anchor: 'bottom', field: 'headline', maxHeight: boardH * 0.6, maxLines: 2, maxSize: clamp(boardH * 0.24, 14, 72), minSize: 11, role: 'display', width: boardW - artW - inner * 2, x: p + inner, y: boardY + boardH - inner,
  });
  return `${rect(0, 0, w, h, surface.background)}${rect(p, boardY, boardW, boardH, board.background)}${art}${logo(boardContext, board.background, p + inner, boardY + inner, boardH * 0.5, boardH * 0.14)}${headline}${label(context, `48-sheet billboard · ${tile.copy.caption}`, p, boardY + boardH + labelSize(context) * 1.2, { field: undefined })}`;
}

function renderSocial(context: TileContext): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const story = tile.variant === 'story';
  const postH = h - p * 2 - labelSize(context) * 2.2;
  const gap = p * 0.5;
  const naturalW = story ? postH * 9 / 16 : postH;
  const count = naturalW < 120 ? 1 : clamp(Math.floor((w - p * 2 + gap) / (naturalW + gap)), 1, 3);
  const postW = Math.min(naturalW, (w - p * 2 - gap * (count - 1)) / count);
  const totalW = postW * count + gap * (count - 1);
  const startX = (w - totalW) / 2;
  const post = surfaceOf(context, featureTone(context));
  const postContext = { ...context, surface: post };
  const headlines = [tile.copy.headline, ...brandProducts(identity).map(({ summary }) => summary)].filter((phrase, index, all) => phrase && all.indexOf(phrase) === index);
  const inner = postW * 0.08;
  const posts = Array.from({ length: count }, (_, index) => {
    const x = startX + index * (postW + gap);
    const panelH = (story ? postH * 0.36 : postH * 0.46);
    const art = index === 0 ? imageOrDevice(context, x, p, postW, postH, post.background, 11) : deviceArt(context, x, p, postW, postH, isDarkColor(post.background), 11 + index);
    const logoH = labelSize(context) * 1.4;
    return `${art}${rect(x, p + postH - panelH, postW, panelH, post.background)}${logo(postContext, post.background, x + inner, p + postH - panelH + inner * 0.8, postW * 0.26, logoH)}${textBlock(postContext, headlines[index] ?? tile.copy.headline, {
      anchor: 'bottom', field: index === 0 ? 'headline' : undefined, maxHeight: panelH - inner * 2.4 - logoH, maxLines: 3, maxSize: clamp(postW * 0.1, 11, 44), minSize: 8, role: 'display', width: postW - inner * 2, x: x + inner, y: p + postH - inner,
    })}`;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${posts}${label(context, `${story ? 'Story · 1080 × 1920' : 'Post · 1080 × 1080'}${count > 1 ? ` · series of ${count}` : ''} · ${tile.copy.caption}`, startX, p + postH + labelSize(context) * 1.1, { width: Math.max(totalW, w - p * 2) })}`;
}

function imageOrDevice(context: TileContext, x: number, y: number, width: number, height: number, background: string, seed: number): string {
  if (context.tile.assetId) return imageArt(context, context.tile.assetId, x, y, width, height);
  return deviceArt(context, x, y, width, height, isDarkColor(background), seed);
}

function renderCard(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const pair = tile.variant === 'pair';
  const horizontal = splitHorizontally(context) && pair;
  const columns = horizontal ? 2 : 1;
  const rows = pair && !horizontal ? 2 : 1;
  const gap = p * 0.6;
  const maxW = (w - p * 2 - gap * (columns - 1)) / columns;
  const maxH = (h - p * 2 - gap * (rows - 1) - labelSize(context) * 2) / rows;
  const cardW = Math.min(maxW, maxH * 1.75);
  const cardH = cardW / 1.75;
  const totalW = cardW * columns + gap * (columns - 1);
  const totalH = cardH * rows + gap * (rows - 1) + labelSize(context) * 2;
  const startX = (w - totalW) / 2;
  const startY = Math.max(p, (h - totalH) / 2);
  const front = surfaceOf(context, featureTone(context));
  const back = surfaceOf(context, 'paper');
  const frontX = startX;
  const frontY = startY;
  const backX = horizontal ? startX + cardW + gap : startX;
  const backY = horizontal ? startY : startY + cardH + gap;
  const inner = cardW * 0.08;
  const backContext = { ...context, surface: back };
  const frontMarkup = `${rect(frontX, frontY, cardW, cardH, front.background)}${deviceArt(context, frontX + cardW * 0.55, frontY, cardW * 0.45, cardH, isDarkColor(front.background), 5)}${logo({ ...context, surface: front }, front.background, frontX + inner, frontY + cardH / 2 - cardH * 0.12, cardW * 0.36, cardH * 0.24)}`;
  const backMarkup = pair || tile.variant === 'front' ? `${rect(backX, backY, cardW, cardH, back.background)}${frame(backX, backY, cardW, cardH, mixHexColors(back.foreground, back.background, 0.86))}${textBlock(backContext, tile.copy.headline, { field: 'headline', maxHeight: cardH * 0.2, maxLines: 1, maxSize: clamp(cardH * 0.12, 10, 26), role: 'display', width: cardW - inner * 2, x: backX + inner, y: backY + inner })}${textBlock(backContext, tile.copy.body, { color: back.secondary, field: 'body', maxHeight: cardH * 0.2, maxLines: 2, maxSize: clamp(cardH * 0.075, 8, 15), role: 'body', width: cardW - inner * 2, x: backX + inner, y: backY + inner + cardH * 0.17 })}${label(backContext, tile.copy.caption, backX + inner, backY + cardH - inner - labelSize(context), { field: 'caption', width: cardW - inner * 2 })}` : '';
  const shown = tile.variant === 'front' ? frontMarkup : `${frontMarkup}${backMarkup}`;
  const labelY = (pair ? Math.max(frontY, backY) : frontY) + cardH + labelSize(context) * 1.1;
  return `${rect(0, 0, w, h, surface.background)}${shown}${label(context, 'Business card · 3.5 × 2 in', startX, Math.min(labelY, h - p))}`;
}

function renderEmail(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  if (tile.variant === 'inbox') return renderInbox(context);
  const mailW = Math.min(w - p * 2, h * 0.9);
  const mailX = (w - mailW) / 2;
  const mail = surfaceOf(context, 'paper');
  const mailContext = { ...context, surface: mail };
  const headerH = mailW * 0.3;
  const inner = mailW * 0.08;
  const radius = Math.min(context.identity.style?.borderRadius ?? 6, 12) * (mailW / 640);
  const buttonY = p + headerH + inner + mailW * 0.24;
  const buttonText = tile.copy.caption || 'Open workspace';
  const buttonFont = clamp(mailW * 0.03, 8, 14);
  const buttonW = estimateTextWidth(buttonText, buttonFont, context.fonts.body.charWidth) + buttonFont * 2.4;
  const accentText = readableOn(palette.accent, palette);
  return `${rect(0, 0, w, h, surface.background)}${rect(mailX, p, mailW, h - p, mail.background)}${deviceArt(context, mailX, p, mailW, headerH, true, 13)}${logo({ ...context, surface: surfaceOf(context, 'deep') }, '#000000', mailX + inner, p + inner * 0.7, mailW * 0.2, headerH * 0.16)}${textBlock(mailContext, tile.copy.headline, { field: 'headline', maxHeight: mailW * 0.12, maxLines: 2, maxSize: clamp(mailW * 0.055, 11, 30), role: 'display', width: mailW - inner * 2, x: mailX + inner, y: p + headerH + inner })}${textBlock(mailContext, tile.copy.body, { color: mail.secondary, field: 'body', maxHeight: mailW * 0.1, maxLines: 3, maxSize: clamp(mailW * 0.028, 8, 15), role: 'body', width: mailW - inner * 2, x: mailX + inner, y: p + headerH + inner + mailW * 0.13 })}${rect(mailX + inner, buttonY, buttonW, buttonFont * 2.6, palette.accent, ` rx="${n(radius)}"`)}<text x="${n(mailX + inner + buttonFont * 1.2)}" y="${n(buttonY + buttonFont * 1.68)}" font-family="${escapeXml(context.fonts.body.stack)}" font-size="${n(buttonFont)}" font-weight="${Math.max(500, context.fonts.body.weight)}" fill="${accentText}" data-field="caption">${escapeXml(buttonText)}</text>`;
}

const INBOX_TEMPLATE_IDS = ['onboarding-day3-no-api-key-email', 'onboarding-day3-live-email', 'usage-soft-limit-email', 'upgrade-confirmation-email'] as const;

function renderInbox(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  const rowH = clamp((h - p * 2) / 5, 26, 64);
  const subjects = [tile.copy.headline, ...INBOX_TEMPLATE_IDS.map((id) => getEmailLifecycleTemplate(id, context.identity)?.subject)].filter((subject, index, all): subject is string => Boolean(subject) && all.indexOf(subject) === index).slice(0, 4);
  const rows = subjects.map((subject, index) => {
    const y = p + labelSize(context) * 2.2 + index * rowH;
    const active = index === 0;
    return `${active ? rect(p, y, w - p * 2, rowH, mixHexColors(palette.accent, surface.background, 0.82)) : ''}${hairline(p, y + rowH, w - p * 2, surface.rule)}${textBlock(context, context.identity.name, { maxHeight: rowH * 0.4, maxLines: 1, maxSize: clamp(rowH * 0.24, 9, 14), role: 'body', weight: 600, width: (w - p * 2) * 0.3, x: p + rowH * 0.25, y: y + rowH * 0.2 })}${textBlock(context, subject, { color: active ? surface.foreground : surface.secondary, field: index === 0 ? 'headline' : undefined, maxHeight: rowH * 0.4, maxLines: 1, maxSize: clamp(rowH * 0.24, 9, 14), role: 'body', width: (w - p * 2) * 0.62, x: p + (w - p * 2) * 0.34, y: y + rowH * 0.2 })}`;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, 'Inbox · lifecycle program', p, p)}${rows}`;
}

function renderWeb(context: TileContext): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const browserW = w - p * 2;
  const browserH = h - p * 2;
  const chrome = clamp(browserH * 0.07, 14, 28);
  const site = surfaceOf(context, 'paper');
  const siteContext = { ...context, surface: site };
  const inner = browserW * 0.05;
  const contentY = p + chrome;
  const navH = clamp(browserH * 0.1, 18, 40);
  const heroY = contentY + navH;
  const heroH = browserH - chrome - navH;
  const artW = tile.variant === 'product' ? browserW * 0.58 : browserW * 0.46;
  const art = tile.variant === 'product'
    ? imageArt(context, imageIds(context, 1)[0], p + browserW - artW, heroY, artW, heroH)
    : deviceArt(context, p + browserW - artW, heroY, artW, heroH, isDarkColor(site.background), 17, 'left');
  const products = tile.copy.caption.split(/\s{2,}|·|\|/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const navFont = clamp(navH * 0.32, 8, 13);
  let navX = p + browserW * 0.3;
  const nav = products.map((item) => {
    const itemW = estimateTextWidth(item, navFont, context.fonts.body.charWidth);
    if (navX + itemW > p + browserW - inner) return '';
    const markup = `<text x="${n(navX)}" y="${n(contentY + navH * 0.6)}" font-family="${escapeXml(context.fonts.body.stack)}" font-size="${n(navFont)}" fill="${site.secondary}">${escapeXml(item)}</text>`;
    navX += itemW + navFont * 2;
    return markup;
  }).join('');
  const dots = [0, 1, 2].map((index) => `<circle cx="${n(p + chrome * 0.6 + index * chrome * 0.55)}" cy="${n(p + chrome / 2)}" r="${n(chrome * 0.14)}" fill="${surface.rule}"/>`).join('');
  const textW = browserW - artW - inner * 2;
  const buttonFont = clamp(heroH * 0.045, 8, 14);
  const buttonH = buttonFont * 2.5;
  const copyStack = textStack(siteContext, p + inner, heroY + heroH * 0.14, textW, [
    { gap: heroH * 0.06, options: { field: 'headline', maxHeight: heroH * 0.44, maxLines: 3, maxSize: clamp(heroH * 0.15, 12, 56), minSize: 10, role: 'display' }, value: tile.copy.headline },
    { gap: heroH * 0.06, options: { color: site.secondary, field: 'body', maxHeight: Math.max(0, heroH * 0.78 - heroH * 0.44 - buttonH - heroH * 0.12), maxLines: 3, maxSize: clamp(heroH * 0.048, 8, 16), role: 'body' }, value: tile.copy.body },
  ]);
  const cta = getCtaLabel(identity);
  const buttonW = estimateTextWidth(cta, buttonFont, context.fonts.body.charWidth) + buttonFont * 2.4;
  const buttonY = Math.min(copyStack.bottom, heroY + heroH - inner - buttonH);
  const radius = Math.min(identity.style?.borderRadius ?? 6, 12) * 0.6;
  return `${rect(0, 0, w, h, surface.background)}${rect(p, p, browserW, browserH, site.background)}${rect(p, p, browserW, chrome, mixHexColors(site.foreground, site.background, 0.94))}${dots}<text x="${n(p + browserW / 2)}" y="${n(p + chrome * 0.66)}" text-anchor="middle" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(chrome * 0.42)}" fill="${site.secondary}">${escapeXml(identity.website)}</text>${logo(siteContext, site.background, p + inner, contentY + navH * 0.25, browserW * 0.16, navH * 0.5, { kind: 'wordmark' })}${nav}${hairline(p, heroY, browserW, site.rule)}${art}${copyStack.markup}${button(context, cta, p + inner, buttonY, buttonW, buttonH, buttonFont, radius)}`;
}

function button(context: TileContext, text: string, x: number, y: number, width: number, height: number, size: number, radius: number): string {
  const { palette } = context;
  return `${rect(x, y, width, height, palette.accent, ` rx="${n(radius)}"`)}<text x="${n(x + width / 2)}" y="${n(y + height / 2 + size * 0.36)}" text-anchor="middle" font-family="${escapeXml(context.fonts.body.stack)}" font-size="${n(size)}" font-weight="${Math.max(500, context.fonts.body.weight)}" fill="${readableOn(palette.accent, palette)}">${escapeXml(text)}</text>`;
}

function getCtaLabel(identity: BrandIdentity): string {
  return getEmailLifecycleTemplate('welcome-email', identity)?.cta ?? 'Get started';
}

function renderBadge(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  const strapH = (h - p * 2) * 0.2;
  const cardH = h - p * 2 - strapH;
  const cardW = Math.min(cardH / 1.45, w - p * 2);
  const cardX = (w - cardW) / 2;
  const cardY = p + strapH;
  const card = surfaceOf(context, 'paper');
  const cardContext = { ...context, surface: card };
  const inner = cardW * 0.09;
  const band = cardH * 0.36;
  const strap = rect(cardX + cardW * 0.4, p, cardW * 0.2, strapH + 2, palette.accent);
  return `${rect(0, 0, w, h, surface.background)}${strap}${rect(cardX, cardY, cardW, cardH, card.background)}${frame(cardX, cardY, cardW, cardH, mixHexColors(card.foreground, card.background, 0.86))}${deviceArt(context, cardX, cardY, cardW, band, true, 19)}${logo({ ...context, surface: surfaceOf(context, 'deep') }, '#000000', cardX + inner, cardY + inner, cardW * 0.34, band * 0.18)}${textBlock(cardContext, tile.copy.headline, { field: 'headline', maxHeight: cardH * 0.2, maxLines: 2, maxSize: clamp(cardW * 0.12, 10, 30), role: 'display', width: cardW - inner * 2, x: cardX + inner, y: cardY + band + inner })}${label(cardContext, tile.copy.caption, cardX + inner, cardY + band + inner + cardH * 0.2, { color: card.foreground, field: 'caption', width: cardW - inner * 2 })}${label(cardContext, tile.copy.body, cardX + inner, cardY + cardH - inner - labelSize(context), { field: 'body', width: cardW - inner * 2 })}`;
}

function renderLogo(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  if (tile.variant === 'single') {
    return `${rect(0, 0, w, h, surface.background)}${logo(context, surface.background, w * 0.2, h * 0.3, w * 0.6, h * 0.4, { align: 'middle', kind: 'wordmark' })}${label(context, tile.copy.caption, p, h - p - labelSize(context), { field: 'caption' })}`;
  }
  if (tile.variant === 'clearspace') return renderClearspace(context);
  const half = w / 2;
  const light = surfaceOf(context, 'paper');
  const dark = surfaceOf(context, contrastRatio(palette.deep, palette.paper) > 3 ? 'deep' : 'ink');
  const markW = half * 0.56;
  const markH = h * 0.3;
  return `${rect(0, 0, half, h, light.background)}${rect(half, 0, w - half, h, dark.background)}${logo({ ...context, surface: light }, light.background, (half - markW) / 2, (h - markH) / 2, markW, markH, { align: 'middle', kind: 'wordmark' })}${logo({ ...context, surface: dark }, dark.background, half + (half - markW) / 2, (h - markH) / 2, markW, markH, { align: 'middle', kind: 'wordmark' })}${label({ ...context, surface: light }, 'Primary · on light', p, p)}${label({ ...context, surface: dark }, 'Reverse · on dark', half + p, p)}${label({ ...context, surface: light }, `${palette.ink} / ${palette.paper}`, p, h - p - labelSize(context))}${label({ ...context, surface: dark }, tile.copy.caption, half + p, h - p - labelSize(context), { field: 'caption', width: half - p * 2 })}`;
}

function renderClearspace(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  const markH = h * 0.24;
  const markW = Math.min(w * 0.4, markH * 3);
  const x = (w - markW) / 2;
  const y = (h - markH) / 2;
  const unit = markH * 0.5;
  const guide = mixHexColors(palette.accent, surface.background, 0.2);
  return `${rect(0, 0, w, h, surface.background)}<rect x="${n(x - unit)}" y="${n(y - unit)}" width="${n(markW + unit * 2)}" height="${n(markH + unit * 2)}" fill="none" stroke="${guide}" stroke-dasharray="4 4"/>${rect(x - unit, y - unit, unit, unit, mixHexColors(palette.accent, surface.background, 0.75))}<text x="${n(x - unit / 2)}" y="${n(y - unit / 2 + 4)}" text-anchor="middle" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(clamp(unit * 0.35, 8, 14))}" fill="${surface.foreground}">x</text>${logo(context, surface.background, x, y, markW, markH, { align: 'middle', kind: 'wordmark' })}${label(context, `Clear space · x = ½ mark height`, p, p)}${label(context, tile.copy.caption, p, h - p - labelSize(context), { field: 'caption' })}`;
}

function renderType(context: TileContext): string {
  switch (context.tile.variant) {
    case 'scale': return renderTypeScale(context);
    case 'phrases': return renderTypePhrases(context);
    case 'pairing': return renderTypePairing(context);
    case 'charset': return renderCharset(context);
    default: return renderGlyph(context);
  }
}

/**
 * The display face on a two-column grid: family name and use top left, the
 * specimen anchored bottom left, weights and the set sample in the right column.
 */
function renderGlyph(context: TileContext): string {
  const { fonts, h, surface, tile, w } = context;
  const p = pad(context);
  const display = fonts.display;
  const weights = [...new Set(brandFontAssets(context.identity).filter((font) => font.family === display.family).flatMap((font) => (font.weightMin !== undefined && font.weightMax !== undefined ? [300, 400, 500, 700].filter((weight) => weight >= font.weightMin! && weight <= font.weightMax!) : [font.weight])))].sort((a, b) => a - b).slice(0, 4);
  const top = p + labelSize(context) * 2.2;
  const titleSize = clamp(Math.min(h * 0.09, w * 0.06), 13, 40);
  const head = textStack(context, p, top, w - p * 2, [
    { gap: titleSize * 0.35, options: { field: 'headline', maxHeight: titleSize * 1.3, maxLines: 1, maxSize: titleSize, minSize: 11, role: 'display' }, value: tile.copy.headline },
    { gap: 0, options: { color: surface.secondary, field: 'body', maxHeight: h * 0.14, maxLines: 2, maxSize: clamp(h * 0.04, 9, 15), minSize: 8, role: 'body' }, value: tile.copy.body },
  ]);
  const glyphSize = Math.min(h - head.bottom - p - labelSize(context) * 2, w * 0.34);
  const glyphY = h - p - labelSize(context) * 2.2;
  const columnX = p + Math.max(glyphSize * 1.25, (w - p * 2) * 0.5);
  const columnW = w - columnX - p;
  const sample = 'Rg 0123 &';
  const column = columnW > 80
    ? `${label(context, weights.length ? `Weights · ${weights.join(' · ')}` : `Weight · ${display.weight}`, columnX, glyphY - labelSize(context) * 3.4, { width: columnW })}${textBlock(context, sample, { maxHeight: glyphSize * 0.4, maxLines: 1, maxSize: clamp(glyphSize * 0.24, 12, 56), minSize: 10, role: 'display', width: columnW, x: columnX, y: glyphY - labelSize(context) * 3.4 - clamp(glyphSize * 0.3, 14, 70) })}`
    : '';
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${head.markup}<text x="${n(p - glyphSize * 0.04)}" y="${n(glyphY)}" font-family="${escapeXml(display.stack)}" font-size="${n(glyphSize)}" font-weight="${display.weight}" letter-spacing="${n(trackingFor(glyphSize, display.tracking))}" fill="${surface.foreground}">Aa</text>${column}${hairline(p, h - p - labelSize(context) * 1.2, w - p * 2, surface.rule)}${label(context, display.family, p, h - p - labelSize(context) * 0.2 - labelSize(context), { width: w - p * 2 })}`;
}

const TYPE_SCALE_STEPS = [
  { name: 'Display', role: 'display', step: 4 },
  { name: 'Heading', role: 'display', step: 2 },
  { name: 'Subhead', role: 'display', step: 1 },
  { name: 'Body', role: 'body', step: 0 },
  { name: 'Caption', role: 'code', step: -1 },
] as const;

function renderTypeScale(context: TileContext): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const top = p + labelSize(context) * 2.2;
  const rowsH = h - top - p;
  const ratio = 1.333;
  const steps = TYPE_SCALE_STEPS;
  const total = steps.reduce((sum, entry) => sum + Math.max(ratio ** entry.step * 1.5, 1.9), 0);
  const unit = rowsH / total;
  // Phrases belong to the voice tile; the scale sets the promise and product lines so no line repeats on the board.
  const lines = distinctLines([brandMessaging(identity).promise, ...brandProducts(identity).map(({ summary }) => summary), identity.positioning], [tile.copy.headline]);
  const texts = [tile.copy.headline, lines[0] ?? identity.name, lines[1] ?? identity.name, tile.copy.body, `${identity.website} · ${identity.socialHandle}`];
  const labelW = clamp(w * 0.17, 76, 190);
  let y = top;
  const rows = steps.map((entry, index) => {
    const rowH = unit * Math.max(ratio ** entry.step * 1.5, 1.9);
    const size = Math.min(rowH / 1.5, unit * ratio ** entry.step);
    const css = Math.round(16 * ratio ** entry.step);
    const markup = `${hairline(p, y, w - p * 2, surface.rule)}${label(context, `${entry.name} · ${css}`, p, y + Math.min(rowH * 0.3, labelSize(context) * 1.2), { width: labelW - 8 })}${textBlock(context, texts[index] ?? '', { field: index === 0 ? 'headline' : index === 3 ? 'body' : undefined, maxHeight: rowH * 0.95, maxLines: 1, maxSize: size, minSize: Math.min(size, 8), role: entry.role, width: w - p * 2 - labelW, x: p + labelW, y: y + (rowH - size) * 0.5 })}`;
    y += rowH;
    return markup;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${rows}`;
}

/** The first candidates that differ from each other and from lines already on the tile. */
function distinctLines(candidates: ReadonlyArray<string | undefined>, used: readonly string[]): string[] {
  const seen = new Set(used.map((line) => line.trim().toLocaleLowerCase()));
  return candidates.flatMap((candidate) => {
    const line = candidate?.trim();
    if (!line || seen.has(line.toLocaleLowerCase())) return [];
    seen.add(line.toLocaleLowerCase());
    return [line];
  });
}

function renderTypePhrases(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${textBlock(context, tile.copy.headline, { field: 'headline', maxHeight: h * 0.5, maxLines: 3, maxSize: clamp(h * 0.18, 16, 84), role: 'display', width: w - p * 2, x: p, y: p + labelSize(context) * 2.6 })}${textBlock(context, tile.copy.body, { anchor: 'bottom', color: surface.secondary, field: 'body', maxHeight: h * 0.28, maxLines: 3, maxSize: clamp(h * 0.07, 11, 30), role: 'accent', width: w - p * 2, x: p, y: h - p })}`;
}

function renderTypePairing(context: TileContext): string {
  const { fonts, h, identity, surface, w } = context;
  const p = pad(context);
  const half = (h - p * 2) / 2;
  return `${rect(0, 0, w, h, surface.background)}${label(context, `Display · ${fonts.display.family}`, p, p)}${textBlock(context, brandMessaging(identity).promise || identity.tagline, { maxHeight: half * 0.62, maxLines: 2, maxSize: clamp(half * 0.32, 14, 52), role: 'display', width: w - p * 2, x: p, y: p + labelSize(context) * 2.2 })}${hairline(p, p + half, w - p * 2, surface.rule)}${label(context, `Body · ${fonts.body.family}`, p, p + half + labelSize(context))}${textBlock(context, identity.positioning || identity.mission, { color: surface.secondary, maxHeight: half * 0.7, maxLines: 5, maxSize: clamp(half * 0.09, 9, 17), role: 'body', width: w - p * 2, x: p, y: p + half + labelSize(context) * 3.2 })}`;
}

function renderCharset(context: TileContext): string {
  const { fonts, h, surface, tile, w } = context;
  const p = pad(context);
  const lines = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '0123456789 &?!'];
  const size = clamp(Math.min((h - p * 2 - labelSize(context) * 3) / (lines.length * 1.18), (w - p * 2) / 8.4), 10, 64);
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption || `${fonts.display.family} · character set`, p, p, { field: 'caption' })}<text font-family="${escapeXml(fonts.display.stack)}" font-size="${n(size)}" font-weight="${fonts.display.weight}" letter-spacing="${n(size * 0.02)}" fill="${surface.foreground}">${lines.map((line, index) => `<tspan x="${n(p)}" y="${n(p + labelSize(context) * 2.4 + size * (0.84 + index * 1.18))}">${escapeXml(line)}</tspan>`).join('')}</text>${label(context, `${fonts.code.family} · { const locale = "en-US"; }`, p, h - p - labelSize(context))}`;
}

type PaletteShare = { color: string; name: string; share: number };

function paletteShares(context: TileContext): PaletteShare[] {
  const { identity, palette } = context;
  const name = (hex: string, fallback: string) => identity.colors?.find((color) => color.hex.toUpperCase() === hex.toUpperCase())?.name ?? fallback;
  const darkLed = isDarkColor(resolveSurfaceForIdentity(context));
  const dominant = darkLed ? palette.deep : palette.paper;
  const support = darkLed ? palette.paper : palette.ink;
  return [
    { color: dominant, name: name(dominant, 'Dominant'), share: 60 },
    { color: support, name: name(support, 'Support'), share: 25 },
    { color: palette.accent, name: name(palette.accent, 'Accent'), share: 10 },
    { color: palette.secondary, name: name(palette.secondary, 'Signal'), share: 5 },
  ];
}

function resolveSurfaceForIdentity(context: TileContext): string {
  const preview = context.identity.artDirection?.moodboard;
  return ['cinematic-field', 'modular-proof', 'utility-current'].includes(preview ?? '') ? context.palette.deep : context.palette.paper;
}

function renderPalette(context: TileContext): string {
  switch (context.tile.variant) {
    case 'swatches': return renderSwatches(context);
    case 'pairs': return renderPairs(context);
    case 'tints': return renderTints(context);
    default: return renderProportion(context);
  }
}

/**
 * Colour in proportion as one composed field: the dominant colour takes most of
 * the tile, support and accent nest inside it, so 60 / 30 / 10 is visible at a glance.
 */
function renderProportion(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  const shares = paletteShares(context);
  const top = p + labelSize(context) * 2.2;
  const areaX = p;
  const areaY = top;
  const areaW = w - p * 2;
  const areaH = h - top - p;
  const wide = areaW / areaH >= 1.4;
  const [dominant, support, accent, signal] = shares as [PaletteShare, PaletteShare, PaletteShare, PaletteShare];
  // Dominant fills the field; support takes a slab; accent and signal sit inside the support slab.
  const supportW = wide ? areaW * 0.36 : areaW;
  const supportH = wide ? areaH : areaH * 0.38;
  const supportX = wide ? areaX + areaW - supportW : areaX;
  const supportY = wide ? areaY : areaY + areaH - supportH;
  const accentW = wide ? supportW * 0.42 : supportW * 0.3;
  const accentH = wide ? supportH * 0.34 : supportH;
  const accentX = wide ? supportX : supportX + supportW - accentW;
  const accentY = wide ? supportY + supportH - accentH : supportY;
  const signalW = accentW * 0.34;
  const blocks = [
    { color: dominant.color, h: areaH, share: dominant, w: areaW, x: areaX, y: areaY },
    { color: support.color, h: supportH, share: support, w: supportW, x: supportX, y: supportY },
    { color: accent.color, h: accentH, share: accent, w: accentW, x: accentX, y: accentY },
    { color: signal.color, h: accentH, share: signal, w: signalW, x: accentX + accentW - signalW, y: accentY },
  ];
  const big = clamp(Math.min(areaW, areaH) * 0.2, 16, 88);
  const markup = blocks.map((block, index) => {
    const text = readableOn(block.color, palette);
    const framed = contrastRatio(block.color, surface.background) < 1.25 && index === 0 ? frame(block.x, block.y, block.w, block.h, surface.rule) : '';
    const size = index === 0 ? big : index === 1 ? big * 0.62 : big * 0.36;
    const textX = block.x + clamp(size * 0.35, 6, 22);
    const roomy = block.w > size * 2.6 && block.h > size * 1.6;
    const figure = roomy ? `<text x="${n(textX)}" y="${n(block.y + clamp(size * 0.35, 6, 22) + size * 0.82)}" font-family="${escapeXml(context.fonts.display.stack)}" font-size="${n(size)}" font-weight="${context.fonts.display.weight}" letter-spacing="${n(trackingFor(size, context.fonts.display.tracking))}" fill="${text}">${block.share.share}%</text>` : '';
    const name = roomy && block.w > 90 ? `${label({ ...context, surface: { ...surface, background: block.color, foreground: text, secondary: text } }, `${block.share.name} · ${block.color}`, textX, block.y + clamp(size * 0.35, 6, 22) + size * 1.25, { color: text, width: block.w - (textX - block.x) * 2 })}` : '';
    return `${rect(block.x, block.y, block.w, block.h, block.color)}${framed}${figure}${name}`;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${markup}`;
}

function renderSwatches(context: TileContext): string {
  const { h, identity, palette, surface, w } = context;
  const p = pad(context);
  const colors = (identity.colors ?? []).slice(0, 8);
  const columns = Math.min(4, Math.max(1, colors.length));
  const rows = Math.ceil(colors.length / columns);
  const gap = p * 0.4;
  const top = p + labelSize(context) * 2.2;
  const cellW = (w - p * 2 - gap * (columns - 1)) / columns;
  const cellH = (h - top - p - gap * (rows - 1)) / Math.max(1, rows);
  const cells = colors.map((color, index) => {
    const x = p + (index % columns) * (cellW + gap);
    const y = top + Math.floor(index / columns) * (cellH + gap);
    const text = readableOn(color.hex, palette);
    const cellSurface = { background: color.hex, foreground: text, rule: text, secondary: mixHexColors(text, color.hex, 0.25) };
    const cellContext = { ...context, surface: cellSurface, w: cellW, h: cellH };
    return `${rect(x, y, cellW, cellH, color.hex)}${contrastRatio(color.hex, surface.background) < 1.25 ? frame(x, y, cellW, cellH, surface.rule) : ''}${textBlock(cellContext, color.name, { maxHeight: cellH * 0.3, maxLines: 1, maxSize: clamp(cellH * 0.14, 9, 18), role: 'body', weight: 500, width: cellW - 16, x: x + 10, y: y + 10 })}${label(cellContext, color.hex, x + 10, y + cellH - 10 - labelSize(context), { color: cellSurface.secondary, width: cellW - 16 })}`;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, 'Palette · roles', p, p)}${cells}`;
}

/** Approved text pairs that pass, plus one labelled pair to avoid. */
function renderPairs(context: TileContext): string {
  const { h, palette, surface, w } = context;
  const p = pad(context);
  const candidates: Array<[string, string]> = [
    [palette.ink, palette.paper],
    [palette.paper, palette.deep],
    [readableOn(palette.accent, palette), palette.accent],
    [palette.accent, palette.paper],
    [palette.ink, palette.muted],
    [palette.secondary, palette.deep],
    [palette.highlight, palette.paper],
    [palette.paper, palette.accent],
  ];
  const unique = candidates.filter(([foreground, background], index) => candidates.findIndex(([f, b]) => f === foreground && b === background) === index && foreground !== background);
  const passing = unique.filter(([foreground, background]) => contrastRatio(foreground, background) >= 4.5).slice(0, 5);
  const avoid = unique.filter(([foreground, background]) => contrastRatio(foreground, background) < 3).sort((left, right) => contrastRatio(left[0], left[1]) - contrastRatio(right[0], right[1]))[0];
  const cells = avoid ? [...passing, avoid] : passing;
  const columns = w > h * 1.6 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(cells.length / columns));
  const gap = p * 0.35;
  const top = p + labelSize(context) * 2.2;
  const cellW = (w - p * 2 - gap * (columns - 1)) / columns;
  const cellH = (h - top - p - gap * (rows - 1)) / rows;
  const markup = cells.map(([foreground, background], index) => {
    const x = p + (index % columns) * (cellW + gap);
    const y = top + Math.floor(index / columns) * (cellH + gap);
    const ratio = contrastRatio(foreground, background);
    const isAvoid = avoid !== undefined && index === cells.length - 1;
    const size = clamp(cellH * 0.42, 12, 48);
    const meta = clamp(cellH * 0.12, 8, 12);
    const tag = isAvoid ? `Avoid · ${ratio.toFixed(1)}:1` : `${ratio.toFixed(1)}:1 ${wcagRating(ratio)}`;
    const tagColor = isAvoid ? readableOn(background, palette) : foreground;
    const strike = isAvoid ? `<path d="M${n(x)} ${n(y + cellH)}L${n(x + cellW)} ${n(y)}" stroke="${tagColor}" stroke-opacity=".35"/>` : '';
    return `${rect(x, y, cellW, cellH, background)}${contrastRatio(background, surface.background) < 1.25 ? frame(x, y, cellW, cellH, surface.rule) : ''}${strike}<text x="${n(x + 10)}" y="${n(y + 8 + size * 0.85)}" font-family="${escapeXml(context.fonts.display.stack)}" font-size="${n(size)}" font-weight="${context.fonts.display.weight}" fill="${foreground}">Aa</text><text x="${n(x + cellW - 10)}" y="${n(y + cellH - 10)}" text-anchor="end" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(meta)}" fill="${tagColor}">${tag}</text>`;
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, 'Text pairs that pass WCAG 2.2 · one to avoid', p, p)}${markup}`;
}

function renderTints(context: TileContext): string {
  const { h, palette, surface, w } = context;
  const p = pad(context);
  const ramps = [
    { base: palette.accent, name: 'Accent' },
    { base: palette.ink, name: 'Ink' },
  ];
  const top = p + labelSize(context) * 2.2;
  const rampH = (h - top - p - labelSize(context) * 1.6) / ramps.length;
  const steps = 9;
  const stepW = (w - p * 2) / steps;
  const markup = ramps.map((ramp, rampIndex) => {
    const y = top + rampIndex * (rampH + labelSize(context) * 0.8);
    return Array.from({ length: steps }, (_, index) => {
      const amount = (index - 4) / 5;
      const color = amount < 0 ? mixHexColors(ramp.base, '#FFFFFF', -amount) : mixHexColors(ramp.base, '#000000', amount);
      const text = readableOn(color, palette);
      return `${rect(p + index * stepW, y, stepW, rampH - labelSize(context) * 0.8, color)}<text x="${n(p + index * stepW + 6)}" y="${n(y + rampH - labelSize(context) * 1.4)}" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(clamp(labelSize(context) * 0.9, 8, 11))}" fill="${text}">${(index + 1) * 100}</text>`;
    }).join('') + label(context, ramp.name, p, y - labelSize(context) * 0.2 - 2, { color: surface.secondary });
  }).join('');
  return `${rect(0, 0, w, h, surface.background)}${label(context, 'Tonal ramps', p, p)}${markup}`;
}

function renderDevice(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const dark = isDarkColor(surface.background);
  if (tile.variant === 'crops') {
    const gap = p * 0.5;
    const cropW = (w - p * 2 - gap * 2) / 3;
    const cropH = h - p * 2 - labelSize(context) * 2.2;
    return `${rect(0, 0, w, h, surface.background)}${[0, 1, 2].map((index) => deviceArt(context, p + index * (cropW + gap), p, cropW, cropH, index !== 1 ? dark : !dark, 30 + index)).join('')}${label(context, tile.copy.headline, p, h - p - labelSize(context), { field: 'headline' })}`;
  }
  if (tile.variant === 'construction') return renderConstruction(context);
  return `${deviceArt(context, 0, 0, w, h, dark)}${label(context, tile.copy.headline, p, h - p - labelSize(context), { color: dark ? '#FFFFFF' : surface.foreground, field: 'headline' })}`;
}

function renderConstruction(context: TileContext): string {
  const { h, palette, surface, tile, w } = context;
  const p = pad(context);
  const horizontal = splitHorizontally(context);
  const artW = horizontal ? w * 0.58 : w;
  const artH = horizontal ? h : h * 0.56;
  const dark = isDarkColor(surface.background);
  const gridColor = dark ? '#FFFFFF' : palette.ink;
  const columns = 6;
  const grid = Array.from({ length: columns - 1 }, (_, index) => rect((artW / columns) * (index + 1), 0, 1, artH, gridColor, ' fill-opacity=".14"')).join('')
    + Array.from({ length: 3 }, (_, index) => rect(0, (artH / 4) * (index + 1), artW, 1, gridColor, ' fill-opacity=".14"')).join('');
  const textX = horizontal ? artW + p : p;
  const textY = horizontal ? p : artH + p * 0.8;
  const textW = (horizontal ? w - artW : w) - p * 2;
  const available = h - textY - p;
  const stack = textStack(context, textX, textY, textW, [
    { gap: labelSize(context) * 0.9, options: { color: surface.secondary, field: 'caption', maxHeight: labelSize(context) * 1.3, maxLines: 1, maxSize: labelSize(context), role: 'code', uppercase: true }, value: tile.copy.caption },
    { gap: labelSize(context) * 0.9, options: { field: 'headline', maxHeight: available * 0.36, maxLines: 2, maxSize: clamp(Math.min(w, h) * 0.085, 13, 34), role: 'display' }, value: tile.copy.headline },
  ]);
  const body = textBlock(context, tile.copy.body, { color: surface.secondary, field: 'body', maxHeight: Math.max(0, h - p - stack.bottom), maxLines: 6, maxSize: clamp(Math.min(w, h) * 0.038, 9, 15), minSize: 8, role: 'body', width: textW, x: textX, y: stack.bottom });
  return `${rect(0, 0, w, h, surface.background)}${deviceArt(context, 0, 0, artW, artH, dark, 2)}${grid}${stack.markup}${body}`;
}

function renderImagery(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  const count = tile.variant === 'triptych' ? 3 : tile.variant === 'pair' ? 2 : 1;
  const ids = imageIds(context, count);
  if (count === 1) {
    return `${rect(0, 0, w, h, surface.background)}${imageArt(context, ids[0], 0, 0, w, h - labelSize(context) * 3)}${label(context, artAsset(context, ids[0] ?? '')?.label ?? tile.copy.caption, p * 0.6, h - labelSize(context) * 2)}`;
  }
  const gap = p * 0.4;
  const captionH = labelSize(context) * 2.6;
  const imageW = (w - p * 2 - gap * (count - 1)) / count;
  const imageH = h - p * 2 - captionH;
  return `${rect(0, 0, w, h, surface.background)}${ids.map((assetId, index) => {
    const x = p + index * (imageW + gap);
    return `${imageArt(context, assetId, x, p, imageW, imageH)}${label(context, `${String(index + 1).padStart(2, '0')}  ${artAsset(context, assetId)?.label ?? ''}`, x, p + imageH + labelSize(context) * 0.9, { width: imageW })}`;
  }).join('')}`;
}

function renderVoice(context: TileContext): string {
  const { h, identity, palette, surface, tile, w } = context;
  const p = pad(context);
  if (tile.variant === 'dodont') {
    const half = (w - p * 3) / 2;
    const say = identity.voice?.phrases?.slice(0, 3) ?? [];
    const avoid = identity.voice?.avoid?.slice(0, 3) ?? [];
    const rowH = (h - p * 2 - labelSize(context) * 3) / 3;
    const column = (items: readonly string[], x: number, mark: string, color: string) => items.map((item, index) => `<text x="${n(x)}" y="${n(p + labelSize(context) * 3 + index * rowH + clamp(rowH * 0.24, 10, 18))}" font-family="${escapeXml(context.fonts.code.stack)}" font-size="${n(clamp(rowH * 0.22, 10, 16))}" fill="${color}">${mark}</text>${textBlock(context, item, { maxHeight: rowH * 0.9, maxLines: 3, maxSize: clamp(rowH * 0.24, 10, 22), role: index === 0 && mark === '✓' ? 'display' : 'body', width: half - clamp(rowH * 0.3, 14, 28), x: x + clamp(rowH * 0.3, 14, 28), y: p + labelSize(context) * 3 + index * rowH })}`).join('');
    const avoidColor = contrastRatio(palette.highlight, surface.background) > 3 ? palette.highlight : surface.secondary;
    return `${rect(0, 0, w, h, surface.background)}${label(context, 'We say', p, p)}${label(context, 'We avoid', p * 2 + half, p)}${rect(p * 1.5 + half, p, 1, h - p * 2, surface.rule)}${column(say, p, '✓', surface.foreground)}${column(avoid, p * 2 + half, '✕', avoidColor)}`;
  }
  const quoteSize = clamp(Math.min(w * 0.08, h * 0.16), 16, 72);
  const quoteRole: FontRole = context.fonts.accent.monospace ? 'display' : 'accent';
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}<text x="${n(p - quoteSize * 0.05)}" y="${n(p + labelSize(context) * 2.4 + quoteSize * 1.05)}" font-family="${escapeXml(context.fonts[quoteRole].stack)}" font-size="${n(quoteSize * 1.4)}" fill="${surface.foreground}" fill-opacity=".9">“</text>${textBlock(context, tile.copy.headline, { field: 'headline', maxHeight: h * 0.5, maxLines: 4, maxSize: quoteSize, minSize: 13, role: quoteRole, width: w - p * 2, x: p, y: p + labelSize(context) * 2.4 + quoteSize * 1.15 })}${textBlock(context, tile.copy.body, { anchor: 'bottom', color: surface.secondary, field: 'body', maxHeight: h * 0.18, maxLines: 2, maxSize: clamp(h * 0.045, 9, 15), role: 'body', width: w - p * 2, x: p, y: h - p })}`;
}

function renderProof(context: TileContext): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const items = [tile.copy.headline, ...tile.copy.body.split('\n')].map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const numeric = items.some((item) => /\d/.test(item));
  // Single-word entries are customer names; phrases are proof statements.
  const customers = (context.assets.proofAssets?.length ?? 0) >= 3 || items.every((item) => !/\s/.test(item));
  if (tile.variant === 'list' || !numeric) return renderProofList(context, items, customers && !numeric ? 'Trusted by' : tile.copy.caption || 'Proof');
  const lead = items[0] ?? identity.tagline;
  const rest = items.slice(1, 4);
  const leadSize = clamp(Math.min(h * 0.24, w * 0.14), 18, 96);
  const rowH = labelSize(context) * 2.4;
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${textBlock(context, lead, { field: 'headline', maxHeight: h - p * 2 - labelSize(context) * 2.4 - rest.length * rowH - rowH * 0.5, maxLines: 2, maxSize: leadSize, minSize: 14, role: 'display', width: w - p * 2, x: p, y: p + labelSize(context) * 2.4 })}${rest.map((item, index) => `${hairline(p, h - p - (rest.length - index) * rowH, w - p * 2, surface.rule)}${label(context, item, p, h - p - (rest.length - index) * rowH + rowH * 0.3, { color: surface.foreground })}`).join('')}`;
}

/** Customer names or proof statements as an evenly set roster. */
function renderProofList(context: TileContext, items: readonly string[], heading: string): string {
  const { h, identity, surface, tile, w } = context;
  const p = pad(context);
  const names = items.length > 1 ? items : [...brandProofStatements(identity), ...brandCustomers(identity)].slice(0, 6);
  const logos = (context.assets.proofAssets ?? []).slice(0, 6);
  const top = p + labelSize(context) * 2.4;
  if (logos.length >= 3 && tile.variant !== 'list') {
    const columns = w > h ? 3 : 2;
    const rows = Math.ceil(logos.length / columns);
    const cellW = (w - p * 2) / columns;
    const cellH = (h - top - p) / rows;
    const onDark = isDarkColor(surface.background);
    const invert = onDark ? `<defs><filter id="${context.id('invert')}" color-interpolation-filters="sRGB"><feColorMatrix values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter></defs>` : '';
    return `${rect(0, 0, w, h, surface.background)}${invert}${label(context, heading, p, p)}${logos.map((asset, index) => {
      const x = p + (index % columns) * cellW;
      const y = top + Math.floor(index / columns) * cellH;
      return `${hairline(x, y, cellW - 8, surface.rule)}<image href="${escapeXml(asset.path)}" x="${n(x + cellW * 0.12)}" y="${n(y + cellH * 0.3)}" width="${n(cellW * 0.7)}" height="${n(cellH * 0.4)}" preserveAspectRatio="xMidYMid meet"${onDark ? ` filter="url(#${context.id('invert')})"` : ''}/>`;
    }).join('')}`;
  }
  const rowH = (h - top - p) / Math.max(1, names.length);
  return `${rect(0, 0, w, h, surface.background)}${label(context, heading, p, p)}${names.map((item, index) => `${hairline(p, top + index * rowH, w - p * 2, surface.rule)}${textBlock(context, item, { field: index === 0 ? 'headline' : undefined, maxHeight: rowH * 0.8, maxLines: 1, maxSize: clamp(rowH * 0.42, 10, 34), role: 'display', width: w - p * 2, x: p, y: top + index * rowH + rowH * 0.22 })}`).join('')}`;
}

function parseBezier(curve: string): [number, number, number, number] {
  const values = curve.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (values.length >= 4 && values.every(Number.isFinite)) return [values[0]!, values[1]!, values[2]!, values[3]!];
  return [0.22, 1, 0.36, 1];
}

function renderMotion(context: TileContext): string {
  const { h, identity, palette, surface, tile, w } = context;
  const p = pad(context);
  if (tile.variant === 'frames') {
    const frames = 5;
    const gap = p * 0.3;
    const frameW = (w - p * 2 - gap * (frames - 1)) / frames;
    const frameH = Math.min(frameW * 0.75, h - p * 2 - labelSize(context) * 4);
    const duration = identity.motion?.[0]?.durationMs ?? 900;
    return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.headline, p, p, { field: 'headline' })}${Array.from({ length: frames }, (_, index) => {
      const x = p + index * (frameW + gap);
      const y = p + labelSize(context) * 2.2;
      return `${deviceArt(context, x, y, frameW, frameH, isDarkColor(surface.background), 40 + index)}${label(context, `${Math.round((duration * index) / (frames - 1))} ms`, x, y + frameH + labelSize(context) * 0.8, { width: frameW })}`;
    }).join('')}`;
  }
  const [x1, y1, x2, y2] = parseBezier(identity.motion?.[0]?.curve ?? '');
  const graphSize = Math.min(h - p * 2 - labelSize(context) * 2.4, w * 0.48);
  const gx = p;
  const gy = p + labelSize(context) * 2.4;
  const point = (x: number, y: number) => `${n(gx + x * graphSize)} ${n(gy + graphSize - y * graphSize)}`;
  const textX = gx + graphSize + p;
  const textW = w - textX - p;
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${frame(gx, gy, graphSize, graphSize, surface.rule)}<path d="M${point(0, 0)}L${point(x1, y1)}M${point(1, 1)}L${point(x2, y2)}" stroke="${surface.secondary}" stroke-dasharray="3 3"/><path d="M${point(0, 0)}C${point(x1, y1)} ${point(x2, y2)} ${point(1, 1)}" fill="none" stroke="${palette.accent === surface.background ? surface.foreground : palette.accent}" stroke-width="${n(clamp(graphSize * 0.012, 2, 4))}"/><circle cx="${n(gx + x1 * graphSize)}" cy="${n(gy + graphSize - y1 * graphSize)}" r="4" fill="${surface.foreground}"/><circle cx="${n(gx + x2 * graphSize)}" cy="${n(gy + graphSize - y2 * graphSize)}" r="4" fill="${surface.foreground}"/>${textW > 80 ? `${textBlock(context, tile.copy.headline, { field: 'headline', maxHeight: h * 0.22, maxLines: 2, maxSize: clamp(h * 0.08, 13, 36), role: 'display', width: textW, x: textX, y: gy })}${textBlock(context, tile.copy.body, { color: surface.secondary, field: 'body', maxHeight: h * 0.4, maxLines: 5, maxSize: clamp(h * 0.04, 9, 15), role: 'body', width: textW, x: textX, y: gy + h * 0.22 })}` : ''}`;
}

function renderStatement(context: TileContext): string {
  const { h, surface, tile, w } = context;
  const p = pad(context);
  return `${rect(0, 0, w, h, surface.background)}${label(context, tile.copy.caption, p, p, { field: 'caption' })}${textBlock(context, tile.copy.headline, { field: 'headline', maxHeight: h * 0.5, maxLines: 4, maxSize: clamp(Math.min(h * 0.14, w * 0.1), 16, 64), minSize: 13, role: 'display', width: w - p * 2, x: p, y: p + labelSize(context) * 2.6 })}${textBlock(context, tile.copy.body, { anchor: 'bottom', color: surface.secondary, field: 'body', maxHeight: h * 0.3, maxLines: 5, maxSize: clamp(h * 0.04, 9, 16), role: 'body', width: w - p * 2, x: p, y: h - p })}`;
}

const TILE_RENDERERS: Record<MoodboardTile['kind'], (context: TileContext) => string> = {
  badge: renderBadge,
  billboard: renderBillboard,
  card: renderCard,
  cover: renderCover,
  device: renderDevice,
  email: renderEmail,
  imagery: renderImagery,
  logo: renderLogo,
  motion: renderMotion,
  palette: renderPalette,
  poster: renderPoster,
  proof: renderProof,
  social: renderSocial,
  statement: renderStatement,
  type: renderType,
  voice: renderVoice,
  web: renderWeb,
};

export type MoodboardTileRenderOptions = {
  assets: MoodboardSvgAssets;
  height: number;
  identity: BrandIdentity;
  /** Unique per document instance so IDs never collide between tiles or boards. */
  scope: string;
  tile: MoodboardTile;
  width: number;
};

/** Inner markup for one tile in its own coordinate space (0..width, 0..height). */
export function renderMoodboardTile(options: MoodboardTileRenderOptions): MoodboardTileRender {
  const palette = brandPalette(options.identity);
  const slots: MoodboardTextSlot[] = [];
  const scope = `${options.scope}-${options.tile.id}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const context: TileContext = {
    assets: options.assets,
    fonts: moodboardFonts(options.identity),
    h: options.height,
    id: (name) => `${scope}-${name}`,
    identity: options.identity,
    images: moodboardImageAssetIds(options.identity),
    palette,
    slots,
    surface: brandSurface(palette, options.tile.tone),
    tile: options.tile,
    w: options.width,
  };
  const body = TILE_RENDERERS[options.tile.kind](context);
  const filter = treatmentFilter(context);
  return { markup: `${filter ? `<defs>${filter}</defs>` : ''}${body}`, slots };
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type MoodboardLayout = {
  board: MoodboardBoard;
  frame: MoodboardRect;
  height: number;
  masthead: MoodboardRect;
  tiles: Array<{ rect: MoodboardRect; tile: MoodboardTile }>;
  width: number;
};

const BOARD_METRICS: Record<MoodboardComposition, { gap: number; margin: number; masthead: number }> = {
  campaign: { gap: 16, margin: 40, masthead: 52 },
  catalog: { gap: 18, margin: 48, masthead: 64 },
  showcase: { gap: 16, margin: 40, masthead: 52 },
  specimen: { gap: 20, margin: 56, masthead: 72 },
  system: { gap: 20, margin: 56, masthead: 72 },
};

export function boardColors(identity: BrandIdentity, surface: MoodboardBoard['surface']) {
  const palette = brandPalette(identity);
  const background = surface === 'dark'
    ? mixHexColors(isDarkColor(palette.deep) ? palette.deep : palette.ink, '#000000', 0.35)
    : mixHexColors(palette.muted, palette.ink, 0.06);
  const foreground = readableOn(background, palette);
  return { background, foreground, secondary: mixHexColors(foreground, background, 0.4) };
}

export function layoutMoodboard(
  identity: BrandIdentity,
  composition: MoodboardComposition,
  overrides?: MoodboardOverrides
): MoodboardLayout {
  const board = resolveMoodboardBoard(identity, composition, overrides);
  const { height, width } = MOODBOARD_BOARD_SIZES[composition];
  const metrics = BOARD_METRICS[composition];
  const masthead = { height: metrics.masthead, width: width - metrics.margin * 2, x: metrics.margin, y: metrics.margin };
  const catalogExtras = composition === 'catalog' ? catalogSectionsHeight(identity) : 0;
  const frame = {
    height: height - metrics.margin * 2 - metrics.masthead - catalogExtras,
    width: width - metrics.margin * 2,
    x: metrics.margin,
    y: metrics.margin + metrics.masthead,
  };
  return { board, frame, height, masthead, tiles: layoutMoodboardTiles(board.tiles, frame, metrics.gap), width };
}

function mastheadMarkup(identity: BrandIdentity, layout: MoodboardLayout): string {
  const colors = boardColors(identity, layout.board.surface);
  const fonts = moodboardFonts(identity);
  const { masthead } = layout;
  const baseline = masthead.y + masthead.height * 0.42;
  const size = layout.width >= 1600 && masthead.height > 60 ? 22 : 18;
  const index = { campaign: '02', catalog: '05', showcase: '01', specimen: '04', system: '03' }[layout.board.composition];
  return `<g class="moodboard-masthead"><text x="${masthead.x}" y="${baseline}" font-family="${escapeXml(fonts.display.stack)}" font-size="${size}" font-weight="${fonts.display.weight}" letter-spacing="${n(trackingFor(size, fonts.display.tracking))}" fill="${colors.foreground}">${escapeXml(identity.name)}<tspan fill="${colors.secondary}" font-family="${escapeXml(fonts.body.stack)}" font-weight="${fonts.body.weight}" letter-spacing="0" data-field="title">  /  ${escapeXml(layout.board.title)}</tspan></text><text x="${masthead.x + masthead.width}" y="${baseline}" text-anchor="end" font-family="${escapeXml(fonts.code.stack)}" font-size="11" letter-spacing=".9" fill="${colors.secondary}">${escapeXml(`BOARD ${index} · REV ${identity.revision ?? 1} · ${identity.website}`.toLocaleUpperCase())}</text><rect x="${masthead.x}" y="${masthead.y + masthead.height - 18}" width="${masthead.width}" height="1" fill="${colors.secondary}" fill-opacity=".45"/></g>`;
}

const CATALOG_SOURCE_ROW = 112;
const CATALOG_SOURCE_COLUMNS = 6;

function catalogSectionsHeight(identity: BrandIdentity): number {
  const sources = Math.max(1, Math.ceil(moodboardImageAssetIds(identity).length / CATALOG_SOURCE_COLUMNS));
  const applications = Math.max(1, Math.ceil((identity.applications?.length ?? 0) / 3));
  return 40 + sources * (CATALOG_SOURCE_ROW + 12) + 64 + applications * 92;
}

function catalogSections(identity: BrandIdentity, assets: MoodboardSvgAssets, layout: MoodboardLayout, scope: string): string {
  const colors = boardColors(identity, layout.board.surface);
  const palette = brandPalette(identity);
  const fonts = moodboardFonts(identity);
  const x = layout.frame.x;
  const width = layout.frame.width;
  let y = layout.frame.y + layout.frame.height + 40;
  const sourceIds = moodboardImageAssetIds(identity);
  const heading = (text: string) => `<text x="${x}" y="${y}" font-family="${escapeXml(fonts.code.stack)}" font-size="11" letter-spacing="1.4" fill="${colors.secondary}">${escapeXml(text.toLocaleUpperCase())}</text>`;
  let markup = heading(`All source assets · ${sourceIds.length}`);
  y += 16;
  const cellW = (width - 12 * (CATALOG_SOURCE_COLUMNS - 1)) / CATALOG_SOURCE_COLUMNS;
  markup += `<g data-panel="source-catalog">${sourceIds.map((assetId, index) => {
    const asset = assets.artAssets?.find((candidate) => candidate.id === assetId);
    const cx = x + (index % CATALOG_SOURCE_COLUMNS) * (cellW + 12);
    const cy = y + Math.floor(index / CATALOG_SOURCE_COLUMNS) * (CATALOG_SOURCE_ROW + 12);
    const image = asset ? `<image href="${escapeXml(asset.path)}" x="6" y="6" width="${n(cellW - 12)}" height="${CATALOG_SOURCE_ROW - 36}" preserveAspectRatio="xMidYMid meet"/>` : '';
    return `<g class="source-asset" data-asset="${escapeXml(assetId)}" transform="translate(${n(cx)} ${n(cy)})">${rect(0, 0, cellW, CATALOG_SOURCE_ROW, palette.paper)}${image}<text x="8" y="${CATALOG_SOURCE_ROW - 10}" font-family="${escapeXml(fonts.code.stack)}" font-size="9" fill="${palette.ink}">${escapeXml((asset?.label ?? assetId).toLocaleUpperCase().slice(0, 34))}</text></g>`;
  }).join('')}</g>`;
  y += Math.max(1, Math.ceil(sourceIds.length / CATALOG_SOURCE_COLUMNS)) * (CATALOG_SOURCE_ROW + 12) + 40;
  markup += heading(`All generated applications · ${identity.applications?.length ?? 0}`);
  y += 16;
  const appW = (width - 16 * 2) / 3;
  markup += `<g data-panel="application-catalog">${(identity.applications ?? []).map((application, index) => {
    const ax = x + (index % 3) * (appW + 16);
    const ay = y + Math.floor(index / 3) * 92;
    return `<g class="generated-application" data-application="${escapeXml(application.id)}" transform="translate(${n(ax)} ${n(ay)})">${rect(0, 0, appW, 80, palette.paper)}${rect(0, 0, 4, 80, palette.accent)}<text x="20" y="24" font-family="${escapeXml(fonts.code.stack)}" font-size="9" fill="${mixHexColors(palette.ink, palette.paper, 0.4)}">${escapeXml(`${String(index + 1).padStart(2, '0')} / ${application.category} / ${application.format}`.toLocaleUpperCase().slice(0, 60))}</text><text x="20" y="48" font-family="${escapeXml(fonts.display.stack)}" font-size="17" font-weight="${fonts.display.weight}" fill="${palette.ink}">${escapeXml(application.name)}</text><text x="20" y="67" font-family="${escapeXml(fonts.body.stack)}" font-size="10.5" fill="${mixHexColors(palette.ink, palette.paper, 0.35)}">${escapeXml(application.description.slice(0, 96))}${application.description.length > 96 ? '…' : ''}</text></g>`;
  }).join('')}</g>`;
  return `<g data-catalog-scope="${escapeXml(scope)}">${markup}</g>`;
}

export function moodboardFontFaceCss(identity: BrandIdentity, sources: ReadonlyMap<string, string>): string {
  return brandFontAssets(identity).map((font) => {
    const source = sources.get(font.path);
    if (!source) return '';
    const weight = font.weightMin !== undefined && font.weightMax !== undefined ? `${font.weightMin} ${font.weightMax}` : String(font.weight);
    return `@font-face{font-family:'${font.family.replaceAll("'", '')}';src:url('${escapeXml(source)}');font-style:${font.style};font-weight:${weight};font-display:block;}`;
  }).join('');
}

function legacyFontFaces(identity: BrandIdentity, assets: MoodboardSvgAssets): string {
  const fonts = moodboardFonts(identity);
  const rule = (font: FontSpec, source: string | undefined) => (source ? `@font-face{font-family:'${font.family.replaceAll("'", '')}';src:url('${escapeXml(source)}');font-style:normal;font-weight:100 900;font-display:block;}` : '');
  return [
    rule(fonts.display, assets.displayFont),
    rule(fonts.body, assets.bodyFont ?? assets.displayFont),
    rule(fonts.accent, assets.accentFont ?? assets.displayFont),
    rule(fonts.code, assets.codeFont ?? assets.bodyFont ?? assets.displayFont),
  ].join('');
}

/** Default asset paths (URLs) for a live preview. Exports replace them with data URLs. */
export function moodboardPreviewAssets(identity: BrandIdentity, artAssets: MoodboardSvgAssets['artAssets']): MoodboardSvgAssets {
  return {
    artAssets,
    markDark: brandAssetPath(identity, 'mark-dark'),
    markLight: brandAssetPath(identity, 'mark-light'),
    proofAssets: (identity.proofAssets ?? []).filter((asset) => asset.type === 'proof'),
    wordmark: brandAssetPath(identity, 'wordmark'),
    wordmarkLight: brandAssetPath(identity, 'wordmark-light'),
  };
}

/**
 * The complete board as one standalone SVG document: masthead, every visible
 * tile clipped to its grid cell, and (for the catalog) the source and
 * application indexes.
 */
export function buildMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  composition: MoodboardComposition,
  overrides?: MoodboardOverrides,
  scope = `mb-${identity.id}-${composition}`,
  options: { tiles?: boolean } = {}
): string {
  const layout = layoutMoodboard(identity, composition, overrides);
  if (options.tiles === false) layout.tiles = [];
  const colors = boardColors(identity, layout.board.surface);
  const resolvedAssets: MoodboardSvgAssets = {
    ...assets,
    markDark: assets.markDark ?? assets.logoMarks?.[0],
    markLight: assets.markLight ?? assets.logoMarks?.[1],
  };
  const tiles = layout.tiles.map(({ rect: tileRect, tile }) => {
    const rendered = renderMoodboardTile({ assets: resolvedAssets, height: tileRect.height, identity, scope, tile, width: tileRect.width });
    return `<svg class="application-panel ${tile.kind}-panel" data-panel="${tile.kind}" data-tile="${escapeXml(tile.id)}" data-variant="${escapeXml(tile.variant)}" x="${tileRect.x}" y="${tileRect.y}" width="${tileRect.width}" height="${tileRect.height}" viewBox="0 0 ${tileRect.width} ${tileRect.height}" overflow="hidden"><title>${escapeXml(MOODBOARD_TILE_LABELS[tile.kind])}</title>${rendered.markup}</svg>`;
  }).join('');
  const fontFaces = assets.fontFaceCss ?? legacyFontFaces(identity, assets);
  const catalog = composition === 'catalog' ? catalogSections(identity, resolvedAssets, layout, scope) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" data-board-mode="${composition}" data-board-recipe="${escapeXml(identity.artDirection?.moodboard ?? 'modular-proof')}" data-brand="${escapeXml(identity.id)}">
<defs>${fontFaces ? `<style>${fontFaces}</style>` : ''}</defs>
<rect width="${layout.width}" height="${layout.height}" fill="${colors.background}"/>
${mastheadMarkup(identity, layout)}
${tiles}${catalog}
</svg>`;
}
