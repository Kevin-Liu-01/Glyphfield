import type { CanvasAsset, CanvasDocument } from './canvasDocument';

export type ShaderFrameSnapshot = {
  assetId: string;
  height: number;
  version: 1;
  width: number;
  [key: string]: unknown;
};

const DATABASE_NAME = 'glyphfield-shader-frames';
const STORE_NAME = 'frames';
const ASSET_PREFIX = 'shader-frame:';
const SOURCE_PREFIX = 'glyphfield-shader-frame:';
const MAX_FRAME_BYTES = 25_000_000;
const MAX_FRAME_PIXELS = 16_777_216;
const MAX_CACHE_BYTES = 32_000_000;
const MAX_CACHE_ENTRIES = 16;
const frames = new Map<string, Blob>();
const pendingReads = new Map<string, Promise<Blob>>();
let cachedBytes = 0;

type ShaderFrameRecord = {
  blob: Blob;
  height: number;
  id: string;
  width: number;
};

function validAssetId(value: unknown): value is string {
  return typeof value === 'string' && /^shader-frame:[a-f0-9]{64}$/.test(value);
}

function validDimensions(width: unknown, height: unknown): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && (width as number) > 0 && (height as number) > 0
    && (width as number) * (height as number) <= MAX_FRAME_PIXELS;
}

export function normalizeShaderFrameSnapshot(value: unknown): ShaderFrameSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Partial<ShaderFrameSnapshot>;
  if (candidate.version !== 1 || !validAssetId(candidate.assetId)
    || !validDimensions(candidate.width, candidate.height)) return undefined;
  return { ...candidate, assetId: candidate.assetId, height: candidate.height!, version: 1, width: candidate.width! };
}

/** Walks only owned JSON, retaining future snapshot fields and shared references. */
export function collectShaderFrameSnapshots(value: unknown): ShaderFrameSnapshot[] {
  const snapshots = new Map<string, ShaderFrameSnapshot>();
  const visited = new Set<object>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    const rawSnapshot = (node as Record<string, unknown>).frameSnapshot;
    const snapshot = normalizeShaderFrameSnapshot(rawSnapshot);
    if (rawSnapshot !== undefined && rawSnapshot !== null && !snapshot) throw new TypeError('The captured shader frame metadata is invalid.');
    if (snapshot) {
      const existing = snapshots.get(snapshot.assetId);
      if (existing && (existing.width !== snapshot.width || existing.height !== snapshot.height)) {
        throw new TypeError('A shader frame asset has conflicting dimensions.');
      }
      snapshots.set(snapshot.assetId, snapshot);
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return [...snapshots.values()];
}

export function shaderFrameCanvasAsset(snapshot: ShaderFrameSnapshot): CanvasAsset {
  const normalized = normalizeShaderFrameSnapshot(snapshot);
  if (!normalized) throw new TypeError('The shader frame snapshot is invalid.');
  return {
    byteLength: 0,
    id: normalized.assetId,
    kind: 'image',
    mimeType: 'image/png',
    name: 'Captured shader frame',
    source: `${SOURCE_PREFIX}${normalized.assetId.slice(ASSET_PREFIX.length)}`,
  };
}

export function isShaderFrameAssetSource(source: string): boolean {
  return source.startsWith(SOURCE_PREFIX);
}

function assetIdFromSource(source: string): string {
  const id = `${ASSET_PREFIX}${source.slice(SOURCE_PREFIX.length)}`;
  if (!isShaderFrameAssetSource(source) || !validAssetId(id)) throw new TypeError('The shader frame source is invalid.');
  return id;
}

function rememberFrame(id: string, blob: Blob): void {
  const old = frames.get(id);
  if (old) cachedBytes -= old.size;
  frames.delete(id);
  frames.set(id, blob);
  cachedBytes += blob.size;
  while (frames.size > MAX_CACHE_ENTRIES || cachedBytes > MAX_CACHE_BYTES) {
    const oldest = frames.entries().next().value;
    if (!oldest) break;
    frames.delete(oldest[0]);
    cachedBytes -= oldest[1].size;
  }
}

/** Releases memory only. Saved frame blobs remain in IndexedDB for every document. */
export function clearShaderFrameAssetCache(): void {
  frames.clear();
  cachedBytes = 0;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Shader frame storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    });
    request.addEventListener('success', () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.addEventListener('versionchange', () => request.result.close());
      resolve(request.result);
    });
    request.addEventListener('error', () => reject(request.error ?? new Error('Shader frame storage could not be opened.')));
    request.addEventListener('blocked', () => {
      blocked = true;
      reject(new Error('Close older Glyphfield tabs to open shader frame storage.'));
    });
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('The shader frame could not be read.')));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Shader frame storage was interrupted.')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('The shader frame could not be saved.')));
  });
}

async function inspectPng(blob: Blob): Promise<{ bytes: ArrayBuffer; height: number; width: number }> {
  if (blob.type !== 'image/png') throw new TypeError('Shader frame snapshots must be lossless PNG images.');
  if (blob.size < 33 || blob.size > MAX_FRAME_BYTES) throw new RangeError('Keep shader frame snapshots below 25 MB.');
  const bytes = await blob.arrayBuffer();
  const header = new Uint8Array(bytes, 0, 24);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
  if (!signature.every((value, index) => header[index] === value)) throw new TypeError('The shader frame PNG header is invalid.');
  const view = new DataView(bytes);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!validDimensions(width, height)) throw new RangeError('The shader frame dimensions are invalid or too large.');
  return { bytes, height, width };
}

