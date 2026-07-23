import { describe, expect, it } from 'vitest';

import { alignCanvasLayer, type CanvasLayerGeometry } from '../../components/EditableCanvasLayer';

const geometry: CanvasLayerGeometry = {
  baseHeight: 200,
  baseWidth: 400,
  baseX: 100,
  baseY: 150,
};

describe('alignCanvasLayer', () => {
  it('centers a layer against the canvas without changing its scale', () => {
    const transform = alignCanvasLayer(
      { scale: 1.5, x: 24, y: -18 },
      geometry,
      1000,
      800,
      'horizontal-center'
    );

    expect(transform).toEqual({ scale: 1.5, x: 200, y: -18 });
  });

  it('aligns scaled bounds to every canvas edge', () => {
    const transform = { scale: 1.5, x: 0, y: 0 };

    expect(alignCanvasLayer(transform, geometry, 1000, 800, 'left').x).toBe(0);
    expect(alignCanvasLayer(transform, geometry, 1000, 800, 'right').x).toBe(400);
    expect(alignCanvasLayer(transform, geometry, 1000, 800, 'top').y).toBe(-100);
    expect(alignCanvasLayer(transform, geometry, 1000, 800, 'bottom').y).toBe(400);
  });

  it('centers vertically while preserving horizontal placement', () => {
    expect(
      alignCanvasLayer(
        { scale: 0.75, x: 36, y: 12 },
        geometry,
        1000,
        800,
        'vertical-center'
      )
    ).toEqual({ scale: 0.75, x: 36, y: 150 });
  });
});
