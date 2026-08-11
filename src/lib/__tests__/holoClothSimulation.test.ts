import { describe, expect, it } from 'vitest';

import { HoloClothSimulation } from '../holoClothSimulation';

describe('holographic cloth simulation', () => {
  it('builds a subdivided drape and remains finite after an impulse', () => {
    const cloth = new HoloClothSimulation(3, 2, 8, 6, 0.7);
    expect(cloth.count).toBe(63);
    cloth.poke(0, 0, 0.24);
    for (let frame = 0; frame < 24; frame += 1) {
      cloth.step(1 / 60, { damping: 0.24, iterations: 3, relaxation: 0.12, stiffness: 0.72 });
    }
    expect([...cloth.positions].every(Number.isFinite)).toBe(true);
  });

  it('supports a weighted grab and releases without losing vertices', () => {
    const cloth = new HoloClothSimulation(3, 2, 8, 6, 0.5);
    expect(cloth.startGrab([0, 0, 0], 0.8)).toBe(true);
    cloth.moveGrab([0.25, -0.1, 0.4]);
    cloth.step(1 / 30, { damping: 0.2, iterations: 2, relaxation: 0.08, stiffness: 0.65 });
    expect(cloth.isGrabbing).toBe(true);
    cloth.endGrab();
    expect(cloth.isGrabbing).toBe(false);
    expect(cloth.positions).toHaveLength(cloth.count * 3);
  });

  it('stays inside a stable render envelope during continuous animation', () => {
    const cloth = new HoloClothSimulation(3.7, 2.5, 36, 25, 0.68);
    for (let frame = 0; frame < 600; frame += 1) {
      cloth.step(1 / 60, { damping: 0.23, iterations: 4, relaxation: 0.09, stiffness: 0.76 });
    }
    const largestCoordinate = Math.max(...cloth.positions.map(Math.abs));
    expect(largestCoordinate).toBeLessThan(4);
  });
});
