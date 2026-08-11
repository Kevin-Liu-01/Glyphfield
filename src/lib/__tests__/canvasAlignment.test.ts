import { describe, expect, it } from 'vitest';

import {
  alignCanvasLayer,
  shouldDeselectCanvasLayer,
  snapCanvasLayer,
  type CanvasLayerGeometry,
} from '../../components/EditableCanvasLayer';

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

describe('snapCanvasLayer', () => {
  it('snaps the center of a moving layer to a canvas guide', () => {
    const result = snapCanvasLayer(
      { scale: 1, x: 198, y: 0 },
      geometry,
      { x: [0, 500, 1000], y: [0, 400, 800] },
      6,
      6
    );

    expect(result.transform.x).toBe(200);
    expect(result.guides.x).toBe(500);
  });

  it('snaps edges to sibling layer guides on both axes', () => {
    const result = snapCanvasLayer(
      { scale: 1, x: 257, y: 147 },
      geometry,
      { x: [760], y: [500] },
      6,
      6
    );

    expect(result.transform).toEqual({ scale: 1, x: 260, y: 150 });
    expect(result.guides).toEqual({ x: 760, y: 500 });
  });

  it('leaves placement alone outside the snap threshold', () => {
    const transform = { scale: 0.75, x: 40, y: 20 };
    const result = snapCanvasLayer(
      transform,
      geometry,
      { x: [900], y: [700] },
      6,
      6
    );

    expect(result.transform).toEqual(transform);
    expect(result.guides).toEqual({ x: null, y: null });
  });
});

describe('canvas layer selection', () => {
  it('deselects only a stationary second click on a selected layer', () => {
    expect(shouldDeselectCanvasLayer('pointerup', 'move', true, false)).toBe(true);
    expect(shouldDeselectCanvasLayer('pointerup', 'move', true, true)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointerup', 'move', false, false)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointerup', 'resize', true, false)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointercancel', 'move', true, false)).toBe(false);
  });
});
