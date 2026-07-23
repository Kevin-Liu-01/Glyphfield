'use client';

import type { KeyboardEvent, PointerEvent } from 'react';
import { T } from 'gt-next';

import {
  clamp,
  type CubicBezier,
  resolveBezierControlPoint,
} from '@/lib/animation';

type BezierEditorProps = {
  curve: CubicBezier;
  onChange: (curve: CubicBezier) => void;
};

export default function BezierEditor({ curve, onChange }: BezierEditorProps) {
  const [x1, y1, x2, y2] = curve;
  const path = `M 12 108 C ${12 + x1 * 96} ${108 - y1 * 96}, ${12 + x2 * 96} ${108 - y2 * 96}, 108 12`;
  const controlPoints = [
    { x: x1, xIndex: 0, y: y1, yIndex: 1 },
    { x: x2, xIndex: 2, y: y2, yIndex: 3 },
  ] as const;

  function update(index: number, value: number) {
    const next = [...curve] as [number, number, number, number];
    next[index] = value;
    onChange(next);
  }

  function updateControlPoint(
    xIndex: number,
    yIndex: number,
    x: number,
    y: number
  ) {
    const next = [...curve] as [number, number, number, number];
    next[xIndex] = x;
    next[yIndex] = y;
    onChange(next);
  }

  function updateFromPointer(
    xIndex: number,
    yIndex: number,
    event: PointerEvent<SVGGElement>
  ) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const [x, y] = resolveBezierControlPoint(
      (event.clientX - bounds.left) / bounds.width,
      (event.clientY - bounds.top) / bounds.height
    );
    updateControlPoint(xIndex, yIndex, x, y);
  }

  function handleKeyDown(
    xIndex: number,
    yIndex: number,
    event: KeyboardEvent<SVGGElement>
  ) {
    const step = event.shiftKey ? 0.1 : 0.01;
    let nextX = curve[xIndex] ?? 0;
    let nextY = curve[yIndex] ?? 0;
    if (event.key === 'ArrowLeft') nextX -= step;
    else if (event.key === 'ArrowRight') nextX += step;
    else if (event.key === 'ArrowUp') nextY += step;
    else if (event.key === 'ArrowDown') nextY -= step;
    else return;
    event.preventDefault();
    updateControlPoint(
      xIndex,
      yIndex,
      clamp(nextX, 0, 1),
      clamp(nextY, -1, 2)
    );
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
          <path
            d={`M12 108L${12 + x1 * 96} ${108 - y1 * 96}M108 12L${12 + x2 * 96} ${108 - y2 * 96}`}
            fill='none'
            opacity='0.45'
            stroke='currentColor'
            strokeDasharray='2 3'
            strokeWidth='1'
          />
          <path d={path} fill='none' stroke='currentColor' strokeWidth='3' />
          {controlPoints.map(({ x, xIndex, y, yIndex }, index) => (
            <g
              aria-label={`${index === 0 ? 'First' : 'Second'} control point. Use arrow keys to adjust.`}
              className='group cursor-grab touch-none outline-none active:cursor-grabbing'
              key={xIndex}
              onKeyDown={(event) => handleKeyDown(xIndex, yIndex, event)}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                updateFromPointer(xIndex, yIndex, event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  updateFromPointer(xIndex, yIndex, event);
                }
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              tabIndex={0}
            >
              <circle
                cx={12 + x * 96}
                cy={108 - y * 96}
                fill='transparent'
                r='10'
              />
              <circle
                className='fill-foreground stroke-background group-focus-visible:stroke-2'
                cx={12 + x * 96}
                cy={108 - y * 96}
                pointerEvents='none'
                r='4.5'
                strokeWidth='2'
              />
            </g>
          ))}
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
