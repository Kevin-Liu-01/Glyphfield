import type { BrandIdentity } from './brandIdentity';
import type { CanvasDocument } from './canvasDocument';
import { pageFontAssetIds } from './expressionExport';
import {
  activeCodeTab,
  elementComponent,
  expressionAsset,
  pageElements,
  patchElement,
  readLockupPartners,
  resolveExpressionFormat,
  slotElement,
  withAssets,
  type ExpressionToolKind,
} from './expressionModel';
import { hashString, setCodeTab, setSlideItems } from './expressionSource';
import {
  buildExpressionPageSvg,
  defaultFontFamily,
  estimateTextWidth,
  quoteFontFamily,
  type ExpressionFontFace,
  type TextMeasure,
} from './expressionSvg';
import { createExpressionDocument, expressionColors, setPageSurface } from './expressionTemplates';
import { assetArtworkLookup } from './expressionType';
import { choosePartner, setBackgroundImage, setLegacySurface, setLockupPartner } from './expressionToolOperations';

/**
 * Deterministic, DOM-free expression templates for /api/generate. The same
 * brand templates and renderer as the Studio, with fonts and images embedded so
 * a standalone SVG renders correctly in a plain <img>.
 */

export type ExpressionGenerationInput = {
  background?: string;
  backgroundImageDataUrl?: string | null;
  body?: string;
  foreground?: string;
  format?: string;
  identity: BrandIdentity;
  language?: string;
  layout?: string;
  partnerId?: string;
  partnerLogoDataUrl?: string | null;
  template: ExpressionToolKind;
  texture?: 'dark' | 'grid' | 'noise' | 'white';
  title?: string;
};

/** Larger fonts are not embedded; the fallback stack keeps the SVG small and sans. */
const MAX_EMBEDDED_FONT_CHARACTERS = 560_000;

/**
 * Width of each brand family against the generic estimate, measured in Chromium
 * on the Studio's own font files. Keeps DOM-free line breaks close to the browser's.
 */
const FONT_WIDTH_FACTORS: Readonly<Record<string, number>> = {
  'APK Protocol': 0.923,
  'Apercu Mono Pro': 1.273,
  'Arizona Flare': 0.932,
  'Basement Grotesque': 1.114,
  'FT Kunst Grotesk': 0.935,
  Flauta: 1.609,
  Geist: 0.969,
  'Geist Mono': 1.232,
  'IBM Plex Mono': 1.232,
  Inter: 1.012,
  'Instrument Serif': 0.762,
  'KH Teka Mono': 1.273,
  Lausanne: 0.954,
  'Mintlify Geist Mono': 1.232,
  'Mintlify Inter': 0.928,
  'Paper Mono': 1.242,
  'Rasmus Inter': 1.012,
  Sohne: 0.945,
  'Source Code Pro': 1.173,
  Switzer: 0.95,
};

export const calibratedTextWidth: TextMeasure = (text, font) => estimateTextWidth(text, font) * (FONT_WIDTH_FACTORS[font.family] ?? 1);

function applyTitle(document: CanvasDocument, pageId: string, title: string | undefined): CanvasDocument {
  if (title === undefined) return document;
  const headline = slotElement(document, pageId, 'title') ?? slotElement(document, pageId, 'headline');
  return headline ? patchElement(document, headline.id, { content: title }) : document;
}

function applyBody(document: CanvasDocument, input: ExpressionGenerationInput, pageId: string): CanvasDocument {
  if (input.body === undefined) return document;
  if (input.template === 'slides') {
    return setSlideItems(document, pageId, input.body.split('\n').map((item) => item.trim()).filter(Boolean), input.identity);
  }
  const code = pageElements(document, pageId).find((element) => elementComponent(element) === 'code');
  const tab = code ? activeCodeTab(code) : null;
  if (code && tab) return setCodeTab(document, code.id, tab.id, { code: input.body });
  const dek = slotElement(document, pageId, 'dek');
  return dek ? patchElement(document, dek.id, { content: input.body }) : document;
}

function applyLanguage(document: CanvasDocument, pageId: string, language: string | undefined): CanvasDocument {
  if (language === undefined) return document;
  const code = pageElements(document, pageId).find((element) => elementComponent(element) === 'code');
  const tab = code ? activeCodeTab(code) : null;
  return code && tab ? setCodeTab(document, code.id, tab.id, { language }) : document;
}

