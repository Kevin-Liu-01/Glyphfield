import { describe, expect, it, vi } from 'vitest';

import {
  buildSequenceFrameSchedule,
  createSequenceLayout,
  resolveSequencePosition,
  resolveTimeline,
  sequenceSceneTime,
  uniformSequenceLayout,
} from '../animation';
import {
  motionPresetKeyframes,
  normalizeKeyframes,
  normalizeSceneMotion,
  normalizeTextAnimation,
  resolveKeyframePose,
  retimeKeyframe,
  sanitizeSceneMotion,
  textAnimationUnits,
  textUnitProgress,
  upsertKeyframe,
  type AnimationKeyframe,
  type AnimationPose,
} from '../animationMotion';
import { applySceneMotion, renderFrame, sceneMovesDuringHold, type RenderConfig, type StudioSource } from '../renderFrame';
import { DEFAULT_SETTINGS, resolveStudioSequenceLayout } from '../studio';
import { resolveSceneTrim } from '../../components/AnimationTimelineHandles';

const base: AnimationPose = { alignX: 0, alignY: 0, opacity: 1, rotation: 0, scale: 1 };

function key(atMs: number, pose: Partial<AnimationPose>, id = `k${atMs}`): AnimationKeyframe {
  return { ...base, ...pose, atMs, easing: [0, 0, 1, 1], id };
}

describe('per-scene sequence layout', () => {
  it('places scenes with their own hold and outgoing transition', () => {
    const layout = createSequenceLayout([1000, 400, 2000], [200, 100, 300]);
    expect(layout.starts).toEqual([0, 1200, 1700]);
    expect(layout.totalMs).toBe(4000);
    expect(resolveSequencePosition(1199, layout)).toMatchObject({ index: 0, phase: 'transition' });
    expect(resolveSequencePosition(1250, layout)).toMatchObject({ index: 1, phase: 'hold', sceneElapsedMs: 50 });
    expect(resolveSequencePosition(1450, layout)).toMatchObject({ index: 1, phase: 'hold', sceneElapsedMs: 250 });
    expect(resolveSequencePosition(1650, layout)).toMatchObject({ index: 1, nextIndex: 2, phase: 'transition', progress: 0.5, sceneElapsedMs: 400 });
    expect(resolveSequencePosition(3850, layout)).toMatchObject({ index: 2, nextIndex: 0, phase: 'transition', progress: 0.5 });
    expect(resolveSequencePosition(4000, layout)).toMatchObject({ index: 0, phase: 'hold' });
    expect(sequenceSceneTime(layout, 2)).toBe(1700);
    expect(sequenceSceneTime(layout, 1, 'transition')).toBe(1650);
  });

  it('matches the uniform resolver and never reserves a transition for one scene', () => {
    const timing = { holdMs: 1250, itemCount: 3, transitionMs: 240 };
    const layout = uniformSequenceLayout(timing);
    for (const time of [0, 600, 1249, 1250, 1400, 2900, 4469]) {
      expect(resolveSequencePosition(time, layout)).toEqual(resolveTimeline(time, timing));
    }
    expect(createSequenceLayout([900], [500]).totalMs).toBe(900);
  });

  it('resolves per-scene overrides from frame settings', () => {
    const layout = resolveStudioSequenceLayout(['a', 'b'], { b: { holdMs: 300, transitionMs: 90 } }, DEFAULT_SETTINGS);
    expect(layout.holds).toEqual([DEFAULT_SETTINGS.holdMs, 300]);
    expect(layout.transitions).toEqual([DEFAULT_SETTINGS.transitionMs, 90]);
  });

  it('samples only moving holds in the GIF table and keeps every hold exact', () => {
    const layout = createSequenceLayout([1000, 500], [200, 200]);
    const schedule = buildSequenceFrameSchedule({ fps: 20, layout, sampleHold: (index) => index === 0 });
    const holds = (index: number) => schedule.filter(({ position }) => position.index === index && position.phase === 'hold');
    expect(holds(0)).toHaveLength(20);
    expect(holds(1)).toHaveLength(1);
    expect(holds(0).reduce((total, frame) => total + frame.delayMs, 0)).toBe(1000);
    expect(holds(1)[0]?.delayMs).toBe(500);
    expect(holds(0).at(-1)?.position.sceneElapsedMs).toBe(950);
  });
});

