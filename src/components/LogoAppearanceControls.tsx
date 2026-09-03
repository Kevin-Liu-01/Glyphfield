'use client';

import { T, useGT } from 'gt-next';
import { useEffect, useRef, useState } from 'react';

import StudioRangeLabel from '@/components/StudioRangeLabel';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRange from '@/components/ui/StudioRange';
import type { LogoAppearanceSettings } from '@/lib/logoAppearance';

function appearancePreviewHandler<Key extends keyof LogoAppearanceSettings>(
  onPreview: ((patch: Partial<LogoAppearanceSettings>) => void) | undefined,
  key: Key
): ((value: LogoAppearanceSettings[Key]) => void) | undefined {
  if (!onPreview) return undefined;
  return (value) => onPreview({ [key]: value });
}

function AppearanceRange({
  label,
  max,
  min,
  onChange,
  onPreview,
  step = 1,
  suffix = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const [localValue, setLocalValue] = useState(value);
  const latestValueRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);
  const previewFrameRef = useRef(0);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current && pendingValueRef.current === null && previewFrameRef.current === 0) {
      setLocalValue(value);
    }
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(previewFrameRef.current), []);

  function schedulePreview(nextValue: number) {
    latestValueRef.current = nextValue;
    pendingValueRef.current = nextValue;
    setLocalValue(nextValue);
    if (previewFrameRef.current) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = 0;
      const frameValue = pendingValueRef.current;
      pendingValueRef.current = null;
      if (frameValue === null) return;
      (onPreview ?? onChange)(frameValue);
    });
  }

  function commitPreview() {
    cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = 0;
    const nextValue = pendingValueRef.current ?? latestValueRef.current;
    pendingValueRef.current = null;
    latestValueRef.current = null;
    if (nextValue === null) return;
    onPreview?.(nextValue);
    onChange(nextValue);
  }

  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <StudioRangeLabel
        label={label}
        value={<output className='font-mono text-[10px]'>{localValue}{suffix}</output>}
      />
      <StudioRange
        aria-label={label}
        max={max}
        min={min}
        onBlur={() => {
          scrubbingRef.current = false;
          commitPreview();
        }}
        onInput={(event) => schedulePreview(Number(event.currentTarget.value))}
        onPointerCancel={() => {
          scrubbingRef.current = false;
          commitPreview();
        }}
        onPointerDown={() => { scrubbingRef.current = true; }}
        onPointerUp={() => {
          scrubbingRef.current = false;
          commitPreview();
        }}
        step={step}
        value={localValue}
      />
    </label>
  );
}

