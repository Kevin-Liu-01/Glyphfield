import type { LiveMaterialSettings } from './liveMaterials';
import { clampShaderZoom } from './shaderZoom';

export const LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT = 'glyphfield:live-material-pattern-scale-preview';
export const LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT = 'glyphfield:live-material-settings-preview';
export const LIVE_MATERIAL_TIME_PREVIEW_EVENT = 'glyphfield:live-material-time-preview';

export function hasUncommittedShaderPreview(
  settingsPreview: { base: LiveMaterialSettings; value: Partial<LiveMaterialSettings> } | null,
  settings: LiveMaterialSettings,
  patternPreview: { base: number; value: number } | null,
  patternScale: number,
  timePreview: { base: number | null; value: number } | null,
  captureTimeMs: number | null
) {
  return Boolean(
    (settingsPreview?.base === settings && Object.entries(settingsPreview.value)
      .some(([key, value]) => settings[key as keyof LiveMaterialSettings] !== value))
    || (patternPreview?.base === clampShaderZoom(patternScale) && patternPreview.value !== clampShaderZoom(patternScale))
    // Paper updates later time previews imperatively; the first React value
    // may equal the source while its actual rendered time has moved. Commit,
    // playback, and sequence stop explicitly clear this preview sentinel.
    || (timePreview && timePreview.base === captureTimeMs)
  );
}

/** Keep capture transactions immune to uncommitted drag previews. */
export function holdLiveMaterialPreviews(channels: readonly string[], groups: readonly string[] = []): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const heldChannels = new Set(channels);
  const heldGroups = new Set(groups);
  const events = [LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, LIVE_MATERIAL_TIME_PREVIEW_EVENT];
  const hold = (event: Event) => {
    const detail = (event as CustomEvent<{ channel?: string; group?: string }>).detail;
    if ((detail?.channel && heldChannels.has(detail.channel)) || (detail?.group && heldGroups.has(detail.group))) {
      event.stopImmediatePropagation();
    }
  };
  // Capture-phase listeners run before the renderer's ordinary listeners,
  // including ones installed before this transaction began.
  events.forEach((event) => window.addEventListener(event, hold, true));
  return () => events.forEach((event) => window.removeEventListener(event, hold, true));
}

export type LiveMaterialPatternScalePreview = {
  channel: string;
  value: number;
};

export type LiveMaterialSettingsPreview = {
  channel: string;
  settings: Record<string, number | string>;
};

export type LiveMaterialTimePreview = {
  group: string;
  timeMs: number | null;
};

export type LiveMaterialFrameState = {
  engine: 'paper' | 'webgl' | 'canvas2d' | 'shadergradient' | 'fluid';
  frame: number;
  timelineTimeMs: number;
  version: 1 | 2;
  materialId?: string;
  pointer?: { x: number; y: number };
  loopDurationMs?: number;
};

export type LiveMaterialPresentation = { filter?: string; grainOpacity?: number; grainTileSize?: number };

export type LiveMaterialRuntime = {
  readFrame: (timelineTimeMs: number) => LiveMaterialFrameState | undefined;
  freeze: () => void;
  resume: () => void;
  presentation?: () => LiveMaterialPresentation;
};

const liveMaterialRuntimes = new WeakMap<HTMLCanvasElement, LiveMaterialRuntime>();

/** Notify paused composition effects only after edited native pixels have painted. */
export function createLiveMaterialPreviewSignal(surface: HTMLElement, attribute: 'liveMaterialPreviewRevision' | 'shaderFramePreviewRevision' = 'liveMaterialPreviewRevision') {
  let firstPaint = 0;
  let secondPaint = 0;
  let revision = 0;
  let disposed = false;
  return {
    publish() {
      // Coalesce, never restart: continuous pointer/time events must not starve
      // the paused converter by continually cancelling its pending redraw.
      if (disposed || firstPaint || secondPaint) return;
      firstPaint = requestAnimationFrame(() => {
        firstPaint = 0;
        secondPaint = requestAnimationFrame(() => {
          secondPaint = 0;
          if (!disposed) surface.dataset[attribute] = String(++revision);
        });
      });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(firstPaint);
      cancelAnimationFrame(secondPaint);
    },
  };
}

export function registerLiveMaterialRuntime(canvas: HTMLCanvasElement, runtime: LiveMaterialRuntime): () => void {
  liveMaterialRuntimes.set(canvas, runtime);
  return () => { if (liveMaterialRuntimes.get(canvas) === runtime) liveMaterialRuntimes.delete(canvas); };
}

