export function clampCanvasZoom(value: number): number {
  return Math.min(200, Math.max(40, Math.round(value / 5) * 5));
}

export function resolveZoomedScrollPosition({
  currentZoom,
  nextZoom,
  pointX,
  pointY,
  scrollLeft,
  scrollTop,
}: {
  currentZoom: number;
  nextZoom: number;
  pointX: number;
  pointY: number;
  scrollLeft: number;
  scrollTop: number;
}): { left: number; top: number } {
  const ratio = nextZoom / Math.max(1, currentZoom);
  return {
    left: (scrollLeft + pointX) * ratio - pointX,
    top: (scrollTop + pointY) * ratio - pointY,
  };
}
