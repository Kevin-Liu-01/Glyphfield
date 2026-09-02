import type { CSSProperties } from 'react';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  DISCOVERABLE_LIVE_MATERIAL_OPTIONS,
  PAPER_LIVE_MATERIAL_DEFINITIONS,
  type LiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
  type PaperLiveMaterialDefinition,
} from './liveMaterials';

export type ShaderLabCategory = 'all' | 'fluid' | 'light' | 'metal' | 'gradient' | 'graphic';

export const SHADER_LAB_CATEGORIES: readonly { id: ShaderLabCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fluid', label: 'Fluid' },
  { id: 'light', label: 'Light' },
  { id: 'metal', label: 'Metal' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'graphic', label: 'Graphic' },
];

export const SHADER_LAB_FEATURED_IDS: readonly LiveMaterialId[] = [
  'paper-gem-smoke',
  'shaders-fluid-chrome',
  'study-line-field',
  'paper-liquid-metal',
  'study-chrome-glares',
  'paper-god-rays',
  'paper-warp',
  'shadergradient-prismatic-sphere',
  'glyphfield-glyph-field',
  'glyphfield-dither-gradient',
  'glyphfield-mesh-gradient',
  'shaders-spectral-bloom',
  'study-radiant-void',
  'study-galactic-rings',
  'pavel-fluid-energy',
  'holo-cloth-silk',
];

export const SHADER_LIBRARY_DEFAULT_IDS = {
  animation: 'paper-dithering-swirl',
  heroAnimation: 'paper-dithering-swirl',
  heroField: 'paper-grain-gradient',
  heroMark: 'paper-dithering-swirl',
  surface: 'paper-gem-smoke',
} as const satisfies Record<string, LiveMaterialId>;

type ShaderLibraryScene = {
  materialId: LiveMaterialId;
  settings: LiveMaterialSettings;
};

export const SHADER_LIBRARY_SCENES = {
  heroAnimation: {
    materialId: SHADER_LIBRARY_DEFAULT_IDS.heroAnimation,
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 1.3,
      brightness: 0.98,
      colorA: '#26145F',
      colorB: '#C8C0FF',
      colorC: '#7BFFD9',
      frequency: 2.2,
      grain: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: -6,
      speed: 0.32,
    },
  },
  heroField: {
    materialId: SHADER_LIBRARY_DEFAULT_IDS.heroField,
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 1.8,
      brightness: 0.96,
      colorA: '#201046',
      colorB: '#7058FF',
      colorC: '#C8C0FF',
      density: 0.9,
      detail: 3.4,
      frequency: 2.2,
      grain: 12,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      speed: 0.12,
      strength: 0.4,
    },
  },
  heroMark: {
    materialId: SHADER_LIBRARY_DEFAULT_IDS.heroMark,
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 3.4,
      brightness: 1.04,
      colorA: '#5632D6',
      colorB: '#9A84FF',
      colorC: '#6FFFD5',
      density: 1.1,
      detail: 4.4,
      frequency: 6.8,
      grain: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: -8,
      speed: 0.46,
      strength: 0.48,
    },
  },
} as const satisfies Record<'heroAnimation' | 'heroField' | 'heroMark', ShaderLibraryScene>;

const FEATURED_ID_SET = new Set<LiveMaterialId>(SHADER_LAB_FEATURED_IDS);
const FEATURED_INDEX = new Map(SHADER_LAB_FEATURED_IDS.map((id, index) => [id, index]));
const PAPER_DEFINITION_BY_ID = new Map<LiveMaterialId, PaperLiveMaterialDefinition>(
  PAPER_LIVE_MATERIAL_DEFINITIONS.map((definition) => [definition.id, definition])
);

export const SHADER_LAB_FEATURED_MATERIALS: readonly LiveMaterialOption[] = SHADER_LAB_FEATURED_IDS
  .map((id) => DISCOVERABLE_LIVE_MATERIAL_OPTIONS.find((material) => material.id === id))
  .filter((material): material is LiveMaterialOption => Boolean(material));

export function shaderLabCategory(material: Pick<LiveMaterialOption, 'engine' | 'id' | 'name'>): Exclude<ShaderLabCategory, 'all'> {
  const key = `${material.id} ${material.name} ${material.engine}`.toLowerCase();
  if (material.id === 'holo-cloth-silk') return 'light';
  if (/(chrome|metal|glass|prismatic|gem)/.test(key)) return 'metal';
  if (/(fluid|water|warp|swirl|smoke|metaball)/.test(key)) return 'fluid';
  if (/(bloom|ray|line|radiant|ring|border|circuit)/.test(key)) return 'light';
  if (/(gradient|mesh|noise|orbit|panel)/.test(key)) return 'gradient';
  return 'graphic';
}

