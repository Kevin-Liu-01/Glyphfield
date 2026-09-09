import { describe, expect, it } from 'vitest';
import { canvasMinimapBounds, canvasMinimapPoint, canvasNavigationBounds, canvasVisibleRect,
  centerCanvasNavigation, fitCanvasNavigation, resizeCanvasNavigationPan } from '../canvasNavigation';

const view = { width: 800, height: 600, zoom: 50, pan: { x: -100, y: 50 } };
const items = [
  { id: 'a', label: 'Portrait', x: -400, y: -300, width: 200, height: 400 },
  { id: 'b', label: 'Wide', x: 1200, y: 800, width: 600, height: 300, active: true },
];

describe('canvas navigation geometry', () => {
  it('converts the visible screen into workspace coordinates at fractional zoom', () => {
    expect(canvasVisibleRect(view)).toEqual({ x: 200, y: -100, width: 1600, height: 1200 });
  });
  it('unions all artboards including negative workspace positions', () => {
    expect(canvasNavigationBounds(items)).toEqual({ x: -400, y: -300, width: 2200, height: 1400 });
  });
  it('keeps a viewport panned far beyond the boards inside the map', () => {
    const distant = canvasVisibleRect({ ...view, pan: { x: -5000, y: -4000 } });
    const bounds = canvasMinimapBounds(items, { ...view, pan: { x: -5000, y: -4000 } });
    expect(bounds.x).toBeLessThan(-400);
    expect(bounds.y).toBeLessThan(-300);
    expect(bounds.x + bounds.width).toBeGreaterThan(distant.x + distant.width);
    expect(bounds.y + bounds.height).toBeGreaterThan(distant.y + distant.height);
  });
  it('handles SVG letterboxing and maps the exact center independently of aspect ratio', () => {
    const screen = { x: 20, y: 30, width: 200, height: 100 };
    const world = { x: -500, y: -100, width: 1000, height: 1000 };
    expect(canvasMinimapPoint({ x: 120, y: 80 }, screen, world)).toEqual({ x: 0, y: 400 });
    expect(canvasMinimapPoint({ x: 70, y: 30 }, screen, world)).toEqual({ x: -500, y: -100 });
  });
  it('centers at the current zoom without modifying the artwork', () => {
    expect(centerCanvasNavigation(view, { x: 1500, y: 950 })).toEqual({ x: -350, y: -175 });
    expect(view.zoom).toBe(50);
  });
  it('fits all boards without rounding up and cropping the outer edges', () => {
    const fitted = fitCanvasNavigation(items, view, 10, 220);
    expect(fitted.zoom).toBe(30);
    const visible = canvasVisibleRect({ ...view, ...fitted });
    expect(visible.x).toBeLessThan(-400);
    expect(visible.y).toBeLessThan(-300);
    expect(visible.x + visible.width).toBeGreaterThan(1800);
    expect(visible.y + visible.height).toBeGreaterThan(1100);
  });
  it('keeps the same world center on resize without resetting zoom', () => {
    const before = canvasVisibleRect(view);
    const size = { width: 1200, height: 450 };
    const pan = resizeCanvasNavigationPan(view, size);
    const after = canvasVisibleRect({ ...view, ...size, pan });
    expect(after.x + after.width / 2).toBe(before.x + before.width / 2);
    expect(after.y + after.height / 2).toBe(before.y + before.height / 2);
  });
  it('ignores invalid or empty artboard geometry', () => {
    expect(canvasNavigationBounds([{ x: NaN, y: 0, width: 100, height: 100 },
      { x: 2, y: 4, width: 0, height: 1 }])).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
