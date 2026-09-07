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

  const requestFrame = () => {
    timeout = 0;
    if (!disposed && frame === 0) frame = requestAnimationFrame(tick);
  };
  const tick = (time: number) => {
    frame = 0;
    if (disposed) return;
    draw(time);
    if (!isAnimating()) return;
    const rate = Math.min(60, Math.max(1, frameRate()));
    if (rate >= 55) requestFrame();
    else timeout = window.setTimeout(requestFrame, Math.max(0, 1_000 / rate - 8));
  };

  return {
    invalidate() {
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
