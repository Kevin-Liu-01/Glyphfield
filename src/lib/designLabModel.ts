// Design Lab editor model: layer and artboard shapes, layer-id guards, and the
// resolved appearance defaults shared by the editor, its canvas, and export.
import { STUDIO_ARTBOARD_PRESETS, type StudioArtboardDimensions, type StudioArtboardPresetId } from '@/lib/artboardSizes';
import { brandTypographyFamily, resolveBrandTypographyWeight, type BrandIdentity, type BrandTypography } from '@/lib/brandIdentity';
import type { MotionExportQuality, MotionLoopMode } from '@/lib/canvasExport';
import type { CanvasLayerTransform } from '@/lib/canvasInteraction';
import type { CanvasTextAlign, CanvasTextWrap } from '@/lib/canvasText';
import type { CompositionEffectSettings } from '@/lib/compositionEffects';
import { resolveDesignLabFontSize } from '@/lib/designLabTypography';
import { designLayerGeometry } from '@/lib/designWorkspace';
import type { ImageCropSettings } from '@/lib/imagePlacement';
import type { LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';
import { DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';
import type { InlineTextStyle, ResolvedTextStyle, TextStyleRun } from '@/lib/richText';
import type { ShaderFrameSnapshot } from '@/lib/shaderFrameAssets';
import type { ShaderSequenceSettings } from '@/lib/shaderSequence';
import type { StickerFinishSettings } from '@/lib/surfaceSticker';
import { DEFAULT_TEXT_EFFECT, resolveTextEffectSettings, type TextEffectSettings } from '@/lib/textEffects';

type ImageAssetPlacementMode = 'image' | 'sticker';

export type ShaderRatio = StudioArtboardPresetId | 'custom';
export type ShaderBlendMode = 'multiply' | 'normal' | 'overlay' | 'screen';
export type ShaderLayerId = `shader-${string}`;
export type EffectLayerId = `effect-${string}`;
export type LogoLayerId = `logo-${string}`;
export type TextLayerId = `text-${string}`;
export type AssetLayerId = `asset-${string}`;
export type ContentLayerId = LogoLayerId | TextLayerId | AssetLayerId;
export type CanvasLayerId = ShaderLayerId | ContentLayerId;
export type CompositionLayerId = ShaderLayerId | EffectLayerId | ContentLayerId;
export type CompositionLayerGroupId = `group-${string}`;

export type CompositionLayerGroup = {
  id: CompositionLayerGroupId;
  layerIds: CanvasLayerId[];
  name: string;
};

export type ShaderApplication = {
  blendMode: ShaderBlendMode;
  frameState?: LiveMaterialFrameState;
  frameSnapshot?: ShaderFrameSnapshot;
  materialId: LiveMaterialId;
  opacity: number;
  settings: LiveMaterialSettings;
  shaderSize: number;
};

export type CompositionShaderLayer = ShaderApplication & {
  id: ShaderLayerId;
  name: string;
  transform: CanvasLayerTransform;
  visible: boolean;
};

export type CompositionEffectLayer = {
  frameSnapshot?: ShaderFrameSnapshot;
  id: EffectLayerId;
  name: string;
  opacity: number;
  settings: CompositionEffectSettings;
  visible: boolean;
};


export type CompositionLogoLayer = {
  appearance?: LogoAppearanceSettings;
  color?: string;
  convertedAssetId?: string;
  id: LogoLayerId;
  name: string;
  opacity?: number;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

export type CompositionAsset = {
  appearance?: LogoAppearanceSettings;
  id: AssetLayerId;
  imageCrop?: ImageCropSettings;
  kind?: ImageAssetPlacementMode;
  libraryAssetId?: string;
  name: string;
  opacity?: number;
  stickerFinish?: StickerFinishSettings;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

export type CompositionTextLayer = {
  runs?: TextStyleRun[];
  align: CanvasTextAlign;
  color?: string;
  fontRole?: BrandTypography['role'];
  fontSize?: number;
  fontStyle?: 'normal' | 'italic';
  id: TextLayerId;
  kind?: 'sticker' | 'text';
  lineHeight: number;
  name: string;
  opacity?: number;
  outlineColor?: string;
  outlineEnabled?: boolean;
  outlineWidth?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  strikethrough?: boolean;
  textEffect?: TextEffectSettings;
  tracking: number;
  transform: CanvasLayerTransform;
  underline?: boolean;
  value: string;
  visible: boolean;
  weight: number;
  wrap: CanvasTextWrap;
};

export type LayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

export function resolveTextRunStyle(layer: CompositionTextLayer, identity: BrandIdentity, canvasHeight: number, style: InlineTextStyle): ResolvedTextStyle {
  const appearance = resolvedTextAppearance(layer);
  const fontRole = style.fontRole ?? appearance.fontRole;
  return {
    color: style.color ?? appearance.color,
    fontFamily: `${JSON.stringify(brandTypographyFamily(identity, fontRole))}, Arial, sans-serif`,
    fontSize: style.fontSize === undefined ? resolveDesignLabFontSize(layer, canvasHeight) : style.fontSize * layer.transform.scale,
    fontStyle: style.fontStyle ?? layer.fontStyle ?? 'normal',
    fontWeight: resolveBrandTypographyWeight(identity, fontRole, style.weight ?? layer.weight),
    tracking: style.tracking ?? layer.tracking,
    underline: style.underline ?? layer.underline ?? false,
    strikethrough: style.strikethrough ?? layer.strikethrough ?? false,
  };
}

export type TextAppearanceSettings = {
  color: string;
  fontRole: BrandTypography['role'];
  opacity: number;
  outlineColor: string;
  outlineEnabled: boolean;
  outlineWidth: number;
  shadowBlur: number;
  shadowColor: string;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  textEffect: TextEffectSettings;
};

export type DesignShaderSequenceSettings = ShaderSequenceSettings & {
  sequenceOffset: number;
  targetLayerId: ShaderLayerId | null;
};

export type DesignArtboardId = `artboard-${string}`;

export type DesignArtboardTimeline = {
  frame: number;
  paused: boolean;
  timeMs?: number;
};

export type DesignArtboardSnapshot = {
  assets: CompositionAsset[];
  backgroundColor: string;
  dimensions: StudioArtboardDimensions;
  effectLayers: CompositionEffectLayer[];
  groups: CompositionLayerGroup[];
  layerOrder: CompositionLayerId[];
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  logos: CompositionLogoLayer[];
  ratio: ShaderRatio;
  shaderLayers: CompositionShaderLayer[];
  shaderSequence: DesignShaderSequenceSettings;
  textLayers: CompositionTextLayer[];
  timeline: DesignArtboardTimeline;
};

export type DesignArtboard = {
  displayScale?: number;
  id: DesignArtboardId;
  name: string;
  snapshot: DesignArtboardSnapshot;
  x: number;
  y: number;
};

export const DEFAULT_LAYER_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };

export const DEFAULT_TEXT_LAYER_TRANSFORM: CanvasLayerTransform = {
  ...DEFAULT_LAYER_TRANSFORM,
  heightScale: 1,
  widthScale: 1,
};
export const DEFAULT_TEXT_APPEARANCE: TextAppearanceSettings = {
  color: '#FFFFFF',
  fontRole: 'Display',
  opacity: 1,
  outlineColor: '#000000',
  outlineEnabled: false,
  outlineWidth: 1,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowOpacity: 35,
  textEffect: { ...DEFAULT_TEXT_EFFECT },
};

export const STICKER_IMAGE_APPEARANCE: LogoAppearanceSettings = {
  ...DEFAULT_LOGO_APPEARANCE,
  borderColor: '#FFFFFF',
  borderEnabled: true,
  borderOpacity: 100,
  borderWidth: 7,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: true,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
  shadowOpacity: 34,
};
export const STICKER_TEXT_APPEARANCE: Partial<TextAppearanceSettings> = {
  outlineColor: '#FFFFFF',
  outlineEnabled: true,
  outlineWidth: 7,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: true,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
  shadowOpacity: 34,
};

export function isTextLayerId(layerId: CompositionLayerId | null): layerId is TextLayerId {
  return layerId?.startsWith('text-') ?? false;
}

export function isShaderLayerId(layerId: CompositionLayerId | null): layerId is ShaderLayerId {
  return layerId?.startsWith('shader-') ?? false;
}

export function isEffectLayerId(layerId: CompositionLayerId | null): layerId is EffectLayerId {
  return layerId?.startsWith('effect-') ?? false;
}

export function isLogoLayerId(layerId: CompositionLayerId | null): layerId is LogoLayerId {
  return layerId?.startsWith('logo-') ?? false;
}

export function isAssetLayerId(layerId: CompositionLayerId | null): layerId is AssetLayerId {
  return layerId?.startsWith('asset-') ?? false;
}

export function isContentLayerId(layerId: CompositionLayerId | null): layerId is ContentLayerId {
  return isLogoLayerId(layerId) || isTextLayerId(layerId) || isAssetLayerId(layerId);
}

export function isCanvasLayerId(layerId: CompositionLayerId | null): layerId is CanvasLayerId {
  return isShaderLayerId(layerId) || isContentLayerId(layerId);
}

export function isStickerLayer(
  assetLayer: CompositionAsset | null,
  textLayer: CompositionTextLayer | null
): boolean {
  return assetLayer?.kind === 'sticker' || textLayer?.kind === 'sticker';
}

export function resolvedTextTransform(transform: CanvasLayerTransform): CanvasLayerTransform {
  return {
    ...transform,
    heightScale: transform.heightScale ?? 1,
    widthScale: transform.widthScale ?? 1,
  };
}

export function resolvedTextAppearance(layer: CompositionTextLayer): TextAppearanceSettings {
  return {
    color: layer.color ?? DEFAULT_TEXT_APPEARANCE.color,
    fontRole: layer.fontRole ?? DEFAULT_TEXT_APPEARANCE.fontRole,
    opacity: layer.opacity ?? DEFAULT_TEXT_APPEARANCE.opacity,
    outlineColor: layer.outlineColor ?? DEFAULT_TEXT_APPEARANCE.outlineColor,
    outlineEnabled: layer.outlineEnabled ?? DEFAULT_TEXT_APPEARANCE.outlineEnabled,
    outlineWidth: layer.outlineWidth ?? DEFAULT_TEXT_APPEARANCE.outlineWidth,
    shadowBlur: layer.shadowBlur ?? DEFAULT_TEXT_APPEARANCE.shadowBlur,
    shadowColor: layer.shadowColor ?? DEFAULT_TEXT_APPEARANCE.shadowColor,
    shadowEnabled: layer.shadowEnabled ?? DEFAULT_TEXT_APPEARANCE.shadowEnabled,
    shadowOffsetX: layer.shadowOffsetX ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetX,
    shadowOffsetY: layer.shadowOffsetY ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetY,
    shadowOpacity: layer.shadowOpacity ?? DEFAULT_TEXT_APPEARANCE.shadowOpacity,
    textEffect: resolveTextEffectSettings(layer.textEffect),
  };
}

export function resolvedLogoAppearance(settings?: LogoAppearanceSettings): LogoAppearanceSettings {
  return { ...DEFAULT_LOGO_APPEARANCE, ...settings };
}

export function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

export function textShadowStyle(settings: TextAppearanceSettings): string | undefined {
  if (!settings.shadowEnabled) return undefined;
  return `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${colorWithOpacity(settings.shadowColor, settings.shadowOpacity / 100)}`;
}

export function layerGeometry(layerId: CanvasLayerId, canvas: StudioArtboardDimensions): LayerGeometry {
  return designLayerGeometry(layerId, canvas);
}

export function layerKind(id: CompositionLayerId) {
  if (isShaderLayerId(id)) return 'Shader';
  if (isEffectLayerId(id)) return 'Converter';
  if (isLogoLayerId(id)) return 'Brand mark';
  if (isTextLayerId(id)) return 'Editable text';
  return 'Image';
}

export type DesignExportSettings = {
  durationMs: number;
  fps: number;
  gifLoop: MotionLoopMode;
  quality: MotionExportQuality;
  width: number;
};

export type DesignRatioOption = StudioArtboardDimensions & {
  label: string;
  value: ShaderRatio;
};

export type DesignExportFormat = 'gif' | 'jpg' | 'mp4' | 'png';
export type DesignMotionMode = 'sequence' | 'standard';

export const RATIO_OPTIONS: readonly { height: number; label: string; value: StudioArtboardPresetId; width: number }[] = (
  STUDIO_ARTBOARD_PRESETS.map(({ height, id, label, width }) => ({ height, label, value: id, width }))
);

export const DEFAULT_EXPORT_SETTINGS: DesignExportSettings = {
  durationMs: 1_600,
  fps: 30,
  gifLoop: 'seamless',
  quality: 'balanced',
  width: 960,
};
export const EXPORT_WIDTH_PRESETS = [
  { label: 'Compact', width: 640 },
  { label: 'Standard', width: 960 },
  { label: 'Large', width: 1_280 },
  { label: 'Full', width: 1_920 },
] as const;
export const EXPORT_QUALITY_OPTIONS: readonly { description: string; label: string; value: MotionExportQuality }[] = [
  { description: 'Quick preview', label: 'Fast', value: 'fast' },
  { description: 'Everyday export', label: 'Balanced', value: 'balanced' },
  { description: 'Most detail', label: 'Best', value: 'best' },
];

export function normalizeDesignExportSettings(settings?: Partial<DesignExportSettings>): DesignExportSettings {
  return {
    durationMs: settings?.durationMs && [1_200, 1_600, 2_400, 4_000].includes(settings.durationMs)
      ? settings.durationMs
      : DEFAULT_EXPORT_SETTINGS.durationMs,
    fps: settings?.fps && [12, 15, 24, 30, 60].includes(settings.fps)
      ? settings.fps
      : DEFAULT_EXPORT_SETTINGS.fps,
    gifLoop: settings?.gifLoop === 'raw' ? 'raw' : 'seamless',
    quality: settings?.quality && EXPORT_QUALITY_OPTIONS.some(({ value }) => value === settings.quality)
      ? settings.quality
      : DEFAULT_EXPORT_SETTINGS.quality,
    width: Number.isFinite(settings?.width) && (settings?.width ?? 0) > 0
      ? settings!.width!
      : DEFAULT_EXPORT_SETTINGS.width,
  };
}

export function designExportSettingsSignature(ratio: ShaderRatio, settings: DesignExportSettings): string {
  return [ratio, settings.width, settings.quality, settings.durationMs, settings.fps, settings.gifLoop].join(':');
}
