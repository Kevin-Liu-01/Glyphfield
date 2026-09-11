/**
 * Redraw a paused composition only when asynchronous renderer pixels change
 * readiness. A short settling burst covers Safari's late canvas publication:
 * the readiness attribute can become visible one or two paints before its
 * pixels are composited into a different canvas. Loading/error states retain
 * the last complete effect image.
 */
export function observePausedCompositionReadiness(
  root: HTMLElement,
  draw: FrameRequestCallback
): { request: () => void; disconnect: () => void } {
  let frame: number | null = null;
  let settlingFrames = 0;
  let disposed = false;
  const schedule = () => {
    if (disposed || frame !== null) return;
    frame = requestAnimationFrame((now) => {
      frame = null;
      const unresolvedSurface = root.querySelector(
        '[data-live-material-ready="false"], [data-live-material-ready="error"]'
      );
      const hasReadySurface = Boolean(
        root.querySelector('[data-live-material-ready="true"]')
      );
      // LiveMaterialCanvas retains its loading overlay beside the ready native
      // renderer. Treat a skeleton as unresolved only until any renderer in the
      // composition publishes ready pixels; false/error surfaces still win.
      const unresolvedSkeleton = !hasReadySurface && Boolean(
        root.querySelector('[data-shader-skeleton]')
      );
      if (disposed || unresolvedSurface || unresolvedSkeleton) {
        settlingFrames = 0;
        return;
      }
      draw(now);
      settlingFrames = Math.max(0, settlingFrames - 1);
      if (settlingFrames > 0) schedule();
    });
  };
  const request = () => {
    if (disposed) return;
    settlingFrames = Math.max(settlingFrames, 3);
    schedule();
  };
  const observer = new MutationObserver(request);
  observer.observe(root, {
    attributes: true,
    attributeFilter: [
      'data-live-material-ready',
      'data-live-material-runtime-ready',
      'data-shader-frame-ready',
      'data-shader-frame-preview-revision',
      'data-live-material-preview-revision',
    ],
    childList: true,
    subtree: true,
  });
  root.addEventListener('load', request, true);
  document.addEventListener('visibilitychange', request);
  document.fonts?.addEventListener('loadingdone', request);
  request();
  return {
    request,
    disconnect() {
      disposed = true;
      observer.disconnect();
      root.removeEventListener('load', request, true);
      document.removeEventListener('visibilitychange', request);
      document.fonts?.removeEventListener('loadingdone', request);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
