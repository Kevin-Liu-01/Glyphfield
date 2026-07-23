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

import BezierEditor from '@/components/BezierEditor';
import MaterialFinishControls from '@/components/MaterialFinishControls';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_OPTIONS,
} from '@/lib/liveMaterials';
import type { StudioSource } from '@/lib/renderFrame';
import {
  EASING_PRESETS,
  type ImportedImage,
  type SourceMode,
  type StudioFrameSettings,
  type StudioSettings,
} from '@/lib/studio';

import type { AnimationPackageId } from '@/lib/renderFrame';

type StudioControlsProps = {
  brandLogoAvailable: boolean;
  frameSettings: StudioFrameSettings | null;
  hasImageSources: boolean;
  images: readonly ImportedImage[];
  includeBrandLogo: boolean;
  mode: SourceMode;
  onBackgroundChange: (patch: Partial<StudioFrameSettings['background']>) => void;
  onFiles: (files: FileList) => void;
  onFrameSettingsChange: (patch: Partial<StudioFrameSettings>) => void;
  onIncludeBrandLogoChange: (include: boolean) => void;
  onModeChange: (mode: SourceMode) => void;
  onMoveSource: (id: string, direction: -1 | 1) => void;
  onRemoveImage: (id: string) => void;
  onResetFrame: () => void;
  onSelectSource: (id: string) => void;
  onSettingsChange: (patch: Partial<StudioSettings>) => void;
  onTextFramesChange: (value: string) => void;
  selectedSource: StudioSource | null;
  settings: StudioSettings;
  sources: readonly StudioSource[];
  textFrames: string;
};

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
    <section className='flex flex-col gap-4 border-b border-border p-5'>
      <div className='flex items-center justify-between gap-4'>
        <h2 className='text-sm font-semibold'>{title}</h2>
        <span className='font-mono text-xs text-muted-foreground'>{index}</span>
      </div>
      {children}
    </section>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2'>
      <span className='flex items-center justify-between gap-3 text-sm'>
        <span>{label}</span>
        <output className='font-mono text-xs tabular-nums text-muted-foreground'>
          {value}
          {unit}
        </output>
      </span>
      <input
        className='studio-range'
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type='range'
        value={value}
      />
    </label>
  );
}

function PackageChoice({
  description,
  disabled = false,
  id,
  label,
  onSelect,
  selected,
}: {
  description: ReactNode;
  disabled?: boolean;
  id: AnimationPackageId;
  label: ReactNode;
  onSelect: (id: AnimationPackageId) => void;
  selected: boolean;
}) {
  return (
    <Button
      className={`h-auto w-full items-start justify-start rounded-md px-3 py-3 text-left ${
        selected
          ? 'border-foreground text-background'
          : 'border-border bg-background text-foreground hover:!bg-muted'
      }`}
      disabled={disabled}
      onClick={() => onSelect(id)}
      type='button'
      variant={selected ? 'default' : 'outline'}
    >
      <span className='flex min-w-0 flex-col gap-1 whitespace-normal'>
        <span className='text-sm font-semibold'>{label}</span>
        <span
          className={`text-xs leading-4 ${selected ? 'text-background/70' : 'text-muted-foreground'}`}
        >
          {description}
        </span>
      </span>
    </Button>
  );
}

