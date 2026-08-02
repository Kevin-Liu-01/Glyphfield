const pendingReleases = new WeakMap<HTMLCanvasElement, number>();
let cachedWebGL2Support: boolean | null = null;

export function browserSupportsWebGL2(): boolean {
  if (cachedWebGL2Support !== null) return cachedWebGL2Support;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    cachedWebGL2Support = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGL2Support = false;
  }

  return cachedWebGL2Support;
}

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
