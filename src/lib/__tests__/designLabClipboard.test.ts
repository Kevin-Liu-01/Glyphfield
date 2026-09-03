import { describe, expect, it } from 'vitest';

import {
  parseDesignLabClipboard,
  remapDesignLabClipboardSnapshot,
  serializeDesignLabClipboard,
  type DesignLabClipboardLayerKind,
  type DesignLabClipboardSnapshot,
} from '../designLabClipboard';

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
});
