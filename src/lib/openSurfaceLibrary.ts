import type { BackgroundSettings, SurfaceMaterial } from './backgroundSvg';

export type OpenSurfaceMap = 'color' | 'displacement' | 'metalness' | 'normal' | 'roughness';
export type OpenSurfaceProvider = 'ambientCG' | 'Poly Haven';

export type OpenSurfaceAsset = {
  category: string;
  description: string;
  fallbackMaterial: SurfaceMaterial;
  id: string;
  license: 'CC0 1.0';
  mapNames: Partial<Record<OpenSurfaceMap, string>>;
  name: string;
  normalFormat: 'directx' | 'opengl';
  provider: OpenSurfaceProvider;
  settings: Partial<BackgroundSettings>;
  sourceAssetId: string;
  sourceUrl: string;
  thumbnailUrl: string;
};

const polyHaven = (
  asset: Omit<OpenSurfaceAsset, 'license' | 'normalFormat' | 'provider' | 'sourceUrl' | 'thumbnailUrl'>
): OpenSurfaceAsset => ({
  ...asset,
  license: 'CC0 1.0',
  normalFormat: 'opengl',
  provider: 'Poly Haven',
  sourceUrl: `https://polyhaven.com/a/${asset.sourceAssetId}`,
  thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${asset.sourceAssetId}.png?width=384&height=256`,
});

const ambientCg = (
  asset: Omit<OpenSurfaceAsset, 'license' | 'normalFormat' | 'provider' | 'sourceUrl' | 'thumbnailUrl'>
): OpenSurfaceAsset => ({
  ...asset,
  license: 'CC0 1.0',
  normalFormat: 'directx',
  provider: 'ambientCG',
  sourceUrl: `https://ambientcg.com/a/${asset.sourceAssetId}`,
  thumbnailUrl: `https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/512-WEBP/${asset.sourceAssetId}.webp`,
});

const POLY_STANDARD_MAPS = {
  color: 'diff',
  displacement: 'disp',
  normal: 'nor_gl',
  roughness: 'rough',
} as const;

const AMBIENT_STANDARD_MAPS = {
  color: 'Color',
  displacement: 'Displacement',
  normal: 'NormalDX',
  roughness: 'Roughness',
} as const;

