import { describe, expect, it } from 'vitest';

import {
  clampCanvasZoom,
  resolveCanvasWheelDelta,
  resolveZoomedScrollPosition,
} from '@/lib/canvasViewport';

describe('canvas viewport', () => {
  it('clamps and rounds zoom to usable five-percent steps', () => {
    expect(clampCanvasZoom(37)).toBe(40);
    expect(clampCanvasZoom(113)).toBe(115);
    expect(clampCanvasZoom(203)).toBe(200);
  });

  it('keeps the pointer location anchored while zooming', () => {
    expect(resolveZoomedScrollPosition({
      currentZoom: 100,
      nextZoom: 150,
      pointX: 240,
      pointY: 180,
      scrollLeft: 320,
      scrollTop: 200,
    })).toEqual({
      left: 600,
      top: 390,
    });
  });

  it('pans vertically with a standard wheel gesture', () => {
    expect(resolveCanvasWheelDelta({
      deltaMode: 0,
      deltaX: 0,
      deltaY: 120,
      pageHeight: 800,
      pageWidth: 1200,
      shiftKey: false,
    })).toEqual({
      left: 0,
      top: 120,
    });
  });

  it('converts shift-wheel gestures into horizontal panning', () => {
    expect(resolveCanvasWheelDelta({
      deltaMode: 1,
      deltaX: 0,
      deltaY: 3,
      pageHeight: 800,
      pageWidth: 1200,
      shiftKey: true,
    })).toEqual({
      left: 48,
      top: 0,
    });
  });
});
