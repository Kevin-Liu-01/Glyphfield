import type { CubicBezier } from './animation';
import type { GifExportConfig } from './exportGif';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialSettings,
} from './liveMaterials';
import { SHADER_LIBRARY_DEFAULT_IDS } from './shaderLab';
import {
  DEFAULT_MATERIAL_FINISH,
  normalizeMaterialFinish,
  type MaterialFinishSettings,
} from './materialFinish';
import type {
  StudioBackground,
  StudioSource,
} from './renderFrame';
import { capVisibleFontWeight } from './typography';

export type SourceMode = 'sequence' | 'text' | 'images';

export type ImportedImage = {
  height: number;
  id: string;
  image: HTMLImageElement;
  name: string;
  url: string;
  width: number;
};

export function isSupportedLottieFile(name: string, type: string): boolean {
  const normalizedName = name.toLowerCase();
  return (
    normalizedName.endsWith('.lottie') ||
    normalizedName.endsWith('.json') ||
    type === 'application/json' ||
    type === 'application/zip+dotlottie'
  );
}

export type StudioFrameSettings = {
  alignX: number;
  alignY: number;
  background: Omit<StudioBackground, 'image'>;
  fit: 'contain' | 'cover';
  finish: MaterialFinishSettings;
  fontSize: number;
  fontWeight: number;
  foreground: string;
  opacity: number;
  rotation: number;
  scale: number;
};

export type StudioBackgroundSettings = StudioFrameSettings['background'];

export type StudioSettings = GifExportConfig & {
  shaderSettings: LiveMaterialSettings;
};

export const DEFAULT_TEXT_FRAMES = [
  'Welcome',
  'Bienvenidos',
  '你好',
  'ようこそ',
  'أهلاً وسهلاً',
  'स्वागत है',
  'Bienvenue',
  '환영합니다',
].join('\n');

export const DEFAULT_SETTINGS: StudioSettings = {
  alignX: 0,
  alignY: 0,
  background: '#000000',
  backgroundAngle: 135,
  backgroundSecondary: '#262626',
  backgroundStyle: 'solid',
  backgroundTransition: 'crossfade',
  bezier: [0.4, 0, 0.2, 1],
  blur: 8,
  colors: 256,
  fit: 'contain',
  fontSize: 108,
  fontWeight: 550,
  foreground: '#ffffff',
  fps: 20,
  height: 300,
  holdMs: 1250,
  loop: true,
  packageId: 'morph-fade',
  scale: 1,
  shaderSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
  transitionMs: 240,
  width: 1000,
};

export function createDefaultFrameSettings(
  settings: StudioSettings
): StudioFrameSettings {
  return {
    alignX: settings.alignX,
    alignY: settings.alignY,
    background: {
      angle: settings.backgroundAngle,
      colorA: settings.background,
      colorB: settings.backgroundSecondary,
      colorC: settings.shaderSettings.colorC,
      finish: { ...DEFAULT_MATERIAL_FINISH },
      materialId: SHADER_LIBRARY_DEFAULT_IDS.animation,
      materialSettings: { ...settings.shaderSettings },
      patternScale: 1,
      style: settings.backgroundStyle,
    },
    fit: settings.fit,
    finish: { ...DEFAULT_MATERIAL_FINISH },
    fontSize: settings.fontSize,
    fontWeight: capVisibleFontWeight(settings.fontWeight),
    foreground: settings.foreground,
    opacity: 1,
    rotation: 0,
    scale: settings.scale,
  };
}

export function mergeStudioBackground(
  base: StudioBackgroundSettings,
  patch: Partial<StudioBackgroundSettings>,
  fallbackSettings: LiveMaterialSettings
): StudioBackgroundSettings {
  return {
    ...base,
    ...patch,
    finish: normalizeMaterialFinish(patch.finish ?? base.finish),
    materialSettings: {
      ...fallbackSettings,
      ...base.materialSettings,
      ...patch.materialSettings,
    },
  };
}

export function resolveStudioFrameSettings(
  settings: StudioSettings,
  storedFrame: StudioFrameSettings | undefined,
  sequenceBackground: StudioBackgroundSettings,
  hasBackgroundOverride: boolean
): StudioFrameSettings {
  const frame = storedFrame ?? createDefaultFrameSettings(settings);
  if (hasBackgroundOverride) return frame;
  return {
    ...frame,
    background: mergeStudioBackground(
      sequenceBackground,
      {},
      settings.shaderSettings
    ),
  };
}

export function applyFrameSettings(
  source: StudioSource,
  frame: StudioFrameSettings
): StudioSource {
  return {
    ...source,
    alignX: frame.alignX,
    alignY: frame.alignY,
    background: {
      ...frame.background,
      finish: normalizeMaterialFinish(frame.background.finish),
      materialSettings: {
        ...DEFAULT_LIVE_MATERIAL_SETTINGS,
        ...frame.background.materialSettings,
      },
    },
    fit: frame.fit,
    finish: normalizeMaterialFinish(frame.finish),
    fontSize: frame.fontSize,
    fontWeight: capVisibleFontWeight(frame.fontWeight),
    foreground: frame.foreground,
    opacity: frame.opacity,
    rotation: frame.rotation,
    scale: frame.scale,
  };
}

export function orderStudioSources(
  sources: readonly StudioSource[],
  order: readonly string[]
): StudioSource[] {
  if (sources.length <= 1 || order.length === 0) return [...sources];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const ordered = order.flatMap((id) => {
    const source = sourceById.get(id);
    if (!source) return [];
    sourceById.delete(id);
    return [source];
  });
  return [...ordered, ...sources.filter((source) => sourceById.has(source.id))];
}

export const EASING_PRESETS: Record<string, CubicBezier> = {
  material: [0.4, 0, 0.2, 1],
  snappy: [0.2, 0.8, 0.2, 1],
  soft: [0.45, 0, 0.55, 1],
  dramatic: [0.76, 0, 0.24, 1],
};
