'use client';

import type { ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { ImagePlus, Trash2 } from 'lucide-react';

import BezierEditor from '@/components/BezierEditor';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { EASING_PRESETS, type ImportedImage, type SourceMode, type StudioSettings } from '@/lib/studio';

import type { AnimationPackageId } from '@/lib/renderFrame';

type StudioControlsProps = {
  images: readonly ImportedImage[];
  mode: SourceMode;
  onFiles: (files: FileList) => void;
  onModeChange: (mode: SourceMode) => void;
  onRemoveImage: (id: string) => void;
  onSettingsChange: (patch: Partial<StudioSettings>) => void;
  onTextFramesChange: (value: string) => void;
  settings: StudioSettings;
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
  images,
  mode,
  onFiles,
  onModeChange,
  onRemoveImage,
  onSettingsChange,
  onTextFramesChange,
  settings,
  textFrames,
}: StudioControlsProps) {
  const gt = useGT();

  return (
    <aside className='studio-inspector border-r border-border bg-background'>
      <InspectorSection index='01' title={<T>Source</T>}>
        <div className='grid grid-cols-2'>
          <Button
            className='rounded-none'
            onClick={() => onModeChange('text')}
            type='button'
            variant={mode === 'text' ? 'default' : 'outline'}
          >
            <T>Text frames</T>
          </Button>
          <Button
            className='rounded-none border-l-0'
            onClick={() => onModeChange('images')}
            type='button'
            variant={mode === 'images' ? 'default' : 'outline'}
          >
            <T>Images</T>
          </Button>
        </div>

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
        ) : (
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=''
                    className='size-10 bg-muted object-contain'
                    src={image.url}
                  />
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
        )}
      </InspectorSection>

      <InspectorSection index='02' title={<T>Animation package</T>}>
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
            disabled={mode === 'images'}
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

      <InspectorSection index='03' title={<T>Timing</T>}>
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

      <InspectorSection index='04' title={<T>Composition</T>}>
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

      <InspectorSection index='05' title={<T>Output</T>}>
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
