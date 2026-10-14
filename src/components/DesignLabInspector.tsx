'use client';

// Design Lab inspector sections: shader, converter, text, image and frame
// controls. Each section is memoized; the host passes stable handlers so a
// commit that does not touch the selected layer skips the inspector.
import ShaderEffectsControls from './ShaderEffectsControls';
import { DesignLabEffectPicker, DesignLabImageEffectNotice, type DesignLabImageEffectStatusStore } from './DesignLabEffectPicker';
import { designLabImageEffect, type DesignLabImageEffectId } from '@/lib/designLabImageEffects';
import { getShaderEffect } from '@/lib/shaderEffects';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Crop,
  ExternalLink,
  FileImage,
  Frame,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Layers3,
  LayoutGrid,
  Plus,
  RotateCcw,
  Sparkles,
  Sticker,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  Trash2,
  Type,
  WandSparkles,
  WrapText,
  X,
  ZoomIn,
  ZoomOut,
} from '@/components/ui/SolidIcons';
import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { INLINE_TEXT_KEYS, textStyleSegments, type InlineTextStyle, type TextSelectionRange } from '@/lib/richText';
import { previewSelectedTextStyle, selectedCanvasLayerElement } from '@/lib/designLabCanvasPreview';
import StudioRange from '@/components/ui/StudioRange';
import RangeControl from '@/components/DesignLabRangeControl';
import StudioFontSizeControl from '@/components/StudioFontSizeControl';
import { designLabFontSizeUpdate, resolveDesignLabFontSize } from '@/lib/designLabTypography';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import CompositionEffectThumbnail from '@/components/CompositionEffectThumbnail';
import {
  canvasLayerDimensions,
  MIN_CANVAS_LAYER_SCALE,
  normalizeCanvasLayerTransform,
  type CanvasLayerGeometry,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import { ArtboardSetupFields } from '@/components/ArtboardSizeMenu';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import { ConditionalRender, OptionalRender } from '@/components/RenderControl';
import type { ConvertedAssetLibraryController } from '@/hooks/useConvertedAssets';
import type { StudioArtboardDimensions } from '@/lib/artboardSizes';
import type { ConvertedAsset } from '@/lib/convertedAssets';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import TextEffectThumbnail from '@/components/TextEffectThumbnail';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useValueStore, type ValueStore } from '@/hooks/useValueStore';
import {
  brandTypographyFamily,
  brandTypographyRole,
  brandTypographyWeightRange,
  resolveBrandTypographyWeight,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { COMPOSITION_EFFECT_PRESETS, type CompositionEffectKind, type CompositionEffectSettings } from '@/lib/compositionEffects';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  brandMaterialPalette,
  isPaperLiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import type { LogoAppearanceSettings } from '@/lib/logoAppearance';
import { DEFAULT_IMAGE_CROP, normalizeImageCropSettings, type ImageCropSettings } from '@/lib/imagePlacement';
import { shaderLabSettingsFor } from '@/lib/shaderLab';
import {
  clampShaderZoom,
  formatShaderZoom,
  shaderZoomFromSlider,
  shaderZoomToSlider,
  SHADER_ZOOM_MAX,
  SHADER_ZOOM_MIN,
  SHADER_ZOOM_SLIDER_MAX,
  SHADER_ZOOM_SLIDER_MIN,
  SHADER_ZOOM_SLIDER_STEP,
  stepShaderZoom,
} from '@/lib/shaderZoom';
import {
  DEFAULT_STICKER_FINISH,
  STICKER_FINISH_PRESETS,
  normalizeStickerFinish,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';
import { TEXT_EFFECT_PRESETS, type TextEffectSettings } from '@/lib/textEffects';
import {
  DEFAULT_LAYER_TRANSFORM,
  DEFAULT_TEXT_LAYER_TRANSFORM,
  layerGeometry,
  STICKER_IMAGE_APPEARANCE,
  type AssetLayerId,
  type CanvasLayerId,
  type CompositionAsset,
  type CompositionEffectLayer,
  type CompositionLayerId,
  type CompositionLogoLayer,
  type CompositionShaderLayer,
  type CompositionTextLayer,
  type ContentLayerId,
  type EffectLayerId,
  type LogoLayerId,
  type ShaderApplication,
  type TextAppearanceSettings,
  type TextLayerId,
} from '@/lib/designLabModel';

type SelectedTextInspector = {
  appearance: TextAppearanceSettings;
  layer: CompositionTextLayer;
  transform: CanvasLayerTransform;
};

export function InspectorTextArea({
  ariaLabel,
  onChange,
  onPreview,
  onSelection,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onSelection?: (range: TextSelectionRange) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const onPreviewRef = useCommittedRef(onPreview);
  const pendingValueRef = useRef<string | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) onChangeRef.current(nextValue);
  }

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement === input || input.value === value) return;
    input.value = value;
  }, [value]);

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  return (
    <textarea
      aria-label={ariaLabel}
      onSelect={(event) => onSelection?.({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
      defaultValue={value}
      onBlur={(event) => {
        pendingValueRef.current = event.currentTarget.value;
        flushTextChange();
      }}
      onInput={(event) => {
        pendingValueRef.current = event.currentTarget.value;
        onPreviewRef.current?.(event.currentTarget.value);
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = window.setTimeout(flushTextChange, 140);
      }}
      placeholder='Type something'
      ref={inputRef}
      rows={2}
    />
  );
}

export const PRIMARY_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'speed' | 'frequency' | 'strength' | 'detail' | 'grain' | 'brightness'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'speed', label: 'Shader speed', max: 1.5, min: 0, step: 0.01 },
  { key: 'frequency', label: 'Frequency', max: 12, min: 0.5, step: 0.1 },
  { key: 'strength', label: 'Warp', max: 1.5, min: 0, step: 0.01 },
  { key: 'detail', label: 'Detail', max: 9, min: 0.5, step: 0.1 },
  { key: 'grain', label: 'Texture', max: 100, min: 0, step: 1 },
  { key: 'brightness', label: 'Light', max: 1.6, min: 0.35, step: 0.01 },
];

export const ADVANCED_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'amplitude' | 'density' | 'rotationZ'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'amplitude', label: 'Amplitude', max: 10, min: 0, step: 0.1 },
  { key: 'density', label: 'Density', max: 2, min: 0.1, step: 0.01 },
  { key: 'rotationZ', label: 'Rotation', max: 180, min: -180, step: 1 },
];

