// Align and distribute for multi-layer selections. A unit is one layer or one
// whole group; units move rigidly so a group's internal layout never changes.
import { canvasSelectionBounds, type CanvasLayerBounds, type CanvasSelectionItem } from './canvasInteraction';

export const DESIGN_LAB_ARRANGEMENTS = [
  'left',
  'horizontal-center',
  'right',
  'top',
  'vertical-center',
  'bottom',
  'distribute-horizontal',
  'distribute-vertical',
] as const;

export type DesignLabArrangement = typeof DESIGN_LAB_ARRANGEMENTS[number];

export function isDesignLabArrangement(value: unknown): value is DesignLabArrangement {
  return typeof value === 'string' && (DESIGN_LAB_ARRANGEMENTS as readonly string[]).includes(value);
}

/** Alignment needs two units; even spacing needs three. */
export function canArrangeUnits(arrangement: DesignLabArrangement, unitCount: number): boolean {
  return unitCount >= (arrangement.startsWith('distribute-') ? 3 : 2);
}

function alignOffset(box: CanvasLayerBounds, selection: CanvasLayerBounds, arrangement: DesignLabArrangement) {
  if (arrangement === 'left') return { x: selection.left - box.left, y: 0 };
  if (arrangement === 'horizontal-center') return { x: selection.centerX - box.centerX, y: 0 };
  if (arrangement === 'right') return { x: selection.right - box.right, y: 0 };
  if (arrangement === 'top') return { x: 0, y: selection.top - box.top };
  if (arrangement === 'vertical-center') return { x: 0, y: selection.centerY - box.centerY };
  return { x: 0, y: selection.bottom - box.bottom };
}

function distributeOffsets(boxes: readonly CanvasLayerBounds[], axis: 'x' | 'y') {
  const start = axis === 'x' ? 'left' : 'top';
  const end = axis === 'x' ? 'right' : 'bottom';
  const size = axis === 'x' ? 'width' : 'height';
  const order = boxes.map((box, index) => ({ box, index })).sort((first, second) => (
    first.box[start] - second.box[start] || first.index - second.index
  ));
  const first = order[0]!.box;
  const last = order.at(-1)!.box;
  const occupied = order.reduce((total, { box }) => total + box[size], 0);
  const gap = (last[end] - first[start] - occupied) / (order.length - 1);
  const offsets = boxes.map(() => ({ x: 0, y: 0 }));
  let cursor = first[end] + gap;
  for (const { box, index } of order.slice(1, -1)) {
    offsets[index]![axis] = cursor - box[start];
    cursor += box[size] + gap;
  }
  return offsets;
}

/**
 * Returns one offset per unit. Alignment uses the bounds of the whole
 * selection, never the artboard; distribution keeps the outermost units in
 * place and gives every neighbouring pair the same gap.
 */
export function arrangeCanvasUnits(
  units: readonly (readonly CanvasSelectionItem[])[],
  arrangement: DesignLabArrangement
): Array<{ x: number; y: number }> {
  const boxes = units.map((items) => canvasSelectionBounds(items));
  if (!canArrangeUnits(arrangement, units.length) || boxes.some((box) => !box)) return units.map(() => ({ x: 0, y: 0 }));
  const bounds = boxes as CanvasLayerBounds[];
  if (arrangement === 'distribute-horizontal') return distributeOffsets(bounds, 'x');
  if (arrangement === 'distribute-vertical') return distributeOffsets(bounds, 'y');
  const selection = canvasSelectionBounds(units.flat())!;
  return bounds.map((box) => alignOffset(box, selection, arrangement));
}
