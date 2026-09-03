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
