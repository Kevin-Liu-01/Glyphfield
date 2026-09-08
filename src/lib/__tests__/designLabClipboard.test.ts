import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  designLabClipboardFrameAssets,
  hydrateDesignLabClipboardFrames,
  parseDesignLabClipboard,
  reanchorDesignLabClipboardSnapshot,
  remapDesignLabClipboardSnapshot,
  serializeDesignLabClipboard,
  writePreparedDesignLabClipboard,
  type DesignLabClipboardLayerKind,
  type DesignLabClipboardSnapshot,
} from '../designLabClipboard';
import type { CanvasAsset } from '../canvasDocument';
import { clearShaderFrameAssetCache, createShaderFrameAsset, exportShaderFrameAsset, readShaderFrameAsset } from '../shaderFrameAssets';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const FRAME_ID = `shader-frame:${'a'.repeat(64)}`;
const FRAME = { assetId: FRAME_ID, height: 1, width: 1, version: 1, timeMs: 450, recipeKey: 'recipe', presentation: { grainOpacity: 0.12 } };
const ASSET: CanvasAsset = {
  id: FRAME_ID, byteLength: Buffer.from(PNG, 'base64').length, kind: 'image', mimeType: 'image/png', name: 'Shader frame', source: `data:image/png;base64,${PNG}`,
};

async function deleteFrameDatabase() {
  clearShaderFrameAssetCache();
  await new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase('glyphfield-shader-frames');
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

function snapshot(): DesignLabClipboardSnapshot {
  return {
    assets: [{ id: 'asset-photo', name: 'Photo', transform: { scale: 1, x: 20, y: 30 }, url: 'data:image/png;base64,aGVybw==' }],
    backgroundColor: '#111216',
    effectLayers: [{ id: 'effect-bayer', name: 'Bayer', settings: { kind: 'bayer' } }],
    groups: [{ id: 'group-lockup', layerIds: ['text-title', 'asset-photo'], name: 'Lockup' }],
    layerOrder: ['shader-backdrop', 'effect-bayer', 'asset-photo', 'text-title'],
    layerShaders: { 'asset-photo': { materialId: 'paper-gem-smoke', settings: { speed: 0.4 } } },
    logos: [],
    ratio: 'wide',
    shaderLayers: [{ id: 'shader-backdrop', name: 'Backdrop', settings: {}, transform: { scale: 1, x: 0, y: 0 } }],
    shaderSequence: { targetLayerId: 'shader-backdrop' },
    textLayers: [{ id: 'text-title', name: 'Title', textEffect: { kind: 'gradient' }, transform: { scale: 1, x: 100, y: 80 } }],
  };
}

function deterministicIds() {
  const counts = new Map<DesignLabClipboardLayerKind, number>();
  return (kind: DesignLabClipboardLayerKind) => {
    const count = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, count);
    return `${kind}-new-${count}`;
  };
}

