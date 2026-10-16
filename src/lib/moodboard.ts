import { isBrandCoverAsset } from './brandCover';
import type { BrandAsset, BrandIdentity } from './brandIdentity';

export type MoodboardExportPresetId =
  | 'standard'
  | 'retina'
  | 'high'
  | 'ultra'
  | 'custom';

export const MOODBOARD_COMPOSITIONS = ['showcase', 'campaign', 'system', 'specimen', 'catalog'] as const;
export type MoodboardComposition = (typeof MOODBOARD_COMPOSITIONS)[number];

export function isMoodboardComposition(value: unknown): value is MoodboardComposition {
  return MOODBOARD_COMPOSITIONS.includes(value as MoodboardComposition);
}

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
  // The identity's signature art (its cover or identity field) belongs on the board with the library.
  const cover = isBrandCoverAsset(asset);
  if (!cover && !asset.id.startsWith('library-')) return false;
  if (!MOODBOARD_ASSET_TYPES.includes(asset.type)) return false;
  if (SCREEN_CAPTURE_PATH.test(asset.path)) return false;
  if (asset.tags?.some((tag) => /screen[-_ ]?shot|site-capture|browser-capture/i.test(tag))) {
    return false;
  }

  return Boolean(
    cover ||
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
  campaign: 9 / 16,
  catalog: 3 / 2,
  showcase: 9 / 16,
  specimen: 5 / 4,
  system: 5 / 4,
};

export const MOODBOARD_ASPECT_LABELS: Record<MoodboardComposition, string> = {
  campaign: '16:9',
  catalog: '2:3',
  showcase: '16:9',
  specimen: '4:5',
  system: '4:5',
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
