import { blobToDataUrl } from './download';
import { imageLayerName } from './imagePlacement';
import type { BrandAsset } from './brandIdentity';

export const MAX_EMBEDDED_IMAGE_BYTES = 4_000_000;

export type EmbeddedImageFile = {
  byteLength: number;
  mimeType: string;
  name: string;
  source: string;
};

const IMAGE_LIBRARY_QUOTA_MESSAGE = 'Browser storage is full. Delete unused assets from the library below, then retry.';

export function imageLibraryErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (
    name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || /quota (?:has been )?exceeded|exceeded.*quota/i.test(message)
  ) {
    return IMAGE_LIBRARY_QUOTA_MESSAGE;
  }
  return message || 'The image library could not be updated.';
}

export function embeddedImageSourceBytes(source: string): number | null {
  if (!source.startsWith('data:')) return null;
  const commaIndex = source.indexOf(',');
  if (commaIndex < 0) return null;
  const metadata = source.slice(0, commaIndex);
  const payload = source.slice(commaIndex + 1);
  if (/;base64$/i.test(metadata)) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
  } catch {
    return null;
  }
}

function formatByteLimit(bytes: number): string {
  if (bytes >= 1_000_000) return `${Number((bytes / 1_000_000).toFixed(1))} MB`;
  if (bytes >= 1_000) return `${Number((bytes / 1_000).toFixed(1))} KB`;
  return `${bytes} bytes`;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectSvg(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 1_024)))
    .replace(/^\uFEFF/, '')
    .trimStart();
  return /^<svg(?:\s|>)/i.test(prefix) || /^<\?xml[\s\S]*?<svg(?:\s|>)/i.test(prefix);
}

/** Detects the actual image encoding instead of trusting a filename or browser supplied type. */
export function detectImageMimeType(input: ArrayBuffer | Uint8Array): string | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 0, 2) === 'BM') return 'image/bmp';
  if (ascii(bytes, 4, 8) === 'ftyp' && /^(?:avif|avis|mif1|msf1)$/.test(ascii(bytes, 8, 12))) return 'image/avif';
  if (detectSvg(bytes)) return 'image/svg+xml';
  return null;
}

export async function readEmbeddedImageFile(
  file: File,
  maxBytes = MAX_EMBEDDED_IMAGE_BYTES
): Promise<EmbeddedImageFile> {
  if (file.size > maxBytes) {
    throw new TypeError(`Keep image assets under ${formatByteLimit(maxBytes)} so projects remain portable.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new TypeError(`${file.name || 'This file'} is not a supported PNG, JPG, WebP, AVIF, GIF, BMP, or SVG image.`);
  }
  const source = await blobToDataUrl(new Blob([bytes], { type: mimeType }));
  return {
    byteLength: bytes.byteLength,
    mimeType,
    name: imageLayerName(file.name),
    source,
  };
}

export function createImportedBrandAsset(
  image: EmbeddedImageFile,
  label = image.name,
  id = `asset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
): BrandAsset {
  const resolvedLabel = label.trim() || image.name || 'Image';
  return {
    alt: resolvedLabel,
    focalPoint: { x: 0.5, y: 0.5 },
    id,
    label: resolvedLabel,
    path: image.source,
    redistribution: 'original',
    surface: 'any',
    tags: ['design-lab', 'imported'],
    type: 'image',
    usage: 'Reusable artwork for Design Lab compositions and exports',
  };
}
