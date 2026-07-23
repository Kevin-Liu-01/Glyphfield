'use client';

import type { ReactNode } from 'react';
import { T, useGT } from 'gt-next';

import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  MATERIAL_FINISH_PRESETS,
  materialFinishPreset,
  normalizeMaterialFinish,
  type MaterialFinishPresetId,
  type MaterialFinishSettings,
} from '@/lib/materialFinish';

function RangeControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  unit = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2'>
      <span className='flex items-center justify-between gap-3 text-sm text-muted-foreground'>
        <span>{label}</span>
        <output className='font-mono text-xs tabular-nums'>{value}{unit}</output>
      </span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={value} />
    </label>
  );
}

function FinishToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 text-sm ${checked ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-foreground'}`}>
      <span>{label}</span>
      <input checked={checked} className='sr-only' onChange={(event) => onChange(event.target.checked)} type='checkbox' />
      <span aria-hidden='true' className={`size-2 rounded-full ${checked ? 'bg-background' : 'bg-muted-foreground/35'}`} />
    </label>
  );
}

export default function MaterialFinishControls({
  onChange,
  settings,
}: {
  onChange: (settings: MaterialFinishSettings) => void;
  settings?: Partial<MaterialFinishSettings>;
}) {
  const gt = useGT();
  const finish = normalizeMaterialFinish(settings);

  function update(patch: Partial<MaterialFinishSettings>) {
    onChange({ ...finish, ...patch, presetId: 'custom' });
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2 text-xs text-muted-foreground'>
        <T>Finish preset</T>
        <StudioSelect
          ariaLabel={gt('Finish preset')}
          onValueChange={(value) => onChange(materialFinishPreset(value as MaterialFinishPresetId))}
          options={[
            ...MATERIAL_FINISH_PRESETS.map((preset) => ({
              label: `${gt(preset.label)} · ${gt(preset.description)}`,
              value: preset.id,
            })),
            ...(finish.presetId === 'custom' ? [{ label: gt('Custom'), value: 'custom' }] : []),
          ]}
          value={finish.presetId}
        />
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <FinishToggle checked={finish.shadowEnabled} label={<T>Shadow</T>} onChange={(shadowEnabled) => update({ shadowEnabled })} />
        <FinishToggle checked={finish.borderEnabled} label={<T>Border</T>} onChange={(borderEnabled) => update({ borderEnabled })} />
        <FinishToggle checked={finish.reflectionEnabled} label={<T>Reflection</T>} onChange={(reflectionEnabled) => update({ reflectionEnabled })} />
        <FinishToggle checked={finish.glassEnabled} label={<T>Liquid glass</T>} onChange={(glassEnabled) => update({ glassEnabled })} />
      </div>

      {finish.shadowEnabled ? (
        <div className='flex flex-col gap-3 border-t border-border pt-4'>
          <p className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'><T>Shadow</T></p>
          <ColorControl ariaLabel={gt('Shadow color')} label={<T>Color</T>} onChange={(shadowColor) => update({ shadowColor })} value={finish.shadowColor} />
          <RangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(shadowOpacity) => update({ shadowOpacity })} unit='%' value={finish.shadowOpacity} />
          <RangeControl label={<T>Blur</T>} max={100} min={0} onChange={(shadowBlur) => update({ shadowBlur })} unit='px' value={finish.shadowBlur} />
          <div className='grid grid-cols-2 gap-3'>
            <RangeControl label='X' max={80} min={-80} onChange={(shadowOffsetX) => update({ shadowOffsetX })} unit='px' value={finish.shadowOffsetX} />
            <RangeControl label='Y' max={80} min={-80} onChange={(shadowOffsetY) => update({ shadowOffsetY })} unit='px' value={finish.shadowOffsetY} />
          </div>
        </div>
      ) : null}

      {finish.borderEnabled ? (
        <div className='flex flex-col gap-3 border-t border-border pt-4'>
          <p className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'><T>Border</T></p>
          <ColorControl ariaLabel={gt('Border color')} label={<T>Color</T>} onChange={(borderColor) => update({ borderColor })} value={finish.borderColor} />
          <RangeControl label={<T>Width</T>} max={16} min={0} onChange={(borderWidth) => update({ borderWidth })} step={0.5} unit='px' value={finish.borderWidth} />
          <RangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(borderOpacity) => update({ borderOpacity })} unit='%' value={finish.borderOpacity} />
        </div>
      ) : null}

      {finish.reflectionEnabled ? (
        <div className='flex flex-col gap-3 border-t border-border pt-4'>
          <p className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'><T>Reflection</T></p>
          <RangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(reflectionOpacity) => update({ reflectionOpacity })} unit='%' value={finish.reflectionOpacity} />
          <RangeControl label={<T>Gap</T>} max={120} min={0} onChange={(reflectionGap) => update({ reflectionGap })} unit='px' value={finish.reflectionGap} />
          <RangeControl label={<T>Fade length</T>} max={150} min={10} onChange={(reflectionLength) => update({ reflectionLength })} unit='%' value={finish.reflectionLength} />
          <RangeControl label={<T>Blur</T>} max={32} min={0} onChange={(reflectionBlur) => update({ reflectionBlur })} unit='px' value={finish.reflectionBlur} />
        </div>
      ) : null}

      {finish.glassEnabled ? (
        <div className='flex flex-col gap-3 border-t border-border pt-4'>
          <div>
            <p className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'><T>Liquid glass</T></p>
            <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Refracts the live background beneath a translucent surface.</T></p>
          </div>
          <ColorControl ariaLabel={gt('Glass tint')} label={<T>Tint</T>} onChange={(glassTint) => update({ glassTint })} value={finish.glassTint} />
          <RangeControl label={<T>Surface opacity</T>} max={100} min={0} onChange={(glassOpacity) => update({ glassOpacity })} unit='%' value={finish.glassOpacity} />
          <RangeControl label={<T>Backdrop blur</T>} max={80} min={0} onChange={(glassBlur) => update({ glassBlur })} unit='px' value={finish.glassBlur} />
          <RangeControl label={<T>Refraction</T>} max={30} min={0} onChange={(glassRefraction) => update({ glassRefraction })} unit='%' value={finish.glassRefraction} />
          <RangeControl label={<T>Edge highlight</T>} max={100} min={0} onChange={(glassHighlight) => update({ glassHighlight })} unit='%' value={finish.glassHighlight} />
          <RangeControl label={<T>Padding</T>} max={120} min={0} onChange={(glassPadding) => update({ glassPadding })} unit='px' value={finish.glassPadding} />
          <RangeControl label={<T>Radius</T>} max={120} min={0} onChange={(glassRadius) => update({ glassRadius })} unit='px' value={finish.glassRadius} />
        </div>
      ) : null}
    </div>
  );
}
