type PaperSurface = HTMLElement & { paperShaderMount?: unknown };

/** Paper installs its mount asynchronously, then draws from its ResizeObserver.
 * Observe the inserted canvas only after that native observer exists, and reveal
 * after its first layout/draw. Nothing runs again during uniform/frame changes. */
export function observePaperShaderReadiness(surface: PaperSurface, onReady: () => void) {
  let canvas: HTMLCanvasElement | null = null;
  let frame: number | null = null;
  let disposed = false;

  const afterDraw = () => {
    frame = null;
    if (disposed || !surface.isConnected || !surface.paperShaderMount
      || !canvas?.isConnected || canvas.width < 1 || canvas.height < 1) return;
    dispose();
    onReady();
  };
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    if (frame === null) frame = requestAnimationFrame(afterDraw);
  });
  const discoverCanvas = () => {
    if (disposed) return;
    const next = surface.querySelector('canvas');
    if (next === canvas) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    resizeObserver.disconnect();
    canvas = next;
    if (canvas) resizeObserver.observe(canvas);
  };
  const mutationObserver = new MutationObserver(discoverCanvas);

  function dispose() {
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  }

  mutationObserver.observe(surface, { childList: true, subtree: true });
  discoverCanvas();
  return dispose;
}
