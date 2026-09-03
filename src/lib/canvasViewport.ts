export function clampCanvasZoom(value: number, min = 40, max = 200): number {
  const boundedMin = Math.min(min, max);
  const boundedMax = Math.max(min, max);
  return Math.min(boundedMax, Math.max(boundedMin, Math.round(value / 5) * 5));
}

export function resolveCanvasGridStep(
  zoom: number,
  baseStep = 20,
  minimumScreenStep = 12
): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 100;
  const safeBaseStep = Number.isFinite(baseStep) && baseStep > 0 ? baseStep : 20;
  const safeMinimum = Number.isFinite(minimumScreenStep) && minimumScreenStep > 0
    ? minimumScreenStep
    : 12;
  const screenStep = safeBaseStep * safeZoom / 100;
  if (!Number.isFinite(screenStep)) return safeBaseStep;
  if (screenStep >= safeMinimum) return screenStep;
  return screenStep * 2 ** Math.ceil(Math.log2(safeMinimum / screenStep));
}

export function resolveCenteredCanvasPan({
  initialPan,
  viewportHeight,
  viewportWidth,
  zoom,
}: {
  initialPan: { x: number; y: number };
  viewportHeight: number;
  viewportWidth: number;
  zoom: number;
}): { x: number; y: number } {
  const scale = zoom / 100;
  return {
    x: viewportWidth / 2 - (viewportWidth / 2 - initialPan.x) * scale,
    y: viewportHeight / 2 - (viewportHeight / 2 - initialPan.y) * scale,
  };
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

export function resolveCanvasWheelZoomDelta({
  deltaMode,
  deltaX,
  deltaY,
}: {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
}): number {
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const dominantDelta = Math.abs(safeDeltaY) >= Math.abs(safeDeltaX) ? safeDeltaY : safeDeltaX;
  const modeScale = deltaMode === 1 ? 16 : deltaMode === 2 ? 120 : 1;
  return dominantDelta * modeScale;
}

export function arrangeCanvasFrames<T extends { height: number; width: number }>(
  frames: readonly T[],
  {
    columns = Math.max(1, Math.ceil(Math.sqrt(frames.length))),
    gapX = 96,
    gapY = 128,
    startX = 280,
    startY = 240,
  }: {
    columns?: number;
    gapX?: number;
    gapY?: number;
    startX?: number;
    startY?: number;
  } = {}
): Array<T & { x: number; y: number }> {
  const columnCount = Math.max(1, Math.floor(columns));
  let cursorX = startX;
  let cursorY = startY;
  let rowHeight = 0;
  return frames.map((frame, index) => {
    const arranged = { ...frame, x: cursorX, y: cursorY };
    rowHeight = Math.max(rowHeight, frame.height);
    if ((index + 1) % columnCount === 0) {
      cursorX = startX;
      cursorY += rowHeight + gapY;
      rowHeight = 0;
    } else {
      cursorX += frame.width + gapX;
    }
    return arranged;
  });
}

export function translateCanvasFrame<T extends { x: number; y: number }>(
  frame: T,
  {
    deltaX,
    deltaY,
    minX = 0,
    minY = 0,
  }: {
    deltaX: number;
    deltaY: number;
    minX?: number;
    minY?: number;
  }
): T {
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  return {
    ...frame,
    x: Math.max(minX, Math.round(frame.x + safeDeltaX)),
    y: Math.max(minY, Math.round(frame.y + safeDeltaY)),
  };
}
