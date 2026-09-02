import {
  STICKER_FINISH_PRESETS,
  type StickerFinishId,
  type StickerFinishSettings,
} from './surfaceSticker';
import type { BackgroundSettings } from './backgroundSvg';
import { OPEN_SURFACE_PRESETS } from './openSurfaceLibrary';
import type { LiveMaterialId } from './liveMaterials';
import {
  shaderLabCategory,
  shaderLabMaterials,
  shaderPreviewAssetPath,
} from './shaderLab';

export type SurfaceLabMode = 'sheet' | 'shader' | 'cloth' | 'sticker';

type SurfaceLabSource = {
  license: string;
  name: string;
  url: string;
};

type SurfaceLabMaterialRecord = {
  applications: readonly string[];
  family: string;
  process: string;
  properties: readonly string[];
  source: SurfaceLabSource;
};

export type SurfaceLabPreset = {
  category: string;
  description: string;
  id: string;
  liveMaterialId?: LiveMaterialId;
  materialRecord?: SurfaceLabMaterialRecord;
  mode: SurfaceLabMode;
  name: string;
  previewUrl?: string;
  settings?: Partial<BackgroundSettings>;
  source?: SurfaceLabSource;
  stickerFinish?: StickerFinishSettings;
  stickerFinishId?: StickerFinishId;
  swatch?: string;
};

function labelShaderCategory(category: ReturnType<typeof shaderLabCategory>): string {
  return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
}

export const SURFACE_LAB_SHADER_PRESETS: readonly SurfaceLabPreset[] = shaderLabMaterials('', 'all').map(
  (material): SurfaceLabPreset => ({
    category: labelShaderCategory(shaderLabCategory(material)),
    description: material.description,
    id: `shader-${material.id}`,
    liveMaterialId: material.id,
    mode: 'shader',
    name: material.name,
    previewUrl: shaderPreviewAssetPath(material.id),
    source: {
      license: material.sourceLabel ?? 'Source attributed',
      name: material.engine,
      url: material.sourceUrl ?? '/docs',
    },
  })
);

const GLYPHFIELD_SOURCE: SurfaceLabSource = {
  license: 'Original',
  name: 'Glyphfield',
  url: '/docs',
};

const materialArchivSource = (url: string): SurfaceLabSource => ({
  license: 'Reference only',
  name: 'Material Archiv',
  url,
});

const MATERIAL_ARCHIV_RECORDS: Readonly<Record<string, SurfaceLabMaterialRecord>> = {
  aluminium: {
    applications: ['Transport', 'Furniture', 'Packaging'],
    family: 'Non-ferrous metal',
    process: 'Rolling · brushing · polishing',
    properties: ['Lightweight', 'Reflective', 'Corrosion-resistant'],
    source: materialArchivSource('https://materialarchiv.ch/ma%3Amaterial_1451'),
  },
  graphite: {
    applications: ['Electrodes', 'Pigments', 'Seals'],
    family: 'Mineral · carbon',
    process: 'Grinding · pressing · graphitizing',
    properties: ['Conductive', 'Soft', 'Heat-resistant'],
    source: materialArchivSource('https://materialarchiv.ch/ma%3Amaterial_2098'),
  },
  leather: {
    applications: ['Upholstery', 'Bags', 'Footwear'],
    family: 'Animal material',
    process: 'Tanning · dyeing · embossing',
    properties: ['Elastic', 'Tear-resistant', 'Flexible'],
    source: materialArchivSource('https://materialarchiv.ch/de/ma%3Agroup_600?type=all'),
  },
  textile: {
    applications: ['Interiors', 'Apparel', 'Technical textiles'],
    family: 'Textile',
    process: 'Fiber · yarn · woven surface',
    properties: ['Flexible', 'Fiber-defined', 'Application-tuned'],
    source: materialArchivSource('https://materialarchiv.ch/de/ma%3Agroup_14?type=all'),
  },
};

