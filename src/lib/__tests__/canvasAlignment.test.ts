import { describe, expect, it } from 'vitest';

import {
  alignCanvasLayer,
  alignCanvasSelection,
  canvasLayerDimensions,
  canvasSelectionBounds,
  isAdditiveCanvasSelection,
  nextCanvasLayerSelection,
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

  it('aligns independently resized text boxes without changing font scale', () => {
    const transform = {
      heightScale: 1.4,
      scale: 0.8,
      widthScale: 0.5,
      x: 0,
      y: 0,
    };

    expect(canvasLayerDimensions(transform, geometry)).toEqual({ height: 280, width: 200 });
    expect(alignCanvasLayer(transform, geometry, 1000, 800, 'right')).toEqual({
      ...transform,
      x: 600,
    });
  });
});

describe('canvas assembly geometry', () => {
  const assembly = [
    {
      geometry: { baseHeight: 100, baseWidth: 200, baseX: 100, baseY: 200 },
      transform: { scale: 1, x: 0, y: 0 },
    },
    {
      geometry: { baseHeight: 160, baseWidth: 120, baseX: 600, baseY: 420 },
      transform: { scale: 0.5, x: 20, y: -20 },
    },
  ];

  it('uses the union of every selected layer as the group bounds', () => {
    expect(canvasSelectionBounds(assembly)).toEqual({
      bottom: 520,
      centerX: 405,
      centerY: 360,
      height: 320,
      left: 100,
      right: 710,
      top: 200,
      width: 610,
    });
  });

  it('centers the group as one assembly while preserving child spacing', () => {
    const next = alignCanvasSelection(assembly, 1_200, 800, 'horizontal-center');

    expect(next).toEqual([
      { scale: 1, x: 195, y: 0 },
      { scale: 0.5, x: 215, y: -20 },
    ]);
    expect(next[1]!.x - next[0]!.x).toBe(20);
    expect(canvasSelectionBounds(assembly.map((item, index) => ({
      ...item,
      transform: next[index]!,
    })))?.centerX).toBe(600);
  });

  it('aligns the full assembly to the canvas edge', () => {
    const next = alignCanvasSelection(assembly, 1_200, 800, 'bottom');
    const nextBounds = canvasSelectionBounds(assembly.map((item, index) => ({
      ...item,
      transform: next[index]!,
    })));

    expect(nextBounds?.bottom).toBe(800);
    expect(next[0]!.y).toBe(280);
    expect(next[1]!.y).toBe(260);
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
  it('preserves every selected layer when a drag begins from one selected member', () => {
    expect(nextCanvasLayerSelection(['text-1', 'text-2'], ['text-1'], 'text-1', false))
      .toEqual(['text-1', 'text-2']);
  });

  it('starts a new selection when the pointer begins outside the active selection', () => {
    expect(nextCanvasLayerSelection(['text-1', 'text-2'], ['logo-1'], 'logo-1', false))
      .toEqual(['logo-1']);
  });

  it.each([
    ['Command', { ctrlKey: false, metaKey: true, shiftKey: false }],
    ['Control', { ctrlKey: true, metaKey: false, shiftKey: false }],
    ['Shift', { ctrlKey: false, metaKey: false, shiftKey: true }],
  ])('treats %s as an additive selection modifier', (_label, modifiers) => {
    expect(isAdditiveCanvasSelection(modifiers)).toBe(true);
  });

  it('keeps an ordinary click as a single selection', () => {
    expect(isAdditiveCanvasSelection({ ctrlKey: false, metaKey: false, shiftKey: false })).toBe(false);
  });

  it('deselects only a stationary second click on a selected layer', () => {
    expect(shouldDeselectCanvasLayer('pointerup', 'move', true, false)).toBe(true);
    expect(shouldDeselectCanvasLayer('pointerup', 'move', true, true)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointerup', 'move', false, false)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointerup', 'resize', true, false)).toBe(false);
    expect(shouldDeselectCanvasLayer('pointercancel', 'move', true, false)).toBe(false);
  });
});