export function ShaderZoomControl({
  onChange,
  onPreview,
  value,
}: {
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  value: number;
}) {
  const zoom = clampShaderZoom(value);
  const [sliderValue, setSliderValue] = useState(() => shaderZoomToSlider(zoom));
  const [zoomEntry, setZoomEntry] = useState(() => formatShaderZoom(zoom).slice(0, -1));
  const pendingZoomRef = useRef<number | null>(null);
  const latestZoomRef = useRef<number | null>(null);
  const zoomFrameRef = useRef(0);
  const sliderRef = useRef<HTMLInputElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const detachGestureListenersRef = useRef<(() => void) | null>(null);
  const finishGestureRef = useCommittedRef(finishGesture);
  const editingEntryRef = useRef(false);

  useEffect(() => {
    if (pointerIdRef.current === null && pendingZoomRef.current === null && zoomFrameRef.current === 0) {
      setSliderValue(shaderZoomToSlider(zoom));
      if (!editingEntryRef.current) setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
    }
  }, [zoom]);

  useEffect(() => () => {
    cancelAnimationFrame(zoomFrameRef.current);
    detachGestureListenersRef.current?.();
  }, []);

  function flushZoom() {
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = 0;
    const nextZoom = pendingZoomRef.current ?? latestZoomRef.current;
    pendingZoomRef.current = null;
    latestZoomRef.current = null;
    if (nextZoom !== null) {
      onPreview?.(nextZoom);
      flushSync(() => onChange(nextZoom));
    }
    sliderRef.current?.removeAttribute('data-canvas-preview-pending');
  }

  function finishGesture() {
    pointerIdRef.current = null;
    detachGestureListenersRef.current?.();
    detachGestureListenersRef.current = null;
    const slider = sliderRef.current;
    // Compare in slider space: log/power round trips can differ by an epsilon
    // even when the native value has not changed since the previous commit.
    if (slider && Number(slider.value) !== sliderValue) {
      const nativeZoom = shaderZoomFromSlider(Number(slider.value));
      setSliderValue(Number(slider.value));
      setZoomEntry(formatShaderZoom(nativeZoom).slice(0, -1));
      pendingZoomRef.current = nativeZoom;
      latestZoomRef.current = nativeZoom;
    }
    flushZoom();
  }

  function finishPointerGesture(event: { pointerId: number }) {
    if (event.pointerId === pointerIdRef.current) finishGesture();
  }

  function beginGesture(event: ReactPointerEvent<HTMLInputElement>) {
    if (event.button !== 0 || pointerIdRef.current !== null) return;
    pointerIdRef.current = event.pointerId;
    // Preserve WebKit's native thumb capture; finish even when release occurs
    // outside the range, without replacing the browser's drag implementation.
    const finishPointer = (event: PointerEvent) => {
      if (event.pointerId === pointerIdRef.current) finishGestureRef.current();
    };
    const finishBlur = () => finishGestureRef.current();
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
    window.addEventListener('blur', finishBlur);
    detachGestureListenersRef.current = () => {
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
      window.removeEventListener('blur', finishBlur);
    };
  }

  function scheduleZoom(nextSliderValue: number) {
    setSliderValue(nextSliderValue);
    const nextZoom = shaderZoomFromSlider(nextSliderValue);
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    pendingZoomRef.current = nextZoom;
    latestZoomRef.current = nextZoom;
    if (pointerIdRef.current === null) {
      flushZoom();
      return;
    }
    sliderRef.current?.setAttribute('data-canvas-preview-pending', 'true');
    if (zoomFrameRef.current) return;
    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = 0;
      if (pendingZoomRef.current === null) return;
      const nextZoom = pendingZoomRef.current;
      pendingZoomRef.current = null;
      (onPreview ?? onChange)(nextZoom);
    });
  }

  function applyZoom(nextValue: number) {
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = 0;
    pendingZoomRef.current = null;
    latestZoomRef.current = null;
    pointerIdRef.current = null;
    detachGestureListenersRef.current?.();
    detachGestureListenersRef.current = null;
    const nextZoom = clampShaderZoom(nextValue);
    setSliderValue(shaderZoomToSlider(nextZoom));
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    onPreview?.(nextZoom);
    flushSync(() => onChange(nextZoom));
    sliderRef.current?.removeAttribute('data-canvas-preview-pending');
  }

  function commitZoomEntry() {
    if (!editingEntryRef.current) return;
    editingEntryRef.current = false;
    const nextZoom = Number(zoomEntry);
    if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
      setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
      return;
    }
    applyZoom(nextZoom);
  }

  return (
    <div className='shader-lab-v2-range shader-lab-v2-zoom-control'>
      <StudioRangeLabel
        label='Shader zoom'
        value={(
          <span className='shader-lab-v2-zoom-value'>
            <input
              aria-label='Shader zoom value'
              inputMode='decimal'
              max={SHADER_ZOOM_MAX}
              min={SHADER_ZOOM_MIN}
              onBlur={commitZoomEntry}
              onChange={(event) => setZoomEntry(event.target.value)}
              onFocus={() => { editingEntryRef.current = true; }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  editingEntryRef.current = false;
                  setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
                  event.currentTarget.blur();
                }
              }}
              step={0.05}
              type='number'
              value={zoomEntry}
            />
            <span aria-hidden='true'>×</span>
          </span>
        )}
      />
      <div className='shader-lab-v2-zoom-input'>
        <button
          aria-label='Zoom shader out'
          disabled={zoom <= 0.1}
          onClick={() => applyZoom(stepShaderZoom(zoom, -1))}
          title='Zoom shader out'
          type='button'
        ><ZoomOut aria-hidden='true' /></button>
        <StudioRange
          aria-label='Shader zoom slider'
          max={SHADER_ZOOM_SLIDER_MAX}
          min={SHADER_ZOOM_SLIDER_MIN}
          onBlur={finishGesture}
          onChange={(event) => {
            if (event.nativeEvent.type === 'change') finishGesture();
          }}
          onInput={(event) => scheduleZoom(Number(event.currentTarget.value))}
          onLostPointerCapture={finishPointerGesture}
          onPointerCancel={finishPointerGesture}
          onPointerDown={beginGesture}
          onPointerUp={finishPointerGesture}
          ref={sliderRef}
          step={SHADER_ZOOM_SLIDER_STEP}
          value={sliderValue}
        />
        <button
          aria-label='Zoom shader in'
          disabled={zoom >= 10}
          onClick={() => applyZoom(stepShaderZoom(zoom, 1))}
          title='Zoom shader in'
          type='button'
        ><ZoomIn aria-hidden='true' /></button>
      </div>
      <div aria-hidden='true' className='shader-lab-v2-zoom-scale'>
        <span>0.1×</span><span>1×</span><span>10×</span>
      </div>
    </div>
  );
}

type EffectPreviewUpdate = { opacity?: number; settings?: Partial<CompositionEffectSettings> };
type EffectLayerUpdate = Partial<Omit<CompositionEffectLayer, 'id'>>;

/** Controls of the built-in converters; an image effect has its own. */
function ConverterControls({
  layer: selectedEffectLayer,
  previewEffectLayer,
  updateEffectLayer,
}: {
  layer: CompositionEffectLayer;
  previewEffectLayer: (id: EffectLayerId, update: EffectPreviewUpdate) => void;
  updateEffectLayer: (id: EffectLayerId, update: EffectLayerUpdate) => void;
}) {
  return <>
    <div className='shader-lab-v2-ranges'>
      <RangeControl
        formatValue={(value) => `${Math.round(value)}px`}
        label='Cell size'
        max={28}
        min={selectedEffectLayer.settings.kind === 'ascii' ? 7 : selectedEffectLayer.settings.kind === 'halftone' ? 4 : 1}
        onChange={(cellSize) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, cellSize },
        })}
        onPreview={(cellSize) => previewEffectLayer(selectedEffectLayer.id, { settings: { cellSize } })}
        step={1}
        value={selectedEffectLayer.settings.cellSize}
      />
      <RangeControl
        formatValue={(value) => `${value.toFixed(2)}×`}
        label='Contrast'
        max={2.4}
        min={0.4}
        onChange={(contrast) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, contrast },
        })}
        onPreview={(contrast) => previewEffectLayer(selectedEffectLayer.id, { settings: { contrast } })}
        step={0.02}
        value={selectedEffectLayer.settings.contrast}
      />
      <RangeControl
        formatValue={(value) => `${value >= 0.5 ? '+' : ''}${Math.round((value - 0.5) * 200)}%`}
        label='Brightness'
        max={1}
        min={0}
        onChange={(threshold) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, threshold },
        })}
        onPreview={(threshold) => previewEffectLayer(selectedEffectLayer.id, { settings: { threshold } })}
        step={0.01}
        value={selectedEffectLayer.settings.threshold}
      />
      {selectedEffectLayer.settings.kind === 'posterize' ? (
        <RangeControl
          formatValue={(value) => `${Math.round(value)} tones`}
          label='Tone count'
          max={8}
          min={2}
          onChange={(levels) => updateEffectLayer(selectedEffectLayer.id, {
            settings: { ...selectedEffectLayer.settings, levels },
          })}
          onPreview={(levels) => previewEffectLayer(selectedEffectLayer.id, { settings: { levels } })}
          step={1}
          value={selectedEffectLayer.settings.levels}
        />
      ) : null}
    </div>
    <div className='shader-lab-v2-effect-colors'>
      <ColorControl
        ariaLabel='Converter foreground color'
        label='Foreground'
        onChange={(foreground) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, foreground },
        })}
        onPreview={(foreground) => previewEffectLayer(selectedEffectLayer.id, { settings: { foreground } })}
        value={selectedEffectLayer.settings.foreground}
      />
      <ColorControl
        ariaLabel='Converter background color'
        label='Background'
        onChange={(background) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, background },
        })}
        onPreview={(background) => previewEffectLayer(selectedEffectLayer.id, { settings: { background } })}
        value={selectedEffectLayer.settings.background}
      />
    </div>
    <div className='shader-lab-v2-effect-group'>
      <label>
        <span>Invert luminance</span>
        <StudioCheckbox
          checked={selectedEffectLayer.settings.invert}
          onChange={(event) => updateEffectLayer(selectedEffectLayer.id, {
            settings: { ...selectedEffectLayer.settings, invert: event.target.checked },
          })}
        />
      </label>
    </div>
  </>;
}

