import { createLiveMaterialFramePacer } from './liveMaterialRenderBudget';

/** A live renderer sleeps when paused; edits and resizes explicitly invalidate it. */
export function createLiveMaterialFrameLoop({
  draw,
  frameRate,
  isAnimating,
}: {
  draw: FrameRequestCallback;
  frameRate: () => number;
  isAnimating: () => boolean;
}) {
  let frame = 0;
  let timeout = 0;
  let disposed = false;
  let invalidated = false;
  const pacer = createLiveMaterialFramePacer();

  const requestFrame = () => {
    timeout = 0;
    if (!disposed && frame === 0) frame = requestAnimationFrame(tick);
  };
  const tick = (time: number) => {
    frame = 0;
    if (disposed) return;
    const animating = isAnimating();
    const requestedRate = frameRate();
    const rate = Number.isFinite(requestedRate) ? Math.min(60, Math.max(1, requestedRate)) : 60;
    if (pacer.shouldDraw(time, rate, invalidated || !animating)) {
      invalidated = false;
      draw(time);
    }
    if (!isAnimating()) {
      pacer.reset();
      return;
    }
    if (rate >= 55) requestFrame();
    else timeout = window.setTimeout(requestFrame, Math.max(0, pacer.delayUntilNext(performance.now()) - 8));
  };

  return {
    invalidate() {
      invalidated = true;
      window.clearTimeout(timeout);
      requestFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    },
  };
}
