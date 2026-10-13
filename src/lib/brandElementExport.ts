/**
 * Real artifacts for Brand elements: PNG at the element's true pixel size from
 * the rendered artboard, and send-ready HTML for email elements. Browser-only.
 */
import { brandFontFaceCss, type BrandIdentity } from './brandIdentity';
import type { BrandElement, BrandElementSettings } from './brandElements';
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

/** The rendered artboard as PNG at its real width and height (or twice that). */
export async function renderElementPng(root: HTMLElement | null, identity: BrandIdentity, element: Pick<BrandElement, 'id'>, scale: 1 | 2 = 1): Promise<BrandElementArtifact> {
  const surface = await waitForArtboard(root, element.id);
  const width = surface.offsetWidth;
  const height = surface.offsetHeight;
  const fontFaceCss = await embedFontFaceCss(brandFontFaceCss(identity));
  const blob = await domToPngBlob(surface, { fontFaceCss, height, pixelRatio: scale, width });
  return {
    blob,
    fileName: `${identity.id}-${element.id}${scale === 2 ? '@2x' : ''}.png`,
    format: 'PNG',
    height: height * scale,
    width: width * scale,
  };
}

/** Header art for an email: GT's own motion artwork, otherwise the identity's device as PNG. */
async function emailHeaderImage(identity: BrandIdentity, element: Pick<BrandElement, 'id'>, origin: string): Promise<string> {
  const template = getEmailLifecycleTemplate(element.id, identity);
  if (identity.id === 'gt' && template?.artworkPath) return new URL(template.artworkPath, origin).href;
  const svg = brandDeviceSvg(identity, { height: 380, prefix: `email-${element.id}`, seed: (template?.id.length ?? 3) + 11, tone: 'dark', width: 1200 });
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
