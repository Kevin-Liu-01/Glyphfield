import { describe, expect, it } from 'vitest';

import {
  OPEN_SURFACE_LIBRARY,
  openSurfaceMapPath,
  openSurfaceRemoteMapUrl,
} from '../openSurfaceLibrary';

describe('open surface library', () => {
  it('publishes unique, source-linked CC0 PBR assets', () => {
    expect(new Set(OPEN_SURFACE_LIBRARY.map(({ id }) => id)).size).toBe(OPEN_SURFACE_LIBRARY.length);
    expect(OPEN_SURFACE_LIBRARY.length).toBeGreaterThanOrEqual(10);

    for (const asset of OPEN_SURFACE_LIBRARY) {
      expect(asset.license).toBe('CC0 1.0');
      expect(asset.sourceUrl).toMatch(/^https:\/\//);
      expect(asset.mapNames).toHaveProperty('color');
      expect(asset.mapNames).toHaveProperty('normal');
      expect(asset.mapNames).toHaveProperty('roughness');
    }
  });

  it('resolves provider-hosted map URLs through a same-origin route', () => {
    for (const asset of OPEN_SURFACE_LIBRARY) {
      expect(openSurfaceMapPath(asset.id, 'color')).toBe(`/api/surface-textures/${asset.id}/color`);
      const remote = openSurfaceRemoteMapUrl(asset, 'color');
      expect(remote).toMatch(
        asset.provider === 'Poly Haven'
          ? /^https:\/\/dl\.polyhaven\.org\//
          : /^https:\/\/f003\.backblazeb2\.com\/file\/ambientCG-Web\//
      );
    }
  });
});