describe('Design Lab clipboard', () => {
  it('round-trips tagged layer and artboard payloads while rejecting ordinary clipboard text', () => {
    const layers = parseDesignLabClipboard(serializeDesignLabClipboard({
      kind: 'layers',
      layerIds: ['text-title'],
      snapshot: snapshot(),
    }));
    const artboard = parseDesignLabClipboard(serializeDesignLabClipboard({
      artboard: { id: 'artboard-main', name: 'Main', snapshot: snapshot(), x: 120, y: 180 },
      kind: 'artboard',
    }));

    expect(layers).toMatchObject({ kind: 'layers', layerIds: ['text-title'], version: 1 });
    expect(artboard).toMatchObject({ kind: 'artboard', artboard: { id: 'artboard-main', name: 'Main' }, version: 1 });
    expect(parseDesignLabClipboard('{"ordinary":"json"}')).toBeNull();
    expect(parseDesignLabClipboard('not json')).toBeNull();
  });

  it('copies selected layers with fresh ids, a visible offset, group membership, and applied shaders', () => {
    const duplicated = remapDesignLabClipboardSnapshot(snapshot(), {
      createId: deterministicIds(),
      layerIds: ['asset-photo', 'text-title'],
      offset: 32,
      renameLayers: true,
    });

    expect(duplicated.layerIds).toEqual(['asset-new-1', 'text-new-1']);
    expect(duplicated.snapshot.layerOrder).toEqual(['asset-new-1', 'text-new-1']);
    expect(duplicated.snapshot.assets).toEqual([expect.objectContaining({
      id: 'asset-new-1',
      name: 'Photo copy',
      transform: { scale: 1, x: 52, y: 62 },
      url: 'data:image/png;base64,aGVybw==',
    })]);
    expect(duplicated.snapshot.textLayers).toEqual([expect.objectContaining({
      id: 'text-new-1',
      name: 'Title copy',
      transform: { scale: 1, x: 132, y: 112 },
    })]);
    expect(duplicated.snapshot.groups).toEqual([{
      id: 'group-new-1',
      layerIds: ['text-new-1', 'asset-new-1'],
      name: 'Lockup copy',
    }]);
    expect(duplicated.snapshot.layerShaders).toEqual({
      'asset-new-1': { materialId: 'paper-gem-smoke', settings: { speed: 0.4 } },
    });
    expect(duplicated.snapshot.shaderLayers).toEqual([]);
    expect(duplicated.snapshot.effectLayers).toEqual([]);
  });

  it('remaps a complete artboard without shifting its internal composition', () => {
    const duplicated = remapDesignLabClipboardSnapshot(snapshot(), {
      createId: deterministicIds(),
    });

    expect(duplicated.snapshot.layerOrder).toEqual([
      'shader-new-1',
      'effect-new-1',
      'asset-new-1',
      'text-new-1',
    ]);
    expect(duplicated.snapshot.shaderLayers[0]?.transform).toEqual({ scale: 1, x: 0, y: 0 });
    expect(duplicated.snapshot.shaderSequence.targetLayerId).toBe('shader-new-1');
    expect(duplicated.snapshot.groups[0]?.layerIds).toEqual(['text-new-1', 'asset-new-1']);
  });

  it('copies only selected layers and embeds only their referenced PNG assets', () => {
    const source = snapshot();
    source.shaderLayers[0]!.frameSnapshot = FRAME;
    source.layerShaders['asset-photo'] = { ...source.layerShaders['asset-photo'] as object, frameSnapshot: FRAME };
    const copied = parseDesignLabClipboard(serializeDesignLabClipboard({
      kind: 'layers', layerIds: ['asset-photo', 'text-title'], snapshot: source,
      frameAssets: [ASSET, { ...ASSET, id: `shader-frame:${'b'.repeat(64)}` }],
    }))!;
    expect(copied.frameAssets).toEqual([ASSET]);
    expect(copied.kind === 'layers' && copied.snapshot).toMatchObject({
      shaderLayers: [], layerOrder: ['asset-photo', 'text-title'], shaderSequence: { targetLayerId: null },
    });
    expect(designLabClipboardFrameAssets(copied)).toEqual([ASSET]);
    expect(source.shaderLayers).toHaveLength(1);
  });

  it('does not require unrelated shader frames when copying a text layer', () => {
    const source = snapshot();
    source.shaderLayers[0]!.frameSnapshot = FRAME;
    const copied = parseDesignLabClipboard(serializeDesignLabClipboard({ kind: 'layers', layerIds: ['text-title'], snapshot: source }))!;
    expect(copied.frameAssets).toBeUndefined();
    expect(designLabClipboardFrameAssets(copied)).toEqual([]);
  });

  it('rejects missing pixels, duplicate frame assets, and nonportable frame URLs', () => {
    const source = snapshot();
    source.shaderLayers[0]!.frameSnapshot = FRAME;
    const payload = { kind: 'layers' as const, layerIds: ['shader-backdrop'], snapshot: source };
    expect(() => serializeDesignLabClipboard(payload)).toThrow(/missing its PNG/);
    expect(() => serializeDesignLabClipboard({ ...payload, frameAssets: [ASSET, ASSET] })).toThrow(/duplicate ids/);
    expect(() => serializeDesignLabClipboard({ ...payload, frameAssets: [{ ...ASSET, source: 'blob:frame' }] })).toThrow(/embedded lossless PNG/);
    expect(() => serializeDesignLabClipboard({ kind: 'artboard', artboard: {} })).toThrow(/artboard is invalid/);
    const valid = JSON.parse(serializeDesignLabClipboard({ ...payload, frameAssets: [ASSET] }));
    valid.frameAssets[0].source = 'https://example.com/frame.png';
    expect(parseDesignLabClipboard(JSON.stringify(valid))).toBeNull();
  });

  it('reanchors native time while preserving exact pixels, recipes, presentation and future fields', () => {
    const source = snapshot();
    const application = { frameSnapshot: FRAME, frameState: { engine: 'paper', version: 2, frame: 8_250.5, timelineTimeMs: 450, future: 'retain' } };
    Object.assign(source.shaderLayers[0]!, application);
    source.layerShaders['asset-photo'] = { ...source.layerShaders['asset-photo'] as object, ...application };
    const anchored = reanchorDesignLabClipboardSnapshot(source, 2_400);
    const expected = { frameSnapshot: { ...FRAME, timeMs: 2_400 }, frameState: { ...application.frameState, timelineTimeMs: 2_400 } };
    expect(anchored.shaderLayers[0]).toMatchObject(expected);
    expect(anchored.layerShaders['asset-photo']).toMatchObject(expected);
    expect(anchored.timeline).toMatchObject({ paused: true, timeMs: 2_400 });
    const remapped = remapDesignLabClipboardSnapshot(anchored, { createId: deterministicIds() });
    expect(remapped.snapshot.shaderLayers[0]).toMatchObject(expected);
    expect(remapped.snapshot.layerShaders['asset-new-1']).toMatchObject(expected);
    expect(source.shaderLayers[0]!.frameSnapshot).toEqual(FRAME);
    expect(() => reanchorDesignLabClipboardSnapshot(source, Number.NaN)).toThrow(/time is invalid/);
  });
});

