import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_LOOK_PRESETS,
  LIVE_MATERIAL_PALETTES,
  STATIC_SURFACE_MATERIAL_IDS,
} from './liveMaterials';
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND_SETTINGS, SURFACE_MATERIAL_IDS } from './backgroundSvg';
import { OPEN_SURFACE_LIBRARY, OPEN_SURFACE_LIBRARY_IDS, OPEN_SURFACE_PRESETS } from './openSurfaceLibrary';
import { DEFAULT_STICKER_FINISH, STICKER_FINISH_PRESETS } from './surfaceSticker';
import {
  SHADER_LAB_CATEGORIES,
  SHADER_LIBRARY_DEFAULT_IDS,
  shaderLabMaterials,
} from './shaderLab';
import { STUDIO_CATEGORIES, STUDIO_TOOLS, type StudioToolId } from './studioCatalog';
import { SURFACE_LAB_SHADER_PRESETS } from './surfaceLab';

const SHARED_SHADER_LIBRARY_TOOLS = new Set<StudioToolId>(['animation', 'material']);
const SHARED_SHADER_MATERIALS = shaderLabMaterials('', 'all');

const AGENT_LAB_PLUGINS = STUDIO_TOOLS.map((tool) => ({
  ...tool,
  agentAccess: 'http-contract-and-browser-api',
  browserWorkspace: '/studio',
  capabilities: {
    browserApi: true,
    controlAutomation: true,
    directHttpGeneration: tool.id === 'material'
      ? ['design-sequence']
      : tool.id === 'brand-elements'
        ? ['element-brief']
        : ['template', 'background'].filter((kind) => (
            (kind === 'template' && ['blog', 'opengraph', 'partnership', 'slides'].includes(tool.id))
            || (kind === 'background' && tool.id === 'opengraph')
          )),
    sharedShaderLibrary: SHARED_SHADER_LIBRARY_TOOLS.has(tool.id),
    sourceEditing: true,
  },
}));

const materialEngines = new Map<string, number>();
SHARED_SHADER_MATERIALS.forEach(({ engine }) => {
  materialEngines.set(engine, (materialEngines.get(engine) ?? 0) + 1);
});

export const AGENT_SHADER_LIBRARY = {
  categories: SHADER_LAB_CATEGORIES,
  controls: {
    amplitude: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.amplitude, maximum: 8, minimum: 0, step: 0.1, type: 'number' },
    brightness: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.brightness, maximum: 2, minimum: 0.1, step: 0.05, type: 'number' },
    centerX: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.centerX, maximum: 1, minimum: 0, step: 0.01, type: 'number' },
    centerY: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.centerY, maximum: 1, minimum: 0, step: 0.01, type: 'number' },
    colorA: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.colorA, type: 'hex-color' },
    colorB: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.colorB, type: 'hex-color' },
    colorC: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.colorC, type: 'hex-color' },
    density: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.density, maximum: 2, minimum: 0.1, step: 0.05, type: 'number' },
    detail: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.detail, maximum: 8, minimum: 0.5, step: 0.1, type: 'number' },
    frequency: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.frequency, maximum: 10, minimum: 0.2, step: 0.1, type: 'number' },
    grain: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.grain, maximum: 100, minimum: 0, step: 1, type: 'number' },
    rotationX: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.rotationX, maximum: 360, minimum: 0, step: 1, type: 'number' },
    rotationY: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.rotationY, maximum: 360, minimum: 0, step: 1, type: 'number' },
    rotationZ: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.rotationZ, maximum: 360, minimum: 0, step: 1, type: 'number' },
    speed: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.speed, maximum: 2, minimum: 0, step: 0.05, type: 'number' },
    strength: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.strength, maximum: 2, minimum: 0, step: 0.01, type: 'number' },
  },
  count: SHARED_SHADER_MATERIALS.length,
  defaults: SHADER_LIBRARY_DEFAULT_IDS,
  engines: [...materialEngines.entries()].map(([name, count]) => ({ count, name })),
  lookPresets: LIVE_MATERIAL_LOOK_PRESETS,
  materials: SHARED_SHADER_MATERIALS,
  palettes: LIVE_MATERIAL_PALETTES,
  schemaVersion: 1,
  sharedBy: ['animation', 'material'] as const,
} as const;

