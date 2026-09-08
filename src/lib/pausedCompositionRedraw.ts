/**
 * Redraw a paused composition only when asynchronous renderer pixels change
 * readiness. Loading/error states retain the last complete effect image.
 */
export function observePausedCompositionReadiness(
  root: HTMLElement,
  draw: FrameRequestCallback
): { request: () => void; disconnect: () => void } {
  let frame: number | null = null;
  let disposed = false;
  const request = () => {
    if (disposed || frame !== null) return;
    frame = requestAnimationFrame((now) => {
      frame = null;
      if (disposed || root.querySelector(
        '[data-live-material-ready="false"], [data-live-material-ready="error"], [data-shader-skeleton]'
      )) return;
      draw(now);
    });
  };
  const observer = new MutationObserver(request);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-live-material-ready', 'data-shader-frame-ready', 'data-shader-frame-preview-revision', 'data-live-material-preview-revision'],
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
