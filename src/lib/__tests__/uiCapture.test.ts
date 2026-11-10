import { describe, expect, it } from 'vitest';

import { designLayerGeometry } from '../designWorkspace';
import { canvasLayerBounds } from '../canvasInteraction';
import { SHADER_LAB_LOADABLE_MATERIAL_IDS } from '../shaderLab';
import {
  describeUiCapturePresets,
  resolveUiCaptureRequest,
  uiCaptureArtboardSnapshot,
  uiCaptureBox,
  uiCaptureBrandGround,
  uiCaptureImageRadius,
  UI_CAPTURE_PRESETS,
} from '../uiCapture';

const SEQUENCE = { durationMs: 6000, sequenceOffset: 0 } as never;
const BRAND = ['#070707', '#2F5CE0', '#F4F4F4'] as const;

describe('UI capture', () => {
  it('names only loadable materials in its presets', () => {
    for (const preset of UI_CAPTURE_PRESETS) expect(SHADER_LAB_LOADABLE_MATERIAL_IDS.has(preset.materialId), preset.id).toBe(true);
    expect(describeUiCapturePresets().presets.map(({ id }) => id)).toContain('purple-grain');
  });

  it('resolves a preset, lets fields override it, and keeps 16:9', () => {
    const request = resolveUiCaptureRequest({ preset: 'purple-grain', settings: { grain: 70 }, width: 1920 });
    expect(request).toMatchObject({ materialId: 'paper-grain-gradient', presetId: 'purple-grain', size: { height: 1080, width: 1920 } });
    expect(request.settings).toEqual({ grain: 70, speed: 0.3 });
    expect(request.palette).toEqual(['#2B1466', '#7B5CF5', '#E6DCFF']);
    const custom = resolveUiCaptureRequest({ materialId: 'paper-warp', palette: ['#000000', '#111111', '#222222'] });
    expect(custom).toMatchObject({ materialId: 'paper-warp', presetId: null });
    expect(resolveUiCaptureRequest({}).presetId).toBe('brand-grain');
    expect(resolveUiCaptureRequest({ width: 1000 }).size).toEqual({ height: 567, width: 1008 });
  });

  it('rejects unknown fields, presets, materials, colors and a free height', () => {
    expect(() => resolveUiCaptureRequest({ url: 'https://example.com' })).toThrow(/Unknown design.capture field: url/);
    expect(() => resolveUiCaptureRequest({ preset: 'nope' })).toThrow(/Unknown capture preset/);
    expect(() => resolveUiCaptureRequest({ materialId: 'not-a-material' })).toThrow(/materialId/);
    expect(() => resolveUiCaptureRequest({ palette: ['red', 'green', 'blue'] })).toThrow(/palette/);
    expect(() => resolveUiCaptureRequest({ settings: { colorA: '#FFFFFF' } })).toThrow(/Set colors with palette/);
    expect(() => resolveUiCaptureRequest({ height: 900 })).toThrow(/16:9/);
    expect(() => resolveUiCaptureRequest({ width: 400 })).toThrow(/width/);
  });

  it('fits the capture inside the padding, centered, and scales its corner radius to its pixels', () => {
    const box = uiCaptureBox({ height: 900, width: 1600 }, { height: 1000, width: 2000 }, 0.1);
    // A 2:1 capture is width-limited: 90 px of padding on each side.
    expect(box.width).toBeCloseTo(1600 - 180);
    expect(box.height).toBeCloseTo((1600 - 180) / 2);
    expect(box.x + box.width / 2).toBeCloseTo(800);
    expect(uiCaptureImageRadius(14, { width: 2000 }, 1000)).toBe(28);
  });

  it('builds an artboard with a full-bleed ground under the capture', () => {
    let next = 0;
    const request = resolveUiCaptureRequest({ preset: 'brand-mesh', shadow: false });
    const snapshot = uiCaptureArtboardSnapshot({
      brandPalette: BRAND,
      createId: () => String(++next),
      image: { height: 1000, url: 'data:image/png;base64,AA==', width: 2000 },
      request,
      shaderSequence: SEQUENCE,
    });
    expect(snapshot.layerOrder).toEqual(['shader-1', 'asset-2']);
    expect(snapshot.dimensions).toEqual({ height: 900, width: 1600 });
    expect(snapshot.ratio).toBe('wide');
    expect(snapshot.shaderSequence.targetLayerId).toBe('shader-1');
    expect(snapshot.shaderLayers[0]).toMatchObject({ materialId: 'paper-mesh-gradient', transform: { scale: 1, x: 0, y: 0 } });
    // A brand ground starts from the accent, with a tint and a shade of it.
    expect(snapshot.shaderLayers[0]!.settings.colorA).toBe(BRAND[1]);
    expect(uiCaptureBrandGround(BRAND)[0]).toBe(BRAND[1]);
    const capture = snapshot.assets[0]!;
    expect(capture.appearance?.shadowEnabled).toBe(false);
    // The GT accent is a mid blue, not a dark ground, so no light edge.
    expect(capture.appearance?.borderEnabled).toBe(false);
    const dark = uiCaptureArtboardSnapshot({ brandPalette: BRAND, image: { height: 10, url: 'data:image/png;base64,AA==', width: 10 }, request: resolveUiCaptureRequest({ palette: ['#0A0A0A', '#222222', '#444444'] }), shaderSequence: SEQUENCE });
    expect(dark.assets[0]!.appearance?.borderEnabled).toBe(true);
    const bounds = canvasLayerBounds(capture.transform, designLayerGeometry(capture.id, snapshot.dimensions));
    const expected = uiCaptureBox(snapshot.dimensions, { height: 1000, width: 2000 }, request.padding);
    expect(bounds.left).toBeCloseTo(expected.x);
    expect(bounds.top).toBeCloseTo(expected.y);
    expect(bounds.width).toBeCloseTo(expected.width);
    expect(bounds.height).toBeCloseTo(expected.height);
  });
});
