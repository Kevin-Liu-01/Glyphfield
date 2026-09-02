'use client';

import type { HTMLAttributes, ReactNode } from 'react';

export type CanvasArtboardProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children: ReactNode;
  frameClassName?: string;
  height: number;
  width: number;
};

export default function CanvasArtboard({
  children,
  className = '',
  frameClassName = '',
  height,
  style,
  width,
  ...props
}: CanvasArtboardProps) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('Canvas artboard dimensions must be positive finite numbers.');
  }

  return (
    <div
      className={`canvas-artboard-frame ${frameClassName}`}
      data-canvas-height={height}
      data-canvas-width={width}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        {...props}
        className={`canvas-artboard-plane ${className}`}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
