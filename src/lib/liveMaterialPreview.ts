export const LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT = 'glyphfield:live-material-pattern-scale-preview';
export const LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT = 'glyphfield:live-material-settings-preview';
export const LIVE_MATERIAL_TIME_PREVIEW_EVENT = 'glyphfield:live-material-time-preview';

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
  engine: 'paper';
  frame: number;
  timelineTimeMs: number;
  version: 1;
};

type PaperShaderFrameSurface = ParentNode & {
  paperShaderMount?: {
    getCurrentFrame: () => number;
  };
};

export function normalizeLiveMaterialFrameState(value: unknown): LiveMaterialFrameState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LiveMaterialFrameState>;
  if (
    candidate.engine !== 'paper'
    || !Number.isFinite(candidate.frame)
    || !Number.isFinite(candidate.timelineTimeMs)
  ) return undefined;
  return {
    engine: 'paper',
    frame: candidate.frame!,
    timelineTimeMs: Math.max(0, candidate.timelineTimeMs!),
    version: 1,
  };
}

export function captureLiveMaterialFrameState(
  root: ParentNode | null,
  timelineTimeMs: number
): LiveMaterialFrameState | undefined {
  if (!root) return undefined;
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
      version: 1,
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
