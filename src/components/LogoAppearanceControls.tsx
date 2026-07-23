'use client';

import { T, useGT } from 'gt-next';

import ColorControl from '@/components/ui/ColorControl';
import type { LogoAppearanceSettings } from '@/lib/logoAppearance';

function AppearanceRange({
  label,
  max,
  min,
  onChange,
  suffix = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <span className='flex items-center justify-between gap-3'>
        <span>{label}</span>
        <output className='font-mono text-[10px]'>{value}{suffix}</output>
      </span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type='range' value={value} />
    </label>
  );
}

export default function LogoAppearanceControls({
  onChange,
  settings,
}: {
  onChange: (patch: Partial<LogoAppearanceSettings>) => void;
  settings: LogoAppearanceSettings;
}) {
  const gt = useGT();

  return (
    <div className='flex flex-col gap-4'>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span><T>Invert logo color</T></span>
        <input checked={settings.invert} onChange={(event) => onChange({ invert: event.target.checked })} type='checkbox' />
      </label>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span><T>Outline SVG shape</T></span>
        <input checked={settings.borderEnabled} onChange={(event) => onChange({ borderEnabled: event.target.checked })} type='checkbox' />
      </label>
      {settings.borderEnabled ? (
        <div className='flex flex-col gap-4 border-l border-border pl-3'>
          <ColorControl ariaLabel={gt('Logo outline color')} label={<T>Outline color</T>} onChange={(borderColor) => onChange({ borderColor })} onOpacityChange={(borderOpacity) => onChange({ borderOpacity })} opacity={settings.borderOpacity} value={settings.borderColor} />
          <AppearanceRange label={gt('Outline width')} max={12} min={1} onChange={(borderWidth) => onChange({ borderWidth })} suffix='px' value={settings.borderWidth} />
        </div>
      ) : null}
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span><T>Logo shadow</T></span>
        <input checked={settings.shadowEnabled} onChange={(event) => onChange({ shadowEnabled: event.target.checked })} type='checkbox' />
      </label>
      {settings.shadowEnabled ? (
        <div className='flex flex-col gap-4 border-l border-border pl-3'>
          <ColorControl ariaLabel={gt('Logo shadow color')} label={<T>Shadow color</T>} onChange={(shadowColor) => onChange({ shadowColor })} onOpacityChange={(shadowOpacity) => onChange({ shadowOpacity })} opacity={settings.shadowOpacity} value={settings.shadowColor} />
          <AppearanceRange label={gt('Blur')} max={64} min={0} onChange={(shadowBlur) => onChange({ shadowBlur })} suffix='px' value={settings.shadowBlur} />
          <AppearanceRange label={gt('Horizontal offset')} max={48} min={-48} onChange={(shadowOffsetX) => onChange({ shadowOffsetX })} suffix='px' value={settings.shadowOffsetX} />
          <AppearanceRange label={gt('Vertical offset')} max={48} min={-48} onChange={(shadowOffsetY) => onChange({ shadowOffsetY })} suffix='px' value={settings.shadowOffsetY} />
        </div>
      ) : null}
    </div>
  );
}