export const DesignLabEffectInspector = memo(function DesignLabEffectInspector({
  imageEffectStatusStore,
  previewEffectLayer,
  selectEffectPreset,
  selectImageEffect,
  selectedEffectLayer,
  updateEffectLayer,
}: {
  imageEffectStatusStore: DesignLabImageEffectStatusStore;
  previewEffectLayer: (id: EffectLayerId, update: EffectPreviewUpdate) => void;
  selectEffectPreset: (layer: CompositionEffectLayer, kind: CompositionEffectKind) => void;
  selectImageEffect: (layer: CompositionEffectLayer, effectId: DesignLabImageEffectId) => void;
  selectedEffectLayer: CompositionEffectLayer;
  updateEffectLayer: (id: EffectLayerId, update: EffectLayerUpdate) => void;
}) {
  const imageEffect = designLabImageEffect(selectedEffectLayer.settings.effectId);
  return <>
  <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-effect-inspector' meta='Post-process' title='Converter'>
    <div className='shader-lab-v2-effect-presets' aria-label='Converter type'>
      {COMPOSITION_EFFECT_PRESETS.map((preset) => (
        <button
          aria-pressed={!imageEffect && selectedEffectLayer.settings.kind === preset.kind}
          key={preset.kind}
          onClick={() => selectEffectPreset(selectedEffectLayer, preset.kind)}
          type='button'
        >
          <CompositionEffectThumbnail kind={preset.kind} />
          <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
        </button>
      ))}
    </div>
    <div className='shader-lab-v2-ranges'>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateEffectLayer(selectedEffectLayer.id, { opacity })}
        onPreview={(opacity) => previewEffectLayer(selectedEffectLayer.id, { opacity })}
        step={0.01}
        value={selectedEffectLayer.opacity}
      />
    </div>
    {imageEffect ? null : (
      <ConverterControls layer={selectedEffectLayer} previewEffectLayer={previewEffectLayer} updateEffectLayer={updateEffectLayer} />
    )}
  </LabInspectorSection>
  {imageEffect ? (
    <LabInspectorSection className='shader-lab-v2-control-section' meta={imageEffect.name} title='Effect settings'>
      <DesignLabImageEffectNotice layerId={selectedEffectLayer.id} store={imageEffectStatusStore} />
      <ShaderEffectsControls
        layerSource
        materialId={imageEffect.id}
        onChange={(effectProps) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, effectProps },
        })}
        palette={DEFAULT_LIVE_MATERIAL_SETTINGS}
        value={selectedEffectLayer.settings.effectProps}
      />
    </LabInspectorSection>
  ) : null}
  <LabInspectorSection className='shader-lab-v2-control-section' meta='Shaders.com · WebGPU' title='Image effects'>
    <DesignLabEffectPicker
      onSelect={(effectId) => selectImageEffect(selectedEffectLayer, effectId)}
      selectedEffectId={imageEffect?.id}
    />
  </LabInspectorSection>
  </>;
});

export type TextAppearancePreviewPatch = Partial<Omit<TextAppearanceSettings, 'textEffect'>> & {
  textEffect?: Partial<TextEffectSettings>;
};

export const IMAGE_CROP_ASPECT_OPTIONS = [
  { label: 'Freeform', value: 'freeform' },
  { label: 'Square · 1:1', value: '1' },
  { label: 'Landscape · 4:3', value: '1.333333' },
  { label: 'Widescreen · 16:9', value: '1.777778' },
  { label: 'Portrait · 3:4', value: '0.75' },
  { label: 'Story · 9:16', value: '0.5625' },
] as const;

export function imageCropAspectValue(transform: CanvasLayerTransform, geometry: CanvasLayerGeometry): string {
  const { height, width } = canvasLayerDimensions(transform, geometry);
  const ratio = width / Math.max(height, 0.001);
  return IMAGE_CROP_ASPECT_OPTIONS.find(({ value }) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && Math.abs(ratio - numeric) < 0.012;
  })?.value ?? 'freeform';
}

export const DesignLabAssetLayerInspector = memo(function DesignLabAssetLayerInspector({
  appearance,
  asset,
  cropAspect,
  cropEditing,
  onCropAspectChange,
  onCropEditingChange,
  previewAppearance,
  previewImageCrop,
  previewOpacity,
  previewStickerFinish,
  updateAsset,
}: {
  appearance: LogoAppearanceSettings;
  asset: CompositionAsset;
  cropAspect: string;
  cropEditing: boolean;
  onCropAspectChange: (value: string) => void;
  onCropEditingChange: (editing: boolean) => void;
  previewAppearance: (patch: Partial<LogoAppearanceSettings>) => void;
  previewImageCrop: (patch: Partial<ImageCropSettings>) => void;
  previewOpacity: (value: number) => void;
  previewStickerFinish: (patch: Partial<StickerFinishSettings>) => void;
  updateAsset: (update: Partial<Omit<CompositionAsset, 'id'>>) => void;
}) {
  const sticker = asset.kind === 'sticker';
  const crop = normalizeImageCropSettings(asset.imageCrop);
  const finish = normalizeStickerFinish(asset.stickerFinish);
  const updateFinish = (patch: Partial<StickerFinishSettings>) => updateAsset({
    stickerFinish: normalizeStickerFinish({ ...finish, ...patch }),
  });

  return (
    <div aria-label={sticker ? 'Sticker appearance' : 'Image appearance'} className='shader-lab-v2-layer-settings' role='group'>
      <div className='shader-lab-v2-layer-settings-heading'>
        <strong>{sticker ? 'Sticker appearance' : 'Image appearance'}</strong>
        <span>{sticker ? 'Die-cut layer' : 'Non-destructive'}</span>
      </div>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateAsset({ opacity })}
        onPreview={previewOpacity}
        step={0.01}
        value={asset.opacity ?? 1}
      />

      <div className='shader-lab-v2-image-crop-panel'>
        <label className='shader-lab-v2-effect-toggle'>
          <span>
            <strong><Crop aria-hidden='true' />Crop to frame</strong>
            <small>Resize the layer frame without squeezing the image.</small>
          </span>
          <StudioCheckbox
            aria-label='Crop image to frame'
            checked={crop.enabled}
            onChange={(event) => {
              const enabled = event.target.checked;
              if (!enabled) onCropEditingChange(false);
              updateAsset({ imageCrop: { ...crop, enabled } });
            }}
            variant='switch'
          />
        </label>
        {crop.enabled ? (
          <div className='shader-lab-v2-image-crop-controls'>
            <div className='shader-lab-v2-image-crop-actions'>
              <Button onClick={() => onCropEditingChange(!cropEditing)} size='sm' type='button' variant={cropEditing ? 'secondary' : 'outline'}>
                {cropEditing ? <Check aria-hidden='true' /> : <Crop aria-hidden='true' />}{cropEditing ? 'Finish cropping' : 'Edit crop on canvas'}
              </Button>
              <Button onClick={() => updateAsset({ imageCrop: { ...DEFAULT_IMAGE_CROP, enabled: true } })} size='sm' type='button' variant='ghost'>
                <Frame aria-hidden='true' />Fill frame
              </Button>
              <Button onClick={() => { onCropEditingChange(false); updateAsset({ imageCrop: { ...crop, enabled: false } }); }} size='sm' type='button' variant='ghost'>
                <ImageDown aria-hidden='true' />Fit image
              </Button>
              <Button onClick={() => onCropAspectChange('original')} size='sm' type='button' variant='ghost'>
                <FileImage aria-hidden='true' />Original ratio
              </Button>
            </div>
            <label className='shader-lab-v2-field'>
              <span>Crop aspect</span>
              <StudioSelect
                ariaLabel='Crop aspect ratio'
                onValueChange={onCropAspectChange}
                options={[...IMAGE_CROP_ASPECT_OPTIONS]}
                value={cropAspect}
              />
            </label>
            <RangeControl
              formatValue={(value) => `${Math.round(value * 100)}%`}
              label='Crop zoom'
              max={4}
              min={1}
              onChange={(zoom) => updateAsset({ imageCrop: { ...crop, zoom } })}
              onPreview={(zoom) => previewImageCrop({ zoom })}
              step={0.01}
              value={crop.zoom}
            />
            <RangeControl
              formatValue={(value) => `${Math.round(value * 100)}%`}
              label='Horizontal focus'
              max={1}
              min={0}
              onChange={(focalPointX) => updateAsset({ imageCrop: { ...crop, focalPointX } })}
              onPreview={(focalPointX) => previewImageCrop({ focalPointX })}
              step={0.01}
              value={crop.focalPointX}
            />
            <RangeControl
              formatValue={(value) => `${Math.round(value * 100)}%`}
              label='Vertical focus'
              max={1}
              min={0}
              onChange={(focalPointY) => updateAsset({ imageCrop: { ...crop, focalPointY } })}
              onPreview={(focalPointY) => previewImageCrop({ focalPointY })}
              step={0.01}
              value={crop.focalPointY}
            />
            <Button
              onClick={() => updateAsset({ imageCrop: { ...DEFAULT_IMAGE_CROP, enabled: true } })}
              size='sm'
              type='button'
              variant='ghost'
            >
              <RotateCcw aria-hidden='true' />Reset crop
            </Button>
          </div>
        ) : null}
      </div>

      {sticker ? (
        <div className='shader-lab-v2-sticker-finish-panel'>
          <div className='shader-lab-v2-sticker-finish-heading'>
            <span><Sparkles aria-hidden='true' /><strong>Surface finish</strong></span>
            <small>{STICKER_FINISH_PRESETS.length} finishes</small>
          </div>
          <div aria-label='Sticker surface finish' className='shader-lab-v2-sticker-finish-presets' role='group'>
            {STICKER_FINISH_PRESETS.map((preset) => (
              <button
                aria-pressed={finish.presetId === preset.id}
                key={preset.id}
                onClick={() => updateAsset({ stickerFinish: { ...preset.settings } })}
                title={preset.description}
                type='button'
              >
                <span aria-hidden='true' style={{ background: preset.swatch }} />
                <strong>{preset.label}</strong>
              </button>
            ))}
          </div>
          <div className='shader-lab-v2-sticker-finish-controls'>
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Shine' max={100} min={0} onChange={(intensity) => updateFinish({ intensity })} onPreview={(intensity) => previewStickerFinish({ intensity })} step={1} value={finish.intensity} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Texture' max={100} min={0} onChange={(texture) => updateFinish({ texture })} onPreview={(texture) => previewStickerFinish({ texture })} step={1} value={finish.texture} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Relief' max={100} min={0} onChange={(relief) => updateFinish({ relief })} onPreview={(relief) => previewStickerFinish({ relief })} step={1} value={finish.relief} />
            <RangeControl formatValue={(value) => `${Math.round(value)}°`} label='Glint angle' max={180} min={0} onChange={(glintAngle) => updateFinish({ glintAngle })} onPreview={(glintAngle) => previewStickerFinish({ glintAngle })} step={1} value={finish.glintAngle} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Depth' max={100} min={0} onChange={(depth) => updateFinish({ depth })} onPreview={(depth) => previewStickerFinish({ depth })} step={1} value={finish.depth} />
          </div>
        </div>
      ) : null}

      <LogoAppearanceControls
        kind={sticker ? 'sticker' : 'image'}
        onChange={(patch) => updateAsset({ appearance: { ...appearance, ...patch } })}
        onPreview={previewAppearance}
        settings={appearance}
      />
      {!sticker ? (
        <Button
          onClick={() => updateAsset({
            appearance: { ...STICKER_IMAGE_APPEARANCE },
            kind: 'sticker',
            stickerFinish: { ...DEFAULT_STICKER_FINISH },
          })}
          size='sm'
          type='button'
          variant='outline'
        >
          <Sticker aria-hidden='true' />Make sticker
        </Button>
      ) : null}
    </div>
  );
});

