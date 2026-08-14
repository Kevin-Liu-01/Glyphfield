'use client';

import type { ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  ImagePlus,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react';

import AnimationPackageGallery from '@/components/AnimationPackageGallery';
import BezierEditor from '@/components/BezierEditor';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import MaterialFinishControls from '@/components/MaterialFinishControls';
import { ShaderLibraryBrowser } from '@/components/ShaderLibrarySidebar';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  brandMaterialPalette,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
} from '@/lib/liveMaterials';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioSource } from '@/lib/renderFrame';
import { shaderLabSettingsFor } from '@/lib/shaderLab';
import {
  EASING_PRESETS,
  type ImportedImage,
  type SourceMode,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
} from '@/lib/studio';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import { normalizeMaterialFinish } from '@/lib/materialFinish';

type StudioControlsProps = {
  backgroundOverrideCount: number;
  backgroundScope: 'sequence' | 'frame';
  brandLogoAvailable: boolean;
  compact?: boolean;
  frameSettings: StudioFrameSettings | null;
  hasSelectedBackgroundOverride: boolean;
  hasImageSources: boolean;
  images: readonly ImportedImage[];
  includeBrandLogo: boolean;
  mode: SourceMode;
  onBackgroundChange: (patch: Partial<StudioFrameSettings['background']>) => void;
  onBackgroundScopeChange: (scope: 'sequence' | 'frame') => void;
  onClearBackgroundOverrides: () => void;
  onLibraryBackgroundChange: (patch: Partial<StudioFrameSettings['background']>) => void;
  onFiles: (files: FileList) => void;
  onFrameSettingsChange: (patch: Partial<StudioFrameSettings>) => void;
  onIncludeBrandLogoChange: (include: boolean) => void;
  onModeChange: (mode: SourceMode) => void;
  onMoveSource: (id: string, direction: -1 | 1) => void;
  onRemoveImage: (id: string) => void;
  onResetFrame: () => void;
  onResetSelectedBackgroundOverride: () => void;
  onSelectedEffectTargetChange: (target: 'background' | 'content') => void;
  onSelectSource: (id: string) => void;
  onSettingsChange: (patch: Partial<StudioSettings>) => void;
  onTextFramesChange: (value: string) => void;
  identity?: Pick<BrandIdentity, 'colors' | 'id' | 'name' | 'shortName'>;
  panel: 'properties' | 'source';
  selectedSource: StudioSource | null;
  selectedEffectTarget: 'background' | 'content';
  sequenceBackground: StudioBackgroundSettings;
  settings: StudioSettings;
  sources: readonly StudioSource[];
  textFrames: string;
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
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  ariaLabel?: string;
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const resolvedValue = Math.min(value, max);
  return (
    <label className='studio-range-control flex flex-col gap-2'>
      <StudioRangeLabel
        className='text-sm'
        label={label}
        value={<output className='font-mono text-xs tabular-nums text-muted-foreground'>
          {resolvedValue}
          {unit}
        </output>}
      />
      <input
        aria-label={ariaLabel}
        className='studio-range'
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type='range'
        value={resolvedValue}
      />
    </label>
  );
}

