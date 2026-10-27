// Inspector edits across a multi-layer selection. The inspector edits the primary layer and names
// only the fields a control set, with nested settings as partial patches. Every other selected
// layer takes the fields it shares with the primary: all of them for the same kind, opacity and
// mark appearance across kinds. Content, crop and position stay each layer's own, a transform
// edit carries only the size leaves it changed, and a font size is re-derived for each box.
import type { CanvasLayerTransform } from './canvasInteraction';
import {
  resolvedLogoAppearance,
  type CompositionAsset,
  type CompositionLogoLayer,
  type CompositionTextLayer,
  type ContentLayerId,
  type ShaderApplication,
} from './designLabModel';
import type { LiveMaterialSettings } from './liveMaterials';
import { designLabFontSizeUpdate } from './designLabTypography';
import type { LogoAppearanceSettings } from './logoAppearance';
import { clearTextStyleProperties, INLINE_TEXT_KEYS, type InlineTextStyle } from './richText';
import { normalizeStickerFinish, type StickerFinishSettings } from './surfaceSticker';
import { resolveTextEffectSettings, type TextEffectSettings } from './textEffects';

type TransformEdit = { transform?: Partial<CanvasLayerTransform> };
export type TextLayerEdit = Partial<Omit<CompositionTextLayer, 'id' | 'textEffect' | 'transform'>> & TransformEdit & { textEffect?: Partial<TextEffectSettings> };
export type LogoLayerEdit = Partial<Omit<CompositionLogoLayer, 'appearance' | 'id' | 'transform'>> & TransformEdit & { appearance?: Partial<LogoAppearanceSettings> };
export type AssetLayerEdit = Partial<Omit<CompositionAsset, 'appearance' | 'id' | 'stickerFinish' | 'transform'>> & TransformEdit & {
  appearance?: Partial<LogoAppearanceSettings>;
  stickerFinish?: Partial<StickerFinishSettings>;
};
export type ShaderEdit = Partial<Omit<ShaderApplication, 'settings'>> & { settings?: Partial<LiveMaterialSettings> };
type ContentLayerEdit = TextLayerEdit | LogoLayerEdit | AssetLayerEdit;
type ContentKind = 'asset' | 'logo' | 'text';

const OWN_FIELDS: ReadonlySet<string> = new Set(['convertedAssetId', 'imageCrop', 'libraryAssetId', 'locked', 'name', 'runs', 'url', 'value', 'visible']);
const CROSS_KIND_FIELDS: Record<ContentKind, Record<ContentKind, readonly string[]>> = {
  asset: { asset: [], logo: ['appearance', 'opacity'], text: ['opacity'] },
  logo: { asset: ['appearance', 'opacity'], logo: [], text: ['opacity'] },
  text: { asset: ['opacity'], logo: ['opacity'], text: [] },
};

function contentKind(id: ContentLayerId): ContentKind {
  if (id.startsWith('text-')) return 'text';
  return id.startsWith('logo-') ? 'logo' : 'asset';
}

/** The part of a primary layer's edit another selected layer takes, or null when it shares none of it. */
export function peerEdit<Edit extends ContentLayerEdit>(
  edit: ContentLayerEdit,
  primary: { id: ContentLayerId; transform: CanvasLayerTransform },
  to: ContentLayerId
): Edit | null {
  const fromKind = contentKind(primary.id);
  const toKind = contentKind(to);
  const crossKind = CROSS_KIND_FIELDS[fromKind][toKind];
  const shared: Record<string, unknown> = Object.fromEntries(Object.entries(edit).filter(([key]) => (
    fromKind === toKind ? !OWN_FIELDS.has(key) : crossKind.includes(key)
  )));
  if (shared.transform) {
    const before: Partial<Record<string, unknown>> = primary.transform;
    const size = Object.entries(shared.transform).filter(([key, value]) => key !== 'x' && key !== 'y' && before[key] !== value);
    if (size.length) shared.transform = Object.fromEntries(size);
    else delete shared.transform;
  }
  return Object.keys(shared).length ? shared as Edit : null;
}

export function applyTextEdit(layer: CompositionTextLayer, edit: TextLayerEdit): CompositionTextLayer {
  const sized = edit.fontSize === undefined ? undefined : designLabFontSizeUpdate(layer, edit.fontSize);
  return {
    ...layer,
    ...edit,
    ...sized,
    textEffect: edit.textEffect ? { ...resolveTextEffectSettings(layer.textEffect), ...edit.textEffect } : layer.textEffect,
    transform: sized?.transform ?? { ...layer.transform, ...edit.transform },
  };
}

/** A whole-box edit on another text layer: inline runs give way for the properties it sets. */
export function applyPeerTextEdit(layer: CompositionTextLayer, edit: TextLayerEdit): CompositionTextLayer {
  const inline = Object.fromEntries(INLINE_TEXT_KEYS.filter((key) => key in edit).map((key) => [key, edit[key]])) as InlineTextStyle;
  return { ...applyTextEdit(layer, edit), runs: clearTextStyleProperties(layer.runs, inline) };
}

export function applyLogoEdit(layer: CompositionLogoLayer, edit: LogoLayerEdit): CompositionLogoLayer {
  return {
    ...layer,
    ...edit,
    appearance: edit.appearance ? { ...resolvedLogoAppearance(layer.appearance), ...edit.appearance } : layer.appearance,
    transform: { ...layer.transform, ...edit.transform },
  };
}

export function applyAssetEdit(layer: CompositionAsset, edit: AssetLayerEdit): CompositionAsset {
  return {
    ...layer,
    ...edit,
    appearance: edit.appearance ? { ...resolvedLogoAppearance(layer.appearance), ...edit.appearance } : layer.appearance,
    stickerFinish: edit.stickerFinish ? normalizeStickerFinish({ ...layer.stickerFinish, ...edit.stickerFinish }) : layer.stickerFinish,
    transform: { ...layer.transform, ...edit.transform },
  };
}
