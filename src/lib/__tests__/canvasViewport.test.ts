import { describe, expect, it } from 'vitest';

import {
  arrangeCanvasFrames,
  clampCanvasZoom,
  resolveCanvasGridStep,
  resolveCenteredCanvasPan,
  resolveCanvasWheelZoomDelta,
  resolveZoomedScrollPosition,
  translateCanvasFrame,
} from '@/lib/canvasViewport';

describe('canvas viewport', () => {
  it('clamps and rounds zoom to usable five-percent steps', () => {
    expect(clampCanvasZoom(37)).toBe(40);
    expect(clampCanvasZoom(113)).toBe(115);
    expect(clampCanvasZoom(203)).toBe(200);
  });

  it('supports a wider zoom range for infinite-canvas workspaces', () => {
    expect(clampCanvasZoom(6, 10, 220)).toBe(10);
    expect(clampCanvasZoom(17, 10, 220)).toBe(15);
    expect(clampCanvasZoom(227, 10, 220)).toBe(220);
  });

  it('keeps the canvas dot grid legible across fractional and distant zoom levels', () => {
    expect(resolveCanvasGridStep(95)).toBe(19);
    expect(resolveCanvasGridStep(40)).toBe(16);
    expect(resolveCanvasGridStep(10)).toBe(16);
    expect(resolveCanvasGridStep(Number.NaN)).toBe(20);
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

  it('centers a restored zoom instead of scaling the canvas toward the top-left', () => {
    const pan = resolveCenteredCanvasPan({
      initialPan: { x: 0, y: 0 },
      viewportHeight: 536,
      viewportWidth: 896,
      zoom: 80,
    });

    expect(pan.x).toBeCloseTo(89.6);
    expect(pan.y).toBeCloseTo(53.6);
  });

  it('converts a standard wheel gesture into a zoom delta', () => {
    expect(resolveCanvasWheelZoomDelta({
      deltaMode: 0,
      deltaX: 0,
      deltaY: 120,
    })).toBe(120);
  });

  it('normalizes line-mode and horizontal wheel gestures for zooming', () => {
    expect(resolveCanvasWheelZoomDelta({
      deltaMode: 1,
      deltaX: 0,
      deltaY: 3,
    })).toBe(48);
    expect(resolveCanvasWheelZoomDelta({
      deltaMode: 0,
      deltaX: -60,
      deltaY: 0,
    })).toBe(-60);
  });

  it('ignores invalid wheel deltas', () => {
    expect(resolveCanvasWheelZoomDelta({
      deltaMode: 0,
      deltaX: Number.NaN,
      deltaY: Number.POSITIVE_INFINITY,
    })).toBe(0);
    expect(resolveCanvasWheelZoomDelta({
      deltaMode: 0,
      deltaX: Number.NaN,
      deltaY: 24,
    })).toBe(24);
  });

  it('tidies mixed-size artboards without row overlap', () => {
    expect(arrangeCanvasFrames([
      { height: 405, id: 'wide', width: 720 },
      { height: 520, id: 'square', width: 520 },
      { height: 378, id: 'social', width: 720 },
      { height: 405, id: 'wide-2', width: 720 },
    ], { columns: 2, gapX: 40, gapY: 60, startX: 100, startY: 80 })).toEqual([
      { height: 405, id: 'wide', width: 720, x: 100, y: 80 },
      { height: 520, id: 'square', width: 520, x: 860, y: 80 },
      { height: 378, id: 'social', width: 720, x: 100, y: 660 },
      { height: 405, id: 'wide-2', width: 720, x: 860, y: 660 },
    ]);
  });

  it('moves artboards in workspace coordinates and keeps them reachable', () => {
    const frame = { id: 'artboard-main', x: 280, y: 240 };

    expect(translateCanvasFrame(frame, { deltaX: 93.6, deltaY: -41.2, minX: 80, minY: 96 }))
      .toEqual({ id: 'artboard-main', x: 374, y: 199 });
    expect(translateCanvasFrame(frame, { deltaX: -900, deltaY: -900, minX: 80, minY: 96 }))
      .toEqual({ id: 'artboard-main', x: 80, y: 96 });
    expect(translateCanvasFrame(frame, { deltaX: Number.NaN, deltaY: Number.POSITIVE_INFINITY }))
      .toEqual(frame);
  });
});
