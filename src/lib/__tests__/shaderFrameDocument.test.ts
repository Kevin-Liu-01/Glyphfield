import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseCanvasDocument, type CanvasDocument, type CanvasJsonObject } from '../canvasDocument';
import { createDesignLabCanvasDocument, designLabSourceFromCanvasDocument } from '../designLabDocument';
import { createShaderFrameAsset, clearShaderFrameAssetCache, exportShaderFrameAsset, shaderFrameCanvasAsset } from '../shaderFrameAssets';
import { applyShaderFrameCaptures, prepareShaderFrameDocumentSource, type ShaderFrameCapture } from '../shaderFrameDocument';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const frameSnapshot = { assetId: `shader-frame:${'a'.repeat(64)}`, height: 1, version: 1 as const, width: 1 };
const frameState = { engine: 'paper' as const, frame: 412.75, materialId: 'paper-gem-smoke', timelineTimeMs: 700, version: 2 as const };
const capture: ShaderFrameCapture = { frameSnapshot, frameState };
const options = { activeArtboardId: 'active', timeline: { frame: 21, paused: true, timeMs: 700.125 } };

function sourceDocument(): CanvasDocument {
  const shader = { id: 'shader-background', materialId: 'paper-gem-smoke', name: 'Background', settings: { colorA: '#333333' }, transform: { scale: 1, x: 0, y: 0 }, futureLayerField: 'retain' };
  const application = { materialId: 'paper-gem-smoke', settings: { colorA: '#FFFFFF' }, futureApplicationField: 'retain' };
  const snapshot = { shaderLayers: [shader], layerShaders: { 'text-label': application }, timeline: { frame: 0, paused: false, futureTimeline: true }, futureSnapshotField: 'retain' };
  const document = createDesignLabCanvasDocument({
    assets: [], backgroundColor: '#111111', brandId: 'gt', createdAt: '2026-09-07T00:00:00.000Z',
    effectLayers: [], exportSettings: { durationMs: 1600, fps: 30 }, groups: [], height: 540,
    id: 'capture-test', layerOrder: ['shader-background', 'text-label'], layerShaders: { 'text-label': application },
    logos: [], ratio: 'wide', revision: 9, shaderLayers: [shader], shaderSequence: {},
    textLayers: [{ id: 'text-label', name: 'Label', value: 'Hello', transform: { x: 120, y: 80, scale: 0.4 } }],
    timeline: { frame: 0, paused: false, futureTimeline: true }, title: 'Capture test', updatedAt: '2026-09-07T00:00:00.000Z', width: 960,
    workspace: { activeArtboardId: 'active', artboards: [
      { id: 'active', snapshot, x: 20, y: 30, futureArtboardField: 'retain' },
      { id: 'inactive', snapshot: structuredClone(snapshot), x: 900, y: 30 },
    ], futureWorkspaceField: 'retain' },
  });
  return { ...document, metadata: { ...document.metadata, futureDocumentMetadata: { retained: true } } };
}

describe('captured shader frame document transactions', () => {
  afterEach(() => {
    clearShaderFrameAssetCache();
    vi.unstubAllGlobals();
  });

  it('immutably aligns active canvas, content application and active artboard representations', () => {
    const input = sourceDocument();
    const before = structuredClone(input);
    const captures = new Map([['canvas-shader-background', capture], ['content-text-label', capture]]);
    const result = applyShaderFrameCaptures(input, captures, options);
    expect(input).toEqual(before);
    expect(result.revision).toBe(input.revision + 1);
    expect(result.elements['shader-background']?.data).toMatchObject({ ...capture, futureLayerField: 'retain' });
    expect(result.elements['text-label']).toBe(input.elements['text-label']);
    const source = designLabSourceFromCanvasDocument(result);
    const composition = source.composition as CanvasJsonObject;
    expect((composition.layerShaders as CanvasJsonObject)['text-label']).toMatchObject({ ...capture, futureApplicationField: 'retain' });
    const workspace = source.workspace as CanvasJsonObject;
    const artboards = workspace.artboards as CanvasJsonObject[];
    const active = artboards[0]!.snapshot as CanvasJsonObject;
    expect((active.shaderLayers as CanvasJsonObject[])[0]).toMatchObject(capture);
    expect((active.layerShaders as CanvasJsonObject)['text-label']).toMatchObject(capture);
    expect(active.timeline).toEqual({ frame: 21, paused: true, timeMs: 700.125, futureTimeline: true });
    expect(active.futureSnapshotField).toBe('retain');
    expect(workspace.futureWorkspaceField).toBe('retain');
    const oldWorkspace = (input.metadata.designLab as CanvasJsonObject).workspace as CanvasJsonObject;
    expect(artboards[1]).toBe((oldWorkspace.artboards as CanvasJsonObject[])[1]);
    expect(result.metadata.futureDocumentMetadata).toEqual({ retained: true });
    expect(result.assets[frameSnapshot.assetId]).toEqual(shaderFrameCanvasAsset(frameSnapshot));
    expect(source.timeline).toEqual({ frame: 21, paused: true, timeMs: 700.125, futureTimeline: true });
  });

  it('retains an existing embedded PNG rather than replacing it with a runtime locator', () => {
    const input = sourceDocument();
    const embedded = { ...shaderFrameCanvasAsset(frameSnapshot), source: `data:image/png;base64,${PNG}`, byteLength: Buffer.from(PNG, 'base64').length };
    input.assets[embedded.id] = embedded;
    const result = applyShaderFrameCaptures(input, new Map([['canvas-shader-background', capture]]), options);
    expect(result.assets[embedded.id]).toBe(embedded);
    expect(Object.keys(result.assets)).toEqual([embedded.id]);
  });

  it('fails closed if async capture no longer matches the active artboard or shader recipe', () => {
    const document = sourceDocument();
    expect(() => applyShaderFrameCaptures(document, new Map(), { ...options, activeArtboardId: 'inactive' })).toThrow(/artboard changed/);
    expect(() => applyShaderFrameCaptures(document, new Map([['canvas-removed', capture]]), options)).toThrow(/no longer belongs/);
    expect(() => applyShaderFrameCaptures(document, new Map([['canvas-shader-background', {
      ...capture, frameState: { ...frameState, materialId: 'paper-warp' },
    }]]), options)).toThrow(/shader changed/);
    expect(() => applyShaderFrameCaptures(document, new Map(), { ...options, timeline: { frame: -1, paused: true } })).toThrow(/timeline is invalid/);
    expect(() => applyShaderFrameCaptures(document, new Map(), { ...options, timeline: { frame: 1, paused: true, timeMs: -1 } })).toThrow(/capture time/);
  });

  it('produces portable source directly from durable blobs without waiting for a React render', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('crypto', webcrypto);
    const blob = new Blob([Uint8Array.from(Buffer.from(PNG, 'base64'))], { type: 'image/png' });
    const persistedSnapshot = await createShaderFrameAsset(blob, { height: 1, width: 1 });
    const captured = applyShaderFrameCaptures(sourceDocument(), new Map([['canvas-shader-background', {
      frameState, frameSnapshot: persistedSnapshot,
    }]]), options);
    const source = await prepareShaderFrameDocumentSource(captured);
    const restored = parseCanvasDocument(source);
    expect(restored.assets[persistedSnapshot.assetId]).toEqual(await exportShaderFrameAsset(persistedSnapshot));
    expect(restored.elements['shader-background']!.data.frameSnapshot).toEqual(persistedSnapshot);
    expect(source).not.toContain('glyphfield-shader-frame:');
    expect(source).not.toContain('blob:');
    expect(restored.revision).toBe(captured.revision);
  });
});
