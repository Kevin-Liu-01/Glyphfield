'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  ArrowDown,
  ArrowUp,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  Palette,
  RotateCcw,
  Trash2,
  Type,
} from '@/components/ui/SolidIcons';

import AnimationPackageGallery, {
  ANIMATION_PACKAGES,
  animationPackagePresentation,
} from '@/components/AnimationPackageGallery';
import AnimationSequenceTooltipPreview from '@/components/AnimationSequenceTooltipPreview';
import AnimationTimelinePreview from '@/components/AnimationTimelinePreview';
import BezierEditor from '@/components/BezierEditor';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import MaterialFinishControls from '@/components/MaterialFinishControls';
import { ShaderLibraryBrowser } from '@/components/ShaderLibrarySidebar';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  brandMaterialPalette,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
} from '@/lib/liveMaterials';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioSource } from '@/lib/renderFrame';
import { shaderLabSettingsFor, shaderPreviewAssetPath } from '@/lib/shaderLab';
import {
  formatShaderZoom,
  shaderZoomFromSlider,
  shaderZoomToSlider,
  SHADER_ZOOM_SLIDER_MAX,
  SHADER_ZOOM_SLIDER_MIN,
  SHADER_ZOOM_SLIDER_STEP,
} from '@/lib/shaderZoom';
import {
  EASING_PRESETS,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
  type StudioTransitionSettings,
} from '@/lib/studio';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import { normalizeMaterialFinish } from '@/lib/materialFinish';

type StudioControlsProps = {
  backgroundOverrideCount: number;
  backgroundOverrideSourceIds: readonly string[];
  backgroundScope: 'sequence' | 'frame';
  brandLogoAvailable: boolean;
  compact?: boolean;
  frameSettings: StudioFrameSettings | null;
  hasSelectedBackgroundOverride: boolean;
  hasImageSources: boolean;
  hasSelectedTransitionOverride: boolean;
  includeBrandLogo: boolean;
  onAddText: () => void;
  onBackgroundChange: (patch: Partial<StudioFrameSettings['background']>) => void;
  onBackgroundScopeChange: (scope: 'sequence' | 'frame') => void;
  onClearBackgroundOverrides: () => void;
  onLibraryBackgroundChange: (patch: Partial<StudioFrameSettings['background']>) => void;
  onFiles: (files: FileList) => void;
  onFrameSettingsChange: (patch: Partial<StudioFrameSettings>) => void;
  onIncludeBrandLogoChange: (include: boolean) => void;
  onMoveSource: (id: string, direction: -1 | 1) => void;
  onRemoveSource: (id: string) => void;
  onResetBackgroundOverride: (id: string) => void;
  onResetFrame: () => void;
  onResetSelectedBackgroundOverride: () => void;
  onResetSelectedTransition: () => void;
  onSelectedTransitionSettingsChange: (patch: Partial<StudioTransitionSettings>) => void;
  onSelectSequenceBackground: () => void;
  onSelectSourceBackground: (id: string) => void;
  onSelectSource: (id: string) => void;
  onSelectTransition: (index: number) => void;
  onSettingsChange: (patch: Partial<StudioSettings>) => void;
  onTextSourceChange: (id: string, value: string) => void;
  identity?: Pick<BrandIdentity, 'colors' | 'id' | 'name' | 'shortName'>;
  panel: 'properties' | 'source';
  previewSources: readonly StudioSource[];
  selectedSource: StudioSource | null;
  selectedEffectTarget: 'background' | 'content';
  selectedTransitionIndex: number | null;
  selectedTransitionSettings: StudioTransitionSettings;
  sequenceBackground: StudioBackgroundSettings;
  settings: StudioSettings;
  sources: readonly StudioSource[];
  transitionSettings: readonly StudioTransitionSettings[];
};

const COMPACT_SHADER_EXCLUSIONS = [
  'shadergradient-prismatic-sphere',
] as const satisfies readonly LiveMaterialId[];

function InspectorSection({
  children,
  index,
  title,
}: {
  children: ReactNode;
  index: string;
  title: ReactNode;
}) {
  return (
    <LabInspectorSection index={index} title={title}>
      {children}
    </LabInspectorSection>
  );
}