function applyPartner(document: CanvasDocument, input: ExpressionGenerationInput, pageId: string): CanvasDocument {
  const lockup = pageElements(document, pageId).find((element) => elementComponent(element) === 'lockup');
  const partner = lockup ? readLockupPartners(lockup)[1] : undefined;
  if (!lockup || !partner) return document;
  if (input.partnerLogoDataUrl) {
    const assetId = `upload:${hashString(input.partnerLogoDataUrl)}`;
    const next = withAssets(document, [expressionAsset(assetId, 'Partner logo', input.partnerLogoDataUrl)]);
    return setLockupPartner(next, lockup.id, partner.id, {
      aspect: dataUrlAspect(input.partnerLogoDataUrl) ?? 2.6,
      assetId,
      kind: 'logo',
      label: 'Partner',
      sourceId: undefined,
    });
  }
  return input.partnerId ? choosePartner(document, lockup.id, partner.id, input.partnerId, input.identity) : document;
}

function applyColors(document: CanvasDocument, input: ExpressionGenerationInput, pageId: string): CanvasDocument {
  let next = document;
  if (input.background) next = setPageSurface(next, pageId, input.background.toUpperCase(), input.identity);
  if (!input.foreground) return next;
  for (const element of pageElements(next, pageId)) {
    if (element.kind === 'text') next = patchElement(next, element.id, { data: { fill: input.foreground.toUpperCase() }, textStyle: { color: input.foreground.toUpperCase() } });
  }
  return next;
}

export function buildExpressionGenerationDocument(input: ExpressionGenerationInput): CanvasDocument {
  const format = input.format ? resolveExpressionFormat(input.template, input.format) : undefined;
  let document = createExpressionDocument(input.template, input.identity, {
    deck: input.template === 'slides' ? [{ layout: input.layout ?? 'title' }] : undefined,
    format,
    layout: input.template === 'slides' ? undefined : input.layout,
  });
  const pageId = document.pageIds[0]!;
  if (input.texture) document = setLegacySurface(document, pageId, input.texture, input.identity);
  document = applyTitle(document, pageId, input.title);
  document = applyBody(document, input, pageId);
  document = applyLanguage(document, pageId, input.language);
  document = applyPartner(document, input, pageId);
  if (input.backgroundImageDataUrl) {
    document = setBackgroundImage(document, pageId, { name: 'Background image', type: 'upload', url: input.backgroundImageDataUrl }, input.identity);
  }
  return applyColors(document, input, pageId);
}

/** Local public files (images, logos, fonts) the renderer needs as data URLs. */
export function expressionGenerationAssetPaths(document: CanvasDocument): string[] {
  const pageId = document.pageIds[0]!;
  const fonts = new Set(pageFontAssetIds(document, pageId));
  const used = new Set<string>();
  for (const element of pageElements(document, pageId)) {
    if (element.hidden) continue;
    if (element.assetId) used.add(element.assetId);
    if (elementComponent(element) === 'lockup') readLockupPartners(element).forEach(({ assetId }) => assetId && used.add(assetId));
  }
  return [...new Set([...used, ...fonts].flatMap((id) => {
    const source = document.assets[id]?.source;
    return source?.startsWith('/') ? [source] : [];
  }))];
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const MAX_SVG_TAG_LENGTH = 8 * 1024;

function skipUntil(text: string, index: number, terminator: string): number {
  const end = text.indexOf(terminator, index);
  return end < 0 ? -1 : end + terminator.length;
}

function skipDeclaration(text: string, index: number): number {
  let close = text.indexOf('>', index);
  let bracket = -1;
  for (let scan = index; close >= 0 && scan < close; scan += 1) {
    if (text[scan] === '[') {
      bracket = scan;
      break;
    }
  }
  if (bracket >= 0) {
    const subsetEnd = text.indexOf(']', bracket + 1);
    if (subsetEnd < 0) return -1;
    close = text.indexOf('>', subsetEnd + 1);
  }
  return close < 0 ? -1 : close + 1;
}

function skipProlog(text: string): number {
  let index = 0;
  const advance = () => {
    while (index < text.length && /\s/.test(text[index]!)) index += 1;
    if (text.charCodeAt(index) === 0xFEFF) index += 1;
  };
  const next = () => {
    if (text.startsWith('<?', index)) return skipUntil(text, index + 2, '?>');
    if (text.startsWith('<!--', index)) return skipUntil(text, index + 4, '-->');
    if (text.startsWith('<![CDATA[', index)) return skipUntil(text, index + 9, ']]>');
    if (text.startsWith('<!', index)) return skipDeclaration(text, index + 2);
    return index;
  };
  advance();
  for (;;) {
    const end = next();
    if (end < 0) return -1;
    if (end === index) return index;
    index = end;
    advance();
  }
}

function svgTagEnd(text: string, index: number): number {
  let quote = '';
  for (let position = index + 4; position < text.length; position += 1) {
    const character = text[position]!;
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return position + 1;
    }
    if (position - index >= MAX_SVG_TAG_LENGTH) return -1;
  }
  return -1;
}

