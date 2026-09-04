export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const pendingImageDataUrls = new Map<string, Promise<string>>();
const DEFAULT_SVG_RASTER_PIXEL_RATIO = 2;
const MAX_SVG_RASTER_EDGE = 4_800;

export type SvgRasterDimensions = {
  height: number;
  pixelRatio: number;
  width: number;
};

export function resolveSvgRasterDimensions(
  width: number,
  height: number,
  requestedPixelRatio = DEFAULT_SVG_RASTER_PIXEL_RATIO
): SvgRasterDimensions {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('SVG export dimensions must be positive finite numbers.');
  }
  const safePixelRatio = Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0
    ? requestedPixelRatio
    : DEFAULT_SVG_RASTER_PIXEL_RATIO;
  const largestEdge = Math.max(width, height);
  const pixelRatio = Math.max(1, Math.min(safePixelRatio, MAX_SVG_RASTER_EDGE / largestEdge));
  return {
    height: Math.max(1, Math.round(height * pixelRatio)),
    pixelRatio,
    width: Math.max(1, Math.round(width * pixelRatio)),
  };
}

/**
 * Embeds an image once even when the live canvas, autosave document, and export
 * renderer request it during the same render. Completed requests leave the
 * cache immediately so removed uploads cannot be retained by this module.
 */
export function imageUrlToDataUrl(source: string): Promise<string> {
  if (/^data:/i.test(source)) return Promise.resolve(source);
  const pending = pendingImageDataUrls.get(source);
  if (pending) return pending;

  const request = fetch(source).then(async (response) => {
    if (!response.ok) throw new Error(`Asset request failed with ${response.status}.`);
    return blobToDataUrl(await response.blob());
  });
  pendingImageDataUrls.set(source, request);
  const clear = () => {
    if (pendingImageDataUrls.get(source) === request) pendingImageDataUrls.delete(source);
  };
  void request.then(clear, clear);
  return request;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new DOMException('The PNG could not be encoded.'));
    }, 'image/png');
  });
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  pixelRatio = DEFAULT_SVG_RASTER_PIXEL_RATIO
): Promise<Blob> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const source = URL.createObjectURL(blob);
  const image = new Image();
  image.src = source;

  try {
    await image.decode();
    const raster = resolveSvgRasterDimensions(width, height, pixelRatio);
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d', { alpha: true });

    if (!context) {
      throw new Error('Canvas is unavailable.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, raster.width, raster.height);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(source);
  }
}