function textInspectorRange(selection: SelectedTextInspector, range: TextSelectionRange | null) {
  const { layer, appearance } = selection;
  const segments = textStyleSegments(layer.value, layer.runs).filter((run) => !range || (run.start < range.end && run.end > range.start));
  const style = range ? segments[0]?.style ?? {} : {};
  return {
    selectedTextLayer: { ...layer, ...style },
    selectedTextAppearance: { ...appearance, ...style },
    mixedFormatting: segments.some((run) => INLINE_TEXT_KEYS.some((key) => (run.style[key] ?? layer[key]) !== (segments[0].style[key] ?? layer[key]))),
  };
}

function DesignLabTextStyleButtons({ layer, weight, boldAvailable, onChange }: {
  layer: CompositionTextLayer; weight: number; boldAvailable: boolean;
  onChange: (patch: InlineTextStyle) => void;
}) {
  return <div className='shader-lab-v2-text-options'>
    <span>Style</span>
    <div>
      <button aria-label='Bold text' aria-pressed={weight >= 600} disabled={!boldAvailable}
        onClick={() => onChange({ weight: weight >= 600 ? 400 : 700 })}
        title={boldAvailable ? 'Bold' : 'This font does not include regular and bold weights'} type='button'><TextB aria-hidden='true' /></button>
      <button aria-label='Italic text' aria-pressed={layer.fontStyle === 'italic'}
        onClick={() => onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })}
        title='Italic' type='button'><TextItalic aria-hidden='true' /></button>
      <button aria-label='Underline text' aria-pressed={layer.underline === true}
        onClick={() => onChange({ underline: !layer.underline })}
        title='Underline' type='button'><TextUnderline aria-hidden='true' /></button>
      <button aria-label='Strikethrough text' aria-pressed={layer.strikethrough === true}
        onClick={() => onChange({ strikethrough: !layer.strikethrough })}
        title='Strikethrough' type='button'><TextStrikethrough aria-hidden='true' /></button>
    </div>
  </div>;
}

function TextSelectionScope({ range, mixed, onClear }: { range: TextSelectionRange | null; mixed: boolean; onClear: () => void }) {
  return <div className='mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground' data-canvas-selection-preserve>
    <span role='status'>{range ? `Selected text · ${range.end - range.start} characters` : 'Whole text box'}{mixed ? ' · Mixed formatting' : ''}</span>
    {range ? <Button onClick={onClear} size='sm' variant='ghost'>Whole text box</Button> : null}
  </div>;
}

