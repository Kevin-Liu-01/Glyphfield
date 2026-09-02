import type { BrandAsset, BrandIdentity } from '@/lib/brandIdentity';

export type StickerSceneAsset = Pick<BrandAsset, 'id' | 'label' | 'path' | 'surface' | 'type'> & {
  aspectRatio?: number;
  kind?: 'image' | 'text';
};

export type StickerTextAssetInput = {
  align: 'center' | 'left' | 'right';
  color: string;
  fontFamily: string;
  id: string;
  label: string;
  lineHeight: number;
  text: string;
  tracking: number;
  weight: number;
};

export type StickerScenePlacement = {
  assetId: string;
  id: string;
  rotation: number;
  scale: number;
  x: number;
  y: number;
  z: number;
};

export function starterStickerPlacement(asset: StickerSceneAsset | undefined): StickerScenePlacement[] {
  return asset
    ? [{ assetId: asset.id, id: `starter-${asset.id}`, rotation: -4, scale: 31, x: 50, y: 50, z: 1 }]
    : [];
}

export function reconcileStickerScenePlacements(
  placements: readonly StickerScenePlacement[],
  assets: readonly StickerSceneAsset[]
): StickerScenePlacement[] {
  const assetIds = new Set(assets.map(({ id }) => id));
  const placementIds = new Set<string>();
  const retained = placements.filter(({ assetId, id }) => {
    if (!assetIds.has(assetId) || placementIds.has(id)) return false;
    placementIds.add(id);
    return true;
  });
  return retained.length > 0 ? retained : starterStickerPlacement(assets[0]);
}

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

function escapeStickerSvg(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function estimatedTextWidth(value: string, fontSize: number, tracking: number): number {
  const glyphWidth = [...value].reduce((width, character) => {
    if (/\s/.test(character)) return width + fontSize * 0.34;
    if (/[MW@#%&]/.test(character)) return width + fontSize * 0.84;
    if (/[A-Z0-9]/.test(character)) return width + fontSize * 0.66;
    return width + fontSize * 0.56;
  }, 0);
  return glyphWidth + Math.max(0, value.length - 1) * fontSize * tracking;
}

export function stickerTextSceneAsset(input: StickerTextAssetInput): StickerSceneAsset {
  const fontSize = 180;
  const paddingX = 82;
  const paddingY = 68;
  const text = input.text.replace(/\r\n?/g, '\n').trim() || 'Text';
  const lines = text.split('\n').slice(0, 6);
  const tracking = Math.max(-0.12, Math.min(0.24, input.tracking));
  const lineHeight = Math.max(0.75, Math.min(1.6, input.lineHeight));
  const contentWidth = Math.max(...lines.map((line) => estimatedTextWidth(line || ' ', fontSize, tracking)));
  const width = Math.round(Math.max(420, Math.min(2200, contentWidth + paddingX * 2)));
  const lineHeightPixels = fontSize * lineHeight;
  const contentHeight = fontSize + Math.max(0, lines.length - 1) * lineHeightPixels;
  const height = Math.round(Math.max(320, contentHeight + paddingY * 2));
  const anchor = input.align === 'left' ? 'start' : input.align === 'right' ? 'end' : 'middle';
  const x = input.align === 'left' ? paddingX : input.align === 'right' ? width - paddingX : width / 2;
  const firstY = height / 2 - (lines.length - 1) * lineHeightPixels / 2;
  const family = escapeStickerSvg(input.fontFamily || 'Arial');
  const fill = escapeStickerSvg(input.color || '#FFFFFF');
  const textNodes = lines.map((line, index) => (
    `<text x="${x}" y="${firstY + index * lineHeightPixels}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" font-family="${family},Arial,sans-serif" font-size="${fontSize}" font-weight="${Math.max(100, Math.min(900, input.weight))}" letter-spacing="${tracking}em">${escapeStickerSvg(line || ' ')}</text>`
  )).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${textNodes}</svg>`;

  return {
    aspectRatio: width / height,
    id: input.id,
    kind: 'text',
    label: input.label,
    path: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    surface: 'dark',
    type: 'logo',
  };
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
    y: Math.max(8, Math.min(92, y)),
  };
}

export function stickerSceneOutlineRadius(edgeWidth: number): number {
  return Math.max(1, Math.min(8, edgeWidth * 0.25));
}

export function stickerSceneContrastColor(borderColor: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(borderColor);
  if (!match) return '#14171A';
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
  return luminance > 0.52 ? '#14171A' : '#F7F7F2';
}

export function stickerSceneContrastRadius(seamWidth: number, edgeWidth: number): number {
  const outerRadius = stickerSceneOutlineRadius(edgeWidth);
  return Math.max(0.55, Math.min(Math.max(0.55, outerRadius - 0.45), seamWidth * 0.42));
}
