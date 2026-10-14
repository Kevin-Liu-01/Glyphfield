import type { CanvasDocument } from './canvasDocument';
import { imageUrlToDataUrl, resolveSvgRasterDimensions } from './download';
import { elementComponent, pageElements, readLockupPartners } from './expressionModel';
import { hashString } from './expressionSource';
import { assetArtworkLookup } from './expressionType';
import {
  buildExpressionPageSvg,
  defaultFontFamily,
  quoteFontFamily,
  type ExpressionFontFace,
  type ExpressionRenderContext,
  type TextMeasure,
} from './expressionSvg';

/**
 * Artifact creation for expression documents: a self-contained SVG per page
 * (embedded images and fonts), PNG rasters of that SVG, and a multi-page PDF
 * for slide decks. Browser-only except for the pure PDF writer.
 */

const MEASURE_CACHE_LIMIT = 8000;

export function createCanvasTextMeasure(): TextMeasure {
  const cache = new Map<string, number>();
  let context: CanvasRenderingContext2D | null = null;
  return (text, { family, size, weight }) => {
    const key = `${family}\u0000${size}\u0000${weight}\u0000${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    context ??= document.createElement('canvas').getContext('2d');
    if (!context) return text.length * size * 0.5;
    context.font = `${weight} ${size}px ${quoteFontFamily(family)}, Inter, Arial, sans-serif`;
    const width = context.measureText(text).width;
    if (cache.size > MEASURE_CACHE_LIMIT) cache.clear();
    cache.set(key, width);
    return width;
  };
}

/** Font asset ids used by visible layers on a page. */
export function pageFontAssetIds(document: CanvasDocument, pageId: string): string[] {
  const ids = new Set<string>();
  for (const element of pageElements(document, pageId)) {
    if (element.hidden) continue;
    if (element.textStyle?.fontId) ids.add(element.textStyle.fontId);
    if (typeof element.data.partnerFontAssetId === 'string') ids.add(element.data.partnerFontAssetId);
    if (elementComponent(element) === 'lockup') {
      for (const partner of readLockupPartners(element)) if (partner.fontAssetId) ids.add(partner.fontAssetId);
    }
  }
  return [...ids].filter((id) => document.assets[id]?.kind === 'font');
}

export type ExportRenderBase = Omit<ExpressionRenderContext, 'assetSource' | 'fontFamily' | 'idPrefix' | 'pageIndex'>;

/** Resolve every asset to a data URL and give each font file its own family alias. */
export async function prepareExpressionExport(document: CanvasDocument, pageId: string, base: ExportRenderBase) {
  const entries = await Promise.all(Object.values(document.assets).map(async (asset) => {
    try {
      return [asset.id, await imageUrlToDataUrl(asset.source)] as const;
    } catch {
      return [asset.id, null] as const;
    }
  }));
  const sources = new Map(entries);
  const fonts: ExpressionFontFace[] = [];
  const aliases = new Map<string, string>();
  for (const id of pageFontAssetIds(document, pageId)) {
    const source = sources.get(id);
    if (!source) continue;
    const alias = `x${hashString(id)}`;
    aliases.set(id, alias);
    fonts.push({ family: alias, source });
  }
  const context: ExpressionRenderContext = {
    ...base,
    assetArtwork: assetArtworkLookup(document.assets),
    assetSource: (assetId) => (assetId ? sources.get(assetId) ?? null : null),
    fontFamily: (assetId, family) => {
      const alias = assetId ? aliases.get(assetId) : undefined;
      return alias ? `${quoteFontFamily(alias)}, ${defaultFontFamily(assetId, family)}` : defaultFontFamily(assetId, family);
    },
    idPrefix: 'export',
    pageIndex: document.pageIds.indexOf(pageId),
  };
  return { context, fonts };
}

export async function buildPortableExpressionSvg(document: CanvasDocument, pageId: string, base: ExportRenderBase): Promise<string> {
  const { context, fonts } = await prepareExpressionExport(document, pageId, base);
  return buildExpressionPageSvg(document, pageId, context, fonts);
}

export async function rasterizeSvg(svg: string, width: number, height: number, pixelRatio = 2): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const raster = resolveSvgRasterDimensions(width, height, pixelRatio);
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, raster.width, raster.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new DOMException('The image could not be encoded.'))), type);
  });
}

// ---------------------------------------------------------------------------
// PDF (pure): one lossless Flate RGB image per page.

export type PdfPageImage = {
  /** zlib-compressed 8-bit RGB rows. */
  deflated: Uint8Array;
  pixelHeight: number;
  pixelWidth: number;
  /** Page size in CSS pixels; written at 0.75pt per pixel. */
  height: number;
  width: number;
};

export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function rgbaToRgb(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    const alpha = rgba[source + 3]! / 255;
    // Composite onto white so transparent pixels print as paper, not black.
    rgb[target] = Math.round(rgba[source]! * alpha + 255 * (1 - alpha));
    rgb[target + 1] = Math.round(rgba[source + 1]! * alpha + 255 * (1 - alpha));
    rgb[target + 2] = Math.round(rgba[source + 2]! * alpha + 255 * (1 - alpha));
  }
  return rgb;
}

export function buildPdf(pages: readonly PdfPageImage[], title = 'Glyphfield slides'): Uint8Array {
  if (pages.length === 0) throw new RangeError('A PDF needs at least one page.');
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | (() => void)) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };
  push('%PDF-1.4\n%âãÏÓ\n');
  const pageIds = pages.map((_, index) => 4 + index * 3);
  const safeTitle = title.replace(/[()\\]/g, '');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, `<< /Title (${safeTitle}) /Producer (Glyphfield) >>`);
  pages.forEach((page, index) => {
    const pageId = pageIds[index]!;
    const width = Math.round(page.width * 0.75 * 100) / 100;
    const height = Math.round(page.height * 0.75 * 100) / 100;
    const content = `q ${width} 0 0 ${height} 0 0 cm /Im${index} Do Q`;
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im${index} ${pageId + 2} 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    object(pageId + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(pageId + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${page.deflated.length} >>\nstream\n`);
      push(page.deflated);
      push('\nendstream');
    });
  });
  const xrefOffset = length;
  const count = 3 + pages.length * 3 + 1;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id += 1) push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export async function canvasToPdfPage(canvas: HTMLCanvasElement, width: number, height: number): Promise<PdfPageImage> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return {
    deflated: await deflate(rgbaToRgb(pixels)),
    height,
    pixelHeight: canvas.height,
    pixelWidth: canvas.width,
    width,
  };
}
