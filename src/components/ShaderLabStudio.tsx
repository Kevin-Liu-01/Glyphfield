'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleGauge,
  Clapperboard,
  Clock3,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileImage,
  Film,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Layers3,
  MonitorUp,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Ruler,
  Search,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from '@/components/ui/SolidIcons';
import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, type SetStateAction, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasSelectionMenu, { type CanvasSelectionMenuPosition } from '@/components/CanvasSelectionMenu';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import CompositionEffectThumbnail from '@/components/CompositionEffectThumbnail';
import DesignVersionControls from '@/components/DesignVersionControls';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import {
  alignCanvasSelection,
  canvasLayerDimensions,
  canvasSelectionBounds,
  isAdditiveCanvasSelection,
  MIN_CANVAS_LAYER_SCALE,
  nextCanvasLayerSelection,
  normalizeCanvasLayerTransform,
  type CanvasLayerAlignment,
  type CanvasLayerBounds,
  type CanvasSelectionItem,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import ImageAssetModal, { type ImageImportRequest, type PendingImageImport } from '@/components/ImageAssetModal';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { ConditionalRender, OptionalRender } from '@/components/RenderControl';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import TextEffectThumbnail from '@/components/TextEffectThumbnail';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';

function canvasSelectionAnnouncement(count: number, groupName?: string): string {
  if (count === 0) return 'Canvas selection cleared.';
  const plural = count === 1 ? '' : 's';
  const group = groupName ? ` in ${groupName}` : '';
  return `${count} canvas layer${plural} selected${group}.`;
}

function designLabInspectorDescription({
  hasContent,
  hasEffect,
  hasLayerShader,
  hasShader,
  materialName,
}: {
  hasContent: boolean;
  hasEffect: boolean;
  hasLayerShader: boolean;
  hasShader: boolean;
  materialName: string;
}): string {
  if (hasShader) return 'Tune this full-canvas material, then place it anywhere in the layer stack.';
  if (hasEffect) return 'Convert every layer beneath this point without flattening the composition.';
  if (hasContent) {
    return `Style, position, and export this layer${hasLayerShader ? ` with ${materialName} applied` : ''}.`;
  }
  return 'Select a layer to edit its content and appearance, or add a new one below.';
}
import { useConvertedAssets } from '@/hooks/useConvertedAssets';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  brandTypographyWeightRange,
  resolveBrandTypographyWeight,
  type BrandAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  canvasTextCharacters,
  canvasTextLineX,
  layoutCanvasText,
  trackedTextWidth,
  type CanvasTextAlign,
  type CanvasTextWrap,
} from '@/lib/canvasText';
import {
  canvasToImageBlob,
  encodeCanvasGif,
  encodeCanvasMp4,
  resolveExportDimensions,
  resolveSeamlessLoopOverlapFrames,
  type MotionLoopMode,
  type MotionLoopReport,
  type MotionExportQuality,
  type MotionFrame,
  type StillImageFormat,
} from '@/lib/canvasExport';
import { drawCanvasImageCover, loadCanvasImage } from '@/lib/canvasDrawing';
import { canvasRevisionFromSignature, isCanvasDocumentEnvelope } from '@/lib/canvasDocument';
import { renderCanvasDocumentPage } from '@/lib/canvasRenderer';
import type { ConvertedAsset } from '@/lib/convertedAssets';
import {
  applyCompositionEffect,
  COMPOSITION_EFFECT_PRESETS,
  createCompositionEffectScratch,
  defaultCompositionEffectSettings,
  type CompositionEffectScratch,
  type CompositionEffectKind,
  type CompositionEffectSettings,
} from '@/lib/compositionEffects';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  brandMaterialPalette,
  getLiveMaterial,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  createDesignLabCanvasDocument,
  parseDesignLabCanvasDocument,
  reconcileDesignLabLayerGroups,
  reconcileDesignLabLayerOrder,
  serializeExistingDesignLabCanvasDocument,
  withDesignLabTimeline,
} from '@/lib/designLabDocument';
import { parseSourceObject } from '@/lib/sourceCode';
import {
  previewLiveMaterialPatternScale,
  previewLiveMaterialSettings,
  previewLiveMaterialTime,
} from '@/lib/liveMaterialPreview';
import {
  buildImageSvgFilter,
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import { copyTextToClipboard } from '@/lib/clipboard';
import { imageUrlToDataUrl } from '@/lib/download';
import {
  fitImageLayerToCanvas,
  previewContainedImageBounds,
} from '@/lib/imagePlacement';
import { createImportedBrandAsset, readEmbeddedImageFile } from '@/lib/imageAssets';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
} from '@/lib/shaderLab';
import {
  savedDesignStorageKey,
} from '@/lib/savedDesigns';
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
  buildShaderSequenceTimeline,
  DEFAULT_SHADER_SEQUENCE_SETTINGS,
  normalizeShaderSequenceSettings,
  shaderSequenceDurationMs,
  shaderSequenceMaterialIds,
  shaderSequenceSegmentAt,
  type ShaderSequenceSettings,
} from '@/lib/shaderSequence';
import { downloadStudioArtifact, registerStudioAutomation } from '@/lib/studioAutomation';
import type { StudioTool } from '@/lib/studioCatalog';
import {
  applyTextEffectMask,
  createTextEffectGradient,
  DEFAULT_TEXT_EFFECT,
  resolveTextEffectSettings,
  textEffectCssStyle,
  TEXT_EFFECT_PRESETS,
  type TextEffectSettings,
} from '@/lib/textEffects';

type ShaderRatio = 'wide' | 'square' | 'opengraph';
type ShaderBlendMode = 'multiply' | 'normal' | 'overlay' | 'screen';
type ShaderLayerId = `shader-${string}`;
type EffectLayerId = `effect-${string}`;
type LogoLayerId = `logo-${string}`;
type TextLayerId = `text-${string}`;
type AssetLayerId = `asset-${string}`;
type ContentLayerId = LogoLayerId | TextLayerId | AssetLayerId;
type CanvasLayerId = ShaderLayerId | ContentLayerId;
type CompositionLayerId = ShaderLayerId | EffectLayerId | ContentLayerId;
type CompositionLayerGroupId = `group-${string}`;

type CompositionLayerGroup = {
  id: CompositionLayerGroupId;
  layerIds: CanvasLayerId[];
  name: string;
};

type ShaderApplication = {
  blendMode: ShaderBlendMode;
  materialId: LiveMaterialId;
  opacity: number;
  settings: LiveMaterialSettings;
  shaderSize: number;
};

type CompositionShaderLayer = ShaderApplication & {
  id: ShaderLayerId;
  name: string;
  transform: CanvasLayerTransform;
  visible: boolean;
};

type CompositionEffectLayer = {
  id: EffectLayerId;
  name: string;
  opacity: number;
  settings: CompositionEffectSettings;
  visible: boolean;
};


