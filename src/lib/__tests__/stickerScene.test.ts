import { describe, expect, it } from 'vitest';

import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  clampStickerPosition,
  nextStickerPlacement,
  reconcileStickerScenePlacements,
  seedStickerScene,
  stickerSceneAssets,
  stickerSceneContrastColor,
  stickerSceneContrastRadius,
  stickerSceneOutlineRadius,
  stickerTextSceneAsset,
} from '@/lib/stickerScene';

function identityWithAssets(): BrandIdentity {
  return {
    assets: [
      { id: 'texture', label: 'Texture', path: '/texture.png', surface: 'any', type: 'texture' },
      { id: 'mark', label: 'Mark', path: '/mark.svg', surface: 'dark', type: 'logo' },
      { id: 'duplicate', label: 'Duplicate mark', path: '/mark.svg', surface: 'light', type: 'icon' },
      { id: 'icon', label: 'Icon', path: '/icon.png?version=2', surface: 'any', type: 'icon' },
      { id: 'pdf', label: 'PDF', path: '/guide.pdf', surface: 'any', type: 'proof' },
    ],
    proofAssets: [
      { id: 'proof', label: 'Proof', path: 'data:image/svg+xml,test', surface: 'any', type: 'proof' },
    ],
  } as BrandIdentity;
}

describe('sticker scene', () => {
  it('builds a prioritized, deduplicated palette and excludes the primary logo when alternatives exist', () => {
    expect(stickerSceneAssets(identityWithAssets(), '/mark.svg').map(({ id }) => id)).toEqual(['icon', 'proof']);
  });

  it('creates deterministic placements without covering the center hero mark', () => {
    const assets = stickerSceneAssets(identityWithAssets());
    const first = seedStickerScene(assets);
    expect(first).toEqual(seedStickerScene(assets));
    expect(first.every(({ x, y }) => Math.abs(x - 50) > 20 || Math.abs(y - 50) > 20)).toBe(true);
    expect(nextStickerPlacement('icon', 3, 8)).toEqual(nextStickerPlacement('icon', 3, 8));
  });

  it('keeps dragged stickers inside the usable metal surface', () => {
    expect(clampStickerPosition(-20, 110)).toEqual({ x: 7, y: 92 });
    expect(clampStickerPosition(48, 52)).toEqual({ x: 48, y: 52 });
  });

  it('removes stale and duplicate placements before preview, source, and export consume them', () => {
    const assets = stickerSceneAssets(identityWithAssets());
    expect(reconcileStickerScenePlacements([
      { assetId: 'missing', id: 'stale', rotation: 0, scale: 20, x: 10, y: 10, z: 1 },
      { assetId: assets[0]!.id, id: 'kept', rotation: 4, scale: 24, x: 30, y: 40, z: 2 },
      { assetId: assets[1]!.id, id: 'kept', rotation: 9, scale: 18, x: 60, y: 70, z: 3 },
    ], assets)).toEqual([
      { assetId: assets[0]!.id, id: 'kept', rotation: 4, scale: 24, x: 30, y: 40, z: 2 },
    ]);
  });

  it('maps the cut-border control to a crisp, bounded alpha dilation', () => {
    expect(stickerSceneOutlineRadius(2)).toBe(1);
    expect(stickerSceneOutlineRadius(14)).toBe(3.5);
    expect(stickerSceneOutlineRadius(32)).toBe(8);
  });

  it('adds an opposing ink keyline so pale artwork remains visible against a pale cut border', () => {
    expect(stickerSceneContrastColor('#F7F7F2')).toBe('#14171A');
    expect(stickerSceneContrastColor('#111111')).toBe('#F7F7F2');
    expect(stickerSceneContrastRadius(2, 15)).toBeGreaterThan(0.5);
    expect(stickerSceneContrastRadius(12, 2)).toBeLessThan(stickerSceneOutlineRadius(2));
  });

  it('builds independently addressable multiline text sticker assets with authentic typography settings', () => {
    const first = stickerTextSceneAsset({
      align: 'left',
      color: '#F7F7F2',
      fontFamily: 'GT America & Friends',
      id: 'sticker-text-first',
      label: 'First label',
      lineHeight: 1.1,
      text: 'One & only\n<proof>',
      tracking: 0.05,
      weight: 800,
    });
    const second = stickerTextSceneAsset({
      align: 'center',
      color: '#111111',
      fontFamily: 'Switzer',
      id: 'sticker-text-second',
      label: 'Second label',
      lineHeight: 1,
      text: 'Two',
      tracking: -0.04,
      weight: 500,
    });
    const decoded = decodeURIComponent(first.path.split(',')[1] ?? '');

    expect(first.id).toBe('sticker-text-first');
    expect(second.id).toBe('sticker-text-second');
    expect(first.kind).toBe('text');
    expect(first.aspectRatio).toBeGreaterThan(1);
    expect(decoded).toContain('font-family="GT America &amp; Friends,Arial,sans-serif"');
    expect(decoded).toContain('font-weight="800"');
    expect(decoded).toContain('letter-spacing="0.05em"');
    expect(decoded).toContain('One &amp; only');
    expect(decoded).toContain('&lt;proof&gt;');
    expect(decoded.match(/<text /g)).toHaveLength(2);
  });
});
