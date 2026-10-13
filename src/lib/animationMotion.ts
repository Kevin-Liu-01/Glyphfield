import { clamp, cubicBezierAt, type CubicBezier } from './animation';

/** Transform channels a scene layer can keyframe. Values use the frame's own units. */
export type AnimationPose = {
  alignX: number;
  alignY: number;
  opacity: number;
  rotation: number;
  scale: number;
};

/**
 * One pose on a scene layer's hold. `atMs` is relative to the scene start, and
 * `easing` shapes the segment that leaves this keyframe for the next one.
 */
export type AnimationKeyframe = AnimationPose & {
  atMs: number;
  easing: CubicBezier;
  id: string;
};

export const TEXT_ANIMATION_PRESETS = [
  'none',
  'type-on',
  'word-rise',
  'line-reveal',
  'glyph-stagger',
  'tracking-in',
] as const;

export type TextAnimationPreset = typeof TEXT_ANIMATION_PRESETS[number];

/** An entrance played at the start of a text scene's hold, in the scene's own brand type. */
export type TextAnimationSettings = {
  durationMs: number;
  easing: CubicBezier;
  preset: TextAnimationPreset;
  /** Delay between successive glyphs or words. 0 lets the preset spread units across the duration. */
  staggerMs: number;
};

export const TEXT_ANIMATION_LABELS: Record<TextAnimationPreset, { description: string; label: string }> = {
  'glyph-stagger': { description: 'Each glyph settles from below in sequence.', label: 'Glyph stagger' },
  'line-reveal': { description: 'The line rises out of a baseline mask.', label: 'Line reveal' },
  none: { description: 'Text is fully set when the scene starts.', label: 'None' },
  'tracking-in': { description: 'Wide letterspacing closes to the set width.', label: 'Tracking in' },
  'type-on': { description: 'Graphemes appear one at a time, without a cursor.', label: 'Type on' },
  'word-rise': { description: 'Words fade and rise one after another.', label: 'Word rise' },
};

export const DEFAULT_KEYFRAME_EASING: CubicBezier = [0.4, 0, 0.2, 1];
export const DEFAULT_TEXT_ANIMATION: TextAnimationSettings = {
  durationMs: 640,
  easing: [0.16, 1, 0.3, 1],
  preset: 'none',
  staggerMs: 0,
};
export const MAX_SCENE_MS = 60_000;
export const MAX_SCENE_KEYFRAMES = 32;

