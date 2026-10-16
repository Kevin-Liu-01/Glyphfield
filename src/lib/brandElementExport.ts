/**
 * Real artifacts for Brand elements: PNG at the element's true pixel size from
 * the rendered artboard, and send-ready HTML for email elements. Browser-only.
 */
import { brandFontFaceCss, type BrandIdentity } from './brandIdentity';
import { brandElementDeviceSeed, type BrandElement, type BrandElementSettings } from './brandElements';
import { brandEmailHtml } from './brandEmailHtml';
import { brandDeviceSvg } from './brandOutputKit';
import { blobToDataUrl, svgToPngBlob } from './download';
import { domToPngBlob, embedFontFaceCss } from './domRaster';
import { getEmailLifecycleTemplate } from './emailLifecycle';

export type BrandElementArtifact = {
  blob: Blob;
  fileName: string;
  format: 'HTML' | 'PNG';
  height?: number;
  previewText?: string;
  width?: number;
};

type ExportInput = { assetOrigin?: string; download: boolean; elementId?: string; scale: 1 | 2 };

/** Validate `{ elementId?, scale?, download?, assetOrigin? }` for the export actions. */
export function exportInput(input: unknown): ExportInput {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const { assetOrigin, download, elementId, scale } = record;
  if (elementId !== undefined && typeof elementId !== 'string') throw new TypeError('elementId must be a string from /api/elements.');
  if (scale !== undefined && scale !== 1 && scale !== 2) throw new RangeError('scale must be 1 (real pixel size) or 2.');
  if (assetOrigin !== undefined && (typeof assetOrigin !== 'string' || !/^https?:\/\/[^/\s]+\/?$/i.test(assetOrigin))) {
    throw new TypeError('assetOrigin must be an origin such as https://brand.example.com.');
  }
  return { assetOrigin: assetOrigin as string | undefined, download: download === true, elementId: elementId as string | undefined, scale: (scale as 1 | 2 | undefined) ?? 1 };
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolve once the artboard shows `elementId` and its images have decoded. */
export async function waitForArtboard(root: HTMLElement | null, elementId: string, timeoutMs = 4_000): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await frame();
    const surface = root?.querySelector<HTMLElement>('.brand-element-artboard-surface');
    if (surface?.querySelector(`[data-element="${CSS.escape(elementId)}"]`)) {
      await Promise.all([...surface.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
      await document.fonts?.ready;
      await frame();
      return surface;
    }
    if (Date.now() > deadline) throw new Error(`The ${elementId} artboard did not render.`);
  }
}

/**
 * How much larger than its artboard an element's deliverable is. A catalog size in pixels with the
 * artboard's proportions (a 3000 × 3000 podcast cover drawn on a 1200 × 1200 artboard) is the real
 * output; component sizes and print sizes in mm or inches describe the subject, not the file.
 */
export function elementDeliverableScale(dimensions: string | undefined, width: number, height: number): number {
  const match = /^(\d+)\s*[×x]\s*(\d+)(?:\s*px)?$/.exec(dimensions?.trim() ?? '');
  if (!match || width <= 0 || height <= 0) return 1;
  const targetWidth = Number(match[1]);
  const targetHeight = Number(match[2]);
  const sameShape = Math.abs(targetWidth / targetHeight - width / height) < 0.01;
  return sameShape && targetWidth > width ? targetWidth / width : 1;
}

/** The rendered artboard as PNG at its deliverable size (or twice that). */
export async function renderElementPng(root: HTMLElement | null, identity: BrandIdentity, element: Pick<BrandElement, 'dimensions' | 'id'>, scale: 1 | 2 = 1): Promise<BrandElementArtifact> {
  const surface = await waitForArtboard(root, element.id);
  const width = surface.offsetWidth;
  const height = surface.offsetHeight;
  const pixelRatio = elementDeliverableScale(element.dimensions, width, height) * scale;
  const fontFaceCss = await embedFontFaceCss(brandFontFaceCss(identity));
  const blob = await domToPngBlob(surface, { fontFaceCss, height, pixelRatio, width });
  return {
    blob,
    fileName: `${identity.id}-${element.id}${scale === 2 ? '@2x' : ''}.png`,
    format: 'PNG',
    height: Math.round(height * pixelRatio),
    width: Math.round(width * pixelRatio),
  };
}

/** Header art for an email: GT's own motion artwork, otherwise the identity's device as PNG. */
async function emailHeaderImage(identity: BrandIdentity, element: Pick<BrandElement, 'id'>, origin: string): Promise<string> {
  const template = getEmailLifecycleTemplate(element.id, identity);
  if (identity.id === 'gt' && template?.artworkPath) return new URL(template.artworkPath, origin).href;
  const svg = brandDeviceSvg(identity, { height: 380, prefix: `email-${element.id}`, seed: brandElementDeviceSeed(identity.id, element.id, 'email-header'), tone: 'dark', width: 1200 });
  return blobToDataUrl(await svgToPngBlob(svg, 1200, 380, 1));
}

/** A send-ready HTML document for an email element. */
export async function renderElementHtml(identity: BrandIdentity, element: Pick<BrandElement, 'id' | 'name' | 'preview'>, settings: BrandElementSettings, assetOrigin: string): Promise<BrandElementArtifact> {
  const headerImage = settings.showLogo ? await emailHeaderImage(identity, element, assetOrigin) : undefined;
  const html = brandEmailHtml({ assetOrigin, element, headerImage, identity, settings });
  return {
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    fileName: `${identity.id}-${element.id}.html`,
    format: 'HTML',
    previewText: html,
  };
}
