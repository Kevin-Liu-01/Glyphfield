const pendingReleases = new WeakMap<HTMLCanvasElement, number>();
let cachedWebGL2Support: boolean | null = null;
let cachedWebGL2SupportAt = 0;
let webGLUnavailableUntil = 0;

const SUPPORT_CACHE_MS = 30_000;
const FAILURE_COOLDOWN_MS = 2_000;

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function markWebGLContextUnavailable() {
  cachedWebGL2Support = false;
  cachedWebGL2SupportAt = now();
  webGLUnavailableUntil = cachedWebGL2SupportAt + FAILURE_COOLDOWN_MS;
}

export function resetWebGLContextAvailability() {
  cachedWebGL2Support = null;
  cachedWebGL2SupportAt = 0;
  webGLUnavailableUntil = 0;
}

export function browserSupportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  const checkedAt = now();
  if (checkedAt < webGLUnavailableUntil) return false;
  if (
    cachedWebGL2Support !== null
    && checkedAt - cachedWebGL2SupportAt < (
      cachedWebGL2Support ? SUPPORT_CACHE_MS : FAILURE_COOLDOWN_MS
    )
  ) return cachedWebGL2Support;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
      stencil: false,
    });
    cachedWebGL2Support = context !== null;
    cachedWebGL2SupportAt = checkedAt;
    if (!context) webGLUnavailableUntil = checkedAt + FAILURE_COOLDOWN_MS;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    markWebGLContextUnavailable();
  }

  return cachedWebGL2Support ?? false;
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