const POSE_LIMITS: Record<keyof AnimationPose, readonly [number, number]> = {
  alignX: [-1.5, 1.5],
  alignY: [-1.5, 1.5],
  opacity: [0, 1],
  rotation: [-720, 720],
  scale: [0.05, 8],
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function bezier(value: unknown, fallback: CubicBezier): CubicBezier {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) return fallback;
  const [x1, y1, x2, y2] = value as number[];
  return [clamp(x1!, 0, 1), clamp(y1!, -1, 2), clamp(x2!, 0, 1), clamp(y2!, -1, 2)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates source keyframes: finite clamped channels, unique IDs, sorted times,
 * at most MAX_SCENE_KEYFRAMES. Returns undefined for absent or empty input.
 */
export function normalizeKeyframes(value: unknown, field = 'keyframes'): AnimationKeyframe[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array.`);
  if (value.length > MAX_SCENE_KEYFRAMES) throw new RangeError(`${field} supports at most ${MAX_SCENE_KEYFRAMES} keyframes.`);
  const seen = new Set<string>();
  const keyframes = value.map((candidate, index) => {
    if (!isRecord(candidate)) throw new TypeError(`${field}[${index}] must be an object.`);
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim().slice(0, 64) : `key-${index}`;
    if (seen.has(id)) throw new TypeError(`${field}[${index}].id must be unique.`);
    seen.add(id);
    if (!finite(candidate.atMs)) throw new TypeError(`${field}[${index}].atMs must be a finite number.`);
    const pose = {} as AnimationPose;
    for (const key of Object.keys(POSE_LIMITS) as (keyof AnimationPose)[]) {
      const raw = candidate[key];
      if (!finite(raw)) throw new TypeError(`${field}[${index}].${key} must be a finite number.`);
      const [minimum, maximum] = POSE_LIMITS[key];
      pose[key] = clamp(raw, minimum, maximum);
    }
    return {
      ...pose,
      atMs: clamp(candidate.atMs, 0, MAX_SCENE_MS),
      easing: bezier(candidate.easing, DEFAULT_KEYFRAME_EASING),
      id,
    };
  });
  keyframes.sort((first, second) => first.atMs - second.atMs);
  return keyframes.length > 0 ? keyframes : undefined;
}

export function normalizeTextAnimation(value: unknown, field = 'textAnimation'): TextAnimationSettings | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new TypeError(`${field} must be an object.`);
  const preset = value.preset;
  if (typeof preset !== 'string' || !TEXT_ANIMATION_PRESETS.includes(preset as TextAnimationPreset)) {
    throw new TypeError(`${field}.preset must be one of ${TEXT_ANIMATION_PRESETS.join(', ')}.`);
  }
  return {
    durationMs: finite(value.durationMs) ? clamp(value.durationMs, 0, MAX_SCENE_MS) : DEFAULT_TEXT_ANIMATION.durationMs,
    easing: bezier(value.easing, DEFAULT_TEXT_ANIMATION.easing),
    preset: preset as TextAnimationPreset,
    staggerMs: finite(value.staggerMs) ? clamp(value.staggerMs, 0, 2_000) : 0,
  };
}

/** Optional per-scene duration override; undefined inherits the sequence default. */
export function normalizeSceneDuration(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!finite(value)) throw new TypeError(`${field} must be a finite number of milliseconds.`);
  return clamp(Math.round(value), 0, MAX_SCENE_MS);
}

export function poseFromFrame(frame: Partial<AnimationPose> & AnimationPose): AnimationPose {
  return {
    alignX: frame.alignX,
    alignY: frame.alignY,
    opacity: frame.opacity,
    rotation: frame.rotation,
    scale: frame.scale,
  };
}

function interpolatePose(from: AnimationPose, to: AnimationPose, progress: number): AnimationPose {
  const mix = (first: number, second: number) => first + (second - first) * progress;
  return {
    alignX: mix(from.alignX, to.alignX),
    alignY: mix(from.alignY, to.alignY),
    opacity: mix(from.opacity, to.opacity),
    rotation: mix(from.rotation, to.rotation),
    scale: mix(from.scale, to.scale),
  };
}

/**
 * Pose at a time on the scene's hold. Without keyframes the frame's static pose
 * applies; before the first and after the last keyframe the nearest one holds.
 */
export function resolveKeyframePose(
  base: AnimationPose,
  keyframes: readonly AnimationKeyframe[] | undefined,
  timeMs: number
): AnimationPose {
  if (!keyframes || keyframes.length === 0) return base;
  const first = keyframes[0]!;
  if (timeMs <= first.atMs) return poseFromFrame(first);
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index]!;
    const to = keyframes[index + 1]!;
    if (timeMs >= to.atMs) continue;
    const span = to.atMs - from.atMs;
    const progress = span <= 0 ? 1 : cubicBezierAt((timeMs - from.atMs) / span, from.easing);
    return interpolatePose(from, to, progress);
  }
  return poseFromFrame(keyframes[keyframes.length - 1]!);
}

/** Keyframe within `toleranceMs` of a time, used to decide edit-in-place versus insert. */
export function keyframeNear(
  keyframes: readonly AnimationKeyframe[] | undefined,
  atMs: number,
  toleranceMs: number
): AnimationKeyframe | undefined {
  return keyframes?.find((keyframe) => Math.abs(keyframe.atMs - atMs) <= toleranceMs);
}

/**
 * Writes a pose at a time. An existing keyframe within `toleranceMs` is updated
 * (keeping its ID and easing); otherwise a new keyframe is inserted in order.
 */
export function upsertKeyframe(
  keyframes: readonly AnimationKeyframe[] | undefined,
  atMs: number,
  pose: AnimationPose,
  toleranceMs: number,
  createId: () => string,
  easing: CubicBezier = DEFAULT_KEYFRAME_EASING
): AnimationKeyframe[] {
  const current = keyframes ?? [];
  const existing = keyframeNear(current, atMs, toleranceMs);
  if (existing) {
    return current.map((keyframe) => keyframe.id === existing.id ? { ...keyframe, ...pose } : keyframe);
  }
  if (current.length >= MAX_SCENE_KEYFRAMES) {
    throw new RangeError(`A scene layer supports at most ${MAX_SCENE_KEYFRAMES} keyframes.`);
  }
  const next = [...current, { ...pose, atMs: Math.max(0, atMs), easing: [...easing] as unknown as CubicBezier, id: createId() }];
  return next.sort((first, second) => first.atMs - second.atMs);
}

/** Moves a keyframe in time without letting it cross its neighbours or leave the hold. */
export function retimeKeyframe(
  keyframes: readonly AnimationKeyframe[],
  id: string,
  atMs: number,
  holdMs: number
): AnimationKeyframe[] {
  const sorted = [...keyframes].sort((first, second) => first.atMs - second.atMs);
  const index = sorted.findIndex((keyframe) => keyframe.id === id);
  if (index < 0) return sorted;
  const minimum = index > 0 ? sorted[index - 1]!.atMs + 1 : 0;
  const maximum = index < sorted.length - 1 ? sorted[index + 1]!.atMs - 1 : Math.max(0, holdMs);
  sorted[index] = { ...sorted[index]!, atMs: Math.round(clamp(atMs, minimum, Math.max(minimum, maximum))) };
  return sorted;
}

export function keyframesAreAnimated(keyframes: readonly AnimationKeyframe[] | undefined): boolean {
  if (!keyframes || keyframes.length < 2) return false;
  const [first, ...rest] = keyframes;
  return rest.some((keyframe) => (Object.keys(POSE_LIMITS) as (keyof AnimationPose)[])
    .some((key) => keyframe[key] !== first![key]));
}

export function textAnimationIsActive(textAnimation: TextAnimationSettings | undefined): boolean {
  return Boolean(textAnimation && textAnimation.preset !== 'none' && textAnimation.durationMs > 0);
}

const WORD_SEGMENTER = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter('und', { granularity: 'word' })
  : null;
const GRAPHEME_SEGMENTER = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter('und', { granularity: 'grapheme' })
  : null;

/**
 * Splits text into the units a preset animates. Word units keep their trailing
 * spaces so concatenating units reproduces the original string exactly.
 */
export function textAnimationUnits(text: string, preset: TextAnimationPreset): string[] {
  if (preset === 'word-rise') {
    if (!WORD_SEGMENTER) return text.split(/(?<=\s)/u);
    const units: string[] = [];
    for (const { isWordLike, segment } of WORD_SEGMENTER.segment(text)) {
      if (isWordLike || units.length === 0) units.push(segment);
      else units[units.length - 1] += segment;
    }
    return units;
  }
  if (!GRAPHEME_SEGMENTER) return Array.from(text);
  return Array.from(GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment);
}

export type TextUnitState = {
  alpha: number;
  offsetY: number;
  scale: number;
};

/**
 * Per-unit progress for presets that animate units. Units start in order; with
 * no explicit stagger the starts spread over half the duration so the last unit
 * still has time to settle.
 */
export function textUnitProgress(
  settings: TextAnimationSettings,
  unitIndex: number,
  unitCount: number,
  elapsedMs: number
): number {
  const count = Math.max(1, unitCount);
  const duration = Math.max(1, settings.durationMs);
  if (settings.preset === 'type-on') {
    // Hard reveal from an empty line: unit i lands at (i + 1) / count of the entrance.
    return elapsedMs >= ((unitIndex + 1) / count) * duration ? 1 : 0;
  }
  const stagger = settings.staggerMs > 0
    ? settings.staggerMs
    : count > 1 ? (duration * 0.5) / (count - 1) : 0;
  const unitDuration = Math.max(1, duration - stagger * (count - 1));
  const local = clamp((elapsedMs - unitIndex * stagger) / unitDuration, 0, 1);
  return cubicBezierAt(local, settings.easing);
}

/** Visual state for one animated unit at an eased progress. `fontSize` scales vertical travel. */
export function textUnitState(preset: TextAnimationPreset, progress: number, fontSize: number): TextUnitState {
  if (preset === 'type-on') return { alpha: progress >= 1 ? 1 : 0, offsetY: 0, scale: 1 };
  if (preset === 'glyph-stagger') {
    return { alpha: clamp(progress * 1.6, 0, 1), offsetY: (1 - progress) * fontSize * 0.42, scale: 0.86 + progress * 0.14 };
  }
  return { alpha: progress, offsetY: (1 - progress) * fontSize * 0.28, scale: 1 };
}

export const CAPTION_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export const MAX_CAPTION_LENGTH = 120;

type SceneCaption = { position: typeof CAPTION_POSITIONS[number]; text: string };

export type SceneMotionFields = {
  caption?: SceneCaption;
  holdMs?: number;
  keyframes?: AnimationKeyframe[];
  textAnchor?: 'center' | 'start';
  textAnimation?: TextAnimationSettings;
  tracking?: number;
  transitionMs?: number;
};

export function normalizeCaption(value: unknown, field = 'caption'): SceneCaption | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new TypeError(`${field} must be an object with text and position.`);
  if (typeof value.text !== 'string') throw new TypeError(`${field}.text must be a string.`);
  const position = value.position ?? 'top-left';
  if (typeof position !== 'string' || !CAPTION_POSITIONS.includes(position as SceneCaption['position'])) {
    throw new TypeError(`${field}.position must be one of ${CAPTION_POSITIONS.join(', ')}.`);
  }
  const text = value.text.replace(/\s+/g, ' ').slice(0, MAX_CAPTION_LENGTH);
  return text.trim() ? { position: position as SceneCaption['position'], text } : undefined;
}

function normalizeTextAnchor(value: unknown, field: string): 'center' | 'start' | undefined {
  if (value === undefined || value === null) return undefined;
  if (value !== 'center' && value !== 'start') throw new TypeError(`${field} must be center or start.`);
  return value;
}

function normalizeTracking(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!finite(value)) throw new TypeError(`${field} must be a finite number of em.`);
  return clamp(value, -0.2, 0.5);
}

/**
 * Validates the motion fields of one stored frame at a source boundary and
 * returns the frame with normalized values. Unknown fields are preserved.
 */
export function normalizeSceneMotion<T extends object>(frame: T, field: string): T & SceneMotionFields {
  const record = frame as Record<string, unknown>;
  const next = { ...record } as Record<string, unknown>;
  const assign = (key: keyof SceneMotionFields, value: unknown) => {
    if (value === undefined) delete next[key];
    else next[key] = value;
  };
  assign('holdMs', normalizeSceneDuration(record.holdMs, `${field}.holdMs`));
  assign('transitionMs', normalizeSceneDuration(record.transitionMs, `${field}.transitionMs`));
  assign('keyframes', normalizeKeyframes(record.keyframes, `${field}.keyframes`));
  assign('textAnimation', normalizeTextAnimation(record.textAnimation, `${field}.textAnimation`));
  assign('caption', normalizeCaption(record.caption, `${field}.caption`));
  assign('textAnchor', normalizeTextAnchor(record.textAnchor, `${field}.textAnchor`));
  assign('tracking', normalizeTracking(record.tracking, `${field}.tracking`));
  return next as T & SceneMotionFields;
}

/** Non-throwing variant for stored drafts and history: invalid motion fields are dropped. */
export function sanitizeSceneMotion<T extends object>(frame: T): T & SceneMotionFields {
  const record = { ...frame } as Record<string, unknown>;
  for (const key of ['caption', 'holdMs', 'keyframes', 'textAnchor', 'textAnimation', 'tracking', 'transitionMs'] as const) {
    try {
      normalizeSceneMotion({ [key]: record[key] }, key);
    } catch {
      delete record[key];
    }
  }
  return normalizeSceneMotion(record, 'frame') as T & SceneMotionFields;
}

export const MOTION_PRESETS = [
  { description: 'A slow 6% push across the whole hold.', id: 'push-in', label: 'Push in' },
  { description: 'Fades up from below, then settles.', id: 'rise-in', label: 'Rise in' },
  { description: 'Enters from the left edge with a long ease-out.', id: 'slide-in', label: 'Slide in' },
  { description: 'Scales up with a small overshoot.', id: 'pop-in', label: 'Pop in' },
  { description: 'A gentle vertical drift that returns home.', id: 'float', label: 'Float' },
] as const;

export type MotionPresetId = typeof MOTION_PRESETS[number]['id'];

const EASE_OUT_EXPO: CubicBezier = [0.16, 1, 0.3, 1];
const EASE_IN_OUT: CubicBezier = [0.45, 0, 0.55, 1];
const EASE_OVERSHOOT: CubicBezier = [0.34, 1.56, 0.64, 1];
const EASE_LINEARISH: CubicBezier = [0.33, 0, 0.67, 1];

export function isMotionPresetId(value: unknown): value is MotionPresetId {
  return MOTION_PRESETS.some(({ id }) => id === value);
}

/** Keyframes for a one-click preset around the layer's settled pose. */
export function motionPresetKeyframes(
  preset: MotionPresetId,
  base: AnimationPose,
  holdMs: number,
  createId: () => string
): AnimationKeyframe[] {
  const hold = Math.max(200, holdMs);
  const entrance = Math.round(Math.min(hold * 0.6, 720));
  const key = (atMs: number, pose: Partial<AnimationPose>, easing: CubicBezier): AnimationKeyframe => ({
    ...base,
    ...pose,
    atMs: Math.round(atMs),
    easing: [...easing] as unknown as CubicBezier,
    id: createId(),
  });
  switch (preset) {
    case 'push-in':
      return [key(0, {}, EASE_LINEARISH), key(hold, { scale: base.scale * 1.06 }, EASE_LINEARISH)];
    case 'rise-in':
      return [key(0, { alignY: base.alignY + 0.14, opacity: 0 }, EASE_OUT_EXPO), key(entrance, {}, EASE_OUT_EXPO)];
    case 'slide-in':
      return [key(0, { alignX: base.alignX - 0.22, opacity: 0 }, EASE_OUT_EXPO), key(entrance, {}, EASE_OUT_EXPO)];
    case 'pop-in':
      return [key(0, { opacity: 0, scale: base.scale * 0.82 }, EASE_OVERSHOOT), key(Math.min(entrance, 520), {}, EASE_OVERSHOOT)];
    case 'float':
      return [key(0, {}, EASE_IN_OUT), key(hold / 2, { alignY: base.alignY - 0.03 }, EASE_IN_OUT), key(hold, {}, EASE_IN_OUT)];
  }
}

export const EASING_CHOICES: readonly { id: string; label: string; value: CubicBezier }[] = [
  { id: 'material', label: 'Material', value: [0.4, 0, 0.2, 1] },
  { id: 'ease-out', label: 'Ease out', value: EASE_OUT_EXPO },
  { id: 'in-out', label: 'Ease in-out', value: EASE_IN_OUT },
  { id: 'overshoot', label: 'Overshoot', value: EASE_OVERSHOOT },
  { id: 'linear', label: 'Linear', value: [0, 0, 1, 1] },
];

export function easingChoiceId(curve: CubicBezier): string {
  return EASING_CHOICES.find(({ value }) => value.every((entry, index) => Math.abs(entry - (curve[index] ?? 0)) < 1e-6))?.id ?? 'custom';
}
