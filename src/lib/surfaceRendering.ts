import type { BackgroundSettings } from './backgroundSvg';
import type { OpenSurfaceAsset, OpenSurfaceMap } from './openSurfaceLibrary';

const SURFACE_TEXTURE_INVALIDATION_KEYS = [
  'colorA',
  'colorB',
  'colorC',
  'surfaceAngle',
  'surfaceIrregularity',
  'surfaceMaterial',
  'surfaceOpenArea',
  'surfaceScale',
  'surfaceTextureAmount',
] as const satisfies readonly (keyof BackgroundSettings)[];

export type SurfaceTextureSettings = Pick<
  BackgroundSettings,
  (typeof SURFACE_TEXTURE_INVALIDATION_KEYS)[number]
>;

type SurfaceChannelMode = 'generated' | 'map' | 'uniform' | 'unused';

export type SurfaceChannel = {
  id: 'color' | 'height' | 'metalness' | 'normal' | 'roughness';
  label: string;
  mode: SurfaceChannelMode;
};

/**
 * A stable cache key for the CPU texture-generation pass. Lighting response
 * controls intentionally do not invalidate the generated color and height maps.
 */
export function surfaceTextureCacheKey(settings: BackgroundSettings): string {
  return SURFACE_TEXTURE_INVALIDATION_KEYS
    .map((key) => `${key}:${settings[key]}`)
    .join('|');
}

export function surfaceChannelInventory(asset?: OpenSurfaceAsset): readonly SurfaceChannel[] {
  const hasMap = (map: OpenSurfaceMap) => Boolean(asset?.mapNames[map]);

  return [
    { id: 'color', label: 'Color', mode: hasMap('color') ? 'map' : 'generated' },
    { id: 'normal', label: 'Normal', mode: hasMap('normal') ? 'map' : 'unused' },
    { id: 'height', label: 'Height', mode: hasMap('displacement') ? 'map' : 'generated' },
    { id: 'roughness', label: 'Rough', mode: hasMap('roughness') ? 'map' : 'uniform' },
    { id: 'metalness', label: 'Metal', mode: hasMap('metalness') ? 'map' : 'uniform' },
  ];
}
