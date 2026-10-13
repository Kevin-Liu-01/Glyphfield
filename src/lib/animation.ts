export type CubicBezier = readonly [number, number, number, number];

export type TimelineTiming = {
  holdMs: number;
  itemCount: number;
  transitionMs: number;
};

export type TimelinePosition = {
  elapsedMs: number;
  index: number;
  nextIndex: number;
  phase: 'hold' | 'transition';
  progress: number;
  /** Time since the current scene started, clamped to its hold. Drives layer keyframes and text reveals. */
  sceneElapsedMs?: number;
};

/** Absolute start, hold, and outgoing transition of every scene on the master timeline. */
export type SequenceLayout = {
  count: number;
  holds: readonly number[];
  starts: readonly number[];
  totalMs: number;
  transitions: readonly number[];
};

export type FrameSchedule = {
  atMs: number;
  delayMs: number;
  position: TimelinePosition;
};

export type PlaybackAdvance = {
  stopped: boolean;
  timeMs: number;
};

export type AnimationPreviewDecision = {
  compositedBackgroundIsAnimated: boolean;
  contentIsAnimated: boolean;
  currentSourceId?: string;
  frameIsDue: boolean;
  pageVisible: boolean;
  previewDirty: boolean;
  previousSourceId: string;
};

export type AnimationPreviewResolution = {
  height: number;
  width: number;
};

export function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveBezierControlPoint(
  pointerX: number,
  pointerY: number
): readonly [number, number] {
  const graphStart = 0.1;
  const graphEnd = 0.9;
  const graphSize = graphEnd - graphStart;
  return [
    clamp((pointerX - graphStart) / graphSize, 0, 1),
    clamp((graphEnd - pointerY) / graphSize, -1, 2),
  ];
}

function cubicCoordinate(
  parameter: number,
  firstControl: number,
  secondControl: number
): number {
  const inverse = 1 - parameter;
  return (
    3 * inverse * inverse * parameter * firstControl +
    3 * inverse * parameter * parameter * secondControl +
    parameter * parameter * parameter
  );
}

export function cubicBezierAt(progress: number, curve: CubicBezier): number {
  const target = clamp(progress, 0, 1);
  if (target === 0 || target === 1) return target;

  const [x1, y1, x2, y2] = curve;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const parameter = (low + high) / 2;
    if (cubicCoordinate(parameter, x1, x2) < target) {
      low = parameter;
    } else {
      high = parameter;
    }
  }

  return cubicCoordinate((low + high) / 2, y1, y2);
}

export function cycleDurationMs(timing: TimelineTiming): number {
  if (timing.itemCount <= 0) return 0;
  if (timing.itemCount === 1) return Math.max(0, timing.holdMs);
  return (
    Math.max(0, timing.holdMs) + Math.max(0, timing.transitionMs)
  ) * timing.itemCount;
}

export function advancePlaybackTime({
  currentTimeMs,
  durationMs,
  elapsedMs,
  loop,
  playbackRate,
}: {
  currentTimeMs: number;
  durationMs: number;
  elapsedMs: number;
  loop: boolean;
  playbackRate: number;
}): PlaybackAdvance {
  if (durationMs <= 0) return { stopped: false, timeMs: currentTimeMs };
  const nextTimeMs = currentTimeMs + Math.max(0, elapsedMs) * Math.max(0, playbackRate);
  if (loop) return { stopped: false, timeMs: nextTimeMs % durationMs };
  if (nextTimeMs >= durationMs) return { stopped: true, timeMs: durationMs };
  return { stopped: false, timeMs: nextTimeMs };
}

export function animationTimelineChanged(
  current: Pick<TimelinePosition, 'index' | 'nextIndex'>,
  previous: Pick<TimelinePosition, 'index' | 'nextIndex'>
): boolean {
  return current.index !== previous.index || current.nextIndex !== previous.nextIndex;
}

export function shouldRenderAnimationPreview({
  compositedBackgroundIsAnimated,
  contentIsAnimated,
  currentSourceId,
  frameIsDue,
  pageVisible,
  previewDirty,
  previousSourceId,
}: AnimationPreviewDecision): boolean {
  if (!pageVisible || !frameIsDue) return false;
  return compositedBackgroundIsAnimated
    || contentIsAnimated
    || previewDirty
    || previousSourceId !== currentSourceId;
}

/**
 * Sizes the interactive backing buffer for what is actually visible on screen.
 * Exporters continue to render at the authored document dimensions.
 */
export function resolveAnimationPreviewResolution({
  devicePixelRatio = 1,
  logicalHeight,
  logicalWidth,
  maxPixelCount,
  viewportHeight,
  viewportWidth,
}: {
  devicePixelRatio?: number;
  logicalHeight: number;
  logicalWidth: number;
  maxPixelCount: number;
  viewportHeight: number;
  viewportWidth: number;
}): AnimationPreviewResolution {
  const width = Math.max(1, logicalWidth);
  const height = Math.max(1, logicalHeight);
  const pixelRatio = clamp(devicePixelRatio, 1, 2);
  const hasViewport = viewportWidth > 0 && viewportHeight > 0;
  const viewportScale = hasViewport
    ? Math.min(viewportWidth / width, viewportHeight / height)
    : 1;
  const visibleScale = Math.min(1, Math.max(1 / Math.max(width, height), viewportScale * pixelRatio));
  const pixelBudgetScale = Math.sqrt(Math.max(1, maxPixelCount) / (width * height));
  const renderScale = Math.min(visibleScale, pixelBudgetScale);
  return {
    height: Math.max(1, Math.round(height * renderScale)),
    width: Math.max(1, Math.round(width * renderScale)),
  };
}

