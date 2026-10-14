import { describe, expect, it } from 'vitest';

import { arrangeCanvasUnits, canArrangeUnits, isDesignLabArrangement } from '../designLabArrange';
import type { CanvasSelectionItem } from '../canvasInteraction';

// A 100 x 50 base box centered at (x + 50, y + 25), moved by transform.x/y.
function box(x: number, y: number, width = 100, height = 50): CanvasSelectionItem {
  return { geometry: { baseHeight: height, baseWidth: width, baseX: 0, baseY: 0 }, transform: { scale: 1, x, y } };
}

describe('Design Lab align and distribute', () => {
  it('aligns every unit to the selection bounds, not the artboard', () => {
    const units = [[box(40, 0)], [box(300, 80, 60)], [box(120, 200, 200)]];
    expect(arrangeCanvasUnits(units, 'left')).toEqual([{ x: 0, y: 0 }, { x: -260, y: 0 }, { x: -80, y: 0 }]);
    // Selection spans x 40..360, so its center is 200.
    expect(arrangeCanvasUnits(units, 'horizontal-center')).toEqual([{ x: 110, y: 0 }, { x: -130, y: 0 }, { x: -20, y: 0 }]);
    expect(arrangeCanvasUnits(units, 'right')).toEqual([{ x: 220, y: 0 }, { x: 0, y: 0 }, { x: 40, y: 0 }]);
    expect(arrangeCanvasUnits(units, 'bottom')).toEqual([{ x: 0, y: 200 }, { x: 0, y: 120 }, { x: 0, y: 0 }]);
  });

  it('spaces units evenly while the outermost units stay put', () => {
    const units = [[box(0, 0)], [box(400, 0)], [box(130, 0)]];
    const offsets = arrangeCanvasUnits(units, 'distribute-horizontal');
    expect(offsets[0]).toEqual({ x: 0, y: 0 });
    expect(offsets[1]).toEqual({ x: 0, y: 0 });
    // Span 0..500 holds 300 px of boxes, leaving two 100 px gaps.
    expect(offsets[2]).toEqual({ x: 70, y: 0 });
    const vertical = arrangeCanvasUnits([[box(0, 0)], [box(0, 300)], [box(0, 40)]], 'distribute-vertical');
    expect(vertical[2]).toEqual({ x: 0, y: 110 });
  });

  it('moves a group as one rigid unit', () => {
    const group = [box(0, 0), box(120, 40)];
    const offsets = arrangeCanvasUnits([group, [box(500, 300)]], 'top');
    expect(offsets).toEqual([{ x: 0, y: 0 }, { x: 0, y: -300 }]);
  });

  it('needs two units to align and three to distribute', () => {
    expect(canArrangeUnits('left', 1)).toBe(false);
    expect(canArrangeUnits('left', 2)).toBe(true);
    expect(canArrangeUnits('distribute-vertical', 2)).toBe(false);
    expect(arrangeCanvasUnits([[box(0, 0)], [box(50, 50)]], 'distribute-horizontal')).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(isDesignLabArrangement('vertical-center')).toBe(true);
    expect(isDesignLabArrangement('center')).toBe(false);
  });
});