export const DesignLabTextLayerInspector = memo(function DesignLabTextLayerInspector({
  canvasHeight,
  canvasWidth,
  identity,
  previewSelectedContentOpacity,
  previewSelectedTextAppearance,
  previewSelectedTextLayer,
  previewSelectedTextWidth,
  selectedCanvasLayerCount,
  selection,
  stageRef,
  textRenderedWeight,
  textWeightRange,
  updateTextLayer,
  updateTextBox,
  textRange,
  clearTextRange,
  onTextSelection,
}: {
  textRange: TextSelectionRange | null;
  clearTextRange: () => void;
  onTextSelection: (range: TextSelectionRange) => void;
  canvasHeight: number;
  canvasWidth: number;
  identity: BrandIdentity;
  previewSelectedContentOpacity: (value: number) => void;
  previewSelectedTextAppearance: (patch: TextAppearancePreviewPatch) => void;
  previewSelectedTextLayer: (update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
  previewSelectedTextWidth: (value: number) => void;
  selectedCanvasLayerCount: number;
  selection: SelectedTextInspector;
  stageRef: RefObject<HTMLDivElement | null>;
  textRenderedWeight: number;
  textWeightRange: { max: number; min: number };
  updateTextLayer: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
  updateTextBox: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
}) {
  const {
    layer: baseLayer,
    transform: selectedTextTransform,
  } = selection;
  const { selectedTextLayer, selectedTextAppearance, mixedFormatting } = textInspectorRange(selection, textRange);
  const resolvedWeight = resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, selectedTextLayer.weight);
  const rangeWeightBounds = brandTypographyWeightRange(identity, selectedTextAppearance.fontRole);
  return <>
    <TextSelectionScope range={textRange} mixed={mixedFormatting} onClear={clearTextRange} />
    <label className='shader-lab-v2-text-input'>
      <Type aria-hidden='true' />
      <InspectorTextArea
        ariaLabel={`${selectedTextLayer.name} content`}
        onSelection={onTextSelection}
        onChange={(value) => updateTextLayer(selectedTextLayer.id, { value })}
        onPreview={(value) => {
          if (baseLayer.runs?.length) return;
          const text = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerCount)
            ?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
          if (text) text.innerText = value;
          previewSelectedTextLayer({ value });
        }}
        value={selectedTextLayer.value}
      />
    </label>
    <div aria-label='Typography' className='shader-lab-v2-text-controls'>
      <label className='shader-lab-v2-field'>
        <span>Brand font</span>
        <StudioSelect
          ariaLabel='Text font role'
          onValueChange={(fontRole) => {
            const nextRole = fontRole as BrandTypography['role'];
            updateTextLayer(selectedTextLayer.id, {
              fontRole: nextRole,
              weight: resolveBrandTypographyWeight(
                identity,
                nextRole,
                brandTypographyRole(identity, nextRole).weight ?? selectedTextLayer.weight
              ),
            });
          }}
          options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({
            label: `${role} · ${brandTypographyFamily(identity, role).replace(/^Glyphfield Project [\da-f]+(?:-[\da-f]+)*:: /, '')}`,
            value: role,
          }))}
          value={selectedTextAppearance.fontRole}
        />
      </label>
      <ColorControl
        ariaLabel='Text color'
        label='Text color'
        onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
        onPreview={textRange ? undefined : (color) => previewSelectedTextAppearance({ color })}
        value={selectedTextAppearance.color}
      />
      <div className='shader-lab-v2-text-options'>
        <span>Wrap</span>
        <div>
          {(['wrap', 'nowrap'] as const).map((value) => (
            <button
              aria-pressed={selectedTextLayer.wrap === value}
              key={value}
              onClick={() => updateTextLayer(selectedTextLayer.id, { wrap: value })}
              title={value === 'wrap' ? 'Wrap text' : 'Keep text on one line'}
              type='button'
            >
              {value === 'wrap' ? <WrapText aria-hidden='true' /> : <ArrowRight aria-hidden='true' />}
              <span>{value === 'wrap' ? 'Wrap' : 'Single line'}</span>
            </button>
          ))}
        </div>
      </div>
      <div className='shader-lab-v2-text-options'>
        <span>Align</span>
        <div>
          {(['left', 'center', 'right'] as const).map((value) => (
            <button
              aria-label={`${value[0]!.toUpperCase()}${value.slice(1)} align text`}
              aria-pressed={selectedTextLayer.align === value}
              key={value}
              onClick={() => updateTextLayer(selectedTextLayer.id, { align: value })}
              title={`${value[0]!.toUpperCase()}${value.slice(1)} align`}
              type='button'
            >
              {value === 'left' ? <AlignLeft aria-hidden='true' /> : value === 'right' ? <AlignRight aria-hidden='true' /> : <AlignCenter aria-hidden='true' />}
            </button>
          ))}
        </div>
      </div>
      <DesignLabTextStyleButtons layer={selectedTextLayer} weight={resolvedWeight}
        boldAvailable={rangeWeightBounds.max >= 600 && rangeWeightBounds.min < 600}
        onChange={(patch) => updateTextLayer(selectedTextLayer.id, patch)} />
      <StudioFontSizeControl
        key={selectedTextLayer.id}
        onChange={(size) => updateTextLayer(selectedTextLayer.id, designLabFontSizeUpdate(selectedTextLayer, size))}
        onPreview={(size) => {
          if (textRange) return;
          previewSelectedTextStyle(
            stageRef.current,
            selectedCanvasLayerCount,
            'fontSize',
            `${size / canvasWidth * 100}cqw`
          );
          previewSelectedTextLayer(designLabFontSizeUpdate(selectedTextLayer, size));
        }}
        value={resolveDesignLabFontSize(selectedTextLayer, canvasHeight)}
      />
      <RangeControl
        formatValue={(value) => String(Math.round(value))}
        label='Font weight'
        max={textRange ? rangeWeightBounds.max : textWeightRange.max}
        min={textRange ? rangeWeightBounds.min : textWeightRange.min}
        onChange={(weight) => updateTextLayer(selectedTextLayer.id, {
          weight: resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, weight),
        })}
        onPreview={(weight) => {
          if (textRange) return;
          const resolvedWeight = resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, weight);
          previewSelectedTextStyle(stageRef.current, selectedCanvasLayerCount, 'fontWeight', String(resolvedWeight));
          previewSelectedTextLayer({ weight: resolvedWeight });
        }}
        step={textWeightRange.max - textWeightRange.min <= 100 ? 100 : 50}
        value={textRange ? resolvedWeight : textRenderedWeight}
      />
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Text box width'
        max={3}
        min={0.25}
        onChange={(widthScale) => updateTextLayer(selectedTextLayer.id, {
          transform: { ...selectedTextTransform, widthScale },
        })}
        onPreview={previewSelectedTextWidth}
        step={0.05}
        value={selectedTextTransform.widthScale ?? 1}
      />
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateTextLayer(selectedTextLayer.id, { opacity })}
        onPreview={previewSelectedContentOpacity}
        step={0.01}
        value={selectedTextAppearance.opacity}
      />
      <RangeControl
        formatValue={(value) => value.toFixed(2)}
        label='Line height'
        max={1.8}
        min={0.7}
        onChange={(lineHeight) => updateTextLayer(selectedTextLayer.id, { lineHeight })}
        onPreview={(lineHeight) => {
          previewSelectedTextStyle(stageRef.current, selectedCanvasLayerCount, 'lineHeight', String(lineHeight));
          previewSelectedTextLayer({ lineHeight });
        }}
        step={0.05}
        value={selectedTextLayer.lineHeight}
      />
      <RangeControl
        formatValue={(value) => `${value.toFixed(2)}em`}
        label='Tracking'
        max={0.2}
        min={-0.12}
        onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })}
        onPreview={(tracking) => {
          if (textRange) return;
          previewSelectedTextStyle(stageRef.current, selectedCanvasLayerCount, 'letterSpacing', `${tracking}em`);
          previewSelectedTextLayer({ tracking });
        }}
        step={0.01}
        value={selectedTextLayer.tracking}
      />
      <div className='shader-lab-v2-text-effects-panel'>
        <div className='shader-lab-v2-text-effects-heading'>
          <span><WandSparkles aria-hidden='true' />Text effects</span>
          <small>Glyph fill</small>
        </div>
        <div aria-label='Text effect presets' className='shader-lab-v2-text-effect-presets'>
          {TEXT_EFFECT_PRESETS.map((preset) => (
            <button
              aria-pressed={selectedTextAppearance.textEffect.kind === preset.settings.kind}
              key={preset.settings.kind}
              onClick={() => updateTextLayer(selectedTextLayer.id, { textEffect: { ...preset.settings } })}
              title={preset.description}
              type='button'
            >
              <TextEffectThumbnail settings={preset.settings} />
              <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </button>
          ))}
        </div>
        {selectedTextAppearance.textEffect.kind !== 'solid' ? (
          <div className='shader-lab-v2-text-effect-tuning'>
            <div className='shader-lab-v2-effect-colors'>
              <ColorControl
                ariaLabel='Text effect foreground color'
                label='Foreground'
                onChange={(color) => updateTextBox(selectedTextLayer.id, { color })}
                onPreview={(color) => previewSelectedTextAppearance({ color })}
                value={selection.appearance.color}
              />
              <ColorControl
                ariaLabel='Text effect background color'
                label='Background'
                onChange={(backgroundColor) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, backgroundColor },
                })}
                onPreview={(backgroundColor) => previewSelectedTextAppearance({ textEffect: { backgroundColor } })}
                value={selectedTextAppearance.textEffect.backgroundColor}
              />
            </div>
            {selectedTextAppearance.textEffect.kind !== 'gradient' ? <>
              <RangeControl
                formatValue={(value) => `${Math.round(value)}%`}
                label='Effect strength'
                max={100}
                min={0}
                onChange={(amount) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, amount },
                })}
                onPreview={(amount) => previewSelectedTextAppearance({ textEffect: { amount } })}
                step={1}
                value={selectedTextAppearance.textEffect.amount}
              />
              <RangeControl
                formatValue={(value) => `${Math.round(value)}px`}
                label='Pattern scale'
                max={36}
                min={4}
                onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, scale },
                })}
                onPreview={(scale) => previewSelectedTextAppearance({ textEffect: { scale } })}
                step={1}
                value={selectedTextAppearance.textEffect.scale}
              />
            </> : null}
            {selectedTextAppearance.textEffect.kind !== 'halftone' ? (
              <RangeControl
                formatValue={(value) => `${Math.round(value)}°`}
                label='Effect angle'
                max={180}
                min={-180}
                onChange={(angle) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, angle },
                })}
                onPreview={(angle) => previewSelectedTextAppearance({ textEffect: { angle } })}
                step={1}
                value={selectedTextAppearance.textEffect.angle}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className='shader-lab-v2-effect-group'>
        <label><span>Text outline</span><StudioCheckbox checked={selectedTextAppearance.outlineEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} /></label>
        {selectedTextAppearance.outlineEnabled ? <>
          <ColorControl ariaLabel='Text outline color' label='Outline color' onChange={(outlineColor) => updateTextLayer(selectedTextLayer.id, { outlineColor })} onPreview={(outlineColor) => previewSelectedTextAppearance({ outlineColor })} value={selectedTextAppearance.outlineColor} />
          <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} onPreview={(outlineWidth) => previewSelectedTextAppearance({ outlineWidth })} step={0.5} value={selectedTextAppearance.outlineWidth} />
        </> : null}
      </div>
      <div className='shader-lab-v2-effect-group'>
        <label><span>Text shadow</span><StudioCheckbox checked={selectedTextAppearance.shadowEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} /></label>
        {selectedTextAppearance.shadowEnabled ? <>
          <ColorControl ariaLabel='Text shadow color' label='Shadow color' onChange={(shadowColor) => updateTextLayer(selectedTextLayer.id, { shadowColor })} onPreview={(shadowColor) => previewSelectedTextAppearance({ shadowColor })} value={selectedTextAppearance.shadowColor} />
          <RangeControl label='Shadow blur' max={64} min={0} onChange={(shadowBlur) => updateTextLayer(selectedTextLayer.id, { shadowBlur })} onPreview={(shadowBlur) => previewSelectedTextAppearance({ shadowBlur })} step={1} value={selectedTextAppearance.shadowBlur} />
          <RangeControl label='Shadow X' max={48} min={-48} onChange={(shadowOffsetX) => updateTextLayer(selectedTextLayer.id, { shadowOffsetX })} onPreview={(shadowOffsetX) => previewSelectedTextAppearance({ shadowOffsetX })} step={1} value={selectedTextAppearance.shadowOffsetX} />
          <RangeControl label='Shadow Y' max={48} min={-48} onChange={(shadowOffsetY) => updateTextLayer(selectedTextLayer.id, { shadowOffsetY })} onPreview={(shadowOffsetY) => previewSelectedTextAppearance({ shadowOffsetY })} step={1} value={selectedTextAppearance.shadowOffsetY} />
          <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Shadow opacity' max={100} min={0} onChange={(shadowOpacity) => updateTextLayer(selectedTextLayer.id, { shadowOpacity })} onPreview={(shadowOpacity) => previewSelectedTextAppearance({ shadowOpacity })} step={1} value={selectedTextAppearance.shadowOpacity} />
        </> : null}
      </div>
    </div>
  </>;
});

