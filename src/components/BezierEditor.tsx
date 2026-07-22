'use client';

import { T } from 'gt-next';

import type { CubicBezier } from '@/lib/animation';

type BezierEditorProps = {
  curve: CubicBezier;
  onChange: (curve: CubicBezier) => void;
};

export default function BezierEditor({ curve, onChange }: BezierEditorProps) {
  const [x1, y1, x2, y2] = curve;
  const path = `M 12 108 C ${12 + x1 * 96} ${108 - y1 * 96}, ${12 + x2 * 96} ${108 - y2 * 96}, 108 12`;

  function update(index: number, value: number) {
    const next = [...curve] as [number, number, number, number];
    next[index] = value;
    onChange(next);
  }

  return (
    <div className='flex flex-col gap-3 border-t border-border pt-4'>
      <div className='flex items-center justify-between gap-4'>
        <span className='text-sm font-medium'>
          <T>Cubic bezier</T>
        </span>
        <code className='font-mono text-xs text-muted-foreground'>
          {curve.map((value) => value.toFixed(2)).join(', ')}
        </code>
      </div>
      <div className='grid grid-cols-[120px_1fr] gap-4'>
        <svg
          aria-label='Cubic bezier preview'
          className='size-[120px] border border-border bg-background'
          viewBox='0 0 120 120'
        >
          <path d='M12 108H108M12 108V12' fill='none' stroke='var(--color-border)' />
          <path d={path} fill='none' stroke='currentColor' strokeWidth='3' />
          <circle cx={12 + x1 * 96} cy={108 - y1 * 96} r='3.5' fill='currentColor' />
          <circle cx={12 + x2 * 96} cy={108 - y2 * 96} r='3.5' fill='currentColor' />
        </svg>
        <div className='grid grid-cols-2 gap-2'>
          {curve.map((value, index) => (
            <label className='flex flex-col gap-1 font-mono text-xs' key={index}>
              <span className='text-muted-foreground'>{['X1', 'Y1', 'X2', 'Y2'][index]}</span>
              <input
                className='h-9 border border-input bg-background px-2 tabular-nums outline-none focus:border-foreground'
                max={index % 2 === 0 ? 1 : 2}
                min={index % 2 === 0 ? 0 : -1}
                onChange={(event) => update(index, Number(event.target.value))}
                step='0.01'
                type='number'
                value={value}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