export function shaderLabMaterials(query: string, category: ShaderLabCategory): readonly LiveMaterialOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = DISCOVERABLE_LIVE_MATERIAL_OPTIONS.filter((material) => {
    if (category !== 'all' && shaderLabCategory(material) !== category) return false;
    if (!normalizedQuery) return true;
    return `${material.name} ${material.description} ${material.engine}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const featured: LiveMaterialOption[] = [];
  const primary: LiveMaterialOption[] = [];
  const variantFamilies = new Map<string, LiveMaterialOption[]>();

  filtered.forEach((material) => {
    if (FEATURED_ID_SET.has(material.id)) {
      featured.push(material);
      return;
    }
    const paperDefinition = PAPER_DEFINITION_BY_ID.get(material.id);
    if (!paperDefinition || paperDefinition.presetIndex === 0) {
      primary.push(material);
      return;
    }
    const family = variantFamilies.get(paperDefinition.family) ?? [];
    family.push(material);
    variantFamilies.set(paperDefinition.family, family);
  });

  featured.sort((left, right) => (FEATURED_INDEX.get(left.id) ?? 0) - (FEATURED_INDEX.get(right.id) ?? 0));
  primary.sort((left, right) => right.qualityScore - left.qualityScore || left.name.localeCompare(right.name));
  const variantGroups = [...variantFamilies.values()]
    .map((family) => family.sort((left, right) => right.qualityScore - left.qualityScore || left.name.localeCompare(right.name)))
    .sort((left, right) => (right[0]?.qualityScore ?? 0) - (left[0]?.qualityScore ?? 0));
  const variants: LiveMaterialOption[] = [];
  const longestFamily = Math.max(0, ...variantGroups.map((family) => family.length));
  for (let index = 0; index < longestFamily; index += 1) {
    variantGroups.forEach((family) => {
      const material = family[index];
      if (material) variants.push(material);
    });
  }

  return [...featured, ...primary, ...variants];
}

export function shaderLabCategoryCount(category: ShaderLabCategory): number {
  if (category === 'all') return DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length;
  return DISCOVERABLE_LIVE_MATERIAL_OPTIONS.filter((material) => shaderLabCategory(material) === category).length;
}

export function shaderPreviewAssetPath(materialId: LiveMaterialId): string {
  return `/shader-previews/${materialId}.webp`;
}

const MATERIAL_TUNING: Partial<Record<LiveMaterialId, Partial<LiveMaterialSettings>>> = {
  'holo-cloth-silk': {
    amplitude: 5.2,
    brightness: 0.94,
    density: 1.05,
    detail: 6.2,
    frequency: 7.2,
    grain: 24,
    rotationZ: 12,
    speed: 0.22,
    strength: 0.76,
  },
  'shaders-spectral-bloom': { brightness: 1.04, detail: 3.2, frequency: 4.2, grain: 12, speed: 0.26, strength: 0.82 },
  'pavel-fluid-energy': { amplitude: 4.2, brightness: 1.08, density: 1.12, detail: 3.8, frequency: 4.6, grain: 8, speed: 0.48, strength: 0.92 },
  'shaders-fluid-chrome': { brightness: 0.82, detail: 4.8, frequency: 4.2, grain: 8, rotationZ: 8, speed: 0.12, strength: 0.46 },
};

export function shaderLabSettingsFor(
  materialId: LiveMaterialId,
  current: LiveMaterialSettings
): LiveMaterialSettings {
  return { ...current, ...MATERIAL_TUNING[materialId] };
}

export function shaderMaterialPreviewStyle(
  materialId: LiveMaterialId,
  settings: Pick<LiveMaterialSettings, 'brightness' | 'colorA' | 'colorB' | 'colorC' | 'rotationZ'>
): CSSProperties {
  const { colorA, colorB, colorC } = settings;
  const angle = Math.round(128 + settings.rotationZ);
  let background: string;
  let backgroundBlendMode: CSSProperties['backgroundBlendMode'] = 'normal';
  let backgroundSize: CSSProperties['backgroundSize'] = 'cover';

  if (materialId === 'holo-cloth-silk') {
    background = [
      'repeating-linear-gradient(92deg, rgba(255,255,255,.22) 0 1px, rgba(0,0,0,.12) 1px 3px, transparent 3px 5px)',
      `repeating-linear-gradient(2deg, transparent 0 4px, ${colorC}44 5px, transparent 7px)`,
      `linear-gradient(${angle}deg, ${colorA}, ${colorB} 36%, #79ffe1 58%, ${colorC})`,
    ].join(',');
    backgroundBlendMode = 'overlay, screen, normal';
    backgroundSize = '7px 100%, 100% 11px, cover';
  } else if (/(chrome|metal|glass)/.test(materialId)) {
    background = `linear-gradient(${angle}deg, ${colorA} 0 17%, #f8fbff 27%, ${colorB} 31%, #11131a 43%, ${colorC} 58%, #ffffff 64%, ${colorA} 77%)`;
  } else if (/(fluid|water|warp|swirl|smoke|metaball)/.test(materialId)) {
    background = `radial-gradient(circle at 28% 72%, ${colorC}, transparent 34%), radial-gradient(circle at 70% 28%, ${colorB}, transparent 38%), linear-gradient(${angle}deg, ${colorA}, ${colorB})`;
    backgroundBlendMode = 'screen, screen, normal';
  } else if (/(dither|pixel|mosaic|grid|halftone)/.test(materialId)) {
    background = `radial-gradient(circle, ${colorC} 0 1px, transparent 1.5px), linear-gradient(${angle}deg, ${colorA}, ${colorB})`;
    backgroundSize = '7px 7px, cover';
  } else if (/(line|circuit|ring|border|ray)/.test(materialId)) {
    background = `repeating-radial-gradient(ellipse at 50% 90%, ${colorC} 0 1px, transparent 2px 11px), radial-gradient(circle at 50% 80%, ${colorB}, ${colorA} 68%)`;
    backgroundBlendMode = 'screen, normal';
  } else {
    background = `radial-gradient(circle at 24% 26%, ${colorC}, transparent 30%), radial-gradient(circle at 72% 70%, ${colorB}, transparent 38%), linear-gradient(${angle}deg, ${colorA}, ${colorB})`;
    backgroundBlendMode = 'screen, soft-light, normal';
  }

  return {
    backgroundImage: background,
    backgroundBlendMode,
    backgroundColor: colorA,
    backgroundSize,
    filter: `brightness(${Math.max(0.45, settings.brightness)})`,
  };
}
