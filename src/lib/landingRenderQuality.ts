export type LandingRenderQualityMode = 'auto' | 'high' | 'low';
export type LandingRenderQuality = 'high' | 'low';

export const LANDING_RENDER_FRAME_RATE = 60;
export const LANDING_RENDER_QUALITY_STORAGE_KEY = 'glyphfield-landing-render-quality-v1';
const TARGET_FRAME_INTERVAL = 1_000 / LANDING_RENDER_FRAME_RATE;

export type LandingRenderQualitySnapshot = {
  mode: LandingRenderQualityMode;
  quality: LandingRenderQuality;
  automaticallyReduced: boolean;
};

export const INITIAL_LANDING_RENDER_QUALITY: LandingRenderQualitySnapshot = {
  automaticallyReduced: false,
  mode: 'auto',
  quality: 'high',
};

export function parseLandingRenderQualityMode(value: unknown): LandingRenderQualityMode {
  return value === 'high' || value === 'low' ? value : 'auto';
}

/** Resolution only: authored material parameters and animation clocks are untouched. */
export function landingRenderBudget(
  quality: LandingRenderQuality,
  renderScale: number,
  maxPixelCount?: number
): { maxPixelCount: number | undefined; renderScale: number } {
  if (quality === 'high') return { maxPixelCount, renderScale };
  const originalBudget = maxPixelCount ?? Math.max(18_000, Math.round(360_000 * Math.min(2, renderScale * renderScale)));
  return {
    maxPixelCount: Math.max(9_000, Math.round(originalBudget * 0.5)),
    renderScale: Math.max(0.15, renderScale * Math.SQRT1_2),
  };
}

/** Two sustained bad windows, after warmup. A pause never counts as GPU pressure. */
export function createLandingFrameAssessment() {
  let previous: number | null = null;
  let warmupStarted: number | null = null;
  let windowStarted: number | null = null;
  let frames = 0;
  let elapsed = 0;
  let slowFrames = 0;
  let badWindows = 0;

  const reset = () => {
    previous = null;
    warmupStarted = null;
    windowStarted = null;
    frames = 0;
    elapsed = 0;
    slowFrames = 0;
    badWindows = 0;
  };

  const sample = (timestamp: number): boolean => {
    const interval = previous === null ? 0 : timestamp - previous;
    if (!Number.isFinite(timestamp) || interval < 0 || interval > 250) {
      reset();
      return false;
    }
    previous = timestamp;
    warmupStarted ??= timestamp;
    if (timestamp - warmupStarted < 2_000 || interval === 0) return false;
    windowStarted ??= timestamp;
    frames += 1;
    elapsed += interval;
    // Tolerate scheduler jitter, but do not mistake sustained 30–40fps or
    // repeatedly skipped 60Hz frames for healthy rendering.
    if (interval > TARGET_FRAME_INTERVAL * 1.35) slowFrames += 1;
    if (timestamp - windowStarted < 2_500 || frames < 24) return false;

    const poorCadence = elapsed / frames > TARGET_FRAME_INTERVAL * 1.15 && slowFrames / frames >= 0.2;
    badWindows = poorCadence ? badWindows + 1 : 0;
    windowStarted = timestamp;
    frames = 0;
    elapsed = 0;
    slowFrames = 0;
    return badWindows >= 2;
  };

  return { reset, sample };
}

type LandingQualityEnvironment = {
  cancelFrame: (id: number) => void;
  isVisible: () => boolean;
  prefersReducedMotion: () => boolean;
  readMode: () => unknown;
  requestFrame: (callback: FrameRequestCallback) => number;
  subscribeActivity: (listener: () => void) => () => void;
  writeMode: (mode: LandingRenderQualityMode) => void;
};

function browserEnvironment(): LandingQualityEnvironment {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    isVisible: () => document.visibilityState === 'visible',
    prefersReducedMotion: () => media?.matches ?? false,
    readMode: () => {
      try { return JSON.parse(window.localStorage.getItem(LANDING_RENDER_QUALITY_STORAGE_KEY) ?? '"auto"'); }
      catch { return 'auto'; }
    },
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    subscribeActivity: (listener) => {
      document.addEventListener('visibilitychange', listener);
      media?.addEventListener('change', listener);
      return () => {
        document.removeEventListener('visibilitychange', listener);
        media?.removeEventListener('change', listener);
      };
    },
    writeMode: (mode) => {
      try { window.localStorage.setItem(LANDING_RENDER_QUALITY_STORAGE_KEY, JSON.stringify(mode)); }
      catch { /* A blocked preference store must not prevent an in-memory override. */ }
    },
  };
}

/** One landing sampler regardless of how many visible shader tiles subscribe. */
export function createLandingRenderQualityStore(makeEnvironment = browserEnvironment) {
  let snapshot = INITIAL_LANDING_RENDER_QUALITY;
  let environment: LandingQualityEnvironment | null = null;
  let hydrated = false;
  let frame: number | null = null;
  let stopActivity: (() => void) | null = null;
  const assessment = createLandingFrameAssessment();
  const listeners = new Set<() => void>();
  const renderers = new Set<symbol>();

  const publish = (mode: LandingRenderQualityMode, automaticallyReduced = snapshot.automaticallyReduced) => {
    const quality = mode === 'auto' ? (automaticallyReduced ? 'low' : 'high') : mode;
    if (snapshot.mode === mode && snapshot.quality === quality && snapshot.automaticallyReduced === automaticallyReduced) return;
    snapshot = { automaticallyReduced, mode, quality };
    listeners.forEach((listener) => listener());
  };
  const shouldSample = () => Boolean(
    renderers.size > 0 && snapshot.mode === 'auto' && snapshot.quality === 'high'
    && environment?.isVisible() && !environment.prefersReducedMotion()
  );
  const stopSampling = () => {
    if (frame !== null) environment?.cancelFrame(frame);
    frame = null;
    assessment.reset();
  };
  const tick = (timestamp: number) => {
    frame = null;
    if (!shouldSample()) { assessment.reset(); return; }
    if (assessment.sample(timestamp)) {
      publish('auto', true);
      return;
    }
    frame = environment!.requestFrame(tick);
  };
  const syncSampling = () => {
    if (!shouldSample()) { stopSampling(); return; }
    if (frame === null) frame = environment!.requestFrame(tick);
  };
  const connect = () => {
    environment ??= makeEnvironment();
    if (!hydrated) {
      hydrated = true;
      publish(parseLandingRenderQualityMode(environment.readMode()));
    }
    stopActivity ??= environment.subscribeActivity(syncSampling);
    syncSampling();
  };
  const disconnectIfUnused = () => {
    if (listeners.size > 0 || renderers.size > 0) return;
    stopSampling();
    stopActivity?.();
    stopActivity = null;
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_LANDING_RENDER_QUALITY,
    registerVisibleRenderer: () => {
      const token = Symbol('landing-renderer');
      renderers.add(token);
      connect();
      return () => { renderers.delete(token); syncSampling(); disconnectIfUnused(); };
    },
    setMode: (value: LandingRenderQualityMode) => {
      connect();
      const mode = parseLandingRenderQualityMode(value);
      publish(mode);
      environment!.writeMode(mode);
      syncSampling();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      connect();
      return () => { listeners.delete(listener); disconnectIfUnused(); };
    },
  };
}

export const landingRenderQualityStore = createLandingRenderQualityStore();
