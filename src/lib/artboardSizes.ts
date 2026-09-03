export type StudioArtboardDimensions = {
  height: number;
  width: number;
};

export const STUDIO_ARTBOARD_PRESETS = [
  { height: 900, id: 'wide', label: 'Wide', width: 1600 },
  { height: 1080, id: 'square', label: 'Square', width: 1080 },
  { height: 630, id: 'opengraph', label: 'OG Social', width: 1200 },
  { height: 300, id: 'banner', label: 'Banner', width: 1000 },
  { height: 1350, id: 'portrait', label: 'Portrait', width: 1080 },
  { height: 1920, id: 'story', label: 'Story', width: 1080 },
] as const;

export type StudioArtboardPreset = (typeof STUDIO_ARTBOARD_PRESETS)[number];
export type StudioArtboardPresetId = StudioArtboardPreset['id'];

const MIN_ARTBOARD_DIMENSION = 120;
const MAX_ARTBOARD_DIMENSION = 4096;

export function normalizeStudioArtboardDimensions(
  dimensions: Partial<StudioArtboardDimensions> | undefined,
  fallback: StudioArtboardDimensions = STUDIO_ARTBOARD_PRESETS[0]
): StudioArtboardDimensions {
  const normalize = (value: number | undefined, fallbackValue: number) => (
    Number.isFinite(value)
      ? Math.min(MAX_ARTBOARD_DIMENSION, Math.max(MIN_ARTBOARD_DIMENSION, Math.round(value!)))
      : fallbackValue
  );
  return {
    height: normalize(dimensions?.height, fallback.height),
    width: normalize(dimensions?.width, fallback.width),
  };
}

export function studioArtboardPresetForSize(width: number, height: number) {
  return STUDIO_ARTBOARD_PRESETS.find((preset) => (
    preset.width === width && preset.height === height
  ));
}
