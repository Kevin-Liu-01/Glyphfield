import type { BrandAsset, BrandIdentity } from './brandIdentity';

export type MoodboardExportPresetId =
  | 'standard'
  | 'retina'
  | 'high'
  | 'ultra'
  | 'custom';

export type MoodboardComposition = 'showcase' | 'system' | 'catalog';

export type MoodboardExportPreset = {
  height: number;
  id: MoodboardExportPresetId;
  label: string;
  width: number;
};

export type MoodboardExportDimensions = MoodboardExportPreset & {
  megapixels: number;
};

const MOODBOARD_ASSET_TYPES: readonly BrandAsset['type'][] = [
  'background',
  'image',
  'motion',
  'product',
  'texture',
];

const SCREEN_CAPTURE_PATH = /(?:^|\/)(?:references|screenshots)(?:\/|$)|(?:screen[-_ ]?shot|capture|homepage)/i;

export function isMoodboardAsset(asset: BrandAsset): boolean {
  if (!asset.id.startsWith('library-')) return false;
  if (!MOODBOARD_ASSET_TYPES.includes(asset.type)) return false;
  if (SCREEN_CAPTURE_PATH.test(asset.path)) return false;
  if (asset.tags?.some((tag) => /screen[-_ ]?shot|site-capture|browser-capture/i.test(tag))) {
    return false;
  }

  return Boolean(
    asset.tags?.includes('source-native') ||
    asset.tags?.includes('brand-diagram') ||
    asset.tags?.includes('original-system')
  );
}

export function moodboardAssets(identity: BrandIdentity): BrandAsset[] {
  return identity.assets.filter(isMoodboardAsset);
}

const MINIMUM_CUSTOM_WIDTH = 800;
const MAXIMUM_CUSTOM_WIDTH = 4800;
const BOARD_HEIGHT_RATIOS: Record<MoodboardComposition, number> = {
  catalog: 3 / 2,
  showcase: 9 / 16,
  system: 5 / 4,
};

export const MOODBOARD_EXPORT_PRESETS: readonly MoodboardExportPreset[] = [
  { height: 2000, id: 'standard', label: 'Standard', width: 1600 },
  { height: 3000, id: 'retina', label: 'Retina', width: 2400 },
  { height: 4000, id: 'high', label: 'High resolution', width: 3200 },
  { height: 6000, id: 'ultra', label: 'Ultra', width: 4800 },
  { height: 3000, id: 'custom', label: 'Custom', width: 2400 },
];

export function resolveMoodboardExport(
  presetId: MoodboardExportPresetId,
  customWidth: number,
  composition: MoodboardComposition
): MoodboardExportDimensions {
  const preset =
    MOODBOARD_EXPORT_PRESETS.find(({ id }) => id === presetId) ??
    MOODBOARD_EXPORT_PRESETS[0];
  const width =
    preset.id === 'custom'
      ? Math.min(
          MAXIMUM_CUSTOM_WIDTH,
          Math.max(MINIMUM_CUSTOM_WIDTH, Math.round(customWidth))
        )
      : preset.width;
  const height = Math.round(width * BOARD_HEIGHT_RATIOS[composition]);

  return {
    ...preset,
    height,
    megapixels: Number(((width * height) / 1_000_000).toFixed(1)),
    width,
  };
}

export function moodboardFilename(name: string, width: number, height: number): string {
  const project = name
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'brand';

  return `${project}-moodboard-${width}x${height}.png`;
}
