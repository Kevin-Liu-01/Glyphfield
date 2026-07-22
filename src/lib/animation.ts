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
};

export type FrameSchedule = {
  atMs: number;
  delayMs: number;
  position: TimelinePosition;
};

export function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
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
    return { elapsedMs, index, nextIndex, phase: 'hold', progress: 0 };
  }

  return {
    elapsedMs,
    index,
    nextIndex,
    phase: 'transition',
    progress: clamp((segmentElapsed - holdMs) / transitionMs, 0, 1),
  };
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
  transitionMs,
}: TimelineTiming & { fps: number }): FrameSchedule[] {
  if (itemCount <= 0) return [];

  const frameDuration = normalizeGifDuration(1000 / clamp(fps, 1, 60));
  const holdDuration = normalizeGifDuration(holdMs);
  const hasTransition = itemCount > 1 && transitionMs > 0;
  const transitionDuration = hasTransition
    ? normalizeGifDuration(transitionMs)
    : 0;
  const holdFrameCount = 1;
  const transitionFrameCount =
    !hasTransition
      ? 0
      : Math.max(1, Math.round(transitionDuration / frameDuration));
  const holdDelays = distributeDuration(holdDuration, holdFrameCount);
  const transitionDelays =
    transitionFrameCount === 0
      ? []
      : distributeDuration(transitionDuration, transitionFrameCount);
  const schedule: FrameSchedule[] = [];
  let atMs = 0;

  for (let index = 0; index < itemCount; index += 1) {
    const nextIndex = (index + 1) % itemCount;
    for (const delayMs of holdDelays) {
      schedule.push({
        atMs,
        delayMs,
        position: { elapsedMs: atMs, index, nextIndex, phase: 'hold', progress: 0 },
      });
      atMs += delayMs;
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
  return {
    x: width * ((clamp(alignX, -1, 1) + 1) / 2),
    y: height * ((clamp(alignY, -1, 1) + 1) / 2),
  };
}
