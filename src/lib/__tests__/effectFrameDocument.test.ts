import { describe, expect, it } from 'vitest';

import { type CanvasJsonObject } from '../canvasDocument';
import { createDesignLabCanvasDocument, designLabSourceFromCanvasDocument } from '../designLabDocument';
import { applyEffectFrameCaptures, effectFrameCompositionKey, effectFrameMatches } from '../effectFrameDocument';
import { remapDesignLabClipboardSnapshot, reanchorDesignLabClipboardSnapshot } from '../designLabClipboard';
import { shaderFrameCanvasAsset } from '../shaderFrameAssets';

const frame = { assetId: `shader-frame:${'a'.repeat(64)}`, width: 640, height: 360, version: 1 as const };
const shaderFrame = { ...frame, assetId: `shader-frame:${'b'.repeat(64)}`, timeMs: 123.4, presentation: { grainOpacity: 0.2 } };

function snapshot() {
  return {
    assets: [], backgroundColor: '#111111', dimensions: { width: 960, height: 540 }, logos: [], groups: [],
    shaderLayers: [{ id: 'shader-one', name: 'Shader', materialId: 'paper-gem-smoke', shaderSize: 1,
      settings: { speed: 0.3 }, opacity: 1, visible: true, transform: { x: 20, y: 40, scale: 1 },
      frameSnapshot: shaderFrame, frameState: { engine: 'paper', version: 2, frame: 888, timelineTimeMs: 123.4 } }],
    effectLayers: [{ id: 'effect-one', name: 'Bayer', opacity: 1, visible: true, settings: { kind: 'bayer', threshold: 0.5 } }],
    textLayers: [{ id: 'text-one', name: 'Title', value: 'After converter', visible: true, transform: { x: 0, y: 0, scale: 1 } }],
    layerOrder: ['shader-one', 'effect-one', 'text-one'], layerShaders: {}, ratio: 'wide',
    shaderSequence: {}, timeline: { frame: 0, timeMs: 123.4, paused: true },
  };
}

function sourceDocument() {
  const active = snapshot();
  return createDesignLabCanvasDocument({
    ...active, width: 960, height: 540, id: 'effect-test', brandId: 'gt', createdAt: '2026-09-07T00:00:00Z',
    updatedAt: '2026-09-07T00:00:00Z', title: 'Effect frames', exportSettings: {}, revision: 9,
    workspace: { activeArtboardId: 'active', artboards: [
      { id: 'active', name: 'Active', snapshot: active, x: 80, y: 96 },
      { id: 'inactive', name: 'Inactive', snapshot: structuredClone(active), x: 1100, y: 96 },
    ] },
  });
}

