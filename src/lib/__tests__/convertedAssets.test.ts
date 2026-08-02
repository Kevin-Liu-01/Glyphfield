import { describe, expect, it } from 'vitest';

import {
  assetExtension,
  fitAssetDimensions,
  formatAssetBytes,
  isConvertibleAsset,
  shaderSafeFileName,
} from '@/lib/convertedAssets';

describe('converted assets', () => {
  it('recognizes browser images and SVGs without trusting MIME alone', () => {
    expect(isConvertibleAsset({ name: 'mark.svg', size: 200, type: '' })).toBe(true);
    expect(isConvertibleAsset({ name: 'photo.avif', size: 200, type: 'application/octet-stream' })).toBe(true);
    expect(isConvertibleAsset({ name: 'notes.txt', size: 200, type: 'text/plain' })).toBe(false);
    expect(assetExtension('MARK.SVG')).toBe('svg');
  });

  it('fits large assets inside a shader-safe square without upscaling', () => {
    expect(fitAssetDimensions(6000, 3000, 2048)).toEqual({ height: 1024, width: 2048 });
    expect(fitAssetDimensions(400, 800, 2048)).toEqual({ height: 800, width: 400 });
  });

  it('creates predictable PNG names and compact file sizes', () => {
    expect(shaderSafeFileName('My hero artwork (final).SVG')).toBe('My-hero-artwork-final.png');
    expect(formatAssetBytes(2_450_000)).toBe('2.5 MB');
  });
});