export const OPEN_SURFACE_LIBRARY: readonly OpenSurfaceAsset[] = [
  polyHaven({
    category: 'Textile',
    description: 'Photoreal velvet pile with anisotropic sheen and full PBR response.',
    fallbackMaterial: 'felted-wool',
    id: 'polyhaven-velour-velvet',
    mapNames: { ...POLY_STANDARD_MAPS, metalness: 'metal' },
    name: 'Velour velvet',
    settings: { surfaceDepth: 24, surfaceMaterial: 'felted-wool', surfaceMetallic: 0, surfaceRoughness: 82, surfaceScale: 30, surfaceTextureAmount: 92 },
    sourceAssetId: 'velour_velvet',
  }),
  ambientCg({
    category: 'Textile',
    description: 'Scanned rough fabric with real color, displacement, normal, roughness, and occlusion maps.',
    fallbackMaterial: 'linen-weave',
    id: 'ambientcg-fabric-061',
    mapNames: AMBIENT_STANDARD_MAPS,
    name: 'Rough woven fabric',
    settings: { surfaceDepth: 40, surfaceMaterial: 'linen-weave', surfaceMetallic: 0, surfaceRoughness: 90, surfaceScale: 34, surfaceTextureAmount: 100 },
    sourceAssetId: 'Fabric061',
  }),
  ambientCg({
    category: 'Leather',
    description: 'Dark natural leather scan with genuine grain height and roughness maps.',
    fallbackMaterial: 'pebbled-leather',
    id: 'ambientcg-leather-037',
    mapNames: AMBIENT_STANDARD_MAPS,
    name: 'Dark leather',
    settings: { surfaceDepth: 48, surfaceMaterial: 'pebbled-leather', surfaceMetallic: 0, surfaceRoughness: 58, surfaceScale: 38, surfaceTextureAmount: 100 },
    sourceAssetId: 'Leather037',
  }),
  polyHaven({
    category: 'Wood',
    description: 'Clean oak veneer scan with fine longitudinal grain and measured surface maps.',
    fallbackMaterial: 'kerf-wood',
    id: 'polyhaven-oak-veneer',
    mapNames: POLY_STANDARD_MAPS,
    name: 'Oak veneer',
    settings: { surfaceAngle: 0, surfaceDepth: 34, surfaceMaterial: 'kerf-wood', surfaceMetallic: 0, surfaceRoughness: 54, surfaceScale: 70, surfaceTextureAmount: 96 },
    sourceAssetId: 'oak_veneer_01',
  }),
  polyHaven({
    category: 'Wood',
    description: 'Layered plywood with real end-grain variation and a restrained matte response.',
    fallbackMaterial: 'kerf-wood',
    id: 'polyhaven-plywood',
    mapNames: POLY_STANDARD_MAPS,
    name: 'Layered plywood',
    settings: { surfaceDepth: 38, surfaceMaterial: 'kerf-wood', surfaceMetallic: 0, surfaceRoughness: 68, surfaceScale: 74, surfaceTextureAmount: 96 },
    sourceAssetId: 'plywood',
  }),
  polyHaven({
    category: 'Stone',
    description: 'Veined polished marble with real normal, displacement, and roughness maps.',
    fallbackMaterial: 'carved-stone',
    id: 'polyhaven-marble',
    mapNames: POLY_STANDARD_MAPS,
    name: 'Veined marble',
    settings: { surfaceDepth: 18, surfaceMaterial: 'carved-stone', surfaceMetallic: 2, surfaceRoughness: 22, surfaceScale: 88, surfaceTextureAmount: 94 },
    sourceAssetId: 'marble_01',
  }),
  polyHaven({
    category: 'Metal',
    description: 'Weathered industrial plate with true metalness, roughness, normal, and displacement maps.',
    fallbackMaterial: 'brushed-metal',
    id: 'polyhaven-metal-plate',
    mapNames: { ...POLY_STANDARD_MAPS, metalness: 'metal' },
    name: 'Weathered metal plate',
    settings: { surfaceDepth: 36, surfaceMaterial: 'brushed-metal', surfaceMetallic: 92, surfaceRoughness: 44, surfaceScale: 64, surfaceTextureAmount: 100 },
    sourceAssetId: 'metal_plate',
  }),
  ambientCg({
    category: 'Metal',
    description: 'Oxidized dark steel scan with independent metalness and roughness maps.',
    fallbackMaterial: 'hammered-foil',
    id: 'ambientcg-metal-063',
    mapNames: { ...AMBIENT_STANDARD_MAPS, metalness: 'Metalness' },
    name: 'Oxidized steel',
    settings: { surfaceDepth: 44, surfaceMaterial: 'hammered-foil', surfaceMetallic: 88, surfaceRoughness: 48, surfaceScale: 54, surfaceTextureAmount: 100 },
    sourceAssetId: 'Metal063',
  }),
  polyHaven({
    category: 'Mineral',
    description: 'Warm architectural wall plaster captured with real pore and trowel variation.',
    fallbackMaterial: 'sandblasted-plaster',
    id: 'polyhaven-beige-wall',
    mapNames: POLY_STANDARD_MAPS,
    name: 'Warm wall plaster',
    settings: { surfaceDepth: 32, surfaceMaterial: 'sandblasted-plaster', surfaceMetallic: 0, surfaceRoughness: 90, surfaceScale: 58, surfaceTextureAmount: 100 },
    sourceAssetId: 'beige_wall_001',
  }),
  polyHaven({
    category: 'Polymer',
    description: 'Molded rubber tile surface with real seams, shallow relief, and dry roughness.',
    fallbackMaterial: 'corrugated-polymer',
    id: 'polyhaven-rubber-tiles',
    mapNames: POLY_STANDARD_MAPS,
    name: 'Molded rubber tiles',
    settings: { surfaceDepth: 46, surfaceMaterial: 'corrugated-polymer', surfaceMetallic: 0, surfaceRoughness: 82, surfaceScale: 56, surfaceTextureAmount: 100 },
    sourceAssetId: 'rubber_tiles',
  }),
  ambientCg({
    category: 'Paper',
    description: 'Scanned paper fibers with measured color, height, normal, and roughness maps.',
    fallbackMaterial: 'embossed-paper',
    id: 'ambientcg-paper-006',
    mapNames: AMBIENT_STANDARD_MAPS,
    name: 'Natural paper fibers',
    settings: { surfaceDepth: 24, surfaceMaterial: 'embossed-paper', surfaceMetallic: 0, surfaceRoughness: 96, surfaceScale: 42, surfaceTextureAmount: 100 },
    sourceAssetId: 'Paper006',
  }),
] as const;

export const OPEN_SURFACE_LIBRARY_IDS = OPEN_SURFACE_LIBRARY.map(({ id }) => id);

export function getOpenSurfaceAsset(id?: string): OpenSurfaceAsset | undefined {
  return OPEN_SURFACE_LIBRARY.find((asset) => asset.id === id);
}

export function openSurfaceMapPath(assetId: string, map: OpenSurfaceMap): string {
  return `/api/surface-textures/${encodeURIComponent(assetId)}/${map}`;
}

export function openSurfaceRemoteMapUrl(asset: OpenSurfaceAsset, map: OpenSurfaceMap): string | undefined {
  const mapName = asset.mapNames[map];
  if (!mapName) return undefined;
  if (asset.provider === 'Poly Haven') {
    return `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${asset.sourceAssetId}/${asset.sourceAssetId}_${mapName}_1k.jpg`;
  }
  return `https://f003.backblazeb2.com/file/ambientCG-Web/media/surface-preview/${asset.sourceAssetId}/${asset.sourceAssetId}_SQ_${mapName}.jpg`;
}

export const OPEN_SURFACE_PRESETS = OPEN_SURFACE_LIBRARY.map((asset) => ({
  category: asset.category,
  description: asset.description,
  id: asset.id,
  name: asset.name,
  previewUrl: asset.thumbnailUrl,
  settings: {
    ...asset.settings,
    surfaceLibraryAssetId: asset.id,
  },
  source: {
    license: asset.license,
    name: asset.provider,
    url: asset.sourceUrl,
  },
}));
