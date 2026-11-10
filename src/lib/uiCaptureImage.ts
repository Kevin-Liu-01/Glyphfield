// Prepares a UI capture for its artboard in the browser: decodes it, keeps at most twice the pixels
// its box shows, and bakes the rounded corners into its alpha so the layer shadow follows them.
import { loadCanvasImage } from './canvasDrawing';
import { blobToDataUrl } from './download';
import { uiCaptureBox, uiCaptureImageRadius, type UiCaptureRequest } from './uiCapture';

const CAPTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_CAPTURE_BYTES = 24_000_000;

function captureMimeType(source: Blob | string): string | null {
  if (typeof source === 'string') return /^data:(image\/(?:png|jpeg|webp));base64,/i.exec(source)?.[1]?.toLowerCase() ?? null;
  return source.type.toLowerCase();
}

export async function prepareUiCaptureImage(
  source: unknown,
  request: Pick<UiCaptureRequest, 'padding' | 'radius' | 'size'>
): Promise<{ height: number; url: string; width: number }> {
  if (!(source instanceof Blob) && typeof source !== 'string') {
    throw new TypeError('image must be a PNG, JPEG or WebP Blob, or a base64 data URL of one.');
  }
  const mime = captureMimeType(source);
  if (!mime || !(CAPTURE_MIME_TYPES as readonly string[]).includes(mime)) {
    throw new TypeError('image must be a PNG, JPEG or WebP Blob, or a base64 data URL of one.');
  }
  const bytes = typeof source === 'string' ? source.length * 0.75 : source.size;
  if (bytes > MAX_CAPTURE_BYTES) throw new RangeError('image must be under 24 MB.');
  const image = await loadCanvasImage(typeof source === 'string' ? source : await blobToDataUrl(source));
  const natural = { height: image.naturalHeight, width: image.naturalWidth };
  if (!natural.width || !natural.height) throw new TypeError('The capture could not be decoded.');
  const box = uiCaptureBox(request.size, natural, request.padding);
  const scale = Math.min(1, (box.width * 2) / natural.width);
  const width = Math.max(1, Math.round(natural.width * scale));
  const height = Math.max(1, Math.round(natural.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The capture could not be prepared: no 2D canvas.');
  context.beginPath();
  context.roundRect(0, 0, width, height, uiCaptureImageRadius(request.radius, { width }, box.width));
  context.clip();
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  return { height, url: canvas.toDataURL('image/png'), width };
}
