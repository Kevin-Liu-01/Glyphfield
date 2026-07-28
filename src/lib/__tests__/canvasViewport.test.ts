import { describe, expect, it } from 'vitest';

import {
  clampCanvasZoom,
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
});
