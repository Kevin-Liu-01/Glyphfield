import { describe, expect, it } from 'vitest';

import { DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import { OPEN_SURFACE_LIBRARY } from '../openSurfaceLibrary';
import {
  surfaceChannelInventory,
  surfaceTextureCacheKey,
} from '../surfaceRendering';

describe('surface rendering pipeline', () => {
  it('keeps lighting response changes out of the CPU texture-generation pass', () => {
    const initialKey = surfaceTextureCacheKey(DEFAULT_BACKGROUND_SETTINGS);

    for (const patch of [
      { surfaceDepth: 84 },
      { surfaceMetallic: 92 },
      { surfaceRoughness: 12 },
    ]) {
      expect(surfaceTextureCacheKey({ ...DEFAULT_BACKGROUND_SETTINGS, ...patch })).toBe(initialKey);
    }
  });

  it('invalidates generated textures for every construction input', () => {
    const initialKey = surfaceTextureCacheKey(DEFAULT_BACKGROUND_SETTINGS);
    const changes = [
      { colorA: '#112233' },
      { colorB: '#223344' },
      { colorC: '#334455' },
      { surfaceAngle: 91 },
      { surfaceIrregularity: 91 },
      { surfaceMaterial: 'linen-weave' as const },
      { surfaceOpenArea: 91 },
      { surfaceScale: 91 },
      { surfaceTextureAmount: 91 },
    ];

    for (const patch of changes) {
      expect(surfaceTextureCacheKey({ ...DEFAULT_BACKGROUND_SETTINGS, ...patch })).not.toBe(initialKey);
    }
  });

  it('describes mapped and fallback PBR channels accurately', () => {
    expect(surfaceChannelInventory()).toEqual([
      { id: 'color', label: 'Color', mode: 'generated' },
      { id: 'normal', label: 'Normal', mode: 'unused' },
      { id: 'height', label: 'Height', mode: 'generated' },
      { id: 'roughness', label: 'Rough', mode: 'uniform' },
      { id: 'metalness', label: 'Metal', mode: 'uniform' },
    ]);

    const metal = OPEN_SURFACE_LIBRARY.find(({ id }) => id === 'polyhaven-metal-plate');
    expect(surfaceChannelInventory(metal).every(({ mode }) => mode === 'map')).toBe(true);
  });
});
