import type { BrandAsset, BrandIdentity } from '@/lib/brandIdentity';

export type StickerSceneAsset = Pick<BrandAsset, 'id' | 'label' | 'path' | 'surface' | 'type'>;

export type StickerScenePlacement = {
  assetId: string;
  id: string;
  rotation: number;
  scale: number;
  x: number;
  y: number;
  z: number;
};

const STICKER_ASSET_PRIORITY: Partial<Record<BrandAsset['type'], number>> = {
  icon: 1,
  image: 4,
  logo: 0,
  product: 2,
  proof: 3,
};

const SEED_POSITIONS = [
  { rotation: -12, scale: 16, x: 19, y: 25 },
  { rotation: 10, scale: 15, x: 80, y: 24 },
  { rotation: 7, scale: 14, x: 23, y: 67 },
  { rotation: -8, scale: 13, x: 77, y: 66 },
] as const;

function canRenderAsSticker(asset: BrandAsset): boolean {
  if (!(asset.type in STICKER_ASSET_PRIORITY)) return false;
  if (!asset.path || asset.path.toLocaleLowerCase().endsWith('.pdf')) return false;
  return asset.path.startsWith('data:image/')
    || asset.path.startsWith('blob:')
    || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(asset.path);
}

export function stickerSceneAssets(identity: BrandIdentity, primaryLogoPath?: string): StickerSceneAsset[] {
  const seenPaths = new Set<string>();
  const assets = [...identity.assets, ...identity.proofAssets]
    .filter(canRenderAsSticker)
    .sort((left, right) => {
      const priority = (STICKER_ASSET_PRIORITY[left.type] ?? 9) - (STICKER_ASSET_PRIORITY[right.type] ?? 9);
      return priority || left.label.localeCompare(right.label);
    })
    .filter((asset) => {
      if (seenPaths.has(asset.path)) return false;
      seenPaths.add(asset.path);
      return true;
    });

  const secondaryAssets = assets.filter(({ path }) => path !== primaryLogoPath);
  return (secondaryAssets.length > 0 ? secondaryAssets : assets).slice(0, 16);
}

export function seedStickerScene(assets: readonly StickerSceneAsset[]): StickerScenePlacement[] {
  return assets.slice(0, SEED_POSITIONS.length).map((asset, index) => ({
    ...SEED_POSITIONS[index],
    assetId: asset.id,
    id: `seed-${index}-${asset.id}`,
    z: index + 1,
  }));
}

export function nextStickerPlacement(assetId: string, serial: number, z: number): StickerScenePlacement {
  return {
    assetId,
    id: `placed-${serial}-${assetId}`,
    rotation: ((serial * 17) % 41) - 20,
    scale: 13 + (serial % 4),
    x: 18 + ((serial * 29) % 64),
    y: 18 + ((serial * 31) % 51),
    z,
  };
}

export function clampStickerPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(7, Math.min(93, x)),
    y: Math.max(8, Math.min(78, y)),
  };
}

export function stickerSceneOutlineRadius(edgeWidth: number): number {
  return Math.max(1, Math.min(8, edgeWidth * 0.25));
}
