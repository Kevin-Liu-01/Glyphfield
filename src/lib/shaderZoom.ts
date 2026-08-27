export const SHADER_ZOOM_MIN = 0.1;
export const SHADER_ZOOM_MAX = 10;
export const SHADER_ZOOM_SLIDER_MIN = -1;
export const SHADER_ZOOM_SLIDER_MAX = 1;
export const SHADER_ZOOM_SLIDER_STEP = 0.01;

const SHADER_ZOOM_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10] as const;

export function clampShaderZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SHADER_ZOOM_MAX, Math.max(SHADER_ZOOM_MIN, value));
}

export function shaderZoomToSlider(value: number): number {
  return Math.log10(clampShaderZoom(value));
}

export function shaderZoomFromSlider(value: number): number {
  const boundedSlider = Math.min(SHADER_ZOOM_SLIDER_MAX, Math.max(SHADER_ZOOM_SLIDER_MIN, value));
  return clampShaderZoom(10 ** boundedSlider);
}

export function formatShaderZoom(value: number): string {
  const zoom = clampShaderZoom(value);
  return `${Number(zoom.toFixed(2))}×`;
}

export function interpolateShaderZoom(
  current: number,
  target: number,
  elapsedMs: number,
  responseMs: number
): number {
  const currentLog = Math.log10(clampShaderZoom(current));
  const targetLog = Math.log10(clampShaderZoom(target));
  const response = 1 - Math.exp(-Math.max(0, elapsedMs) / Math.max(1, responseMs));
  return clampShaderZoom(10 ** (currentLog + (targetLog - currentLog) * response));
}

export function stepShaderZoom(value: number, direction: -1 | 1): number {
  const zoom = clampShaderZoom(value);
  if (direction < 0) {
    return [...SHADER_ZOOM_STOPS].reverse().find((stop) => stop < zoom - 0.0001) ?? SHADER_ZOOM_MIN;
  }
  return SHADER_ZOOM_STOPS.find((stop) => stop > zoom + 0.0001) ?? SHADER_ZOOM_MAX;
}
