export type CanvasLayerTransform = {
  heightScale?: number;
  scale: number;
  widthScale?: number;
  x: number;
  y: number;
};

export type CanvasLayerResizeMode = 'box' | 'scale';
export type CanvasPointerMode = 'move' | 'resize' | 'resize-bottom' | 'resize-left' | 'resize-right' | 'resize-top';
export type CanvasLayerAlignment =
  | 'left'
  | 'horizontal-center'
  | 'right'
  | 'top'
  | 'vertical-center'
  | 'bottom';

export type CanvasLayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

export type CanvasSmartGuides = { x: number | null; y: number | null };
export type CanvasSnapTargets = { x: readonly number[]; y: readonly number[] };
export type CanvasLayerBounds = {
  bottom: number;
  centerX: number;
  centerY: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};
export type CanvasSelectionItem = { geometry: CanvasLayerGeometry; transform: CanvasLayerTransform };
export type CanvasSelectionModifiers = { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

export const MIN_CANVAS_LAYER_SCALE = 0.02;

export function normalizeCanvasLayerTransform(
  transform: Partial<CanvasLayerTransform> | undefined,
  fallback: CanvasLayerTransform
): CanvasLayerTransform {
  const finite = (value: number | undefined, defaultValue: number) => (
    typeof value === 'number' && Number.isFinite(value) ? value : defaultValue
  );
  const source = transform ?? fallback;
  const next: CanvasLayerTransform = {
    scale: Math.max(0.01, finite(source.scale, fallback.scale)),
    x: finite(source.x, fallback.x),
    y: finite(source.y, fallback.y),
  };
  if (source.widthScale !== undefined) {
    next.widthScale = Math.max(0.01, finite(source.widthScale, fallback.widthScale ?? 1));
  }
  if (source.heightScale !== undefined) {
    next.heightScale = Math.max(0.01, finite(source.heightScale, fallback.heightScale ?? 1));
  }
  return next;
}

export function isAdditiveCanvasSelection(modifiers: CanvasSelectionModifiers): boolean {
  return modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey;
}

export function nextCanvasLayerSelection<T extends string>(
  current: readonly T[],
  targetIds: readonly T[],
  selectedId: T,
  additive: boolean
): T[] {
  if (!additive) {
    if (current.length > 1 && current.includes(selectedId)) return [...current];
    return [...targetIds];
  }
  const currentIds = new Set(current);
  const targetIdSet = new Set(targetIds);
  const allSelected = targetIds.every((id) => currentIds.has(id));
  if (allSelected) return current.filter((id) => !targetIdSet.has(id));
  return [...current, ...targetIds.filter((id) => !currentIds.has(id))];
}

export function shouldDeselectCanvasLayer(
  eventType: string,
  mode: CanvasPointerMode,
  startSelected: boolean,
  moved: boolean
): boolean {
  return eventType === 'pointerup' && mode === 'move' && startSelected && !moved;
}

function nearestSnap(
  anchors: readonly number[],
  targets: readonly number[],
  threshold: number
): { delta: number; guide: number } | null {
  let nearest: { delta: number; guide: number } | null = null;
  targets.forEach((target) => {
    anchors.forEach((anchor) => {
      const delta = target - anchor;
      if (Math.abs(delta) > threshold) return;
      if (!nearest || Math.abs(delta) < Math.abs(nearest.delta)) nearest = { delta, guide: target };
    });
  });
  return nearest;
}

export function canvasLayerDimensions(
  transform: CanvasLayerTransform,
  geometry: Pick<CanvasLayerGeometry, 'baseHeight' | 'baseWidth'>
): { height: number; width: number } {
  return {
    height: geometry.baseHeight * (transform.heightScale ?? transform.scale),
    width: geometry.baseWidth * (transform.widthScale ?? transform.scale),
  };
}

export function resizeCanvasLayerScale(
  transform: CanvasLayerTransform,
  scaleDelta: number
): CanvasLayerTransform {
  const nextScale = Math.max(transform.scale + scaleDelta, MIN_CANVAS_LAYER_SCALE);
  if (transform.heightScale === undefined && transform.widthScale === undefined) {
    return { ...transform, scale: nextScale };
  }
  const scaleFactor = nextScale / Math.max(transform.scale, 0.001);
  return {
    ...transform,
    heightScale: transform.heightScale === undefined ? undefined : transform.heightScale * scaleFactor,
    scale: nextScale,
    widthScale: transform.widthScale === undefined ? undefined : transform.widthScale * scaleFactor,
  };
}

export function canvasLayerBounds(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry
): CanvasLayerBounds {
  const { height, width } = canvasLayerDimensions(transform, geometry);
  const centerX = geometry.baseX + geometry.baseWidth / 2 + transform.x;
  const centerY = geometry.baseY + geometry.baseHeight / 2 + transform.y;
  return {
    bottom: centerY + height / 2,
    centerX,
    centerY,
    height,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    width,
  };
}

export function canvasSelectionBounds(items: readonly CanvasSelectionItem[]): CanvasLayerBounds | null {
  if (items.length === 0) return null;
  const bounds = items.map(({ geometry, transform }) => canvasLayerBounds(transform, geometry));
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  return {
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

export function alignCanvasSelection(
  items: readonly CanvasSelectionItem[],
  canvasWidth: number,
  canvasHeight: number,
  alignment: CanvasLayerAlignment
): CanvasLayerTransform[] {
  const bounds = canvasSelectionBounds(items);
  if (!bounds) return [];
  let deltaX = 0;
  let deltaY = 0;
  if (alignment === 'left') deltaX = -bounds.left;
  else if (alignment === 'horizontal-center') deltaX = canvasWidth / 2 - bounds.centerX;
  else if (alignment === 'right') deltaX = canvasWidth - bounds.right;
  else if (alignment === 'top') deltaY = -bounds.top;
  else if (alignment === 'vertical-center') deltaY = canvasHeight / 2 - bounds.centerY;
  else deltaY = canvasHeight - bounds.bottom;
  return items.map(({ transform }) => ({ ...transform, x: transform.x + deltaX, y: transform.y + deltaY }));
}

export function snapCanvasLayer(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry,
  targets: CanvasSnapTargets,
  thresholdX: number,
  thresholdY: number
): { guides: CanvasSmartGuides; transform: CanvasLayerTransform } {
  const { height, width } = canvasLayerDimensions(transform, geometry);
  const centerX = geometry.baseX + geometry.baseWidth / 2 + transform.x;
  const centerY = geometry.baseY + geometry.baseHeight / 2 + transform.y;
  const xSnap = nearestSnap([centerX - width / 2, centerX, centerX + width / 2], targets.x, thresholdX);
  const ySnap = nearestSnap([centerY - height / 2, centerY, centerY + height / 2], targets.y, thresholdY);
  return {
    guides: { x: xSnap?.guide ?? null, y: ySnap?.guide ?? null },
    transform: {
      ...transform,
      x: transform.x + (xSnap?.delta ?? 0),
      y: transform.y + (ySnap?.delta ?? 0),
    },
  };
}

export function alignCanvasLayer(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry,
  canvasWidth: number,
  canvasHeight: number,
  alignment: CanvasLayerAlignment
): CanvasLayerTransform {
  const { height, width } = canvasLayerDimensions(transform, geometry);
  const centerX = geometry.baseX + geometry.baseWidth / 2;
  const centerY = geometry.baseY + geometry.baseHeight / 2;
  if (alignment === 'left') return { ...transform, x: width / 2 - centerX };
  if (alignment === 'horizontal-center') return { ...transform, x: canvasWidth / 2 - centerX };
  if (alignment === 'right') return { ...transform, x: canvasWidth - width / 2 - centerX };
  if (alignment === 'top') return { ...transform, y: height / 2 - centerY };
  if (alignment === 'vertical-center') return { ...transform, y: canvasHeight / 2 - centerY };
  return { ...transform, y: canvasHeight - height / 2 - centerY };
}
