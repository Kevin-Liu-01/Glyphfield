import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type SelectionRect = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

export function canvasSelectionLocalBounds(bounds: SelectionRect, viewport: HTMLElement): SelectionRect {
  const origin = viewport.getBoundingClientRect();
  const scaleX = viewport.offsetWidth ? origin.width / viewport.offsetWidth : 1;
  const scaleY = viewport.offsetHeight ? origin.height / viewport.offsetHeight : 1;
  return {
    height: bounds.height / (scaleY || 1),
    left: (bounds.left - origin.left) / (scaleX || 1) - viewport.clientLeft,
    top: (bounds.top - origin.top) / (scaleY || 1) - viewport.clientTop,
    width: bounds.width / (scaleX || 1),
  };
}

export default function CanvasSelectionClip({ children, viewport }: {
  children: ReactNode;
  viewport: HTMLElement;
}) {
  // Outside the zoomed stage, but inside the canvas stacking/clipping boundary.
  return createPortal(
    <div className='canvas-selection-clip pointer-events-none absolute inset-0 z-20 overflow-hidden'>
      {children}
    </div>,
    viewport
  );
}
