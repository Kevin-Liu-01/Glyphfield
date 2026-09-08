import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCanvasDocument, createCanvasElement, insertCanvasElement, toCanvasJsonValue } from '../canvasDocument';
import {
  acquireShaderFrameAssetUrl,
  clearShaderFrameAssetCache,
  collectShaderFrameSnapshots,
  createShaderFrameAsset,
  exportShaderFrameAsset,
  importShaderFrameAssets,
  normalizeShaderFrameSnapshot,
  readShaderFrameAsset,
  resolveShaderFrameAssetSource,
  shaderFrameCanvasAsset,
} from '../shaderFrameAssets';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const pngBlob = () => new Blob([Uint8Array.from(Buffer.from(PNG, 'base64'))], { type: 'image/png' });
const DIMENSIONS = { height: 1, width: 1 };

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase('glyphfield-shader-frames');
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

describe('persistent shader frame assets', () => {
  beforeEach(async () => {
    clearShaderFrameAssetCache();
    await deleteDatabase();
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => {
    clearShaderFrameAssetCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('content-addresses lossless pixels and survives memory cache loss', async () => {
    const snapshot = await createShaderFrameAsset(pngBlob(), DIMENSIONS);
    expect(snapshot.assetId).toMatch(/^shader-frame:[a-f0-9]{64}$/);
    expect(await createShaderFrameAsset(pngBlob(), DIMENSIONS)).toEqual(snapshot);
    clearShaderFrameAssetCache();
    const restored = await readShaderFrameAsset(snapshot.assetId);
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array(await pngBlob().arrayBuffer()));
    expect(restored.type).toBe('image/png');
  });

  it('embeds once at the portable boundary, without ephemeral blob URLs', async () => {
    const snapshot = await createShaderFrameAsset(pngBlob(), DIMENSIONS);
    const runtime = shaderFrameCanvasAsset(snapshot);
    expect(runtime.source).toMatch(/^glyphfield-shader-frame:/);
    expect(runtime.source).not.toContain('blob:');
    expect(await resolveShaderFrameAssetSource(runtime.source)).toBe(`data:image/png;base64,${PNG}`);
    const portable = await exportShaderFrameAsset(snapshot);
    expect(portable.source).toBe(`data:image/png;base64,${PNG}`);
    expect(portable.byteLength).toBe(pngBlob().size);
    clearShaderFrameAssetCache();
    await deleteDatabase();
    await importShaderFrameAssets([portable]);
    expect((await readShaderFrameAsset(snapshot.assetId)).size).toBe(pngBlob().size);
  });

  it('rejects unavailable persistence rather than claiming a saved frame', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(createShaderFrameAsset(pngBlob(), DIMENSIONS)).rejects.toThrow(/storage is unavailable/);
  });

  it('rejects wrong MIME, corrupt headers, false dimensions and excessive pixels', async () => {
    await expect(createShaderFrameAsset(new Blob(['image'], { type: 'image/jpeg' }), DIMENSIONS)).rejects.toThrow(/lossless PNG/);
    await expect(createShaderFrameAsset(new Blob([new Uint8Array(40)], { type: 'image/png' }), DIMENSIONS)).rejects.toThrow(/PNG header/);
    await expect(createShaderFrameAsset(pngBlob(), { height: 2, width: 1 })).rejects.toThrow(/dimensions do not match/);
    expect(normalizeShaderFrameSnapshot({ assetId: `shader-frame:${'a'.repeat(64)}`, height: 65_536, version: 1, width: 65_536 })).toBeUndefined();
  });

  it('rejects imports with a mismatched content hash or remote frame bytes', async () => {
    const snapshot = await createShaderFrameAsset(pngBlob(), DIMENSIONS);
    const portable = await exportShaderFrameAsset(snapshot);
    await expect(importShaderFrameAssets([{ ...portable, id: `shader-frame:${'f'.repeat(64)}` }])).rejects.toThrow(/saved hash/);
    await expect(importShaderFrameAssets([{ ...portable, source: 'https://example.com/frame.png' }])).rejects.toThrow(/embedded PNG/);
    await expect(readShaderFrameAsset(`shader-frame:${'e'.repeat(64)}`)).rejects.toThrow(/missing/);
  });

  it('preserves future snapshot fields and deduplicates shared artboard references', async () => {
    const snapshot = { ...await createShaderFrameAsset(pngBlob(), DIMENSIONS), futureAppearance: { alpha: true } };
    expect(normalizeShaderFrameSnapshot(snapshot)).toEqual(snapshot);
    expect(collectShaderFrameSnapshots({ layer: { frameSnapshot: snapshot }, workspace: [{ shader: { frameSnapshot: snapshot } }] })).toEqual([snapshot]);
    expect(() => collectShaderFrameSnapshots({ frameSnapshot: { ...snapshot, version: 99 } })).toThrow(/metadata is invalid/);
    expect(() => collectShaderFrameSnapshots([{ frameSnapshot: snapshot }, { frameSnapshot: { ...snapshot, width: 2 } }])).toThrow(/conflicting dimensions/);
  });

  it('hydrates all document references before source apply and rejects missing or mismatched pixels', async () => {
    const snapshot = await createShaderFrameAsset(pngBlob(), DIMENSIONS);
    const asset = await exportShaderFrameAsset(snapshot);
    let document = createCanvasDocument('frame-document', 'gt', 'Frame', 100, 100, ['assets', 'layers']);
    const layer = createCanvasElement('shader-layer', 'Shader', 'shader', { height: 100, rotation: 0, width: 100, x: 0, y: 0 });
    document = insertCanvasElement(document, document.pageIds[0]!, { ...layer, data: { frameSnapshot: toCanvasJsonValue(snapshot, 'snapshot') } });
    await expect(importShaderFrameAssets(document)).rejects.toThrow(/missing its portable asset/);
    document = { ...document, assets: { [asset.id]: asset } };
    await expect(importShaderFrameAssets(document)).resolves.toBeUndefined();
    document.elements['shader-layer']!.data.frameSnapshot = { ...snapshot, width: 2 };
    await expect(importShaderFrameAssets(document)).rejects.toThrow(/dimensions do not match/);
  });

  it('owns independent URL leases and revokes each at most once', async () => {
    const snapshot = await createShaderFrameAsset(pngBlob(), DIMENSIONS);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = await acquireShaderFrameAssetUrl(snapshot.assetId);
    const second = await acquireShaderFrameAssetUrl(snapshot.assetId);
    expect(first.url).not.toBe(second.url);
    first.release();
    first.release();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(first.url);
    second.release();
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('bounds the in-memory cache without deleting older persisted frame assets', async () => {
    const snapshots = [];
    for (let index = 0; index < 17; index += 1) {
      // A harmless trailing payload gives each stored PNG a distinct content id.
      const blob = new Blob([pngBlob(), new Uint8Array([index])], { type: 'image/png' });
      snapshots.push(await createShaderFrameAsset(blob, DIMENSIONS));
    }
    const open = vi.spyOn(fakeIndexedDB, 'open');
    await readShaderFrameAsset(snapshots.at(-1)!.assetId);
    expect(open).not.toHaveBeenCalled();
    await readShaderFrameAsset(snapshots[0]!.assetId);
    expect(open).toHaveBeenCalledOnce();
    expect((await readShaderFrameAsset(snapshots[0]!.assetId)).size).toBe(pngBlob().size + 1);
  });
});
