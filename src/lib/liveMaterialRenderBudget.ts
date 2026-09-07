export type LiveMaterialPixelRatioInput = {
  cssHeight: number;
  cssWidth: number;
  devicePixelRatio: number;
  maxDevicePixelRatio: number;
  maxPixelCount?: number;
  renderScale: number;
};

export function liveMaterialFrameIsDue(timeMs: number, lastDrawnMs: number, frameRate: number): boolean {
  if (lastDrawnMs <= 0) return true;
  const intervalMs = 1_000 / Math.max(1, frameRate);
  // rAF timestamps fluctuate slightly around vsync (16.6 vs 16.67ms at 60Hz).
  // A strict interval comparison drops alternate frames at the native rate.
  return timeMs - lastDrawnMs >= intervalMs - Math.min(0.75, intervalMs * 0.05);
}

/** Carry fractional vsync remainder instead of rounding 60fps down to 45/48fps. */
export function createLiveMaterialFramePacer() {
  let nextFrameAt: number | null = null;
  let previousRate = 0;
  return {
    shouldDraw(timeMs: number, requestedRate: number, force = false): boolean {
      const rate = Number.isFinite(requestedRate) ? Math.min(60, Math.max(1, requestedRate)) : 60;
      const intervalMs = 1_000 / rate;
      const toleranceMs = Math.min(0.75, intervalMs * 0.05);
      if (rate !== previousRate) nextFrameAt = null;
      previousRate = rate;
      if (!force && nextFrameAt !== null && timeMs + toleranceMs < nextFrameAt) return false;
      if (force || nextFrameAt === null || timeMs < nextFrameAt) {
        // Slightly early native vsync must not accumulate into a skipped frame
        // on a 59.94/60Hz display. Forced edits start a new phase.
        nextFrameAt = timeMs + intervalMs;
      } else {
        // Skip missed deadlines after a stall without replaying old frames.
        nextFrameAt += (Math.floor((timeMs - nextFrameAt) / intervalMs) + 1) * intervalMs;
      }
      return true;
    },
    delayUntilNext(timeMs: number): number {
      return Math.max(0, (nextFrameAt ?? timeMs) - timeMs);
    },
    reset() { nextFrameAt = null; },
  };
}

export function resolveLiveMaterialPixelRatio({
  cssHeight,
  cssWidth,
  devicePixelRatio,
  maxDevicePixelRatio,
  maxPixelCount,
  renderScale,
}: LiveMaterialPixelRatioInput): number {
  const requestedRatio = Math.max(
    0.1,
    Math.min(maxDevicePixelRatio, Math.max(0.1, devicePixelRatio) * Math.max(0.1, renderScale))
  );
  if (!Number.isFinite(maxPixelCount) || (maxPixelCount ?? 0) <= 0) return requestedRatio;

  const cssPixels = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const budgetRatio = Math.sqrt(Math.max(1, maxPixelCount ?? 1) / cssPixels);
  return Math.max(0.1, Math.min(requestedRatio, budgetRatio));
}

export function liveMaterialInstancePixelBudget({
  instanceCount,
  maxPerInstance,
  minPerInstance,
  totalBudget,
}: {
  instanceCount: number;
  maxPerInstance: number;
  minPerInstance: number;
  totalBudget: number;
}): number {
  const count = Math.max(1, Math.floor(instanceCount));
  const fairShare = Math.floor(Math.max(1, totalBudget) / count);
  return Math.max(minPerInstance, Math.min(maxPerInstance, fairShare));
}
