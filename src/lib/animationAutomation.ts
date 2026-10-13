import type { CubicBezier, SequenceLayout } from './animation';
import {
  isMotionPresetId,
  normalizeSceneDuration,
  normalizeTextAnimation,
  type AnimationKeyframe,
  type AnimationPose,
  type MotionPresetId,
  type TextAnimationSettings,
} from './animationMotion';
import type { StudioSource } from './renderFrame';

/** Browser API inputs for Animation scene, keyframe, and playhead actions. Validated before any state change. */

export type AnimationSceneUpdateInput = {
  holdMs?: number | null;
  pose?: Partial<AnimationPose>;
  sceneId: string;
  textAnimation?: TextAnimationSettings | null;
  transitionMs?: number | null;
};

export type AnimationKeyframeSetInput = {
  atMs: number;
  easing?: CubicBezier;
  pose?: Partial<AnimationPose>;
  sceneId: string;
};

export type AnimationSceneDescription = {
  holdMs: number;
  id: string;
  index: number;
  keyframes: readonly AnimationKeyframe[];
  kind: StudioSource['kind'];
  label: string;
  startMs: number;
  textAnimation: TextAnimationSettings | null;
  transitionMs: number;
};

function record(input: unknown, action: string, shape: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${action} requires ${shape}.`);
  }
  return input as Record<string, unknown>;
}

function sceneId(value: Record<string, unknown>, action: string): string {
  if (typeof value.sceneId !== 'string' || !value.sceneId) throw new TypeError(`${action} sceneId must be a scene ID from animation.describe.`);
  return value.sceneId;
}

const POSE_KEYS = ['alignX', 'alignY', 'opacity', 'rotation', 'scale'] as const;

function pose(value: unknown, action: string): Partial<AnimationPose> | undefined {
  if (value === undefined) return undefined;
  const candidate = record(value, `${action} pose`, '{ alignX?, alignY?, opacity?, rotation?, scale? }');
  const next: Partial<AnimationPose> = {};
  for (const key of Object.keys(candidate)) {
    if (!POSE_KEYS.includes(key as typeof POSE_KEYS[number])) throw new TypeError(`${action} pose.${key} is not a pose channel.`);
    const channel = candidate[key];
    if (typeof channel !== 'number' || !Number.isFinite(channel)) throw new TypeError(`${action} pose.${key} must be a finite number.`);
    next[key as keyof AnimationPose] = channel;
  }
  return next;
}

function easing(value: unknown, action: string): CubicBezier | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== 4 || !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    throw new TypeError(`${action} easing must be four finite cubic-bezier numbers.`);
  }
  return value as unknown as CubicBezier;
}

export function parseAnimationSeekInput(input: unknown): number {
  const value = record(input, 'animation.seek', '{ timeMs: number }');
  if (typeof value.timeMs !== 'number' || !Number.isFinite(value.timeMs) || value.timeMs < 0) {
    throw new TypeError('animation.seek timeMs must be a non-negative finite number.');
  }
  return value.timeMs;
}

export function parseAnimationSceneUpdate(input: unknown): AnimationSceneUpdateInput {
  const action = 'animation.scene.update';
  const value = record(input, action, '{ sceneId, holdMs?, transitionMs?, textAnimation?, pose? }');
  const allowed = new Set(['holdMs', 'pose', 'sceneId', 'textAnimation', 'transitionMs']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${action} does not accept ${key}.`);
  return {
    holdMs: value.holdMs === null ? null : normalizeSceneDuration(value.holdMs, `${action} holdMs`),
    pose: pose(value.pose, action),
    sceneId: sceneId(value, action),
    textAnimation: value.textAnimation === null ? null : normalizeTextAnimation(value.textAnimation, `${action} textAnimation`),
    transitionMs: value.transitionMs === null ? null : normalizeSceneDuration(value.transitionMs, `${action} transitionMs`),
  };
}

export function parseAnimationKeyframeSet(input: unknown): AnimationKeyframeSetInput {
  const action = 'animation.keyframe.set';
  const value = record(input, action, '{ sceneId, atMs, pose?, easing? }');
  if (typeof value.atMs !== 'number' || !Number.isFinite(value.atMs) || value.atMs < 0) {
    throw new TypeError(`${action} atMs must be a non-negative finite number of milliseconds into the scene.`);
  }
  return { atMs: value.atMs, easing: easing(value.easing, action), pose: pose(value.pose, action), sceneId: sceneId(value, action) };
}

export function parseAnimationKeyframeRemove(input: unknown): { keyframeId: string; sceneId: string } {
  const action = 'animation.keyframe.remove';
  const value = record(input, action, '{ sceneId, keyframeId }');
  if (typeof value.keyframeId !== 'string' || !value.keyframeId) throw new TypeError(`${action} keyframeId must be a keyframe ID.`);
  return { keyframeId: value.keyframeId, sceneId: sceneId(value, action) };
}

export function parseAnimationMotionPreset(input: unknown): { preset: MotionPresetId; sceneId: string } {
  const action = 'animation.motion.preset';
  const value = record(input, action, '{ sceneId, preset }');
  if (!isMotionPresetId(value.preset)) throw new TypeError(`${action} preset must be push-in, rise-in, slide-in, pop-in, or float.`);
  return { preset: value.preset, sceneId: sceneId(value, action) };
}

export function describeAnimationScenes(
  sources: readonly StudioSource[],
  layout: SequenceLayout
): AnimationSceneDescription[] {
  return sources.map((source, index) => ({
    holdMs: layout.holds[index] ?? 0,
    id: source.id,
    index,
    keyframes: source.keyframes ?? [],
    kind: source.kind,
    label: source.kind === 'text' ? source.text : source.name,
    startMs: layout.starts[index] ?? 0,
    textAnimation: source.kind === 'text' ? source.textAnimation ?? null : null,
    transitionMs: layout.transitions[index] ?? 0,
  }));
}

/**
 * Visual signature of an animation for export staleness checks. Asset bytes are
 * identified by id, name, and size, so embedding a logo or audio file as a data
 * URL in the background never aborts an export, while any real edit still does.
 */
export function animationExportSignature(input: {
  sources: readonly StudioSource[];
  state: { audio?: { clips: readonly unknown[]; muted: boolean; volume: number } } & Record<string, unknown>;
}): string {
  const { artboards: _artboards, audio, identity: _identity, ...state } = input.state;
  return JSON.stringify({
    audio: audio ? { clips: audio.clips, muted: audio.muted, volume: audio.volume } : null,
    sources: input.sources.map((source) => source.kind === 'text'
      ? { ...source, background: source.background ? { ...source.background, image: undefined, shaderPresentation: undefined } : undefined }
      : { ...source, background: source.background ? { ...source.background, image: undefined, shaderPresentation: undefined } : undefined, image: undefined, url: undefined }),
    state,
  });
}