export const AGENT_SURFACE_LIBRARY = {
  browserPreview: {
    camera: 'fixed',
    fallback: 'deterministic-svg',
    renderer: 'react-three-fiber',
    userOrbit: false,
  },
  controls: {
    surfaceAngle: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceAngle, maximum: 180, minimum: 0, step: 1, type: 'number' },
    surfaceDepth: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceDepth, maximum: 100, minimum: 0, step: 1, type: 'number' },
    surfaceMaterial: {
      default: DEFAULT_BACKGROUND_SETTINGS.surfaceMaterial,
      options: SURFACE_MATERIAL_IDS,
      type: 'enum',
    },
    surfaceMetallic: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceMetallic, maximum: 100, minimum: 0, step: 1, type: 'number' },
    surfaceOpenArea: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceOpenArea, maximum: 92, minimum: 0, step: 1, type: 'number' },
    surfaceRoughness: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceRoughness, maximum: 100, minimum: 0, step: 1, type: 'number' },
    surfaceScale: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceScale, maximum: 140, minimum: 12, step: 1, type: 'number' },
    surfaceTextureAmount: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceTextureAmount, maximum: 100, minimum: 0, step: 1, type: 'number' },
    surfaceIrregularity: { default: DEFAULT_BACKGROUND_SETTINGS.surfaceIrregularity, maximum: 100, minimum: 0, step: 1, type: 'number' },
    surfaceLibraryAssetId: {
      default: DEFAULT_BACKGROUND_SETTINGS.surfaceLibraryAssetId,
      options: ['', ...OPEN_SURFACE_LIBRARY_IDS],
      type: 'enum',
    },
  },
  count: BACKGROUND_PRESETS.length + OPEN_SURFACE_PRESETS.length,
  generationKind: 'background',
  liveShaderCount: SURFACE_LAB_SHADER_PRESETS.length,
  liveShaders: SURFACE_LAB_SHADER_PRESETS,
  openPbrAssets: OPEN_SURFACE_LIBRARY,
  presets: [...OPEN_SURFACE_PRESETS, ...BACKGROUND_PRESETS],
  schemaVersion: 1,
  stickerControls: {
    bevelWidth: { default: DEFAULT_STICKER_FINISH.bevelWidth, maximum: 32, minimum: 2, step: 1, type: 'number' },
    borderColor: { default: DEFAULT_STICKER_FINISH.borderColor, type: 'hex-color' },
    depth: { default: DEFAULT_STICKER_FINISH.depth, maximum: 100, minimum: 0, step: 1, type: 'number' },
    edgeWidth: { default: DEFAULT_STICKER_FINISH.edgeWidth, maximum: 32, minimum: 2, step: 1, type: 'number' },
    glintAngle: { default: DEFAULT_STICKER_FINISH.glintAngle, maximum: 180, minimum: 0, step: 1, type: 'number' },
    insetDepth: { default: DEFAULT_STICKER_FINISH.insetDepth, maximum: 100, minimum: 0, step: 1, type: 'number' },
    intensity: { default: DEFAULT_STICKER_FINISH.intensity, maximum: 100, minimum: 0, step: 1, type: 'number' },
    seamWidth: { default: DEFAULT_STICKER_FINISH.seamWidth, maximum: 12, minimum: 0, step: 1, type: 'number' },
    texture: { default: DEFAULT_STICKER_FINISH.texture, maximum: 100, minimum: 0, step: 1, type: 'number' },
  },
  stickerFinishCount: STICKER_FINISH_PRESETS.length,
  stickerFinishes: STICKER_FINISH_PRESETS,
  staticShaderIds: STATIC_SURFACE_MATERIAL_IDS,
} as const;

export const AGENT_LAB_CATALOG = {
  categories: STUDIO_CATEGORIES,
  count: AGENT_LAB_PLUGINS.length,
  plugins: AGENT_LAB_PLUGINS,
  schemaVersion: 1,
} as const;