export const SURFACE_LAB_SHEET_PRESETS: readonly SurfaceLabPreset[] = [
  {
    category: 'Film',
    description: 'A physically based thin-film layer whose spectrum moves with view angle and optical thickness.',
    id: 'thin-film-opal',
    mode: 'sheet',
    name: 'Thin-film opal',
    settings: {
      colorA: '#111424', colorB: '#D7E7FF', colorC: '#FFB5E6', gradient: 'bloom',
      surfaceAngle: 42, surfaceDepth: 10, surfaceIrregularity: 26, surfaceMaterial: 'iridescent-film',
      surfaceMetallic: 18, surfaceOpenArea: 46, surfaceRoughness: 12, surfaceScale: 72,
      surfaceTextureAmount: 92,
    },
    source: {
      license: 'Open standard',
      name: 'Khronos iridescence',
      url: 'https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence',
    },
    swatch: 'linear-gradient(135deg,#111424 0%,#8cdcff 28%,#ffe0a8 48%,#e9a9ff 70%,#d8fff4 100%)',
  },
  {
    category: 'Metal',
    description: 'Directional aluminum grain with controlled anisotropic reflection.',
    id: 'brushed-aluminum-v3',
    mode: 'sheet',
    name: 'Brushed aluminum',
    materialRecord: MATERIAL_ARCHIV_RECORDS.aluminium,
    settings: {
      colorA: '#252B31', colorB: '#89939D', colorC: '#F3F6F8', gradient: 'linear',
      surfaceAngle: 90, surfaceDepth: 24, surfaceIrregularity: 14, surfaceMaterial: 'brushed-metal',
      surfaceMetallic: 96, surfaceOpenArea: 0, surfaceRoughness: 28, surfaceScale: 28,
      surfaceTextureAmount: 92,
    },
    source: GLYPHFIELD_SOURCE,
    swatch: 'repeating-linear-gradient(90deg,#5f6871 0 1px,#dce1e5 1px 3px,#838c95 3px 4px)',
  },
  {
    category: 'Mineral',
    description: 'A pressed graphite block with a dark crystalline grain and restrained metallic luster.',
    id: 'pressed-graphite',
    materialRecord: MATERIAL_ARCHIV_RECORDS.graphite,
    mode: 'sheet',
    name: 'Pressed graphite',
    settings: {
      colorA: '#121516', colorB: '#41484B', colorC: '#A0A8AA', gradient: 'linear',
      surfaceAngle: 18, surfaceDepth: 32, surfaceIrregularity: 42, surfaceMaterial: 'graphite',
      surfaceMetallic: 26, surfaceOpenArea: 20, surfaceRoughness: 44, surfaceScale: 46,
      surfaceTextureAmount: 88,
    },
    source: MATERIAL_ARCHIV_RECORDS.graphite.source,
    swatch: 'linear-gradient(145deg,#050607,#3b4042 42%,#111315 64%,#747a7c)',
  },
  {
    category: 'Metal',
    description: 'Warm hammered foil with broken specular highlights and shallow premium relief.',
    id: 'hammered-brass-v3',
    mode: 'sheet',
    name: 'Hammered brass',
    settings: {
      colorA: '#3A2109', colorB: '#B4741E', colorC: '#FFE3A0', gradient: 'bloom',
      surfaceAngle: 18, surfaceDepth: 58, surfaceIrregularity: 52, surfaceMaterial: 'hammered-foil',
      surfaceMetallic: 94, surfaceOpenArea: 22, surfaceRoughness: 36, surfaceScale: 52,
      surfaceTextureAmount: 88,
    },
    source: GLYPHFIELD_SOURCE,
    swatch: 'radial-gradient(circle at 30% 30%,#ffe9a9,#b57925 28%,#5d3308 68%,#d7a74a)',
  },
  {
    category: 'Paper',
    description: 'Blind emboss pressed into warm uncoated stock with a soft, dry response.',
    id: 'blind-emboss-v3',
    mode: 'sheet',
    name: 'Blind emboss',
    settings: {
      colorA: '#D4CEC2', colorB: '#ECE7DE', colorC: '#FFFDF8', gradient: 'radial',
      surfaceAngle: 0, surfaceDepth: 34, surfaceIrregularity: 30, surfaceMaterial: 'embossed-paper',
      surfaceMetallic: 0, surfaceOpenArea: 38, surfaceRoughness: 92, surfaceScale: 62,
      surfaceTextureAmount: 82,
    },
    source: GLYPHFIELD_SOURCE,
    swatch: 'linear-gradient(145deg,#c6bcae,#fffdf8 50%,#d9d0c4)',
  },
  {
    category: 'Glass',
    description: 'Translucent etched glass with micro-pits and broad pearlescent highlights.',
    id: 'frosted-glass-v3',
    mode: 'sheet',
    name: 'Frosted glass',
    settings: {
      colorA: '#71808B', colorB: '#C6D4D8', colorC: '#FFF8EE', gradient: 'bloom',
      surfaceAngle: 30, surfaceDepth: 18, surfaceIrregularity: 72, surfaceMaterial: 'frosted-glass',
      surfaceMetallic: 5, surfaceOpenArea: 72, surfaceRoughness: 78, surfaceScale: 32,
      surfaceTextureAmount: 84,
    },
    source: GLYPHFIELD_SOURCE,
    swatch: 'linear-gradient(140deg,#6d8590,#dce8e9 45%,#fff7ea)',
  },
  {
    category: 'Composite',
    description: 'A tight 2×2 carbon twill under a restrained resin clearcoat.',
    id: 'carbon-twill-v3',
    mode: 'sheet',
    name: 'Carbon twill',
    settings: {
      colorA: '#030405', colorB: '#171B20', colorC: '#68717A', gradient: 'linear',
      surfaceAngle: 45, surfaceDepth: 38, surfaceIrregularity: 12, surfaceMaterial: 'carbon-twill',
      surfaceMetallic: 48, surfaceOpenArea: 10, surfaceRoughness: 26, surfaceScale: 30,
      surfaceTextureAmount: 92,
    },
    source: GLYPHFIELD_SOURCE,
    swatch: 'repeating-linear-gradient(135deg,#080a0c 0 6px,#434b53 6px 10px,#111419 10px 16px)',
  },
  ...OPEN_SURFACE_PRESETS.map((preset): SurfaceLabPreset => ({
    ...preset,
    materialRecord: preset.id === 'polyhaven-velour-velvet' || preset.id === 'ambientcg-fabric-061'
      ? MATERIAL_ARCHIV_RECORDS.textile
      : preset.id === 'ambientcg-leather-037'
        ? MATERIAL_ARCHIV_RECORDS.leather
        : undefined,
    mode: 'sheet',
  })),
];

