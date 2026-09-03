export const MIN_AUDIO_CLIP_MS = 100;
export const DEFAULT_ANIMATION_AUDIO_ASSET_ID = 'glyphfield-open-source-score';
export const DEFAULT_ANIMATION_AUDIO_CLIP_ID = 'glyphfield-open-source-score-clip';
export const DEFAULT_ANIMATION_AUDIO_DURATION_MS = 8_400;
export const DEFAULT_ANIMATION_AUDIO_SOURCE = '/audio/open-source-score.wav';

export type AnimationAudioAsset = {
  durationMs: number;
  id: string;
  mimeType: string;
  name: string;
  peaks: readonly number[];
  source: string;
};

export type AnimationAudioClip = {
  assetId: string;
  id: string;
  timelineStartMs: number;
  trimEndMs: number;
  trimStartMs: number;
  volume: number;
};

export type AnimationAudioState = {
  assets: readonly AnimationAudioAsset[];
  clips: readonly AnimationAudioClip[];
  muted: boolean;
  volume: number;
};

export function createEmptyAnimationAudioState(): AnimationAudioState {
  return { assets: [], clips: [], muted: false, volume: 1 };
}

/** The editable launch score that ships with every new Animation Studio scene. */
export function createDefaultAnimationAudioState(
  _timelineDurationMs = Number.POSITIVE_INFINITY
): AnimationAudioState {
  return {
    assets: [{
      durationMs: DEFAULT_ANIMATION_AUDIO_DURATION_MS,
      id: DEFAULT_ANIMATION_AUDIO_ASSET_ID,
      mimeType: 'audio/wav',
      name: 'Open Source Score',
      peaks: [],
      source: DEFAULT_ANIMATION_AUDIO_SOURCE,
    }],
    clips: [{
      assetId: DEFAULT_ANIMATION_AUDIO_ASSET_ID,
      id: DEFAULT_ANIMATION_AUDIO_CLIP_ID,
      timelineStartMs: 0,
      trimEndMs: DEFAULT_ANIMATION_AUDIO_DURATION_MS,
      trimStartMs: 0,
      volume: 1,
    }],
    muted: false,
    volume: 1,
  };
}

