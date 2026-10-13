// Copy style between Design Lab layers. A style is appearance only: never
// content, geometry, name, visibility, lock state or identity. Each target
// takes the fields it shares with the source.
import type {
  CompositionAsset,
  CompositionLogoLayer,
  CompositionShaderLayer,
  CompositionTextLayer,
  ShaderApplication,
} from './designLabModel';
import type { LogoAppearanceSettings } from './logoAppearance';
import { clearTextStyleProperties, INLINE_TEXT_KEYS, type InlineTextStyle } from './richText';
import type { StickerFinishSettings } from './surfaceSticker';

export const DESIGN_LAB_TEXT_STYLE_KEYS = [
  'align',
  'color',
  'fontRole',
  'fontSize',
  'fontStyle',
  'lineHeight',
  'outlineColor',
  'outlineEnabled',
  'outlineWidth',
  'shadowBlur',
  'shadowColor',
  'shadowEnabled',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadowOpacity',
  'strikethrough',
  'textEffect',
  'tracking',
  'underline',
  'weight',
  'wrap',
] as const satisfies readonly (keyof CompositionTextLayer)[];

type TextStyleFields = Partial<Pick<CompositionTextLayer, typeof DESIGN_LAB_TEXT_STYLE_KEYS[number]>>;

export type DesignLabLayerStyle = {
  /** Applied material, without captured frames. */
  material?: ShaderApplication;
  media?: { appearance?: LogoAppearanceSettings; color?: string; stickerFinish?: StickerFinishSettings };
  /** Content opacity. Shader layers carry theirs on the material. */
  opacity?: number;
  sourceKind: 'image' | 'mark' | 'shader' | 'text';
  text?: TextStyleFields;
};

export type DesignLabStyledLayer = CompositionAsset | CompositionLogoLayer | CompositionShaderLayer | CompositionTextLayer;

function materialOf(application: ShaderApplication): ShaderApplication {
  return {
    blendMode: application.blendMode,
    materialId: application.materialId,
    opacity: application.opacity,
    settings: { ...application.settings },
    shaderSize: application.shaderSize,
  };
}

function layerType(layer: DesignLabStyledLayer): DesignLabLayerStyle['sourceKind'] {
  if (layer.id.startsWith('shader-')) return 'shader';
  if (layer.id.startsWith('text-')) return 'text';
  if (layer.id.startsWith('logo-')) return 'mark';
  return 'image';
}

export function extractDesignLabLayerStyle(layer: DesignLabStyledLayer, layerShader?: ShaderApplication): DesignLabLayerStyle {
  const sourceKind = layerType(layer);
  if (sourceKind === 'shader') return { material: materialOf(layer as CompositionShaderLayer), sourceKind };
  const material = layerShader ? materialOf(layerShader) : undefined;
  if (sourceKind === 'text') {
    const text = layer as CompositionTextLayer;
    const fields = Object.fromEntries(DESIGN_LAB_TEXT_STYLE_KEYS
      .filter((key) => text[key] !== undefined)
      .map((key) => [key, key === 'textEffect' ? { ...text.textEffect } : text[key]])) as TextStyleFields;
    return { material, opacity: text.opacity, sourceKind, text: fields };
  }
  const media = layer as CompositionAsset | CompositionLogoLayer;
  return {
    material,
    media: {
      appearance: media.appearance ? { ...media.appearance } : undefined,
      color: sourceKind === 'mark' ? (media as CompositionLogoLayer).color : undefined,
      stickerFinish: sourceKind === 'image' && (media as CompositionAsset).stickerFinish
        ? { ...(media as CompositionAsset).stickerFinish! } : undefined,
    },
    opacity: media.opacity,
    sourceKind,
  };
}

/**
 * Returns the restyled layer and, for content layers, the material to apply
 * (undefined keeps the target's own material). Text loses inline overrides
 * for the properties the style sets, so the pasted look applies everywhere.
 */
export function applyDesignLabLayerStyle<Layer extends DesignLabStyledLayer>(
  layer: Layer,
  style: DesignLabLayerStyle
): { layer: Layer; material?: ShaderApplication } {
  const targetKind = layerType(layer);
  if (targetKind === 'shader') {
    const material = style.material;
    if (!material) return { layer };
    return { layer: { ...layer, ...materialOf(material), frameSnapshot: undefined, frameState: undefined } };
  }
  const opacity = style.opacity === undefined ? {} : { opacity: style.opacity };
  const material = style.material ? materialOf(style.material) : undefined;
  if (targetKind === 'text') {
    const text = layer as CompositionTextLayer;
    if (!style.text) return { layer: { ...layer, ...opacity }, material };
    const inline = Object.fromEntries(Object.entries(style.text).filter(([key]) => (
      (INLINE_TEXT_KEYS as readonly string[]).includes(key)
    ))) as InlineTextStyle;
    const restyled: CompositionTextLayer = { ...text, ...style.text, ...opacity };
    if (text.runs) restyled.runs = clearTextStyleProperties(text.runs, inline);
    return { layer: restyled as Layer, material };
  }
  const media = style.media;
  if (!media) return { layer: { ...layer, ...opacity }, material };
  const next = { ...layer, ...opacity } as CompositionAsset & CompositionLogoLayer;
  if (media.appearance) next.appearance = { ...media.appearance };
  if (targetKind === 'mark' && media.color) next.color = media.color;
  if (targetKind === 'image' && media.stickerFinish && (layer as CompositionAsset).kind === 'sticker') {
    next.stickerFinish = { ...media.stickerFinish };
  }
  return { layer: next as unknown as Layer, material };
}