describe('scene trims', () => {
  it('rolls the cut so later scenes keep their start, or ripples on request', () => {
    expect(resolveSceneTrim({ deltaMs: 300, holds: [1000, 1000, 1000], index: 0, mode: 'roll' })).toEqual({ holdMs: 1300, nextHoldMs: 700 });
    expect(resolveSceneTrim({ deltaMs: 2000, holds: [1000, 1000], index: 0, mode: 'roll' })).toEqual({ holdMs: 1900, nextHoldMs: 100 });
    expect(resolveSceneTrim({ deltaMs: 300, holds: [1000, 1000], index: 0, mode: 'ripple' })).toEqual({ holdMs: 1300 });
    expect(resolveSceneTrim({ deltaMs: -5000, holds: [1000, 1000], index: 1, mode: 'roll' })).toEqual({ holdMs: 100 });
  });
});

describe('layer keyframes', () => {
  it('interpolates poses with the outgoing easing and holds outside the keyed span', () => {
    const keyframes = [key(200, { alignX: -0.5, opacity: 0 }), key(1200, { alignX: 0.5, opacity: 1 })];
    expect(resolveKeyframePose(base, undefined, 400)).toBe(base);
    expect(resolveKeyframePose(base, keyframes, 0)).toMatchObject({ alignX: -0.5, opacity: 0 });
    expect(resolveKeyframePose(base, keyframes, 700).alignX).toBeCloseTo(0, 5);
    expect(resolveKeyframePose(base, keyframes, 5000)).toMatchObject({ alignX: 0.5, opacity: 1 });
  });

  it('edits a nearby keyframe in place and inserts others in time order', () => {
    const keyframes = [key(0, {}, 'a'), key(1000, { scale: 2 }, 'b')];
    const edited = upsertKeyframe(keyframes, 1010, { ...base, scale: 3 }, 25, () => 'new');
    expect(edited.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(edited[1]?.scale).toBe(3);
    const inserted = upsertKeyframe(keyframes, 500, base, 25, () => 'mid');
    expect(inserted.map(({ id }) => id)).toEqual(['a', 'mid', 'b']);
  });

  it('retimes without crossing neighbours or leaving the hold', () => {
    const keyframes = [key(0, {}, 'a'), key(400, {}, 'b'), key(800, {}, 'c')];
    expect(retimeKeyframe(keyframes, 'b', 2000, 1000).find(({ id }) => id === 'b')?.atMs).toBe(799);
    expect(retimeKeyframe(keyframes, 'c', 5000, 1000).find(({ id }) => id === 'c')?.atMs).toBe(1000);
  });

  it('validates source keyframes with field errors and clamps channels', () => {
    expect(normalizeKeyframes(undefined)).toBeUndefined();
    expect(() => normalizeKeyframes({})).toThrow(/must be an array/);
    expect(() => normalizeKeyframes([{ atMs: 'soon' }])).toThrow(/atMs must be a finite number/);
    expect(() => normalizeKeyframes([{ ...key(0, {}), id: 'x' }, { ...key(10, {}), id: 'x' }])).toThrow(/unique/);
    const [keyframe] = normalizeKeyframes([{ ...key(-50, { opacity: 4, scale: 0 }), easing: 'fast' }])!;
    expect(keyframe).toMatchObject({ atMs: 0, opacity: 1, scale: 0.05, easing: [0.4, 0, 0.2, 1] });
  });

  it('builds presets that settle on the authored pose', () => {
    let id = 0;
    for (const preset of ['push-in', 'rise-in', 'slide-in', 'pop-in', 'float'] as const) {
      const keyframes = motionPresetKeyframes(preset, { ...base, alignX: 0.2 }, 1500, () => `p${id++}`);
      expect(keyframes.length).toBeGreaterThanOrEqual(2);
      const settled = resolveKeyframePose(base, keyframes, preset === 'push-in' ? 0 : 1500);
      expect(settled.alignX).toBeCloseTo(0.2, 5);
      expect(normalizeKeyframes(keyframes)).toHaveLength(keyframes.length);
    }
  });
});

describe('text entrances', () => {
  it('validates presets and source motion fields at the boundary', () => {
    expect(normalizeTextAnimation({ preset: 'type-on' })).toMatchObject({ durationMs: 640, preset: 'type-on', staggerMs: 0 });
    expect(() => normalizeTextAnimation({ preset: 'explode' })).toThrow(/preset must be one of/);
    expect(() => normalizeSceneMotion({ holdMs: -Infinity }, 'frameSettings.a')).toThrow('frameSettings.a.holdMs');
    expect(normalizeSceneMotion({ holdMs: 999.6, other: 'kept' }, 'frame')).toEqual({ holdMs: 1000, other: 'kept' });
    expect(sanitizeSceneMotion({ holdMs: 'x', keyframes: [key(0, {})], other: 1 })).toMatchObject({ keyframes: [expect.objectContaining({ atMs: 0 })], other: 1 });
  });

  it('splits units so they reassemble the original text', () => {
    for (const text of ['Save time', 'أهلاً وسهلاً', '你好', 'Build. Sell, grow!']) {
      expect(textAnimationUnits(text, 'word-rise').join('')).toBe(text);
      expect(textAnimationUnits(text, 'glyph-stagger').join('')).toBe(text);
    }
    expect(textAnimationUnits('Save time money', 'word-rise')).toHaveLength(3);
  });

  it('staggers unit progress and finishes every unit by the end of the entrance', () => {
    const settings = { durationMs: 1000, easing: [0, 0, 1, 1] as const, preset: 'glyph-stagger' as const, staggerMs: 0 };
    expect(textUnitProgress(settings, 0, 5, 0)).toBe(0);
    expect(textUnitProgress(settings, 0, 5, 300)).toBeGreaterThan(textUnitProgress(settings, 4, 5, 300));
    for (let unit = 0; unit < 5; unit += 1) expect(textUnitProgress(settings, unit, 5, 1000)).toBe(1);
    const typeOn = { ...settings, preset: 'type-on' as const };
    expect([0, 1, 2, 3].map((unit) => textUnitProgress(typeOn, unit, 4, 0))).toEqual([0, 0, 0, 0]);
    expect([0, 1, 2, 3].map((unit) => textUnitProgress(typeOn, unit, 4, 500))).toEqual([1, 1, 0, 0]);
  });
});

describe('scene motion in the renderer', () => {
  function context() {
    return {
      beginPath: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), fillStyle: '', fillText: vi.fn(), filter: 'none', font: '',
      globalAlpha: 1, measureText: vi.fn((text: string) => ({ width: text.length * 10 })), rect: vi.fn(), restore: vi.fn(),
      rotate: vi.fn(), save: vi.fn(), scale: vi.fn(), textAlign: 'center', textBaseline: 'middle', translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }
  const config = { ...DEFAULT_SETTINGS, backgroundStyle: 'solid', height: 100, width: 400 } as unknown as RenderConfig;

  it('applies keyframes for the current hold and the incoming scene start', () => {
    const source: StudioSource = { alignX: 0, id: 'a', keyframes: [key(0, { alignX: -1 }), key(1000, { alignX: 1 })], kind: 'text', text: 'A' };
    expect(applySceneMotion(source, 500).alignX).toBeCloseTo(0, 5);
    expect(applySceneMotion(source, undefined)).toBe(source);
    expect(sceneMovesDuringHold(source)).toBe(true);
    expect(sceneMovesDuringHold({ ...source, keyframes: [key(0, {})] })).toBe(false);
  });

  it('draws a type-on entrance one grapheme at a time, then the settled line', () => {
    const textAnimation = { durationMs: 400, easing: [0, 0, 1, 1] as const, preset: 'type-on' as const, staggerMs: 0 };
    const source: StudioSource = { id: 'a', kind: 'text', text: 'ABCD', textAnimation: { ...textAnimation, easing: [0, 0, 1, 1] } };
    const position = { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold' as const, progress: 0 };
    const early = context();
    renderFrame(early, [source], config, { ...position, sceneElapsedMs: 200 });
    expect(vi.mocked(early.fillText).mock.calls.map(([text]) => text)).toEqual(['A', 'B']);
    const settled = context();
    renderFrame(settled, [source], config, { ...position, sceneElapsedMs: 400 });
    expect(vi.mocked(settled.fillText).mock.calls.map(([text]) => text)).toEqual(['ABCD']);
  });
});
