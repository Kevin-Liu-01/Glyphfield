'use client';

import { T, useGT } from 'gt-next';

import StudioRangeLabel from '@/components/StudioRangeLabel';
import ColorControl from '@/components/ui/ColorControl';
import type { LogoAppearanceSettings } from '@/lib/logoAppearance';

function AppearanceRange({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <StudioRangeLabel
        label={label}
        value={<output className='font-mono text-[10px]'>{value}{suffix}</output>}
      />
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={value} />
    </label>
  );
}

export default function LogoAppearanceControls({
  kind = 'logo',
  onChange,
  settings,
}: {
  kind?: 'image' | 'logo';
  onChange: (patch: Partial<LogoAppearanceSettings>) => void;
  settings: LogoAppearanceSettings;
}) {
  const gt = useGT();
  const isImage = kind === 'image';

  return (
    <div className='flex flex-col gap-4'>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span>{isImage ? <T>Invert image colors</T> : <T>Invert logo color</T>}</span>
        <input checked={settings.invert} onChange={(event) => onChange({ invert: event.target.checked })} type='checkbox' />
      </label>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span>{isImage ? <T>Dither image</T> : <T>Dither logo</T>}</span>
        <input checked={settings.ditherEnabled} onChange={(event) => onChange({ ditherEnabled: event.target.checked })} type='checkbox' />
      </label>
      {settings.ditherEnabled ? (
        <div className='flex flex-col gap-4 border-l border-border pl-3'>
          <p className='text-xs leading-5 text-muted-foreground'>
            {isImage
              ? <T>Resolve the selected image through an ordered print field without changing the source asset.</T>
              : <T>Resolve the selected mark through an ordered print field without changing the source asset.</T>}
          </p>
          <AppearanceRange label={gt('Dither amount')} max={100} min={0} onChange={(ditherAmount) => onChange({ ditherAmount })} suffix='%' value={settings.ditherAmount} />
          <AppearanceRange label={gt('Cell size')} max={18} min={2} onChange={(ditherScale) => onChange({ ditherScale })} suffix='px' value={settings.ditherScale} />
          <AppearanceRange label={gt('Dither direction')} max={360} min={0} onChange={(ditherAngle) => onChange({ ditherAngle })} suffix='°' value={settings.ditherAngle} />
        </div>
      ) : null}
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span>{isImage ? <T>Outline image shape</T> : <T>Outline SVG shape</T>}</span>
        <input checked={settings.borderEnabled} onChange={(event) => onChange({ borderEnabled: event.target.checked })} type='checkbox' />
      </label>
      {settings.borderEnabled ? (
        <div className='flex flex-col gap-4 border-l border-border pl-3'>
          <ColorControl ariaLabel={gt(isImage ? 'Image outline color' : 'Logo outline color')} label={<T>Outline color</T>} onChange={(borderColor) => onChange({ borderColor })} onOpacityChange={(borderOpacity) => onChange({ borderOpacity })} opacity={settings.borderOpacity} value={settings.borderColor} />
          <AppearanceRange label={gt('Outline width')} max={12} min={0.5} onChange={(borderWidth) => onChange({ borderWidth })} step={0.5} suffix='px' value={settings.borderWidth} />
        </div>
      ) : null}
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span>{isImage ? <T>Image shadow</T> : <T>Logo shadow</T>}</span>
        <input checked={settings.shadowEnabled} onChange={(event) => onChange({ shadowEnabled: event.target.checked })} type='checkbox' />
      </label>
      {settings.shadowEnabled ? (
        <div className='flex flex-col gap-4 border-l border-border pl-3'>
          <ColorControl ariaLabel={gt(isImage ? 'Image shadow color' : 'Logo shadow color')} label={<T>Shadow color</T>} onChange={(shadowColor) => onChange({ shadowColor })} onOpacityChange={(shadowOpacity) => onChange({ shadowOpacity })} opacity={settings.shadowOpacity} value={settings.shadowColor} />
          <AppearanceRange label={gt('Blur')} max={64} min={0} onChange={(shadowBlur) => onChange({ shadowBlur })} suffix='px' value={settings.shadowBlur} />
          <AppearanceRange label={gt('Horizontal offset')} max={48} min={-48} onChange={(shadowOffsetX) => onChange({ shadowOffsetX })} suffix='px' value={settings.shadowOffsetX} />
          <AppearanceRange label={gt('Vertical offset')} max={48} min={-48} onChange={(shadowOffsetY) => onChange({ shadowOffsetY })} suffix='px' value={settings.shadowOffsetY} />
        </div>
      ) : null}
    </div>
  );
}