/** Storyboard scale in pixels per second of master time. */
export const DEFAULT_TIMELINE_ZOOM = 150;
export const MIN_TIMELINE_ZOOM = 40;
export const MAX_TIMELINE_ZOOM = 800;

export function clampTimelineZoom(value: number | undefined): number {
  const resolved = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TIMELINE_ZOOM;
  return Math.round(Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, resolved)));
}

function finiteDuration(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Lays out scenes with their own hold and outgoing transition. A single scene
 * never reserves transition time; with more scenes the last transition wraps to
 * the first, matching the looping preview and the GIF/MP4 frame tables.
 */
export function createSequenceLayout(
  holds: readonly number[],
  transitions: readonly number[]
): SequenceLayout {
  const count = holds.length;
  const resolvedHolds = holds.map(finiteDuration);
  const resolvedTransitions = holds.map((_, index) => (
    count > 1 ? finiteDuration(transitions[index]) : 0
  ));
  const starts: number[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    starts.push(cursor);
    cursor += resolvedHolds[index]! + resolvedTransitions[index]!;
  }
  return {
    count,
    holds: resolvedHolds,
    starts,
    totalMs: cursor,
    transitions: resolvedTransitions,
  };
}

export function uniformSequenceLayout(timing: TimelineTiming): SequenceLayout {
  const count = Math.max(0, Math.floor(timing.itemCount));
  return createSequenceLayout(
    Array.from({ length: count }, () => timing.holdMs),
    Array.from({ length: count }, () => timing.transitionMs)
  );
}

export function sequenceLayoutsEqual(first: SequenceLayout, second: SequenceLayout): boolean {
  return first.count === second.count
    && first.holds.every((hold, index) => hold === second.holds[index])
    && first.transitions.every((transition, index) => transition === second.transitions[index]);
}

/** Start of a scene's hold, or the midpoint of its outgoing transition. */
export function sequenceSceneTime(
  layout: SequenceLayout,
  index: number,
  target: 'hold' | 'transition' | 'transition-start' = 'hold'
): number {
  if (layout.count === 0) return 0;
  const resolved = Math.min(layout.count - 1, Math.max(0, Math.floor(index)));
  const start = layout.starts[resolved] ?? 0;
  if (target === 'hold') return start;
  const hold = layout.holds[resolved] ?? 0;
  if (target === 'transition-start') return start + hold;
  return start + hold + (layout.transitions[resolved] ?? 0) / 2;
}

/** Resolves the master playhead through per-scene timing. Time wraps like the looping preview. */
export function resolveSequencePosition(timeMs: number, layout: SequenceLayout): TimelinePosition {
  const count = Math.max(1, layout.count);
  if (layout.count === 0 || layout.totalMs <= 0) {
    return { elapsedMs: 0, index: 0, nextIndex: layout.count > 1 ? 1 : 0, phase: 'hold', progress: 0, sceneElapsedMs: 0 };
  }
  const time = Number.isFinite(timeMs) ? timeMs : 0;
  const elapsedMs = ((time % layout.totalMs) + layout.totalMs) % layout.totalMs;
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((layout.starts[middle] ?? 0) <= elapsedMs) low = middle;
    else high = middle - 1;
  }
  const index = low;
  const holdMs = layout.holds[index] ?? 0;
  const transitionMs = layout.transitions[index] ?? 0;
  const segmentElapsed = elapsedMs - (layout.starts[index] ?? 0);
  const nextIndex = (index + 1) % count;
  if (transitionMs === 0 || segmentElapsed < holdMs) {
    return { elapsedMs, index, nextIndex, phase: 'hold', progress: 0, sceneElapsedMs: Math.min(holdMs, segmentElapsed) };
  }
  return {
    elapsedMs,
    index,
    nextIndex,
    phase: 'transition',
    progress: clamp((segmentElapsed - holdMs) / transitionMs, 0, 1),
    sceneElapsedMs: holdMs,
  };
}