export function cloneAnimationAudioState(state: AnimationAudioState): AnimationAudioState {
  return {
    assets: state.assets.map((asset) => ({ ...asset, peaks: [...asset.peaks] })),
    clips: state.clips.map((clip) => ({ ...clip })),
    muted: state.muted,
    volume: state.volume,
  };
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function animationAudioClipDurationMs(clip: AnimationAudioClip): number {
  return Math.max(0, clip.trimEndMs - clip.trimStartMs);
}

export function animationAudioClipEndMs(clip: AnimationAudioClip): number {
  return clip.timelineStartMs + animationAudioClipDurationMs(clip);
}

export function normalizeAnimationAudioState(
  state: AnimationAudioState,
  timelineDurationMs = Number.POSITIVE_INFINITY
): AnimationAudioState {
  const assets = state.assets.flatMap((asset) => {
    const durationMs = finite(asset.durationMs);
    if (!asset.id || !asset.source || durationMs < MIN_AUDIO_CLIP_MS) return [];
    return [{
      ...asset,
      durationMs,
      mimeType: asset.mimeType || 'audio/mpeg',
      name: asset.name.trim() || 'Audio track',
      peaks: asset.peaks.map((peak) => clamp(finite(peak), 0, 1)),
    }];
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const maximumStart = Number.isFinite(timelineDurationMs)
    ? Math.max(0, timelineDurationMs - MIN_AUDIO_CLIP_MS)
    : Number.POSITIVE_INFINITY;
  const clips = state.clips.flatMap((clip) => {
    const asset = assetById.get(clip.assetId);
    if (!asset || !clip.id) return [];
    const timelineStartMs = clamp(finite(clip.timelineStartMs), 0, maximumStart);
    const trimStartMs = clamp(finite(clip.trimStartMs), 0, asset.durationMs - MIN_AUDIO_CLIP_MS);
    const trimEndMs = clamp(
      finite(clip.trimEndMs, asset.durationMs),
      trimStartMs + MIN_AUDIO_CLIP_MS,
      asset.durationMs
    );
    return [{
      ...clip,
      timelineStartMs,
      trimEndMs,
      trimStartMs,
      volume: clamp(finite(clip.volume, 1), 0, 1),
    }];
  }).sort((left, right) => left.timelineStartMs - right.timelineStartMs);
  return {
    assets,
    clips,
    muted: Boolean(state.muted),
    volume: clamp(finite(state.volume, 1), 0, 1),
  };
}

export function updateAnimationAudioClip(
  state: AnimationAudioState,
  clipId: string,
  patch: Partial<AnimationAudioClip>,
  timelineDurationMs: number
): AnimationAudioState {
  return normalizeAnimationAudioState({
    ...state,
    clips: state.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch, id: clip.id } : clip),
  }, timelineDurationMs);
}

export function removeAnimationAudioClip(
  state: AnimationAudioState,
  clipId: string
): AnimationAudioState {
  const clips = state.clips.filter((clip) => clip.id !== clipId);
  const usedAssetIds = new Set(clips.map((clip) => clip.assetId));
  return {
    ...state,
    assets: state.assets.filter((asset) => usedAssetIds.has(asset.id)),
    clips,
  };
}

export function splitAnimationAudioClip(
  state: AnimationAudioState,
  clipId: string,
  timelineTimeMs: number,
  nextClipId: string,
  timelineDurationMs: number
): AnimationAudioState {
  const clip = state.clips.find(({ id }) => id === clipId);
  if (!clip) return state;
  const splitOffsetMs = timelineTimeMs - clip.timelineStartMs;
  const durationMs = animationAudioClipDurationMs(clip);
  if (splitOffsetMs < MIN_AUDIO_CLIP_MS || splitOffsetMs > durationMs - MIN_AUDIO_CLIP_MS) {
    return state;
  }
  const sourceSplitMs = clip.trimStartMs + splitOffsetMs;
  return normalizeAnimationAudioState({
    ...state,
    clips: state.clips.flatMap((candidate) => candidate.id === clipId
      ? [
          { ...candidate, trimEndMs: sourceSplitMs },
          {
            ...candidate,
            id: nextClipId,
            timelineStartMs: timelineTimeMs,
            trimStartMs: sourceSplitMs,
          },
        ]
      : [candidate]),
  }, timelineDurationMs);
}

export function audioPeaks(
  buffer: Pick<AudioBuffer, 'getChannelData' | 'length' | 'numberOfChannels'>,
  sampleCount = 96
): number[] {
  const count = Math.max(8, Math.round(sampleCount));
  const blockSize = Math.max(1, Math.floor(buffer.length / count));
  const peaks = Array.from({ length: count }, (_, blockIndex) => {
    const start = blockIndex * blockSize;
    const end = Math.min(buffer.length, start + blockSize);
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(data[index] ?? 0));
      }
    }
    return peak;
  });
  const maximum = Math.max(0.0001, ...peaks);
  return peaks.map((peak) => peak / maximum);
}

export function mixAnimationAudio(
  context: Pick<BaseAudioContext, 'createBuffer' | 'sampleRate'>,
  state: AnimationAudioState,
  buffers: ReadonlyMap<string, AudioBuffer>,
  timelineDurationMs: number
): AudioBuffer | null {
  if (state.muted || state.clips.length === 0 || timelineDurationMs <= 0) return null;
  const available = state.clips.flatMap((clip) => {
    const buffer = buffers.get(clip.assetId);
    return buffer ? [{ buffer, clip }] : [];
  });
  if (available.length === 0) return null;
  const sampleRate = context.sampleRate;
  const channelCount = Math.max(1, ...available.map(({ buffer }) => buffer.numberOfChannels));
  const frameCount = Math.max(1, Math.ceil(timelineDurationMs / 1_000 * sampleRate));
  const output = context.createBuffer(channelCount, frameCount, sampleRate);

  for (const { buffer, clip } of available) {
    const timelineStartFrame = Math.round(clip.timelineStartMs / 1_000 * sampleRate);
    const sourceStartFrame = Math.round(clip.trimStartMs / 1_000 * buffer.sampleRate);
    const sourceEndFrame = Math.min(
      buffer.length,
      Math.round(clip.trimEndMs / 1_000 * buffer.sampleRate)
    );
    const sourceFramesPerOutputFrame = buffer.sampleRate / sampleRate;
    const maximumOutputFrames = Math.ceil((sourceEndFrame - sourceStartFrame) / sourceFramesPerOutputFrame);
    const outputFrames = Math.min(maximumOutputFrames, frameCount - timelineStartFrame);
    const gain = clip.volume * state.volume;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sourceData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      const outputData = output.getChannelData(channel);
      for (let frame = 0; frame < outputFrames; frame += 1) {
        const sourceFrame = sourceStartFrame + Math.floor(frame * sourceFramesPerOutputFrame);
        outputData[timelineStartFrame + frame] = clamp(
          (outputData[timelineStartFrame + frame] ?? 0) + (sourceData[sourceFrame] ?? 0) * gain,
          -1,
          1
        );
      }
    }
  }
  return output;
}
