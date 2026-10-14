import { describe, expect, it } from 'vitest';

import type { CompositionAsset, CompositionLogoLayer, CompositionShaderLayer, CompositionTextLayer } from '../designLabModel';
import { applyDesignLabLayerStyle, extractDesignLabLayerStyle } from '../designLabStyle';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';

const text = (id: `text-${string}`, overrides: Partial<CompositionTextLayer> = {}): CompositionTextLayer => ({
  align: 'center', id, lineHeight: 1, name: id, tracking: 0, transform: { scale: 1, x: 10, y: 20 },
  value: 'Hello world', visible: true, weight: 400, wrap: 'wrap', ...overrides,
});
const shader: CompositionShaderLayer = {
  blendMode: 'screen', frameState: undefined, id: 'shader-a', materialId: 'paper-gem-smoke', name: 'Shader',
  opacity: 0.6, settings: { ...DEFAULT_LIVE_MATERIAL_SETTINGS, colorA: '#FF0000' }, shaderSize: 2,
  transform: { scale: 1, x: 0, y: 0 }, visible: true,
};

describe('Design Lab copy and paste style', () => {
  it('copies text appearance but never content, geometry, name, visibility or lock', () => {
    const source = text('text-source', { color: '#FF5500', fontSize: 96, locked: true, opacity: 0.5, shadowEnabled: true, weight: 700 });
    const target = text('text-target', { runs: [{ end: 5, start: 0, style: { color: '#00FF00', underline: true } }], value: 'Other copy' });
    const { layer } = applyDesignLabLayerStyle(target, extractDesignLabLayerStyle(source));
    expect(layer).toMatchObject({ color: '#FF5500', fontSize: 96, opacity: 0.5, shadowEnabled: true, weight: 700 });
    expect(layer).toMatchObject({ id: 'text-target', name: 'text-target', transform: target.transform, value: 'Other copy', visible: true });
    expect(layer.locked).toBeUndefined();
    // Inline overrides for pasted properties give way; others stay.
    expect(layer.runs).toEqual([{ end: 5, start: 0, style: { underline: true } }]);
  });

  it('moves a shader look between shader layers without captured frames', () => {
    const target: CompositionShaderLayer = { ...shader, frameSnapshot: { assetId: 'shader-frame:x', height: 1, version: 1, width: 1 }, id: 'shader-b', materialId: 'holo-cloth-silk' };
    const { layer } = applyDesignLabLayerStyle(target, extractDesignLabLayerStyle(shader));
    expect(layer).toMatchObject({ blendMode: 'screen', id: 'shader-b', materialId: 'paper-gem-smoke', opacity: 0.6, shaderSize: 2 });
    expect(layer.settings.colorA).toBe('#FF0000');
    expect(layer.frameSnapshot).toBeUndefined();
  });

  it('pastes a shader layer as a material onto content layers', () => {
    const result = applyDesignLabLayerStyle(text('text-target'), extractDesignLabLayerStyle(shader));
    expect(result.material).toMatchObject({ blendMode: 'screen', materialId: 'paper-gem-smoke', shaderSize: 2 });
    expect(result.layer.opacity).toBeUndefined();
  });

  it('shares appearance and opacity across marks and images, color only between marks', () => {
    const mark: CompositionLogoLayer = {
      appearance: { borderEnabled: true } as CompositionLogoLayer['appearance'], color: '#123456', id: 'logo-a', name: 'Mark',
      opacity: 0.4, transform: { scale: 1, x: 0, y: 0 }, url: 'data:image/svg+xml,', visible: true,
    };
    const image: CompositionAsset = { id: 'asset-a', kind: 'image', name: 'Photo', transform: { scale: 1, x: 5, y: 5 }, url: 'data:image/png;base64,', visible: true };
    const restyled = applyDesignLabLayerStyle(image, extractDesignLabLayerStyle(mark)).layer;
    expect(restyled).toMatchObject({ appearance: { borderEnabled: true }, opacity: 0.4, transform: image.transform });
    expect(restyled).not.toHaveProperty('color');
    const otherMark = applyDesignLabLayerStyle({ ...mark, color: '#FFFFFF', id: 'logo-b' }, extractDesignLabLayerStyle(mark)).layer;
    expect(otherMark.color).toBe('#123456');
  });
});
