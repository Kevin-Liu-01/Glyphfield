export type LandingRenderQualityMode = 'auto' | 'high' | 'low';
export type LandingRenderQuality = 'high' | 'low';

export const LANDING_RENDER_FRAME_RATE = 60;
export const LANDING_RENDER_QUALITY_STORAGE_KEY = 'glyphfield-landing-render-quality-v1';
export const STUDIO_RENDER_QUALITY_STORAGE_KEY = 'glyphfield-studio-render-quality-v1';
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

export type LandingFrameWindow = 'slow' | 'smooth' | 'steady';

/**
 * Sorts frame cadence into 2.5-second windows after a 2-second warmup. A
 * window is slow when frames sustain 30–40fps or keep skipping 60Hz frames,
 * smooth when nearly every frame lands on time, and steady in between. A
 * pause never counts as GPU pressure.
 */
export function createLandingFrameAssessment() {
  let previous: number | null = null;
  let warmupStarted: number | null = null;
  let windowStarted: number | null = null;
  let frames = 0;
  let elapsed = 0;
  let slowFrames = 0;

  const reset = () => {
    previous = null;
    warmupStarted = null;
    windowStarted = null;
    frames = 0;
    elapsed = 0;
    slowFrames = 0;
  };

  /** Returns a verdict when a window completes, otherwise null. */
  const sample = (timestamp: number): LandingFrameWindow | null => {
    const interval = previous === null ? 0 : timestamp - previous;
    if (!Number.isFinite(timestamp) || interval < 0 || interval > 250) {
      reset();
      return null;
    }
    previous = timestamp;
    warmupStarted ??= timestamp;
    if (timestamp - warmupStarted < 2_000 || interval === 0) return null;
    windowStarted ??= timestamp;
    frames += 1;
    elapsed += interval;
    // Tolerate scheduler jitter, but do not mistake sustained 30–40fps or
    // repeatedly skipped 60Hz frames for healthy rendering.
    if (interval > TARGET_FRAME_INTERVAL * 1.35) slowFrames += 1;
    if (timestamp - windowStarted < 2_500 || frames < 24) return null;

    const average = elapsed / frames;
    const slowShare = slowFrames / frames;
    // The smooth bar sits well above the slow one, so a cadence near the
    // boundary neither lowers nor raises quality.
    const verdict: LandingFrameWindow = average > TARGET_FRAME_INTERVAL * 1.15 && slowShare >= 0.2
      ? 'slow'
      : average <= TARGET_FRAME_INTERVAL * 1.05 && slowShare <= 0.05 ? 'smooth' : 'steady';
    windowStarted = timestamp;
    frames = 0;
    elapsed = 0;
    slowFrames = 0;
    return verdict;
  };

  return { reset, sample };
}

/** Two slow windows in a row lower Auto to Draft. */
const SLOW_WINDOWS_TO_REDUCE = 2;
/** Smooth windows in a row that return Auto to High: 10 seconds at first. */
const SMOOTH_WINDOWS_TO_RESTORE = 4;
/** Each drop after a recovery doubles the wait, up to one minute, so quality does not flap. */
const MAX_SMOOTH_WINDOWS_TO_RESTORE = 24;

type LandingQualityEnvironment = {
  cancelFrame: (id: number) => void;
  isVisible: () => boolean;
  prefersReducedMotion: () => boolean;
  readMode: () => unknown;
  requestFrame: (callback: FrameRequestCallback) => number;
  subscribeActivity: (listener: () => void) => () => void;
  writeMode: (mode: LandingRenderQualityMode) => void;
};

function browserEnvironment(storageKey = LANDING_RENDER_QUALITY_STORAGE_KEY): LandingQualityEnvironment {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    isVisible: () => document.visibilityState === 'visible',
    prefersReducedMotion: () => media?.matches ?? false,
    readMode: () => {
      try { return JSON.parse(window.localStorage.getItem(storageKey) ?? '"auto"'); }
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
      try { window.localStorage.setItem(storageKey, JSON.stringify(mode)); }
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
  let slowWindows = 0;
  let smoothWindows = 0;
  let windowsToRestore = SMOOTH_WINDOWS_TO_RESTORE;
  let restoredBefore = false;
  const listeners = new Set<() => void>();
  const renderers = new Set<symbol>();

  const publish = (mode: LandingRenderQualityMode, automaticallyReduced = snapshot.automaticallyReduced) => {
    const quality = mode === 'auto' ? (automaticallyReduced ? 'low' : 'high') : mode;
    if (snapshot.mode === mode && snapshot.quality === quality && snapshot.automaticallyReduced === automaticallyReduced) return;
    snapshot = { automaticallyReduced, mode, quality };
    listeners.forEach((listener) => listener());
  };
  // Auto keeps sampling at either resolution: slow frames lower it, recovered frames raise it again.
  const shouldSample = () => Boolean(
    renderers.size > 0 && snapshot.mode === 'auto'
    && environment?.isVisible() && !environment.prefersReducedMotion()
  );
  const resetEvidence = () => {
    assessment.reset();
    slowWindows = 0;
    smoothWindows = 0;
  };
  const stopSampling = () => {
    if (frame !== null) environment?.cancelFrame(frame);
    frame = null;
    resetEvidence();
  };
  /** Applies one window verdict; returns true when quality changed. */
  const judge = (verdict: LandingFrameWindow) => {
    slowWindows = verdict === 'slow' ? slowWindows + 1 : 0;
    smoothWindows = verdict === 'smooth' ? smoothWindows + 1 : 0;
    if (!snapshot.automaticallyReduced && slowWindows >= SLOW_WINDOWS_TO_REDUCE) {
      if (restoredBefore) windowsToRestore = Math.min(MAX_SMOOTH_WINDOWS_TO_RESTORE, windowsToRestore * 2);
      publish('auto', true);
      return true;
    }
    if (snapshot.automaticallyReduced && smoothWindows >= windowsToRestore) {
      restoredBefore = true;
      publish('auto', false);
      return true;
    }
    return false;
  };
  const tick = (timestamp: number) => {
    frame = null;
    if (!shouldSample()) { resetEvidence(); return; }
    const verdict = assessment.sample(timestamp);
    // A resolution change resizes every renderer; measure the new one from a fresh warmup.
    if (verdict && judge(verdict)) resetEvidence();
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

export type RenderQualityStore = ReturnType<typeof createLandingRenderQualityStore>;

export const landingRenderQualityStore = createLandingRenderQualityStore();

/** Design Lab live previews: same Auto/High/Low policy, stored separately from the landing demos. */
export const studioRenderQualityStore = createLandingRenderQualityStore(() => browserEnvironment(STUDIO_RENDER_QUALITY_STORAGE_KEY));
