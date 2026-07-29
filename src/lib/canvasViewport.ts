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

export function resolveCanvasWheelDelta({
  deltaMode,
  deltaX,
  deltaY,
  pageHeight,
  pageWidth,
  shiftKey,
}: {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  pageHeight: number;
  pageWidth: number;
  shiftKey: boolean;
}): { left: number; top: number } {
  const lineScale = 16;
  const horizontalScale = deltaMode === 1
    ? lineScale
    : deltaMode === 2
      ? pageWidth
      : 1;
  const verticalScale = deltaMode === 1
    ? lineScale
    : deltaMode === 2
      ? pageHeight
      : 1;
  const shiftToHorizontal = shiftKey && Math.abs(deltaX) < Math.abs(deltaY);

  return {
    left: shiftToHorizontal ? deltaY * horizontalScale : deltaX * horizontalScale,
    top: shiftToHorizontal ? 0 : deltaY * verticalScale,
  };
}
