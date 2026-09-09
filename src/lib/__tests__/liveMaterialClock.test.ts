import { describe, expect, it } from 'vitest';
import { createLiveMaterialClock, liveMaterialFramePointer, shouldAdvanceLiveFluid } from '@/lib/liveMaterialClock';

describe('native shader frame anchors', () => {
  const running = { active: true, paused: false, captureTimeMs: null, rate: 2 };
  it('seeds an imported absolute timestamp once before releasing unanchored native playback', () => {
    const clock = createLiveMaterialClock('webgl', 'shaders-drift');
    expect(clock.draw({ ...running, now: 0, captureTimeMs: 1250, paused: true })).toBe(2500);
    expect(clock.draw({ ...running, now: 300, captureTimeMs: 1250, paused: true })).toBe(2500);
    expect(clock.draw({ ...running, now: 1000 })).toBe(2500);
    expect(clock.draw({ ...running, now: 1016 })).toBe(2532);
  });
  it.each(['webgl', 'canvas2d', 'shadergradient'] as const)('invariant_%s_time_does_not_slow_down_when_a_frame_is_dropped', (engine) => {
    const clock = createLiveMaterialClock(engine);
    clock.draw({ ...running, now: 0 });
    expect(clock.draw({ ...running, now: 200 })).toBe(400);
    expect(clock.draw({ ...running, now: 216.25 })).toBe(432.5);
    clock.draw({ ...running, now: 217, active: false });
    expect(clock.draw({ ...running, now: 10_000 })).toBe(432.5);
    expect(clock.draw({ ...running, now: 10_200 })).toBe(832.5);
  });
  it('invariant_fluid_keeps_a_bounded_simulation_delta_without_claiming_seekability', () => {
    const clock = createLiveMaterialClock('fluid');
    clock.draw({ ...running, now: 0 });
    expect(clock.draw({ ...running, now: 200 })).toBe(128);
    expect(clock.draw({ ...running, now: 400, captureTimeMs: 10_000 })).toBe(128);
  });
  it('restores precise engine time, seeks relative to the anchor, and resumes without restarting', () => {
    const clock = createLiveMaterialClock('webgl', 'holo-cloth-silk');
    const frameState = { engine: 'webgl' as const, version: 2 as const, frame: 923.125, timelineTimeMs: 500 };
    expect(clock.draw({ ...running, now: 10, frameState })).toBe(923.125);
    expect(clock.draw({ ...running, now: 20, frameState })).toBe(943.125);
    expect(clock.draw({ ...running, now: 21, captureTimeMs: 600, frameState })).toBe(1123.125);
    expect(clock.draw({ ...running, now: 500, frameState })).toBe(1123.125);
    expect(clock.draw({ ...running, now: 510, frameState })).toBe(1143.125);
  });
  it('freeze is synchronous, preserves fractional time, and excludes the frozen interval', () => {
    const clock = createLiveMaterialClock('canvas2d');
    clock.draw({ ...running, now: 0 });
    clock.draw({ ...running, now: 16.125 });
    clock.freeze();
    expect(clock.draw({ ...running, now: 9999 })).toBe(32.25);
    expect(clock.read(700).frame).toBe(32.25);
    clock.resume();
    expect(clock.draw({ ...running, now: 10000 })).toBe(32.25);
    expect(clock.draw({ ...running, now: 10016 })).toBe(64.25);
  });
  it('does not advance hidden, paused, or speed-zero frames', () => {
    const clock = createLiveMaterialClock('webgl');
    clock.draw({ ...running, now: 0 });
    clock.draw({ ...running, now: 16 });
    clock.draw({ ...running, now: 17, active: false });
    expect(clock.draw({ ...running, now: 9999 })).toBe(32);
    expect(clock.draw({ ...running, now: 10001, paused: true })).toBe(32);
    expect(clock.draw({ ...running, now: 10017, rate: 0 })).toBe(32);
  });
  it('never pretends a fluid timestamp reconstructs the historical simulation', () => {
    const clock = createLiveMaterialClock('fluid');
    clock.draw({ ...running, now: 0 });
    clock.draw({ ...running, now: 16 });
    expect(clock.draw({ ...running, now: 17, captureTimeMs: 9999 })).toBe(32);
    expect(clock.draw({ ...running, now: 18, captureTimeMs: 1 })).toBe(32);
  });
  it('never performs an extra simulation step for freeze or zero-dt invalidations', () => {
    expect(shouldAdvanceLiveFluid(true, null, false, 1, 16)).toBe(true);
    expect(shouldAdvanceLiveFluid(true, null, false, 1, 0)).toBe(false);
    expect(shouldAdvanceLiveFluid(true, null, true, 1, 16)).toBe(false);
    expect(shouldAdvanceLiveFluid(true, 500, false, 1, 16)).toBe(false);
    expect(shouldAdvanceLiveFluid(true, null, false, 0, 16)).toBe(false);
  });
  it('ignores anchors from another provider or material', () => {
    const clock = createLiveMaterialClock('webgl', 'shaders-drift');
    expect(clock.draw({ ...running, now: 0, frameState: { version: 2, engine: 'paper', frame: 10, timelineTimeMs: 0 } })).toBe(0);
    expect(clock.draw({ ...running, now: 0, frameState: { version: 2, engine: 'webgl', materialId: 'holo-cloth-silk', frame: 10, timelineTimeMs: 0 } })).toBe(0);
  });
  it('restores pointer lighting only from a matching normalized native anchor', () => {
    const state = { version: 2 as const, engine: 'webgl' as const, materialId: 'holo-cloth-silk', frame: 900,
      timelineTimeMs: 1200, pointer: { x: 0.75, y: 0.25 } };
    expect(liveMaterialFramePointer(state, 'holo-cloth-silk')).toEqual({ x: 0.75, y: 0.25 });
    expect(liveMaterialFramePointer(state, 'shaders-drift')).toBeUndefined();
    expect(liveMaterialFramePointer({ ...state, engine: 'fluid' }, 'holo-cloth-silk')).toBeUndefined();
    expect(liveMaterialFramePointer({ ...state, pointer: { x: Infinity, y: 0 } }, 'holo-cloth-silk')).toBeUndefined();
  });
});
