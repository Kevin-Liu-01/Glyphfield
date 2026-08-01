import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_LOOK_PRESETS,
  LIVE_MATERIAL_OPTIONS,
  LIVE_MATERIAL_PALETTES,
} from './liveMaterials';
import { STUDIO_CATEGORIES, STUDIO_TOOLS, type StudioToolId } from './studioCatalog';

const SHARED_SHADER_LIBRARY_TOOLS = new Set<StudioToolId>(['animation', 'material']);

export const AGENT_LAB_PLUGINS = STUDIO_TOOLS.map((tool) => ({
  ...tool,
  agentAccess: 'discoverable-source-document',
  browserWorkspace: '/studio',
  capabilities: {
    sharedShaderLibrary: SHARED_SHADER_LIBRARY_TOOLS.has(tool.id),
    sourceEditing: true,
  },
}));

const materialEngines = new Map<string, number>();
LIVE_MATERIAL_OPTIONS.forEach(({ engine }) => {
  materialEngines.set(engine, (materialEngines.get(engine) ?? 0) + 1);
});

export const AGENT_SHADER_LIBRARY = {
  controls: {
    amplitude: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.amplitude, maximum: 8, minimum: 0, step: 0.1, type: 'number' },
    brightness: { default: DEFAULT_LIVE_MATERIAL_SETTINGS.brightness, maximum: 2, minimum: 0.1, step: 0.05, type: 'number' },
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
  count: LIVE_MATERIAL_OPTIONS.length,
  engines: [...materialEngines.entries()].map(([name, count]) => ({ count, name })),
  lookPresets: LIVE_MATERIAL_LOOK_PRESETS,
  materials: LIVE_MATERIAL_OPTIONS,
  palettes: LIVE_MATERIAL_PALETTES,
  schemaVersion: 1,
  sharedBy: ['animation', 'material'] as const,
} as const;

export const AGENT_LAB_CATALOG = {
  categories: STUDIO_CATEGORIES,
  count: AGENT_LAB_PLUGINS.length,
  plugins: AGENT_LAB_PLUGINS,
  schemaVersion: 1,
} as const;
