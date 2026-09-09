import { clampCanvasZoom } from './canvasViewport';

export type CanvasNavigationRect = { x: number; y: number; width: number; height: number };
export type CanvasNavigationItem = CanvasNavigationRect & { id: string; label: string; active?: boolean };
export type CanvasNavigationView = { pan: { x: number; y: number }; zoom: number; width: number; height: number };

export function validCanvasNavigationRect(rect: CanvasNavigationRect): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}

export function canvasVisibleRect(view: CanvasNavigationView): CanvasNavigationRect {
  const scale = Number.isFinite(view.zoom) && view.zoom > 0 ? view.zoom / 100 : 1;
  return { x: -view.pan.x / scale, y: -view.pan.y / scale,
    width: Math.max(1, view.width) / scale, height: Math.max(1, view.height) / scale };
}

export function canvasNavigationBounds(rects: readonly CanvasNavigationRect[]): CanvasNavigationRect {
  const valid = rects.filter(validCanvasNavigationRect);
  if (!valid.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...valid.map((rect) => rect.x));
  const y = Math.min(...valid.map((rect) => rect.y));
  return { x, y, width: Math.max(...valid.map((rect) => rect.x + rect.width)) - x,
    height: Math.max(...valid.map((rect) => rect.y + rect.height)) - y };
}

/** Include the current viewport so navigation never disappears beyond the boards. */
export function canvasMinimapBounds(items: readonly CanvasNavigationItem[], view: CanvasNavigationView): CanvasNavigationRect {
  const bounds = canvasNavigationBounds([...items, canvasVisibleRect(view)]);
  const padding = Math.max(bounds.width, bounds.height) * 0.06;
  return { x: bounds.x - padding, y: bounds.y - padding,
    width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
}

/** SVG preserveAspectRatio="xMidYMid meet", including any letterboxed margin. */
export function canvasMinimapPoint(point: { x: number; y: number }, screen: CanvasNavigationRect, world: CanvasNavigationRect) {
  const scale = Math.min(screen.width / world.width, screen.height / world.height);
  if (!(scale > 0)) return { x: world.x + world.width / 2, y: world.y + world.height / 2 };
  return { x: world.x + (point.x - screen.x - (screen.width - world.width * scale) / 2) / scale,
    y: world.y + (point.y - screen.y - (screen.height - world.height * scale) / 2) / scale };
}

export function centerCanvasNavigation(view: CanvasNavigationView, point: { x: number; y: number }) {
  return { x: view.width / 2 - point.x * view.zoom / 100,
    y: view.height / 2 - point.y * view.zoom / 100 };
}

export function fitCanvasNavigation(items: readonly CanvasNavigationItem[], view: CanvasNavigationView, minZoom: number, maxZoom: number) {
  const bounds = canvasNavigationBounds(items);
  const rawZoom = Math.min(100, (view.width - 64) / bounds.width * 100, (view.height - 64) / bounds.height * 100);
  // Round down before the shared clamp: rounding up can crop the farthest board.
  const zoom = clampCanvasZoom(Math.floor(rawZoom / 5) * 5, minZoom, maxZoom);
  return { zoom, pan: centerCanvasNavigation({ ...view, zoom }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }) };
}

export function resizeCanvasNavigationPan(view: CanvasNavigationView, size: { width: number; height: number }) {
  return { x: view.pan.x + (size.width - view.width) / 2, y: view.pan.y + (size.height - view.height) / 2 };
}
