import { describe, expect, it } from 'vitest';

import {
  animationArtboardSnapshotSignature,
  cloneAnimationArtboardSnapshot,
  DEFAULT_ANIMATION_ARTBOARD_ID,
  restoreAnimationArtboardWorkspace,
  type AnimationArtboardSnapshot,
} from '../animationArtboards';
import { createDefaultAnimationAudioState } from '../animationAudio';
import { createDefaultFrameSettings, DEFAULT_SETTINGS } from '../studio';

function snapshot(width = 1000, height = 300): AnimationArtboardSnapshot {
  const settings = {
    ...DEFAULT_SETTINGS,
    bezier: [...DEFAULT_SETTINGS.bezier] as typeof DEFAULT_SETTINGS.bezier,
    height,
    shaderSettings: { ...DEFAULT_SETTINGS.shaderSettings },
    width,
  };
  return {
    audio: createDefaultAnimationAudioState(),
    backgroundOverrides: { 'text-0': true },
    frameSettings: { 'text-0': createDefaultFrameSettings(settings) },
    sequenceBackground: createDefaultFrameSettings(settings).background,
    sequenceOrder: ['text-0'],
    settings,
  };
}

describe('Animation Studio artboard workspace', () => {
  it('upgrades a legacy single-canvas animation into one named artboard', () => {
    const restored = restoreAnimationArtboardWorkspace(undefined, snapshot());

    expect(restored.activeArtboardId).toBe(DEFAULT_ANIMATION_ARTBOARD_ID);
    expect(restored.artboards).toHaveLength(1);
    expect(restored.artboards[0]).toMatchObject({
      id: DEFAULT_ANIMATION_ARTBOARD_ID,
      name: 'Banner animation',
      snapshot: { settings: { height: 300, width: 1000 } },
    });
  });

  it('restores every valid artboard and overlays the live active snapshot', () => {
    const banner = snapshot();
    const wide = snapshot(1600, 900);
    const liveWide = snapshot(1920, 1080);
    const restored = restoreAnimationArtboardWorkspace({
      activeArtboardId: 'animation-artboard-wide',
      artboards: [
        { id: 'animation-artboard-main', name: 'Banner', snapshot: banner },
        { id: 'animation-artboard-wide', name: 'Wide', snapshot: wide },
      ],
    }, liveWide);

    expect(restored.activeArtboardId).toBe('animation-artboard-wide');
    expect(restored.artboards.map(({ name }) => name)).toEqual(['Banner', 'Wide']);
    expect(restored.artboards[0]?.snapshot.settings).toMatchObject({ height: 300, width: 1000 });
    expect(restored.artboards[1]?.snapshot.settings).toMatchObject({ height: 1080, width: 1920 });
  });

  it('deep-clones artboard state so changing one output cannot mutate another', () => {
    const original = snapshot();
    original.frameSettings['text-0']!.transition = {
      bezier: [0.2, 0.8, 0.2, 1],
      packageId: 'slide-fade',
    };
    const cloned = cloneAnimationArtboardSnapshot(original);

    cloned.audio!.clips[0]!.volume = 0.25;
    cloned.settings.shaderSettings.colorA = '#ABCDEF';
    cloned.frameSettings['text-0']!.background.materialSettings.colorB = '#123456';
    cloned.frameSettings['text-0']!.transition!.bezier = [0.9, 0.8, 0.2, 1];
    cloned.sequenceOrder.push('image-1');

    expect(original.audio!.clips[0]!.volume).toBe(1);
    expect(original.settings.shaderSettings.colorA).not.toBe('#ABCDEF');
    expect(original.frameSettings['text-0']!.background.materialSettings.colorB).not.toBe('#123456');
    expect(original.frameSettings['text-0']!.transition!.bezier[0]).toBe(0.2);
    expect(original.sequenceOrder).toEqual(['text-0']);
    expect(animationArtboardSnapshotSignature(original)).not.toBe(animationArtboardSnapshotSignature(cloned));
  });

  it('ignores duplicate and malformed saved artboards', () => {
    const valid = { id: 'animation-artboard-main', name: 'Main', snapshot: snapshot() };
    const restored = restoreAnimationArtboardWorkspace({
      activeArtboardId: 'animation-artboard-missing',
      artboards: [
        valid,
        valid,
        { id: 'not-an-animation-artboard', name: 'Bad', snapshot: snapshot() },
        { id: 'animation-artboard-bad', name: 'Bad', snapshot: { settings: {} } },
      ],
    }, snapshot());

    expect(restored.activeArtboardId).toBe(DEFAULT_ANIMATION_ARTBOARD_ID);
    expect(restored.artboards).toHaveLength(1);
  });
});
