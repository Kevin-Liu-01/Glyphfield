import { describe, expect, it } from 'vitest';

import {
  canvasLayerBounds,
  canvasLayerHullBounds,
  canvasRotationFromPointer,
  canvasSelectionBounds,
  canvasThirdsSnapTargets,
  normalizeCanvasLayerTransform,
  normalizeCanvasRotation,
  resizeCanvasLayerBox,
  rotateCanvasVector,
  rotatedCanvasExtent,
  sameCanvasLayerBox,
  withCanvasLayerRotation,
  type CanvasLayerGeometry,
} from '../canvasInteraction';

const geometry: CanvasLayerGeometry = { baseHeight: 100, baseWidth: 200, baseX: 0, baseY: 0 };

function close(value: number, expected: number) {
  expect(value).toBeCloseTo(expected, 6);
}

describe('canvas rotation', () => {
  it('loads transforms saved before rotation existed at 0 and keeps one spelling for the rest', () => {
    const fallback = { scale: 1, x: 0, y: 0 };
    expect(normalizeCanvasLayerTransform({ scale: 0.5, x: 10, y: 20 }, fallback)).toEqual({ scale: 0.5, x: 10, y: 20 });
    expect(normalizeCanvasLayerTransform({ rotation: 270, scale: 1, x: 0, y: 0 }, fallback)).toEqual({ rotation: -90, scale: 1, x: 0, y: 0 });
    expect(normalizeCanvasLayerTransform({ rotation: 360, scale: 1, x: 0, y: 0 }, fallback)).toEqual(fallback);
    expect(normalizeCanvasLayerTransform({ rotation: Number.NaN, scale: 1, x: 0, y: 0 }, fallback)).toEqual(fallback);
    expect(withCanvasLayerRotation({ rotation: 30, scale: 2, x: 1, y: 2 }, -45)).toEqual({ rotation: -45, scale: 2, x: 1, y: 2 });
    expect(withCanvasLayerRotation({ rotation: 30, scale: 2, x: 1, y: 2 }, 0)).toEqual({ scale: 2, x: 1, y: 2 });
  });

  it('measures selections by what rotated layers cover', () => {
    const unrotated = canvasLayerBounds({ scale: 1, x: 0, y: 0 }, geometry);
    const turned = canvasLayerHullBounds({ rotation: 90, scale: 1, x: 0, y: 0 }, geometry);
    close(turned.width, 100);
    close(turned.height, 200);
    close(turned.centerX, unrotated.centerX);
    close(turned.left, 50);
    const selection = canvasSelectionBounds([
      { geometry, transform: { rotation: 90, scale: 1, x: 0, y: 0 } },
      { geometry, transform: { scale: 1, x: 300, y: 0 } },
    ])!;
    close(selection.left, 50);
    close(selection.top, -50);
    close(selection.bottom, 150);
  });

  it('normalizes to one spelling in (-180, 180]', () => {
    expect(normalizeCanvasRotation(0)).toBe(0);
    expect(normalizeCanvasRotation(-0)).toBe(0);
    expect(normalizeCanvasRotation(190)).toBe(-170);
    expect(normalizeCanvasRotation(-180)).toBe(180);
    expect(normalizeCanvasRotation(720 + 45)).toBe(45);
    expect(normalizeCanvasRotation(Number.NaN)).toBe(0);
  });

  it('adds the angle the pointer sweeps around the center, in steps when asked', () => {
    const center = { x: 100, y: 100 };
    close(canvasRotationFromPointer(0, center, { x: 100, y: 0 }, { x: 200, y: 100 }), 90);
    close(canvasRotationFromPointer(30, center, { x: 200, y: 100 }, { x: 100, y: 0 }), -60);
    expect(canvasRotationFromPointer(0, center, { x: 200, y: 100 }, { x: 200, y: 122 }, 15)).toBe(15);
    expect(canvasRotationFromPointer(170, center, { x: 200, y: 100 }, { x: 200, y: 140 })).toBeLessThan(0);
  });

  it('rotates vectors and measures the rotated hull', () => {
    const turned = rotateCanvasVector({ x: 10, y: 0 }, 90);
    close(turned.x, 0);
    close(turned.y, 10);
    expect(rotatedCanvasExtent(200, 100, 0)).toEqual({ height: 100, width: 200 });
    const quarter = rotatedCanvasExtent(200, 100, 90);
    close(quarter.width, 100);
    close(quarter.height, 200);
  });

  it('resizes an unrotated box exactly as before and a rotated one along its own sides', () => {
    const start = { scale: 1, x: 0, y: 0 };
    expect(resizeCanvasLayerBox(start, geometry, 'resize-right', { x: 40, y: 15 })).toEqual({
      heightScale: 1, scale: 1, widthScale: 1.2, x: expect.closeTo(20, 9), y: 0,
    });
    expect(resizeCanvasLayerBox(start, geometry, 'resize-top-left', { x: 20, y: 10 })).toEqual({
      heightScale: expect.closeTo(0.9, 9), scale: 1, widthScale: expect.closeTo(0.9, 9), x: expect.closeTo(10, 9), y: expect.closeTo(5, 9),
    });
    // Rotated 90°, the layer's right side faces down: a downward drag widens it,
    // and its center moves down by half the growth so the left side stays put.
    const rotated = resizeCanvasLayerBox(start, geometry, 'resize-right', { x: 0, y: 40 }, 90);
    close(rotated.widthScale!, 1.2);
    close(rotated.heightScale!, 1);
    close(rotated.x, 0);
    close(rotated.y, 20);
  });

  it('offers rule-of-thirds lines and treats re-based geometry as the same box', () => {
    expect(canvasThirdsSnapTargets(900, 600)).toEqual({ x: [300, 600], y: [200, 400] });
    const committed = { geometry, transform: { scale: 1.5, x: 30, y: -12 } };
    const bounds = canvasLayerBounds(committed.transform, committed.geometry);
    // The host moved the offset into baseX/baseY and the scale into the base size.
    const rebased = {
      geometry: { baseHeight: bounds.height, baseWidth: bounds.width, baseX: bounds.left, baseY: bounds.top },
      transform: { scale: 1, x: 0, y: 0 },
    };
    expect(sameCanvasLayerBox(committed, rebased)).toBe(true);
    expect(sameCanvasLayerBox(committed, { ...rebased, transform: { scale: 1, x: 1, y: 0 } })).toBe(false);
  });
});