function RangeControl({
  ariaLabel,
  formatValue,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  ariaLabel?: string;
  formatValue?: (value: number) => string;
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const resolvedValue = Math.min(max, Math.max(min, value));
  return (
    <label className='studio-range-control flex flex-col gap-2'>
      <StudioRangeLabel
        className='text-sm'
        label={label}
        value={<output className='font-mono text-xs tabular-nums text-muted-foreground'>
          {formatValue?.(resolvedValue) ?? resolvedValue}
          {formatValue ? null : unit}
        </output>}
      />
      <StudioRange
        aria-label={ariaLabel}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        value={resolvedValue}
      />
    </label>
  );
}

function BackgroundScopeControl({
  hasOverride,
  onChange,
  onClearOverrides,
  onResetOverride,
  overrideCount,
  scope,
  selected,
  sourceCount,
}: {
  hasOverride: boolean;
  onChange: (scope: 'sequence' | 'frame') => void;
  onClearOverrides: () => void;
  onResetOverride: () => void;
  overrideCount: number;
  scope: 'sequence' | 'frame';
  selected: boolean;
  sourceCount: number;
}) {
  const gt = useGT();
  const effectiveScope = scope === 'frame' && selected ? 'frame' : 'sequence';
  return (
    <div className='animation-background-scope'>
      <div className='animation-background-scope-options' role='group' aria-label={gt('Background scope')}>
        <button
          aria-pressed={effectiveScope === 'sequence'}
          onClick={() => onChange('sequence')}
          type='button'
        >
          <strong><T>Sequence</T></strong>
          <small>{sourceCount} {sourceCount === 1 ? <T>frame</T> : <T>frames</T>}</small>
        </button>
        <button
          aria-pressed={effectiveScope === 'frame'}
          disabled={!selected}
          onClick={() => onChange('frame')}
          type='button'
        >
          <strong><T>Frame</T></strong>
          <small>{hasOverride ? <T>Custom</T> : <T>Selected only</T>}</small>
        </button>
      </div>
      <div className='animation-background-scope-description'>
        <p>
          {effectiveScope === 'sequence'
            ? <T>Changes update every frame that follows the sequence background.</T>
            : hasOverride
              ? <T>This frame has its own background.</T>
              : <T>Your next change creates an override for this frame.</T>}
        </p>
      </div>
      {effectiveScope === 'frame' && hasOverride ? (
        <Button className='w-full' onClick={onResetOverride} size='sm' type='button' variant='outline'>
          <T>Use sequence background</T>
        </Button>
      ) : null}
      {effectiveScope === 'sequence' && overrideCount > 0 ? (
        <Button className='w-full' onClick={onClearOverrides} size='sm' type='button' variant='ghost'>
          <T>Make all frames follow sequence</T> · {overrideCount}
        </Button>
      ) : null}
    </div>
  );
}

function animationBackgroundPreviewStyle(background: StudioFrameSettings['background'] | undefined): CSSProperties {
  if (!background) return {};
  if (background.style === 'solid') return { backgroundColor: background.colorA };
  if (background.style === 'shader') {
    return {
      backgroundColor: background.colorA,
      backgroundImage: `url("${shaderPreviewAssetPath(background.materialId)}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }
  return { backgroundImage: `linear-gradient(${background.angle}deg, ${background.colorA}, ${background.colorB})` };
}

function animationSourceLabel(source: StudioSource): string {
  return source.kind === 'text' ? source.text : source.name;
}

function AnimationSequenceSceneRow({
  controls,
  index,
  source,
}: {
  controls: StudioControlsProps;
  index: number;
  source: StudioSource;
}) {
  const gt = useGT();
  const {
    backgroundOverrideSourceIds,
    backgroundScope,
    onMoveSource,
    onRemoveSource,
    onResetBackgroundOverride,
    onSelectSource,
    onSelectSourceBackground,
    onSelectTransition,
    previewSources,
    selectedEffectTarget,
    selectedSource,
    selectedTransitionIndex,
    settings,
    sources,
    transitionSettings,
  } = controls;
  const hasBackgroundOverride = backgroundOverrideSourceIds.includes(source.id);
  const label = animationSourceLabel(source);
  const transition = transitionSettings[index];
  const transitionPreviewSettings = transition ? { ...settings, ...transition } : settings;
  const transitionLabel = animationPackagePresentation(transition?.packageId ?? settings.packageId).label;
  const backgroundSelected = selectedSource?.id === source.id
    && selectedTransitionIndex === null
    && selectedEffectTarget === 'background'
    && backgroundScope === 'frame';
  const contentSelected = selectedSource?.id === source.id && selectedEffectTarget === 'content';
  const showTransition = sources.length > 1 && (settings.loop || index < sources.length - 1);
  const sourceIcon = source.kind === 'text'
    ? <Type aria-hidden='true' />
    : <ImageIcon aria-hidden='true' />;
  return (
    <>
      <div
        className='animation-sequence-scene'
        data-background-selected={backgroundSelected ? 'true' : 'false'}
        data-content-selected={contentSelected ? 'true' : 'false'}
        role='listitem'
      >
        <div className='animation-sequence-layer'>
          <StudioPreviewTooltip
            preview={(
              <AnimationSequenceTooltipPreview count={sources.length} index={index} kind='frame'>
                <AnimationTimelinePreview index={index} kind='frame' layout='tooltip' settings={settings} sources={previewSources} />
              </AnimationSequenceTooltipPreview>
            )}
            size='compact'
            title={label}
          >
            <button aria-pressed={contentSelected} onClick={() => onSelectSource(source.id)} type='button'>
              <span className='animation-sequence-layer-icon'>{sourceIcon}</span>
              <span className='animation-sequence-layer-copy'>
                <strong>{label}</strong>
                <small>{String(index + 1).padStart(2, '0')} · {source.kind}</small>
              </span>
            </button>
          </StudioPreviewTooltip>
          <div className='animation-sequence-layer-actions'>
            <Button aria-label={gt('Move {name} up', { name: label })} disabled={index === 0} onClick={() => onMoveSource(source.id, -1)} size='icon-xs' type='button' variant='ghost'><ArrowUp aria-hidden='true' /></Button>
            <Button aria-label={gt('Move {name} down', { name: label })} disabled={index === sources.length - 1} onClick={() => onMoveSource(source.id, 1)} size='icon-xs' type='button' variant='ghost'><ArrowDown aria-hidden='true' /></Button>
            <Button aria-label={gt('Remove {name}', { name: label })} onClick={() => onRemoveSource(source.id)} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
          </div>
        </div>
        <div className='animation-scene-background' data-override={hasBackgroundOverride ? 'true' : 'false'}>
          <StudioPreviewTooltip
            preview={(
              <AnimationSequenceTooltipPreview count={sources.length} index={index} kind='background'>
                <span className='animation-sequence-tooltip-preview__background' style={animationBackgroundPreviewStyle(source.background)} />
              </AnimationSequenceTooltipPreview>
            )}
            size='compact'
            title={<><T>Background</T> · {label}</>}
          >
            <button aria-pressed={backgroundSelected} onClick={() => onSelectSourceBackground(source.id)} type='button'>
              <span className='animation-background-preview' style={animationBackgroundPreviewStyle(source.background)} />
              <span className='animation-scene-background-copy'>
                <strong><T>Background</T></strong>
                <small>{hasBackgroundOverride ? <T>Custom for this scene</T> : <T>Inherits base</T>}</small>
              </span>
            </button>
          </StudioPreviewTooltip>
          {hasBackgroundOverride ? (
            <Button aria-label={gt('Use base background for {name}', { name: label })} onClick={() => onResetBackgroundOverride(source.id)} size='icon-xs' title={gt('Use base background')} type='button' variant='ghost'>
              <RotateCcw aria-hidden='true' />
            </Button>
          ) : null}
        </div>
      </div>
      {showTransition ? (
        <div className='animation-sequence-listitem' role='listitem'>
          <StudioPreviewTooltip
            preview={(
              <AnimationSequenceTooltipPreview count={sources.length} index={index} kind='transition'>
                <AnimationTimelinePreview index={index} kind='transition' layout='tooltip' settings={transitionPreviewSettings} sources={previewSources} />
              </AnimationSequenceTooltipPreview>
            )}
            size='compact'
            title={transitionLabel}
          >
            <button
              aria-pressed={selectedTransitionIndex === index}
              className='animation-sequence-transition'
              onClick={() => onSelectTransition(index)}
              type='button'
            >
              <Film aria-hidden='true' />
              <span>
                <strong><T>Transition</T> {String(index + 1).padStart(2, '0')} · {transitionLabel}</strong>
              </span>
            </button>
          </StudioPreviewTooltip>
        </div>
      ) : null}
    </>
  );
}

function AnimationSequenceLayerControls({ controls }: { controls: StudioControlsProps }) {
  const gt = useGT();
  const {
    backgroundScope,
    backgroundOverrideSourceIds,
    brandLogoAvailable,
    includeBrandLogo,
    onAddText,
    onFiles,
    onIncludeBrandLogoChange,
    onSelectSequenceBackground,
    onSelectTransition,
    selectedEffectTarget,
    selectedSource,
    selectedTransitionIndex,
    sources,
  } = controls;
  const sequenceBackgroundSelected = selectedSource === null
    && selectedTransitionIndex === null
    && selectedEffectTarget === 'background'
    && backgroundScope === 'sequence';
  return (
    <>
      <div aria-label={gt('Add animation layer')} className='animation-layer-create' role='group'>
        <button onClick={onAddText} type='button'>
          <Type aria-hidden='true' />
          <span><T>Text</T></span>
        </button>
        <label>
          <ImagePlus aria-hidden='true' />
          <span><T>Image</T></span>
          <input
            accept='image/*'
            className='sr-only'
            multiple
            onChange={(event) => {
              if (event.target.files) onFiles(event.target.files);
              event.target.value = '';
            }}
            type='file'
          />
        </label>
        <button onClick={onSelectSequenceBackground} type='button'>
          <Palette aria-hidden='true' />
          <span><T>Base</T></span>
        </button>
        <button disabled={sources.length < 2} onClick={() => onSelectTransition(selectedTransitionIndex ?? 0)} type='button'>
          <Film aria-hidden='true' />
          <span><T>Transition</T></span>
        </button>
      </div>

      <label className='animation-sequence-logo-toggle'>
        <span><Layers3 aria-hidden='true' /><T>Brand mark</T></span>
        <StudioCheckbox
          checked={includeBrandLogo}
          disabled={!brandLogoAvailable}
          onChange={(event) => onIncludeBrandLogoChange(event.target.checked)}
        />
      </label>

      <div className='animation-sequence-stack-heading'>
        <span><T>Scene stack</T></span>
        <small>{sources.length} <T>scenes</T> · <T>in order</T></small>
      </div>

      <div aria-label={gt('Animation sequence layers')} className='animation-sequence-stack' role='list'>
        <div className='animation-sequence-base' role='listitem'>
          <StudioPreviewTooltip
            preview={(
              <AnimationSequenceTooltipPreview count={sources.length} index={0} kind='sequence-background'>
                <span className='animation-sequence-tooltip-preview__background' style={animationBackgroundPreviewStyle(controls.sequenceBackground)} />
              </AnimationSequenceTooltipPreview>
            )}
            size='compact'
            title={<T>Base background</T>}
          >
            <button
              aria-pressed={sequenceBackgroundSelected}
              className='animation-sequence-background'
              onClick={onSelectSequenceBackground}
              type='button'
            >
              <span className='animation-background-preview' style={animationBackgroundPreviewStyle(controls.sequenceBackground)} />
              <span><strong><T>Base background</T></strong><small><T>Behind every scene</T> · {backgroundOverrideSourceIds.length} <T>custom</T></small></span>
            </button>
          </StudioPreviewTooltip>
        </div>
        {sources.map((source, index) => (
          <AnimationSequenceSceneRow controls={controls} index={index} key={source.id} source={source} />
        ))}
      </div>
    </>
  );
}

type AnimationBackgroundControlsProps = {
  controls: StudioControlsProps;
  editableBackground: StudioFrameSettings['background'];
  frameMaterialSettings: typeof DEFAULT_LIVE_MATERIAL_SETTINGS;
  shaderGallerySettings: typeof DEFAULT_LIVE_MATERIAL_SETTINGS;
  showScope?: boolean;
};

function AnimationBackgroundControls({
  controls,
  editableBackground,
  frameMaterialSettings,
  shaderGallerySettings,
  showScope = true,
}: AnimationBackgroundControlsProps) {
  const gt = useGT();
  const {
    backgroundOverrideCount,
    backgroundScope,
    compact = false,
    hasSelectedBackgroundOverride,
    onBackgroundChange,
    onBackgroundScopeChange,
    onClearBackgroundOverrides,
    onLibraryBackgroundChange,
    onResetSelectedBackgroundOverride,
    selectedSource,
    settings,
    sources,
  } = controls;
  return (
    <>
      {showScope ? (
        <BackgroundScopeControl
          hasOverride={hasSelectedBackgroundOverride}
          onChange={onBackgroundScopeChange}
          onClearOverrides={onClearBackgroundOverrides}
          onResetOverride={onResetSelectedBackgroundOverride}
          overrideCount={backgroundOverrideCount}
          scope={backgroundScope}
          selected={Boolean(selectedSource)}
          sourceCount={sources.length}
        />
      ) : null}
      <div className='studio-field'>
        <span className='studio-field-label'><T>Background type</T></span>
        <StudioSelect
          ariaLabel={gt('Background type')}
          onValueChange={(style) => {
            const nextStyle = style as StudioFrameSettings['background']['style'];
            onBackgroundChange({
              ...(editableBackground.style === 'shader' && nextStyle !== 'shader'
                ? { colorA: settings.background, colorB: settings.backgroundSecondary }
                : {}),
              style: nextStyle,
            });
          }}
          options={[
            { label: gt('Solid color'), value: 'solid' },
            { label: gt('Gradient'), value: 'gradient' },
            { label: gt('Live shader'), value: 'shader' },
          ]}
          value={editableBackground.style}
        />
      </div>
      {editableBackground.style === 'shader' ? (
        <>
          <details className='animation-shader-controls'>
            <summary>
              <span><T>Shader framing</T></span>
              <small><T>Zoom and position</T></small>
            </summary>
            <div className='animation-shader-controls-body'>
              <div className='flex items-start justify-between gap-3'>
                <p className='mt-1 text-[10px] leading-4 text-muted-foreground'><T>Frame the background here. Motion and texture are below.</T></p>
                <Button
                  className='h-7 shrink-0 px-2 text-[10px]'
                  onClick={() => onBackgroundChange({
                    materialSettings: { ...frameMaterialSettings, centerX: 0.5, centerY: 0.5 },
                    patternScale: 1,
                  })}
                  size='sm'
                  type='button'
                  variant='ghost'
                >
                  <T>Reset</T>
                </Button>
              </div>
              <RangeControl ariaLabel={gt('Shader zoom')} formatValue={(sliderValue) => formatShaderZoom(shaderZoomFromSlider(sliderValue))} label={<T>Shader zoom</T>} max={SHADER_ZOOM_SLIDER_MAX} min={SHADER_ZOOM_SLIDER_MIN} onChange={(sliderValue) => onBackgroundChange({ patternScale: shaderZoomFromSlider(sliderValue) })} step={SHADER_ZOOM_SLIDER_STEP} value={shaderZoomToSlider(editableBackground.patternScale ?? 1)} />
              <RangeControl ariaLabel={gt('Horizontal shader position')} label={<T>Horizontal position</T>} max={100} min={0} onChange={(centerX) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, centerX: centerX / 100 } })} step={1} unit='%' value={frameMaterialSettings.centerX * 100} />
              <RangeControl ariaLabel={gt('Vertical shader position')} label={<T>Vertical position</T>} max={100} min={0} onChange={(centerY) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, centerY: centerY / 100 } })} step={1} unit='%' value={frameMaterialSettings.centerY * 100} />
              <details className='border-t border-border pt-2'>
                <summary className='cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'><T>Motion and texture</T></summary>
                <div className='mt-3 flex flex-col gap-3'>
                  <RangeControl ariaLabel={gt('Shader speed')} label={<T>Shader speed</T>} max={1.5} min={0} onChange={(speed) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, speed } })} step={0.01} unit='×' value={frameMaterialSettings.speed} />
                  <RangeControl ariaLabel={gt('Shader frequency')} label={<T>Frequency</T>} max={12} min={0.2} onChange={(frequency) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, frequency } })} step={0.1} value={frameMaterialSettings.frequency} />
                  <RangeControl ariaLabel={gt('Shader detail')} label={<T>Detail</T>} max={8} min={0.5} onChange={(detail) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, detail } })} step={0.1} value={frameMaterialSettings.detail} />
                  <RangeControl ariaLabel={gt('Shader intensity')} label={<T>Intensity</T>} max={1} min={0} onChange={(strength) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, strength } })} step={0.05} value={frameMaterialSettings.strength} />
                  <RangeControl ariaLabel={gt('Shader grain')} label={<T>Grain</T>} max={100} min={0} onChange={(grain) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, grain } })} step={1} unit='%' value={frameMaterialSettings.grain} />
                  <RangeControl ariaLabel={gt('Shader rotation')} label={<T>Rotation</T>} max={180} min={-180} onChange={(rotationZ) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, rotationZ } })} step={1} unit='°' value={frameMaterialSettings.rotationZ} />
                </div>
              </details>
            </div>
          </details>
          <ShaderLibraryBrowser
            activeMaterialId={editableBackground.materialId}
            compact
            excludeMaterialIds={compact ? COMPACT_SHADER_EXCLUSIONS : undefined}
            limit={30}
            onSelect={(materialId) => {
              const materialSettings = shaderLabSettingsFor(materialId, shaderGallerySettings);
              onLibraryBackgroundChange({
                colorA: materialSettings.colorA,
                colorB: materialSettings.colorB,
                colorC: materialSettings.colorC,
                materialId,
                materialSettings,
                style: 'shader',
              });
            }}
          />
        </>
      ) : (
        <>
          <ColorControl ariaLabel={gt('Background color A')} label={<T>Color A</T>} onChange={(colorA) => onBackgroundChange({ colorA })} value={editableBackground.colorA} />
          {editableBackground.style === 'gradient' ? (
            <>
              <ColorControl ariaLabel={gt('Background color B')} label={<T>Color B</T>} onChange={(colorB) => onBackgroundChange({ colorB })} value={editableBackground.colorB} />
              <RangeControl label={<T>Gradient angle</T>} max={360} min={0} onChange={(angle) => onBackgroundChange({ angle })} step={1} unit='°' value={editableBackground.angle} />
            </>
          ) : null}
        </>
      )}
    </>
  );
}

type SelectedFrameControlsProps = AnimationBackgroundControlsProps & {
  brandMaterialColors: readonly string[];
  materialIdentity: NonNullable<StudioControlsProps['identity']>;
  usesGenericMaterialColors: boolean;
};

function SelectedFrameControls({
  brandMaterialColors,
  controls,
  editableBackground,
  frameMaterialSettings,
  materialIdentity,
  usesGenericMaterialColors,
}: SelectedFrameControlsProps) {
  const gt = useGT();
  const {
    frameSettings,
    hasSelectedBackgroundOverride,
    onBackgroundChange,
    onFrameSettingsChange,
    onRemoveSource,
    onResetFrame,
    onResetSelectedBackgroundOverride,
    onTextSourceChange,
    selectedEffectTarget,
    selectedSource,
    settings,
    sources,
  } = controls;
  if (!frameSettings || !selectedSource) {
    return <p className='text-sm leading-5 text-muted-foreground'><T>Add or select a frame to edit it.</T></p>;
  }
  const selectedLabel = selectedSource.kind === 'text' ? selectedSource.text : selectedSource.name;
  const selectedIndex = Math.max(0, sources.findIndex(({ id }) => id === selectedSource.id));
  return (
    <>
      <div className='animation-selected-layer-preview'>
        <div
          aria-label={gt('Preview of {name}', { name: selectedLabel })}
          className='animation-selected-layer-preview__visual'
          role='img'
          style={{ aspectRatio: `${Math.max(120, settings.width)} / ${Math.max(120, settings.height)}` }}
        >
          <AnimationTimelinePreview authenticShader index={selectedIndex} kind='frame' layout='tooltip' settings={settings} sources={sources} />
          <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
        </div>
        <div className='animation-selected-layer-preview__footer'>
          <div className='min-w-0'>
            <small>{selectedEffectTarget === 'content' ? <T>Selected layer</T> : <T>Selected scene</T>}</small>
            <strong><T>Scene</T> {String(selectedIndex + 1).padStart(2, '0')} · {selectedSource.kind === 'text' ? <T>Text</T> : <T>Image</T>}</strong>
          </div>
          {selectedEffectTarget === 'content' ? (
            <div className='flex shrink-0 items-center gap-1'>
            <Button aria-label={gt('Reset selected frame')} onClick={onResetFrame} size='icon-sm' type='button' variant='outline'>
              <RotateCcw aria-hidden='true' />
            </Button>
            <Button aria-label={gt('Remove selected layer')} onClick={() => onRemoveSource(selectedSource.id)} size='icon-sm' type='button' variant='outline'>
              <Trash2 aria-hidden='true' />
            </Button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedEffectTarget === 'content' ? (
        <>
          {selectedSource.kind === 'text' ? (
            <label className='animation-layer-text-field'>
              <span><T>Text</T></span>
              <input
                aria-label={gt('Selected layer text')}
                onChange={(event) => onTextSourceChange(selectedSource.id, event.target.value)}
                spellCheck={false}
                type='text'
                value={selectedSource.text}
              />
            </label>
          ) : null}
          <RangeControl label={<T>Horizontal</T>} max={1} min={-1} onChange={(alignX) => onFrameSettingsChange({ alignX })} step={0.01} value={frameSettings.alignX} />
          <RangeControl label={<T>Vertical</T>} max={1} min={-1} onChange={(alignY) => onFrameSettingsChange({ alignY })} step={0.01} value={frameSettings.alignY} />
          <RangeControl label={<T>Scale</T>} max={2.5} min={0.1} onChange={(scale) => onFrameSettingsChange({ scale })} step={0.01} value={frameSettings.scale} />
          <RangeControl label={<T>Rotation</T>} max={180} min={-180} onChange={(rotation) => onFrameSettingsChange({ rotation })} step={1} unit='°' value={frameSettings.rotation} />
          <RangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(opacity) => onFrameSettingsChange({ opacity: opacity / 100 })} step={1} unit='%' value={Math.round(frameSettings.opacity * 100)} />
          {selectedSource.kind === 'text' ? (
            <>
              <RangeControl label={<T>Text size</T>} max={240} min={16} onChange={(fontSize) => onFrameSettingsChange({ fontSize })} step={1} unit='px' value={frameSettings.fontSize} />
              <RangeControl label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(fontWeight) => onFrameSettingsChange({ fontWeight })} step={50} value={frameSettings.fontWeight} />
              <ColorControl ariaLabel={gt('Frame foreground')} label={<T>Text color</T>} onChange={(foreground) => onFrameSettingsChange({ foreground })} value={frameSettings.foreground} />
            </>
          ) : (
            <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
              <T>Image fit</T>
              <StudioSelect ariaLabel={gt('Image fit')} onValueChange={(fit) => onFrameSettingsChange({ fit: fit as StudioFrameSettings['fit'] })} options={[{ label: gt('Contain'), value: 'contain' }, { label: gt('Cover'), value: 'cover' }]} value={frameSettings.fit} />
            </div>
          )}
          <div className='border-t border-border pt-4'>
            <div className='mb-3'>
              <p className='text-sm font-semibold'>{selectedSource.kind === 'text' ? <T>Text effects</T> : <T>Artwork effects</T>}</p>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Shadows, outlines, glass, and reflections render in preview and GIF export.</T></p>
            </div>
            <MaterialFinishControls onChange={(finish) => onFrameSettingsChange({ finish })} settings={frameSettings.finish} />
          </div>
        </>
      ) : (
        <>
          <div className='animation-layer-scope-note'>
            <Palette aria-hidden='true' />
            <span><strong><T>Scene background</T></strong><small>{hasSelectedBackgroundOverride ? <T>Custom for this scene</T> : <T>Inherits base background</T>}</small></span>
          </div>
          {hasSelectedBackgroundOverride ? (
            <Button className='w-full' onClick={onResetSelectedBackgroundOverride} size='sm' type='button' variant='outline'>
              <T>Use base background</T>
            </Button>
          ) : null}
          <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Background type</T>
            <StudioSelect
              ariaLabel={gt('Scene background')}
              onValueChange={(style) => {
                const nextStyle = style as StudioFrameSettings['background']['style'];
                if (nextStyle === 'shader' && usesGenericMaterialColors) {
                  onBackgroundChange({
                    colorA: brandMaterialColors[0],
                    colorB: brandMaterialColors[1],
                    colorC: brandMaterialColors[2],
                    materialSettings: { ...frameMaterialSettings, colorA: brandMaterialColors[0], colorB: brandMaterialColors[1], colorC: brandMaterialColors[2] },
                    style: nextStyle,
                  });
                  return;
                }
                onBackgroundChange({ style: nextStyle });
              }}
              options={[{ label: gt('Solid'), value: 'solid' }, { label: gt('Gradient'), value: 'gradient' }, { label: gt('Live shader'), value: 'shader' }]}
              value={editableBackground.style}
            />
          </div>
          {editableBackground.style === 'shader' ? (
            <LiveMaterialControls
              identity={materialIdentity}
              materialId={editableBackground.materialId}
              onMaterialIdChange={(materialId) => onBackgroundChange({ materialId })}
              onSettingsChange={(materialSettings) => onBackgroundChange({ colorA: materialSettings.colorA, colorB: materialSettings.colorB, colorC: materialSettings.colorC, materialSettings })}
              settings={frameMaterialSettings}
            />
          ) : (
            <>
              <ColorControl ariaLabel={gt('Background color A')} label={<T>Color A</T>} onChange={(colorA) => onBackgroundChange({ colorA })} value={editableBackground.colorA} />
              {editableBackground.style === 'solid' ? null : (
                <ColorControl ariaLabel={gt('Background color B')} label={<T>Color B</T>} onChange={(colorB) => onBackgroundChange({ colorB })} value={editableBackground.colorB} />
              )}
            </>
          )}
          {editableBackground.style === 'gradient' ? (
            <RangeControl label={<T>Angle</T>} max={360} min={0} onChange={(angle) => onBackgroundChange({ angle })} step={1} unit='°' value={editableBackground.angle} />
          ) : null}
          <div className='border-t border-border pt-4'>
            <div className='mb-3'>
              <p className='text-sm font-semibold'><T>Background effects</T></p>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Add edge light, glass, reflection, or depth to the scene background.</T></p>
            </div>
            <MaterialFinishControls onChange={(finish) => onBackgroundChange({ finish })} settings={normalizeMaterialFinish(editableBackground.finish)} />
          </div>
        </>
      )}
    </>
  );
}

function resolveAnimationSidebarLayout(
  panel: StudioControlsProps['panel'],
  compact: boolean,
  identityId: string | undefined
) {
  const sourcePanel = panel === 'source';
  const width = sourcePanel ? (compact ? 280 : 344) : (compact ? 240 : 292);
  const maximumWidth = sourcePanel ? (compact ? 360 : 440) : (compact ? 320 : 380);
  const minimumWidth = sourcePanel ? (compact ? 220 : 280) : (compact ? 200 : 248);
  return {
    className: `studio-inspector ${sourcePanel ? '' : 'studio-inspector-right'}`,
    defaultWidth: width,
    density: compact ? 'standard' as const : 'compact' as const,
    kind: sourcePanel ? 'library' as const : 'inspector' as const,
    label: sourcePanel ? 'Sequence layers' : 'Layer inspector',
    maxWidth: maximumWidth,
    minWidth: minimumWidth,
    side: sourcePanel ? 'left' as const : 'right' as const,
    storageKey: `animation-${compact ? 'compact-' : ''}${panel}-v5-${identityId ?? 'default'}`,
  };
}

function AnimationPanelHeading({
  controls,
}: {
  controls: StudioControlsProps;
}) {
  const {
    backgroundScope,
    panel,
    selectedEffectTarget,
    selectedSource,
    selectedTransitionIndex,
  } = controls;
  if (panel === 'source') {
    return (
      <LabPanelHeading
        description={<T>Arrange scenes, their backgrounds, and the cuts between them.</T>}
        title={<T>Sequence layers</T>}
      />
    );
  }
  if (selectedTransitionIndex !== null) {
    return (
      <LabPanelHeading
        description={<T>Control content motion and background blend for this cut.</T>}
        title={<><T>Transition</T> {String(selectedTransitionIndex + 1).padStart(2, '0')}</>}
      />
    );
  }
  if (!selectedSource && selectedEffectTarget === 'background' && backgroundScope === 'sequence') {
    return (
      <LabPanelHeading
        description={<T>Style the layer behind every scene. Scene backgrounds can override it.</T>}
        title={<T>Base background</T>}
      />
    );
  }
  if (selectedSource && selectedEffectTarget === 'background' && backgroundScope === 'frame') {
    const sourceName = selectedSource.kind === 'text' ? selectedSource.text : selectedSource.name;
    return (
      <LabPanelHeading
        description={<T>Edit this scene's background or return it to the base layer.</T>}
        title={<><T>Background</T> · {sourceName}</>}
      />
    );
  }
  const title = selectedSource?.kind === 'text'
    ? selectedSource.text
    : selectedSource?.name ?? <T>Layer inspector</T>;
  return (
    <LabPanelHeading
      description={selectedSource
        ? <T>Edit only the selected content layer.</T>
        : <T>Select a content, transition, or background row to edit it.</T>}
      title={title}
    />
  );
}

function AnimationTransitionControls({ controls }: { controls: StudioControlsProps }) {
  const gt = useGT();
  const {
    compact = false,
    hasImageSources,
    hasSelectedTransitionOverride,
    onResetSelectedTransition,
    onSelectedTransitionSettingsChange,
    selectedTransitionIndex,
    selectedTransitionSettings,
    settings,
    sources,
  } = controls;
  const source = selectedTransitionIndex === null ? null : sources[selectedTransitionIndex];
  const nextSource = selectedTransitionIndex === null ? null : sources[(selectedTransitionIndex + 1) % sources.length];
  const sourceName = source ? (source.kind === 'text' ? source.text : source.name) : '';
  const nextName = nextSource ? (nextSource.kind === 'text' ? nextSource.text : nextSource.name) : '';
  return (
    <>
      <div className='animation-transition-selection'>
        <Film aria-hidden='true' />
        <span><strong>{sourceName} → {nextName}</strong><small>{hasSelectedTransitionOverride ? <T>Custom cut</T> : <T>Uses sequence default</T>}</small></span>
      </div>
      <div className='animation-transition-channel-heading' data-channel='background'>
        <span aria-hidden='true' />
        <strong><T>Background blend</T></strong>
        <small><T>How these scene backgrounds exchange</T></small>
      </div>
      <StudioSelect
        ariaLabel={gt('Background blend')}
        onValueChange={(backgroundTransition) => onSelectedTransitionSettingsChange({
          backgroundTransition: backgroundTransition as StudioSettings['backgroundTransition'],
        })}
        options={[
          { label: gt('Crossfade'), value: 'crossfade' },
          { label: gt('Directional wipe'), value: 'wipe' },
          { label: gt('Radial reveal'), value: 'radial' },
        ]}
        value={selectedTransitionSettings.backgroundTransition ?? settings.backgroundTransition}
      />
      <div className='animation-transition-channel-heading'>
        <span aria-hidden='true' />
        <strong><T>Content motion</T></strong>
        <small><T>How the visible layers exchange</T></small>
      </div>
      <AnimationPackageGallery
        animatePreviews={false}
        compact={compact}
        hasImageSources={hasImageSources}
        layout='sidebar'
        onSelect={(packageId) => onSelectedTransitionSettingsChange({ packageId })}
        selectedId={selectedTransitionSettings.packageId}
        settings={{ ...settings, ...selectedTransitionSettings }}
      />
      <div className='studio-choice-grid studio-choice-grid-easing'>
        {Object.entries(EASING_PRESETS).map(([name, bezier]) => (
          <Button
            className='capitalize'
            key={name}
            onClick={() => onSelectedTransitionSettingsChange({ bezier })}
            size='sm'
            type='button'
            variant={selectedTransitionSettings.bezier.length === bezier.length && selectedTransitionSettings.bezier.every((value, index) => value === bezier[index]) ? 'default' : 'outline'}
          >
            {name}
          </Button>
        ))}
      </div>
      <BezierEditor compact={compact} curve={selectedTransitionSettings.bezier} onChange={(bezier) => onSelectedTransitionSettingsChange({ bezier })} />
      {hasSelectedTransitionOverride ? (
        <Button className='w-full' onClick={onResetSelectedTransition} size='sm' type='button' variant='outline'>
          <RotateCcw aria-hidden='true' />
          <T>Use sequence transition</T>
        </Button>
      ) : null}
    </>
  );
}

function AnimationGlobalControls({ controls }: { controls: StudioControlsProps }) {
  const gt = useGT();
  const { compact = false, hasImageSources, onSettingsChange, settings } = controls;
  return (
    <>
      <InspectorSection index='02' title={<T>Sequence defaults</T>}>
        <RangeControl label={<T>Frame duration</T>} max={3000} min={100} onChange={(holdMs) => onSettingsChange({ holdMs })} step={10} unit='ms' value={settings.holdMs} />
        <div className='studio-choice-grid studio-choice-grid-timing'>
          {[750, 1000, 1250, 1500, 1750].map((holdMs) => (
            <Button className={`font-mono ${compact ? 'h-7' : ''}`} key={holdMs} onClick={() => onSettingsChange({ holdMs })} size='sm' type='button' variant={settings.holdMs === holdMs ? 'default' : 'outline'}>
              {(holdMs / 1000).toFixed(holdMs % 1000 === 0 ? 1 : 2)}s
            </Button>
          ))}
        </div>
        <div className='studio-field'>
          <span className='studio-field-label'><T>Default transition</T></span>
          <StudioSelect
            ariaLabel={gt('Default transition')}
            onValueChange={(packageId) => onSettingsChange({ packageId: packageId as StudioSettings['packageId'] })}
            options={ANIMATION_PACKAGES
              .filter((option) => !option.textOnly || !hasImageSources)
              .map((option) => ({ label: option.label, value: option.id }))}
            value={settings.packageId}
          />
        </div>
        <div className='studio-field'>
          <span className='studio-field-label'><T>Default background blend</T></span>
          <StudioSelect
            ariaLabel={gt('Default background blend')}
            onValueChange={(backgroundTransition) => onSettingsChange({
              backgroundTransition: backgroundTransition as StudioSettings['backgroundTransition'],
            })}
            options={[
              { label: gt('Crossfade'), value: 'crossfade' },
              { label: gt('Directional wipe'), value: 'wipe' },
              { label: gt('Radial reveal'), value: 'radial' },
            ]}
            value={settings.backgroundTransition}
          />
        </div>
        <RangeControl label={<T>Transition duration</T>} max={1200} min={40} onChange={(transitionMs) => onSettingsChange({ transitionMs })} step={10} unit='ms' value={settings.transitionMs} />
        <RangeControl label={<T>Horizontal anchor</T>} max={1} min={-1} onChange={(alignX) => onSettingsChange({ alignX })} step={0.01} value={settings.alignX} />
        <RangeControl label={<T>Vertical anchor</T>} max={1} min={-1} onChange={(alignY) => onSettingsChange({ alignY })} step={0.01} value={settings.alignY} />
        <RangeControl label={<T>Scale</T>} max={1.5} min={0.2} onChange={(scale) => onSettingsChange({ scale })} step={0.01} value={settings.scale} />
        <RangeControl label={<T>Morph blur</T>} max={32} min={0} onChange={(blur) => onSettingsChange({ blur })} step={1} unit='px' value={settings.blur} />
        <RangeControl label={<T>Text size</T>} max={240} min={16} onChange={(fontSize) => onSettingsChange({ fontSize })} step={1} unit='px' value={settings.fontSize} />
        <ColorControl ariaLabel={gt('Default foreground')} label={<T>Default foreground</T>} onChange={(foreground) => onSettingsChange({ foreground })} value={settings.foreground} />
      </InspectorSection>
      <InspectorSection index='03' title={<T>Output</T>}>
        <div className='studio-field-grid'>
          <div className='studio-field'>
            <span className='studio-field-label'><T>Frame rate</T></span>
            <StudioSelect ariaLabel={gt('Frame rate')} className='font-mono' onValueChange={(value) => onSettingsChange({ fps: Number(value) })} options={[10, 15, 20, 24, 30].map((fps) => ({ label: `${fps} fps`, value: String(fps) }))} value={String(settings.fps)} />
          </div>
          <div className='studio-field'>
            <span className='studio-field-label'><T>Palette</T></span>
            <StudioSelect ariaLabel={gt('Palette')} className='font-mono' onValueChange={(value) => onSettingsChange({ colors: Number(value) as StudioSettings['colors'] })} options={[32, 64, 128, 256].map((colors) => ({ label: String(colors), value: String(colors) }))} value={String(settings.colors)} />
          </div>
        </div>
        <label className='studio-toggle-row'>
          <span><T>Loop forever</T></span>
          <StudioCheckbox checked={settings.loop} onChange={(event) => onSettingsChange({ loop: event.target.checked })} />
        </label>
      </InspectorSection>
    </>
  );
}

function shouldShowAnimationPanelHeading(
  panel: StudioControlsProps['panel'],
  selectedSource: StudioSource | null,
  selectedEffectTarget: StudioControlsProps['selectedEffectTarget'],
  selectedTransitionIndex: number | null
): boolean {
  return panel === 'source'
    || selectedTransitionIndex !== null
    || selectedEffectTarget === 'background'
    || selectedSource === null;
}

export default function StudioControls({
  backgroundOverrideCount,
  backgroundOverrideSourceIds,
  backgroundScope,
  brandLogoAvailable,
  compact = false,
  frameSettings,
  hasSelectedBackgroundOverride,
  hasImageSources,
  hasSelectedTransitionOverride,
  includeBrandLogo,
  onAddText,
  onBackgroundChange,
  onBackgroundScopeChange,
  onClearBackgroundOverrides,
  onLibraryBackgroundChange,
  onFiles,
  onFrameSettingsChange,
  onIncludeBrandLogoChange,
  onMoveSource,
  onRemoveSource,
  onResetBackgroundOverride,
  onResetFrame,
  onResetSelectedBackgroundOverride,
  onResetSelectedTransition,
  onSelectedTransitionSettingsChange,
  onSelectSequenceBackground,
  onSelectSource,
  onSelectSourceBackground,
  onSelectTransition,
  onSettingsChange,
  onTextSourceChange,
  identity,
  panel,
  previewSources,
  selectedSource,
  selectedEffectTarget,
  selectedTransitionIndex,
  selectedTransitionSettings,
  sequenceBackground,
  settings,
  sources,
  transitionSettings,
}: StudioControlsProps) {
  const gt = useGT();
  const effectiveBackgroundScope = backgroundScope === 'frame' && selectedSource
    ? 'frame'
    : 'sequence';
  const editableBackground = effectiveBackgroundScope === 'frame' && frameSettings
    ? frameSettings.background
    : sequenceBackground;
  const frameMaterialSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...editableBackground.materialSettings,
  };
  const materialIdentity = identity ?? {
    colors: [
      { hex: settings.background, id: 'ink', name: 'Background', role: 'Primary background' },
      { hex: settings.backgroundSecondary, id: 'emphasis', name: 'Secondary', role: 'Secondary background' },
      { hex: settings.foreground, id: 'paper', name: 'Foreground', role: 'Primary foreground' },
    ],
    id: 'animation',
    name: 'Animation',
    shortName: 'AN',
  };
  const brandMaterialColors = brandMaterialPalette(materialIdentity).colors;
  const usesGenericMaterialColors =
    frameMaterialSettings.colorA === DEFAULT_LIVE_MATERIAL_SETTINGS.colorA &&
    frameMaterialSettings.colorB === DEFAULT_LIVE_MATERIAL_SETTINGS.colorB &&
    frameMaterialSettings.colorC === DEFAULT_LIVE_MATERIAL_SETTINGS.colorC;
  const shaderGallerySettings = usesGenericMaterialColors
    ? {
        ...frameMaterialSettings,
        colorA: brandMaterialColors[0],
        colorB: brandMaterialColors[1],
        colorC: brandMaterialColors[2],
      }
    : frameMaterialSettings;
  const sidebarLayout = resolveAnimationSidebarLayout(panel, compact, identity?.id);
  const childControls: StudioControlsProps = {
    backgroundOverrideCount,
    backgroundOverrideSourceIds,
    backgroundScope,
    brandLogoAvailable,
    compact,
    frameSettings,
    hasSelectedBackgroundOverride,
    hasImageSources,
    hasSelectedTransitionOverride,
    identity,
    includeBrandLogo,
    onAddText,
    onBackgroundChange,
    onBackgroundScopeChange,
    onClearBackgroundOverrides,
    onFiles,
    onFrameSettingsChange,
    onIncludeBrandLogoChange,
    onLibraryBackgroundChange,
    onMoveSource,
    onRemoveSource,
    onResetBackgroundOverride,
    onResetFrame,
    onResetSelectedBackgroundOverride,
    onResetSelectedTransition,
    onSelectedTransitionSettingsChange,
    onSelectSequenceBackground,
    onSelectSource,
    onSelectSourceBackground,
    onSelectTransition,
    onSettingsChange,
    onTextSourceChange,
    panel,
    previewSources,
    selectedEffectTarget,
    selectedSource,
    selectedTransitionIndex,
    selectedTransitionSettings,
    sequenceBackground,
    settings,
    sources,
    transitionSettings,
  };
  const sequenceBackgroundSelected = selectedSource === null
    && selectedTransitionIndex === null
    && selectedEffectTarget === 'background'
    && backgroundScope === 'sequence';
  const selectedSourceNumber = selectedSource
    ? Math.max(0, sources.findIndex(({ id }) => id === selectedSource.id)) + 1
    : 1;
  const showPanelHeading = shouldShowAnimationPanelHeading(
    panel,
    selectedSource,
    selectedEffectTarget,
    selectedTransitionIndex
  );

  return (
    <StudioSidebar
      {...sidebarLayout}
      label={gt(sidebarLayout.label)}
    >
      {showPanelHeading ? <AnimationPanelHeading controls={childControls} /> : null}
      {panel === 'source' ? (
        <>
          <InspectorSection index='01' title={<T>Scenes and layers</T>}>
            <AnimationSequenceLayerControls controls={childControls} />
          </InspectorSection>
          <AnimationGlobalControls controls={childControls} />
        </>
      ) : (
        selectedTransitionIndex !== null ? (
          <InspectorSection index='01' title={<T>Selected transition</T>}>
            <AnimationTransitionControls controls={childControls} />
          </InspectorSection>
        ) : selectedSource ? (
          <InspectorSection
            index={String(selectedSourceNumber).padStart(2, '0')}
            title={selectedEffectTarget === 'background' ? <T>Selected background</T> : animationSourceLabel(selectedSource)}
          >
            <SelectedFrameControls
              brandMaterialColors={brandMaterialColors}
              controls={childControls}
              editableBackground={editableBackground}
              frameMaterialSettings={frameMaterialSettings}
              materialIdentity={materialIdentity}
              shaderGallerySettings={shaderGallerySettings}
              usesGenericMaterialColors={usesGenericMaterialColors}
            />
          </InspectorSection>
        ) : sequenceBackgroundSelected ? (
          <InspectorSection index='01' title={<T>Selected background</T>}>
            <AnimationBackgroundControls
              controls={childControls}
              editableBackground={sequenceBackground}
              frameMaterialSettings={frameMaterialSettings}
              shaderGallerySettings={shaderGallerySettings}
              showScope={false}
            />
          </InspectorSection>
        ) : (
          <InspectorSection index='01' title={<T>Nothing selected</T>}>
            <p className='text-sm leading-5 text-muted-foreground'><T>Select a content, transition, or background row in the left sidebar.</T></p>
          </InspectorSection>
        )
      )}
    </StudioSidebar>
  );
}