/**
 * The root <svg> start tag. Walks the XML prolog once — whitespace, a leading
 * BOM, declarations, comments, CDATA and the DOCTYPE — then returns the start
 * tag if the first element is `svg`. Everything stays linear: each skip jumps
 * to a terminator and never rescans, and the tag scan tracks quote state so a
 * quoted `>` cannot end it early.
 */
function rootSvgTag(text: string): string | null {
  const index = skipProlog(text);
  if (index < 0) return null;
  if (!text.startsWith('<svg', index)) return null;
  const next = text.charAt(index + 4);
  if (next !== '' && next !== '>' && next !== '/' && !/\s/.test(next)) return null;
  const end = svgTagEnd(text, index);
  return end > 0 ? text.slice(index, end) : null;
}

/** Width / height of an SVG or PNG data URL, read without decoding the image. */
export function dataUrlAspect(source: string): number | null {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(source);
  if (!match) return null;
  const [, mime, base64, payload] = match;
  try {
    if (mime === 'image/svg+xml') {
      const text = base64 ? new TextDecoder().decode(base64Bytes(payload!)) : decodeURIComponent(payload!);
      const tag = rootSvgTag(text);
      if (!tag) return null;
      const viewBox = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(tag);
      if (viewBox && Number(viewBox[2]) > 0) return Number(viewBox[1]) / Number(viewBox[2]);
      const width = /\swidth=["']([\d.]+)/.exec(tag);
      const height = /\sheight=["']([\d.]+)/.exec(tag);
      return width && height && Number(height[1]) > 0 ? Number(width[1]) / Number(height[1]) : null;
    }
    if (mime === 'image/png' && base64) {
      const bytes = base64Bytes(payload!.slice(0, 64));
      const view = new DataView(bytes.buffer);
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      return height > 0 ? width / height : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function renderExpressionGeneration(
  document: CanvasDocument,
  identity: BrandIdentity,
  assets: Readonly<Record<string, string>>
): { content: string; height: number; width: number } {
  const pageId = document.pageIds[0]!;
  const page = document.pages[pageId]!;
  const resolve = (assetId: string | undefined) => {
    const source = assetId ? document.assets[assetId]?.source : undefined;
    if (!source) return null;
    return source.startsWith('/') ? assets[source] ?? null : source;
  };
  const fonts: ExpressionFontFace[] = [];
  const aliases = new Map<string, string>();
  for (const id of pageFontAssetIds(document, pageId)) {
    const source = resolve(id);
    if (!source || source.length > MAX_EMBEDDED_FONT_CHARACTERS) continue;
    const alias = `x${hashString(id)}`;
    aliases.set(id, alias);
    fonts.push({ family: alias, source });
  }
  const content = buildExpressionPageSvg(document, pageId, {
    assetArtwork: assetArtworkLookup(document.assets),
    assetAspect: (assetId) => {
      const source = resolve(assetId);
      return source ? dataUrlAspect(source) : null;
    },
    assetSource: resolve,
    colors: expressionColors(identity),
    fontFamily: (assetId, family) => {
      const alias = assetId ? aliases.get(assetId) : undefined;
      return alias ? `${quoteFontFamily(alias)}, ${defaultFontFamily(assetId, family)}` : defaultFontFamily(assetId, family);
    },
    greetings: identity.greetings,
    idPrefix: 'g',
    measure: calibratedTextWidth,
    pageCount: 1,
    pageIndex: 0,
    products: identity.products,
    proof: identity.proof,
  }, fonts);
  return { content, height: page.height, width: page.width };
}
