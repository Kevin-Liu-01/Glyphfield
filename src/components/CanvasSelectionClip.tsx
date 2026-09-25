import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type SelectionRect = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

/** Cache layout once; subsequent viewport transforms only need matrix arithmetic. */
export function trackCanvasSelectionNavigation(bounds: SelectionRect, viewport: HTMLElement, stage: HTMLElement | null) {
  if (!stage || typeof DOMMatrix === 'undefined') return null;
  const initial = new DOMMatrix(stage.style.transform);
  const origin = canvasSelectionLocalBounds(stage.getBoundingClientRect(), viewport);
  return () => {
    const next = new DOMMatrix(stage.style.transform);
    const scale = next.a / (initial.a || 1);
    return {
      left: origin.left + next.e - initial.e + (bounds.left - origin.left) * scale,
      top: origin.top + next.f - initial.f + (bounds.top - origin.top) * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    };
  };
}

export function paintCanvasSelectionBounds(overlay: HTMLElement, bounds: SelectionRect) {
  overlay.style.height = `${bounds.height}px`;
  overlay.style.left = `${bounds.left}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${bounds.width}px`;
}

export function canvasSelectionLocalBounds(bounds: SelectionRect, viewport: HTMLElement): SelectionRect {
  return canvasSelectionProjector(viewport)(bounds);
}

/** A pointer session keeps the same viewport; reuse its coordinate conversion. */
export function canvasSelectionProjector(viewport: HTMLElement) {
  const origin = viewport.getBoundingClientRect();
  const scaleX = viewport.offsetWidth ? origin.width / viewport.offsetWidth : 1;
  const scaleY = viewport.offsetHeight ? origin.height / viewport.offsetHeight : 1;
  const borderX = viewport.clientLeft;
  const borderY = viewport.clientTop;
  return (bounds: SelectionRect): SelectionRect => ({
    height: bounds.height / (scaleY || 1),
    left: (bounds.left - origin.left) / (scaleX || 1) - borderX,
    top: (bounds.top - origin.top) / (scaleY || 1) - borderY,
    width: bounds.width / (scaleX || 1),
  });
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