async function hashAssetId(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure shader frame hashing is unavailable.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${ASSET_PREFIX}${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

async function persistRecord(record: ShaderFrameRecord): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const existing = store.getKey(record.id);
    existing.addEventListener('success', () => {
      if (existing.result === undefined) store.put(record);
    });
    await completed;
    rememberFrame(record.id, record.blob);
  } finally {
    database.close();
  }
}

/** Capture calls this once, never from a live frame tick. Failed writes reject. */
export async function createShaderFrameAsset(
  blob: Blob,
  dimensions: { width: number; height: number }
): Promise<ShaderFrameSnapshot> {
  const png = await inspectPng(blob);
  if (png.width !== dimensions.width || png.height !== dimensions.height) throw new TypeError('The shader frame dimensions do not match its pixels.');
  const id = await hashAssetId(png.bytes);
  await persistRecord({ blob, height: png.height, id, width: png.width });
  return { assetId: id, height: png.height, version: 1, width: png.width };
}

export async function readShaderFrameAsset(assetId: string): Promise<Blob> {
  if (!validAssetId(assetId)) throw new TypeError('The shader frame asset id is invalid.');
  const cached = frames.get(assetId);
  if (cached) {
    rememberFrame(assetId, cached);
    return cached;
  }
  const pending = pendingReads.get(assetId);
  if (pending) return pending;
  const operation = (async () => {
    const database = await openDatabase();
    try {
      const record = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(assetId)) as ShaderFrameRecord | undefined;
      if (!record?.blob || record.blob.type !== 'image/png') throw new Error('The captured shader frame is missing. Import the original saved design to restore it.');
      rememberFrame(assetId, record.blob);
      return record.blob;
    } finally {
      database.close();
    }
  })();
  pendingReads.set(assetId, operation);
  try {
    return await operation;
  } finally {
    if (pendingReads.get(assetId) === operation) pendingReads.delete(assetId);
  }
}

/** Each mounted consumer owns its URL; eviction cannot revoke another canvas. */
export async function acquireShaderFrameAssetUrl(assetId: string): Promise<{ url: string; release: () => void }> {
  const url = URL.createObjectURL(await readShaderFrameAsset(assetId));
  let released = false;
  return { url, release: () => {
    if (released) return;
    released = true;
    URL.revokeObjectURL(url);
  } };
}

async function pngDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The captured shader frame could not be embedded.')));
      reader.addEventListener('error', () => reject(reader.error ?? new Error('The captured shader frame could not be embedded.')));
      reader.readAsDataURL(blob);
    });
  }
  // Non-DOM consumers (contract tests) do not provide the browser's encoder.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function resolveShaderFrameAssetSource(source: string): Promise<string> {
  return pngDataUrl(await readShaderFrameAsset(assetIdFromSource(source)));
}

export async function exportShaderFrameAsset(snapshot: ShaderFrameSnapshot): Promise<CanvasAsset> {
  const asset = shaderFrameCanvasAsset(snapshot);
  const blob = await readShaderFrameAsset(snapshot.assetId);
  return { ...asset, byteLength: blob.size, source: await pngDataUrl(blob) };
}

function pngBlobFromDataUrl(source: string): Blob {
  if (!/^data:image\/png;base64,[a-z\d+/]*={0,2}$/i.test(source)) throw new TypeError('Portable shader frames must contain embedded PNG bytes.');
  const encoded = source.slice(source.indexOf(',') + 1);
  if (encoded.length > Math.ceil(MAX_FRAME_BYTES / 3) * 4) throw new RangeError('Keep shader frame snapshots below 25 MB.');
  const decoded = atob(encoded);
  return new Blob([Uint8Array.from(decoded, (character) => character.charCodeAt(0))], { type: 'image/png' });
}

/** Hydrate before applying imported source; a missing/corrupt frame fails loudly. */
export async function importShaderFrameAssets(input: CanvasDocument | readonly CanvasAsset[]): Promise<void> {
  const assets: readonly CanvasAsset[] = Array.isArray(input) ? input : Object.values((input as CanvasDocument).assets);
  const referenced = Array.isArray(input) ? [] : collectShaderFrameSnapshots({
    elements: (input as CanvasDocument).elements,
    metadata: (input as CanvasDocument).metadata,
  });
  const references = new Map(referenced.map((snapshot) => [snapshot.assetId, snapshot]));
  for (const snapshot of referenced) {
    if (!assets.some((asset) => asset.id === snapshot.assetId)) throw new TypeError('A captured shader frame is missing its portable asset.');
  }
  const seen = new Set<string>();
  for (const asset of assets) {
    if (!validAssetId(asset.id) || seen.has(asset.id)) continue;
    seen.add(asset.id);
    if (asset.kind !== 'image' || asset.mimeType !== 'image/png') throw new TypeError('Captured shader frame assets must be PNG images.');
    if (isShaderFrameAssetSource(asset.source)) {
      if (assetIdFromSource(asset.source) !== asset.id) throw new TypeError('The shader frame source and id do not match.');
      await readShaderFrameAsset(asset.id);
      continue;
    }
    const blob = pngBlobFromDataUrl(asset.source);
    const png = await inspectPng(blob);
    const reference = references.get(asset.id);
    if (reference && (png.width !== reference.width || png.height !== reference.height)) {
      throw new TypeError('The shader frame dimensions do not match its saved snapshot.');
    }
    if (await hashAssetId(png.bytes) !== asset.id) throw new TypeError('The shader frame content does not match its saved hash.');
    await persistRecord({ blob, height: png.height, id: asset.id, width: png.width });
  }
}
