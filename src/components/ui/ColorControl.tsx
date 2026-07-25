'use client';

import {
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import {
  formatOklch,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  oklchToHex,
  parseOklch,
} from '@/lib/color';

type ColorControlProps = {
  ariaLabel: string;
  label: ReactNode;
  onChange: (value: string) => void;
  onOpacityChange?: (value: number) => void;
  opacity?: number;
  value: string;
};

function safeHex(value: string): string {
  try {
    return normalizeHex(value);
  } catch {
    return '#000000';
  }
}

export default function ColorControl({
  ariaLabel,
  label,
  onChange,
  onOpacityChange,
  opacity,
  value,
}: ColorControlProps) {
  const pickerId = useId();
  const [pickerPosition, setPickerPosition] = useState({ left: 0, top: 0 });
  const hex = safeHex(value);
  const oklch = formatOklch(hex);
  const hsv = hexToHsv(hex);

  function commitHex(nextValue: string) {
    try {
      onChange(normalizeHex(nextValue));
    } catch {
      return;
    }
  }

  function commitOklch(nextValue: string) {
    const parsed = parseOklch(nextValue);
    if (parsed) onChange(oklchToHex(parsed));
  }

  function updateSaturationAndValue(clientX: number, clientY: number, target: HTMLElement) {
    const bounds = target.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const nextValue = Math.max(0, Math.min(1, 1 - (clientY - bounds.top) / bounds.height));
    onChange(hsvToHex(hsv.hue, saturation, nextValue));
  }

  function handlePickerPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function handlePickerPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.01;
    let saturation = hsv.saturation;
    let nextValue = hsv.value;
    if (event.key === 'ArrowLeft') saturation -= step;
    else if (event.key === 'ArrowRight') saturation += step;
    else if (event.key === 'ArrowUp') nextValue += step;
    else if (event.key === 'ArrowDown') nextValue -= step;
    else return;
    event.preventDefault();
    onChange(hsvToHex(hsv.hue, saturation, nextValue));
  }

  function positionPicker(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const pickerWidth = 260;
    const pickerHeight = 320;
    const left = Math.min(
      window.innerWidth - pickerWidth - viewportPadding,
      Math.max(viewportPadding, bounds.left)
    );
    const fitsBelow = bounds.bottom + pickerHeight + viewportPadding <= window.innerHeight;
    const top = fitsBelow
      ? bounds.bottom + 8
      : Math.max(viewportPadding, bounds.top - pickerHeight - 8);
    setPickerPosition({ left, top });
  }

  return (
    <div className='flex flex-col gap-2.5 rounded-md border border-border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs font-semibold text-foreground'>{label}</span>
        {opacity === undefined ? null : (
          <output className='font-mono text-[10px] text-muted-foreground'>{opacity}%</output>
        )}
      </div>
      <div className='grid grid-cols-[38px_minmax(0,1fr)] items-stretch gap-2'>
        <button
          aria-controls={pickerId}
          aria-haspopup='dialog'
          aria-label={ariaLabel}
          className='relative grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-md border border-input bg-background p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onClick={positionPicker}
          popoverTarget={pickerId}
          popoverTargetAction='toggle'
          type='button'
        >
          <span
            aria-hidden='true'
            className='size-full border border-foreground/10'
            style={{ backgroundColor: hex }}
          />
        </button>
        <label className='grid grid-cols-[42px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
          <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>HEX</span>
          <input
            aria-label={`${ariaLabel} HEX`}
            className='h-9 min-w-0 bg-transparent pr-2 font-mono text-xs uppercase outline-none'
            defaultValue={hex}
            key={hex}
            onBlur={(event) => commitHex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
      </div>
      <div
        className='color-picker-popover flex w-[260px] flex-col gap-3 rounded-md border border-border bg-background p-3 text-foreground shadow-xl'
        id={pickerId}
        popover='auto'
        role='dialog'
        style={pickerPosition}
      >
        <div
          aria-label={`${ariaLabel} saturation and brightness`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(hsv.saturation * 100)}
          className='relative aspect-[16/9] w-full cursor-crosshair touch-none overflow-hidden rounded-sm border border-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onKeyDown={handlePickerKeyDown}
          onPointerDown={handlePickerPointerDown}
          onPointerMove={handlePickerPointerMove}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          role='slider'
          style={{
            backgroundColor: `hsl(${hsv.hue} 100% 50%)`,
            backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
          }}
          tabIndex={0}
        >
          <span
            aria-hidden='true'
            className='pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.55)]'
            style={{
              left: `clamp(6px, ${hsv.saturation * 100}%, calc(100% - 6px))`,
              top: `clamp(6px, ${(1 - hsv.value) * 100}%, calc(100% - 6px))`,
            }}
          />
        </div>
        <label className='flex items-center gap-3'>
          <span className='size-5 shrink-0 rounded-full border border-border' style={{ backgroundColor: hex }} />
          <input
            aria-label={`${ariaLabel} hue`}
            className='studio-range color-hue-range min-w-0 flex-1'
            max={360}
            min={0}
            onChange={(event) => onChange(hsvToHex(Number(event.target.value), hsv.saturation, hsv.value))}
            type='range'
            value={Math.round(hsv.hue)}
          />
        </label>
        <div className='grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground'>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.hue)}</strong> H</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.saturation * 100)}</strong> S</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.value * 100)}</strong> V</span>
        </div>
      </div>
      <label className='grid grid-cols-[52px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
        <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>OKLCH</span>
        <input
          aria-label={`${ariaLabel} OKLCH`}
          className='h-9 min-w-0 bg-transparent pr-2 font-mono text-[10px] outline-none'
          defaultValue={oklch}
          key={oklch}
          onBlur={(event) => commitOklch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      {opacity === undefined || !onOpacityChange ? null : (
        <input
          aria-label={`${ariaLabel} opacity`}
          className='studio-range'
          max={100}
          min={0}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
          type='range'
          value={opacity}
        />
      )}
    </div>
  );
}