describe('portable clipboard frame import', () => {
  beforeEach(async () => {
    await deleteFrameDatabase();
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => {
    clearShaderFrameAssetCache();
    vi.unstubAllGlobals();
  });

  async function capturedClipboard() {
    const blob = new Blob([Uint8Array.from(Buffer.from(PNG, 'base64'))], { type: 'image/png' });
    const frame = await createShaderFrameAsset(blob, { height: 1, width: 1 });
    const asset = await exportShaderFrameAsset(frame);
    const source = snapshot();
    source.shaderLayers[0]!.frameSnapshot = frame;
    return { frame, payload: parseDesignLabClipboard(serializeDesignLabClipboard({
      kind: 'layers', layerIds: ['shader-backdrop'], snapshot: source, frameAssets: [asset],
    }))! };
  }

  it('restores a frame into an empty asset store before the pasted document is applied', async () => {
    const { frame, payload } = await capturedClipboard();
    await deleteFrameDatabase();
    await hydrateDesignLabClipboardFrames(payload);
    expect(Buffer.from(await (await readShaderFrameAsset(frame.assetId)).arrayBuffer()).toString('base64')).toBe(PNG);
  });

  it('rejects copied dimensions, missing bytes, and tampered pixels before application', async () => {
    const { payload } = await capturedClipboard();
    if (payload.kind !== 'layers') throw new Error('Expected layers');
    payload.snapshot.shaderLayers[0]!.frameSnapshot = { ...FRAME, assetId: payload.frameAssets![0]!.id, width: 2 };
    await expect(hydrateDesignLabClipboardFrames(payload)).rejects.toThrow(/dimensions/);
    await expect(hydrateDesignLabClipboardFrames({ ...payload, frameAssets: [] })).rejects.toThrow(/missing its PNG/);
    payload.snapshot.shaderLayers[0]!.frameSnapshot = FRAME;
    payload.frameAssets![0]!.id = FRAME_ID;
    await expect(hydrateDesignLabClipboardFrames(payload)).rejects.toThrow(/saved hash/);
  });
});

describe('asynchronous system clipboard', () => {
  it('starts a promised Blob write before capture finishes', async () => {
    let resolveSource!: (value: string) => void;
    const source = new Promise<string>((resolve) => { resolveSource = resolve; });
    let promisedBlob!: Promise<Blob>;
    class Item {
      constructor(data: Record<string, Promise<Blob>>) { promisedBlob = data['text/plain']!; }
    }
    const write = vi.fn(async () => { await promisedBlob; });
    const result = writePreparedDesignLabClipboard(source, { clipboard: { write }, clipboardItem: Item as unknown as typeof ClipboardItem });
    expect(write).toHaveBeenCalledTimes(1);
    resolveSource('captured frame');
    await expect(result).resolves.toBe(true);
    expect(await (await promisedBlob).text()).toBe('captured frame');
  });

  it('falls back to text when structured writes are denied and reports local-only copy honestly', async () => {
    class Item { constructor(_data: unknown) {} }
    const write = vi.fn().mockRejectedValue(new Error('Permission denied'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await writePreparedDesignLabClipboard(Promise.resolve('exact source'), {
      clipboard: { write, writeText }, clipboardItem: Item as unknown as typeof ClipboardItem,
    })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('exact source');
    writeText.mockRejectedValue(new Error('Permission denied'));
    expect(await writePreparedDesignLabClipboard(Promise.resolve('exact source'), { clipboard: { writeText }, clipboardItem: null })).toBe(false);
    expect(await writePreparedDesignLabClipboard(Promise.resolve('exact source'), { clipboard: null })).toBe(false);
  });

  it('never writes a stale source when shader capture fails', async () => {
    const writeText = vi.fn();
    await expect(writePreparedDesignLabClipboard(Promise.reject(new Error('Capture failed')), {
      clipboard: { writeText }, clipboardItem: null,
    })).rejects.toThrow('Capture failed');
    expect(writeText).not.toHaveBeenCalled();
  });
});