function BackgroundScopeControl({
  compact = false,
  hasOverride,
  onChange,
  onClearOverrides,
  onResetOverride,
  overrideCount,
  scope,
  selected,
  sourceCount,
}: {
  compact?: boolean;
  hasOverride: boolean;
  onChange: (scope: 'sequence' | 'frame') => void;
  onClearOverrides: () => void;
  onResetOverride: () => void;
  overrideCount: number;
  scope: 'sequence' | 'frame';
  selected: boolean;
  sourceCount: number;
}) {
  const effectiveScope = scope === 'frame' && selected ? 'frame' : 'sequence';
  return (
    <div className='flex flex-col gap-2'>
      <div className='grid grid-cols-2'>
        <Button
          className={`min-w-0 rounded-r-none ${compact ? 'h-7 px-1 text-[9px]' : ''}`}
          onClick={() => onChange('sequence')}
          size='sm'
          type='button'
          variant={effectiveScope === 'sequence' ? 'default' : 'outline'}
        >
          <T>{compact ? 'Sequence' : 'Entire sequence'}</T>
        </Button>
        <Button
          className={`min-w-0 rounded-l-none border-l-0 ${compact ? 'h-7 px-1 text-[9px]' : ''}`}
          disabled={!selected}
          onClick={() => onChange('frame')}
          size='sm'
          type='button'
          variant={effectiveScope === 'frame' ? 'default' : 'outline'}
        >
          <T>{compact ? 'Frame' : 'This frame only'}</T>
        </Button>
      </div>
      <div className='flex items-start justify-between gap-3 text-[10px] leading-4 text-muted-foreground'>
        <p>
          {effectiveScope === 'sequence'
            ? <T>Changes update every frame that follows the sequence background.</T>
            : hasOverride
              ? <T>This frame has its own background.</T>
              : <T>Your next change creates an override for this frame.</T>}
        </p>
        <span className='shrink-0 font-mono uppercase'>
          {effectiveScope === 'sequence' ? `${sourceCount} frames` : 'override'}
        </span>
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

export default function StudioControls({
  backgroundOverrideCount,
  backgroundScope,
  brandLogoAvailable,
  compact = false,
  frameSettings,
  hasSelectedBackgroundOverride,
  hasImageSources,
  images,
  includeBrandLogo,
  mode,
  onBackgroundChange,
  onBackgroundScopeChange,
  onClearBackgroundOverrides,
  onLibraryBackgroundChange,
  onFiles,
  onFrameSettingsChange,
  onIncludeBrandLogoChange,
  onModeChange,
  onMoveSource,
  onRemoveImage,
  onResetFrame,
  onResetSelectedBackgroundOverride,
  onSelectedEffectTargetChange,
  onSelectSource,
  onSettingsChange,
  onTextFramesChange,
  identity,
  panel,
  selectedSource,
  selectedEffectTarget,
  sequenceBackground,
  settings,
  sources,
  textFrames,
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

  return (
    <StudioSidebar
      className={`studio-inspector ${panel === 'properties' ? 'studio-inspector-right' : ''}`}
      defaultWidth={compact ? (panel === 'source' ? 280 : 240) : undefined}
      density={compact ? 'standard' : 'compact'}
      kind={panel === 'source' ? 'library' : 'inspector'}
      label={panel === 'source' ? gt('Animation sources') : gt('Animation properties')}
      maxWidth={compact ? (panel === 'source' ? 360 : 320) : undefined}
      minWidth={compact ? (panel === 'source' ? 220 : 200) : undefined}
      side={panel === 'properties' ? 'right' : 'left'}
      storageKey={`animation-${compact ? 'compact-' : ''}${panel}-v3-${identity?.id ?? 'default'}`}
    >
      <LabPanelHeading
        description={panel === 'source'
          ? <T>Build the sequence from text, images, and brand assets.</T>
          : <T>Tune the selected frame, timing, material, and composition.</T>}
        title={panel === 'source' ? <T>Animation sources</T> : selectedSource?.kind === 'text' ? selectedSource.text : selectedSource?.name ?? <T>Sequence properties</T>}
      />
      {panel === 'source' ? (
        <>
        <InspectorSection index='01' title={<T>Source</T>}>
        <div className='grid grid-cols-3'>
          {([
            ['sequence', gt('Sequence')],
            ['text', gt('Text')],
            ['images', gt('Images')],
          ] as const).map(([value, label]) => (
            <Button
              className={`min-w-0 rounded-none border-r-0 last:border-r ${compact ? 'h-7 px-1 text-[9px]' : ''}`}
              key={value}
              onClick={() => onModeChange(value)}
              type='button'
              variant={mode === value ? 'default' : 'outline'}
            >
              {label}
            </Button>
          ))}
        </div>

        {mode === 'sequence' ? (
          <div className='flex flex-col gap-3'>
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'>
              <span><T>Start with brand logo</T></span>
              <input
                checked={includeBrandLogo}
                disabled={!brandLogoAvailable}
                onChange={(event) => onIncludeBrandLogoChange(event.target.checked)}
                type='checkbox'
              />
            </label>
            <div className='flex flex-col gap-2'>
              {sources.map((source, index) => {
                const label = source.kind === 'text' ? source.text : source.name;
                return (
                  <div
                    className={`grid items-center overflow-hidden rounded-md border ${compact ? 'grid-cols-[minmax(0,1fr)_24px_24px]' : 'grid-cols-[1fr_28px_28px]'} ${
                      selectedSource?.id === source.id
                        ? 'border-foreground bg-muted'
                        : 'border-border'
                    }`}
                    key={source.id}
                  >
                    <button
                      className={`flex min-w-0 items-center text-left ${compact ? 'gap-1 px-2 py-1.5' : 'gap-2 px-3 py-2'}`}
                      onClick={() => onSelectSource(source.id)}
                      type='button'
                    >
                      {source.kind === 'text' ? (
                        <Type aria-hidden='true' className='size-3.5 shrink-0' />
                      ) : (
                        <ImageIcon aria-hidden='true' className='size-3.5 shrink-0' />
                      )}
                      <span className={`min-w-0 flex-1 truncate ${compact ? 'text-[10px]' : 'text-sm'}`}>{label}</span>
                      {compact ? null : (
                        <span className='font-mono text-[9px] text-muted-foreground'>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      )}
                    </button>
                    <Button
                      aria-label={gt('Move {name} up', { name: label })}
                      disabled={index === 0}
                      onClick={() => onMoveSource(source.id, -1)}
                      className={compact ? 'size-6' : ''}
                      size='icon-xs'
                      type='button'
                      variant='ghost'
                    >
                      <ArrowUp aria-hidden='true' />
                    </Button>
                    <Button
                      aria-label={gt('Move {name} down', { name: label })}
                      disabled={index === sources.length - 1}
                      onClick={() => onMoveSource(source.id, 1)}
                      className={compact ? 'size-6' : ''}
                      size='icon-xs'
                      type='button'
                      variant='ghost'
                    >
                      <ArrowDown aria-hidden='true' />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === 'text' ? (
          <label className='flex flex-col gap-2'>
            <span className='text-xs uppercase tracking-widest text-muted-foreground'>
              <T>One state per line</T>
            </span>
            <textarea
              className='min-h-44 resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-6 outline-none focus:border-foreground'
              onChange={(event) => onTextFramesChange(event.target.value)}
              placeholder={gt('Welcome\nBienvenidos\n你好')}
              spellCheck={false}
              value={textFrames}
            />
          </label>
        ) : null}

        {mode === 'images' ? (
          <div className='flex flex-col gap-3'>
            <label className='flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-4 py-6 text-sm font-medium hover:bg-muted'>
              <ImagePlus className='size-4' aria-hidden='true' />
              <T>Import images</T>
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
            <div className='flex flex-col gap-2'>
              {images.length === 0 ? (
                <p className='text-sm leading-5 text-muted-foreground'>
                  <T>PNG, JPEG, WebP, SVG, and GIF files stay in your browser.</T>
                </p>
              ) : null}
              {images.map((image) => (
                <div
                  className='grid grid-cols-[40px_1fr_32px] items-center gap-3 rounded-md border border-border p-2'
                  key={image.id}
                >
                  <img alt='' className='size-10 bg-muted object-contain' src={image.url} />
                  <span className='truncate font-mono text-xs'>{image.name}</span>
                  <Button
                    aria-label={gt('Remove {name}', { name: image.name })}
                    onClick={() => onRemoveImage(image.id)}
                    size='icon-sm'
                    type='button'
                    variant='ghost'
                  >
                    <Trash2 aria-hidden='true' />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        </InspectorSection>
        <InspectorSection index='02' title={<T>Animation packages</T>}>
          <p className='text-xs leading-5 text-muted-foreground'>
            <T>Choose by motion. Previews pause automatically when they leave the panel.</T>
          </p>
          <AnimationPackageGallery
            animatePreviews={!compact}
            compact={compact}
            hasImageSources={hasImageSources}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selectedId={settings.packageId}
            settings={settings}
          />
        </InspectorSection>
        <InspectorSection index='03' title={<T>Background shaders</T>}>
          <BackgroundScopeControl
            compact={compact}
            hasOverride={hasSelectedBackgroundOverride}
            onChange={onBackgroundScopeChange}
            onClearOverrides={onClearBackgroundOverrides}
            onResetOverride={onResetSelectedBackgroundOverride}
            overrideCount={backgroundOverrideCount}
            scope={backgroundScope}
            selected={Boolean(selectedSource)}
            sourceCount={sources.length}
          />
          {editableBackground.style === 'shader' ? (
            <details className='animation-shader-controls sticky top-0 z-20 bg-background/95 p-3 smooth-shadow-ring-md backdrop-blur' open>
              <summary className='cursor-pointer select-none text-xs font-semibold'>
                <T>Shader controls</T>
              </summary>
              <div className='mt-3 flex flex-col gap-3'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                  <p className='mt-1 text-[10px] leading-4 text-muted-foreground'>
                    <T>Frame the background here. Motion and texture are below.</T>
                  </p>
                  </div>
                  <Button
                    className='h-7 shrink-0 px-2 text-[10px]'
                    onClick={() => onBackgroundChange({
                      materialSettings: {
                        ...frameMaterialSettings,
                        centerX: 0.5,
                        centerY: 0.5,
                      },
                      patternScale: 1,
                    })}
                    size='sm'
                    type='button'
                    variant='ghost'
                  >
                    <T>Reset</T>
                  </Button>
                </div>
              <RangeControl
                ariaLabel={gt('Shader size')}
                label={<T>Shader size</T>}
                max={3}
                min={0.25}
                onChange={(patternScale) => onBackgroundChange({ patternScale })}
                step={0.05}
                unit='×'
                value={editableBackground.patternScale ?? 1}
              />
              <RangeControl
                ariaLabel={gt('Horizontal shader position')}
                label={<T>Horizontal position</T>}
                max={100}
                min={0}
                onChange={(centerX) => onBackgroundChange({
                  materialSettings: { ...frameMaterialSettings, centerX: centerX / 100 },
                })}
                step={1}
                unit='%'
                value={frameMaterialSettings.centerX * 100}
              />
              <RangeControl
                ariaLabel={gt('Vertical shader position')}
                label={<T>Vertical position</T>}
                max={100}
                min={0}
                onChange={(centerY) => onBackgroundChange({
                  materialSettings: { ...frameMaterialSettings, centerY: centerY / 100 },
                })}
                step={1}
                unit='%'
                value={frameMaterialSettings.centerY * 100}
              />
                <details className='border-t border-border pt-2'>
                  <summary className='cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                    <T>Motion and texture</T>
                  </summary>
                  <div className='mt-3 flex flex-col gap-3'>
                  <RangeControl
                    ariaLabel={gt('Shader speed')}
                    label={<T>Shader speed</T>}
                    max={1.5}
                    min={0}
                    onChange={(speed) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, speed },
                    })}
                    step={0.01}
                    unit='×'
                    value={frameMaterialSettings.speed}
                  />
                  <RangeControl
                    ariaLabel={gt('Shader frequency')}
                    label={<T>Frequency</T>}
                    max={12}
                    min={0.2}
                    onChange={(frequency) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, frequency },
                    })}
                    step={0.1}
                    value={frameMaterialSettings.frequency}
                  />
                  <RangeControl
                    ariaLabel={gt('Shader detail')}
                    label={<T>Detail</T>}
                    max={8}
                    min={0.5}
                    onChange={(detail) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, detail },
                    })}
                    step={0.1}
                    value={frameMaterialSettings.detail}
                  />
                  <RangeControl
                    ariaLabel={gt('Shader intensity')}
                    label={<T>Intensity</T>}
                    max={1}
                    min={0}
                    onChange={(strength) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, strength },
                    })}
                    step={0.05}
                    value={frameMaterialSettings.strength}
                  />
                  <RangeControl
                    ariaLabel={gt('Shader grain')}
                    label={<T>Grain</T>}
                    max={100}
                    min={0}
                    onChange={(grain) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, grain },
                    })}
                    step={1}
                    unit='%'
                    value={frameMaterialSettings.grain}
                  />
                  <RangeControl
                    ariaLabel={gt('Shader rotation')}
                    label={<T>Rotation</T>}
                    max={180}
                    min={-180}
                    onChange={(rotationZ) => onBackgroundChange({
                      materialSettings: { ...frameMaterialSettings, rotationZ },
                    })}
                    step={1}
                    unit='°'
                    value={frameMaterialSettings.rotationZ}
                  />
                  </div>
                </details>
              </div>
            </details>
          ) : null}
          <ShaderLibraryBrowser
            activeMaterialId={editableBackground.materialId}
            compact
            excludeMaterialIds={compact ? COMPACT_SHADER_EXCLUSIONS : undefined}
            limit={compact ? 30 : undefined}
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
        </InspectorSection>
        </>
      ) : (
        <>
      <InspectorSection index='04' title={<T>Selected frame</T>}>
        {frameSettings && selectedSource ? (
          <>
            <div className='flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold'>
                  {selectedSource.kind === 'text' ? selectedSource.text : selectedSource.name}
                </p>
                <p className='mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
                  {selectedSource.kind}
                </p>
              </div>
              <Button
                aria-label={gt('Reset selected frame')}
                onClick={onResetFrame}
                size='icon-sm'
                type='button'
                variant='outline'
              >
                <RotateCcw aria-hidden='true' />
              </Button>
            </div>
            <div className='grid grid-cols-2'>
              <Button
                className='rounded-r-none'
                onClick={() => onSelectedEffectTargetChange('content')}
                type='button'
                variant={selectedEffectTarget === 'content' ? 'default' : 'outline'}
              >
                {selectedSource.kind === 'text' ? <T>Text</T> : <T>Artwork</T>}
              </Button>
              <Button
                className='rounded-l-none border-l-0'
                onClick={() => onSelectedEffectTargetChange('background')}
                type='button'
                variant={selectedEffectTarget === 'background' ? 'default' : 'outline'}
              >
                <T>Background</T>
              </Button>
            </div>

            {selectedEffectTarget === 'content' ? (
              <>
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
                    <StudioSelect
                      ariaLabel={gt('Image fit')}
                      onValueChange={(fit) => onFrameSettingsChange({ fit: fit as StudioFrameSettings['fit'] })}
                      options={[{ label: gt('Contain'), value: 'contain' }, { label: gt('Cover'), value: 'cover' }]}
                      value={frameSettings.fit}
                    />
                  </div>
                )}
                <div className='border-t border-border pt-4'>
                  <div className='mb-3'>
                    <p className='text-sm font-semibold'>
                      {selectedSource.kind === 'text' ? <T>Text effects</T> : <T>Artwork effects</T>}
                    </p>
                    <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Shadows, outlines, glass, and reflections render in preview and GIF export.</T></p>
                  </div>
                  <MaterialFinishControls onChange={(finish) => onFrameSettingsChange({ finish })} settings={frameSettings.finish} />
                </div>
              </>
            ) : (
              <>
                <BackgroundScopeControl
                  compact={compact}
                  hasOverride={hasSelectedBackgroundOverride}
                  onChange={onBackgroundScopeChange}
                  onClearOverrides={onClearBackgroundOverrides}
                  onResetOverride={onResetSelectedBackgroundOverride}
                  overrideCount={backgroundOverrideCount}
                  scope={backgroundScope}
                  selected
                  sourceCount={sources.length}
                />
                <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
                  <T>Background type</T>
                  <StudioSelect
                    ariaLabel={gt('Frame background')}
                    onValueChange={(style) => {
                      const nextStyle = style as StudioFrameSettings['background']['style'];
                      if (nextStyle === 'shader' && usesGenericMaterialColors) {
                        onBackgroundChange({
                          colorA: brandMaterialColors[0],
                          colorB: brandMaterialColors[1],
                          colorC: brandMaterialColors[2],
                          materialSettings: {
                            ...frameMaterialSettings,
                            colorA: brandMaterialColors[0],
                            colorB: brandMaterialColors[1],
                            colorC: brandMaterialColors[2],
                          },
                          style: nextStyle,
                        });
                        return;
                      }
                      onBackgroundChange({ style: nextStyle });
                    }}
                    options={[
                      { label: gt('Solid'), value: 'solid' },
                      { label: gt('Gradient'), value: 'gradient' },
                      { label: gt('Live shader'), value: 'shader' },
                    ]}
                    value={editableBackground.style}
                  />
                </div>
                {editableBackground.style === 'shader' ? (
                  <LiveMaterialControls
                    identity={materialIdentity}
                    materialId={editableBackground.materialId}
                    onMaterialIdChange={(materialId) => onBackgroundChange({ materialId })}
                    onSettingsChange={(materialSettings) => onBackgroundChange({
                      colorA: materialSettings.colorA,
                      colorB: materialSettings.colorB,
                      colorC: materialSettings.colorC,
                      materialSettings,
                    })}
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
                <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
                  <T>Background transition</T>
                  <StudioSelect
                    ariaLabel={gt('Background transition')}
                    onValueChange={(backgroundTransition) => onSettingsChange({ backgroundTransition: backgroundTransition as StudioSettings['backgroundTransition'] })}
                    options={[
                      { label: gt('Crossfade'), value: 'crossfade' },
                      { label: gt('Directional wipe'), value: 'wipe' },
                      { label: gt('Radial reveal'), value: 'radial' },
                    ]}
                    value={settings.backgroundTransition}
                  />
                </div>
                <div className='border-t border-border pt-4'>
                  <div className='mb-3'>
                    <p className='text-sm font-semibold'><T>Background effects</T></p>
                    <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Add edge light, glass, reflection, or depth to the frame background.</T></p>
                  </div>
                  <MaterialFinishControls
                    onChange={(finish) => onBackgroundChange({ finish })}
                    settings={normalizeMaterialFinish(editableBackground.finish)}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <p className='text-sm leading-5 text-muted-foreground'><T>Add or select a frame to edit it.</T></p>
        )}
      </InspectorSection>
      <InspectorSection index='05' title={<T>Timing</T>}>
        <RangeControl
          label={<T>Hold</T>}
          max={3000}
          min={100}
          onChange={(holdMs) => onSettingsChange({ holdMs })}
          step={10}
          unit='ms'
          value={settings.holdMs}
        />
        <RangeControl
          label={<T>Transition</T>}
          max={1200}
          min={40}
          onChange={(transitionMs) => onSettingsChange({ transitionMs })}
          step={10}
          unit='ms'
          value={settings.transitionMs}
        />
        <div className={compact ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-5 gap-1'}>
          {[750, 1000, 1250, 1500, 1750].map((holdMs) => (
            <Button
              className={`font-mono ${compact ? 'h-7 min-w-0 px-1 text-[9px]' : 'px-1 text-xs'}`}
              key={holdMs}
              onClick={() => onSettingsChange({ holdMs })}
              size='sm'
              type='button'
              variant={settings.holdMs === holdMs ? 'default' : 'outline'}
            >
              {(holdMs / 1000).toFixed(holdMs % 1000 === 0 ? 1 : 2)}s
            </Button>
          ))}
        </div>
        <div className={`grid gap-1 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {Object.entries(EASING_PRESETS).map(([name, bezier]) => (
            <Button
              className='px-1 capitalize'
              key={name}
              onClick={() => onSettingsChange({ bezier })}
              size='sm'
              type='button'
              variant={settings.bezier.every((value, index) => value === bezier[index]) ? 'default' : 'outline'}
            >
              {name}
            </Button>
          ))}
        </div>
        <BezierEditor
          compact={compact}
          curve={settings.bezier}
          onChange={(bezier) => onSettingsChange({ bezier })}
        />
      </InspectorSection>

      <InspectorSection index='06' title={<T>Default composition</T>}>
        <RangeControl
          label={<T>Horizontal anchor</T>}
          max={1}
          min={-1}
          onChange={(alignX) => onSettingsChange({ alignX })}
          step={0.01}
          value={settings.alignX}
        />
        <RangeControl
          label={<T>Vertical anchor</T>}
          max={1}
          min={-1}
          onChange={(alignY) => onSettingsChange({ alignY })}
          step={0.01}
          value={settings.alignY}
        />
        <RangeControl
          label={<T>Scale</T>}
          max={1.5}
          min={0.2}
          onChange={(scale) => onSettingsChange({ scale })}
          step={0.01}
          value={settings.scale}
        />
        <RangeControl
          label={<T>Morph blur</T>}
          max={32}
          min={0}
          onChange={(blur) => onSettingsChange({ blur })}
          step={1}
          unit='px'
          value={settings.blur}
        />
        <RangeControl
          label={<T>Text size</T>}
          max={240}
          min={16}
          onChange={(fontSize) => onSettingsChange({ fontSize })}
          step={1}
          unit='px'
          value={settings.fontSize}
        />
        <ColorControl ariaLabel={gt('Default foreground')} label={<T>Default foreground</T>} onChange={(foreground) => onSettingsChange({ foreground })} value={settings.foreground} />
      </InspectorSection>

      <InspectorSection index='07' title={<T>Output</T>}>
        <div className='grid grid-cols-3 gap-1'>
          {([
            ['Email', 1000, 300],
            ['HD', 1600, 480],
            ['2×', 2400, 720],
          ] as const).map(([label, width, height]) => (
            <Button key={label} onClick={() => onSettingsChange({ height, width })} size='sm' type='button' variant={settings.width === width && settings.height === height ? 'default' : 'outline'}>{label}</Button>
          ))}
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Width</T>
            <input
              className='h-9 rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground outline-none focus:border-foreground'
              max='3200'
              min='120'
              onChange={(event) => onSettingsChange({ width: Number(event.target.value) })}
              step='10'
              type='number'
              value={settings.width}
            />
          </label>
          <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Height</T>
            <input
              className='h-9 rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground outline-none focus:border-foreground'
              max='2400'
              min='120'
              onChange={(event) => onSettingsChange({ height: Number(event.target.value) })}
              step='10'
              type='number'
              value={settings.height}
            />
          </label>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Frame rate</T>
            <StudioSelect
              ariaLabel={gt('Frame rate')}
              className='font-mono'
              onValueChange={(value) => onSettingsChange({ fps: Number(value) })}
              options={[10, 15, 20, 24, 30].map((fps) => ({ label: `${fps} fps`, value: String(fps) }))}
              value={String(settings.fps)}
            />
          </div>
          <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Palette</T>
            <StudioSelect
              ariaLabel={gt('Palette')}
              className='font-mono'
              onValueChange={(value) => onSettingsChange({ colors: Number(value) as StudioSettings['colors'] })}
              options={[32, 64, 128, 256].map((colors) => ({ label: String(colors), value: String(colors) }))}
              value={String(settings.colors)}
            />
          </div>
        </div>
        <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'>
          <T>Loop forever</T>
          <input
            checked={settings.loop}
            className='size-4 accent-foreground'
            onChange={(event) => onSettingsChange({ loop: event.target.checked })}
            type='checkbox'
          />
        </label>
      </InspectorSection>
        </>
      )}
    </StudioSidebar>
  );
}
