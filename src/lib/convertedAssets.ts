export const CONVERTED_ASSET_EVENT = 'glyphfield:converted-assets-changed';
const CONVERTED_ASSET_MAX_BYTES = 25_000_000;
export const CONVERTED_ASSET_SIZES = [1024, 2048, 4096] as const;

const DATABASE_NAME = 'glyphfield-asset-library';
const DATABASE_VERSION = 1;
const STORE_NAME = 'converted-assets';

export type ConvertedAsset = {
  convertedBytes: number;
  convertedDataUrl: string;
  createdAt: string;
  height: number;
  id: string;
  name: string;
  originalDataUrl: string;
  originalName: string;
  sourceBytes: number;
  sourceMimeType: string;
  width: number;
};

export type AssetFileDescriptor = {
  name: string;
  size: number;
  type: string;
};

const SUPPORTED_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp']);

export function assetExtension(name: string): string {
  return name.split('.').pop()?.toLocaleLowerCase() ?? '';
}

export function isConvertibleAsset(file: AssetFileDescriptor): boolean {
  return file.type.startsWith('image/') || SUPPORTED_EXTENSIONS.has(assetExtension(file.name));
}

export function shaderSafeFileName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '').trim() || 'asset';
  return `${stem.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'asset'}.png`;
}

export function fitAssetDimensions(width: number, height: number, maxDimension: number) {
  const safeWidth = Math.max(1, Math.round(width || maxDimension));
  const safeHeight = Math.max(1, Math.round(height || maxDimension));
  const scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
  return {
    height: Math.max(1, Math.round(safeHeight * scale)),
    width: Math.max(1, Math.round(safeWidth * scale)),
  };
}

export function formatAssetBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new DOMException('The asset could not be read.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new DOMException('The asset could not be read.')));
    reader.readAsDataURL(blob);
  });
}

function sanitizeSvg(source: string): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new TypeError('The SVG is not valid XML.');
  document.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((element) => element.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLocaleLowerCase();
      const value = attribute.value.trim().toLocaleLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) element.removeAttribute(attribute.name);
      if ((name === 'href' || name.endsWith(':href')) && /^https?:/.test(value)) element.removeAttribute(attribute.name);
      if (name === 'style' && /url\(\s*['"]?(?:https?:|javascript:)/.test(value)) element.removeAttribute(attribute.name);
    }
  });
  document.querySelectorAll('style').forEach((element) => {
    if (/url\(\s*['"]?(?:https?:|javascript:)/i.test(element.textContent ?? '')) element.remove();
  });
  return new XMLSerializer().serializeToString(document.documentElement);
}

async function normalizedSource(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  const svg = file.type === 'image/svg+xml' || assetExtension(file.name) === 'svg';
  if (!svg) return { dataUrl: await readBlobAsDataUrl(file), mimeType: file.type || `image/${assetExtension(file.name)}` };
  const sanitized = sanitizeSvg(await file.text());
  const blob = new Blob([sanitized], { type: 'image/svg+xml;charset=utf-8' });
  return { dataUrl: await readBlobAsDataUrl(blob), mimeType: 'image/svg+xml' };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new TypeError('The browser could not decode this image.')), { once: true });
    image.decoding = 'async';
    image.src = dataUrl;
  });
}

export async function convertAssetFile(file: File, maxDimension = 2048): Promise<ConvertedAsset> {
  if (!isConvertibleAsset(file)) throw new TypeError('Choose an SVG, PNG, JPG, WebP, GIF, AVIF, or BMP image.');
  if (file.size > CONVERTED_ASSET_MAX_BYTES) throw new RangeError('Keep source assets under 25 MB.');
  const targetSize = Math.max(256, Math.min(4096, Math.round(maxDimension)));
  const [originalDataUrl, source] = await Promise.all([
    readBlobAsDataUrl(file),
    normalizedSource(file),
  ]);
  const image = await loadImage(source.dataUrl);
  const dimensions = fitAssetDimensions(image.naturalWidth, image.naturalHeight, targetSize);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Canvas conversion is unavailable.');
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  const convertedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG conversion failed.')), 'image/png');
  });
  return {
    convertedBytes: convertedBlob.size,
    convertedDataUrl: await readBlobAsDataUrl(convertedBlob),
    createdAt: new Date().toISOString(),
    height: dimensions.height,
    id: `converted-${crypto.randomUUID()}`,
    name: shaderSafeFileName(file.name),
    originalDataUrl,
    originalName: file.name,
    sourceBytes: file.size,
    sourceMimeType: source.mimeType,
    width: dimensions.width,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('The asset library could not be opened.')));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('The asset library request failed.')));
  });
}

export async function listConvertedAssets(): Promise<ConvertedAsset[]> {
  const database = await openDatabase();
  try {
    const assets = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()) as ConvertedAsset[];
    return assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}

export async function saveConvertedAsset(asset: ConvertedAsset): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(asset));
  } finally {
    database.close();
  }
}

export async function deleteConvertedAsset(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
  } finally {
    database.close();
  }
}

export function announceConvertedAssetChange() {
  window.dispatchEvent(new Event(CONVERTED_ASSET_EVENT));
}
