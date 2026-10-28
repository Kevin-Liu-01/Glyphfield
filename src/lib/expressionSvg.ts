import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';

import type { CanvasDocument, CanvasElement } from './canvasDocument';
import { layoutCanvasText } from './canvasText';
import { colorContrastRatio, mixHexColors } from './color';
import { escapeXml } from './download';
import { isExpressionDevice, renderExpressionDevice } from './expressionDevices';
import { inkAspect, placeInk, type LogoArtwork } from './expressionType';
import {
  activeCodeTab,
  dataBoolean,
  dataNumber,
  dataString,
  elementComponent,
  pageElements,
  readCodeTabs,
  readLockupPartners,
  readNumberArray,
  readStringArray,
  resolveExpressionColor,
  type CodeTab,
} from './expressionModel';
import { buildLogoSvgFilter, DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from './logoAppearance';
import { terminalLanguageIcon } from './terminalLanguageIcon';

/**
 * One pure renderer for every expression layer. The editor draws each layer
 * with `renderExpressionElement`; export joins the same fragments in
 * `buildExpressionPageSvg`, so the canvas and the file cannot drift.
 */

export type TextMeasure = (text: string, font: { family: string; size: number; weight: number }) => number;

export type ExpressionRenderContext = {
  /** Width / height of an image asset when known; SVG-in-SVG alignment needs exact boxes. */
  assetAspect?: (assetId: string | undefined) => number | null;
  /** Bundled logo artwork (aspect and visible ink) for an asset, so marks are sized by their ink. */
  assetArtwork?: (assetId: string | undefined) => LogoArtwork | null;
  assetSource: (assetId: string | undefined) => string | null;
  colors: Readonly<Record<string, string>>;
  /** Returns the CSS font-family list for a text style's font asset. */
  fontFamily: (fontAssetId: string | undefined, family: string) => string;
  greetings: readonly string[];
  /** Unique prefix for SVG ids; inline previews share one HTML document. */
  idPrefix: string;
  measure: TextMeasure;
  pageCount: number;
  pageIndex: number;
  products: readonly string[];
  proof: readonly string[];
};

const FALLBACK_STACK = 'Inter, "Helvetica Neue", Arial, sans-serif';
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Inherited by every glyph of a layer, in the editor and in exported files:
 * kerning on and the font's kern feature on. Optical size is set per text run
 * from its export size (see `renderText`), because Chrome lays SVG text out at
 * the on-screen size and automatic optical sizing would follow the zoom.
 */
export const EXPRESSION_TEXT_STYLE = "font-kerning:normal;font-feature-settings:'kern' 1";

/** Width estimate for DOM-free generation; the browser passes canvas metrics. */
export const estimateTextWidth: TextMeasure = (text, { size, weight }) => {
  const boldness = 1 + Math.max(0, weight - 400) / 2000;
  let width = 0;
  for (const character of text) {
    if (/\s/.test(character)) width += 0.28;
    else if (/[ilI.,'’!|:;]/.test(character)) width += 0.27;
    else if (/[MW@%#&mw]/.test(character)) width += 0.84;
    else if (/[A-Z0-9$]/.test(character)) width += 0.62;
    else if (/[　-鿿가-힯]/.test(character)) width += 1;
    else width += 0.52;
  }
  return width * size * boldness;
};

export function quoteFontFamily(family: string): string {
  return /[",]/.test(family) ? family : `"${family}"`;
}

const MONO_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const SERIF_STACK = 'Georgia, "Times New Roman", serif';

/** Brand family first, then a fallback of the same kind so a missing font never lands on Times. */
export function defaultFontFamily(_fontAssetId: string | undefined, family: string): string {
  const fallback = /mono|code/i.test(family) ? MONO_STACK : /serif|flare|garamond|tiempos/i.test(family) && !/sans/i.test(family) ? SERIF_STACK : FALLBACK_STACK;
  return `${quoteFontFamily(family)}, ${fallback}`;
}

function uid(context: ExpressionRenderContext, element: CanvasElement, suffix: string): string {
  return `${context.idPrefix}-${element.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${suffix}`;
}

function attributeFamily(value: string): string {
  return escapeXml(value);
}

// ---------------------------------------------------------------------------
// Text

export type ExpressionTextLayout = {
  fontSize: number;
  height: number;
  lineHeight: number;
  lines: string[];
  overflow: boolean;
  top: number;
};

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

export function resolveTextTokens(value: string, context: Pick<ExpressionRenderContext, 'pageCount' | 'pageIndex'>): string {
  return value
    .replaceAll('{page}', padded(context.pageIndex + 1))
    .replaceAll('{pages}', padded(context.pageCount));
}

function applyCasing(value: string, casing: string | undefined): string {
  if (casing === 'uppercase') return value.toLocaleUpperCase();
  if (casing === 'lowercase') return value.toLocaleLowerCase();
  return value;
}

export function layoutExpressionText(element: CanvasElement, context: ExpressionRenderContext): ExpressionTextLayout {
  const style = element.textStyle;
  const bounds = element.bounds;
  if (!style) return { fontSize: 0, height: 0, lineHeight: 0, lines: [], overflow: false, top: bounds.y };
  const text = applyCasing(resolveTextTokens(element.content ?? '', context), style.casing);
  const fit = dataString(element, 'fit') === 'shrink';
  const maxLines = dataNumber(element, 'maxLines', 0);
  const valign = dataString(element, 'valign', 'top');
  let fontSize = Math.max(4, style.fontSize);
  const minimum = Math.max(8, fontSize * 0.4);
  let lines: string[] = [];
  let lineHeight = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const size = fontSize;
    const tracking = style.letterSpacing * size;
    const measureLine = (line: string) => context.measure(line, { family: style.fontFamily, size, weight: style.fontWeight })
      + Math.max(0, [...line].length - 1) * tracking;
    lines = layoutCanvasText(text, bounds.width, () => 0, 0, 'wrap', measureLine);
    lineHeight = size * style.lineHeight;
    const fitsHeight = lines.length * lineHeight <= bounds.height + 0.5;
    const fitsLines = !maxLines || lines.length <= maxLines;
    if (!fit || (fitsHeight && fitsLines) || fontSize <= minimum) break;
    fontSize = Math.max(minimum, fontSize - Math.max(1, fontSize * 0.04));
  }
  const height = lines.length * lineHeight;
  const top = valign === 'middle'
    ? bounds.y + (bounds.height - height) / 2
    : valign === 'bottom'
      ? bounds.y + bounds.height - height
      : bounds.y;
  return {
    fontSize: round(fontSize),
    height: round(height),
    lineHeight: round(lineHeight),
    lines,
    overflow: height > bounds.height + 1 || Boolean(maxLines && lines.length > maxLines),
    top: round(top),
  };
}

function textFill(element: CanvasElement, context: ExpressionRenderContext): string {
  return resolveExpressionColor(dataString(element, 'fill') || undefined, context.colors, element.textStyle?.color ?? '#000000');
}

function renderText(element: CanvasElement, context: ExpressionRenderContext): string {
  const style = element.textStyle;
  if (!style) return '';
  const layout = layoutExpressionText(element, context);
  const fill = textFill(element, context);
  const family = attributeFamily(context.fontFamily(style.fontId, style.fontFamily));
  const anchor = style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start';
  const x = style.align === 'center'
    ? element.bounds.x + element.bounds.width / 2
    : style.align === 'right' ? element.bounds.x + element.bounds.width : element.bounds.x;
  const tracking = round(style.letterSpacing * layout.fontSize);
  const partnerFamily = dataString(element, 'partnerFontFamily');
  const partnerFontId = dataString(element, 'partnerFontAssetId') || undefined;
  const partnerWeight = dataNumber(element, 'partnerFontWeight', style.fontWeight);
  const features = [
    `font-variation-settings:'opsz' ${round(layout.fontSize)}`,
    dataBoolean(element, 'tabular', false) ? 'font-variant-numeric:tabular-nums' : '',
    // Capitals get the font's capital spacing where it has one (Inter's cpsp).
    style.casing === 'uppercase' ? "font-feature-settings:'kern' 1,'cpsp' 1" : '',
  ].filter(Boolean).join(';');
  const tabular = ` style="${features}"`;
  return layout.lines.map((line, index) => {
    const baseline = round(layout.top + index * layout.lineHeight + layout.lineHeight / 2 + layout.fontSize * 0.35);
    const parts = partnerFamily ? line.split(/(\s*×\s*)/) : [line];
    const content = parts.length === 3 && parts[2]
      ? `<tspan>${escapeXml(parts[0]!)}</tspan><tspan opacity="0.42">${escapeXml(parts[1]!)}</tspan><tspan data-partner-run="true" font-family="${attributeFamily(context.fontFamily(partnerFontId, partnerFamily))}" font-weight="${partnerWeight}">${escapeXml(parts[2])}</tspan>`
      : escapeXml(line);
    return `<text x="${round(x)}" y="${baseline}" fill="${fill}" font-family="${family}" font-size="${layout.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${tracking}" text-anchor="${anchor}" xml:space="preserve"${tabular}>${content}</text>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Images, logos, shapes, textures, shaders

function alignedAspect(element: CanvasElement, mode: 'meet' | 'slice' | 'none'): string {
  if (mode === 'none') return 'none';
  const focal = element.imageTreatment?.focalPoint ?? { x: 0.5, y: 0.5 };
  const align = dataString(element, 'align');
  const horizontal = align === 'start' ? 'xMin' : align === 'end' ? 'xMax' : focal.x < 0.34 ? 'xMin' : focal.x > 0.66 ? 'xMax' : 'xMid';
  const vertical = focal.y < 0.34 ? 'YMin' : focal.y > 0.66 ? 'YMax' : 'YMid';
  return `${horizontal}${vertical} ${mode}`;
}

function treatmentFilter(id: string, treatment: string, context: ExpressionRenderContext): string {
  if (treatment === 'monochrome') {
    return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.08" intercept="-.04"/><feFuncG type="linear" slope="1.08" intercept="-.04"/><feFuncB type="linear" slope="1.08" intercept="-.04"/></feComponentTransfer></filter>`;
  }
  if (treatment === 'duotone' || treatment === 'brand') {
    const dark = treatment === 'brand' ? context.colors.ink ?? '#111111' : '#1B1440';
    const light = treatment === 'brand' ? context.colors.emphasis ?? '#FFFFFF' : '#F1EEFF';
    const channel = (hex: string, offset: number) => (Number.parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255).toFixed(3);
    return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="${channel(dark, 0)} ${channel(light, 0)}"/><feFuncG type="table" tableValues="${channel(dark, 2)} ${channel(light, 2)}"/><feFuncB type="table" tableValues="${channel(dark, 4)} ${channel(light, 4)}"/></feComponentTransfer></filter>`;
  }
  return '';
}

function roundedClip(id: string, element: CanvasElement): string {
  const { height, width, x, y } = element.bounds;
  return `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(element.style.borderRadius)}"/></clipPath>`;
}

function renderImage(element: CanvasElement, context: ExpressionRenderContext, source: string | null, defaultTreatment: string): string {
  if (!source) return '';
  const fit = element.imageTreatment?.objectFit ?? 'cover';
  const mode = fit === 'contain' ? 'meet' : fit === 'fill' ? 'none' : 'slice';
  const treatment = dataString(element, 'treatment', defaultTreatment);
  const filterId = uid(context, element, 'treatment');
  const clipId = uid(context, element, 'clip');
  const filter = treatmentFilter(filterId, treatment, context);
  const { height, width, x, y } = element.bounds;
  // Zoom and pan move the picture inside its frame; the frame stays the layer box.
  const zoom = Math.max(0.1, dataNumber(element, 'zoom', 1));
  const imageWidth = width * zoom;
  const imageHeight = height * zoom;
  const imageX = x + (width - imageWidth) / 2 + dataNumber(element, 'panX', 0) * width;
  const imageY = y + (height - imageHeight) / 2 + dataNumber(element, 'panY', 0) * height;
  return `<defs>${filter}${roundedClip(clipId, element)}</defs><g clip-path="url(#${clipId})"><image href="${escapeXml(source)}" x="${round(imageX)}" y="${round(imageY)}" width="${round(imageWidth)}" height="${round(imageHeight)}" preserveAspectRatio="${alignedAspect(element, mode)}"${filter ? ` filter="url(#${filterId})"` : ''}/></g>`;
}

function readAppearance(element: CanvasElement): LogoAppearanceSettings | null {
  const value = element.data.appearance;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return { ...DEFAULT_LOGO_APPEARANCE, ...(value as Partial<LogoAppearanceSettings>) };
}

function toneFilter(id: string, color: string): string {
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
}

function renderLogo(element: CanvasElement, context: ExpressionRenderContext): string {
  const source = context.assetSource(element.assetId);
  if (!source) return '';
  const tone = dataString(element, 'tone', 'original');
  const appearance = readAppearance(element);
  const filterId = uid(context, element, 'tone');
  const toneColor = resolveExpressionColor(tone === 'original' ? 'ink' : tone, context.colors, '#000000');
  const filter = appearance
    ? buildLogoSvgFilter(appearance, tone === 'original' ? (context.colors.ink ?? '#000000') : toneColor, filterId)
    : tone !== 'original' ? toneFilter(filterId, toneColor) : '';
  const artwork = context.assetArtwork?.(element.assetId) ?? null;
  const fitted = fitAsset(element.bounds, context.assetAspect?.(element.assetId) ?? artwork?.aspect ?? null, artwork, dataString(element, 'align', 'center'));
  const aspect = fitted ? 'none' : alignedAspect(element, 'meet');
  const { height, width, x, y } = fitted ?? element.bounds;
  return `${filter ? `<defs>${filter}</defs>` : ''}<image href="${escapeXml(source)}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" preserveAspectRatio="${aspect}"${filter ? ` filter="url(#${filterId})"` : ''}/>`;
}

/**
 * Fit an image of known aspect inside a box ourselves (browsers differ on
 * SVG-in-SVG alignment). Bundled logos fit by their visible ink, so padding in
 * the file never shrinks the mark.
 */
function fitAsset(box: { height: number; width: number; x: number; y: number }, aspect: number | null, artwork: LogoArtwork | null, align: string) {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return null;
  return placeInk(box, aspect, artwork?.ink ?? [0, 0, 1, 1], align === 'start' || align === 'end' ? align : 'center');
}

function renderShape(element: CanvasElement, context: ExpressionRenderContext): string {
  const shape = dataString(element, 'shape', element.kind === 'line' ? 'line' : 'rect');
  const fillValue = dataString(element, 'fill', 'ink');
  const fill = fillValue === 'none' ? 'none' : resolveExpressionColor(fillValue, context.colors, '#000000');
  const strokeValue = dataString(element, 'stroke', shape === 'line' ? fillValue : 'none');
  const stroke = strokeValue === 'none' ? 'none' : resolveExpressionColor(strokeValue, context.colors, '#000000');
  const strokeWidth = dataNumber(element, 'strokeWidth', shape === 'line' ? 1 : 0);
  const { height, width, x, y } = element.bounds;
  const strokeAttributes = stroke === 'none' || strokeWidth <= 0 ? '' : ` stroke="${stroke}" stroke-width="${round(strokeWidth)}"`;
  if (shape === 'line') {
    const color = stroke === 'none' ? fill : stroke;
    return width >= height
      ? `<line x1="${round(x)}" y1="${round(y + height / 2)}" x2="${round(x + width)}" y2="${round(y + height / 2)}" stroke="${color}" stroke-width="${round(Math.max(0.5, strokeWidth))}"/>`
      : `<line x1="${round(x + width / 2)}" y1="${round(y)}" x2="${round(x + width / 2)}" y2="${round(y + height)}" stroke="${color}" stroke-width="${round(Math.max(0.5, strokeWidth))}"/>`;
  }
  if (shape === 'ellipse') {
    return `<ellipse cx="${round(x + width / 2)}" cy="${round(y + height / 2)}" rx="${round(width / 2)}" ry="${round(height / 2)}" fill="${fill}"${strokeAttributes}/>`;
  }
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(element.style.borderRadius)}" fill="${fill}"${strokeAttributes}/>`;
}

function renderTexture(element: CanvasElement, context: ExpressionRenderContext): string {
  const texture = dataString(element, 'texture', 'grid');
  const color = resolveExpressionColor(dataString(element, 'fill', 'ink'), context.colors, '#000000');
  const step = Math.max(4, dataNumber(element, 'spacing', 40));
  const id = uid(context, element, 'pattern');
  const { height, width, x, y } = element.bounds;
  const area = `x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}"`;
  if (texture === 'noise') {
    return `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence baseFrequency="0.75" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.18"/></feComponentTransfer></filter></defs><rect ${area} filter="url(#${id})"/>`;
  }
  const path = texture === 'dots'
    ? `<circle cx="${step / 2}" cy="${step / 2}" r="${round(Math.max(0.8, step / 22))}" fill="${color}"/>`
    : texture === 'lines'
      ? `<path d="M0 ${step - 0.5}H${step}" stroke="${color}" stroke-width="1"/>`
      : texture === 'diagonal'
        ? `<path d="M0 ${step}L${step} 0" stroke="${color}" stroke-width="1"/>`
        : `<path d="M${step} 0H0V${step}" fill="none" stroke="${color}" stroke-width="1"/>`;
  return `<defs><pattern id="${id}" x="${round(x)}" y="${round(y)}" width="${step}" height="${step}" patternUnits="userSpaceOnUse">${path}</pattern></defs><rect ${area} fill="url(#${id})"/>`;
}

// ---------------------------------------------------------------------------
// Code window

type CodeTheme = {
  accent: string;
  background: string;
  border: string;
  foreground: string;
  gutter: string;
  header: string;
  muted: string;
  tokens: Record<string, string>;
};

function readable(color: string, background: string, fallback: string, minimum = 4.5): string {
  if (colorContrastRatio(color, background) >= minimum) return color;
  for (let amount = 0.15; amount <= 1; amount += 0.15) {
    const mixed = mixHexColors(color, fallback, amount);
    if (colorContrastRatio(mixed, background) >= minimum) return mixed;
  }
  return fallback;
}

function luminanceOrder(colors: readonly string[]): string[] {
  return [...colors].sort((first, second) => colorContrastRatio(second, '#FFFFFF') - colorContrastRatio(first, '#FFFFFF'));
}

export const CODE_THEMES = [
  { id: 'brand-dark', label: 'Brand dark' },
  { id: 'brand-light', label: 'Brand light' },
  { id: 'github-dark', label: 'Classic dark' },
] as const;

export function resolveCodeTheme(themeId: string, colors: Readonly<Record<string, string>>): CodeTheme {
  if (themeId === 'github-dark') {
    return {
      accent: '#A997FF',
      background: '#171717',
      border: '#2A2A2A',
      foreground: '#E6EDF3',
      gutter: '#6E7681',
      header: '#1D1D1D',
      muted: '#A3A3A3',
      tokens: { 'attr-name': '#79C0FF', boolean: '#79C0FF', builtin: '#FFA657', 'class-name': '#FFA657', comment: '#8B949E', constant: '#79C0FF', function: '#D2A8FF', keyword: '#FF7B72', number: '#79C0FF', operator: '#FF7B72', property: '#79C0FF', punctuation: '#8B949E', regex: '#A5D6FF', string: '#A5D6FF', tag: '#7EE787', variable: '#FFA657' },
    };
  }
  const ink = colors.ink ?? '#18181B';
  const paper = colors.paper ?? '#FFFFFF';
  const emphasis = colors.emphasis ?? ink;
  const success = colors.success ?? emphasis;
  const warning = colors.warning ?? emphasis;
  const progress = colors.progress ?? emphasis;
  if (themeId === 'brand-light') {
    const background = mixHexColors(colors.muted ?? paper, paper, 0.4);
    const foreground = ink;
    return {
      accent: emphasis,
      background,
      border: mixHexColors(background, ink, 0.12),
      foreground,
      gutter: mixHexColors(background, ink, 0.42),
      header: mixHexColors(background, ink, 0.04),
      muted: mixHexColors(background, ink, 0.6),
      tokens: {
        comment: readable(mixHexColors(background, ink, 0.5), background, ink, 3),
        function: readable(progress, background, ink),
        keyword: readable(emphasis, background, ink),
        number: readable(warning, background, ink),
        punctuation: readable(mixHexColors(background, ink, 0.55), background, ink, 3),
        string: readable(success, background, ink),
        tag: readable(emphasis, background, ink),
      },
    };
  }
  const [darkest] = luminanceOrder([ink, colors.error ?? ink]);
  const background = darkest ?? ink;
  const foreground = readable(paper, background, '#FFFFFF');
  return {
    accent: readable(emphasis, background, foreground, 3),
    background,
    border: mixHexColors(background, foreground, 0.12),
    foreground,
    gutter: mixHexColors(background, foreground, 0.38),
    header: mixHexColors(background, foreground, 0.04),
    muted: mixHexColors(background, foreground, 0.62),
    tokens: {
      comment: readable(mixHexColors(background, foreground, 0.45), background, foreground, 3),
      function: readable(progress, background, foreground),
      keyword: readable(emphasis, background, foreground),
      number: readable(warning, background, foreground),
      punctuation: readable(mixHexColors(background, foreground, 0.55), background, foreground, 3),
      string: readable(success, background, foreground),
      tag: readable(emphasis, background, foreground),
    },
  };
}

const TOKEN_ALIASES: Record<string, string> = {
  'attr-name': 'function',
  'attr-value': 'string',
  boolean: 'number',
  builtin: 'function',
  'class-name': 'function',
  constant: 'number',
  operator: 'punctuation',
  parameter: 'foreground',
  property: 'function',
  regex: 'string',
  'template-string': 'string',
  variable: 'foreground',
};

type CodeToken = { color: string; content: string };

export const CODE_LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'bash', label: 'Bash' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
] as const;

function grammarFor(language: string): Prism.Grammar {
  const id = language === 'html' ? 'markup' : language;
  return Prism.languages[id] ?? Prism.languages.plain ?? {};
}

function tokenColor(token: Prism.Token, inherited: string, theme: CodeTheme): string {
  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
  for (const type of [token.type, ...aliases]) {
    const direct = theme.tokens[type];
    if (direct) return direct;
    const alias = TOKEN_ALIASES[type];
    if (alias === 'foreground') return theme.foreground;
    if (alias && theme.tokens[alias]) return theme.tokens[alias]!;
  }
  return inherited;
}

export function highlightCodeLines(code: string, language: string, theme: CodeTheme): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  const push = (content: string, color: string) => {
    content.split('\n').forEach((chunk, index) => {
      if (index > 0) lines.push([]);
      if (chunk) lines.at(-1)!.push({ color, content: chunk });
    });
  };
  const walk = (value: Prism.Token | string, color: string) => {
    if (typeof value === 'string') {
      push(value, color);
      return;
    }
    const next = tokenColor(value, color, theme);
    const contents = Array.isArray(value.content) ? value.content : [value.content];
    contents.forEach((content) => walk(content, next));
  };
  Prism.tokenize(code, grammarFor(language)).forEach((token) => walk(token, theme.foreground));
  return lines;
}

function languageBadge(tab: CodeTab, x: number, y: number, size: number, theme: CodeTheme, family: string): string {
  if (tab.language === 'typescript' || tab.language === 'tsx' || tab.language === 'python' || tab.language === 'bash') {
    const icon = tab.language === 'tsx' ? 'typescript' : tab.language;
    return terminalLanguageIcon(icon, round(x), round(y), round(size));
  }
  const label = tab.language.slice(0, 2).toUpperCase();
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" rx="${round(size * 0.18)}" fill="${theme.border}"/><text x="${round(x + size / 2)}" y="${round(y + size * 0.68)}" text-anchor="middle" fill="${theme.foreground}" font-family="${family}" font-size="${round(size * 0.46)}" font-weight="600">${label}</text>`;
}

type CodeRow = { continuation: boolean; line: number; tokens: CodeToken[] };

const CODE_BREAK_AFTER = /[\s,;(){}[\]=>.+\-*/|&:]/;

/**
 * Slice highlighted tokens to the characters [start, end). `cursor` resumes
 * where the previous row ended so wrapping a line stays linear in its tokens.
 */
function sliceTokens(tokens: readonly CodeToken[], offsets: readonly number[], cursor: { index: number }, start: number, end: number): CodeToken[] {
  const result: CodeToken[] = [];
  while (cursor.index < tokens.length && offsets[cursor.index]! + tokens[cursor.index]!.content.length <= start) cursor.index += 1;
  for (let index = cursor.index; index < tokens.length && offsets[index]! < end; index += 1) {
    const token = tokens[index]!;
    const offset = offsets[index]!;
    const from = Math.max(start, offset);
    const to = Math.min(end, offset + token.content.length);
    if (to > from) result.push({ color: token.color, content: token.content.slice(from - offset, to - offset) });
  }
  return result;
}

/** Longest prefix of `rest` that fits, pulled back to a break after a space or punctuation when one is near. */
function codeCut(rest: string, prefix: string, room: number, measure: (text: string) => number): number {
  // Gallop 1, 2, 4 … until a probe overflows or the whole rest fits, then
  // binary-search inside the last interval — the same cut a full binary search
  // finds when measure is monotonic in the prefix length.
  let low = 0;
  let high = rest.length;
  for (let probe = 1; ; probe = Math.min(probe * 2, rest.length)) {
    if (measure(prefix + rest.slice(0, probe)) <= room) {
      if (probe >= rest.length) return rest.length;
      low = probe;
    } else {
      high = probe;
      break;
    }
  }
  while (low + 1 < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(prefix + rest.slice(0, middle)) <= room) low = middle;
    else high = middle;
  }
  const cut = Math.max(1, low);
  for (let back = cut; back > cut * 0.5; back -= 1) {
    if (CODE_BREAK_AFTER.test(rest[back - 1]!)) return back;
  }
  return cut;
}

function codeRow(tokens: readonly CodeToken[], offsets: readonly number[], cursor: { index: number }, line: number, prefix: string, continuation: boolean, start: number, end: number): CodeRow {
  const indent = prefix ? [{ color: tokens[0]?.color ?? '', content: prefix }] : [];
  return { continuation, line, tokens: [...indent, ...sliceTokens(tokens, offsets, cursor, start, end)] };
}

/**
 * Break each source line into rows that fit `room`, after a space or
 * punctuation when one is near, with continuation rows indented two spaces past
 * the line's own indent. Stops after `maxRows` rows (default unlimited).
 */
export function wrapCodeLines(lines: readonly CodeToken[][], room: number, measure: (text: string) => number, maxRows = Number.POSITIVE_INFINITY): CodeRow[] {
  const rows: CodeRow[] = [];
  for (const [index, tokens] of lines.entries()) {
    if (rows.length >= maxRows) break;
    const text = tokens.map(({ content }) => content).join('');
    const indent = `${/^\s*/.exec(text)![0]}  `;
    // An indent that eats most of the row would wrap one character per row.
    const continuation = measure(indent) > room / 2 ? '' : indent;
    const offsets = Array.from<number>({ length: tokens.length });
    let offset = 0;
    tokens.forEach((token, tokenIndex) => {
      offsets[tokenIndex] = offset;
      offset += token.content.length;
    });
    const cursor = { index: 0 };
    let first = true;
    let start = 0;
    do {
      const prefix = first ? '' : continuation;
      const rest = text.slice(start);
      const cut = rest.length <= 1 ? rest.length : codeCut(rest, prefix, room, measure);
      rows.push(codeRow(tokens, offsets, cursor, index + 1, prefix, !first, start, start + cut));
      first = false;
      start += cut;
      while (text[start] === ' ') start += 1;
    } while (start < text.length && rows.length < maxRows);
  }
  return rows;
}

function renderCode(element: CanvasElement, context: ExpressionRenderContext): string {
  const style = element.textStyle;
  const tabs = readCodeTabs(element);
  const active = activeCodeTab(element);
  if (!style || !active) return '';
  const theme = resolveCodeTheme(dataString(element, 'theme', 'brand-dark'), context.colors);
  const family = attributeFamily(context.fontFamily(style.fontId, style.fontFamily));
  const baseSize = style.fontSize;
  const chrome = dataString(element, 'chrome', 'tabs');
  const lineNumbers = dataBoolean(element, 'lineNumbers', true);
  const radius = element.style.borderRadius;
  const { height, width, x, y } = element.bounds;
  const header = chrome === 'none' ? 0 : round(Math.max(baseSize * 2.6, 36));
  const clipId = uid(context, element, 'clip');
  const padX = round(Math.max(baseSize * 1.6, 24));
  const tabSize = round(baseSize * 0.86);
  let headerMarkup = '';
  if (chrome === 'window') {
    headerMarkup = [0, 1, 2].map((index) => `<circle cx="${round(x + padX + index * baseSize * 1.25)}" cy="${round(y + header / 2)}" r="${round(baseSize * 0.36)}" fill="${theme.border}"/>`).join('')
      + `<text x="${round(x + width / 2)}" y="${round(y + header / 2 + tabSize * 0.36)}" text-anchor="middle" fill="${theme.muted}" font-family="${family}" font-size="${tabSize}">${escapeXml(active.name)}</text>`;
  } else if (chrome === 'tabs') {
    let cursor = x + padX * 0.5;
    headerMarkup = tabs.map((tab) => {
      const labelWidth = context.measure(tab.name, { family: style.fontFamily, size: tabSize, weight: style.fontWeight });
      const tabWidth = labelWidth + tabSize * 3.2;
      const isActive = tab.id === active.id;
      const markup = `${isActive ? `<rect x="${round(cursor)}" y="${round(y + header - 2)}" width="${round(tabWidth)}" height="2" fill="${theme.accent}"/>` : ''}${languageBadge(tab, cursor + tabSize * 0.6, y + header / 2 - tabSize * 0.55, tabSize * 1.1, theme, family)}<text x="${round(cursor + tabSize * 2.1)}" y="${round(y + header / 2 + tabSize * 0.36)}" fill="${isActive ? theme.foreground : theme.muted}" font-family="${family}" font-size="${tabSize}" font-weight="${style.fontWeight}">${escapeXml(tab.name)}</text>`;
      cursor += tabWidth + tabSize * 0.4;
      return markup;
    }).join('');
  }
  const highlighted = new Set(active.highlight);
  const lines = highlightCodeLines(active.code, active.language, theme);
  // Long lines wrap inside the window. Only when the wrapped code is taller than
  // the window does it shrink, and never below 80% of its set size.
  let size = baseSize;
  let rows: CodeRow[] = [];
  let gutter = 0;
  let lineHeight = 0;
  let visible = 1;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const font = { family: style.fontFamily, size, weight: style.fontWeight };
    const tracking = style.letterSpacing * size;
    const measure = (text: string) => context.measure(text, font) + Math.max(0, [...text].length - 1) * tracking;
    gutter = lineNumbers ? round(context.measure(String(lines.length), font) + size * 1.4) : 0;
    lineHeight = size * style.lineHeight;
    visible = Math.max(1, Math.floor((height - header - size * 1.4) / lineHeight));
    rows = wrapCodeLines(lines, width - padX * 1.5 - gutter, measure, visible + 1);
    if (rows.length <= visible || size <= baseSize * 0.8) break;
    size = Math.max(baseSize * 0.8, size * 0.95);
  }
  const top = y + header + size * 1.1;
  const tracking = round(style.letterSpacing * size);
  const body = rows.slice(0, visible).map((row, index) => {
    const lineTop = top + index * lineHeight;
    const baseline = round(lineTop + lineHeight / 2 + size * 0.35);
    const marked = highlighted.has(row.line);
    const band = marked
      ? `<rect x="${round(x)}" y="${round(lineTop)}" width="${round(width)}" height="${round(lineHeight)}" fill="${theme.accent}" opacity="0.14"/><rect x="${round(x)}" y="${round(lineTop)}" width="3" height="${round(lineHeight)}" fill="${theme.accent}"/>`
      : '';
    const number = lineNumbers && !row.continuation
      ? `<text x="${round(x + padX + gutter - size * 1.2)}" y="${baseline}" text-anchor="end" fill="${marked ? theme.foreground : theme.gutter}" font-family="${family}" font-size="${round(size)}" font-weight="${style.fontWeight}">${row.line}</text>`
      : '';
    const content = row.tokens.length > 0
      ? row.tokens.map(({ color, content: value }) => `<tspan fill="${color}">${escapeXml(value)}</tspan>`).join('')
      : ' ';
    return `${band}${number}<text x="${round(x + padX + gutter)}" y="${baseline}" fill="${theme.foreground}" font-family="${family}" font-size="${round(size)}" font-weight="${style.fontWeight}" letter-spacing="${tracking}" xml:space="preserve">${content}</text>`;
  }).join('');
  return `<defs><clipPath id="${clipId}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(radius)}"/></clipPath></defs><g clip-path="url(#${clipId})"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${theme.background}"/>${header ? `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${header}" fill="${theme.header}"/><line x1="${round(x)}" y1="${round(y + header)}" x2="${round(x + width)}" y2="${round(y + header)}" stroke="${theme.border}"/>` : ''}${headerMarkup}${body}</g><rect x="${round(x + 0.5)}" y="${round(y + 0.5)}" width="${round(width - 1)}" height="${round(height - 1)}" rx="${round(radius)}" fill="none" stroke="${theme.border}"/>`;
}

// ---------------------------------------------------------------------------
// Partnership lockup

type LockupBox = { height: number; width: number };

export function layoutLockup(element: CanvasElement, context: ExpressionRenderContext) {
  const partners = readLockupPartners(element);
  const { height, width } = element.bounds;
  const sizing = dataString(element, 'sizing', 'optical');
  const separator = dataString(element, 'separator', '×');
  const unit = height * 0.78;
  const gap = dataNumber(element, 'gap', Math.round(height * 0.22));
  const boxes: LockupBox[] = partners.map((partner) => {
    if (partner.kind === 'text') {
      const size = unit * 0.52;
      const textWidth = context.measure(partner.label, { family: partner.fontFamily ?? 'Inter', size, weight: partner.fontWeight ?? 500 });
      return { height: size, width: textWidth };
    }
    // Balance partners on the ink they show, not the padding in their files.
    const artwork = context.assetArtwork?.(partner.assetId) ?? null;
    const fileAspect = context.assetAspect?.(partner.assetId) ?? artwork?.aspect ?? partner.aspect;
    const aspect = Math.max(0.2, artwork ? inkAspect(fileAspect, artwork.ink) : fileAspect);
    if (sizing === 'height') return { height: unit * 0.62, width: unit * 0.62 * aspect };
    if (sizing === 'width') {
      const widthTarget = unit * 1.8;
      const h = Math.min(unit, widthTarget / aspect);
      return { height: h, width: h * aspect };
    }
    // Optical: equal area, so a square mark and a long wordmark carry the same weight.
    const h = Math.max(unit * 0.34, Math.min(unit, unit * 1.05 / Math.sqrt(aspect)));
    return { height: h, width: h * aspect };
  });
  const separatorWidth = separator === 'none' ? 0 : separator === '|' ? 2 : unit * 0.22;
  const separators = Math.max(0, partners.length - 1);
  const natural = boxes.reduce((sum, box) => sum + box.width, 0) + separators * (gap * 2 + separatorWidth);
  const scale = natural > width ? width / natural : 1;
  return { boxes, gap, natural, partners, scale, separator, separatorWidth, unit };
}

function renderLockup(element: CanvasElement, context: ExpressionRenderContext): string {
  const layout = layoutLockup(element, context);
  if (layout.partners.length === 0) return '';
  const { height, width, x, y } = element.bounds;
  const justify = dataString(element, 'justify', 'start');
  const verticalAlign = dataString(element, 'verticalAlign', 'center');
  const tone = dataString(element, 'tone', 'original');
  const fill = resolveExpressionColor(dataString(element, 'fill', 'ink'), context.colors, '#000000');
  const total = layout.natural * layout.scale;
  let cursor = justify === 'center' ? x + (width - total) / 2 : justify === 'end' ? x + width - total : x;
  const middle = y + height / 2;
  const toneId = uid(context, element, 'tone');
  const parts: string[] = tone === 'mono' ? [`<defs>${toneFilter(toneId, fill)}</defs>`] : [];
  layout.partners.forEach((partner, index) => {
    const box = layout.boxes[index]!;
    const w = box.width * layout.scale;
    const h = box.height * layout.scale;
    const top = verticalAlign === 'bottom'
      ? middle + layout.unit * layout.scale / 2 - h
      : verticalAlign === 'top' ? middle - layout.unit * layout.scale / 2 : middle - h / 2;
    if (partner.kind === 'text') {
      const size = round(h);
      const family = attributeFamily(context.fontFamily(partner.fontAssetId, partner.fontFamily ?? 'Inter'));
      parts.push(`<text data-lockup-partner="${escapeXml(partner.id)}" x="${round(cursor)}" y="${round(top + h * 0.82)}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${partner.fontWeight ?? 500}" letter-spacing="${round((partner.letterSpacing ?? 0) * size)}">${escapeXml(partner.label)}</text>`);
    } else {
      const source = context.assetSource(partner.assetId);
      const artwork = context.assetArtwork?.(partner.assetId) ?? null;
      const fileAspect = context.assetAspect?.(partner.assetId) ?? artwork?.aspect ?? null;
      const exact = Boolean(fileAspect && artwork);
      const placed = exact ? placeInk({ height: h, width: w, x: cursor, y: top }, fileAspect!, artwork!.ink) : { height: h, width: w, x: cursor, y: top };
      if (source) {
        parts.push(`<image data-lockup-partner="${escapeXml(partner.id)}" href="${escapeXml(source)}" x="${round(placed.x)}" y="${round(placed.y)}" width="${round(placed.width)}" height="${round(placed.height)}" preserveAspectRatio="${exact ? 'none' : 'xMidYMid meet'}"${tone === 'mono' ? ` filter="url(#${toneId})"` : ''}/>`);
      }
    }
    cursor += w;
    if (index < layout.partners.length - 1) {
      const gap = layout.gap * layout.scale;
      const center = cursor + gap + layout.separatorWidth * layout.scale / 2;
      if (layout.separator === '|') {
        parts.push(`<line x1="${round(center)}" y1="${round(middle - layout.unit * layout.scale * 0.32)}" x2="${round(center)}" y2="${round(middle + layout.unit * layout.scale * 0.32)}" stroke="${fill}" stroke-opacity="0.32" stroke-width="1.5"/>`);
      } else if (layout.separator !== 'none') {
        const size = round(layout.unit * layout.scale * 0.34);
        parts.push(`<text x="${round(center)}" y="${round(middle + size * 0.36)}" text-anchor="middle" fill="${fill}" opacity="0.42" font-family="${escapeXml(FALLBACK_STACK)}" font-size="${size}" font-weight="300">${escapeXml(layout.separator)}</text>`);
      }
      cursor += gap * 2 + layout.separatorWidth * layout.scale;
    }
  });
  return parts.join('');
}

function renderChart(element: CanvasElement, context: ExpressionRenderContext): string {
  const values = readNumberArray(element, 'values');
  const labels = readStringArray(element, 'labels');
  const fill = resolveExpressionColor(dataString(element, 'fill', 'ink'), context.colors, '#000000');
  const accent = resolveExpressionColor(dataString(element, 'accent', 'emphasis'), context.colors, fill);
  const { height, width, x, y } = element.bounds;
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const slot = width / values.length;
  const barWidth = slot * 0.58;
  const labelSize = round(Math.max(11, Math.min(18, height * 0.05)));
  const plotHeight = height - (labels.length ? labelSize * 2.4 : 0);
  const bars = values.map((value, index) => {
    const barHeight = Math.max(2, (value / max) * plotHeight);
    const bx = x + index * slot + (slot - barWidth) / 2;
    const isLast = index === values.length - 1;
    const label = labels[index]
      ? `<text x="${round(bx + barWidth / 2)}" y="${round(y + height - labelSize * 0.4)}" text-anchor="middle" fill="${fill}" opacity="0.6" font-family="${escapeXml(FALLBACK_STACK)}" font-size="${labelSize}">${escapeXml(labels[index]!)}</text>`
      : '';
    return `<rect x="${round(bx)}" y="${round(y + plotHeight - barHeight)}" width="${round(barWidth)}" height="${round(barHeight)}" fill="${isLast ? accent : fill}" opacity="${isLast ? 1 : round(0.18 + index * 0.1)}"/>${label}`;
  }).join('');
  return `<line x1="${round(x)}" y1="${round(y + plotHeight)}" x2="${round(x + width)}" y2="${round(y + plotHeight)}" stroke="${fill}" stroke-opacity="0.3"/>${bars}`;
}

// ---------------------------------------------------------------------------
// Dispatch

function renderElementBody(element: CanvasElement, context: ExpressionRenderContext): string {
  if (element.kind === 'text') return renderText(element, context);
  if (element.kind === 'image') return renderImage(element, context, context.assetSource(element.assetId), 'natural');
  if (element.kind === 'shader') return renderImage(element, context, context.assetSource(element.assetId), dataString(element, 'tint') === 'brand' ? 'brand' : 'natural');
  if (element.kind === 'logo') return renderLogo(element, context);
  if (element.kind === 'shape' || element.kind === 'line') return renderShape(element, context);
  if (element.kind === 'texture') return renderTexture(element, context);
  const component = elementComponent(element);
  if (component === 'code') return renderCode(element, context);
  if (component === 'lockup') return renderLockup(element, context);
  if (component === 'chart') return renderChart(element, context);
  if (component === 'device') {
    const device = dataString(element, 'device');
    if (!isExpressionDevice(device)) return '';
    return renderExpressionDevice(device, element.bounds, {
      colors: context.colors,
      fontFamily: attributeFamily(context.fontFamily(element.textStyle?.fontId, element.textStyle?.fontFamily ?? 'Inter')),
      items: device === 'greetings' ? context.greetings : context.products,
      proof: context.proof,
      uid: uid(context, element, 'device'),
    });
  }
  return '';
}

export function renderExpressionElement(element: CanvasElement, context: ExpressionRenderContext): string {
  if (element.hidden) return '';
  const body = renderElementBody(element, context);
  if (!body) return '';
  const { height, rotation, width, x, y } = element.bounds;
  const transform = rotation ? ` transform="rotate(${round(rotation)} ${round(x + width / 2)} ${round(y + height / 2)})"` : '';
  const opacity = element.style.opacity < 1 ? ` opacity="${round(element.style.opacity)}"` : '';
  const blend = element.style.blendMode !== 'normal' ? `;mix-blend-mode:${element.style.blendMode}` : '';
  return `<g data-element-id="${escapeXml(element.id)}"${transform}${opacity} style="${EXPRESSION_TEXT_STYLE}${blend}">${body}</g>`;
}

export type ExpressionFontFace = { family: string; source: string };

export function expressionFontFaceCss(fonts: readonly ExpressionFontFace[]): string {
  return fonts
    .map(({ family, source }) => `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(source)});font-weight:100 900;font-style:normal;font-display:block;}`)
    .join('');
}

export function buildExpressionPageSvg(
  document: CanvasDocument,
  pageId: string,
  context: ExpressionRenderContext,
  fonts: readonly ExpressionFontFace[] = []
): string {
  const page = document.pages[pageId];
  if (!page) throw new RangeError(`Unknown page ${pageId}.`);
  const body = pageElements(document, pageId).map((element) => renderExpressionElement(element, context)).join('');
  const style = fonts.length > 0 ? `<defs><style><![CDATA[${expressionFontFaceCss(fonts)}]]></style></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">${style}<rect width="${page.width}" height="${page.height}" fill="${page.background}"/>${body}</svg>`;
}