export function resolveTimeline(
  timeMs: number,
  timing: TimelineTiming
): TimelinePosition {
  const itemCount = Math.max(1, Math.floor(timing.itemCount));
  const holdMs = Math.max(0, timing.holdMs);
  const transitionMs = itemCount === 1 ? 0 : Math.max(0, timing.transitionMs);
  const segmentMs = Math.max(1, holdMs + transitionMs);
  const cycleMs = itemCount * segmentMs;
  const elapsedMs = ((timeMs % cycleMs) + cycleMs) % cycleMs;
  const index = Math.min(itemCount - 1, Math.floor(elapsedMs / segmentMs));
  const segmentElapsed = elapsedMs - index * segmentMs;
  const nextIndex = (index + 1) % itemCount;

  if (transitionMs === 0 || segmentElapsed < holdMs) {
    return { elapsedMs, index, nextIndex, phase: 'hold', progress: 0, sceneElapsedMs: Math.min(holdMs, segmentElapsed) };
  }

  return {
    elapsedMs,
    index,
    nextIndex,
    phase: 'transition',
    progress: clamp((segmentElapsed - holdMs) / transitionMs, 0, 1),
    sceneElapsedMs: holdMs,
  };
}

export function resolveContinuousSourceFrame(
  position: TimelinePosition,
  timing: Pick<TimelineTiming, 'holdMs' | 'transitionMs'>,
  totalFrames: number
): number {
  const lastFrame = Math.max(0, totalFrames - 1);
  if (lastFrame === 0) return 0;

  const holdMs = Math.max(1, timing.holdMs);
  const segmentMs = holdMs + Math.max(0, timing.transitionMs);
  const segmentElapsed = position.elapsedMs - position.index * segmentMs;
  const progress = position.phase === 'transition'
    ? 1
    : clamp(segmentElapsed / holdMs, 0, 1);
  return progress * lastFrame;
}

function normalizeGifDuration(durationMs: number): number {
  return Math.max(10, Math.round(durationMs / 10) * 10);
}

function distributeDuration(totalMs: number, frameCount: number): number[] {
  const count = Math.max(1, Math.min(frameCount, totalMs / 10));
  const base = Math.floor(totalMs / count / 10) * 10;
  const durations = Array.from({ length: count }, () => base);
  let remainder = totalMs - base * count;
  for (let index = 0; remainder > 0; index = (index + 1) % count) {
    durations[index] = (durations[index] ?? base) + 10;
    remainder -= 10;
  }
  return durations;
}

export function buildFrameSchedule({
  fps,
  holdMs,
  itemCount,
  sampleHoldFrames = false,
  transitionMs,
}: TimelineTiming & { fps: number; sampleHoldFrames?: boolean }): FrameSchedule[] {
  return buildSequenceFrameSchedule({
    fps,
    layout: uniformSequenceLayout({ holdMs, itemCount, transitionMs }),
    sampleHold: () => sampleHoldFrames,
  });
}

/**
 * GIF frame table for per-scene timing. Holds collapse to one frame unless the
 * scene moves during its hold (shader background, layer keyframes, text reveal).
 */
export function buildSequenceFrameSchedule({
  fps,
  layout,
  sampleHold = () => false,
}: {
  fps: number;
  layout: SequenceLayout;
  sampleHold?: (index: number) => boolean;
}): FrameSchedule[] {
  if (layout.count <= 0) return [];

  const frameDuration = normalizeGifDuration(1000 / clamp(fps, 1, 60));
  const schedule: FrameSchedule[] = [];
  let atMs = 0;

  for (let index = 0; index < layout.count; index += 1) {
    const nextIndex = (index + 1) % layout.count;
    const holdDuration = normalizeGifDuration(layout.holds[index] ?? 0);
    const transitionMs = layout.transitions[index] ?? 0;
    const transitionDuration = transitionMs > 0 ? normalizeGifDuration(transitionMs) : 0;
    const holdFrameCount = sampleHold(index)
      ? Math.max(1, Math.round(holdDuration / frameDuration))
      : 1;
    const transitionFrameCount = transitionDuration === 0
      ? 0
      : Math.max(1, Math.round(transitionDuration / frameDuration));
    const holdDelays = distributeDuration(holdDuration, holdFrameCount);
    const transitionDelays = transitionFrameCount === 0
      ? []
      : distributeDuration(transitionDuration, transitionFrameCount);
    let sceneElapsedMs = 0;
    for (const delayMs of holdDelays) {
      schedule.push({
        atMs,
        delayMs,
        position: { elapsedMs: atMs, index, nextIndex, phase: 'hold', progress: 0, sceneElapsedMs },
      });
      atMs += delayMs;
      sceneElapsedMs += delayMs;
    }

    for (let frame = 0; frame < transitionDelays.length; frame += 1) {
      const delayMs = transitionDelays[frame] ?? 10;
      schedule.push({
        atMs,
        delayMs,
        position: {
          elapsedMs: atMs,
          index,
          nextIndex,
          phase: 'transition',
          progress: (frame + 1) / (transitionDelays.length + 1),
          sceneElapsedMs: layout.holds[index] ?? 0,
        },
      });
      atMs += delayMs;
    }
  }

  return schedule;
}

export function resolveAnchor(
  width: number,
  height: number,
  alignX: number,
  alignY: number
): { x: number; y: number } {
  // ±1 is the canvas edge; keyframes may park a layer just outside it.
  return {
    x: width * ((clamp(alignX, -1.5, 1.5) + 1) / 2),
    y: height * ((clamp(alignY, -1.5, 1.5) + 1) / 2),
  };
}