const HOLOCLOTH_SOURCE: SurfaceLabSource = {
  license: 'MIT',
  name: 'HoloCloth',
  url: 'https://github.com/dmitrykurash/holocloth',
};

export const SURFACE_LAB_CLOTH_PRESETS: readonly SurfaceLabPreset[] = [
  {
    category: 'Foil cloth',
    description: 'High-energy rainbow foil over a live woven Verlet drape.',
    id: 'cloth-holo',
    mode: 'cloth',
    name: 'Holo cloth',
    settings: {
      colorA: '#FF6CC4', colorB: '#7AF7E1', colorC: '#8D8BFF',
      surfaceAngle: 34, surfaceDepth: 68, surfaceIrregularity: 74, surfaceMaterial: 'holo-cloth',
      surfaceMetallic: 94, surfaceOpenArea: 68, surfaceRoughness: 14, surfaceScale: 72,
      surfaceTextureAmount: 96,
    },
    source: HOLOCLOTH_SOURCE,
    swatch: 'conic-gradient(from 25deg,#ff62c4,#ffe075,#6affda,#7398ff,#cf72ff,#ff62c4)',
  },
  {
    category: 'Foil cloth',
    description: 'A cooler chrome textile with satin folds and restrained spectral color.',
    id: 'cloth-chrome',
    mode: 'cloth',
    name: 'Chrome cloth',
    settings: {
      colorA: '#171A1E', colorB: '#B4BDC8', colorC: '#FFFFFF',
      surfaceAngle: 82, surfaceDepth: 58, surfaceIrregularity: 18, surfaceMaterial: 'holo-cloth',
      surfaceMetallic: 100, surfaceOpenArea: 62, surfaceRoughness: 24, surfaceScale: 46,
      surfaceTextureAmount: 22,
    },
    source: HOLOCLOTH_SOURCE,
    swatch: 'linear-gradient(145deg,#171a1e,#f7fbff 28%,#5c6671 48%,#eef4f8 64%,#252a30)',
  },
  {
    category: 'Woven cloth',
    description: 'Near-black woven cloth with matte folds and a subtle coated edge.',
    id: 'cloth-black',
    mode: 'cloth',
    name: 'Black cloth',
    settings: {
      colorA: '#020304', colorB: '#16191D', colorC: '#454B53',
      surfaceAngle: 12, surfaceDepth: 72, surfaceIrregularity: 8, surfaceMaterial: 'holo-cloth',
      surfaceMetallic: 42, surfaceOpenArea: 54, surfaceRoughness: 82, surfaceScale: 34,
      surfaceTextureAmount: 8,
    },
    source: HOLOCLOTH_SOURCE,
    swatch: 'linear-gradient(145deg,#020304,#33383e 42%,#090b0d 70%,#4c535b)',
  },
];

export const SURFACE_LAB_STICKER_PRESETS: readonly SurfaceLabPreset[] = STICKER_FINISH_PRESETS.map(
  (preset): SurfaceLabPreset => ({
    category: preset.source ? 'Holographic' : 'Production',
    description: preset.description,
    id: `sticker-${preset.id}`,
    mode: 'sticker',
    name: preset.label,
    source: preset.source,
    stickerFinish: preset.settings,
    stickerFinishId: preset.id,
    swatch: preset.swatch,
  })
);

export const SURFACE_LAB_PRESETS: readonly SurfaceLabPreset[] = [
  ...SURFACE_LAB_SHEET_PRESETS,
  ...SURFACE_LAB_SHADER_PRESETS,
  ...SURFACE_LAB_CLOTH_PRESETS,
  ...SURFACE_LAB_STICKER_PRESETS,
];

export function surfaceLabPresets(mode: SurfaceLabMode): readonly SurfaceLabPreset[] {
  if (mode === 'shader') return SURFACE_LAB_SHADER_PRESETS;
  if (mode === 'cloth') return SURFACE_LAB_CLOTH_PRESETS;
  if (mode === 'sticker') return SURFACE_LAB_STICKER_PRESETS;
  return SURFACE_LAB_SHEET_PRESETS;
}

export function surfaceLabPreset(id?: string): SurfaceLabPreset | undefined {
  return SURFACE_LAB_PRESETS.find((preset) => preset.id === id);
}
