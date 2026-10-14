export type CanvasLayerTransform = {
  heightScale?: number;
  /** Degrees clockwise about the layer's center, in (-180, 180]. Absent means 0. */
  rotation?: number;
  scale: number;
  widthScale?: number;
  x: number;
  y: number;
};

export type CanvasLayerResizeMode = 'box' | 'scale';
export type CanvasPointerMode =
  | 'move'
  | 'resize'
  | 'resize-bottom'
  | 'resize-bottom-left'
  | 'resize-left'
  | 'resize-right'
  | 'resize-top'
  | 'resize-top-left'
  | 'resize-top-right'
  | 'rotate';
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
  // Documents saved before layers could rotate have no rotation: they load at 0.
  return source.rotation === undefined ? next : withCanvasLayerRotation(next, source.rotation);
}

/** The transform turned to `degrees`. 0 removes the field, so an unrotated layer keeps its older saved shape. */
export function withCanvasLayerRotation(transform: CanvasLayerTransform, degrees: number): CanvasLayerTransform {
  const next = { ...transform };
  delete next.rotation;
  const rotation = normalizeCanvasRotation(degrees);
  if (rotation) next.rotation = rotation;
  return next;
}

export function isAdditiveCanvasSelection(modifiers: CanvasSelectionModifiers): boolean {
  return modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey;
}

/** Preserve native editing, including plaintext-only and inherited edit hosts. */
export function isCanvasTextEditingTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  if (target.closest('input, textarea, select')) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  // The nearest valid value owns editability; a nested false island must not
  // inherit an outer editor. This also supports DOMs without isContentEditable.
  const host = target.closest('[contenteditable=""], [contenteditable="true" i], [contenteditable="plaintext-only" i], [contenteditable="false" i]');
  return host !== null && host.getAttribute('contenteditable')?.toLowerCase() !== 'false';
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

/** The axis-aligned area a layer covers once its rotation is applied. */
export function canvasLayerHullBounds(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry
): CanvasLayerBounds {
  const bounds = canvasLayerBounds(transform, geometry);
  if (!transform.rotation) return bounds;
  const { height, width } = rotatedCanvasExtent(bounds.width, bounds.height, transform.rotation);
  return {
    bottom: bounds.centerY + height / 2,
    centerX: bounds.centerX,
    centerY: bounds.centerY,
    height,
    left: bounds.centerX - width / 2,
    right: bounds.centerX + width / 2,
    top: bounds.centerY - height / 2,
    width,
  };
}

/** Bounds of what the selection shows: rotated layers count by their hull, so align and distribute match the canvas. */
export function canvasSelectionBounds(items: readonly CanvasSelectionItem[]): CanvasLayerBounds | null {
  if (items.length === 0) return null;
  const bounds = items.map(({ geometry, transform }) => canvasLayerHullBounds(transform, geometry));
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

/** Degrees in (-180, 180], so saved rotations have one spelling. */
export function normalizeCanvasRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const turned = ((degrees % 360) + 360) % 360;
  const normalized = turned > 180 ? turned - 360 : turned;
  return Object.is(normalized, -0) ? 0 : normalized;
}

/** Rotation for a rotate drag: the start plus the swept pointer angle, in `step`-degree increments when given. */
export function canvasRotationFromPointer(
  startRotation: number,
  center: { x: number; y: number },
  start: { x: number; y: number },
  current: { x: number; y: number },
  step?: number
): number {
  const swept = Math.atan2(current.y - center.y, current.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x);
  const degrees = startRotation + swept * 180 / Math.PI;
  return normalizeCanvasRotation(step ? Math.round(degrees / step) * step : degrees);
}

export function rotateCanvasVector(vector: { x: number; y: number }, degrees: number): { x: number; y: number } {
  if (!degrees) return { ...vector };
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

/** Axis-aligned extent of a box rotated about its center. */
export function rotatedCanvasExtent(width: number, height: number, degrees: number): { height: number; width: number } {
  if (!degrees) return { height, width };
  const radians = degrees * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { height: width * sin + height * cos, width: width * cos + height * sin };
}

const RESIZES_RIGHT = new Set<CanvasPointerMode>(['resize', 'resize-right', 'resize-top-right']);
const RESIZES_LEFT = new Set<CanvasPointerMode>(['resize-left', 'resize-top-left', 'resize-bottom-left']);
const RESIZES_BOTTOM = new Set<CanvasPointerMode>(['resize', 'resize-bottom', 'resize-bottom-left']);
const RESIZES_TOP = new Set<CanvasPointerMode>(['resize-top', 'resize-top-left', 'resize-top-right']);

/**
 * Box resize from one edge or corner. The pointer delta (canvas units) is read
 * along the layer's own axes, so a rotated layer resizes along its sides, and
 * the opposite edge stays where it was.
 */
export function resizeCanvasLayerBox(
  start: CanvasLayerTransform,
  geometry: Pick<CanvasLayerGeometry, 'baseHeight' | 'baseWidth'>,
  mode: CanvasPointerMode,
  delta: { x: number; y: number },
  rotation = 0
): CanvasLayerTransform {
  const local = rotateCanvasVector(delta, -rotation);
  const startWidthScale = start.widthScale ?? start.scale;
  const startHeightScale = start.heightScale ?? start.scale;
  let widthScale = startWidthScale;
  let heightScale = startHeightScale;
  const shift = { x: 0, y: 0 };
  if (RESIZES_RIGHT.has(mode)) {
    widthScale = Math.max(startWidthScale + local.x / geometry.baseWidth, MIN_CANVAS_LAYER_SCALE);
    shift.x += geometry.baseWidth * (widthScale - startWidthScale) / 2;
  }
  if (RESIZES_LEFT.has(mode)) {
    widthScale = Math.max(startWidthScale - local.x / geometry.baseWidth, MIN_CANVAS_LAYER_SCALE);
    shift.x -= geometry.baseWidth * (widthScale - startWidthScale) / 2;
  }
  if (RESIZES_BOTTOM.has(mode)) {
    heightScale = Math.max(startHeightScale + local.y / geometry.baseHeight, MIN_CANVAS_LAYER_SCALE);
    shift.y += geometry.baseHeight * (heightScale - startHeightScale) / 2;
  }
  if (RESIZES_TOP.has(mode)) {
    heightScale = Math.max(startHeightScale - local.y / geometry.baseHeight, MIN_CANVAS_LAYER_SCALE);
    shift.y -= geometry.baseHeight * (heightScale - startHeightScale) / 2;
  }
  const move = rotateCanvasVector(shift, rotation);
  return { ...start, heightScale, widthScale, x: start.x + move.x, y: start.y + move.y };
}

/** Rule-of-thirds lines for `snapTargets`. */
export function canvasThirdsSnapTargets(width: number, height: number): CanvasSnapTargets {
  return { x: [width / 3, width * 2 / 3], y: [height / 3, height * 2 / 3] };
}

/** The rendered box is what matters: equal boxes are the same commit, even after a host re-bases. */
export function sameCanvasLayerBox(
  left: { geometry: CanvasLayerGeometry; transform: CanvasLayerTransform },
  right: { geometry: CanvasLayerGeometry; transform: CanvasLayerTransform },
  tolerance = 0.01
): boolean {
  const a = canvasLayerBounds(left.transform, left.geometry);
  const b = canvasLayerBounds(right.transform, right.geometry);
  return Math.abs(a.left - b.left) <= tolerance && Math.abs(a.top - b.top) <= tolerance
    && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
}