function runtimeCanvases(root: ParentNode): HTMLCanvasElement[] {
  return [root, ...Array.from(root.querySelectorAll('canvas'))]
    .filter((node): node is HTMLCanvasElement => liveMaterialRuntimes.has(node as HTMLCanvasElement));
}

export function readLiveMaterialPresentation(root: ParentNode | null): LiveMaterialPresentation | undefined {
  if (!root) return undefined;
  for (const canvas of runtimeCanvases(root)) {
    const presentation = liveMaterialRuntimes.get(canvas)?.presentation?.();
    if (presentation) return presentation;
  }
  return undefined;
}

/** Freeze existing rendered pixels synchronously; never advances a simulation to capture. */
export function freezeLiveMaterialFrame(root: ParentNode | null, timelineTimeMs: number): {
  canvas: HTMLCanvasElement;
  state: LiveMaterialFrameState;
  resume: () => void;
  presentation?: LiveMaterialPresentation;
} | undefined {
  if (!root) return undefined;
  for (const canvas of runtimeCanvases(root)) {
    const runtime = liveMaterialRuntimes.get(canvas)!;
    const state = runtime.readFrame(timelineTimeMs);
    if (!state || canvas.width <= 0 || canvas.height <= 0) continue;
    runtime.freeze();
    let resumed = false;
    return { canvas, state, presentation: runtime.presentation?.(), resume: () => { if (!resumed) { resumed = true; runtime.resume(); } } };
  }
  return undefined;
}

type PaperShaderFrameSurface = ParentNode & {
  paperShaderMount?: {
    getCurrentFrame: () => number;
  };
};

export function normalizeLiveMaterialFrameState(value: unknown): LiveMaterialFrameState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LiveMaterialFrameState>;
  if (
    !['paper', 'webgl', 'canvas2d', 'shadergradient', 'fluid'].includes(candidate.engine ?? '')
    || (candidate.version !== 2 && !(candidate.version === 1 && candidate.engine === 'paper'))
    || !Number.isFinite(candidate.frame)
    || !Number.isFinite(candidate.timelineTimeMs)
  ) return undefined;
  return {
    engine: candidate.engine!,
    frame: candidate.frame!,
    timelineTimeMs: Math.max(0, candidate.timelineTimeMs!),
    version: 2,
    ...(typeof candidate.materialId === 'string' && candidate.materialId.length <= 160
      ? { materialId: candidate.materialId } : {}),
    ...(candidate.pointer && Number.isFinite(candidate.pointer.x) && Number.isFinite(candidate.pointer.y)
      ? { pointer: { x: Math.max(0, Math.min(1, candidate.pointer.x)), y: Math.max(0, Math.min(1, candidate.pointer.y)) } } : {}),
    ...(Number.isFinite(candidate.loopDurationMs) && candidate.loopDurationMs! > 0
      ? { loopDurationMs: candidate.loopDurationMs } : {}),
  };
}

export function captureLiveMaterialFrameState(
  root: ParentNode | null,
  timelineTimeMs: number
): LiveMaterialFrameState | undefined {
  if (!root) return undefined;
  for (const canvas of runtimeCanvases(root)) {
    const state = liveMaterialRuntimes.get(canvas)?.readFrame(timelineTimeMs);
    if (state) return state;
  }
  const candidates = [
    root as PaperShaderFrameSurface,
    ...Array.from(root.querySelectorAll('[data-paper-shader]')) as PaperShaderFrameSurface[],
  ];
  for (const surface of candidates) {
    const frame = surface.paperShaderMount?.getCurrentFrame();
    if (!Number.isFinite(frame)) continue;
    return {
      engine: 'paper',
      frame: frame!,
      timelineTimeMs: Math.max(0, timelineTimeMs),
      version: 2,
    };
  }
  return undefined;
}

export function previewLiveMaterialPatternScale(channel: string, value: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LiveMaterialPatternScalePreview>(
    LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT,
    { detail: { channel, value } }
  ));
}

export function previewLiveMaterialSettings(
  channel: string,
  settings: Record<string, number | string>
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LiveMaterialSettingsPreview>(
    LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
    { detail: { channel, settings } }
  ));
}

export function previewLiveMaterialTime(group: string, timeMs: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LiveMaterialTimePreview>(
    LIVE_MATERIAL_TIME_PREVIEW_EVENT,
    { detail: { group, timeMs } }
  ));
}

export function clearLiveMaterialTimePreview(group: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LiveMaterialTimePreview>(
    LIVE_MATERIAL_TIME_PREVIEW_EVENT,
    { detail: { group, timeMs: null } }
  ));
}
