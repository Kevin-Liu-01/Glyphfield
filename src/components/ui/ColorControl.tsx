'use client';

import type { ReactNode } from 'react';

import { formatOklch, normalizeHex, oklchToHex, parseOklch } from '@/lib/color';

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
  const hex = safeHex(value);
  const oklch = formatOklch(hex);

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

  return (
    <div className='flex flex-col gap-2.5 rounded-md border border-border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs font-semibold text-foreground'>{label}</span>
        {opacity === undefined ? null : (
          <output className='font-mono text-[10px] text-muted-foreground'>{opacity}%</output>
        )}
      </div>
      <div className='grid grid-cols-[38px_1fr] gap-2'>
        <label
          className='relative grid size-[38px] cursor-pointer place-items-center overflow-hidden rounded-md border border-input'
          style={{ backgroundColor: hex }}
        >
          <span className='sr-only'>{ariaLabel}</span>
          <input
            aria-label={ariaLabel}
            className='absolute inset-0 cursor-pointer opacity-0'
            onChange={(event) => onChange(event.target.value.toLocaleUpperCase())}
            type='color'
            value={hex}
          />
        </label>
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
