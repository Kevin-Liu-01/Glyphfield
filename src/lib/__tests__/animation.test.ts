import { describe, expect, it } from 'vitest';

import {
  buildFrameSchedule,
  cycleDurationMs,
  cubicBezierAt,
  resolveBezierControlPoint,
  resolveAnchor,
  resolveTimeline,
} from '../animation';

describe('cubicBezierAt', () => {
  it('preserves exact endpoints and accelerates the material curve', () => {
    const curve = [0.4, 0, 0.2, 1] as const;

    expect(cubicBezierAt(0, curve)).toBe(0);
    expect(cubicBezierAt(1, curve)).toBe(1);
    expect(cubicBezierAt(0.5, curve)).toBeGreaterThan(0.7);
  });
});

describe('resolveBezierControlPoint', () => {
  it.each([
    { expected: [0, 0], pointer: [0.1, 0.9] },
    { expected: [0.5, 0.5], pointer: [0.5, 0.5] },
    { expected: [1, 1], pointer: [0.9, 0.1] },
    { expected: [0, 2], pointer: [-0.5, -1] },
    { expected: [1, -1], pointer: [1.5, 2] },
  ])('maps and clamps $pointer to $expected', ({ expected, pointer }) => {
    expect(resolveBezierControlPoint(pointer[0], pointer[1])).toEqual(expected);
  });
});

describe('resolveTimeline', () => {
  it('keeps hold and transition phases on one deterministic playhead', () => {
    const timing = { itemCount: 3, holdMs: 1250, transitionMs: 240 };

    expect(resolveTimeline(0, timing)).toMatchObject({ index: 0, phase: 'hold' });
    expect(resolveTimeline(1249, timing)).toMatchObject({ index: 0, phase: 'hold' });
    expect(resolveTimeline(1250, timing)).toMatchObject({
      index: 0,
      nextIndex: 1,
      phase: 'transition',
    });
    expect(resolveTimeline(1490, timing)).toMatchObject({ index: 1, phase: 'hold' });
  });

  it('does not reserve transition time for a single state', () => {
    const timing = { itemCount: 1, holdMs: 1250, transitionMs: 240 };

    expect(cycleDurationMs(timing)).toBe(1250);
    expect(resolveTimeline(1249, timing)).toMatchObject({ phase: 'hold' });
    expect(
      buildFrameSchedule({ ...timing, fps: 20 }).some(
        (frame) => frame.position.phase === 'transition'
      )
    ).toBe(false);
  });
});

describe('buildFrameSchedule', () => {
  it('gives every completed state its exact requested hold time', () => {
    const schedule = buildFrameSchedule({
      itemCount: 2,
      holdMs: 1250,
      transitionMs: 240,
      fps: 20,
    });

    for (const index of [0, 1]) {
      const holdDuration = schedule
        .filter((frame) => frame.position.index === index && frame.position.phase === 'hold')
        .reduce((total, frame) => total + frame.delayMs, 0);
      expect(holdDuration).toBe(1250);
    }

    expect(schedule.filter((frame) => frame.position.phase === 'transition').at(-1)?.position.progress).toBeLessThan(1);
  });
});

describe('resolveAnchor', () => {
  it('uses the true canvas center without a post-transition correction', () => {
    expect(resolveAnchor(1000, 300, 0, 0)).toEqual({ x: 500, y: 150 });
    expect(resolveAnchor(1000, 300, 1, -1)).toEqual({ x: 1000, y: 0 });
  });
});