export default function LogoAppearanceControls({
  kind = 'logo',
  onChange,
  onPreview,
  settings,
}: {
  kind?: 'image' | 'logo' | 'sticker';
  onChange: (patch: Partial<LogoAppearanceSettings>) => void;
  onPreview?: (patch: Partial<LogoAppearanceSettings>) => void;
  settings: LogoAppearanceSettings;
}) {
  const gt = useGT();
  const isImage = kind !== 'logo';
  const isSticker = kind === 'sticker';

  return (
    <div className='shader-lab-v2-appearance-controls'>
      <div className='shader-lab-v2-effect-group'>
        <label className='shader-lab-v2-effect-toggle'>
          <span>
            <strong>{isSticker ? <T>Print treatment</T> : <T>Color treatment</T>}</strong>
            <small>{isSticker ? <T>Adjust the artwork without changing its source.</T> : <T>Adjust the source colors non-destructively.</T>}</small>
          </span>
        </label>
        <label className='shader-lab-v2-appearance-option'>
          <span>{isImage ? <T>Invert image colors</T> : <T>Invert logo color</T>}</span>
          <StudioCheckbox checked={settings.invert} onChange={(event) => onChange({ invert: event.target.checked })} />
        </label>
        <label className='shader-lab-v2-appearance-option'>
          <span>{isImage ? <T>Dither image</T> : <T>Dither logo</T>}</span>
          <StudioCheckbox checked={settings.ditherEnabled} onChange={(event) => onChange({ ditherEnabled: event.target.checked })} />
        </label>
        {settings.ditherEnabled ? (
          <div className='shader-lab-v2-effect-settings'>
            <p>
              {isImage
                ? <T>Resolve the selected image through an ordered print field without changing the source asset.</T>
                : <T>Resolve the selected mark through an ordered print field without changing the source asset.</T>}
            </p>
            <AppearanceRange label={gt('Dither amount')} max={100} min={0} onChange={(ditherAmount) => onChange({ ditherAmount })} onPreview={appearancePreviewHandler(onPreview, 'ditherAmount')} suffix='%' value={settings.ditherAmount} />
            <AppearanceRange label={gt('Cell size')} max={18} min={2} onChange={(ditherScale) => onChange({ ditherScale })} onPreview={appearancePreviewHandler(onPreview, 'ditherScale')} suffix='px' value={settings.ditherScale} />
            <AppearanceRange label={gt('Dither direction')} max={360} min={0} onChange={(ditherAngle) => onChange({ ditherAngle })} onPreview={appearancePreviewHandler(onPreview, 'ditherAngle')} suffix='°' value={settings.ditherAngle} />
          </div>
        ) : null}
      </div>

      <div className='shader-lab-v2-effect-group'>
        <label className='shader-lab-v2-effect-toggle'>
          <span>
            <strong>{isSticker ? <T>Die-cut outline</T> : <T>Outline</T>}</strong>
            <small>{isSticker ? <T>Add a clean printable edge around the artwork.</T> : <T>Trace the visible shape with a crisp edge.</T>}</small>
          </span>
          <StudioCheckbox checked={settings.borderEnabled} onChange={(event) => onChange({ borderEnabled: event.target.checked })} />
        </label>
        {settings.borderEnabled ? (
          <div className='shader-lab-v2-effect-settings'>
            <ColorControl ariaLabel={gt(isImage ? 'Image outline color' : 'Logo outline color')} label={<T>Outline color</T>} onChange={(borderColor) => onChange({ borderColor })} onOpacityChange={(borderOpacity) => onChange({ borderOpacity })} onOpacityPreview={appearancePreviewHandler(onPreview, 'borderOpacity')} onPreview={appearancePreviewHandler(onPreview, 'borderColor')} opacity={settings.borderOpacity} value={settings.borderColor} />
            <AppearanceRange label={gt('Outline width')} max={isSticker ? 24 : 12} min={0.5} onChange={(borderWidth) => onChange({ borderWidth })} onPreview={appearancePreviewHandler(onPreview, 'borderWidth')} step={0.5} suffix='px' value={settings.borderWidth} />
          </div>
        ) : null}
      </div>

      <div className='shader-lab-v2-effect-group'>
        <label className='shader-lab-v2-effect-toggle'>
          <span>
            <strong>{isSticker ? <T>Sticker shadow</T> : isImage ? <T>Image shadow</T> : <T>Logo shadow</T>}</strong>
            <small><T>Add depth while preserving the editable layer.</T></small>
          </span>
          <StudioCheckbox checked={settings.shadowEnabled} onChange={(event) => onChange({ shadowEnabled: event.target.checked })} />
        </label>
        {settings.shadowEnabled ? (
          <div className='shader-lab-v2-effect-settings'>
            <ColorControl ariaLabel={gt(isImage ? 'Image shadow color' : 'Logo shadow color')} label={<T>Shadow color</T>} onChange={(shadowColor) => onChange({ shadowColor })} onOpacityChange={(shadowOpacity) => onChange({ shadowOpacity })} onOpacityPreview={appearancePreviewHandler(onPreview, 'shadowOpacity')} onPreview={appearancePreviewHandler(onPreview, 'shadowColor')} opacity={settings.shadowOpacity} value={settings.shadowColor} />
            <AppearanceRange label={gt('Blur')} max={64} min={0} onChange={(shadowBlur) => onChange({ shadowBlur })} onPreview={appearancePreviewHandler(onPreview, 'shadowBlur')} suffix='px' value={settings.shadowBlur} />
            <AppearanceRange label={gt('Horizontal offset')} max={48} min={-48} onChange={(shadowOffsetX) => onChange({ shadowOffsetX })} onPreview={appearancePreviewHandler(onPreview, 'shadowOffsetX')} suffix='px' value={settings.shadowOffsetX} />
            <AppearanceRange label={gt('Vertical offset')} max={48} min={-48} onChange={(shadowOffsetY) => onChange({ shadowOffsetY })} onPreview={appearancePreviewHandler(onPreview, 'shadowOffsetY')} suffix='px' value={settings.shadowOffsetY} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
