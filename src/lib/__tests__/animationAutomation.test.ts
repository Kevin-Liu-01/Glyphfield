import { describe, expect, it } from 'vitest';

import { createSequenceLayout } from '../animation';
import {
  animationExportSignature,
  describeAnimationScenes,
  parseAnimationKeyframeRemove,
  parseAnimationKeyframeSet,
  parseAnimationMotionPreset,
  parseAnimationSceneUpdate,
  parseAnimationSeekInput,
} from '../animationAutomation';
import type { StudioSource } from '../renderFrame';

describe('Animation Browser API inputs', () => {
  it('validates seek, scene, keyframe, and preset requests before any edit', () => {
    expect(parseAnimationSeekInput({ timeMs: 1200 })).toBe(1200);
    expect(() => parseAnimationSeekInput({ timeMs: -1 })).toThrow(/non-negative/);
    expect(parseAnimationSceneUpdate({ holdMs: 1800.4, sceneId: 'text-0', textAnimation: { preset: 'type-on' } })).toMatchObject({
      holdMs: 1800,
      sceneId: 'text-0',
      textAnimation: { preset: 'type-on' },
    });
    expect(parseAnimationSceneUpdate({ holdMs: null, sceneId: 'a', textAnimation: null })).toMatchObject({ holdMs: null, textAnimation: null });
    expect(() => parseAnimationSceneUpdate({ sceneId: 'a', speed: 2 })).toThrow(/does not accept speed/);
    expect(() => parseAnimationSceneUpdate({ pose: { skew: 1 }, sceneId: 'a' })).toThrow(/not a pose channel/);
    expect(() => parseAnimationSceneUpdate({ sceneId: 'a', textAnimation: { preset: 'wiggle' } })).toThrow(/preset must be one of/);
    expect(parseAnimationKeyframeSet({ atMs: 400, easing: [0.16, 1, 0.3, 1], pose: { scale: 1.2 }, sceneId: 'a' })).toEqual({
      atMs: 400,
      easing: [0.16, 1, 0.3, 1],
      pose: { scale: 1.2 },
      sceneId: 'a',
    });
    expect(() => parseAnimationKeyframeSet({ atMs: 0, easing: [1, 2], sceneId: 'a' })).toThrow(/four finite/);
    expect(() => parseAnimationKeyframeRemove({ sceneId: 'a' })).toThrow(/keyframeId/);
    expect(parseAnimationMotionPreset({ preset: 'pop-in', sceneId: 'a' })).toEqual({ preset: 'pop-in', sceneId: 'a' });
    expect(() => parseAnimationMotionPreset({ preset: 'spin', sceneId: 'a' })).toThrow(/preset must be/);
  });

  it('describes scenes on the master timeline', () => {
    const sources: StudioSource[] = [
      { id: 'brand-logo', image: {} as CanvasImageSource, kind: 'image', name: 'Mark', height: 10, width: 10 },
      { id: 'text-0', kind: 'text', text: 'Build', textAnimation: { durationMs: 500, easing: [0, 0, 1, 1], preset: 'word-rise', staggerMs: 0 } },
    ];
    const scenes = describeAnimationScenes(sources, createSequenceLayout([1000, 800], [200, 300]));
    expect(scenes).toEqual([
      expect.objectContaining({ holdMs: 1000, id: 'brand-logo', label: 'Mark', startMs: 0, textAnimation: null, transitionMs: 200 }),
      expect.objectContaining({ holdMs: 800, id: 'text-0', label: 'Build', startMs: 1200, textAnimation: expect.objectContaining({ preset: 'word-rise' }) }),
    ]);
  });

  it('ignores background asset embedding but not edits when checking export staleness', () => {
    const state = { audio: { clips: [], muted: false, volume: 1 }, settings: { width: 100 } };
    const logo = { id: 'brand-logo', image: {} as CanvasImageSource, kind: 'image' as const, name: 'Mark', height: 10, width: 10 };
    const before = animationExportSignature({ sources: [{ ...logo, url: '/logo.svg' }], state });
    expect(animationExportSignature({ sources: [{ ...logo, url: 'data:image/svg+xml;base64,AAAA' }], state })).toBe(before);
    expect(animationExportSignature({ sources: [{ ...logo, scale: 2, url: '/logo.svg' }], state })).not.toBe(before);
    expect(animationExportSignature({ sources: [{ ...logo, url: '/logo.svg' }], state: { ...state, settings: { width: 200 } } })).not.toBe(before);
  });
});
