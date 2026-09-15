import { describe, expect, it } from 'vitest';
import { DESIGN_CANVAS_ID, designLayerWorldBounds, designSurfaceSize, packDesignWorkspace, packDesignWorkspaceJson, reparentDesignLayer, unpackDesignWorkspace, unpackDesignWorkspaceJson } from '../designWorkspace';
import { resolveDesignLabFontSize } from '../designLabTypography';

const canvas = { id: DESIGN_CANVAS_ID, x: 0, y: 0, snapshot: { dimensions: { width: 1600, height: 900 } } };
const portrait = { id: 'artboard-portrait', x: -4200, y: 5800, snapshot: { dimensions: { width: 1080, height: 1440 } } };

describe('open Design Lab workspace', () => {
  it.each(['text-copy', 'asset-photo', 'logo-mark', 'shader-material'])('preserves the world box of %s across differently sized surfaces', (id) => {
    const original = { id, fontSize: 49, transform: { x: -323.37, y: 200.16, scale: .7, widthScale: .9123, heightScale: 1.822 }, future: { keep: true } };
    const moved = reparentDesignLayer(original, portrait, canvas);
    const before = designLayerWorldBounds(portrait, original);
    const after = designLayerWorldBounds(canvas, moved);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(after[key]).toBeCloseTo(before[key], 9);
    const restored = reparentDesignLayer(moved, canvas, portrait);
    for (const key of ['x', 'y', 'widthScale', 'heightScale'] as const) expect(restored.transform[key]).toBeCloseTo(original.transform[key], 9);
    expect(moved.id).toBe(original.id);
    expect(moved.future).toBe(original.future);
    expect(original.transform.x).toBe(-323.37);
  });

  it('preserves native text sizing and dimensional effects, including legacy text', () => {
    const original = { id: 'text-quote', outlineWidth: 3, shadowBlur: 7, shadowOffsetX: -4, transform: { x: 0, y: 0, scale: .43 } };
    const moved = reparentDesignLayer(original, portrait, canvas);
    const scaleA = designSurfaceSize(portrait.snapshot.dimensions).width / 1080;
    const scaleB = designSurfaceSize(canvas.snapshot.dimensions).width / 1600;
    expect(resolveDesignLabFontSize(moved, 900) * scaleB).toBeCloseTo(resolveDesignLabFontSize(original, 1440) * scaleA, 10);
    expect(moved.outlineWidth * scaleB).toBeCloseTo(original.outlineWidth * scaleA, 10);
    expect(moved.shadowOffsetX * scaleB).toBeCloseTo(original.shadowOffsetX * scaleA, 10);
  });

  it('frames a selection at its existing world scale, not a new fitted preview scale', () => {
    const frame = { ...portrait, displayScale: .45, snapshot: { dimensions: { width: 800, height: 400 } } };
    const layer = { id: 'asset-image', imageCrop: { x: .1, y: .3, width: .6, height: .5 }, transform: { x: 12500, y: -14000, scale: 1 } };
    const moved = reparentDesignLayer(layer, canvas, frame);
    const actual = designLayerWorldBounds(frame, moved);
    const expected = designLayerWorldBounds(canvas, layer);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual[key]).toBeCloseTo(expected[key], 9);
    expect(moved.imageCrop).toBe(layer.imageCrop);
  });

  it('separates the canvas from output artboards in portable source', () => {
    const packed = packDesignWorkspace([canvas, portrait], DESIGN_CANVAS_ID);
    expect(packed.artboards).toEqual([portrait]);
    expect(packed.canvas).toBe(canvas);
    expect(packed.activeSurfaceId).toBe('canvas');
    expect(packed.activeArtboardId).toBeUndefined();
    expect(unpackDesignWorkspace(packed).artboards).toEqual([portrait, canvas]);
    expect(unpackDesignWorkspace(packed).activeArtboardId).toBe(DESIGN_CANVAS_ID);
  });

  it('allows canvas-only projects and reads legacy artboard-only source', () => {
    expect(packDesignWorkspace([canvas], DESIGN_CANVAS_ID).artboards).toEqual([]);
    expect(unpackDesignWorkspace({ activeArtboardId: portrait.id, artboards: [portrait] }).artboards).toEqual([portrait]);
  });

  it('retains inactive snapshot identity and unknown metadata during frame capture', () => {
    const source = { artboards: [portrait, canvas], activeArtboardId: DESIGN_CANVAS_ID, future: 'retained' };
    const packed = packDesignWorkspaceJson(source);
    expect((packed.artboards as unknown[])[0]).toBe(portrait);
    expect(packed.canvas).toBe(canvas);
    expect(packed.future).toBe('retained');
    expect(unpackDesignWorkspaceJson(packed).artboards).toEqual(source.artboards);
  });
});