export const DesignLabShaderInspector = memo(function DesignLabShaderInspector({
  brandPalette,
  editingShader,
  initialSettings,
  material,
  previewSelectedShaderOpacity,
  previewSelectedShaderSize,
  previewSelectedShaderSetting,
  settings,
  shaderSize,
  updateSelectedShader,
  updateSetting,
}: {
  brandPalette: ReturnType<typeof brandMaterialPalette>;
  editingShader: ShaderApplication;
  initialSettings: LiveMaterialSettings;
  material: LiveMaterialOption;
  previewSelectedShaderOpacity: (value: number) => void;
  previewSelectedShaderSize: (value: number) => void;
  previewSelectedShaderSetting: <Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) => void;
  settings: LiveMaterialSettings;
  shaderSize: number;
  updateSelectedShader: (update: Partial<ShaderApplication>) => void;
  updateSetting: <Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) => void;
}) {
  return <>
    <LabInspectorSection className='shader-lab-v2-control-section' meta={material.name} title='Shader color'>
      <div className='shader-lab-v2-colors'>
        {([
          { key: 'colorA', label: 'Base color' },
          { key: 'colorB', label: 'Mid color' },
          { key: 'colorC', label: 'Light color' },
        ] as const).map(({ key, label }) => (
          <ColorControl
            ariaLabel={`Shader ${label.toLowerCase()}`}
            key={key}
            label={label}
            onChange={(color) => updateSetting(key, color)}
            onPreview={(color) => previewSelectedShaderSetting(key, color)}
            value={settings[key]}
          />
        ))}
      </div>
      <div className='shader-lab-v2-palettes'>
        {[brandPalette, ...LIVE_MATERIAL_PALETTES.slice(0, 7)].map((palette) => (
          <button
            aria-label={`Apply ${palette.name} palette`}
            key={palette.id}
            onClick={() => updateSelectedShader({
              settings: {
                ...settings,
                colorA: palette.colors[0],
                colorB: palette.colors[1],
                colorC: palette.colors[2],
              },
            })}
            title={palette.name}
            type='button'
          >
            {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
          </button>
        ))}
      </div>
      <div className='shader-lab-v2-shader-meta'>
        <button
          onClick={() => updateSelectedShader({
            settings: shaderLabSettingsFor(editingShader.materialId, initialSettings),
            shaderSize: 1,
          })}
          type='button'
        ><RotateCcw aria-hidden='true' />Reset shader</button>
        {material.sourceUrl ? (
          <a href={material.sourceUrl} rel='noreferrer' target='_blank'>{material.sourceLabel ?? 'View source'}<ExternalLink aria-hidden='true' /></a>
        ) : null}
      </div>
    </LabInspectorSection>

    {getShaderEffect(editingShader.materialId) ? <LabInspectorSection className='shader-lab-v2-control-section' meta={material.name} title='Effect settings'><ShaderEffectsControls materialId={editingShader.materialId} palette={settings} value={settings.effectProps} onChange={(effectProps) => updateSetting('effectProps', effectProps)} /></LabInspectorSection> : null}

    <LabInspectorSection className='shader-lab-v2-control-section' meta='Essentials' title='Shader settings'>
      <div className='shader-lab-v2-ranges'>
        <ShaderZoomControl
          onChange={(value) => updateSelectedShader({ shaderSize: value })}
          onPreview={previewSelectedShaderSize}
          value={shaderSize}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Layer opacity'
          max={1}
          min={0}
          onChange={(value) => updateSelectedShader({ opacity: value })}
          onPreview={previewSelectedShaderOpacity}
          step={0.01}
          value={editingShader.opacity}
        />
        <div className='shader-lab-v2-text-options'>
          <span>Blend</span>
          <div>
            {(['normal', 'screen', 'overlay', 'multiply'] as const).map((value) => (
              <button
                aria-label={`Blend mode: ${value}`}
                aria-pressed={editingShader.blendMode === value}
                key={value}
                onClick={() => updateSelectedShader({ blendMode: value })}
                type='button'
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {isPaperLiveMaterialId(editingShader.materialId) ? <>
          <RangeControl
            formatValue={(value) => `${Math.round(value * 100)}%`}
            label='Center X'
            max={1}
            min={0}
            onChange={(value) => updateSetting('centerX', value)}
            onPreview={(value) => previewSelectedShaderSetting('centerX', value)}
            step={0.01}
            value={settings.centerX ?? 0.5}
          />
          <RangeControl
            formatValue={(value) => `${Math.round(value * 100)}%`}
            label='Center Y'
            max={1}
            min={0}
            onChange={(value) => updateSetting('centerY', value)}
            onPreview={(value) => previewSelectedShaderSetting('centerY', value)}
            step={0.01}
            value={settings.centerY ?? 0.5}
          />
        </> : null}
        {PRIMARY_CONTROLS.filter((control) => !getShaderEffect(editingShader.materialId) || control.key === 'speed').map((control) => (
          <RangeControl
            {...control}
            formatValue={control.key === 'speed' ? (value) => `${value.toFixed(2)}×` : undefined}
            key={control.key}
            onChange={(value) => updateSetting(control.key, value)}
            onPreview={(value) => previewSelectedShaderSetting(control.key, value)}
            value={settings[control.key]}
          />
        ))}
      </div>
    </LabInspectorSection>
  </>;
});

export const DesignLabShaderFrameInspector = memo(function DesignLabShaderFrameInspector({
  canvasHeight,
  canvasWidth,
  layer,
  onChange,
}: {
  canvasHeight: number;
  canvasWidth: number;
  layer: CompositionShaderLayer;
  onChange: (transform: CanvasLayerTransform) => void;
}) {
  const transform = normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM);
  const widthScale = transform.widthScale ?? transform.scale;
  const heightScale = transform.heightScale ?? transform.scale;
  return (
    <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-shader-frame' meta='Canvas bounds' title='Shader frame'>
      <p>Drag the shader directly on the canvas, or use exact position and size controls.</p>
      <div className='shader-lab-v2-ranges'>
        <RangeControl
          formatValue={(value) => `${Math.round(value)} px`}
          label='Horizontal position'
          max={canvasWidth}
          min={-canvasWidth}
          onChange={(x) => onChange({ ...transform, x })}
          step={1}
          value={transform.x}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value)} px`}
          label='Vertical position'
          max={canvasHeight}
          min={-canvasHeight}
          onChange={(y) => onChange({ ...transform, y })}
          step={1}
          value={transform.y}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Frame width'
          max={3}
          min={MIN_CANVAS_LAYER_SCALE}
          onChange={(widthScale) => onChange({ ...transform, widthScale })}
          step={0.01}
          value={widthScale}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Frame height'
          max={3}
          min={MIN_CANVAS_LAYER_SCALE}
          onChange={(heightScale) => onChange({ ...transform, heightScale })}
          step={0.01}
          value={heightScale}
        />
      </div>
      <Button onClick={() => onChange({ ...DEFAULT_LAYER_TRANSFORM })} size='sm' type='button' variant='outline'>
        <RotateCcw aria-hidden='true' />Fit shader to canvas
      </Button>
    </LabInspectorSection>
  );
});

export type DesignLabTextSelection = TextSelectionRange & { layerId: TextLayerId };

export type DesignLabInspectorArtboard = {
  id: string;
  layerCount: number;
  name: string;
  sizeLabel: string;
};

export type DesignLabInspectorActions = {
  activateArtboard: (id: string) => void;
  addArtboard: (duplicate: boolean) => void;
  addBrandMarkLayer: () => void;
  addCanvasShader: () => void;
  addEffectLayer: () => void;
  addTextLayer: () => void;
  arrangeArtboards: () => void;
  clearTextRange: () => void;
  copySetup: () => void;
  openImageImport: (placementMode: 'image' | 'sticker') => void;
  previewCanvasBackground: (color: string) => void;
  previewEffectLayer: (id: EffectLayerId, update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }) => void;
  previewSelectedContentOpacity: (value: number) => void;
  previewSelectedImageCrop: (patch: Partial<ImageCropSettings>) => void;
  previewSelectedLogoAppearance: (patch: Partial<LogoAppearanceSettings>, logoColor?: string) => void;
  previewSelectedShaderOpacity: (value: number) => void;
  previewSelectedShaderSetting: <Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) => void;
  previewSelectedShaderSize: (value: number) => void;
  previewSelectedStickerFinish: (patch: Partial<StickerFinishSettings>) => void;
  previewSelectedTextAppearance: (patch: TextAppearancePreviewPatch) => void;
  previewSelectedTextLayer: (update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
  previewSelectedTextWidth: (value: number) => void;
  rememberTextSelection: (layerId: TextLayerId, range: TextSelectionRange) => void;
  removeActiveArtboard: () => void;
  removeShaderFromSelectedContent: () => void;
  renameActiveArtboard: (name: string) => void;
  resetAssetTransform: (id: AssetLayerId) => void;
  resetLogoTransform: (id: LogoLayerId) => void;
  selectConvertedLogo: (asset: ConvertedAsset | null) => void;
  selectEffectPreset: (layer: CompositionEffectLayer, kind: CompositionEffectKind) => void;
  selectImageEffect: (layer: CompositionEffectLayer, effectId: DesignLabImageEffectId) => void;
  setImageCropAspect: (id: AssetLayerId, value: string) => void;
  setImageCropEditing: (id: AssetLayerId, editing: boolean) => void;
  toggleWorkspaceTour: () => void;
  updateActiveArtboardDimensions: (dimensions: StudioArtboardDimensions) => void;
  updateAssetLayer: (id: AssetLayerId, update: Partial<Omit<CompositionAsset, 'id'>>) => void;
  updateCanvasBackground: (color: string) => void;
  updateCanvasLayerTransform: (id: CanvasLayerId, transform: CanvasLayerTransform) => void;
  updateEffectLayer: (id: EffectLayerId, update: Partial<Omit<CompositionEffectLayer, 'id'>>) => void;
  updateLogoLayer: (id: LogoLayerId, update: Partial<Omit<CompositionLogoLayer, 'id'>>) => void;
  updateSelectedShader: (update: Partial<ShaderApplication>) => void;
  updateSetting: <Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) => void;
  updateTextFormatting: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
  updateTextLayer: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
};

/**
 * The right-hand Design Lab inspector. Memoized on the selected layer, the
 * composition summary and stable handlers, so commits that do not change what
 * it shows (history checkpoints, status messages, unselected layers) skip it.
 */
export const DesignLabInspectorPanel = memo(function DesignLabInspectorPanel({
  actions,
  activeArtboardId,
  activeArtboardRawName,
  brandPalette,
  canvasBackground,
  canvasDimensions,
  composition,
  contentKind,
  convertedAssetLibrary,
  copied,
  copyError,
  cropEditingLayerId,
  description,
  editingCanvas,
  editingShader,
  identity,
  imageEffectStatusStore,
  initialSettings,
  layerRows,
  material,
  outputArtboards,
  paused,
  selectedAssetInspector,
  selectedCanvasLayerCount,
  selectedContentLayerId,
  selectedEffectLayer,
  selectedLayerId,
  selectedLayerShader,
  selectedLogoInspector,
  selectedShaderLayer,
  selectedTextInspector,
  settings,
  shaderSize,
  stageRef,
  textRenderedWeight,
  textSelectionStore,
  textWeightRange,
  title,
  workspaceTourOpen,
}: {
  actions: DesignLabInspectorActions;
  activeArtboardId: string;
  activeArtboardRawName: string;
  brandPalette: ReturnType<typeof brandMaterialPalette>;
  canvasBackground: string;
  canvasDimensions: StudioArtboardDimensions;
  composition: {
    effectCount: number;
    listedLayerCount: number;
    logoCount: number;
    placedImageCount: number;
    savedAssetCount: number;
    shaderCount: number;
    stickerCount: number;
    textCount: number;
    visibleLayerCount: number;
    visibleShaderCount: number;
  };
  contentKind: string | null;
  convertedAssetLibrary: ConvertedAssetLibraryController;
  copied: boolean;
  copyError: string | null;
  cropEditingLayerId: AssetLayerId | null;
  description: string;
  editingCanvas: boolean;
  editingShader: ShaderApplication | null;
  identity: BrandIdentity;
  imageEffectStatusStore: DesignLabImageEffectStatusStore;
  initialSettings: LiveMaterialSettings;
  layerRows: ReactNode;
  material: LiveMaterialOption;
  outputArtboards: readonly DesignLabInspectorArtboard[];
  paused: boolean;
  selectedAssetInspector: { appearance: LogoAppearanceSettings; asset: CompositionAsset } | null;
  selectedCanvasLayerCount: number;
  selectedContentLayerId: ContentLayerId | null;
  selectedEffectLayer: CompositionEffectLayer | null;
  selectedLayerId: CompositionLayerId | null;
  selectedLayerShader: ShaderApplication | null;
  selectedLogoInspector: { appearance: LogoAppearanceSettings; layer: CompositionLogoLayer } | null;
  selectedShaderLayer: CompositionShaderLayer | null;
  selectedTextInspector: SelectedTextInspector | null;
  settings: LiveMaterialSettings;
  shaderSize: number;
  stageRef: RefObject<HTMLDivElement | null>;
  textRenderedWeight: number;
  textSelectionStore: ValueStore<DesignLabTextSelection | null>;
  textWeightRange: { max: number; min: number };
  title: string;
  workspaceTourOpen: boolean;
}) {
  const {
    previewEffectLayer,
    previewSelectedContentOpacity,
    previewSelectedImageCrop,
    previewSelectedLogoAppearance,
    previewSelectedShaderOpacity,
    previewSelectedShaderSetting,
    previewSelectedShaderSize,
    previewSelectedStickerFinish,
    previewSelectedTextAppearance,
    previewSelectedTextLayer,
    previewSelectedTextWidth,
    selectEffectPreset,
    selectImageEffect,
    updateEffectLayer,
    updateSelectedShader,
    updateSetting,
  } = actions;
  const textSelection = useValueStore(textSelectionStore);
  const selectedTextLayer = selectedTextInspector?.layer ?? null;
  const textRange = selectedTextLayer && textSelection?.layerId === selectedTextLayer.id ? textSelection : null;
  const selectedLogoLayer = selectedLogoInspector?.layer ?? null;
  const selectedAsset = selectedAssetInspector?.asset ?? null;
  return (
    <StudioSidebar className='shader-lab-v2-inspector' kind='inspector' label='Design Lab controls' side='right' storageKey='design-lab-inspector'>
      <LabPanelHeading
        className='shader-lab-v2-inspector-intro'
        description={description}
        title={title}
      />

      <ConditionalRender when={!selectedLayerId}>{() => <>
        {!editingCanvas ? <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-composition-setup design-composition-inspector' meta={`${canvasDimensions.width} × ${canvasDimensions.height}`} title='Composition'>
          <ArtboardSetupFields
            artboardName={activeArtboardRawName}
            className='design-artboard-inline-setup'
            dimensions={canvasDimensions}
            onArtboardNameChange={actions.renameActiveArtboard}
            onDimensionsChange={actions.updateActiveArtboardDimensions}
          />
          <div className='design-composition-appearance'>
            <div className='shader-lab-v2-composition-subhead'><h3>Appearance</h3><span>Active artboard</span></div>
            <ColorControl
              ariaLabel='Artboard background color'
              label='Background color'
              onChange={actions.updateCanvasBackground}
              onPreview={actions.previewCanvasBackground}
              value={canvasBackground}
            />
          </div>
          <dl className='shader-lab-v2-composition-metrics'>
            <div><dt>Layers</dt><dd>{composition.visibleLayerCount} / {composition.listedLayerCount}</dd></div>
            <div><dt>Shaders</dt><dd>{composition.visibleShaderCount}</dd></div>
            <div><dt>Motion</dt><dd>{paused ? 'Paused' : 'Live'}</dd></div>
          </dl>
        </LabInspectorSection> : <LabInspectorSection title='Canvas' meta='Loose layers'>
          <p className='design-canvas-hint'>Explore anywhere. Drag a layer into an artboard when it belongs in an output. Only artboards export; the whole canvas saves with your project.</p>
        </LabInspectorSection>}

        <LabInspectorSection className='shader-lab-v2-control-section design-artboard-inspector' meta={`${outputArtboards.length} total`} title='Artboards'>
          <div className='design-artboard-list' aria-label='Workspace artboards' role='group'>
            {outputArtboards.map((artboard, index) => (
              <button aria-pressed={artboard.id === activeArtboardId} key={artboard.id} onClick={() => actions.activateArtboard(artboard.id)} type='button'>
                <Frame aria-hidden='true' />
                <span><strong>{artboard.name}</strong><small>{artboard.sizeLabel} · {artboard.layerCount} layers</small></span>
                <i>{String(index + 1).padStart(2, '0')}</i>
              </button>
            ))}
          </div>
          <div className='design-artboard-inspector-actions'>
            <button onClick={() => actions.addArtboard(false)} type='button'><Plus aria-hidden='true' />New artboard</button>
            <button disabled={editingCanvas} onClick={() => actions.addArtboard(true)} type='button'><Copy aria-hidden='true' />Duplicate</button>
            <button onClick={actions.arrangeArtboards} type='button'><LayoutGrid aria-hidden='true' />Arrange all</button>
            <button disabled={editingCanvas} onClick={actions.removeActiveArtboard} type='button'><Trash2 aria-hidden='true' />Delete</button>
            <button aria-pressed={workspaceTourOpen} onClick={actions.toggleWorkspaceTour} type='button'><span aria-hidden='true'>?</span>Artboard guide</button>
          </div>
        </LabInspectorSection>

        <LabInspectorSection className='shader-lab-v2-control-section design-layers-inspector' meta={`${composition.listedLayerCount} total`} title='Layers'>
          <div className='shader-lab-v2-composition-subhead'><h3>Add layer</h3><span>To front</span></div>
          <div className='shader-lab-v2-composition-add' aria-label='Add composition layer' role='group'>
            <button onClick={actions.addTextLayer} type='button'><Type aria-hidden='true' /><span><strong>Text</strong><small>{composition.textCount} layers</small></span></button>
            <button onClick={actions.addCanvasShader} type='button'><Sparkles aria-hidden='true' /><span><strong>Shader</strong><small>{composition.shaderCount} layers</small></span></button>
            <button disabled={editingCanvas} title={editingCanvas ? 'Frame your selection to apply composition-wide effects' : 'Add effect layer'} onClick={actions.addEffectLayer} type='button'><Grid3X3 aria-hidden='true' /><span><strong>Effect</strong><small>{composition.effectCount} layers</small></span></button>
            <button onClick={actions.addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span><strong>Mark</strong><small>{composition.logoCount} layers</small></span></button>
            <button onClick={() => actions.openImageImport('sticker')} type='button'><Sticker aria-hidden='true' /><span><strong>Sticker</strong><small>{composition.stickerCount} layers</small></span></button>
            <button onClick={() => actions.openImageImport('image')} title='Open the shared Asset library or import new images' type='button'><ImagePlus aria-hidden='true' /><span><strong>Image</strong><small>{composition.placedImageCount} placed · {composition.savedAssetCount} saved</small></span></button>
          </div>
          <div aria-label='Composition layers, front to back' className='design-layer-inspector-list' role='list'>
            {composition.listedLayerCount > 0
              ? layerRows
              : <p className='design-layer-inspector-empty'>No layers yet. Add one above to begin.</p>}
          </div>
        </LabInspectorSection>
      </>}</ConditionalRender>

      <OptionalRender value={selectedEffectLayer}>{(selectedEffectLayer) => (
        <DesignLabEffectInspector
          imageEffectStatusStore={imageEffectStatusStore}
          previewEffectLayer={previewEffectLayer}
          selectEffectPreset={selectEffectPreset}
          selectImageEffect={selectImageEffect}
          selectedEffectLayer={selectedEffectLayer}
          updateEffectLayer={updateEffectLayer}
        />
      )}</OptionalRender>

      <OptionalRender value={editingShader}>{(editingShader) => (
        <DesignLabShaderInspector
          brandPalette={brandPalette}
          editingShader={editingShader}
          initialSettings={initialSettings}
          material={material}
          previewSelectedShaderOpacity={previewSelectedShaderOpacity}
          previewSelectedShaderSize={previewSelectedShaderSize}
          previewSelectedShaderSetting={previewSelectedShaderSetting}
          settings={settings}
          shaderSize={shaderSize}
          updateSelectedShader={updateSelectedShader}
          updateSetting={updateSetting}
        />
      )}</OptionalRender>
      <OptionalRender value={selectedShaderLayer}>{(selectedShaderLayer) => (
        <DesignLabShaderFrameInspector
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          layer={selectedShaderLayer}
          onChange={(transform) => actions.updateCanvasLayerTransform(selectedShaderLayer.id, transform)}
        />
      )}</OptionalRender>
      <OptionalRender value={selectedContentLayerId}>{() => <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-layer-inspector' data-canvas-selection-preserve meta={contentKind ?? ''} title='Selected layer'>
        <OptionalRender value={selectedTextInspector}>{(selection) => (
          <DesignLabTextLayerInspector
            key={selection.layer.id}
            canvasHeight={canvasDimensions.height}
            canvasWidth={canvasDimensions.width}
            identity={identity}
            previewSelectedContentOpacity={previewSelectedContentOpacity}
            previewSelectedTextAppearance={previewSelectedTextAppearance}
            previewSelectedTextLayer={previewSelectedTextLayer}
            previewSelectedTextWidth={previewSelectedTextWidth}
            selectedCanvasLayerCount={selectedCanvasLayerCount}
            selection={selection}
            stageRef={stageRef}
            textRenderedWeight={textRenderedWeight}
            textWeightRange={textWeightRange}
            textRange={textRange}
            clearTextRange={actions.clearTextRange}
            onTextSelection={(range) => actions.rememberTextSelection(selection.layer.id, range)}
            updateTextLayer={actions.updateTextFormatting}
            updateTextBox={actions.updateTextLayer}
          />
        )}</OptionalRender>
        <OptionalRender value={selectedLogoInspector}>{({ appearance: selectedLogoAppearance, layer: selectedLogoLayer }) => (
          <div aria-label='Mark appearance' className='shader-lab-v2-layer-settings' role='group'>
            <div className='shader-lab-v2-layer-settings-heading'>
              <strong>Mark appearance</strong>
              <span>SVG-safe</span>
            </div>
            <ColorControl
              ariaLabel='Mark color'
              label='Mark color'
              onChange={(color) => actions.updateLogoLayer(selectedLogoLayer.id, { color })}
              onPreview={(color) => previewSelectedLogoAppearance({}, color)}
              value={selectedLogoLayer.color ?? '#FFFFFF'}
            />
            <RangeControl
              formatValue={(value) => `${Math.round(value * 100)}%`}
              label='Layer opacity'
              max={1}
              min={0}
              onChange={(opacity) => actions.updateLogoLayer(selectedLogoLayer.id, { opacity })}
              onPreview={previewSelectedContentOpacity}
              step={0.01}
              value={selectedLogoLayer.opacity ?? 1}
            />
            <LogoAppearanceControls
              onChange={(patch) => actions.updateLogoLayer(selectedLogoLayer.id, { appearance: { ...selectedLogoAppearance, ...patch } })}
              onPreview={previewSelectedLogoAppearance}
              settings={selectedLogoAppearance}
            />
            <details className='shader-lab-v2-asset-conversion'>
              <summary><span>SVG conversion & mark library</span><ChevronDown aria-hidden='true' /></summary>
              <AssetConversionLibrary
                compact
                library={convertedAssetLibrary}
                onSelect={actions.selectConvertedLogo}
                selectedAssetId={selectedLogoLayer.convertedAssetId ?? null}
              />
            </details>
          </div>
        )}</OptionalRender>
        <OptionalRender value={selectedAssetInspector}>{({ appearance: selectedAssetAppearance, asset: selectedAsset }) => (
          <DesignLabAssetLayerInspector
            appearance={selectedAssetAppearance}
            asset={selectedAsset}
            cropAspect={imageCropAspectValue(selectedAsset.transform, layerGeometry(selectedAsset.id, canvasDimensions))}
            cropEditing={cropEditingLayerId === selectedAsset.id}
            onCropAspectChange={(value) => actions.setImageCropAspect(selectedAsset.id, value)}
            onCropEditingChange={(editing) => actions.setImageCropEditing(selectedAsset.id, editing)}
            previewAppearance={previewSelectedLogoAppearance}
            previewImageCrop={previewSelectedImageCrop}
            previewOpacity={previewSelectedContentOpacity}
            previewStickerFinish={previewSelectedStickerFinish}
            updateAsset={(update) => actions.updateAssetLayer(selectedAsset.id, update)}
          />
        )}</OptionalRender>
        {selectedLayerShader ? (
          <Button className='mt-2 w-full' onClick={actions.removeShaderFromSelectedContent} size='sm' type='button' variant='ghost'>
            <X aria-hidden='true' />Remove shader from layer
          </Button>
        ) : null}
        {selectedLogoLayer ? <Button className='mt-2 w-full' onClick={() => actions.resetLogoTransform(selectedLogoLayer.id)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset mark position</Button> : null}
        {selectedAsset ? <Button className='mt-2 w-full' onClick={() => actions.resetAssetTransform(selectedAsset.id)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset image position</Button> : null}
        {selectedTextLayer ? (
          <Button
            className='mt-2 w-full'
            onClick={() => actions.updateTextLayer(selectedTextLayer.id, { transform: DEFAULT_TEXT_LAYER_TRANSFORM })}
            size='sm'
            type='button'
            variant='ghost'
          ><RotateCcw aria-hidden='true' />Reset text box</Button>
        ) : null}
      </LabInspectorSection>}</OptionalRender>

      <OptionalRender value={editingShader}>{() => <details className='shader-lab-v2-advanced'>
        <summary>Advanced <ChevronDown aria-hidden='true' /></summary>
        <div className='shader-lab-v2-ranges'>
          {ADVANCED_CONTROLS.map((control) => (
            <RangeControl
              {...control}
              key={control.key}
              onChange={(value) => updateSetting(control.key, value)}
              onPreview={(value) => previewSelectedShaderSetting(control.key, value)}
              value={settings[control.key]}
            />
          ))}
        </div>
      </details>}</OptionalRender>

      <section className='shader-lab-v2-handoff'>
        <Code2 aria-hidden='true' />
        <div><strong>Developer handoff</strong><span>Layer order + exact shader settings</span></div>
        <button onClick={actions.copySetup} type='button'>{copied ? <Check aria-hidden='true' /> : 'Copy'}</button>
        {copyError ? <p className='shader-lab-v2-handoff-error' role='alert'>{copyError}</p> : null}
      </section>
    </StudioSidebar>
  );
});
