import { describe, expect, it } from 'vitest';

import {
  audioPeaks,
  createDefaultAnimationAudioState,
  createEmptyAnimationAudioState,
  mixAnimationAudio,
  normalizeAnimationAudioState,
  removeAnimationAudioClip,
  splitAnimationAudioClip,
  updateAnimationAudioClip,
  type AnimationAudioState,
} from '../animationAudio';

const state: AnimationAudioState = {
  assets: [{
    durationMs: 4_000,
    id: 'asset-1',
    mimeType: 'audio/wav',
    name: 'Voice.wav',
    peaks: [0, 0.5, 1],
    source: 'data:audio/wav;base64,AA==',
  }],
  clips: [{
    assetId: 'asset-1',
    id: 'clip-1',
    timelineStartMs: 500,
    trimEndMs: 3_000,
    trimStartMs: 1_000,
    volume: 0.8,
  }],
  muted: false,
  volume: 0.5,
};

describe('animation audio editing', () => {
  it('starts new timelines with the bundled editable score', () => {
    const defaultState = createDefaultAnimationAudioState(3_000);

    expect(defaultState.assets).toEqual([expect.objectContaining({
      durationMs: 8_400,
      name: 'Open Source Score',
      source: '/audio/open-source-score.wav',
    })]);
    expect(defaultState.clips).toEqual([expect.objectContaining({
      timelineStartMs: 0,
      trimEndMs: 8_400,
      trimStartMs: 0,
    })]);
  });

  it('normalizes unsafe imported values without discarding audio beyond the current timeline', () => {
    const normalized = normalizeAnimationAudioState({
      ...state,
      clips: [{ ...state.clips[0]!, timelineStartMs: -10, trimEndMs: 10_000, trimStartMs: -20, volume: 4 }],
      volume: -2,
    }, 2_000);

    expect(normalized.clips[0]).toMatchObject({
      timelineStartMs: 0,
      trimEndMs: 4_000,
      trimStartMs: 0,
      volume: 1,
    });
    expect(normalized.volume).toBe(0);
  });

  it('moves, trims, splits, and removes clips without orphaning assets', () => {
    const updated = updateAnimationAudioClip(state, 'clip-1', { timelineStartMs: 900, trimStartMs: 1_200 }, 5_000);
    expect(updated.clips[0]).toMatchObject({ timelineStartMs: 900, trimStartMs: 1_200 });

    const split = splitAnimationAudioClip(updated, 'clip-1', 1_500, 'clip-2', 5_000);
    expect(split.clips).toHaveLength(2);
    expect(split.clips[0]).toMatchObject({ id: 'clip-1', trimEndMs: 1_800 });
    expect(split.clips[1]).toMatchObject({ id: 'clip-2', timelineStartMs: 1_500, trimStartMs: 1_800 });

    const firstRemoved = removeAnimationAudioClip(split, 'clip-1');
    expect(firstRemoved.assets).toHaveLength(1);
    expect(removeAnimationAudioClip(firstRemoved, 'clip-2')).toEqual({
      ...createEmptyAnimationAudioState(),
      volume: 0.5,
    });
  });

  it('extracts normalized waveform peaks', () => {
    const samples = Float32Array.from([0, 0.25, -0.5, 1, -0.25, 0, 0.5, 0]);
    const peaks = audioPeaks({
      getChannelData: () => samples,
      length: samples.length,
      numberOfChannels: 1,
    }, 8);

    expect(peaks).toHaveLength(8);
    expect(peaks[3]).toBe(1);
    expect(Math.max(...peaks)).toBe(1);
  });

  it('mixes positioned and trimmed clips into the animation duration', () => {
    const source = {
      duration: 4,
      getChannelData: () => Float32Array.from([0, 0.5, 1, 0.5]),
      length: 4,
      numberOfChannels: 1,
      sampleRate: 1,
    } as unknown as AudioBuffer;
    const channels: Float32Array[] = [];
    const output = mixAnimationAudio({
      createBuffer: (numberOfChannels, length) => {
        channels.push(...Array.from({ length: numberOfChannels }, () => new Float32Array(length)));
        return {
          getChannelData: (channel: number) => channels[channel]!,
          length,
          numberOfChannels,
          sampleRate: 1,
        } as AudioBuffer;
      },
      sampleRate: 1,
    }, state, new Map([['asset-1', source]]), 4_000);

    expect(output).not.toBeNull();
    expect(Array.from(output!.getChannelData(0))).toEqual([
      0,
      expect.closeTo(0.2),
      expect.closeTo(0.4),
      0,
    ]);
  });
});
