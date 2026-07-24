const pendingReleases = new WeakMap<HTMLCanvasElement, number>();

export function cancelWebGLContextRelease(canvas: HTMLCanvasElement) {
  const pendingRelease = pendingReleases.get(canvas);
  if (pendingRelease === undefined) return;
  window.clearTimeout(pendingRelease);
  pendingReleases.delete(canvas);
}

export function scheduleWebGLContextRelease(
  canvas: HTMLCanvasElement,
  context: WebGLRenderingContext | WebGL2RenderingContext
) {
  cancelWebGLContextRelease(canvas);
  const pendingRelease = window.setTimeout(() => {
    pendingReleases.delete(canvas);
    context.getExtension('WEBGL_lose_context')?.loseContext();
  }, 250);
  pendingReleases.set(canvas, pendingRelease);
}