type CompositionLogoLayer = {
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

type CompositionAsset = {
  appearance?: LogoAppearanceSettings;
  id: AssetLayerId;
  libraryAssetId?: string;
  name: string;
  opacity?: number;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

type CompositionTextLayer = {
  align: CanvasTextAlign;
  color?: string;
  fontRole?: BrandTypography['role'];
  id: TextLayerId;
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
  textEffect?: TextEffectSettings;
  tracking: number;
  transform: CanvasLayerTransform;
  value: string;
  visible: boolean;
  weight: number;
  wrap: CanvasTextWrap;
};

type LayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

type TextAppearanceSettings = {
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

type TextEffectRenderScratch = {
  fill: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
};

type DesignExportSettings = {
  durationMs: number;
  fps: number;
  gifLoop: MotionLoopMode;
  quality: MotionExportQuality;
  width: number;
};

type DesignExportFormat = 'gif' | 'jpg' | 'mp4' | 'png';
type DesignMotionMode = 'sequence' | 'standard';
type DesignAutomationExportInput = {
  download?: boolean;
  format: 'gif' | 'jpg' | 'mp4' | 'png';
  mode?: 'shader-sequence' | 'standard';
};
type ImageImportState = {
  message: string;
  status: 'error' | 'idle' | 'importing' | 'success';
};

type DesignExportRequest = {
  format: DesignExportFormat;
  motionMode?: DesignMotionMode;
  settingsSignature: string;
};

type DesignShaderSequenceSettings = ShaderSequenceSettings & {
  targetLayerId: ShaderLayerId | null;
};

type ShaderSequenceCapture = {
  application: ShaderApplication;
  layerId: ShaderLayerId;
  materialId: LiveMaterialId;
};

const RATIO_OPTIONS: readonly { height: number; label: string; value: ShaderRatio; width: number }[] = [
  { height: 9, label: '16:9', value: 'wide', width: 16 },
  { height: 1, label: '1:1', value: 'square', width: 1 },
  { height: 630, label: 'OG', value: 'opengraph', width: 1200 },
];

const CANVAS_DIMENSIONS: Record<ShaderRatio, { height: number; width: number }> = {
  opengraph: { height: 630, width: 1200 },
  square: { height: 1200, width: 1200 },
  wide: { height: 900, width: 1600 },
};

const DEFAULT_EXPORT_SETTINGS: DesignExportSettings = {
  durationMs: 1_600,
  fps: 15,
  gifLoop: 'seamless',
  quality: 'balanced',
  width: 960,
};
const EXPORT_WIDTH_PRESETS = [
  { label: 'Compact', width: 640 },
  { label: 'Standard', width: 960 },
  { label: 'Large', width: 1_280 },
  { label: 'Full', width: 1_920 },
] as const;
const EXPORT_QUALITY_OPTIONS: readonly { description: string; label: string; value: MotionExportQuality }[] = [
  { description: 'Quick preview', label: 'Fast', value: 'fast' },
  { description: 'Everyday export', label: 'Balanced', value: 'balanced' },
  { description: 'Most detail', label: 'Best', value: 'best' },
];

function normalizeDesignExportSettings(settings?: Partial<DesignExportSettings>): DesignExportSettings {
  return {
    durationMs: settings?.durationMs && [1_200, 1_600, 2_400, 4_000].includes(settings.durationMs)
      ? settings.durationMs
      : DEFAULT_EXPORT_SETTINGS.durationMs,
    fps: settings?.fps && [12, 15, 24, 30].includes(settings.fps)
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

function designExportSettingsSignature(ratio: ShaderRatio, settings: DesignExportSettings): string {
  return [ratio, settings.width, settings.quality, settings.durationMs, settings.fps, settings.gifLoop].join(':');
}

function DesignExportControls({
  format,
  onChange,
  ratioOption,
  settings,
}: {
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  ratioOption: (typeof RATIO_OPTIONS)[number];
  settings: DesignExportSettings;
}) {
  const dimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: settings.width,
  });
  const frameCount = Math.max(2, Math.round(settings.durationMs / (1_000 / settings.fps)));
  const loopOverlapFrames = resolveSeamlessLoopOverlapFrames({
    durationMs: settings.durationMs,
    fps: settings.fps,
    height: dimensions.height,
    width: dimensions.width,
  });
  const motion = format === 'gif' || format === 'mp4';

  return (
    <div className='shader-lab-v2-output-controls'>
      <div className='shader-lab-v2-export-overview' aria-label='Current output settings'>
        <div>
          <MonitorUp aria-hidden='true' />
          <span><small>Output size</small><strong>{dimensions.width} × {dimensions.height}</strong></span>
        </div>
        <div>
          {motion ? <Film aria-hidden='true' /> : <FileImage aria-hidden='true' />}
          {motion
            ? <span><small>Animation · {frameCount} frames</small><strong>{settings.durationMs / 1_000}s · {settings.fps} FPS</strong></span>
            : <span><small>Static image</small><strong>{format.toUpperCase()} · {settings.quality}</strong></span>}
        </div>
      </div>
      <div className='shader-lab-v2-export-presets' aria-label='Export size presets'>
        {EXPORT_WIDTH_PRESETS.map((preset) => {
          const presetDimensions = resolveExportDimensions({
            aspectHeight: ratioOption.height,
            aspectWidth: ratioOption.width,
            width: preset.width,
          });
          return (
            <button
              aria-pressed={dimensions.width === presetDimensions.width}
              key={preset.width}
              onClick={() => onChange({ width: preset.width })}
              type='button'
            >
              <strong>{preset.label}</strong>
              <small>{presetDimensions.width}×{presetDimensions.height}</small>
            </button>
          );
        })}
      </div>
      <label className='shader-lab-v2-export-width'>
        <span><Ruler aria-hidden='true' />Custom width</span>
        <span>
          <input
            aria-label='Export width in pixels'
            max={3_840}
            min={320}
            onBlur={() => onChange({ width: dimensions.width })}
            onChange={(event) => {
              const width = event.currentTarget.valueAsNumber;
              if (Number.isFinite(width)) onChange({ width });
            }}
            step={2}
            type='number'
            value={settings.width}
          />
          <i>px</i>
        </span>
      </label>
      <div className='shader-lab-v2-export-quality'>
        <span><CircleGauge aria-hidden='true' />Quality</span>
        <div>
          {EXPORT_QUALITY_OPTIONS.map((option) => {
            const QualityIcon = option.value === 'fast' ? Zap : option.value === 'balanced' ? CircleGauge : Sparkles;
            return (
              <button
                aria-pressed={settings.quality === option.value}
                key={option.value}
                onClick={() => onChange({ quality: option.value })}
                title={option.description}
                type='button'
              >
                <QualityIcon aria-hidden='true' />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      {motion ? (
        <div className='shader-lab-v2-export-motion'>
          <label>
            <span><Clock3 aria-hidden='true' />Duration</span>
            <StudioSelect
              ariaLabel='Export duration'
              onValueChange={(value) => onChange({ durationMs: Number(value) })}
              options={[
                { label: '1.2 seconds', value: '1200' },
                { label: '1.6 seconds', value: '1600' },
                { label: '2.4 seconds', value: '2400' },
                { label: '4 seconds', value: '4000' },
              ]}
              value={String(settings.durationMs)}
            />
          </label>
          <label>
            <span><Film aria-hidden='true' />Frame rate</span>
            <StudioSelect
              ariaLabel='Export frame rate'
              onValueChange={(value) => onChange({ fps: Number(value) })}
              options={[12, 15, 24, 30].map((fps) => ({ label: `${fps} FPS`, value: String(fps) }))}
              value={String(settings.fps)}
            />
          </label>
        </div>
      ) : null}
      {format === 'gif' ? (
        <div className='shader-lab-v2-export-quality shader-lab-v2-export-loop'>
          <span><Repeat2 aria-hidden='true' />GIF loop</span>
          <div>
            <button
              aria-pressed={settings.gifLoop === 'seamless'}
              onClick={() => onChange({ gifLoop: 'seamless' })}
              title='Blend and verify the closing frame for a smooth loop.'
              type='button'
            >Seamless</button>
            <button
              aria-pressed={settings.gifLoop === 'raw'}
              onClick={() => onChange({ gifLoop: 'raw' })}
              title='Repeat captured frames without correcting the seam.'
              type='button'
            >Raw motion</button>
          </div>
          <small>{settings.gifLoop === 'seamless'
            ? `Smooth close · ${loopOverlapFrames}-frame overlap verified after render`
            : 'Direct repeat · best for shaders that already loop naturally'}</small>
        </div>
      ) : null}
    </div>
  );
}

function DesignExportWorkspace({
  disabled,
  format,
  onChange,
  onFormatChange,
  ratioOption,
  settings,
}: {
  disabled: boolean;
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  onFormatChange: (format: DesignExportFormat) => void;
  ratioOption: (typeof RATIO_OPTIONS)[number];
  settings: DesignExportSettings;
}) {
  const formats: readonly { description: string; icon: typeof ImageDown; label: string; value: DesignExportFormat }[] = [
    { description: 'Transparent image', icon: ImageDown, label: 'PNG', value: 'png' },
    { description: 'Smaller image', icon: FileImage, label: 'JPG', value: 'jpg' },
    { description: 'Looping motion', icon: Film, label: 'GIF', value: 'gif' },
    { description: 'Video', icon: Clapperboard, label: 'MP4', value: 'mp4' },
  ];

  return (
    <div className='shader-export-workspace' aria-busy={disabled}>
      <div className='shader-export-format' aria-label='Export format'>
        {formats.map((option) => {
          const FormatIcon = option.icon;
          return (
            <button
              aria-pressed={format === option.value}
              disabled={disabled}
              key={option.value}
              onClick={() => onFormatChange(option.value)}
              type='button'
            >
              <FormatIcon aria-hidden='true' />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </button>
          );
        })}
      </div>
      <DesignExportControls
        format={format}
        onChange={onChange}
        ratioOption={ratioOption}
        settings={settings}
      />
    </div>
  );
}

function ShaderSequenceControls({
  disabled,
  durationMs,
  materialIds,
  onChange,
  onExport,
  onPreview,
  previewing,
  settings,
  targetOptions,
}: {
  disabled: boolean;
  durationMs: number;
  materialIds: readonly LiveMaterialId[];
  onChange: (patch: Partial<DesignShaderSequenceSettings>) => void;
  onExport: () => void;
  onPreview: () => void;
  previewing: boolean;
  settings: DesignShaderSequenceSettings;
  targetOptions: readonly { label: string; value: ShaderLayerId }[];
}) {
  const introCount = Math.max(0, materialIds.length - 1);
  const occurrences = new Map<LiveMaterialId, number>();
  const sequenceItems = materialIds.map((materialId) => {
    const occurrence = (occurrences.get(materialId) ?? 0) + 1;
    occurrences.set(materialId, occurrence);
    return { key: `${materialId}:${occurrence}`, materialId };
  });
  return (
    <div className='shader-lab-v2-sequence-builder'>
      <div className='shader-lab-v2-sequence-summary'>
        <span><Clapperboard aria-hidden='true' /><strong>Shader cuts</strong></span>
        <code>{(durationMs / 1_000).toFixed(1)}s</code>
      </div>
      <p>Keep the composition locked while one background runs through {introCount} cuts and lands on its current shader.</p>
      <div className='shader-lab-v2-sequence-strip studio-scroll-area' aria-label='Shader cut sequence'>
        {sequenceItems.map(({ key, materialId }, index) => {
          const material = getLiveMaterial(materialId);
          const final = index === materialIds.length - 1;
          return (
            <span data-final={final ? 'true' : 'false'} key={key} title={`${index + 1}. ${material.name}${final ? ' · final hold' : ''}`}>
              <img alt='' src={shaderPreviewAssetPath(materialId)} />
              <i>{final ? 'Hold' : String(index + 1).padStart(2, '0')}</i>
            </span>
          );
        })}
      </div>
      <label className='shader-lab-v2-sequence-field'>
        <span>Background layer</span>
        <StudioSelect
          ariaLabel='Shader sequence background layer'
          disabled={targetOptions.length === 0}
          onValueChange={(value) => onChange({ targetLayerId: value as ShaderLayerId })}
          options={targetOptions}
          value={settings.targetLayerId ?? targetOptions[0]?.value ?? ''}
        />
      </label>
      <div className='shader-lab-v2-export-motion'>
        <label>
          <span><Film aria-hidden='true' />Cuts</span>
          <StudioSelect
            ariaLabel='Shader sequence cut count'
            onValueChange={(value) => onChange({ cutCount: Number(value) })}
            options={[8, 9, 10, 11, 12].map((count) => ({ label: `${count} shaders`, value: String(count) }))}
            value={String(settings.cutCount)}
          />
        </label>
        <label>
          <span><Clock3 aria-hidden='true' />Final hold</span>
          <StudioSelect
            ariaLabel='Shader sequence final hold'
            onValueChange={(value) => onChange({ finalHoldMs: Number(value) })}
            options={[3_000, 4_000, 5_000, 6_000].map((holdMs) => ({ label: `${holdMs / 1_000} seconds`, value: String(holdMs) }))}
            value={String(settings.finalHoldMs)}
          />
        </label>
      </div>
      <div className='shader-lab-v2-sequence-pace' aria-label='Shader cut pacing'>
        {([
          { label: 'Accelerating', value: 'accelerating' },
          { label: 'Even', value: 'even' },
        ] as const).map((option) => (
          <button aria-pressed={settings.pace === option.value} key={option.value} onClick={() => onChange({ pace: option.value })} type='button'>{option.label}</button>
        ))}
      </div>
      <div className='shader-lab-v2-sequence-actions'>
        <button disabled={disabled || targetOptions.length === 0} onClick={onPreview} type='button'>
          {previewing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          <span>{previewing ? 'Stop preview' : 'Preview cuts'}</span>
        </button>
        <button disabled={disabled || targetOptions.length === 0} onClick={onExport} type='button'>
          <Download aria-hidden='true' />
          <span>Export MP4</span>
        </button>
      </div>
    </div>
  );
}

function ShaderFrameHistoryControl({
  durationMs,
  fps,
  frame,
  onFramePreview,
  onPauseAtFrame,
  onPlay,
  onScrub,
  onScrubPreview,
  playing,
}: {
  durationMs: number;
  fps: number;
  frame: number;
  onFramePreview: (frame: number) => void;
  onPauseAtFrame: (frame: number) => void;
  onPlay: () => void;
  onScrub: (frame: number) => void;
  onScrubPreview: (frame: number) => void;
  playing: boolean;
}) {
  const frameCount = Math.max(2, Math.round(durationMs / (1_000 / fps)));
  const boundedFrame = Math.min(frameCount - 1, Math.max(0, Math.round(frame)));
  const [displayFrame, setDisplayFrame] = useState(boundedFrame);
  const pendingScrubFrameRef = useRef<number | null>(null);
  const latestScrubFrameRef = useRef<number | null>(null);
  const scrubAnimationFrameRef = useRef(0);
  const previewPlaybackFrame = useEffectEvent(onFramePreview);

  useEffect(() => {
    if (!playing) setDisplayFrame(boundedFrame);
  }, [boundedFrame, playing]);

  useEffect(() => {
    if (!playing) return;
    const frameDurationMs = 1_000 / fps;
    const startedAt = performance.now() - boundedFrame * frameDurationMs;
    let animationFrame = 0;
    let previousFrame = -1;
    const tick = (now: number) => {
      const nextFrame = Math.floor(((now - startedAt) % durationMs) / frameDurationMs) % frameCount;
      if (nextFrame !== previousFrame) {
        previousFrame = nextFrame;
        previewPlaybackFrame(nextFrame);
        setDisplayFrame(nextFrame);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [boundedFrame, durationMs, fps, frameCount, playing]);

  useEffect(() => () => cancelAnimationFrame(scrubAnimationFrameRef.current), []);

  function scheduleScrub(nextFrame: number) {
    const boundedNextFrame = Math.min(frameCount - 1, Math.max(0, Math.round(nextFrame)));
    setDisplayFrame(boundedNextFrame);
    pendingScrubFrameRef.current = boundedNextFrame;
    latestScrubFrameRef.current = boundedNextFrame;
    if (scrubAnimationFrameRef.current) return;
    scrubAnimationFrameRef.current = requestAnimationFrame(() => {
      scrubAnimationFrameRef.current = 0;
      const previewFrame = pendingScrubFrameRef.current;
      pendingScrubFrameRef.current = null;
      if (previewFrame === null) return;
      onFramePreview(previewFrame);
      onScrubPreview(previewFrame);
    });
  }

  function flushScrub() {
    cancelAnimationFrame(scrubAnimationFrameRef.current);
    scrubAnimationFrameRef.current = 0;
    const nextFrame = pendingScrubFrameRef.current ?? latestScrubFrameRef.current;
    pendingScrubFrameRef.current = null;
    latestScrubFrameRef.current = null;
    if (nextFrame === null) return;
    onFramePreview(nextFrame);
    onScrubPreview(nextFrame);
    onScrub(nextFrame);
  }

  const seconds = displayFrame / fps;
  return (
    <section className='shader-lab-v2-frame-history' data-canvas-selection-preserve>
      <button
        aria-label={playing ? 'Pause at current shader frame' : 'Play shader history'}
        onClick={() => playing ? onPauseAtFrame(displayFrame) : onPlay()}
        title={playing ? 'Pause at this frame' : 'Resume live shader motion'}
        type='button'
      >
        {playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
      </button>
      <div className='shader-lab-v2-frame-history-copy'>
        <span><Clock3 aria-hidden='true' />Frame history</span>
        <small>{playing ? 'Live' : 'Selected'} · {seconds.toFixed(2)}s</small>
      </div>
      <input
        aria-label='Shader frame history'
        max={frameCount - 1}
        min={0}
        onBlur={flushScrub}
        onInput={(event) => scheduleScrub(Number(event.currentTarget.value))}
        onPointerCancel={flushScrub}
        onPointerDown={() => {
          if (playing) onPauseAtFrame(displayFrame);
        }}
        onPointerUp={flushScrub}
        step={1}
        type='range'
        value={displayFrame}
      />
      <output aria-live='off'>
        <strong>{String(displayFrame + 1).padStart(2, '0')}</strong>
        <span>/ {String(frameCount).padStart(2, '0')}</span>
      </output>
    </section>
  );
}

function CanvasSelectionAssemblyOverlay({
  bounds,
  canvasHeight,
  canvasWidth,
  label,
  stageRef,
}: {
  bounds: CanvasLayerBounds;
  canvasHeight: number;
  canvasWidth: number;
  label: string;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const [screenBounds, setScreenBounds] = useState<{
    height: number;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const measure = () => {
      const stageBounds = stage.getBoundingClientRect();
      const next = {
        height: bounds.height / canvasHeight * stageBounds.height,
        left: stageBounds.left + bounds.left / canvasWidth * stageBounds.width,
        top: stageBounds.top + bounds.top / canvasHeight * stageBounds.height,
        width: bounds.width / canvasWidth * stageBounds.width,
      };
      setScreenBounds((current) => current
        && Math.abs(current.height - next.height) < 0.25
        && Math.abs(current.left - next.left) < 0.25
        && Math.abs(current.top - next.top) < 0.25
        && Math.abs(current.width - next.width) < 0.25
        ? current
        : next);
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const viewportStage = stage.closest('.canvas-viewport-stage');
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(stage);
    if (viewportStage) resizeObserver.observe(viewportStage);
    const transformObserver = viewportStage ? new MutationObserver(scheduleMeasure) : null;
    transformObserver?.observe(viewportStage!, { attributeFilter: ['style'], attributes: true });
    document.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    measure();
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      transformObserver?.disconnect();
      document.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [bounds.height, bounds.left, bounds.top, bounds.width, canvasHeight, canvasWidth, stageRef]);

  if (!screenBounds) return null;
  return createPortal(
    <div aria-hidden='true' className='canvas-selection-assembly' data-canvas-selection-preserve style={screenBounds}>
      <span className='canvas-selection-assembly__label'>{label}</span>
    </div>,
    document.body
  );
}

const DEFAULT_LAYER_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };
const DEFAULT_CANVAS_SHADER_ID = 'shader-canvas-1' as const satisfies ShaderLayerId;
const DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS: DesignShaderSequenceSettings = {
  ...DEFAULT_SHADER_SEQUENCE_SETTINGS,
  targetLayerId: DEFAULT_CANVAS_SHADER_ID,
};
const DEFAULT_SHADER_MATERIAL_ID = 'paper-gem-smoke' as const satisfies LiveMaterialId;
const LEGACY_DEFAULT_SHADER_MATERIAL_ID = 'holo-cloth-silk' as const satisfies LiveMaterialId;
const DEFAULT_CANVAS_BACKGROUND = '#111216';
const DEFAULT_LOGO_LAYER_ID = 'logo-brand' as const satisfies LogoLayerId;
const DEFAULT_TEXT_LAYER_TRANSFORM: CanvasLayerTransform = {
  ...DEFAULT_LAYER_TRANSFORM,
  heightScale: 1,
  widthScale: 1,
};
const DEFAULT_TEXT_APPEARANCE: TextAppearanceSettings = {
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

function isTextLayerId(layerId: CompositionLayerId | null): layerId is TextLayerId {
  return layerId?.startsWith('text-') ?? false;
}

function isShaderLayerId(layerId: CompositionLayerId | null): layerId is ShaderLayerId {
  return layerId?.startsWith('shader-') ?? false;
}

function isEffectLayerId(layerId: CompositionLayerId | null): layerId is EffectLayerId {
  return layerId?.startsWith('effect-') ?? false;
}

function isLogoLayerId(layerId: CompositionLayerId | null): layerId is LogoLayerId {
  return layerId?.startsWith('logo-') ?? false;
}

function isAssetLayerId(layerId: CompositionLayerId | null): layerId is AssetLayerId {
  return layerId?.startsWith('asset-') ?? false;
}

function isContentLayerId(layerId: CompositionLayerId | null): layerId is ContentLayerId {
  return isLogoLayerId(layerId) || isTextLayerId(layerId) || isAssetLayerId(layerId);
}

function isCanvasLayerId(layerId: CompositionLayerId | null): layerId is CanvasLayerId {
  return isShaderLayerId(layerId) || isContentLayerId(layerId);
}

function CanvasLayerKindIcon({ layerId }: { layerId: CompositionLayerId }) {
  if (isShaderLayerId(layerId)) return <Sparkles aria-hidden='true' />;
  if (isEffectLayerId(layerId)) return <Grid3X3 aria-hidden='true' />;
  if (isTextLayerId(layerId)) return <Type aria-hidden='true' />;
  if (isLogoLayerId(layerId)) return <Layers3 aria-hidden='true' />;
  return <ImagePlus aria-hidden='true' />;
}

function resolveLayerDockLayers(
  layerId: CompositionLayerId,
  {
    assets,
    effects,
    logos,
    shaders,
    text,
  }: {
    assets: readonly CompositionAsset[];
    effects: readonly CompositionEffectLayer[];
    logos: readonly CompositionLogoLayer[];
    shaders: readonly CompositionShaderLayer[];
    text: readonly CompositionTextLayer[];
  }
) {
  return {
    assetLayer: isAssetLayerId(layerId) ? assets.find(({ id }) => id === layerId) ?? null : null,
    effectLayer: isEffectLayerId(layerId) ? effects.find(({ id }) => id === layerId) ?? null : null,
    logoLayer: isLogoLayerId(layerId) ? logos.find(({ id }) => id === layerId) ?? null : null,
    shaderLayer: isShaderLayerId(layerId) ? shaders.find(({ id }) => id === layerId) ?? null : null,
    textLayer: isTextLayerId(layerId) ? text.find(({ id }) => id === layerId) ?? null : null,
  };
}

function LayerDockStaticPreview({
  effectLayer,
  label,
  onSelect,
  previewUrl,
}: {
  effectLayer: CompositionEffectLayer | null;
  label: string;
  onSelect: () => void;
  previewUrl?: string;
}) {
  let preview: ReactNode = <span aria-hidden='true' />;
  if (effectLayer) preview = <CompositionEffectThumbnail kind={effectLayer.settings.kind} />;
  else if (previewUrl) preview = <img alt='' draggable={false} src={previewUrl} />;
  return (
    <button className='shader-lab-v2-dock-preview-select' aria-label={`Select ${label} preview`} onClick={onSelect} type='button'>
      {preview}
    </button>
  );
}

type DesignLabCompositionSource = {
  composition: {
    assets?: Array<Partial<CompositionAsset> & Pick<CompositionAsset, 'id'>>;
    backgroundColor?: string;
    effectLayers?: CompositionEffectLayer[];
    groups?: CompositionLayerGroup[];
    layerOrder?: CompositionLayerId[];
    layerShaders?: Partial<Record<ContentLayerId, ShaderApplication>>;
    logos?: Array<Partial<CompositionLogoLayer> & Pick<CompositionLogoLayer, 'id'>>;
    shaderLayers?: CompositionShaderLayer[];
    textLayers?: CompositionTextLayer[];
  };
  exportSettings?: Partial<DesignExportSettings>;
  ratio?: ShaderRatio;
  shaderSequence?: Partial<DesignShaderSequenceSettings>;
  timeline?: { frame?: number; paused?: boolean };
  version?: number;
};

function assertOptionalArray<T>(
  value: T[] | undefined,
  label: string,
  isInvalid: (item: T) => boolean
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(isInvalid)) throw new TypeError(`${label} are invalid.`);
}

function validateCompositionLayers(composition: DesignLabCompositionSource['composition']): void {
  assertOptionalArray(composition.shaderLayers, 'Shader layers', (layer) => !layer.id?.startsWith('shader-'));
  assertOptionalArray(composition.effectLayers, 'Converter layers', (layer) => !layer.id?.startsWith('effect-'));
  assertOptionalArray(composition.textLayers, 'Text layers', (layer) => !layer.id?.startsWith('text-') || typeof layer.value !== 'string');
  assertOptionalArray(composition.logos, 'Mark layers', (layer) => !layer.id?.startsWith('logo-'));
  assertOptionalArray(composition.assets, 'Image layers', (layer) => !layer.id?.startsWith('asset-'));
  assertOptionalArray(composition.groups, 'Layer groups', (group) => !group.id?.startsWith('group-') || !Array.isArray(group.layerIds));
  assertOptionalArray(composition.layerOrder, 'Layer order', (id) => typeof id !== 'string');
}

function validateCompositionMetadata(parsed: DesignLabCompositionSource): void {
  const { composition } = parsed;
  if (parsed.ratio && !RATIO_OPTIONS.some(({ value }) => value === parsed.ratio)) throw new TypeError('Unknown canvas ratio.');
  if (composition.backgroundColor && !/^#[\dA-F]{6}$/i.test(composition.backgroundColor)) throw new TypeError('Canvas background must be a six-digit HEX color.');
  if (parsed.timeline?.frame !== undefined && (!Number.isFinite(parsed.timeline.frame) || parsed.timeline.frame < 0)) throw new TypeError('Shader frame history is invalid.');
  if (parsed.shaderSequence?.pace && !['accelerating', 'even'].includes(parsed.shaderSequence.pace)) throw new TypeError('Shader sequence pacing is invalid.');
  if (parsed.shaderSequence?.targetLayerId && !parsed.shaderSequence.targetLayerId.startsWith('shader-')) throw new TypeError('Shader sequence target is invalid.');
}

function parseCompositionSource(source: string): DesignLabCompositionSource {
  const sourceRoot = parseSourceObject(source);
  const parsed = (
    isCanvasDocumentEnvelope(sourceRoot)
      ? parseDesignLabCanvasDocument(source)
      : sourceRoot
  ) as DesignLabCompositionSource;
  if (!parsed?.composition) throw new TypeError('A composition object is required.');
  validateCompositionLayers(parsed.composition);
  validateCompositionMetadata(parsed);
  return parsed;
}

function restoredLogoLayers(
  savedLayers: DesignLabCompositionSource['composition']['logos'],
  currentLayers: readonly CompositionLogoLayer[],
  builtInLogo: string
): CompositionLogoLayer[] {
  if (!savedLayers) {
    return currentLayers.map((layer) => ({
      ...layer,
      appearance: layer.appearance ? { ...layer.appearance } : undefined,
      transform: { ...layer.transform },
    }));
  }
  const currentById = new Map(currentLayers.map((layer) => [layer.id, layer]));
  return savedLayers.map((savedLayer) => {
    const current = currentById.get(savedLayer.id);
    return {
      appearance: savedLayer.appearance ? { ...savedLayer.appearance } : current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE },
      color: savedLayer.color ?? current?.color ?? '#FFFFFF',
      convertedAssetId: savedLayer.convertedAssetId,
      id: savedLayer.id,
      name: savedLayer.name ?? current?.name ?? 'Brand mark',
      opacity: savedLayer.opacity ?? current?.opacity ?? 1,
      transform: normalizeCanvasLayerTransform(savedLayer.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
      url: savedLayer.url ?? current?.url ?? builtInLogo,
      visible: savedLayer.visible ?? current?.visible ?? true,
    };
  });
}

function restoredImageLayers(
  savedAssets: DesignLabCompositionSource['composition']['assets'],
  currentAssets: readonly CompositionAsset[]
): CompositionAsset[] {
  if (!savedAssets) {
    return currentAssets.map((asset) => ({
      ...asset,
      appearance: asset.appearance ? { ...asset.appearance } : undefined,
      transform: { ...asset.transform },
    }));
  }
  const currentById = new Map(currentAssets.map((asset) => [asset.id, asset]));
  return savedAssets.flatMap((savedAsset) => {
    const current = currentById.get(savedAsset.id);
    const url = savedAsset.url ?? current?.url;
    if (!url) return [];
    return [{
      appearance: savedAsset.appearance ? { ...savedAsset.appearance } : current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE },
      id: savedAsset.id,
      libraryAssetId: savedAsset.libraryAssetId ?? current?.libraryAssetId,
      name: savedAsset.name ?? current?.name ?? 'Image',
      opacity: savedAsset.opacity ?? current?.opacity ?? 1,
      transform: normalizeCanvasLayerTransform(savedAsset.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
      url,
      visible: savedAsset.visible ?? current?.visible ?? true,
    }];
  });
}

function restoredLayerShaders(
  savedShaders: DesignLabCompositionSource['composition']['layerShaders'] | undefined,
  currentShaders: Partial<Record<ContentLayerId, ShaderApplication>>,
  allowedIds: ReadonlySet<CompositionLayerId>
): Partial<Record<ContentLayerId, ShaderApplication>> {
  const restored: Partial<Record<ContentLayerId, ShaderApplication>> = {};
  for (const [id, application] of Object.entries(savedShaders ?? currentShaders)) {
    const layerId = id as CompositionLayerId;
    if (!allowedIds.has(layerId) || !isContentLayerId(layerId)) continue;
    restored[layerId] = application ? {
        ...application,
        settings: { ...application.settings },
        shaderSize: clampShaderZoom(application.shaderSize),
      } : application;
  }
  return restored;
}

function restoredShaderLayers(
  savedLayers: readonly CompositionShaderLayer[] | undefined,
  currentLayers: readonly CompositionShaderLayer[],
  targetLayerId: ShaderLayerId | null | undefined
): CompositionShaderLayer[] {
  const layers = (savedLayers ?? currentLayers).map((layer) => ({
    ...layer,
    settings: { ...layer.settings },
    shaderSize: clampShaderZoom(layer.shaderSize),
    transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM),
  }));
  if (targetLayerId && !layers.some(({ id }) => id === targetLayerId)) {
    throw new TypeError('Shader sequence target layer does not exist.');
  }
  return layers;
}

function restoredLayerOrder({
  assets,
  effects,
  logos,
  requested,
  shaders,
  text,
}: {
  assets: readonly CompositionAsset[];
  effects: readonly CompositionEffectLayer[];
  logos: readonly CompositionLogoLayer[];
  requested: readonly CompositionLayerId[];
  shaders: readonly CompositionShaderLayer[];
  text: readonly CompositionTextLayer[];
}): CompositionLayerId[] {
  return reconcileDesignLabLayerOrder({
    assets: assets.map(({ id }) => id),
    effects: effects.map(({ id }) => id),
    logos: logos.map(({ id }) => id),
    shaders: shaders.map(({ id }) => id),
    stored: requested,
    text: text.map(({ id }) => id),
  }) as CompositionLayerId[];
}

function resolvedTextTransform(transform: CanvasLayerTransform): CanvasLayerTransform {
  return {
    ...transform,
    heightScale: transform.heightScale ?? 1,
    widthScale: transform.widthScale ?? 1,
  };
}

function resolvedTextAppearance(layer: CompositionTextLayer): TextAppearanceSettings {
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

function resolvedLogoAppearance(settings?: LogoAppearanceSettings): LogoAppearanceSettings {
  return { ...DEFAULT_LOGO_APPEARANCE, ...settings };
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function scrollLayerDockWithWheel(event: ReactWheelEvent<HTMLDivElement>) {
  if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const dock = event.currentTarget;
  const maximumScroll = Math.max(0, dock.scrollWidth - dock.clientWidth);
  if (maximumScroll === 0) return;
  const unit = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? dock.clientWidth
      : 1;
  const nextScroll = Math.max(0, Math.min(maximumScroll, dock.scrollLeft + event.deltaY * unit));
  if (nextScroll === dock.scrollLeft) return;
  event.preventDefault();
  dock.scrollLeft = nextScroll;
}

function textShadowStyle(settings: TextAppearanceSettings): string | undefined {
  if (!settings.shadowEnabled) return undefined;
  return `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${colorWithOpacity(settings.shadowColor, settings.shadowOpacity / 100)}`;
}

function CanvasEditableText({
  className,
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
  className: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const pendingValueRef = useRef<string | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) onChangeRef.current(nextValue);
  }

  function scheduleTextChange(nextValue: string) {
    pendingValueRef.current = nextValue;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(flushTextChange, 140);
  }

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value]);

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  return (
    <span
      aria-label={label}
      aria-multiline='true'
      className={className}
      contentEditable='plaintext-only'
      data-canvas-editable='true'
      onBlur={(event) => {
        pendingValueRef.current = event.currentTarget.innerText.replace(/\r\n/g, '\n');
        flushTextChange();
      }}
      onFocus={onFocus}
      onInput={(event) => scheduleTextChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPointerDown={(event) => {
        if (isAdditiveCanvasSelection(event)) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
      }}
      ref={textRef}
      role='textbox'
      spellCheck
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}

function InspectorTextArea({
  ariaLabel,
  onChange,
  onPreview,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
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

function layerGeometry(layerId: CanvasLayerId, ratio: ShaderRatio): LayerGeometry {
  const canvas = CANVAS_DIMENSIONS[ratio];
  if (isShaderLayerId(layerId)) {
    return {
      baseHeight: canvas.height,
      baseWidth: canvas.width,
      baseX: 0,
      baseY: 0,
    };
  }
  if (isTextLayerId(layerId)) {
    const baseWidth = canvas.width * 0.72;
    const baseHeight = canvas.height * 0.25;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  if (isLogoLayerId(layerId)) {
    const baseWidth = canvas.width * 0.42;
    const baseHeight = canvas.height * 0.32;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  const baseWidth = canvas.width * 0.34;
  const baseHeight = canvas.height * 0.38;
  return {
    baseHeight,
    baseWidth,
    baseX: (canvas.width - baseWidth) / 2,
    baseY: (canvas.height - baseHeight) / 2,
  };
}

const PRIMARY_CONTROLS: readonly {
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

const ADVANCED_CONTROLS: readonly {
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

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '"': '&quot;',
    '&': '&amp;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;',
  })[character] ?? character);
}

function monogramDataUrl(identity: Pick<BrandIdentity, 'shortName'>): string {
  const label = escapeXml(identity.shortName.slice(0, 3).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"><text x="320" y="214" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="164" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paintFallback(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: LiveMaterialSettings
) {
  const gradient = context.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, settings.colorA);
  gradient.addColorStop(0.52, settings.colorB);
  gradient.addColorStop(1, settings.colorC);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function shaderApplicationFor(
  materialId: LiveMaterialId,
  colors: readonly [string, string, string] | readonly string[],
  overrides: Partial<Pick<ShaderApplication, 'blendMode' | 'opacity' | 'shaderSize'>> = {}
): ShaderApplication {
  return {
    blendMode: overrides.blendMode ?? 'normal',
    materialId,
    opacity: overrides.opacity ?? 1,
    settings: shaderLabSettingsFor(materialId, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: colors[0] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorA,
      colorB: colors[1] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorB,
      colorC: colors[2] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorC,
    }),
    shaderSize: clampShaderZoom(overrides.shaderSize ?? 1),
  };
}

function shaderBlendStyle(blendMode: ShaderBlendMode): CSSProperties['mixBlendMode'] {
  return blendMode === 'normal' ? 'normal' : blendMode;
}

function RangeControl({
  formatValue,
  label,
  max,
  min,
  onChange,
  onPreview,
  step,
  value,
}: {
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  step: number;
  value: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const pendingValueRef = useRef<number | null>(null);
  const latestValueRef = useRef<number | null>(null);
  const valueFrameRef = useRef(0);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current && pendingValueRef.current === null && valueFrameRef.current === 0) {
      setDisplayValue(value);
    }
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(valueFrameRef.current), []);

  function flushValue() {
    cancelAnimationFrame(valueFrameRef.current);
    valueFrameRef.current = 0;
    const nextValue = pendingValueRef.current ?? latestValueRef.current;
    pendingValueRef.current = null;
    latestValueRef.current = null;
    if (nextValue === null) return;
    onPreview?.(nextValue);
    onChange(nextValue);
  }

  function scheduleValue(nextValue: number) {
    setDisplayValue(nextValue);
    pendingValueRef.current = nextValue;
    latestValueRef.current = nextValue;
    if (valueFrameRef.current) return;
    valueFrameRef.current = requestAnimationFrame(() => {
      valueFrameRef.current = 0;
      if (pendingValueRef.current === null) return;
      const previewValue = pendingValueRef.current;
      pendingValueRef.current = null;
      (onPreview ?? onChange)(previewValue);
    });
  }

  return (
    <label className='shader-lab-v2-range'>
      <StudioRangeLabel
        label={label}
        value={<output>{formatValue?.(displayValue) ?? (Number.isInteger(step) ? Math.round(displayValue) : displayValue.toFixed(2))}</output>}
      />
      <input
        aria-label={label}
        className='studio-range'
        max={max}
        min={min}
        onBlur={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        onInput={(event) => scheduleValue(Number(event.currentTarget.value))}
        onPointerCancel={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        onPointerDown={() => { scrubbingRef.current = true; }}
        onPointerUp={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        step={step}
        type='range'
        value={displayValue}
      />
    </label>
  );
}

function ShaderZoomControl({
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
  const scrubbingRef = useRef(false);
  const editingEntryRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current && pendingZoomRef.current === null && zoomFrameRef.current === 0) {
      setSliderValue(shaderZoomToSlider(zoom));
      if (!editingEntryRef.current) setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
    }
  }, [zoom]);

  useEffect(() => () => cancelAnimationFrame(zoomFrameRef.current), []);

  function flushZoom() {
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = 0;
    const nextZoom = pendingZoomRef.current ?? latestZoomRef.current;
    pendingZoomRef.current = null;
    latestZoomRef.current = null;
    if (nextZoom === null) return;
    onPreview?.(nextZoom);
    onChange(nextZoom);
  }

  function scheduleZoom(nextSliderValue: number) {
    setSliderValue(nextSliderValue);
    const nextZoom = shaderZoomFromSlider(nextSliderValue);
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    pendingZoomRef.current = nextZoom;
    latestZoomRef.current = nextZoom;
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
    scrubbingRef.current = false;
    const nextZoom = clampShaderZoom(nextValue);
    setSliderValue(shaderZoomToSlider(nextZoom));
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    onPreview?.(nextZoom);
    onChange(nextZoom);
  }

  function commitZoomEntry() {
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
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
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
        <input
          aria-label='Shader zoom slider'
          className='studio-range'
          max={SHADER_ZOOM_SLIDER_MAX}
          min={SHADER_ZOOM_SLIDER_MIN}
          onBlur={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          onInput={(event) => scheduleZoom(Number(event.currentTarget.value))}
          onPointerCancel={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          onPointerDown={() => { scrubbingRef.current = true; }}
          onPointerUp={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          step={SHADER_ZOOM_SLIDER_STEP}
          type='range'
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

function DesignLabEffectInspector({
  previewEffectLayer,
  selectEffectPreset,
  selectedEffectLayer,
  updateEffectLayer,
}: {
  previewEffectLayer: (
    id: EffectLayerId,
    update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }
  ) => void;
  selectEffectPreset: (layer: CompositionEffectLayer, kind: CompositionEffectKind) => void;
  selectedEffectLayer: CompositionEffectLayer;
  updateEffectLayer: (
    id: EffectLayerId,
    update: Partial<Omit<CompositionEffectLayer, 'id'>>
  ) => void;
}) {
  return <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-effect-inspector' meta='Post-process' title='Converter'>
    <div className='shader-lab-v2-effect-presets' aria-label='Converter type'>
      {COMPOSITION_EFFECT_PRESETS.map((preset) => (
        <button
          aria-pressed={selectedEffectLayer.settings.kind === preset.kind}
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
        <input
          checked={selectedEffectLayer.settings.invert}
          onChange={(event) => updateEffectLayer(selectedEffectLayer.id, {
            settings: { ...selectedEffectLayer.settings, invert: event.target.checked },
          })}
          type='checkbox'
        />
      </label>
    </div>
  </LabInspectorSection>;
}

const ShaderMaterialCard = memo(function ShaderMaterialCard({
  material,
  onSelect,
  selected,
}: {
  material: LiveMaterialOption;
  onSelect: (materialId: LiveMaterialId) => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className='shader-lab-v2-material-card'
      onClick={() => onSelect(material.id)}
      type='button'
    >
      <span className='shader-lab-v2-material-preview'>
        <AuthenticShaderPreview materialId={material.id} />
        <LiveMaterialSourceTag material={material} />
      </span>
      <span className='shader-lab-v2-material-copy'>
        <strong>{material.name}</strong>
      </span>
    </button>
  );
});

function selectedCanvasLayerElement(selectedLayerCount: number): HTMLElement | null {
  if (selectedLayerCount !== 1) return null;
  return document.querySelector<HTMLElement>('.editable-canvas-layer[aria-selected="true"]');
}

function syncSelectedCanvasLayerOverlay(layer: HTMLElement) {
  const overlay = document.querySelector<HTMLElement>('.editable-canvas-layer-selection');
  if (!overlay) return;
  const bounds = layer.getBoundingClientRect();
  overlay.style.left = `${bounds.left}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${bounds.width}px`;
  overlay.style.height = `${bounds.height}px`;
}

function previewSelectedTextStyle(
  selectedLayerCount: number,
  property: keyof CSSStyleDeclaration,
  value: string
) {
  const layer = selectedCanvasLayerElement(selectedLayerCount);
  const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
  if (!text) return;
  Reflect.set(text.style, property, value);
}

function dataTransferHasFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files');
}

function layerKind(id: CompositionLayerId) {
  if (isShaderLayerId(id)) return 'Shader';
  if (isEffectLayerId(id)) return 'Converter';
  if (isLogoLayerId(id)) return 'Brand mark';
  if (isTextLayerId(id)) return 'Editable text';
  return 'Image';
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  context.drawImage(
    source,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight
  );
}

function createContainedLayer(
  image: HTMLImageElement,
  width: number,
  height: number,
  color?: string,
  fillFrame = false
) {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(width));
  layer.height = Math.max(1, Math.round(height));
  const layerContext = layer.getContext('2d');
  if (!layerContext) return layer;
  if (fillFrame) {
    layerContext.drawImage(image, 0, 0, layer.width, layer.height);
  } else {
    const bounds = previewContainedImageBounds({
      boxHeight: layer.height,
      boxWidth: layer.width,
      imageHeight: image.naturalHeight || 1,
      imageWidth: image.naturalWidth || 1,
    });
    drawContained(
      layerContext,
      image,
      image.naturalWidth || 1,
      image.naturalHeight || 1,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
  }
  if (color) {
    layerContext.globalCompositeOperation = 'source-in';
    layerContext.fillStyle = color;
    layerContext.fillRect(0, 0, layer.width, layer.height);
  }
  return layer;
}

function resetTextEffectContext(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const scratchContext = canvas.getContext('2d');
  if (!scratchContext) return null;
  scratchContext.setTransform(1, 0, 0, 1, 0, 0);
  scratchContext.clearRect(0, 0, width, height);
  scratchContext.filter = 'none';
  scratchContext.globalAlpha = 1;
  scratchContext.globalCompositeOperation = 'source-over';
  scratchContext.shadowBlur = 0;
  scratchContext.shadowColor = 'transparent';
  scratchContext.shadowOffsetX = 0;
  scratchContext.shadowOffsetY = 0;
  return scratchContext;
}

type OutputLayerBox = { height: number; width: number; x: number; y: number };
type PaintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => void;

function paintSolidDesignLabText(
  context: CanvasRenderingContext2D,
  appearance: TextAppearanceSettings,
  pattern: CanvasPattern | null,
  paintTextLines: PaintTextLines
) {
  context.fillStyle = pattern ?? appearance.color;
  if (appearance.shadowEnabled) {
    context.shadowBlur = appearance.shadowBlur;
    context.shadowColor = colorWithOpacity(appearance.shadowColor, appearance.shadowOpacity / 100);
    context.shadowOffsetX = appearance.shadowOffsetX;
    context.shadowOffsetY = appearance.shadowOffsetY;
  }
  if (appearance.outlineEnabled) paintTextLines(context, 'stroke');
  paintTextLines(context, 'fill');
}

function paintDesignLabTextShadow({
  appearance,
  context,
  height,
  paintTextLines,
  shadowLayer,
  width,
}: {
  appearance: TextAppearanceSettings;
  context: CanvasRenderingContext2D;
  height: number;
  paintTextLines: PaintTextLines;
  shadowLayer: HTMLCanvasElement;
  width: number;
}) {
  if (!appearance.shadowEnabled) return;
  const shadowContext = resetTextEffectContext(shadowLayer, width, height);
  if (!shadowContext) return;
  const shadowColor = colorWithOpacity(appearance.shadowColor, appearance.shadowOpacity / 100);
  shadowContext.fillStyle = shadowColor;
  shadowContext.shadowBlur = appearance.shadowBlur;
  shadowContext.shadowColor = shadowColor;
  shadowContext.shadowOffsetX = appearance.shadowOffsetX;
  shadowContext.shadowOffsetY = appearance.shadowOffsetY;
  paintTextLines(shadowContext, 'fill');
  shadowContext.globalCompositeOperation = 'destination-out';
  shadowContext.shadowColor = 'transparent';
  shadowContext.shadowBlur = 0;
  shadowContext.shadowOffsetX = 0;
  shadowContext.shadowOffsetY = 0;
  paintTextLines(shadowContext, 'fill');
  context.drawImage(shadowLayer, 0, 0);
}

function paintDesignLabTextEffectFill({
  appearance,
  box,
  canvasWidth,
  context,
  fillLayer,
  height,
  materialLayer,
  paintTextLines,
  textMask,
  width,
}: {
  appearance: TextAppearanceSettings;
  box: OutputLayerBox;
  canvasWidth: number;
  context: CanvasRenderingContext2D;
  fillLayer: HTMLCanvasElement;
  height: number;
  materialLayer: HTMLCanvasElement | null;
  paintTextLines: PaintTextLines;
  textMask: HTMLCanvasElement;
  width: number;
}) {
  const textMaskContext = resetTextEffectContext(textMask, width, height);
  const fillContext = resetTextEffectContext(fillLayer, width, height);
  if (!textMaskContext || !fillContext) return;
  if (appearance.textEffect.kind !== 'gradient') {
    context.fillStyle = appearance.textEffect.backgroundColor;
    paintTextLines(context, 'fill');
  }
  textMaskContext.fillStyle = '#FFFFFF';
  paintTextLines(textMaskContext, 'fill');
  applyTextEffectMask(textMaskContext, box, appearance.textEffect, width / canvasWidth);
  if (materialLayer) {
    fillContext.drawImage(materialLayer, box.x, box.y, box.width, box.height);
    fillContext.globalCompositeOperation = 'color';
  }
  fillContext.fillStyle = appearance.textEffect.kind === 'gradient'
    ? createTextEffectGradient(fillContext, box, appearance.textEffect, appearance.color)
    : appearance.color;
  fillContext.fillRect(box.x, box.y, box.width, box.height);
  fillContext.globalCompositeOperation = 'destination-in';
  fillContext.drawImage(textMask, 0, 0);
  context.drawImage(fillLayer, 0, 0);
}

function paintDesignLabTextLayer({
  application,
  box,
  canvasWidth,
  context,
  height,
  identity,
  layer,
  paintShaderApplication,
  textEffectScratch,
  width,
}: {
  application?: ShaderApplication;
  box: OutputLayerBox;
  canvasWidth: number;
  context: CanvasRenderingContext2D;
  height: number;
  identity: BrandIdentity;
  layer: CompositionTextLayer;
  paintShaderApplication: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    instanceKey: string,
    application: ShaderApplication
  ) => void;
  textEffectScratch: TextEffectRenderScratch;
  width: number;
}) {
  if (!layer.value) return;
  const transform = resolvedTextTransform(layer.transform);
  const appearance = resolvedTextAppearance(layer);
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  const fontSize = Math.max(18, height * 0.17 * transform.scale);
  const lineHeight = fontSize * layer.lineHeight;
  const spacing = layer.tracking * fontSize;
  const fontWeight = resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight);
  const fontFamily = `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, Arial, sans-serif`;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.fontKerning = 'normal';
  const supportsNativeLetterSpacing = typeof context.letterSpacing === 'string';
  if (supportsNativeLetterSpacing) context.letterSpacing = `${spacing}px`;
  const measureText = (text: string) => context.measureText(text).width;
  const lines = layoutCanvasText(
    layer.value,
    box.width,
    measureText,
    spacing,
    layer.wrap,
    supportsNativeLetterSpacing ? measureText : undefined
  );
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const lineBoxBaseline = (lineHeight - ascent - descent) / 2 + ascent;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const firstBaseline = box.y + Math.max(0, (box.height - totalHeight) / 2) + lineBoxBaseline;
  let materialLayer: HTMLCanvasElement | null = null;
  let pattern: CanvasPattern | null = null;
  if (application) {
    materialLayer = document.createElement('canvas');
    materialLayer.width = Math.max(1, Math.round(box.width));
    materialLayer.height = Math.max(1, Math.round(box.height));
    const materialContext = materialLayer.getContext('2d');
    if (materialContext) {
      paintShaderApplication(
        materialContext,
        materialLayer.width,
        materialLayer.height,
        `content-${layer.id}`,
        application
      );
      pattern = context.createPattern(materialLayer, 'repeat');
      pattern?.setTransform(new DOMMatrix().translate(box.x, box.y));
    }
  }
  context.globalAlpha = appearance.opacity * (application?.opacity ?? 1);
  context.globalCompositeOperation = application?.blendMode && application.blendMode !== 'normal'
    ? application.blendMode
    : 'source-over';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(0.5, appearance.outlineWidth * 2);
  context.strokeStyle = appearance.outlineColor;

  const configureTextContext = (target: CanvasRenderingContext2D) => {
    target.textAlign = 'left';
    target.textBaseline = 'alphabetic';
    target.font = context.font;
    target.fontKerning = 'normal';
    if (supportsNativeLetterSpacing) target.letterSpacing = `${spacing}px`;
    target.lineJoin = 'round';
    target.lineWidth = context.lineWidth;
    target.strokeStyle = appearance.outlineColor;
  };
  const paintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => {
    configureTextContext(target);
    lines.forEach((line, lineIndex) => {
      const baseline = firstBaseline + lineIndex * lineHeight;
      if (supportsNativeLetterSpacing) {
        const lineWidth = measureText(line);
        const lineX = canvasTextLineX(layer.align, box.x, box.width, lineWidth);
        if (mode === 'stroke') target.strokeText(line, lineX, baseline);
        else target.fillText(line, lineX, baseline);
        return;
      }
      const characters = canvasTextCharacters(line);
      const lineWidth = trackedTextWidth(line, measureText, spacing);
      let cursor = canvasTextLineX(layer.align, box.x, box.width, lineWidth);
      characters.forEach((character) => {
        if (mode === 'stroke') target.strokeText(character, cursor, baseline);
        else target.fillText(character, cursor, baseline);
        cursor += measureText(character) + spacing;
      });
    });
  };

  if (appearance.textEffect.kind === 'solid') {
    paintSolidDesignLabText(context, appearance, pattern, paintTextLines);
    context.restore();
    return;
  }

  paintDesignLabTextShadow({
    appearance,
    context,
    height,
    paintTextLines,
    shadowLayer: textEffectScratch.shadow,
    width,
  });
  if (appearance.outlineEnabled) paintTextLines(context, 'stroke');
  paintDesignLabTextEffectFill({
    appearance,
    box,
    canvasWidth,
    context,
    fillLayer: textEffectScratch.fill,
    height,
    materialLayer,
    paintTextLines,
    textMask: textEffectScratch.mask,
    width,
  });
  context.restore();
}

function designAutomationExportInput(input: unknown): DesignAutomationExportInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('design.export requires { format, mode?, download? }.');
  }
  const { download, format, mode } = input as { download?: unknown; format?: unknown; mode?: unknown };
  if (!['gif', 'jpg', 'mp4', 'png'].includes(String(format))) {
    throw new TypeError('design.export format must be png, jpg, gif, or mp4.');
  }
  if (mode !== undefined && mode !== 'standard' && mode !== 'shader-sequence') {
    throw new TypeError('design.export mode must be standard or shader-sequence.');
  }
  if (download !== undefined && typeof download !== 'boolean') {
    throw new TypeError('design.export download must be Boolean.');
  }
  if (mode === 'shader-sequence' && format !== 'gif' && format !== 'mp4') {
    throw new TypeError('Shader-sequence export supports GIF or MP4.');
  }
  return {
    download: download as boolean | undefined,
    format: format as DesignAutomationExportInput['format'],
    mode,
  };
}

type DesignAutomationHandlers = {
  exportForAutomation: (request: DesignAutomationExportInput) => Promise<ExportPreviewAsset>;
  normalizedShaderSequenceSettings: DesignShaderSequenceSettings;
  previewShaderSequence: () => void;
  sequencePreviewing: boolean;
  shaderSequenceDuration: number;
  shaderSequenceTimeline: ReturnType<typeof buildShaderSequenceTimeline>;
  stopShaderSequencePreview: () => void;
  updateShaderSequenceSettings: (patch: Partial<DesignShaderSequenceSettings>) => void;
};

const DESIGN_AUTOMATION_EXPORT_REQUESTS: Readonly<Record<string, DesignAutomationExportInput>> = {
  'design.export.gif': { format: 'gif' },
  'design.export.jpg': { format: 'jpg' },
  'design.export.mp4': { format: 'mp4' },
  'design.export.png': { format: 'png' },
  'design.export.shader-sequence.gif': { format: 'gif', mode: 'shader-sequence' },
  'design.export.shader-sequence.mp4': { format: 'mp4', mode: 'shader-sequence' },
};

async function invokeDesignAutomationAction(handlers: DesignAutomationHandlers, action: string, input: unknown) {
  switch (action) {
    case 'design.sequence.describe':
      return {
        durationMs: handlers.shaderSequenceDuration,
        materials: handlers.shaderSequenceTimeline,
        settings: handlers.normalizedShaderSequenceSettings,
      };
    case 'design.sequence.configure':
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('design.sequence.configure requires a settings object.');
      }
      handlers.updateShaderSequenceSettings(input as Partial<DesignShaderSequenceSettings>);
      return null;
    case 'design.sequence.preview':
      if (!handlers.sequencePreviewing) handlers.previewShaderSequence();
      return null;
    case 'design.sequence.stop':
      if (handlers.sequencePreviewing) handlers.stopShaderSequencePreview();
      return null;
    case 'design.export':
      return handlers.exportForAutomation(designAutomationExportInput(input));
    default: {
      const request = DESIGN_AUTOMATION_EXPORT_REQUESTS[action];
      if (!request) throw new RangeError(`Unknown Design Lab action: ${action}.`);
      return handlers.exportForAutomation(request);
    }
  }
}

type RenderLiveMaterial = (application: ShaderApplication, instanceKey: string) => ReactNode;

function canvasMediaMaskStyle(url: string, fillFrame = false): CSSProperties {
  const maskSize = fillFrame ? '100% 100%' : 'contain';
  return {
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: maskSize,
    maskImage: `url("${url}")`,
    maskMode: 'alpha',
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize,
  };
}

function ShaderMaskedMediaContent({
  application,
  appearance: appearanceSettings,
  fallbackColor,
  instanceKey,
  label,
  opacity,
  preserveColors = false,
  renderMaterial,
  url,
}: {
  application?: ShaderApplication;
  appearance?: LogoAppearanceSettings;
  fallbackColor: string;
  instanceKey: string;
  label: string;
  opacity: number;
  preserveColors?: boolean;
  renderMaterial: RenderLiveMaterial;
  url: string;
}) {
  const appearance = resolvedLogoAppearance(appearanceSettings);
  if (!application && preserveColors) {
    return (
      <AppearanceFilteredContent
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview shader-lab-v2-asset-preview'
        opacity={opacity}
        settings={appearance}
      >
        {/* The canvas frame already carries the imported image's aspect ratio. */}
        <img alt='' className='shader-lab-v2-layer-image' draggable={false} src={url} />
      </AppearanceFilteredContent>
    );
  }
  if (!application) {
    return (
      <LogoAppearancePreview
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview'
        color={fallbackColor}
        logoPath={url}
        opacity={opacity}
        preserveColors={preserveColors}
        settings={appearance}
      />
    );
  }
  return (
    <div
      className='shader-lab-v2-appearance-preview shader-lab-v2-appearance-stack'
      style={{
        mixBlendMode: shaderBlendStyle(application.blendMode),
        opacity: opacity * application.opacity,
      }}
    >
      {appearance.borderEnabled ? (
        <LogoAppearancePreview
          ariaLabel={`${label} silhouette effects`}
          className='shader-lab-v2-appearance-stack-layer'
          color={appearance.borderColor}
          fillFrame={preserveColors}
          logoPath={url}
          settings={{
            ...appearance,
            ditherEnabled: false,
            invert: false,
            shadowEnabled: false,
          }}
          showSource={false}
        />
      ) : null}
      <AppearanceFilteredContent
        ariaLabel={`${label} material`}
        className='shader-lab-v2-appearance-stack-layer'
        settings={{ ...appearance, borderEnabled: false }}
      >
        <div
          className='shader-lab-v2-layer-logo-mask'
          data-shader-instance={instanceKey}
          style={canvasMediaMaskStyle(url, preserveColors)}
        >
          {renderMaterial(application, instanceKey)}
        </div>
      </AppearanceFilteredContent>
    </div>
  );
}

function CanvasTextLayerContent({
  application,
  fontSizeCqw,
  identity,
  layer,
  onChange,
  onFocus,
  renderMaterial,
}: {
  application?: ShaderApplication;
  fontSizeCqw: number;
  identity: BrandIdentity;
  layer: CompositionTextLayer;
  onChange: (value: string) => void;
  onFocus: () => void;
  renderMaterial: RenderLiveMaterial;
}) {
  const appearance = resolvedTextAppearance(layer);
  const instanceKey = `content-${layer.id}`;
  const materialImage = application ? `url("${shaderPreviewAssetPath(application.materialId)}")` : undefined;
  return (
    <>
      {application ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 opacity-0'
          data-shader-instance={instanceKey}
        >
          {renderMaterial(application, instanceKey)}
        </div>
      ) : null}
      <CanvasEditableText
        className={`shader-lab-v2-layer-text ${application ? 'shader-lab-v2-layer-text-material' : ''}`}
        label={`Edit ${layer.name}`}
        onChange={onChange}
        onFocus={onFocus}
        style={{
          caretColor: appearance.color,
          color: appearance.color,
          fontFamily: `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, Arial, sans-serif`,
          fontSize: `${fontSizeCqw}cqw`,
          fontWeight: resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight),
          justifyContent: layer.align === 'left' ? 'flex-start' : layer.align === 'right' ? 'flex-end' : 'center',
          letterSpacing: `${layer.tracking}em`,
          lineHeight: layer.lineHeight,
          mixBlendMode: application ? shaderBlendStyle(application.blendMode) : undefined,
          opacity: appearance.opacity * (application?.opacity ?? 1),
          overflowWrap: layer.wrap === 'wrap' ? 'anywhere' : 'normal',
          textAlign: layer.align,
          textShadow: textShadowStyle(appearance),
          WebkitTextStroke: appearance.outlineEnabled
            ? `${appearance.outlineWidth}px ${appearance.outlineColor}`
            : undefined,
          whiteSpace: layer.wrap === 'wrap' ? 'pre-wrap' : 'pre',
          ...textEffectCssStyle(appearance.textEffect, appearance.color, materialImage),
        }}
        value={layer.value}
      />
    </>
  );
}

function resolveDesignLabBrandLogo(identity: BrandIdentity): string {
  return brandAssetPath(identity, 'mark-light')
    ?? brandAssetPath(identity, 'logo-light')
    ?? brandAssetPath(identity, 'mark-dark')
    ?? monogramDataUrl(identity);
}

function resolveShaderSequencePresentation(
  shaderLayers: CompositionShaderLayer[],
  settings: DesignShaderSequenceSettings,
  normalizedSettings: ShaderSequenceSettings
) {
  const targetLayer = shaderLayers.find(({ id, visible }) => visible && id === settings.targetLayerId)
    ?? shaderLayers.find(({ visible }) => visible)
    ?? null;
  const resolvedSettings = {
    ...normalizedSettings,
    targetLayerId: targetLayer?.id ?? null,
  };
  const targetOptions: Array<{ label: string; value: ShaderLayerId }> = [];
  for (const { id, name, visible } of shaderLayers) {
    if (visible) targetOptions.push({ label: name, value: id });
  }
  const materialIds = targetLayer
    ? shaderSequenceMaterialIds(targetLayer.materialId, resolvedSettings.cutCount)
    : [];
  const timeline = materialIds.length > 1
    ? buildShaderSequenceTimeline(materialIds, resolvedSettings)
    : [];
  return {
    duration: shaderSequenceDurationMs(timeline),
    materialIds,
    settings: resolvedSettings,
    targetLayer,
    targetOptions,
    timeline,
  };
}

function resolveShaderEditingSelection({
  initialSettings,
  layerShaders,
  selectedLayerId,
  shaderLayers,
}: {
  initialSettings: LiveMaterialSettings;
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  selectedLayerId: CompositionLayerId | null;
  shaderLayers: CompositionShaderLayer[];
}) {
  const shaderLayer = isShaderLayerId(selectedLayerId)
    ? shaderLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const contentLayerId = isContentLayerId(selectedLayerId) ? selectedLayerId : null;
  const layerShader = contentLayerId ? layerShaders[contentLayerId] ?? null : null;
  const editingShader = shaderLayer ?? layerShader;
  const previewChannel = shaderLayer
    ? `canvas-${shaderLayer.id}`
    : contentLayerId
      ? `content-${contentLayerId}`
      : null;
  const activeMaterialId = normalizeLiveMaterialId(
    editingShader?.materialId ?? shaderLayers.at(-1)?.materialId ?? DEFAULT_SHADER_MATERIAL_ID
  );
  return {
    activeMaterialId,
    contentLayerId,
    editingShader,
    layerShader,
    material: getLiveMaterial(activeMaterialId),
    previewChannel,
    settings: editingShader?.settings ?? initialSettings,
    shaderLayer,
    shaderSize: clampShaderZoom(editingShader?.shaderSize ?? 1),
  };
}

function resolveContentLayerSelection({
  assets,
  identity,
  logos,
  selectedLayerId,
  textLayers,
}: {
  assets: CompositionAsset[];
  identity: BrandIdentity;
  logos: CompositionLogoLayer[];
  selectedLayerId: CompositionLayerId | null;
  textLayers: CompositionTextLayer[];
}) {
  const textLayer = isTextLayerId(selectedLayerId)
    ? textLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const textTransform = textLayer ? resolvedTextTransform(textLayer.transform) : null;
  const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
  const textWeightRange = textAppearance
    ? brandTypographyWeightRange(identity, textAppearance.fontRole)
    : { max: 900, min: 100 };
  const textRenderedWeight = textLayer && textAppearance
    ? resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight)
    : 400;
  const logoLayer = isLogoLayerId(selectedLayerId)
    ? logos.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const asset = isAssetLayerId(selectedLayerId)
    ? assets.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  return {
    asset,
    assetAppearance: asset ? resolvedLogoAppearance(asset.appearance) : null,
    assetInspector: asset ? {
      appearance: resolvedLogoAppearance(asset.appearance),
      asset,
    } : null,
    logoAppearance: logoLayer ? resolvedLogoAppearance(logoLayer.appearance) : null,
    logoInspector: logoLayer ? {
      appearance: resolvedLogoAppearance(logoLayer.appearance),
      layer: logoLayer,
    } : null,
    logoLayer,
    textAppearance,
    textInspector: textLayer && textAppearance && textTransform ? {
      appearance: textAppearance,
      layer: textLayer,
      transform: textTransform,
    } : null,
    textLayer,
    textRenderedWeight,
    textTransform,
    textWeightRange,
  };
}

type SelectedTextInspector = NonNullable<ReturnType<typeof resolveContentLayerSelection>['textInspector']>;
type TextAppearancePreviewPatch = Partial<Omit<TextAppearanceSettings, 'textEffect'>> & {
  textEffect?: Partial<TextEffectSettings>;
};

function DesignLabTextLayerInspector({
  canvasHeight,
  canvasWidth,
  identity,
  previewSelectedContentOpacity,
  previewSelectedTextAppearance,
  previewSelectedTextWidth,
  selectedCanvasLayerCount,
  selection,
  textRenderedWeight,
  textWeightRange,
  updateTextLayer,
}: {
  canvasHeight: number;
  canvasWidth: number;
  identity: BrandIdentity;
  previewSelectedContentOpacity: (value: number) => void;
  previewSelectedTextAppearance: (patch: TextAppearancePreviewPatch) => void;
  previewSelectedTextWidth: (value: number) => void;
  selectedCanvasLayerCount: number;
  selection: SelectedTextInspector;
  textRenderedWeight: number;
  textWeightRange: { max: number; min: number };
  updateTextLayer: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
}) {
  const {
    appearance: selectedTextAppearance,
    layer: selectedTextLayer,
    transform: selectedTextTransform,
  } = selection;
  return <>
    <label className='shader-lab-v2-text-input'>
      <Type aria-hidden='true' />
      <InspectorTextArea
        ariaLabel={`${selectedTextLayer.name} content`}
        onChange={(value) => updateTextLayer(selectedTextLayer.id, { value })}
        onPreview={(value) => {
          const text = selectedCanvasLayerElement(selectedCanvasLayerCount)
            ?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
          if (text) text.innerText = value;
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
            label: `${role} · ${brandTypographyFamily(identity, role)}`,
            value: role,
          }))}
          value={selectedTextAppearance.fontRole}
        />
      </label>
      <ColorControl
        ariaLabel='Text color'
        label='Text color'
        onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
        onPreview={(color) => previewSelectedTextAppearance({ color })}
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
              type='button'
            >
              {value === 'wrap' ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>
      <div className='shader-lab-v2-text-options'>
        <span>Align</span>
        <div>
          {(['left', 'center', 'right'] as const).map((value) => (
            <button
              aria-pressed={selectedTextLayer.align === value}
              key={value}
              onClick={() => updateTextLayer(selectedTextLayer.id, { align: value })}
              type='button'
            >
              {value[0]!.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Text size'
        max={3}
        min={0.2}
        onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
          transform: { ...selectedTextTransform, scale },
        })}
        onPreview={(scale) => previewSelectedTextStyle(
          selectedCanvasLayerCount,
          'fontSize',
          `${canvasHeight / canvasWidth * 17 * scale}cqw`
        )}
        step={0.05}
        value={selectedTextTransform.scale}
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
        onPreview={(lineHeight) => previewSelectedTextStyle(selectedCanvasLayerCount, 'lineHeight', String(lineHeight))}
        step={0.05}
        value={selectedTextLayer.lineHeight}
      />
      <RangeControl
        formatValue={(value) => String(Math.round(value))}
        label='Font weight'
        max={textWeightRange.max}
        min={textWeightRange.min}
        onChange={(weight) => updateTextLayer(selectedTextLayer.id, {
          weight: resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, weight),
        })}
        onPreview={(weight) => previewSelectedTextStyle(selectedCanvasLayerCount, 'fontWeight', String(weight))}
        step={textWeightRange.max - textWeightRange.min <= 100 ? 100 : 50}
        value={textRenderedWeight}
      />
      <RangeControl
        formatValue={(value) => `${value.toFixed(2)}em`}
        label='Tracking'
        max={0.2}
        min={-0.12}
        onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })}
        onPreview={(tracking) => previewSelectedTextStyle(selectedCanvasLayerCount, 'letterSpacing', `${tracking}em`)}
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
                onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
                onPreview={(color) => previewSelectedTextAppearance({ color })}
                value={selectedTextAppearance.color}
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
        <label><span>Text outline</span><input checked={selectedTextAppearance.outlineEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} type='checkbox' /></label>
        {selectedTextAppearance.outlineEnabled ? <>
          <ColorControl ariaLabel='Text outline color' label='Outline color' onChange={(outlineColor) => updateTextLayer(selectedTextLayer.id, { outlineColor })} onPreview={(outlineColor) => previewSelectedTextAppearance({ outlineColor })} value={selectedTextAppearance.outlineColor} />
          <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} onPreview={(outlineWidth) => previewSelectedTextAppearance({ outlineWidth })} step={0.5} value={selectedTextAppearance.outlineWidth} />
        </> : null}
      </div>
      <div className='shader-lab-v2-effect-group'>
        <label><span>Text shadow</span><input checked={selectedTextAppearance.shadowEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} type='checkbox' /></label>
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
}

function DesignLabShaderInspector({
  brandPalette,
  editingShader,
  initialSettings,
  material,
  previewChannel,
  previewSelectedShaderOpacity,
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
  previewChannel: string | null;
  previewSelectedShaderOpacity: (value: number) => void;
  previewSelectedShaderSetting: (key: keyof LiveMaterialSettings, value: number) => void;
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
            onPreview={(color) => {
              if (previewChannel) previewLiveMaterialSettings(previewChannel, { [key]: color });
            }}
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

    <LabInspectorSection className='shader-lab-v2-control-section' meta='Essentials' title='Shader settings'>
      <div className='shader-lab-v2-ranges'>
        <ShaderZoomControl
          onChange={(value) => updateSelectedShader({ shaderSize: value })}
          onPreview={(value) => {
            if (previewChannel) previewLiveMaterialPatternScale(previewChannel, value);
          }}
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
                aria-pressed={editingShader.blendMode === value}
                key={value}
                onClick={() => updateSelectedShader({ blendMode: value })}
                type='button'
              >
                {value.slice(0, 3)}
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
        {PRIMARY_CONTROLS.map((control) => (
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
}

function DesignLabShaderFrameInspector({
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
}

type DesignLabCanvasSelectionInput = {
  canvasDimensions: { height: number; width: number };
  compositionAssets: CompositionAsset[];
  duplicateLayer: (id: CompositionLayerId) => CompositionLayerId | null;
  layerGroups: CompositionLayerGroup[];
  layerGroupByLayerId: ReadonlyMap<CanvasLayerId, CompositionLayerGroup>;
  layerOrder: CompositionLayerId[];
  layerVisible: (id: CompositionLayerId) => boolean;
  logoLayers: CompositionLogoLayer[];
  ratio: ShaderRatio;
  removeLayer: (id: CompositionLayerId) => void;
  selectedCanvasLayerIds: CanvasLayerId[];
  setCompositionAssets: Dispatch<SetStateAction<CompositionAsset[]>>;
  setLayerGroups: Dispatch<SetStateAction<CompositionLayerGroup[]>>;
  setLayerOrder: Dispatch<SetStateAction<CompositionLayerId[]>>;
  setLogoLayers: Dispatch<SetStateAction<CompositionLogoLayer[]>>;
  setSelectedCanvasLayerIds: Dispatch<SetStateAction<CanvasLayerId[]>>;
  setSelectedLayerId: Dispatch<SetStateAction<CompositionLayerId | null>>;
  setSelectionMenuPosition: Dispatch<SetStateAction<CanvasSelectionMenuPosition | null>>;
  setShaderLayers: Dispatch<SetStateAction<CompositionShaderLayer[]>>;
  setTextLayers: Dispatch<SetStateAction<CompositionTextLayer[]>>;
  shaderLayers: CompositionShaderLayer[];
  textLayers: CompositionTextLayer[];
};

type DesignLabLayerActionsInput = {
  compositionAssets: CompositionAsset[];
  effectLayers: CompositionEffectLayer[];
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  logoLayers: CompositionLogoLayer[];
  removeAsset: (id: AssetLayerId) => void;
  removeEffectLayer: (id: EffectLayerId) => void;
  removeLogoLayer: (id: LogoLayerId) => void;
  removeTextLayer: (id: TextLayerId) => void;
  selectedContentLayerId: ContentLayerId | null;
  setCompositionAssets: Dispatch<SetStateAction<CompositionAsset[]>>;
  setEffectLayers: Dispatch<SetStateAction<CompositionEffectLayer[]>>;
  setLayerOrder: Dispatch<SetStateAction<CompositionLayerId[]>>;
  setLayerShaders: Dispatch<SetStateAction<Partial<Record<ContentLayerId, ShaderApplication>>>>;
  setLogoLayers: Dispatch<SetStateAction<CompositionLogoLayer[]>>;
  setSelectedLayerId: Dispatch<SetStateAction<CompositionLayerId | null>>;
  setShaderLayers: Dispatch<SetStateAction<CompositionShaderLayer[]>>;
  setTextLayers: Dispatch<SetStateAction<CompositionTextLayer[]>>;
  shaderLayers: CompositionShaderLayer[];
  textLayers: CompositionTextLayer[];
  toggleTextLayerVisibility: (layer: CompositionTextLayer) => void;
};

function useDesignLabLayerActions({
  compositionAssets,
  effectLayers,
  layerShaders,
  logoLayers,
  removeAsset,
  removeEffectLayer,
  removeLogoLayer,
  removeTextLayer,
  selectedContentLayerId,
  setCompositionAssets,
  setEffectLayers,
  setLayerOrder,
  setLayerShaders,
  setLogoLayers,
  setSelectedLayerId,
  setShaderLayers,
  setTextLayers,
  shaderLayers,
  textLayers,
  toggleTextLayerVisibility,
}: DesignLabLayerActionsInput) {
  function placeLayerAfter(sourceId: CompositionLayerId, nextId: CompositionLayerId) {
    setLayerOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      if (sourceIndex < 0) return [...current, nextId];
      return [...current.slice(0, sourceIndex + 1), nextId, ...current.slice(sourceIndex + 1)];
    });
    setSelectedLayerId(nextId);
  }

  function placeDuplicatedContentLayer<LayerId extends ContentLayerId>(sourceId: LayerId, nextId: LayerId): LayerId {
    const sourceShader = layerShaders[sourceId];
    if (sourceShader) {
      setLayerShaders((current) => ({
        ...current,
        [nextId]: { ...sourceShader, settings: { ...sourceShader.settings } },
      }));
    }
    placeLayerAfter(sourceId, nextId);
    return nextId;
  }

  function duplicateShaderLayer(id: ShaderLayerId): ShaderLayerId | null {
    const source = shaderLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const transform = normalizeCanvasLayerTransform(source.transform, DEFAULT_LAYER_TRANSFORM);
    setShaderLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      settings: { ...source.settings },
      transform: {
        ...transform,
        x: transform.x + 32,
        y: transform.y + 32,
      },
    }]);
    placeLayerAfter(id, nextId);
    return nextId;
  }

  function duplicateEffectLayer(id: EffectLayerId): EffectLayerId | null {
    const source = effectLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    setEffectLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      settings: { ...source.settings },
    }]);
    placeLayerAfter(id, nextId);
    return nextId;
  }

  function duplicateTextLayer(id: TextLayerId): TextLayerId | null {
    const source = textLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
    const transform = resolvedTextTransform(source.transform);
    setTextLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      textEffect: source.textEffect ? { ...source.textEffect } : undefined,
      transform: { ...transform, x: transform.x + 32, y: transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateLogoLayer(id: LogoLayerId): LogoLayerId | null {
    const source = logoLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
    setLogoLayers((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      name: `${source.name} copy`,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateImageLayer(id: AssetLayerId): AssetLayerId | null {
    const source = compositionAssets.find((asset) => asset.id === id);
    if (!source) return null;
    const nextId = `asset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AssetLayerId;
    setCompositionAssets((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      name: `${source.name} copy`,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateLayer(id: CompositionLayerId): CompositionLayerId | null {
    if (isShaderLayerId(id)) return duplicateShaderLayer(id);
    if (isEffectLayerId(id)) return duplicateEffectLayer(id);
    if (isTextLayerId(id)) return duplicateTextLayer(id);
    if (isLogoLayerId(id)) return duplicateLogoLayer(id);
    return duplicateImageLayer(id);
  }

  function removeShaderLayer(id: ShaderLayerId) {
    setShaderLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function removeLayer(id: CompositionLayerId) {
    if (isShaderLayerId(id)) removeShaderLayer(id);
    else if (isEffectLayerId(id)) removeEffectLayer(id);
    else if (isLogoLayerId(id)) removeLogoLayer(id);
    else if (isTextLayerId(id)) removeTextLayer(id);
    else removeAsset(id);
  }

  function toggleLayerVisibility(id: CompositionLayerId) {
    if (isShaderLayerId(id)) {
      setShaderLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isEffectLayerId(id)) {
      setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isLogoLayerId(id)) {
      setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      if (layer) toggleTextLayerVisibility(layer);
      return;
    }
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, visible: !asset.visible } : asset));
  }

  function removeShaderFromSelectedContent() {
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[selectedContentLayerId];
      return next;
    });
  }

  function layerLabel(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return shaderLayers.find((layer) => layer.id === id)?.name ?? 'Canvas shader';
    if (isEffectLayerId(id)) return effectLayers.find((layer) => layer.id === id)?.name ?? 'Converter';
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.name ?? 'Mark';
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.name ?? 'Text';
    return compositionAssets.find((asset) => asset.id === id)?.name ?? 'Image';
  }

  return { duplicateLayer, layerLabel, removeLayer, removeShaderFromSelectedContent, toggleLayerVisibility };
}

function useDesignLabCanvasSelection({
  canvasDimensions,
  compositionAssets,
  duplicateLayer,
  layerGroups,
  layerGroupByLayerId,
  layerOrder,
  layerVisible,
  logoLayers,
  ratio,
  removeLayer,
  selectedCanvasLayerIds,
  setCompositionAssets,
  setLayerGroups,
  setLayerOrder,
  setLogoLayers,
  setSelectedCanvasLayerIds,
  setSelectedLayerId,
  setSelectionMenuPosition,
  setShaderLayers,
  setTextLayers,
  shaderLayers,
  textLayers,
}: DesignLabCanvasSelectionInput) {
  const selectedCanvasLayerIdSet = useMemo(
    () => new Set<CanvasLayerId>(selectedCanvasLayerIds),
    [selectedCanvasLayerIds]
  );

  function canvasLayerTransform(id: CanvasLayerId): CanvasLayerTransform | null {
    if (isShaderLayerId(id)) {
      const transform = shaderLayers.find((candidate) => candidate.id === id)?.transform;
      return transform ? normalizeCanvasLayerTransform(transform, DEFAULT_LAYER_TRANSFORM) : null;
    }
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      return layer ? resolvedTextTransform(layer.transform) : null;
    }
    if (isLogoLayerId(id)) {
      return logoLayers.find((candidate) => candidate.id === id)?.transform ?? null;
    }
    return compositionAssets.find((candidate) => candidate.id === id)?.transform ?? null;
  }

  function updateCanvasLayerTransforms(updates: ReadonlyMap<CanvasLayerId, CanvasLayerTransform>) {
    setShaderLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setTextLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setLogoLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setCompositionAssets((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
  }

  function groupForLayer(id: CanvasLayerId) {
    return layerGroupByLayerId.get(id) ?? null;
  }

  function selectableAssemblyFor(id: CanvasLayerId): CanvasLayerId[] {
    const ids = groupForLayer(id)?.layerIds ?? [id];
    return ids.filter(layerVisible);
  }

  function selectCanvasAssembly(id: CanvasLayerId, additive = false) {
    const targetIds = selectableAssemblyFor(id);
    setSelectedCanvasLayerIds((current) => nextCanvasLayerSelection(current, targetIds, id, additive));
    if (additive && targetIds.every((layerId) => selectedCanvasLayerIdSet.has(layerId))) {
      const targetIdSet = new Set(targetIds);
      const remaining = selectedCanvasLayerIds.filter((layerId) => !targetIdSet.has(layerId));
      setSelectedLayerId(remaining.at(-1) ?? null);
    } else {
      setSelectedLayerId(id);
    }
    setSelectionMenuPosition(null);
  }

  function deselectCanvasLayers() {
    setSelectedCanvasLayerIds([]);
    setSelectedLayerId(null);
    setSelectionMenuPosition(null);
  }

  function selectLayerFromStack(id: CompositionLayerId) {
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds(isCanvasLayerId(id) ? selectableAssemblyFor(id) : []);
    setSelectionMenuPosition(null);
  }

  function updateCanvasLayerTransform(id: CanvasLayerId, nextTransform: CanvasLayerTransform) {
    const currentTransform = canvasLayerTransform(id);
    if (!currentTransform) return;
    const selectedIds = selectedCanvasLayerIdSet.has(id)
      ? selectedCanvasLayerIds
      : selectableAssemblyFor(id);
    if (selectedIds.length <= 1) {
      updateCanvasLayerTransforms(new Map([[id, nextTransform]]));
      return;
    }
    const deltaX = nextTransform.x - currentTransform.x;
    const deltaY = nextTransform.y - currentTransform.y;
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    selectedIds.forEach((layerId) => {
      const transform = canvasLayerTransform(layerId);
      if (!transform) return;
      updates.set(layerId, { ...transform, x: transform.x + deltaX, y: transform.y + deltaY });
    });
    updateCanvasLayerTransforms(updates);
  }

  const selectedCanvasItems = selectedCanvasLayerIds.flatMap((layerId): CanvasSelectionItem[] => {
    const transform = canvasLayerTransform(layerId);
    return transform ? [{ geometry: layerGeometry(layerId, ratio), transform }] : [];
  });
  const selectedCanvasBounds = canvasSelectionBounds(selectedCanvasItems);
  const selectedCanvasGroup = layerGroups.find((group) => (
    group.layerIds.length === selectedCanvasLayerIds.length
    && group.layerIds.every((layerId) => selectedCanvasLayerIdSet.has(layerId))
  )) ?? null;
  const selectedGroupedAssemblies = layerGroups.filter((group) => (
    group.layerIds.some((layerId) => selectedCanvasLayerIdSet.has(layerId))
  ));

  function movementBoundsFor(id: CanvasLayerId): CanvasLayerBounds | null {
    const layerIds = selectedCanvasLayerIdSet.has(id) && selectedCanvasLayerIds.length > 1
      ? selectedCanvasLayerIds
      : groupForLayer(id)?.layerIds ?? [];
    if (layerIds.length < 2) return null;
    return canvasSelectionBounds(layerIds.flatMap((layerId): CanvasSelectionItem[] => {
      const transform = canvasLayerTransform(layerId);
      return transform ? [{ geometry: layerGeometry(layerId, ratio), transform }] : [];
    }));
  }

  function openCanvasSelectionMenu(id: CanvasLayerId, event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedCanvasLayerIdSet.has(id)) selectCanvasAssembly(id);
    setSelectionMenuPosition({ x: event.clientX, y: event.clientY });
  }

  function groupCanvasSelection() {
    if (selectedCanvasLayerIds.length < 2) return;
    const layerIds = [...selectedCanvasLayerIds];
    const layerIdSet = new Set(layerIds);
    const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
    setLayerGroups((current) => {
      const nextNumber = current.reduce((largest, group) => {
        const match = /^Group (\d+)$/.exec(group.name);
        return Math.max(largest, Number(match?.[1] ?? 0));
      }, 0) + 1;
      return [
        ...current.filter((group) => !group.layerIds.some((layerId) => layerIdSet.has(layerId))),
        { id, layerIds, name: `Group ${nextNumber}` },
      ];
    });
  }

  function ungroupCanvasSelection() {
    if (selectedCanvasLayerIds.length === 0) return;
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => selectedCanvasLayerIdSet.has(layerId))
    )));
  }

  function alignCanvasAssembly(alignment: CanvasLayerAlignment) {
    if (selectedCanvasItems.length === 0) return;
    const transforms = alignCanvasSelection(
      selectedCanvasItems,
      canvasDimensions.width,
      canvasDimensions.height,
      alignment
    );
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    selectedCanvasLayerIds.forEach((layerId, index) => {
      const transform = transforms[index];
      if (transform) updates.set(layerId, transform);
    });
    updateCanvasLayerTransforms(updates);
  }

  function moveCanvasSelection(direction: -1 | 1) {
    const selected = new Set<CompositionLayerId>(selectedCanvasLayerIds);
    setLayerOrder((current) => {
      const next = [...current];
      if (direction > 0) {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selected.has(next[index]!) && !selected.has(next[index + 1]!)) {
            [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
          }
        }
      } else {
        for (let index = 1; index < next.length; index += 1) {
          if (selected.has(next[index]!) && !selected.has(next[index - 1]!)) {
            [next[index], next[index - 1]] = [next[index - 1]!, next[index]!];
          }
        }
      }
      return next;
    });
  }

  function removeCanvasSelection() {
    if (selectedCanvasLayerIds.length === 0) return;
    const idSet = new Set(selectedCanvasLayerIds);
    selectedCanvasLayerIds.forEach(removeLayer);
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => idSet.has(layerId))
    )));
    deselectCanvasLayers();
  }

  function duplicateCanvasSelection() {
    const sourceIds = layerOrder.filter((layerId): layerId is CanvasLayerId => (
      isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId)
    ));
    const nextIds = sourceIds.flatMap((layerId): CanvasLayerId[] => {
      const nextId = duplicateLayer(layerId);
      return nextId && isCanvasLayerId(nextId) ? [nextId] : [];
    });
    if (nextIds.length === 0) return;
    if (selectedCanvasGroup && nextIds.length > 1) {
      const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
      setLayerGroups((current) => [...current, {
        id,
        layerIds: nextIds,
        name: `${selectedCanvasGroup.name} copy`,
      }]);
    }
    setSelectedCanvasLayerIds(nextIds);
    setSelectedLayerId(nextIds.at(-1) ?? null);
  }

  function handleCanvasAssemblyKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement
      && (event.target.isContentEditable || event.target.closest('input, textarea, select'))
    ) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      if (event.shiftKey) ungroupCanvasSelection();
      else groupCanvasSelection();
      return;
    }
    if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateCanvasSelection();
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedCanvasLayerIds.length > 0) {
      event.preventDefault();
      removeCanvasSelection();
    }
  }

  return {
    alignCanvasAssembly,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    handleCanvasAssemblyKeyDown,
    movementBoundsFor,
    moveCanvasSelection,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    selectCanvasAssembly,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
  };
}

export default function ShaderLabStudio({
  identity,
  navigation,
  onIdentitySave,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  onIdentitySave?: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:design-lab`);
  const brandPalette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const initialSettings = useMemo(() => shaderLabSettingsFor(DEFAULT_SHADER_MATERIAL_ID, {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandPalette.colors[0],
    colorB: brandPalette.colors[1],
    colorC: brandPalette.colors[2],
  }), [brandPalette.colors]);
  const builtInLogo = resolveDesignLabBrandLogo(identity);
  const initialShaderLayer = useMemo<CompositionShaderLayer>(() => ({
    ...shaderApplicationFor(DEFAULT_SHADER_MATERIAL_ID, brandPalette.colors),
    id: DEFAULT_CANVAS_SHADER_ID,
    name: 'Canvas shader 1',
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    visible: true,
  }), [brandPalette.colors]);
  const legacyDefaultShaderLayer = useMemo<CompositionShaderLayer>(() => ({
    ...shaderApplicationFor(LEGACY_DEFAULT_SHADER_MATERIAL_ID, brandPalette.colors),
    id: DEFAULT_CANVAS_SHADER_ID,
    name: 'Canvas shader 1',
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    visible: true,
  }), [brandPalette.colors]);
  const stageRef = useRef<HTMLDivElement>(null);
  const defaultShaderMigrationRef = useRef('');
  const effectCanvasRefs = useRef<Map<EffectLayerId, HTMLCanvasElement>>(new Map());
  const effectScratchRefs = useRef<Map<EffectLayerId, CompositionEffectScratch>>(new Map());
  const effectPreviewBufferRef = useRef<HTMLCanvasElement | null>(null);
  const effectPreviewOverridesRef = useRef<Map<EffectLayerId, {
    opacity?: number;
    settings?: Partial<CompositionEffectSettings>;
  }>>(new Map());
  const textEffectScratchRefs = useRef<Map<TextLayerId, TextEffectRenderScratch>>(new Map());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageImportRequestIdRef = useRef(0);
  const selectMaterialRef = useCommittedRef(selectMaterial);
  const handleMaterialSelect = useCallback((materialId: LiveMaterialId) => {
    selectMaterialRef.current(materialId);
  }, [selectMaterialRef]);
  const convertedAssetLibrary = useConvertedAssets();
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef(0);
  const sequenceCaptureRef = useRef<ShaderSequenceCapture | null>(null);
  const sequencePreviewAnimationRef = useRef(0);
  const sequencePreviewRestorePausedRef = useRef(false);
  const [compositionDocumentCreatedAt] = useState(() => new Date().toISOString());
  const [shaderLayers, setShaderLayers] = useStudioDraft<CompositionShaderLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-shaders',
    [initialShaderLayer]
  );
  const [effectLayers, setEffectLayers] = useStudioDraft<CompositionEffectLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v4-composition-effects',
    []
  );
  const [layerShaders, setLayerShaders] = useStudioDraft<Partial<Record<ContentLayerId, ShaderApplication>>>(
    identity.id,
    tool.id,
    'shader-lab-v3-layer-shaders',
    {}
  );
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'shader-lab-v2-ratio', 'wide');
  const [exportSettings, setExportSettings] = useStudioDraft<DesignExportSettings>(
    identity.id,
    tool.id,
    'shader-lab-v3-export-settings',
    DEFAULT_EXPORT_SETTINGS
  );
  const [shaderSequenceSettings, setShaderSequenceSettings] = useStudioDraft<DesignShaderSequenceSettings>(
    identity.id,
    tool.id,
    'shader-lab-v1-shader-sequence',
    DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS
  );
  const [canvasBackground, setCanvasBackground] = useStudioDraft(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-background',
    DEFAULT_CANVAS_BACKGROUND
  );
  const [textLayers, setTextLayers] = useStudioDraft<CompositionTextLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v2-text-layers-v1',
    []
  );
  const [storedLayerGroups, setLayerGroups] = useStudioDraft<CompositionLayerGroup[]>(
    identity.id,
    tool.id,
    'shader-lab-v1-layer-groups',
    []
  );
  const [paused, setPaused] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const [logoLayers, setLogoLayers] = useState<CompositionLogoLayer[]>([{
    appearance: { ...DEFAULT_LOGO_APPEARANCE },
    color: '#FFFFFF',
    id: DEFAULT_LOGO_LAYER_ID,
    name: 'Brand mark',
    opacity: 1,
    transform: DEFAULT_LAYER_TRANSFORM,
    url: builtInLogo,
    visible: true,
  }]);
  const [compositionAssets, setCompositionAssets] = useState<CompositionAsset[]>([]);
  const [storedLayerOrder, setLayerOrder] = useState<CompositionLayerId[]>([DEFAULT_CANVAS_SHADER_ID, DEFAULT_LOGO_LAYER_ID]);
  const [storedSelectedLayerId, setSelectedLayerId] = useState<CompositionLayerId | null>(DEFAULT_CANVAS_SHADER_ID);
  const [storedSelectedCanvasLayerIds, setSelectedCanvasLayerIds] = useState<CanvasLayerId[]>([DEFAULT_CANVAS_SHADER_ID]);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<CanvasSelectionMenuPosition | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [sequenceCapture, setSequenceCapture] = useState<ShaderSequenceCapture | null>(null);
  const [sequencePreviewing, setSequencePreviewing] = useState(false);
  const [exporting, setExporting] = useState<'gif' | 'jpg' | 'mp4' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [imageImportState, setImageImportState] = useState<ImageImportState>({ message: '', status: 'idle' });
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [imageImportRequest, setImageImportRequest] = useState<ImageImportRequest | null>(null);
  const [imageImportError, setImageImportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [lastExportRequest, setLastExportRequest] = useState<DesignExportRequest | null>(null);

  useEffect(() => {
    const candidates = [
      ...logoLayers.map(({ id, url }) => ({ id, url })),
      ...compositionAssets.map(({ id, url }) => ({ id, url })),
    ].filter(({ url }) => !/^data:[^,]+;base64,/i.test(url));
    if (candidates.length === 0) return;
    let cancelled = false;
    void Promise.allSettled(candidates.map(async ({ id, url }) => (
      [id, await imageUrlToDataUrl(url)] as const
    ))).then((results) => {
      if (cancelled) return;
      const embeddedSources = new Map(results.flatMap((result) => (
        result.status === 'fulfilled' ? [result.value] : []
      )));
      if (embeddedSources.size === 0) return;
      setLogoLayers((current) => current.map((layer) => {
        const url = embeddedSources.get(layer.id);
        return url && url !== layer.url ? { ...layer, url } : layer;
      }));
      setCompositionAssets((current) => current.map((asset) => {
        const url = embeddedSources.get(asset.id);
        return url && url !== asset.url ? { ...asset, url } : asset;
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [compositionAssets, logoLayers]);

  const ratioOption = RATIO_OPTIONS.find((option) => option.value === ratio) ?? RATIO_OPTIONS[0]!;
  const canvasDimensions = CANVAS_DIMENSIONS[ratio];
  const normalizedExportSettings = useMemo(
    () => normalizeDesignExportSettings(exportSettings),
    [exportSettings]
  );
  const previewFrameCount = Math.max(
    2,
    Math.round(normalizedExportSettings.durationMs / (1_000 / normalizedExportSettings.fps))
  );
  const boundedPreviewFrame = Math.min(previewFrameCount - 1, Math.max(0, Math.round(previewFrame)));
  const previewCaptureTimeMs = boundedPreviewFrame / normalizedExportSettings.fps * 1_000;
  const exportDimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: normalizedExportSettings.width,
  });
  const normalizedShaderSequenceBase = useMemo(
    () => normalizeShaderSequenceSettings(shaderSequenceSettings),
    [shaderSequenceSettings]
  );
  const sequencePresentation = useMemo(
    () => resolveShaderSequencePresentation(
      shaderLayers,
      shaderSequenceSettings,
      normalizedShaderSequenceBase
    ),
    [normalizedShaderSequenceBase, shaderLayers, shaderSequenceSettings]
  );
  const {
    duration: shaderSequenceDuration,
    materialIds: sequenceMaterialIds,
    settings: normalizedShaderSequenceSettings,
    targetLayer: sequenceTargetLayer,
    targetOptions: sequenceTargetOptions,
    timeline: shaderSequenceTimeline,
  } = sequencePresentation;
  const layerOrder = useMemo(() => reconcileDesignLabLayerOrder({
    assets: compositionAssets.map(({ id }) => id),
    effects: effectLayers.map(({ id }) => id),
    logos: logoLayers.map(({ id }) => id),
    shaders: shaderLayers.map(({ id }) => id),
    stored: storedLayerOrder,
    text: textLayers.map(({ id }) => id),
  }) as CompositionLayerId[], [compositionAssets, effectLayers, logoLayers, shaderLayers, storedLayerOrder, textLayers]);
  const layerOrderIdSet = useMemo(() => new Set<CompositionLayerId>(layerOrder), [layerOrder]);
  const selectedLayerId = storedSelectedLayerId && layerOrderIdSet.has(storedSelectedLayerId)
    ? storedSelectedLayerId
    : null;
  const canvasLayerIds = useMemo<CanvasLayerId[]>(() => [
    ...shaderLayers.map(({ id }) => id),
    ...textLayers.map(({ id }) => id),
    ...logoLayers.map(({ id }) => id),
    ...compositionAssets.map(({ id }) => id),
  ], [compositionAssets, logoLayers, shaderLayers, textLayers]);
  const canvasLayerIdSet = useMemo(() => new Set<CanvasLayerId>(canvasLayerIds), [canvasLayerIds]);
  const layerGroups = useMemo(
    () => reconcileDesignLabLayerGroups(storedLayerGroups, canvasLayerIds) as CompositionLayerGroup[],
    [canvasLayerIds, storedLayerGroups]
  );
  const selectedCanvasLayerIds = useMemo(
    () => storedSelectedCanvasLayerIds.filter((id) => canvasLayerIdSet.has(id)),
    [canvasLayerIdSet, storedSelectedCanvasLayerIds]
  );
  const savedDesignRevision = useMemo(() => `${designExportSettingsSignature(ratio, normalizedExportSettings)}:${JSON.stringify({
    background: canvasBackground,
    layerOrder,
    layerGroups,
    layerShaders,
    layers: {
      assets: compositionAssets,
      effects: effectLayers,
      logos: logoLayers,
      shaders: shaderLayers,
      text: textLayers,
    },
    shaderSequence: normalizedShaderSequenceSettings,
  })}`, [canvasBackground, compositionAssets, effectLayers, layerGroups, layerOrder, layerShaders, logoLayers, normalizedExportSettings, normalizedShaderSequenceSettings, ratio, shaderLayers, textLayers]);
  const savedDesignWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const compositionSignature = `${savedDesignRevision}:frame=${boundedPreviewFrame}:paused=${paused}`;
  const designLabDocument = useMemo(() => createDesignLabCanvasDocument({
    assets: compositionAssets,
    backgroundColor: canvasBackground,
    brandId: identity.id,
    createdAt: compositionDocumentCreatedAt,
    effectLayers,
    exportSettings: normalizedExportSettings,
    groups: layerGroups,
    height: canvasDimensions.height,
    id: `${identity.id}:${tool.id}:composition`,
    layerOrder,
    layerShaders,
    logos: logoLayers,
    ratio,
    revision: canvasRevisionFromSignature(compositionSignature),
    shaderLayers,
    shaderSequence: normalizedShaderSequenceSettings,
    textLayers,
    timeline: { frame: boundedPreviewFrame, paused },
    title: `${identity.name} ${tool.name}`,
    updatedAt: compositionDocumentCreatedAt,
    width: canvasDimensions.width,
  }), [
    canvasBackground,
    boundedPreviewFrame,
    canvasDimensions.height,
    canvasDimensions.width,
    compositionAssets,
    compositionDocumentCreatedAt,
    compositionSignature,
    effectLayers,
    identity.id,
    identity.name,
    layerGroups,
    layerOrder,
    layerShaders,
    logoLayers,
    normalizedExportSettings,
    normalizedShaderSequenceSettings,
    paused,
    ratio,
    shaderLayers,
    textLayers,
    tool.id,
    tool.name,
  ]);
  const portableDesignLab = usePortableCanvasWorkspace({
    applySource: applyCompositionSource,
    document: designLabDocument,
    workspaceKey: savedDesignWorkspaceKey,
  });
  const compositionAutosaveState = portableDesignLab.autosaveState;
  const currentExportSettingsSignature = compositionSignature;
  const previewNeedsRefresh = Boolean(
    lastExportRequest && lastExportRequest.settingsSignature !== currentExportSettingsSignature
  );

  useEffect(() => () => cancelAnimationFrame(sequencePreviewAnimationRef.current), []);
  const materials = useMemo(() => shaderLabMaterials(query, category), [category, query]);
  const selectedEffectLayer = isEffectLayerId(selectedLayerId)
    ? effectLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const {
    activeMaterialId,
    contentLayerId: selectedContentLayerId,
    editingShader,
    layerShader: selectedLayerShader,
    material,
    previewChannel: selectedShaderPreviewChannel,
    settings,
    shaderLayer: selectedShaderLayer,
    shaderSize,
  } = resolveShaderEditingSelection({
    initialSettings,
    layerShaders,
    selectedLayerId,
    shaderLayers,
  });
  const {
    asset: selectedAsset,
    assetAppearance: selectedAssetAppearance,
    assetInspector: selectedAssetInspector,
    logoAppearance: selectedLogoAppearance,
    logoInspector: selectedLogoInspector,
    logoLayer: selectedLogoLayer,
    textAppearance: selectedTextAppearance,
    textInspector: selectedTextInspector,
    textLayer: selectedTextLayer,
    textRenderedWeight: selectedTextRenderedWeight,
    textTransform: selectedTextTransform,
    textWeightRange: selectedTextWeightRange,
  } = resolveContentLayerSelection({
    assets: compositionAssets,
    identity,
    logos: logoLayers,
    selectedLayerId,
    textLayers,
  });
  const layerGroupByLayerId = useMemo(() => {
    const groups = new Map<CanvasLayerId, CompositionLayerGroup>();
    for (const group of layerGroups) {
      for (const layerId of group.layerIds) groups.set(layerId, group);
    }
    return groups;
  }, [layerGroups]);
  const {
    duplicateLayer,
    layerLabel,
    removeLayer,
    removeShaderFromSelectedContent,
    toggleLayerVisibility,
  } = useDesignLabLayerActions({
    compositionAssets,
    effectLayers,
    layerShaders,
    logoLayers,
    removeAsset,
    removeEffectLayer,
    removeLogoLayer,
    removeTextLayer,
    selectedContentLayerId,
    setCompositionAssets,
    setEffectLayers,
    setLayerOrder,
    setLayerShaders,
    setLogoLayers,
    setSelectedLayerId,
    setShaderLayers,
    setTextLayers,
    shaderLayers,
    textLayers,
    toggleTextLayerVisibility,
  });
  const {
    alignCanvasAssembly,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    handleCanvasAssemblyKeyDown,
    movementBoundsFor,
    moveCanvasSelection,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    selectCanvasAssembly,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
  } = useDesignLabCanvasSelection({
    canvasDimensions,
    compositionAssets,
    duplicateLayer,
    layerGroups,
    layerGroupByLayerId,
    layerOrder,
    layerVisible,
    logoLayers,
    ratio,
    removeLayer,
    selectedCanvasLayerIds,
    setCompositionAssets,
    setLayerGroups,
    setLayerOrder,
    setLogoLayers,
    setSelectedCanvasLayerIds,
    setSelectedLayerId,
    setSelectionMenuPosition,
    setShaderLayers,
    setTextLayers,
    shaderLayers,
    textLayers,
  });
  useEffect(() => () => {
    compositionAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    previewFrameRef.current = boundedPreviewFrame;
    if (previewFrame !== boundedPreviewFrame) setPreviewFrame(boundedPreviewFrame);
  }, [boundedPreviewFrame, previewFrame]);

  const trackPreviewFrame = useCallback((frame: number) => {
    previewFrameRef.current = frame;
  }, []);

  function pauseAtPreviewFrame(frame: number) {
    const nextFrame = Math.min(previewFrameCount - 1, Math.max(0, Math.round(frame)));
    previewFrameRef.current = nextFrame;
    setPreviewFrame(nextFrame);
    setPaused(true);
  }

  function playShaderHistory() {
    setPaused(false);
  }

  function toggleShaderHistory() {
    if (paused) {
      playShaderHistory();
      return;
    }
    pauseAtPreviewFrame(previewFrameRef.current);
  }

  useEffect(() => {
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const migrationKey = `${identity.id}:${tool.id}:${brandPalette.colors.join('|')}`;
    if (defaultShaderMigrationRef.current === migrationKey) return;
    defaultShaderMigrationRef.current = migrationKey;
    const legacySettings = JSON.stringify(legacyDefaultShaderLayer.settings);
    setShaderLayers((current) => current.map((layer) => {
      const untouchedLegacyDefault = layer.id === legacyDefaultShaderLayer.id
        && layer.name === legacyDefaultShaderLayer.name
        && layer.visible === legacyDefaultShaderLayer.visible
        && layer.materialId === legacyDefaultShaderLayer.materialId
        && layer.blendMode === legacyDefaultShaderLayer.blendMode
        && layer.opacity === legacyDefaultShaderLayer.opacity
        && layer.shaderSize === legacyDefaultShaderLayer.shaderSize
        && JSON.stringify(layer.settings) === legacySettings;
      return untouchedLegacyDefault
        ? { ...initialShaderLayer }
        : { ...layer, transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM) };
    }));
  }, [brandPalette.colors, draftHydrated, identity.id, initialShaderLayer, legacyDefaultShaderLayer, setShaderLayers, tool.id]);

  useEffect(() => {
    const needsWeightNormalization = textLayers.some((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return layer.weight !== resolveBrandTypographyWeight(identity, fontRole, layer.weight);
    });
    if (!needsWeightNormalization) return;
    setTextLayers((current) => current.map((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return {
        ...layer,
        weight: resolveBrandTypographyWeight(identity, fontRole, layer.weight),
      };
    }));
  }, [identity, setTextLayers, textLayers]);

  function updateSelectedShader(update: Partial<ShaderApplication>) {
    const normalizedUpdate = update.shaderSize === undefined
      ? update
      : { ...update, shaderSize: clampShaderZoom(update.shaderSize) };
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...normalizedUpdate } : layer
      )));
      return;
    }
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => ({
      ...current,
      [selectedContentLayerId]: {
        ...(current[selectedContentLayerId] ?? shaderApplicationFor(activeMaterialId, brandPalette.colors)),
        ...normalizedUpdate,
      },
    }));
  }

  function previewSelectedShaderSetting(key: keyof LiveMaterialSettings, value: number) {
    if (!selectedShaderPreviewChannel) return;
    previewLiveMaterialSettings(selectedShaderPreviewChannel, { [key]: value });
  }

  function previewSelectedShaderOpacity(value: number) {
    if (!selectedShaderPreviewChannel) return;
    const host = document.querySelector<HTMLElement>(
      `[data-shader-instance="${CSS.escape(selectedShaderPreviewChannel)}"]`
    );
    if (!host) return;
    if (selectedShaderLayer) {
      host.style.opacity = String(value);
      return;
    }
    const canvasLayer = host.closest<HTMLElement>('.editable-canvas-layer');
    if (selectedTextLayer && selectedTextAppearance) {
      const text = canvasLayer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
      if (text) text.style.opacity = String(selectedTextAppearance.opacity * value);
      return;
    }
    const appearance = canvasLayer?.querySelector<HTMLElement>('.shader-lab-v2-appearance-stack');
    const contentOpacity = selectedLogoLayer?.opacity ?? selectedAsset?.opacity ?? 1;
    if (appearance) appearance.style.opacity = String(contentOpacity * value);
  }

  function previewSelectedTextAppearance(
    patch: Partial<Omit<TextAppearanceSettings, 'textEffect'>> & {
      textEffect?: Partial<TextEffectSettings>;
    }
  ) {
    if (!selectedTextAppearance) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
    if (!text) return;
    const nextAppearance: TextAppearanceSettings = {
      ...selectedTextAppearance,
      ...patch,
      textEffect: patch.textEffect
        ? { ...selectedTextAppearance.textEffect, ...patch.textEffect }
        : selectedTextAppearance.textEffect,
    };
    const materialBackgroundImage = selectedLayerShader
      ? `url("${shaderPreviewAssetPath(selectedLayerShader.materialId)}")`
      : undefined;
    const effectStyle = textEffectCssStyle(
      nextAppearance.textEffect,
      nextAppearance.color,
      materialBackgroundImage
    );
    text.style.color = nextAppearance.color;
    text.style.textShadow = textShadowStyle(nextAppearance) ?? '';
    text.style.webkitTextStroke = nextAppearance.outlineEnabled
      ? `${nextAppearance.outlineWidth}px ${nextAppearance.outlineColor}`
      : '';
    Object.entries(effectStyle).forEach(([property, value]) => {
      Reflect.set(text.style, property, value ?? '');
    });
  }

  function previewSelectedTextWidth(widthScale: number) {
    if (!selectedTextLayer || !selectedTextTransform) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const geometry = layerGeometry(selectedTextLayer.id, ratio);
    const width = geometry.baseWidth * widthScale;
    const centerX = geometry.baseX + geometry.baseWidth / 2 + selectedTextTransform.x;
    layer.style.left = `${(centerX - width / 2) / canvasDimensions.width * 100}%`;
    layer.style.width = `${width / canvasDimensions.width * 100}%`;
    syncSelectedCanvasLayerOverlay(layer);
  }

  function previewSelectedContentOpacity(value: number) {
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const shaderOpacity = selectedLayerShader?.opacity ?? 1;
    if (selectedTextLayer) {
      const text = layer.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
      if (text) text.style.opacity = String(value * shaderOpacity);
      return;
    }
    const appearance = layer.querySelector<HTMLElement>('.shader-lab-v2-appearance-preview');
    if (appearance) appearance.style.opacity = String(value * shaderOpacity);
  }

  function previewSelectedLogoAppearance(
    patch: Partial<LogoAppearanceSettings>,
    logoColor = selectedLogoLayer?.color ?? '#FFFFFF'
  ) {
    if (!selectedLogoAppearance && !selectedAssetAppearance) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const currentAppearance = selectedLogoAppearance ?? selectedAssetAppearance;
    if (!currentAppearance) return;
    const nextAppearance = { ...currentAppearance, ...patch };
    layer.querySelectorAll<SVGSVGElement>('.shader-lab-v2-appearance-preview svg, svg.shader-lab-v2-appearance-preview')
      .forEach((svg) => {
        const filterTarget = svg.querySelector<SVGElement>('image[filter], foreignObject[filter]');
        const filterReference = filterTarget?.getAttribute('filter');
        const filterId = filterReference?.match(/^url\(#(.+)\)$/)?.[1];
        const definitions = svg.querySelector<SVGDefsElement>('defs');
        if (!filterId || !definitions) return;
        const isSilhouette = svg.getAttribute('aria-label')?.includes('silhouette effects') ?? false;
        if (isSilhouette) {
          definitions.innerHTML = buildLogoSvgFilter({
            ...nextAppearance,
            ditherEnabled: false,
            invert: false,
            shadowEnabled: false,
          }, nextAppearance.borderColor, filterId, false);
          return;
        }
        if (filterTarget?.tagName.toLowerCase() === 'foreignobject' || selectedAsset) {
          definitions.innerHTML = buildImageSvgFilter({
            ...nextAppearance,
            ...(filterTarget?.tagName.toLowerCase() === 'foreignobject' ? { borderEnabled: false } : {}),
          }, filterId);
          return;
        }
        definitions.innerHTML = buildLogoSvgFilter(
          nextAppearance,
          logoColor,
          filterId
        );
      });
  }

  function updateSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    updateSelectedShader({ settings: { ...settings, [key]: value } });
  }

  function selectMaterial(nextId: LiveMaterialId) {
    const nextApplication = shaderApplicationFor(nextId, brandPalette.colors, {
      blendMode: editingShader?.blendMode,
      opacity: editingShader?.opacity,
      shaderSize: editingShader?.shaderSize,
    });
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...nextApplication } : layer
      )));
      return;
    }
    if (selectedContentLayerId) {
      setLayerShaders((current) => ({ ...current, [selectedContentLayerId]: nextApplication }));
      return;
    }
    addCanvasShader(nextId);
  }

  function selectRandomMaterial() {
    const visibleChoices = materials.filter(({ id }) => id !== activeMaterialId);
    const choices = visibleChoices.length > 0
      ? visibleChoices
      : shaderLabMaterials('', 'all').filter(({ id }) => id !== activeMaterialId);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) selectMaterial(next.id);
  }

  function sequenceApplicationFor(
    layer: CompositionShaderLayer,
    materialId: LiveMaterialId
  ): ShaderApplication {
    if (layer.materialId === materialId) return layer;
    return shaderApplicationFor(materialId, brandPalette.colors, {
      blendMode: layer.blendMode,
      opacity: layer.opacity,
      shaderSize: layer.shaderSize,
    });
  }

  function applySequenceCapture(layer: CompositionShaderLayer, materialId: LiveMaterialId) {
    const capture: ShaderSequenceCapture = {
      application: sequenceApplicationFor(layer, materialId),
      layerId: layer.id,
      materialId,
    };
    sequenceCaptureRef.current = capture;
    setSequenceCapture(capture);
  }

  function clearSequenceCapture() {
    sequenceCaptureRef.current = null;
    setSequenceCapture(null);
  }

  function stopShaderSequencePreview() {
    cancelAnimationFrame(sequencePreviewAnimationRef.current);
    sequencePreviewAnimationRef.current = 0;
    clearSequenceCapture();
    setSequencePreviewing(false);
    setPaused(sequencePreviewRestorePausedRef.current);
  }

  function previewShaderSequence() {
    if (sequencePreviewing) {
      stopShaderSequencePreview();
      return;
    }
    if (!sequenceTargetLayer || shaderSequenceTimeline.length === 0 || exporting) return;
    sequencePreviewRestorePausedRef.current = paused;
    setPaused(false);
    setSequencePreviewing(true);
    const startedAt = performance.now();
    let previousSegmentIndex = -1;
    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      if (elapsedMs >= shaderSequenceDuration) {
        stopShaderSequencePreview();
        return;
      }
      const segment = shaderSequenceSegmentAt(shaderSequenceTimeline, elapsedMs);
      if (segment && segment.index !== previousSegmentIndex) {
        previousSegmentIndex = segment.index;
        applySequenceCapture(sequenceTargetLayer, segment.materialId);
      }
      sequencePreviewAnimationRef.current = requestAnimationFrame(tick);
    };
    sequencePreviewAnimationRef.current = requestAnimationFrame(tick);
  }

  function addCanvasShader(materialId: LiveMaterialId = activeMaterialId) {
    const id = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const number = shaderLayers.length + 1;
    const layer: CompositionShaderLayer = {
      ...shaderApplicationFor(materialId, brandPalette.colors, {
        blendMode: shaderLayers.length === 0 ? 'normal' : 'screen',
        opacity: shaderLayers.length === 0 ? 1 : 0.72,
      }),
      id,
      name: `Canvas shader ${number}`,
      transform: { ...DEFAULT_LAYER_TRANSFORM },
      visible: true,
    };
    setShaderLayers((current) => [...current, layer]);
    setLayerOrder((current) => {
      const firstContent = current.findIndex((layerId) => !isShaderLayerId(layerId));
      const index = firstContent < 0 ? current.length : firstContent;
      return [...current.slice(0, index), id, ...current.slice(index)];
    });
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  function addEffectLayer(kind: CompositionEffectKind = 'bayer') {
    const id = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    const number = effectLayers.filter((layer) => layer.settings.kind === kind).length + 1;
    const layer: CompositionEffectLayer = {
      id,
      name: `${preset.label} ${number}`,
      opacity: 1,
      settings: defaultCompositionEffectSettings(kind),
      visible: true,
    };
    setEffectLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([]);
  }

  function updateEffectLayer(id: EffectLayerId, update: Partial<Omit<CompositionEffectLayer, 'id'>>) {
    effectPreviewOverridesRef.current.delete(id);
    setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function previewEffectLayer(
    id: EffectLayerId,
    update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }
  ) {
    const current = effectPreviewOverridesRef.current.get(id);
    effectPreviewOverridesRef.current.set(id, {
      ...current,
      ...update,
      settings: update.settings ? { ...current?.settings, ...update.settings } : current?.settings,
    });
  }

  function selectEffectPreset(layer: CompositionEffectLayer, kind: CompositionEffectKind) {
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    updateEffectLayer(layer.id, {
      name: preset.label,
      settings: defaultCompositionEffectSettings(kind),
    });
  }

  function removeEffectLayer(id: EffectLayerId) {
    setEffectLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function addBrandMarkLayer() {
    const id = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
    const number = logoLayers.length + 1;
    const offset = (logoLayers.length % 8) * 28;
    const layer: CompositionLogoLayer = {
      appearance: { ...DEFAULT_LOGO_APPEARANCE },
      color: '#FFFFFF',
      id,
      name: number === 1 ? 'Brand mark' : `Brand mark ${number}`,
      opacity: 1,
      transform: { ...DEFAULT_LAYER_TRANSFORM, x: offset, y: offset },
      url: builtInLogo,
      visible: true,
    };
    setLogoLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  async function addLogoFiles(files: FileList | null) {
    const images = Array.from(files ?? []);
    if (images.length === 0) return;
    try {
      const converted = await convertedAssetLibrary.importFiles(images, 2048);
      const nextLayers = converted.map((asset, index): CompositionLogoLayer => {
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        color: '#FFFFFF',
        convertedAssetId: asset.id,
        id: `logo-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: asset.originalName,
        opacity: 1,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url: asset.convertedDataUrl,
        visible: true,
      };
      });
      setLogoLayers((current) => [...current, ...nextLayers]);
      setLayerOrder((current) => [...current, ...nextLayers.map(({ id }) => id)]);
      setSelectedLayerId(nextLayers.at(-1)?.id ?? null);
      setSelectedCanvasLayerIds(nextLayers.map(({ id }) => id));
    } catch {
      // The converted asset library owns the user-facing error state.
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  function addTextLayer() {
    const id = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
    const placement = [
      { x: 0, y: -220 },
      { x: 0, y: 220 },
      { x: -300, y: 0 },
      { x: 300, y: 0 },
      { x: -260, y: 260 },
      { x: 260, y: -260 },
    ][textLayers.length % 6] ?? { x: 0, y: 0 };
    const nextNumber = textLayers.reduce((largest, layer) => {
      const match = /^Text (\d+)$/.exec(layer.name);
      return Math.max(largest, Number(match?.[1] ?? 0));
    }, 0) + 1;
    const layer: CompositionTextLayer = {
      align: 'center',
      ...DEFAULT_TEXT_APPEARANCE,
      id,
      lineHeight: 0.95,
      name: `Text ${nextNumber}`,
      tracking: -0.06,
      transform: { ...DEFAULT_TEXT_LAYER_TRANSFORM, ...placement },
      value: nextNumber === 1 ? identity.name : `Text ${nextNumber}`,
      visible: true,
      weight: resolveBrandTypographyWeight(
        identity,
        DEFAULT_TEXT_APPEARANCE.fontRole,
        brandTypographyRole(identity, DEFAULT_TEXT_APPEARANCE.fontRole).weight ?? 500
      ),
      wrap: 'wrap',
    };
    setTextLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  function updateTextLayer(
    id: TextLayerId,
    update: Partial<Omit<CompositionTextLayer, 'id'>>
  ) {
    setTextLayers((current) => current.map((layer) =>
      layer.id === id ? { ...layer, ...update } : layer
    ));
  }

  function removeTextLayer(id: TextLayerId) {
    textEffectScratchRefs.current.delete(id);
    setTextLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function toggleTextLayerVisibility(layer: CompositionTextLayer) {
    updateTextLayer(layer.id, { visible: !layer.visible });
    if (selectedLayerId === layer.id && layer.visible) setSelectedLayerId(null);
  }

  function updateLogoTransform(id: LogoLayerId, transform: CanvasLayerTransform) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, transform } : layer));
  }

  function updateLogoLayer(id: LogoLayerId, update: Partial<Omit<CompositionLogoLayer, 'id'>>) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function selectConvertedLogo(asset: ConvertedAsset | null) {
    if (!selectedLogoLayer) return;
    updateLogoLayer(selectedLogoLayer.id, asset ? {
      convertedAssetId: asset.id,
      name: asset.originalName,
      url: asset.convertedDataUrl,
    } : {
      convertedAssetId: undefined,
      name: 'Brand mark',
      url: builtInLogo,
    });
  }

  function removeLogoLayer(id: LogoLayerId) {
    const removed = logoLayers.find((layer) => layer.id === id);
    const remaining = logoLayers.filter((layer) => layer.id !== id);
    if (removed?.url.startsWith('blob:') && removed.id !== DEFAULT_LOGO_LAYER_ID && !remaining.some((layer) => layer.url === removed.url)) {
      URL.revokeObjectURL(removed.url);
      compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
    }
    setLogoLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  const openImageImport = useCallback((files: readonly File[] = []) => {
    imageImportRequestIdRef.current += 1;
    setImageImportRequest({ files, id: imageImportRequestIdRef.current });
    setImageImportError(null);
    setImageImportOpen(true);
  }, []);

  const placeBrandAssets = useCallback(async (assets: readonly BrandAsset[]) => {
    const usedNames = new Set(compositionAssets.map(({ name }) => name));
    const geometry = layerGeometry('asset-import' as AssetLayerId, ratio);
    const columns = Math.min(3, assets.length);
    const rows = Math.ceil(assets.length / Math.max(1, columns));
    const results = await Promise.allSettled(assets.map(async (asset, index): Promise<CompositionAsset> => {
      const image = await loadCanvasImage(asset.path);
      let name = asset.label.trim() || `Image ${compositionAssets.length + index + 1}`;
      const baseName = name;
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `${baseName} ${suffix}`;
        suffix += 1;
      }
      usedNames.add(name);
      const column = index % Math.max(1, columns);
      const row = Math.floor(index / Math.max(1, columns));
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        id: `asset-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        libraryAssetId: asset.id,
        name,
        opacity: 1,
        transform: fitImageLayerToCanvas({
          ...geometry,
          canvasHeight: canvasDimensions.height,
          canvasWidth: canvasDimensions.width,
          imageHeight: image.naturalHeight,
          imageWidth: image.naturalWidth,
          x: (column - (columns - 1) / 2) * 44,
          y: (row - (rows - 1) / 2) * 36,
        }),
        url: asset.path,
        visible: true,
      };
    }));
    const nextAssets = results.flatMap((result): CompositionAsset[] => result.status === 'fulfilled' ? [result.value] : []);
    if (nextAssets.length === 0) throw new TypeError('The selected image could not be decoded.');
    setCompositionAssets((current) => [...current, ...nextAssets]);
    setLayerOrder((current) => [...current, ...nextAssets.map(({ id }) => id)]);
    setSelectedLayerId(nextAssets.at(-1)?.id ?? null);
    setSelectedCanvasLayerIds(nextAssets.map(({ id }) => id));
    return { failedCount: results.length - nextAssets.length, nextAssets };
  }, [canvasDimensions.height, canvasDimensions.width, compositionAssets, ratio]);

  const importAndSaveImages = useCallback(async (items: readonly PendingImageImport[]) => {
    setImageImportError(null);
    setImageImportState({ message: `Verifying and saving ${items.length} image${items.length === 1 ? '' : 's'}…`, status: 'importing' });
    const results = await Promise.allSettled(items.map(async ({ file, label }) => {
      const image = await readEmbeddedImageFile(file);
      await loadCanvasImage(image.source);
      return createImportedBrandAsset(image, label);
    }));
    const importedAssets = results.flatMap((result): BrandAsset[] => result.status === 'fulfilled' ? [result.value] : []);
    const readFailures = results.flatMap((result): string[] => result.status === 'rejected'
      ? [result.reason instanceof Error ? result.reason.message : 'An image could not be read.']
      : []);
    if (importedAssets.length === 0) {
      const message = readFailures[0] ?? 'Choose a supported image to continue.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
      return;
    }
    try {
      if (!onIdentitySave) throw new Error('This project cannot save shared assets yet.');
      onIdentitySave({ ...identity, assets: [...identity.assets, ...importedAssets] });
      const placed = await placeBrandAssets(importedAssets);
      const failedCount = readFailures.length + placed.failedCount;
      setImageImportOpen(false);
      setImageImportRequest(null);
      setImageImportState({
        message: failedCount > 0
          ? `Saved and placed ${placed.nextAssets.length}; ${failedCount} file${failedCount === 1 ? '' : 's'} failed.`
          : `Saved ${placed.nextAssets.length} image${placed.nextAssets.length === 1 ? '' : 's'} to Assets and placed ${placed.nextAssets.length} on canvas.`,
        status: failedCount > 0 ? 'error' : 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The image could not be saved.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [identity, onIdentitySave, placeBrandAssets]);

  const placeSavedAsset = useCallback(async (asset: BrandAsset) => {
    setImageImportError(null);
    try {
      await placeBrandAssets([asset]);
      setImageImportOpen(false);
      setImageImportRequest(null);
      setImageImportState({ message: `Placed ${asset.label} from Assets.`, status: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The image could not be placed.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [placeBrandAssets]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement
        && target.closest('input, textarea, select, [contenteditable="true"]')
      ) return;
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) => (
        file.type.startsWith('image/') || /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name)
      ));
      if (images.length === 0) return;
      event.preventDefault();
      openImageImport(images);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [openImageImport]);

  function handleImageDrop(event: ReactDragEvent<HTMLElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setImageDropActive(false);
    openImageImport(Array.from(event.dataTransfer.files));
  }

  function removeAsset(id: AssetLayerId) {
    const removed = compositionAssets.find((asset) => asset.id === id);
    const remaining = compositionAssets.filter((asset) => asset.id !== id);
    if (removed?.url.startsWith('blob:') && !remaining.some((asset) => asset.url === removed.url)) {
      URL.revokeObjectURL(removed.url);
      compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
    }
    setCompositionAssets((current) => current.filter((asset) => asset.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function moveLayer(id: CompositionLayerId, direction: -1 | 1) {
    setLayerOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function updateAssetTransform(id: AssetLayerId, transform: CanvasLayerTransform) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, transform } : asset));
  }

  function updateAssetLayer(id: AssetLayerId, update: Partial<Omit<CompositionAsset, 'id'>>) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, ...update } : asset));
  }

  function layerVisible(id: CompositionLayerId) {
    return !designLabDocument.elements[id]?.hidden;
  }

  const designLabPage = designLabDocument.pages[designLabDocument.pageIds[0]!]!;
  const listedLayerIds = designLabPage.elementIds as CompositionLayerId[];
  const visibleLayerIds = useMemo(
    () => listedLayerIds.filter((id) => !designLabDocument.elements[id]?.hidden),
    [designLabDocument, listedLayerIds]
  );
  const visibleLayerIdSet = useMemo(() => new Set(visibleLayerIds), [visibleLayerIds]);

  function compositionSetupSource(): string | null {
    if (!portableDesignLab.document) return null;
    return serializeExistingDesignLabCanvasDocument(withDesignLabTimeline(
      portableDesignLab.document,
      { frame: boundedPreviewFrame, paused },
      canvasRevisionFromSignature(compositionSignature)
    ));
  }

  function applyCompositionSource(source: string) {
    const parsed = parseCompositionSource(source);

    const nextShaderLayers = restoredShaderLayers(
      parsed.composition.shaderLayers,
      shaderLayers,
      parsed.shaderSequence?.targetLayerId
    );
    const nextEffectLayers = (parsed.composition.effectLayers ?? effectLayers).map((layer) => ({ ...layer, settings: { ...layer.settings } }));
    const nextTextLayers = (parsed.composition.textLayers ?? textLayers).map((layer) => ({
      ...layer,
      textEffect: layer.textEffect ? { ...layer.textEffect } : layer.textEffect,
      transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_TEXT_LAYER_TRANSFORM),
    }));
    const nextLogoLayers = restoredLogoLayers(parsed.composition.logos, logoLayers, builtInLogo);
    const nextAssets = restoredImageLayers(parsed.composition.assets, compositionAssets);
    const allowedIds = new Set<CompositionLayerId>([
      ...nextShaderLayers.map(({ id }) => id),
      ...nextEffectLayers.map(({ id }) => id),
      ...nextTextLayers.map(({ id }) => id),
      ...nextLogoLayers.map(({ id }) => id),
      ...nextAssets.map(({ id }) => id),
    ]);
    const nextOrder = restoredLayerOrder({
      assets: nextAssets,
      effects: nextEffectLayers,
      logos: nextLogoLayers,
      requested: parsed.composition.layerOrder ?? layerOrder,
      shaders: nextShaderLayers,
      text: nextTextLayers,
    });
    const nextLayerShaders = restoredLayerShaders(parsed.composition.layerShaders, layerShaders, allowedIds);
    const nextGroups = reconcileDesignLabLayerGroups(
      parsed.composition.groups ?? layerGroups,
      nextOrder.filter(isCanvasLayerId)
    ) as CompositionLayerGroup[];
    const nextExportSettings = parsed.exportSettings
      ? normalizeDesignExportSettings(parsed.exportSettings)
      : normalizedExportSettings;
    const nextPreviewFrameCount = Math.max(2, Math.round(nextExportSettings.durationMs / (1_000 / nextExportSettings.fps)));
    const nextPreviewFrame = Math.min(
      nextPreviewFrameCount - 1,
      Math.max(0, Math.round(parsed.timeline?.frame ?? boundedPreviewFrame))
    );

    if (parsed.ratio) setRatio(parsed.ratio);
    if (parsed.composition.backgroundColor) setCanvasBackground(parsed.composition.backgroundColor.toUpperCase());
    setShaderLayers(nextShaderLayers);
    setEffectLayers(nextEffectLayers);
    setTextLayers(nextTextLayers);
    setLayerGroups(nextGroups);
    setLayerShaders(nextLayerShaders);
    setLogoLayers(nextLogoLayers);
    setCompositionAssets(nextAssets);
    if (parsed.exportSettings) setExportSettings(nextExportSettings);
    if (parsed.shaderSequence) {
      setShaderSequenceSettings({
        ...normalizeShaderSequenceSettings(parsed.shaderSequence),
        targetLayerId: parsed.shaderSequence.targetLayerId
          ?? nextShaderLayers.find(({ visible }) => visible)?.id
          ?? nextShaderLayers[0]?.id
          ?? null,
      });
    }
    setLayerOrder(nextOrder);
    previewFrameRef.current = nextPreviewFrame;
    setPreviewFrame(nextPreviewFrame);
    if (parsed.timeline?.paused !== undefined) setPaused(parsed.timeline.paused);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
  }

  async function copySetup() {
    const setup = compositionSetupSource();
    try {
      if (setup === null) throw new Error('Portable composition code is still being prepared.');
      await copyTextToClipboard(setup);
      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch (error) {
      setCopied(false);
      setCopyError(error instanceof Error ? error.message : 'The composition code could not be copied.');
    }
  }

  function paintShaderApplication(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    instanceKey: string,
    application: ShaderApplication
  ) {
    const liveCanvas = stageRef.current?.querySelector<HTMLElement>(`[data-shader-instance="${instanceKey}"]`)?.querySelector('canvas');
    if (liveCanvas?.width && liveCanvas.height) {
      try {
        drawCanvasImageCover(context, liveCanvas, liveCanvas.width, liveCanvas.height, width, height);
        return;
      } catch {
        paintFallback(context, width, height, application.settings);
        return;
      }
    }
    paintFallback(context, width, height, application.settings);
  }

  function outputLayerBox(
    layerId: CanvasLayerId,
    transform: CanvasLayerTransform,
    outputWidth: number,
    outputHeight: number
  ) {
    const geometry = layerGeometry(layerId, ratio);
    const centerX = geometry.baseX + transform.x + geometry.baseWidth / 2;
    const centerY = geometry.baseY + transform.y + geometry.baseHeight / 2;
    const dimensions = canvasLayerDimensions(transform, geometry);
    const width = dimensions.width / canvasDimensions.width * outputWidth;
    const height = dimensions.height / canvasDimensions.height * outputHeight;
    return {
      height,
      width,
      x: centerX / canvasDimensions.width * outputWidth - width / 2,
      y: centerY / canvasDimensions.height * outputHeight - height / 2,
    };
  }

  function textEffectScratchFor(layerId: TextLayerId) {
    const current = textEffectScratchRefs.current.get(layerId);
    if (current) return current;
    const scratch = {
      fill: document.createElement('canvas'),
      mask: document.createElement('canvas'),
      shadow: document.createElement('canvas'),
    };
    textEffectScratchRefs.current.set(layerId, scratch);
    return scratch;
  }

  function paintCompositionShader(
    context: CanvasRenderingContext2D,
    layerId: ShaderLayerId,
    width: number,
    height: number
  ) {
    const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
    if (!shaderLayer) return;
    const capturedSequence = sequenceCaptureRef.current;
    const renderedShader = capturedSequence?.layerId === layerId
      ? capturedSequence.application
      : shaderLayer;
    const box = outputLayerBox(
      layerId,
      normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM),
      width,
      height
    );
    context.save();
    context.globalAlpha = renderedShader.opacity;
    context.globalCompositeOperation = renderedShader.blendMode === 'normal'
      ? 'source-over'
      : renderedShader.blendMode;
    context.translate(box.x, box.y);
    paintShaderApplication(context, box.width, box.height, `canvas-${layerId}`, renderedShader);
    context.restore();
  }

  function paintCompositionEffect(
    context: CanvasRenderingContext2D,
    layerId: EffectLayerId,
    width: number,
    height: number,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void
  ) {
    const effectLayer = effectLayers.find((layer) => layer.id === layerId);
    if (!effectLayer) return;
    const preview = effectPreviewOverridesRef.current.get(layerId);
    const previewSettings = preview?.settings
      ? { ...effectLayer.settings, ...preview.settings }
      : effectLayer.settings;
    let scratch = effectScratchRefs.current.get(layerId);
    if (!scratch) {
      scratch = createCompositionEffectScratch() ?? undefined;
      if (scratch) effectScratchRefs.current.set(layerId, scratch);
    }
    applyCompositionEffect(context, width, height, {
      ...previewSettings,
      cellSize: previewSettings.cellSize * width / 960,
    }, preview?.opacity ?? effectLayer.opacity, scratch);
    onEffectPainted?.(layerId, context.canvas);
  }

  function paintCompositionImage(
    context: CanvasRenderingContext2D,
    layerId: LogoLayerId | AssetLayerId,
    width: number,
    height: number,
    images: ReadonlyMap<string, HTMLImageElement>
  ) {
    const isLogo = isLogoLayerId(layerId);
    const layer = isLogo
      ? logoLayers.find((candidate) => candidate.id === layerId)
      : compositionAssets.find((candidate) => candidate.id === layerId);
    const image = layer ? images.get(layer.id) : null;
    if (!layer || !image) return;
    const box = outputLayerBox(layer.id, layer.transform, width, height);
    const application = layerShaders[layer.id];
    const appearance = resolvedLogoAppearance(layer.appearance);
    const layerOpacity = layer.opacity ?? 1;
    if (!application) {
      const contained = createContainedLayer(
        image,
        box.width,
        box.height,
        isLogo ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : undefined,
        !isLogo
      );
      drawLogoAppearanceLayer(context, contained, box.x, box.y, box.width, box.height, appearance, layerOpacity);
      return;
    }

    const materialLayer = document.createElement('canvas');
    materialLayer.width = Math.max(1, Math.round(box.width));
    materialLayer.height = Math.max(1, Math.round(box.height));
    const materialContext = materialLayer.getContext('2d');
    if (!materialContext) return;
    paintShaderApplication(
      materialContext,
      materialLayer.width,
      materialLayer.height,
      `content-${layerId}`,
      application
    );
    materialContext.globalCompositeOperation = 'destination-in';
    if (isLogo) {
      drawContained(
        materialContext,
        image,
        image.naturalWidth || 1,
        image.naturalHeight || 1,
        0,
        0,
        materialLayer.width,
        materialLayer.height
      );
    } else {
      materialContext.drawImage(image, 0, 0, materialLayer.width, materialLayer.height);
    }
    context.save();
    context.globalAlpha = application.opacity;
    context.globalCompositeOperation = application.blendMode === 'normal'
      ? 'source-over'
      : application.blendMode;
    drawLogoAppearanceLayer(
      context,
      materialLayer,
      box.x,
      box.y,
      box.width,
      box.height,
      appearance,
      layerOpacity
    );
    context.restore();
  }

  function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    images: Map<string, HTMLImageElement>,
    frameLayerIds: readonly CompositionLayerId[] = visibleLayerIds,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void
  ) {
    return renderCanvasDocumentPage({
      context,
      document: designLabDocument,
      elementIds: frameLayerIds,
      height,
      manageCompositing: false,
      pageId: designLabPage.id,
      renderElement: ({ element }) => {
        const layerId = element.id as CompositionLayerId;
        if (isShaderLayerId(layerId)) return paintCompositionShader(context, layerId, width, height);
        if (isEffectLayerId(layerId)) return paintCompositionEffect(context, layerId, width, height, onEffectPainted);
        if (isLogoLayerId(layerId) || isAssetLayerId(layerId)) {
          return paintCompositionImage(context, layerId, width, height, images);
        }

      if (isTextLayerId(layerId)) {
        const textLayer = textLayers.find((layer) => layer.id === layerId);
        if (!textLayer || !textLayer.value) return;
        const transform = resolvedTextTransform(textLayer.transform);
        return paintDesignLabTextLayer({
          application: layerShaders[layerId],
          box: outputLayerBox(layerId, transform, width, height),
          canvasWidth: canvasDimensions.width,
          context,
          height,
          identity,
          layer: textLayer,
          paintShaderApplication,
          textEffectScratch: textEffectScratchFor(layerId),
          width,
        });
      }
      },
      width,
    });
  }

  async function waitForCompositionFonts() {
    if (!document.fonts) return;
    const visibleTextLayers = textLayers.filter((layer) => (
      layer.visible && visibleLayerIdSet.has(layer.id) && layer.value.length > 0
    ));
    if (visibleTextLayers.length === 0) return;

    await document.fonts.ready;
    await Promise.all(visibleTextLayers.map(async (layer) => {
      const appearance = resolvedTextAppearance(layer);
      const family = brandTypographyFamily(identity, appearance.fontRole);
      const weight = resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight);
      const faces = await document.fonts.load(
        `${weight} 64px ${JSON.stringify(family)}`,
        layer.value || 'Ag'
      );
      const isBundledBrandFont = brandFontAssets(identity).some((font) => (
        font.family === family && font.style === 'normal'
      ));
      if (isBundledBrandFont && faces.length === 0) {
        throw new Error(`${family} ${weight} could not be loaded for export.`);
      }
    }));
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function loadCompositionImages() {
    const entries: [string, string][] = [
      ...logoLayers.map((layer): [string, string] => [layer.id, layer.url]),
      ...compositionAssets.map((asset): [string, string] => [asset.id, asset.url]),
    ];
    return new Map(await Promise.all(entries.map(async ([id, source]) => [id, await loadCanvasImage(source)] as const)));
  }

  const composeFrameRef = useCommittedRef(composeFrame);
  const loadCompositionImagesRef = useCommittedRef(loadCompositionImages);
  const lastPreviewEffectIndex = visibleLayerIds.findLastIndex(isEffectLayerId);
  const effectPreviewOrderSignature = lastPreviewEffectIndex < 0
    ? ''
    : visibleLayerIds.slice(0, lastPreviewEffectIndex + 1).join('|');
  const compositionImageSignature = [
    ...logoLayers.map(({ id, url }) => `${id}:${url}`),
    ...compositionAssets.map(({ id, url }) => `${id}:${url}`),
  ].join('|');
  const pausedEffectPreviewSignature = paused ? compositionSignature : '';

  useEffect(() => {
    const activeEffectIds = visibleLayerIds.filter(isEffectLayerId);
    if (activeEffectIds.length === 0) return;

    let animationFrame = 0;
    let cancelled = false;
    let inViewport = true;
    let lastRenderedAt = -Infinity;
    let rendering = false;
    let previewWidth = Math.min(640, canvasDimensions.width);
    let targetFrameRate = 60;
    let renderDurationTotal = 0;
    let renderSamples = 0;
    const observer = typeof IntersectionObserver === 'undefined' || !stageRef.current
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = entry?.isIntersecting ?? true;
        }, { rootMargin: '120px' });
    if (observer && stageRef.current) observer.observe(stageRef.current);

    void loadCompositionImagesRef.current().then((images) => {
      if (cancelled) return;
      const tick = (now: number) => {
        if (cancelled) return;
        const shouldRender = inViewport && !document.hidden && !rendering && (paused || now - lastRenderedAt >= 1000 / targetFrameRate);
        if (shouldRender) {
          rendering = true;
          const renderStartedAt = performance.now();
          const previewHeight = Math.max(1, Math.round(previewWidth * canvasDimensions.height / canvasDimensions.width));
          const buffer = effectPreviewBufferRef.current ?? document.createElement('canvas');
          effectPreviewBufferRef.current = buffer;
          if (buffer.width !== previewWidth) buffer.width = previewWidth;
          if (buffer.height !== previewHeight) buffer.height = previewHeight;
          const context = buffer.getContext('2d', { willReadFrequently: true });
          const lastEffectIndex = Math.max(...activeEffectIds.map((effectId) => visibleLayerIds.indexOf(effectId)));
          if (context) {
            composeFrameRef.current(
              context,
              previewWidth,
              previewHeight,
              images,
              visibleLayerIds.slice(0, lastEffectIndex + 1),
              (effectId, source) => {
                const canvas = effectCanvasRefs.current.get(effectId);
                if (!canvas) return;
                if (canvas.width !== previewWidth) canvas.width = previewWidth;
                if (canvas.height !== previewHeight) canvas.height = previewHeight;
                const visibleContext = canvas.getContext('2d');
                if (!visibleContext) return;
                visibleContext.clearRect(0, 0, previewWidth, previewHeight);
                visibleContext.drawImage(source, 0, 0);
              }
            );
          }
          renderDurationTotal = renderDurationTotal + performance.now() - renderStartedAt;
          renderSamples = renderSamples + 1;
          if (renderSamples >= 8) {
            const averageDuration = renderDurationTotal / renderSamples;
            if (averageDuration > 14) {
              if (previewWidth > 360) previewWidth = Math.max(360, Math.round(previewWidth * 0.84));
              else targetFrameRate = 30;
            } else if (averageDuration < 9) {
              targetFrameRate = 60;
              previewWidth = Math.min(640, canvasDimensions.width, Math.round(previewWidth * 1.12));
            }
            renderDurationTotal = 0;
            renderSamples = 0;
          }
          lastRenderedAt = now;
          rendering = false;
        }
        if (!paused) animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    }).catch(() => {
      // Imported image errors should not take down the editable composition.
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    compositionImageSignature,
    composeFrameRef,
    effectPreviewOrderSignature,
    loadCompositionImagesRef,
    paused,
    pausedEffectPreviewSignature,
    visibleLayerIds,
  ]);

  function createExportCanvas() {
    const output = document.createElement('canvas');
    output.width = exportDimensions.width;
    output.height = exportDimensions.height;
    return output;
  }

  function gifProtectedCompositionColors(): string[] {
    const colors: string[] = [];
    visibleLayerIds.forEach((layerId) => {
      if (isTextLayerId(layerId) && !layerShaders[layerId]) {
        const layer = textLayers.find((candidate) => candidate.id === layerId);
        if (!layer) return;
        const appearance = resolvedTextAppearance(layer);
        colors.push(appearance.color);
        if (appearance.textEffect.kind !== 'solid') colors.push(appearance.textEffect.backgroundColor);
        if (appearance.outlineEnabled) colors.push(appearance.outlineColor);
        if (appearance.shadowEnabled) colors.push(appearance.shadowColor);
        return;
      }
      if (isLogoLayerId(layerId) && !layerShaders[layerId]) {
        const layer = logoLayers.find((candidate) => candidate.id === layerId);
        if (layer?.color) colors.push(layer.color);
      }
    });
    colors.push(canvasBackground);
    return colors;
  }

  async function exportStill(format: StillImageFormat): Promise<ExportPreviewAsset | null> {
    if (exporting) return null;
    const settingsSignature = currentExportSettingsSignature;
    const resumeAfterExport = !paused;
    const stillFrame = paused ? boundedPreviewFrame : previewFrameRef.current;
    flushSync(() => {
      setExporting(format);
      setCaptureTimeMs(stillFrame / normalizedExportSettings.fps * 1_000);
      setPaused(true);
    });
    setExportError(null);
    studioExport.start(`Rendering ${format.toUpperCase()} preview`);
    try {
      const startedAt = performance.now();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await waitForCompositionFonts();
      const output = createExportCanvas();
      const context = output.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      composeFrame(context, output.width, output.height, images);
      const quality = normalizedExportSettings.quality === 'fast'
        ? 0.82
        : normalizedExportSettings.quality === 'best'
          ? 0.96
          : 0.9;
      const blob = await canvasToImageBlob(output, format, quality);
      const label = format === 'jpg' ? 'JPG' : 'PNG';
      const fileName = `${identity.id}-design-lab-${output.width}x${output.height}.${format}`;
      const asset: ExportPreviewAsset = {
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        width: output.width,
      };
      setLastExport(asset);
      setLastExportRequest({ format, settingsSignature });
      return asset;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The still image could not be exported.');
      return null;
    } finally {
      setCaptureTimeMs(null);
      setExporting(null);
      if (resumeAfterExport) setPaused(false);
      studioExport.finish();
    }
  }

  async function waitForCapturedFrame(
    frame: MotionFrame,
    nextSequenceCapture: ShaderSequenceCapture | null = null
  ) {
    const materialChanged = sequenceCaptureRef.current?.materialId !== nextSequenceCapture?.materialId;
    sequenceCaptureRef.current = nextSequenceCapture;
    flushSync(() => {
      setSequenceCapture(nextSequenceCapture);
      setCaptureTimeMs(frame.timeMs);
    });
    await new Promise<void>((resolve) => {
      // Provider renderers stop their live loop before accepting the controlled clock.
      let remainingFrames = frame.index === 0 ? 10 : materialChanged ? 6 : 3;
      const settleFrame = () => {
        remainingFrames = remainingFrames - 1;
        if (remainingFrames === 0) resolve();
        else requestAnimationFrame(settleFrame);
      };
      requestAnimationFrame(settleFrame);
    });
  }

  async function exportMotion(format: 'gif' | 'mp4', motionMode: DesignMotionMode = 'standard'): Promise<ExportPreviewAsset | null> {
    if (exporting) return null;
    if (motionMode === 'sequence' && (!sequenceTargetLayer || shaderSequenceTimeline.length === 0)) {
      setExportError('Add a canvas shader before exporting a shader sequence.');
      return null;
    }
    if (sequencePreviewing) stopShaderSequencePreview();
    const settingsSignature = currentExportSettingsSignature;
    setExporting(format);
    setExportError(null);
    studioExport.start(`Rendering ${motionMode === 'sequence' ? 'shader sequence ' : ''}${format.toUpperCase()} preview`, 0);
    try {
      const startedAt = performance.now();
      await waitForCompositionFonts();
      const { durationMs, fps, quality } = normalizedExportSettings;
      const resolvedDurationMs = motionMode === 'sequence' ? shaderSequenceDuration : durationMs;
      const output = createExportCanvas();
      const context = output.getContext('2d', { willReadFrequently: format === 'gif' });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      const renderFrame = async (frame: MotionFrame) => {
        const segment = motionMode === 'sequence'
          ? shaderSequenceSegmentAt(shaderSequenceTimeline, frame.timeMs)
          : null;
        const nextSequenceCapture = segment && sequenceTargetLayer
          ? {
              application: sequenceApplicationFor(sequenceTargetLayer, segment.materialId),
              layerId: sequenceTargetLayer.id,
              materialId: segment.materialId,
            }
          : null;
        await waitForCapturedFrame(frame, nextSequenceCapture);
        composeFrame(context, output.width, output.height, images);
      };
      const sharedOptions = {
        canvas: output,
        durationMs: resolvedDurationMs,
        onProgress: studioExport.update,
        renderFrame,
      };
      let loopReport: MotionLoopReport | undefined;
      const blob = format === 'gif'
        ? await encodeCanvasGif({
            ...sharedOptions,
            colors: quality === 'fast' ? 64 : quality === 'best' ? 256 : 128,
            fps,
            loopMode: normalizedExportSettings.gifLoop,
            onLoopReport: (report) => { loopReport = report; },
            paletteFormat: quality === 'fast' ? 'rgb444' : 'rgb565',
            paletteStrategy: quality === 'best' ? 'per-frame' : 'global',
            protectedColors: gifProtectedCompositionColors(),
          })
        : await encodeCanvasMp4({ ...sharedOptions, fps, quality });
      const label = format.toUpperCase() as 'GIF' | 'MP4';
      const fileName = `${identity.id}-design-lab${motionMode === 'sequence' ? '-shader-sequence' : ''}-${output.width}x${output.height}.${format}`;
      const asset: ExportPreviewAsset = {
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        loopReport,
        width: output.width,
      };
      setLastExport(asset);
      setLastExportRequest({ format, motionMode, settingsSignature });
      return asset;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : `The ${format.toUpperCase()} could not be exported.`);
      return null;
    } finally {
      sequenceCaptureRef.current = null;
      setSequenceCapture(null);
      setCaptureTimeMs(null);
      setExporting(null);
      studioExport.finish();
    }
  }

  function updateExportSettings(patch: Partial<DesignExportSettings>) {
    setExportSettings((current) => ({ ...current, ...patch }));
  }

  function updateShaderSequenceSettings(patch: Partial<DesignShaderSequenceSettings>) {
    setShaderSequenceSettings((current) => {
      const next = { ...current, ...patch };
      return {
        ...normalizeShaderSequenceSettings(next),
        targetLayerId: next.targetLayerId,
      };
    });
  }

  async function exportForAutomation(request: DesignAutomationExportInput): Promise<ExportPreviewAsset> {
    const motionMode: DesignMotionMode = request.mode === 'shader-sequence' ? 'sequence' : 'standard';
    const asset = request.format === 'png' || request.format === 'jpg'
      ? await exportStill(request.format)
      : await exportMotion(request.format, motionMode);
    if (!asset) throw new Error(`Design Lab could not export ${request.format.toUpperCase()}.`);
    if (request.download) downloadStudioArtifact(asset);
    return asset;
  }

  const designAutomationRef = useCommittedRef({
    applyCompositionSource,
    compositionSetupSource,
    exportForAutomation,
    normalizedShaderSequenceSettings,
    previewShaderSequence,
    sequencePreviewing,
    shaderSequenceDuration,
    shaderSequenceTimeline,
    stopShaderSequencePreview,
    updateShaderSequenceSettings,
  });

  useEffect(() => registerStudioAutomation({
    actions: [
      'source.read',
      'source.apply',
      'controls.list',
      'control.activate',
      'control.set',
      'artifact.download',
      'design.sequence.describe',
      'design.sequence.configure',
      'design.sequence.preview',
      'design.sequence.stop',
      'design.export',
      'design.export.png',
      'design.export.jpg',
      'design.export.gif',
      'design.export.mp4',
      'design.export.shader-sequence.gif',
      'design.export.shader-sequence.mp4',
    ],
    applySource: (source) => designAutomationRef.current.applyCompositionSource(source),
    getSource: () => {
      const source = designAutomationRef.current.compositionSetupSource();
      if (source === null) throw new Error('Portable composition code is still being prepared.');
      return source;
    },
    invoke: (action, input) => invokeDesignAutomationAction(designAutomationRef.current, action, input),
    toolId: tool.id,
  }), [designAutomationRef, tool.id]);

  function refreshExportPreview() {
    if (!lastExportRequest || exporting) return;
    if (lastExportRequest.format === 'gif' || lastExportRequest.format === 'mp4') {
      void exportMotion(lastExportRequest.format, lastExportRequest.motionMode ?? 'standard');
      return;
    }
    void exportStill(lastExportRequest.format);
  }

  function previewExportFormat(format: DesignExportFormat) {
    if (exporting) return;
    if (format === 'gif' || format === 'mp4') {
      void exportMotion(format);
      return;
    }
    void exportStill(format);
  }

  function renderLiveMaterial(application: ShaderApplication, instanceKey: string) {
    const controlledTimeMs = captureTimeMs ?? (paused ? previewCaptureTimeMs : null);
    const renderedApplication = sequenceCapture && instanceKey === `canvas-${sequenceCapture.layerId}`
      ? sequenceCapture.application
      : application;
    return (
      <LiveMaterialCanvas
        captureTimeMs={controlledTimeMs}
        className='absolute inset-0 size-full'
        key={`${instanceKey}:${renderedApplication.materialId}`}
        materialId={renderedApplication.materialId}
        patternScale={clampShaderZoom(renderedApplication.shaderSize)}
        paused={paused || controlledTimeMs !== null}
        previewChannel={instanceKey}
        previewGroup='design-lab'
        renderScale={1}
        settings={renderedApplication.settings}
      />
    );
  }

  function renderStudioHeader() {
    return (
      <StudioToolHeader
        actions={(
          <>
            <SourceCodeButton disabled={portableDesignLab.source === null} onClick={() => setSourceOpen(true)} />
            {lastExport ? (
              <ExportPreview
                asset={lastExport}
                autoRefresh={false}
                configuration={(
                  <DesignExportWorkspace
                    disabled={Boolean(exporting)}
                    format={exporting ?? lastExportRequest?.format ?? 'png'}
                    onChange={updateExportSettings}
                    onFormatChange={previewExportFormat}
                    ratioOption={ratioOption}
                    settings={normalizedExportSettings}
                  />
                )}
                needsRefresh={previewNeedsRefresh}
                onRefresh={refreshExportPreview}
                refreshKey={currentExportSettingsSignature}
                refreshing={Boolean(exporting)}
                triggerLabel='Export'
              />
            ) : (
              <Button aria-label='Open export settings' disabled={Boolean(exporting)} loading={exporting === 'png'} onClick={() => void exportStill('png')} type='button'>
                <Download aria-hidden='true' /><span className='responsive-toolbar-label'>Export</span>
              </Button>
            )}
            {exportError ? <span className='max-w-44 truncate text-[10px] text-status-error' role='alert' title={exportError}>{exportError}</span> : null}
            <Button aria-label={paused ? 'Play shader' : 'Pause shader'} onClick={toggleShaderHistory} size='icon' type='button' variant='outline'>
              {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
            </Button>
          </>
        )}
        metadata='Type · marks · images · live materials'
        navigation={navigation}
        navigationLabel='Design Lab view'
        status={(
          <DesignVersionControls
            autosaveState={compositionAutosaveState}
            identityId={identity.id}
            onOpen={applyCompositionSource}
            revision={savedDesignRevision}
            source={compositionSetupSource}
            toolId={tool.id}
            workspaceLabel='Design Lab'
          />
        )}
        title={tool.name}
        toolId={tool.id}
      />
    );
  }

  function renderShaderLibrary() {
    return (
      <aside className='shader-lab-v2-library studio-sidebar lab-sidebar lab-sidebar-left studio-scroll-area' aria-label='Shader library' data-canvas-selection-preserve>
        <LabPanelHeading
          action={<button aria-label='Choose a random shader' onClick={selectRandomMaterial} title='Random shader' type='button'><Sparkles aria-hidden='true' /></button>}
          className='shader-lab-v2-panel-heading'
          description={`${materials.length} of ${shaderLabCategoryCount('all')} materials`}
          title='Shader library'
        />
        <label className='shader-lab-v2-search'>
          <Search aria-hidden='true' />
          <input aria-label='Search shaders' onChange={(event) => setQuery(event.target.value)} placeholder={`Search all ${shaderLabCategoryCount('all')} shaders`} type='search' value={query} />
        </label>
        <div aria-label='Shader categories' className='shader-lab-v2-categories' role='group'>
          {SHADER_LAB_CATEGORIES.map((option) => (
            <button aria-pressed={category === option.id} key={option.id} onClick={() => setCategory(option.id)} type='button'>
              {option.label}<span>{shaderLabCategoryCount(option.id)}</span>
            </button>
          ))}
        </div>
        <div className='shader-lab-v2-material-grid studio-scroll-area'>
          {materials.map((option) => (
            <ShaderMaterialCard key={option.id} material={option} onSelect={handleMaterialSelect} selected={editingShader?.materialId === option.id} />
          ))}
        </div>
      </aside>
    );
  }

  function renderSourceEditor() {
    if (!sourceOpen || portableDesignLab.source === null) return null;
    return (
      <SourceCodeDrawer
        format='JSON · Design Lab composition'
        onApply={applyCompositionSource}
        onClose={() => setSourceOpen(false)}
        source={compositionSetupSource()!}
        title='Composition code'
      />
    );
  }

  function renderStageLayer(layerId: CompositionLayerId, index: number) {
    const zIndex = 4 + index;
    if (isShaderLayerId(layerId)) {
      const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
      if (!shaderLayer) return null;
      const geometry = layerGeometry(layerId, ratio);
      const transform = normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM);
      return (
        <EditableCanvasLayer
          {...geometry}
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer shader-lab-v2-composition-shader'
          key={layerId}
          label={shaderLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(nextTransform) => updateCanvasLayerTransform(layerId, nextTransform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          resizeMode='box'
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={transform}
          zIndex={zIndex}
        >
          <div
            className='shader-lab-v2-canvas-material'
            data-shader-instance={`canvas-${layerId}`}
            style={{
              mixBlendMode: shaderBlendStyle(shaderLayer.blendMode),
              opacity: shaderLayer.opacity,
            }}
          >
            {renderLiveMaterial(shaderLayer, `canvas-${layerId}`)}
          </div>
        </EditableCanvasLayer>
      );
    }
    if (isEffectLayerId(layerId)) {
      const effectLayer = effectLayers.find((layer) => layer.id === layerId);
      if (!effectLayer) return null;
      return (
        <canvas
          aria-hidden='true'
          className='shader-lab-v2-composition-effect'
          data-effect-kind={effectLayer.settings.kind}
          key={layerId}
          ref={(canvas) => {
            if (canvas) effectCanvasRefs.current.set(layerId, canvas);
            else effectCanvasRefs.current.delete(layerId);
          }}
          style={{ zIndex }}
        />
      );
    }

    const geometry = layerGeometry(layerId, ratio);
    if (isLogoLayerId(layerId)) {
      const logoLayer = logoLayers.find((layer) => layer.id === layerId);
      if (!logoLayer) return null;
      const application = layerShaders[layerId];
      return (
        <EditableCanvasLayer
          {...geometry}
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer'
          key={layerId}
          label={logoLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={logoLayer.transform}
          zIndex={zIndex}
        >
          <ShaderMaskedMediaContent
            application={application}
            appearance={logoLayer.appearance}
            fallbackColor={logoLayer.color ?? '#FFFFFF'}
            instanceKey={`content-${layerId}`}
            label={logoLayer.name}
            opacity={logoLayer.opacity ?? 1}
            renderMaterial={renderLiveMaterial}
            url={logoLayer.url}
          />
        </EditableCanvasLayer>
      );
    }
    if (isTextLayerId(layerId)) {
      const textLayer = textLayers.find((layer) => layer.id === layerId);
      if (!textLayer) return null;
      const application = layerShaders[layerId];
      const transform = resolvedTextTransform(textLayer.transform);
      const textFontSizeCqw = canvasDimensions.height / canvasDimensions.width * 17 * transform.scale;
      return (
        <EditableCanvasLayer
          {...geometry}
          allowContentInteraction
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer'
          key={layerId}
          label={textLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(nextTransform) => updateCanvasLayerTransform(layerId, nextTransform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          resizeMode='box'
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={transform}
          zIndex={zIndex}
        >
          <CanvasTextLayerContent
            application={application}
            fontSizeCqw={textFontSizeCqw}
            identity={identity}
            layer={textLayer}
            onChange={(value) => updateTextLayer(layerId, { value })}
            onFocus={() => selectCanvasAssembly(layerId)}
            renderMaterial={renderLiveMaterial}
          />
        </EditableCanvasLayer>
      );
    }
    const asset = compositionAssets.find(({ id }) => id === layerId);
    if (!asset) return null;
    const application = layerShaders[layerId];
    return (
      <EditableCanvasLayer
        {...geometry}
        canvasHeight={canvasDimensions.height}
        canvasWidth={canvasDimensions.width}
        className='shader-lab-v2-composition-layer'
        key={layerId}
        label={asset.name}
        movementBounds={movementBoundsFor(layerId)}
        onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
        onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
        onDeselect={deselectCanvasLayers}
        onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
        selected={selectedCanvasLayerIdSet.has(layerId)}
        selectionMember={selectedCanvasLayerIdSet.has(layerId)}
        showSelectionControls={selectedCanvasLayerIds.length <= 1}
        transform={asset.transform}
        zIndex={zIndex}
      >
        <ShaderMaskedMediaContent
          application={application}
          appearance={asset.appearance}
          fallbackColor='#FFFFFF'
          instanceKey={`content-${layerId}`}
          label={asset.name}
          opacity={asset.opacity ?? 1}
          preserveColors
          renderMaterial={renderLiveMaterial}
          url={asset.url}
        />
      </EditableCanvasLayer>
    );
  }

  function renderDockLayer(layerId: CompositionLayerId, index: number) {
    const layerIsVisible = layerVisible(layerId);
    const orderIndex = layerOrder.indexOf(layerId);
    const { assetLayer, effectLayer, logoLayer, shaderLayer, textLayer } = resolveLayerDockLayers(
      layerId,
      { assets: compositionAssets, effects: effectLayers, logos: logoLayers, shaders: shaderLayers, text: textLayers }
    );
    const appliedShader = shaderLayer ?? (isContentLayerId(layerId) ? layerShaders[layerId] : null);
    const layerGroup = isCanvasLayerId(layerId) ? groupForLayer(layerId) : null;
    const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
    const previewUrl = logoLayer?.url ?? assetLayer?.url;
    const selected = selectedLayerId === layerId
      || (isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId));
    return (
      <div
        aria-selected={selected}
        className='shader-lab-v2-dock-layer'
        data-kind={layerKind(layerId).toLocaleLowerCase().replaceAll(' ', '-')}
        data-material={appliedShader ? 'true' : 'false'}
        data-visible={layerIsVisible}
        key={layerId}
      >
        <button className='shader-lab-v2-dock-layer-select' onClick={() => selectLayerFromStack(layerId)} title={`Select ${layerLabel(layerId)}`} type='button'>
          <span className='shader-lab-v2-dock-layer-icon'><CanvasLayerKindIcon layerId={layerId} /></span>
          <span className='shader-lab-v2-dock-layer-copy'>
            <strong>{layerLabel(layerId)}</strong>
            <small>{String(index + 1).padStart(2, '0')} · {layerKind(layerId)}{layerGroup ? ` · ${layerGroup.name}` : ''}</small>
          </span>
        </button>
        <div className='shader-lab-v2-dock-layer-preview'>
          {appliedShader ? (
            <span className='shader-lab-v2-dock-material-frame'><AuthenticShaderPreview materialId={appliedShader.materialId} /></span>
          ) : null}
          {textLayer && textAppearance ? (
            <input
              aria-label={`Edit ${textLayer.name}`}
              onChange={(event) => updateTextLayer(textLayer.id, { value: event.target.value })}
              onFocus={() => selectLayerFromStack(textLayer.id)}
              onKeyDown={(event) => event.stopPropagation()}
              style={{
                color: textAppearance.color,
                fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, sans-serif`,
                fontWeight: resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight),
                letterSpacing: `${textLayer.tracking}em`,
                opacity: textAppearance.opacity,
              }}
              type='text'
              value={textLayer.value}
            />
          ) : (
            <LayerDockStaticPreview effectLayer={effectLayer} label={layerLabel(layerId)} onSelect={() => selectLayerFromStack(layerId)} previewUrl={previewUrl} />
          )}
        </div>
        <div className='shader-lab-v2-dock-layer-actions'>
          <button aria-label={`Duplicate ${layerLabel(layerId)}`} onClick={() => duplicateLayer(layerId)} title='Duplicate' type='button'><Copy aria-hidden='true' /></button>
          <button aria-label={`Move ${layerLabel(layerId)} forward`} disabled={orderIndex === layerOrder.length - 1} onClick={() => moveLayer(layerId, 1)} title='Move forward' type='button'><ArrowUp aria-hidden='true' /></button>
          <button aria-label={`Move ${layerLabel(layerId)} backward`} disabled={orderIndex === 0} onClick={() => moveLayer(layerId, -1)} title='Move backward' type='button'><ArrowDown aria-hidden='true' /></button>
          <button aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`} aria-pressed={layerIsVisible} onClick={() => toggleLayerVisibility(layerId)} title={layerIsVisible ? 'Hide layer' : 'Show layer'} type='button'>{layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
          <button aria-label={`Delete ${layerLabel(layerId)}`} onClick={() => removeLayer(layerId)} title='Delete' type='button'><Trash2 aria-hidden='true' /></button>
        </div>
      </div>
    );
  }

  function renderStudio() {
    return (
    <div className='shader-lab-v2 tool-shell h-full min-h-0'>
      {renderStudioHeader()}

      <div className='shader-lab-v2-layout studio-scroll-area'>
        {renderShaderLibrary()}

        <main
          className='shader-lab-v2-workspace'
          data-image-drop={imageDropActive ? 'active' : undefined}
          onDragEnter={(event) => {
            if (!dataTransferHasFiles(event.dataTransfer)) return;
            event.preventDefault();
            setImageDropActive(true);
          }}
          onDragLeave={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
            setImageDropActive(false);
          }}
          onDragOver={(event) => {
            if (!dataTransferHasFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setImageDropActive(true);
          }}
          onDrop={handleImageDrop}
        >
          {imageDropActive ? (
            <div className='shader-lab-v2-image-drop-overlay' role='status'>
              <span><ImagePlus aria-hidden='true' /></span>
              <strong>Drop images onto the canvas</strong>
              <small>They will be centered, fitted, and kept at their original aspect ratio.</small>
            </div>
          ) : null}
          <CanvasViewport
            className='shader-lab-v2-composer-viewport'
            draftKey='shader-lab-v2-canvas-zoom'
            identityId={identity.id}
            maxZoom={220}
            onDeselect={deselectCanvasLayers}
            toolId={tool.id}
          >
            <div className='shader-lab-v2-stage-wrap'>
              <div
                className={`shader-lab-v2-stage shader-lab-v2-stage-${ratio}`}
                data-material-id={sequenceCapture?.materialId ?? editingShader?.materialId}
                data-testid='shader-lab-live-stage'
                onKeyDown={handleCanvasAssemblyKeyDown}
                onPointerDown={deselectCanvasLayers}
                ref={stageRef}
                style={{
                  aspectRatio: `${ratioOption.width} / ${ratioOption.height}`,
                  backgroundColor: canvasBackground,
                }}
              >
                {visibleLayerIds.map(renderStageLayer)}
                <span aria-live='polite' className='sr-only'>
                  {canvasSelectionAnnouncement(selectedCanvasLayerIds.length, selectedCanvasGroup?.name)}
                </span>
                <div className='shader-lab-v2-stage-shade' aria-hidden='true' />
              </div>
            </div>
          </CanvasViewport>
          {selectedCanvasLayerIds.length > 1 && selectedCanvasBounds ? (
            <CanvasSelectionAssemblyOverlay
              bounds={selectedCanvasBounds}
              canvasHeight={canvasDimensions.height}
              canvasWidth={canvasDimensions.width}
              label={selectedCanvasGroup?.name ?? `${selectedCanvasLayerIds.length} layers`}
              stageRef={stageRef}
            />
          ) : null}
          <CanvasSelectionMenu
            canGroup={selectedCanvasLayerIds.length > 1 && !selectedCanvasGroup}
            canUngroup={selectedGroupedAssemblies.length > 0}
            count={selectedCanvasLayerIds.length}
            groupName={selectedCanvasGroup?.name}
            onAlign={alignCanvasAssembly}
            onBringForward={() => moveCanvasSelection(1)}
            onClose={() => setSelectionMenuPosition(null)}
            onDelete={removeCanvasSelection}
            onDuplicate={duplicateCanvasSelection}
            onGroup={groupCanvasSelection}
            onSendBackward={() => moveCanvasSelection(-1)}
            onUngroup={ungroupCanvasSelection}
            position={selectionMenuPosition}
          />
          <ShaderFrameHistoryControl
            durationMs={normalizedExportSettings.durationMs}
            fps={normalizedExportSettings.fps}
            frame={boundedPreviewFrame}
            onFramePreview={trackPreviewFrame}
            onPauseAtFrame={pauseAtPreviewFrame}
            onPlay={playShaderHistory}
            onScrub={pauseAtPreviewFrame}
            onScrubPreview={(frame) => {
              previewLiveMaterialTime('design-lab', frame / normalizedExportSettings.fps * 1_000);
            }}
            playing={!paused && captureTimeMs === null}
          />
          <div className='shader-lab-v2-bottom-dock' data-canvas-selection-preserve>
            <input accept='image/*,.svg,.avif,.bmp' aria-label='Choose logos for the canvas' className='sr-only' multiple onChange={(event) => void addLogoFiles(event.target.files)} ref={logoInputRef} type='file' />
            <div className='shader-lab-v2-dock-create'>
              <div className='shader-lab-v2-dock-heading'>
                <span><Layers3 aria-hidden='true' />Layers</span>
                <small>{listedLayerIds.length} total · front to back</small>
              </div>
              <div className='shader-lab-v2-dock-add' aria-label='Add canvas layer'>
                <button onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span>Text</span></button>
                <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span>Shader</span></button>
                <button onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span>Effect</span></button>
                <button aria-label='Add brand mark' onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span>Mark</span></button>
                <button className='shader-lab-v2-dock-add-image' onClick={() => openImageImport()} title='Open the shared Asset library or import new images' type='button'>
                  <ImagePlus aria-hidden='true' />
                  <span><strong>Image</strong><small>Browse · drop · paste</small></span>
                </button>
              </div>
              <span aria-live='polite' className='shader-lab-v2-image-import-status' data-state={imageImportState.status}>
                {imageImportState.message || 'Images keep their aspect ratio when added.'}
              </span>
            </div>

            <div
              aria-label='Canvas layer stack'
              className='shader-lab-v2-dock-stack studio-scroll-area'
              onWheel={scrollLayerDockWithWheel}
              tabIndex={0}
            >
              {[...listedLayerIds].reverse().map(renderDockLayer)}
            </div>
          </div>
        </main>

        <aside className='shader-lab-v2-inspector studio-sidebar lab-sidebar lab-sidebar-right studio-scroll-area' aria-label='Design Lab controls' data-canvas-selection-preserve>
          <LabPanelHeading
            className='shader-lab-v2-inspector-intro'
            description={designLabInspectorDescription({
              hasContent: Boolean(selectedContentLayerId),
              hasEffect: Boolean(selectedEffectLayer),
              hasLayerShader: Boolean(selectedLayerShader),
              hasShader: Boolean(selectedShaderLayer),
              materialName: material.name,
            })}
            title={selectedLayerId ? layerLabel(selectedLayerId) : 'Design Lab'}
          />

          <ConditionalRender when={!selectedLayerId}>{() => <>
            <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-composition-setup' meta={`${canvasDimensions.width} × ${canvasDimensions.height}`} title='Composition setup'>
              <div className='shader-lab-v2-composition-ratios' aria-label='Composition aspect ratio'>
                {RATIO_OPTIONS.map((option) => (
                  <button aria-pressed={ratio === option.value} key={option.value} onClick={() => setRatio(option.value)} type='button'>
                    <i aria-hidden='true' style={{ aspectRatio: `${option.width} / ${option.height}` }} />
                    <span><strong>{option.label}</strong><small>{option.value === 'wide' ? 'Wide' : option.value === 'square' ? 'Square' : 'Social'}</small></span>
                  </button>
                ))}
              </div>
              <dl className='shader-lab-v2-composition-metrics'>
                <div><dt>Layers</dt><dd>{visibleLayerIds.length} / {listedLayerIds.length}</dd></div>
                <div><dt>Shaders</dt><dd>{shaderLayers.filter(({ visible }) => visible).length}</dd></div>
                <div><dt>Motion</dt><dd>{paused ? 'Paused' : 'Live'}</dd></div>
              </dl>

              <div className='shader-lab-v2-composition-group'>
                <div className='shader-lab-v2-composition-subhead'><h4>Layers</h4><span>Add to front</span></div>
                <div className='shader-lab-v2-composition-add' aria-label='Add composition layer'>
                  <button onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span><strong>Text</strong><small>{textLayers.length} layers</small></span></button>
                  <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span><strong>Shader</strong><small>{shaderLayers.length} layers</small></span></button>
                  <button onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span><strong>Effect</strong><small>{effectLayers.length} layers</small></span></button>
                  <button onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span><strong>Mark</strong><small>{logoLayers.length} layers</small></span></button>
                  <button onClick={() => openImageImport()} title='Open the shared Asset library or import new images' type='button'><ImagePlus aria-hidden='true' /><span><strong>Image</strong><small>{compositionAssets.length} placed · {identity.assets.length + identity.proofAssets.length} saved</small></span></button>
                </div>
              </div>

            </LabInspectorSection>
          </>}</ConditionalRender>

          <LabInspectorSection className='shader-lab-v2-control-section' meta='Background' title='Canvas'>
            <ColorControl
              ariaLabel='Canvas background color'
              label='Background color'
              onChange={setCanvasBackground}
              onPreview={(color) => {
                if (stageRef.current) stageRef.current.style.backgroundColor = color;
              }}
              value={canvasBackground}
            />
          </LabInspectorSection>

          <LabInspectorSection
            className='shader-lab-v2-control-section shader-lab-v2-sequence-section'
            meta={`${normalizedShaderSequenceSettings.cutCount} shaders · ${(shaderSequenceDuration / 1_000).toFixed(1)}s`}
            title='Shader sequence'
          >
            <ShaderSequenceControls
              disabled={Boolean(exporting)}
              durationMs={shaderSequenceDuration}
              materialIds={sequenceMaterialIds}
              onChange={updateShaderSequenceSettings}
              onExport={() => void exportMotion('mp4', 'sequence')}
              onPreview={previewShaderSequence}
              previewing={sequencePreviewing}
              settings={normalizedShaderSequenceSettings}
              targetOptions={sequenceTargetOptions}
            />
          </LabInspectorSection>

          <OptionalRender value={selectedEffectLayer}>{(selectedEffectLayer) => (
            <DesignLabEffectInspector
              previewEffectLayer={previewEffectLayer}
              selectEffectPreset={selectEffectPreset}
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
              previewChannel={selectedShaderPreviewChannel}
              previewSelectedShaderOpacity={previewSelectedShaderOpacity}
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
              onChange={(transform) => updateCanvasLayerTransform(selectedShaderLayer.id, transform)}
            />
          )}</OptionalRender>
          <OptionalRender value={selectedContentLayerId}>{(selectedContentLayerId) => <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-layer-inspector' data-canvas-selection-preserve meta={layerKind(selectedContentLayerId)} title='Selected layer'>
            <OptionalRender value={selectedTextInspector}>{(selection) => (
              <DesignLabTextLayerInspector
                canvasHeight={canvasDimensions.height}
                canvasWidth={canvasDimensions.width}
                identity={identity}
                previewSelectedContentOpacity={previewSelectedContentOpacity}
                previewSelectedTextAppearance={previewSelectedTextAppearance}
                previewSelectedTextWidth={previewSelectedTextWidth}
                selectedCanvasLayerCount={selectedCanvasLayerIds.length}
                selection={selection}
                textRenderedWeight={selectedTextRenderedWeight}
                textWeightRange={selectedTextWeightRange}
                updateTextLayer={updateTextLayer}
              />
            )}</OptionalRender>
            <OptionalRender value={selectedLogoInspector}>{({ appearance: selectedLogoAppearance, layer: selectedLogoLayer }) => (
              <div aria-label='Mark appearance' className='shader-lab-v2-layer-settings'>
                <div className='shader-lab-v2-layer-settings-heading'>
                  <strong>Mark appearance</strong>
                  <span>SVG-safe</span>
                </div>
                <ColorControl
                  ariaLabel='Mark color'
                  label='Mark color'
                  onChange={(color) => updateLogoLayer(selectedLogoLayer.id, { color })}
                  onPreview={(color) => previewSelectedLogoAppearance({}, color)}
                  value={selectedLogoLayer.color ?? '#FFFFFF'}
                />
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateLogoLayer(selectedLogoLayer.id, { opacity })}
                  onPreview={previewSelectedContentOpacity}
                  step={0.01}
                  value={selectedLogoLayer.opacity ?? 1}
                />
                <LogoAppearanceControls
                  onChange={(patch) => updateLogoLayer(selectedLogoLayer.id, { appearance: { ...selectedLogoAppearance, ...patch } })}
                  onPreview={previewSelectedLogoAppearance}
                  settings={selectedLogoAppearance}
                />
                <details className='shader-lab-v2-asset-conversion'>
                  <summary><span>SVG conversion & mark library</span><ChevronDown aria-hidden='true' /></summary>
                  <AssetConversionLibrary
                    compact
                    library={convertedAssetLibrary}
                    onSelect={selectConvertedLogo}
                    selectedAssetId={selectedLogoLayer.convertedAssetId ?? null}
                  />
                </details>
              </div>
            )}</OptionalRender>
            <OptionalRender value={selectedAssetInspector}>{({ appearance: selectedAssetAppearance, asset: selectedAsset }) => (
              <div aria-label='Image appearance' className='shader-lab-v2-layer-settings'>
                <div className='shader-lab-v2-layer-settings-heading'>
                  <strong>Image appearance</strong>
                  <span>Non-destructive</span>
                </div>
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateAssetLayer(selectedAsset.id, { opacity })}
                  onPreview={previewSelectedContentOpacity}
                  step={0.01}
                  value={selectedAsset.opacity ?? 1}
                />
                <LogoAppearanceControls
                  kind='image'
                  onChange={(patch) => updateAssetLayer(selectedAsset.id, { appearance: { ...selectedAssetAppearance, ...patch } })}
                  onPreview={previewSelectedLogoAppearance}
                  settings={selectedAssetAppearance}
                />
              </div>
            )}</OptionalRender>
            {selectedLayerShader ? (
              <Button className='mt-2 w-full' onClick={removeShaderFromSelectedContent} size='sm' type='button' variant='ghost'>
                <X aria-hidden='true' />Remove shader from layer
              </Button>
            ) : null}
            {selectedLogoLayer ? <Button className='mt-2 w-full' onClick={() => updateLogoTransform(selectedLogoLayer.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset mark position</Button> : null}
            {selectedAsset ? <Button className='mt-2 w-full' onClick={() => updateAssetTransform(selectedAsset.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset image position</Button> : null}
            {selectedTextLayer ? (
              <Button
                className='mt-2 w-full'
                onClick={() => updateTextLayer(selectedTextLayer.id, { transform: DEFAULT_TEXT_LAYER_TRANSFORM })}
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
            <button onClick={() => void copySetup()} type='button'>{copied ? <Check aria-hidden='true' /> : 'Copy'}</button>
            {copyError ? <p className='shader-lab-v2-handoff-error' role='alert'>{copyError}</p> : null}
          </section>
        </aside>
      </div>
      {renderSourceEditor()}
      <ImageAssetModal
        assets={[...identity.assets, ...identity.proofAssets]}
        busy={imageImportState.status === 'importing'}
        error={imageImportError}
        onClose={() => {
          if (imageImportState.status === 'importing') return;
          setImageImportOpen(false);
          setImageImportRequest(null);
          setImageImportError(null);
        }}
        onImport={importAndSaveImages}
        onPlace={placeSavedAsset}
        open={imageImportOpen}
        request={imageImportRequest}
      />
    </div>
    );
  }

  return renderStudio();
}
