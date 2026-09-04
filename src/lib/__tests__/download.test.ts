import { describe, expect, it } from 'vitest';

import { resolveSvgRasterDimensions } from '@/lib/download';

describe('SVG raster exports', () => {
  it('renders common Studio artboards at two physical pixels per logical pixel', () => {
    expect(resolveSvgRasterDimensions(1200, 630)).toEqual({
      height: 1260,
      pixelRatio: 2,
      width: 2400,
    });
    expect(resolveSvgRasterDimensions(1600, 900)).toEqual({
      height: 1800,
      pixelRatio: 2,
      width: 3200,
    });
  });

  it('does not inflate an artboard that is already at the safe raster limit', () => {
    expect(resolveSvgRasterDimensions(4800, 3200)).toEqual({
      height: 3200,
      pixelRatio: 1,
      width: 4800,
    });
  });
});