describe('converter frame document checkpoints', () => {
  it('immutably preserves completed effect pixels on active elements and workspace snapshots', () => {
    const source = sourceDocument();
    const before = structuredClone(source);
    const next = applyEffectFrameCaptures(source, new Map([['effect-one', frame]]), 'active');
    const captured = next.elements['effect-one']!.data.frameSnapshot;
    expect(captured).toMatchObject({ ...frame, effectCompositionKey: expect.stringMatching(/^effect-frame:1:/) });
    expect(next.elements['effect-one']!.data.frameState).toBeUndefined();
    expect(next.assets[frame.assetId]).toEqual(shaderFrameCanvasAsset(frame));
    expect(next.elements['shader-one']).toBe(source.elements['shader-one']);
    const workspace = (next.metadata.designLab as CanvasJsonObject).workspace as CanvasJsonObject;
    const boards = workspace.artboards as CanvasJsonObject[];
    const active = boards[0]!.snapshot as CanvasJsonObject;
    expect((active.effectLayers as CanvasJsonObject[])[0]!.frameSnapshot).toEqual(captured);
    expect(effectFrameMatches(captured as typeof frame, active, 'effect-one')).toBe(true);
    const oldWorkspace = (source.metadata.designLab as CanvasJsonObject).workspace as CanvasJsonObject;
    expect(boards[1]).toBe((oldWorkspace.artboards as CanvasJsonObject[])[1]);
    expect(source).toEqual(before);
  });

  it('retains checkpoint identity across portable source parsing, ID remap and timeline reanchoring', () => {
    const next = applyEffectFrameCaptures(sourceDocument(), new Map([['effect-one', frame]]), 'active');
    const parsed = designLabSourceFromCanvasDocument(next);
    const workspace = parsed.workspace as CanvasJsonObject;
    const active = (workspace.artboards as CanvasJsonObject[])[0]!.snapshot as CanvasJsonObject;
    const remapped = remapDesignLabClipboardSnapshot(reanchorDesignLabClipboardSnapshot(active, 24_000), { createId: (kind) => `${kind}-copy` }).snapshot;
    const checkpoint = remapped.effectLayers[0]!.frameSnapshot as typeof frame;
    expect(effectFrameMatches(checkpoint, remapped, 'effect-copy')).toBe(true);
    expect((parsed.composition as CanvasJsonObject).effectLayers).toEqual(next.metadata.designLab && (active.effectLayers));
  });

  it('invalidates changed layouts, underlying shader pixels and converter settings', () => {
    const original = snapshot();
    const captured = { ...frame, effectCompositionKey: effectFrameCompositionKey(original, 'effect-one') };
    const moved = structuredClone(original);
    moved.shaderLayers[0]!.transform.x += 32;
    expect(effectFrameMatches(captured, moved, 'effect-one')).toBe(false);
    const changedPixels = structuredClone(original);
    changedPixels.shaderLayers[0]!.frameSnapshot.assetId = `shader-frame:${'c'.repeat(64)}`;
    expect(effectFrameMatches(captured, changedPixels, 'effect-one')).toBe(false);
    const changedEffect = structuredClone(original);
    changedEffect.effectLayers[0]!.settings.threshold = 0.8;
    expect(effectFrameMatches(captured, changedEffect, 'effect-one')).toBe(false);
    const changedColor = structuredClone(original);
    changedColor.backgroundColor = '#FFFFFF';
    expect(effectFrameMatches(captured, changedColor, 'effect-one')).toBe(false);
  });

  it('ignores names, timeline-only metadata, later layers, and converter checkpoints themselves', () => {
    const original = snapshot();
    const key = effectFrameCompositionKey(original, 'effect-one');
    const next = structuredClone(original);
    next.shaderLayers[0]!.name = 'Renamed';
    next.shaderLayers[0]!.frameState.timelineTimeMs = 8000;
    next.shaderLayers[0]!.frameSnapshot.timeMs = 8000;
    next.timeline.timeMs = 8000;
    next.textLayers[0]!.value = 'Changed after converter';
    Object.assign(next.effectLayers[0]!, { frameSnapshot: { ...frame, effectCompositionKey: key } });
    expect(effectFrameCompositionKey(next, 'effect-one')).toBe(key);
  });

  it('rejects missing effect targets, mismatched artboards and incomplete captures', () => {
    const source = sourceDocument();
    expect(() => applyEffectFrameCaptures(source, new Map([['effect-one', frame]]), 'inactive')).toThrow(/active artboard changed/);
    expect(() => applyEffectFrameCaptures(source, new Map([['shader-one', frame]]), 'active')).toThrow(/converter no longer belongs/);
    expect(() => applyEffectFrameCaptures(source, new Map([['effect-one', { ...frame, width: 0 }]]), 'active')).toThrow(/incomplete/);
    expect(() => effectFrameCompositionKey(snapshot(), 'effect-missing')).toThrow(/no longer belongs/);
    expect(applyEffectFrameCaptures(source, new Map(), 'active')).toBe(source);
  });

  it('registers standalone active converter frame assets even without workspace metadata', () => {
    const state = snapshot();
    const document = createDesignLabCanvasDocument({
      ...state, effectLayers: state.effectLayers.map((layer) => ({ ...layer, frameSnapshot: frame })),
      width: 960, height: 540, id: 'active-effect', brandId: 'gt', createdAt: '2026-09-07T00:00:00Z',
      updatedAt: '2026-09-07T00:00:00Z', title: 'Active effect', exportSettings: {}, revision: 1,
    });
    expect(document.assets[frame.assetId]).toEqual(shaderFrameCanvasAsset(frame));
    expect((designLabSourceFromCanvasDocument(document).composition as CanvasJsonObject).effectLayers).toMatchObject([{ frameSnapshot: frame }]);
  });
});
