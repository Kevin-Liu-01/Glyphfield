import { describe, expect, it } from 'vitest';

import {
  advancePlaybackTime,
  animationTimelineChanged,
  buildFrameSchedule,
  cycleDurationMs,
  cubicBezierAt,
  resolveContinuousSourceFrame,
  resolveBezierControlPoint,
  resolveAnchor,
  resolveTimeline,
  shouldRenderAnimationPreview,
} from '../animation';

describe('animation playback decisions', () => {
  it('advances, loops, and stops the playhead deterministically', () => {
    expect(advancePlaybackTime({
      currentTimeMs: 900,
      durationMs: 1_000,
      elapsedMs: 100,
      loop: true,
      playbackRate: 2,
    })).toEqual({ stopped: false, timeMs: 100 });
    expect(advancePlaybackTime({
      currentTimeMs: 900,
      durationMs: 1_000,
      elapsedMs: 100,
      loop: false,
      playbackRate: 2,
    })).toEqual({ stopped: true, timeMs: 1_000 });
    expect(advancePlaybackTime({
      currentTimeMs: 400,
      durationMs: 0,
      elapsedMs: 100,
      loop: false,
      playbackRate: 1,
    })).toEqual({ stopped: false, timeMs: 400 });
  });

  it('syncs only changed timeline indices', () => {
    expect(animationTimelineChanged({ index: 1, nextIndex: 2 }, { index: 0, nextIndex: 1 })).toBe(true);
    expect(animationTimelineChanged({ index: 1, nextIndex: 2 }, { index: 1, nextIndex: 2 })).toBe(false);
  });

  it('skips hidden and premature frames while preserving animated content', () => {
    const base = {
      contentIsAnimated: false,
      currentSourceId: 'a',
      directComposite: true,
      frameIsDue: true,
      pageVisible: true,
      previewDirty: false,
      previousSourceId: 'a',
    };
    expect(shouldRenderAnimationPreview(base)).toBe(false);
    expect(shouldRenderAnimationPreview({ ...base, contentIsAnimated: true })).toBe(true);
    expect(shouldRenderAnimationPreview({ ...base, pageVisible: false, previewDirty: true })).toBe(false);
    expect(shouldRenderAnimationPreview({ ...base, frameIsDue: false, previewDirty: true })).toBe(false);
  });
});

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

describe('resolveContinuousSourceFrame', () => {
  it('plays through the hold and rests on the last frame during a transition', () => {
    const timing = { holdMs: 1000, transitionMs: 200 };

    expect(
      resolveContinuousSourceFrame(
        resolveTimeline(500, { ...timing, itemCount: 2 }),
        timing,
        61
      )
    ).toBe(30);
    expect(
      resolveContinuousSourceFrame(
        resolveTimeline(1100, { ...timing, itemCount: 2 }),
        timing,
        61
      )
    ).toBe(60);
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

  it('samples a held source continuously only when requested', () => {
    const timing = {
      fps: 20,
      holdMs: 1000,
      itemCount: 1,
      transitionMs: 200,
    };

    expect(buildFrameSchedule(timing)).toHaveLength(1);
    expect(buildFrameSchedule({ ...timing, sampleHoldFrames: true })).toHaveLength(20);
  });
});

describe('resolveAnchor', () => {
  it('uses the true canvas center without a post-transition correction', () => {
    expect(resolveAnchor(1000, 300, 0, 0)).toEqual({ x: 500, y: 150 });
    expect(resolveAnchor(1000, 300, 1, -1)).toEqual({ x: 1000, y: 0 });
  });
});