export default function StudioControls({
  brandLogoAvailable,
  frameSettings,
  hasImageSources,
  images,
  includeBrandLogo,
  mode,
  onBackgroundChange,
  onFiles,
  onFrameSettingsChange,
  onIncludeBrandLogoChange,
  onModeChange,
  onMoveSource,
  onRemoveImage,
  onResetFrame,
  onSelectSource,
  onSettingsChange,
  onTextFramesChange,
  selectedSource,
  settings,
  sources,
  textFrames,
}: StudioControlsProps) {
  const gt = useGT();
  const frameMaterialSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...frameSettings?.background.materialSettings,
  };

  return (
    <aside className='studio-inspector border-r border-border bg-background'>
      <InspectorSection index='01' title={<T>Source</T>}>
        <div className='grid grid-cols-3'>
          {([
            ['sequence', gt('Sequence')],
            ['text', gt('Text')],
            ['images', gt('Images')],
          ] as const).map(([value, label]) => (
            <Button
              className='rounded-none border-r-0 last:border-r'
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
                    className={`grid grid-cols-[1fr_28px_28px] items-center overflow-hidden rounded-md border ${
                      selectedSource?.id === source.id
                        ? 'border-foreground bg-muted'
                        : 'border-border'
                    }`}
                    key={source.id}
                  >
                    <button
                      className='flex min-w-0 items-center gap-2 px-3 py-2 text-left'
                      onClick={() => onSelectSource(source.id)}
                      type='button'
                    >
                      {source.kind === 'text' ? (
                        <Type aria-hidden='true' className='size-3.5 shrink-0' />
                      ) : (
                        <ImageIcon aria-hidden='true' className='size-3.5 shrink-0' />
                      )}
                      <span className='min-w-0 flex-1 truncate text-sm'>{label}</span>
                      <span className='font-mono text-[9px] text-muted-foreground'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </button>
                    <Button
                      aria-label={gt('Move {name} up', { name: label })}
                      disabled={index === 0}
                      onClick={() => onMoveSource(source.id, -1)}
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

      <InspectorSection index='02' title={<T>Selected frame</T>}>
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
            <RangeControl label={<T>Horizontal</T>} max={1} min={-1} onChange={(alignX) => onFrameSettingsChange({ alignX })} step={0.01} value={frameSettings.alignX} />
            <RangeControl label={<T>Vertical</T>} max={1} min={-1} onChange={(alignY) => onFrameSettingsChange({ alignY })} step={0.01} value={frameSettings.alignY} />
            <RangeControl label={<T>Scale</T>} max={2.5} min={0.1} onChange={(scale) => onFrameSettingsChange({ scale })} step={0.01} value={frameSettings.scale} />
            <RangeControl label={<T>Rotation</T>} max={180} min={-180} onChange={(rotation) => onFrameSettingsChange({ rotation })} step={1} unit='°' value={frameSettings.rotation} />
            <RangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(opacity) => onFrameSettingsChange({ opacity: opacity / 100 })} step={1} unit='%' value={Math.round(frameSettings.opacity * 100)} />
            {selectedSource.kind === 'text' ? (
              <>
                <RangeControl label={<T>Text size</T>} max={240} min={16} onChange={(fontSize) => onFrameSettingsChange({ fontSize })} step={1} unit='px' value={frameSettings.fontSize} />
                <RangeControl label={<T>Weight</T>} max={900} min={100} onChange={(fontWeight) => onFrameSettingsChange({ fontWeight })} step={100} value={frameSettings.fontWeight} />
                <ColorControl ariaLabel={gt('Frame foreground')} label={<T>Foreground</T>} onChange={(foreground) => onFrameSettingsChange({ foreground })} value={frameSettings.foreground} />
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
              <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
                <T>Background</T>
                <StudioSelect
                  ariaLabel={gt('Frame background')}
                  onValueChange={(style) => onBackgroundChange({ style: style as StudioFrameSettings['background']['style'] })}
                  options={[
                    { label: gt('Solid'), value: 'solid' },
                    { label: gt('Gradient'), value: 'gradient' },
                    { label: gt('Live shader'), value: 'shader' },
                  ]}
                  value={frameSettings.background.style}
                />
              </div>
            </div>
            <ColorControl ariaLabel={gt('Background color A')} label={<T>Color A</T>} onChange={(colorA) => onBackgroundChange({ colorA })} value={frameSettings.background.colorA} />
            {frameSettings.background.style === 'solid' ? null : (
              <ColorControl ariaLabel={gt('Background color B')} label={<T>Color B</T>} onChange={(colorB) => onBackgroundChange({ colorB })} value={frameSettings.background.colorB} />
            )}
            {frameSettings.background.style === 'shader' ? (
              <>
                <ColorControl ariaLabel={gt('Background color C')} label={<T>Color C</T>} onChange={(colorC) => onBackgroundChange({ colorC })} value={frameSettings.background.colorC} />
                <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
                  <T>Shader</T>
                  <StudioSelect
                    ariaLabel={gt('Frame shader')}
                    onValueChange={(materialId) => onBackgroundChange({ materialId: materialId as StudioFrameSettings['background']['materialId'] })}
                    options={LIVE_MATERIAL_OPTIONS.map((material) => ({ label: material.name, value: material.id }))}
                    value={frameSettings.background.materialId}
                  />
                </div>
                {([
                  ['Shader speed', 'speed', 0, 2, 0.05, '×'],
                  ['Strength', 'strength', 0, 2, 0.05, ''],
                  ['Detail', 'detail', 0.5, 8, 0.1, ''],
                  ['Frequency', 'frequency', 0.2, 12, 0.1, ''],
                  ['Amplitude', 'amplitude', 0, 8, 0.1, ''],
                  ['Density', 'density', 0.1, 2, 0.05, ''],
                  ['Brightness', 'brightness', 0.1, 2, 0.05, ''],
                  ['Grain', 'grain', 0, 100, 1, '%'],
                  ['Rotation X', 'rotationX', 0, 360, 1, '°'],
                  ['Rotation Y', 'rotationY', 0, 360, 1, '°'],
                  ['Rotation Z', 'rotationZ', 0, 360, 1, '°'],
                ] as const).map(([label, key, min, max, step, unit]) => (
                  <RangeControl
                    key={key}
                    label={gt(label)}
                    max={max}
                    min={min}
                    onChange={(value) => onBackgroundChange({ materialSettings: { ...frameMaterialSettings, [key]: value } })}
                    step={step}
                    unit={unit}
                    value={frameMaterialSettings[key]}
                  />
                ))}
              </>
            ) : null}
            {frameSettings.background.style === 'solid' ? null : (
              <RangeControl label={<T>Angle</T>} max={360} min={0} onChange={(angle) => onBackgroundChange({ angle })} step={1} unit='°' value={frameSettings.background.angle} />
            )}
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
                <p className='text-sm font-semibold'><T>Surface finish</T></p>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Applies to this frame in both preview and GIF export.</T></p>
              </div>
              <MaterialFinishControls onChange={(finish) => onFrameSettingsChange({ finish })} settings={frameSettings.finish} />
            </div>
          </>
        ) : (
          <p className='text-sm leading-5 text-muted-foreground'><T>Add or select a frame to edit it.</T></p>
        )}
      </InspectorSection>
      <InspectorSection index='03' title={<T>Animation package</T>}>
        <div className='grid grid-cols-1 gap-2'>
          <PackageChoice
            description={<T>Blurred cross-dissolve with stable shared centering.</T>}
            id='morph-fade'
            label={<T>Morph fade</T>}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selected={settings.packageId === 'morph-fade'}
          />
          <PackageChoice
            description={<T>Grapheme-by-grapheme erase and type. No cursor.</T>}
            disabled={hasImageSources}
            id='type-delete'
            label={<T>Type / delete</T>}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selected={settings.packageId === 'type-delete'}
          />
          <PackageChoice
            description={<T>A clean opacity handoff without spatial movement.</T>}
            id='crossfade'
            label={<T>Crossfade</T>}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selected={settings.packageId === 'crossfade'}
          />
          <PackageChoice
            description={<T>Soft depth change through opposing scale and opacity.</T>}
            id='scale-fade'
            label={<T>Scale fade</T>}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selected={settings.packageId === 'scale-fade'}
          />
          <PackageChoice
            description={<T>A short direction-aware move with a faded handoff.</T>}
            id='slide-fade'
            label={<T>Slide fade</T>}
            onSelect={(packageId) => onSettingsChange({ packageId })}
            selected={settings.packageId === 'slide-fade'}
          />
        </div>
      </InspectorSection>

      <InspectorSection index='04' title={<T>Timing</T>}>
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
        <div className='grid grid-cols-5 gap-1'>
          {[750, 1000, 1250, 1500, 1750].map((holdMs) => (
            <Button
              className='px-1 font-mono text-xs'
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
        <div className='grid grid-cols-4 gap-1'>
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
          curve={settings.bezier}
          onChange={(bezier) => onSettingsChange({ bezier })}
        />
      </InspectorSection>

      <InspectorSection index='05' title={<T>Default composition</T>}>
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
        <div className='grid gap-2'>
          <ColorControl ariaLabel={gt('Background')} label={<T>Background</T>} onChange={(background) => onSettingsChange({ background })} value={settings.background} />
          <ColorControl ariaLabel={gt('Foreground')} label={<T>Foreground</T>} onChange={(foreground) => onSettingsChange({ foreground })} value={settings.foreground} />
        </div>
      </InspectorSection>

      <InspectorSection index='06' title={<T>Output</T>}>
        <div className='grid grid-cols-2 gap-2'>
          <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <T>Width</T>
            <input
              className='h-9 rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground outline-none focus:border-foreground'
              max='1600'
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
              max='1200'
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
    </aside>
  );
}
