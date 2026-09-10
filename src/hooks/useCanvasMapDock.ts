'use client';

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useMountEffect } from './useMountEffect';

type Point = { x: number; y: number };
type DockDrag = {
  pointerId: number;
  start: Point;
  point: Point;
  left: number;
  top: number;
  width: number;
  height: number;
  parentWidth: number;
  parentHeight: number;
  inset: number;
  moved: boolean;
};

/** UI-only docking: pointer movement never updates the canvas view or document. */
export function useCanvasMapDock(width: number, height: number, open: boolean) {
  const [dock, setDock] = useState<'left' | 'right'>('right');
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DockDrag | null>(null);
  const frameRef = useRef(0);

  const position = useCallback((drag: DockDrag) => {
    const maxX = Math.max(0, drag.parentWidth - drag.width);
    const maxY = Math.max(0, drag.parentHeight - drag.height);
    const insetX = Math.min(drag.inset, maxX / 2);
    const insetY = Math.min(drag.inset, maxY / 2);
    return {
      x: Math.max(insetX, Math.min(maxX - insetX, drag.left + drag.point.x - drag.start.x)),
      y: Math.max(insetY, Math.min(maxY - insetY, drag.top + drag.point.y - drag.start.y)),
    };
  }, []);

  const paint = useCallback(() => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    drag.moved ||= Math.hypot(drag.point.x - drag.start.x, drag.point.y - drag.start.y) >= 4;
    if (!drag.moved) return;
    const next = position(drag);
    panel.dataset.dragging = 'true';
    panel.style.transform = `translate3d(${next.x - drag.left}px, ${next.y - drag.top}px, 0)`;
  }, [position]);

  const finish = useCallback((commit = false, point?: Point) => {
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (point) drag.point = point;
    if (commit) {
      paint();
      if (drag.moved) setDock(position(drag).x + drag.width / 2 < drag.parentWidth / 2 ? 'left' : 'right');
    }
    dragRef.current = null;
    panelRef.current?.style.removeProperty('transform');
    panelRef.current?.removeAttribute('data-dragging');
    const handle = handleRef.current;
    if (handle?.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
  }, [paint, position]);

  // Resizing, folding, or hiding the workspace invalidates the gesture geometry.
  useLayoutEffect(() => { finish(); }, [width, height, open, finish]);
  useMountEffect(() => {
    const end = (event: globalThis.PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      finish(event.type === 'pointerup', { x: event.clientX, y: event.clientY });
    };
    const cancel = () => finish();
    const hidden = () => { if (document.hidden) finish(); };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      finish();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      finish();
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', hidden);
    };
  });

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || dragRef.current || event.isPrimary === false) return;
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    const bounds = panel.getBoundingClientRect();
    const area = parent.getBoundingClientRect();
    const point = { x: event.clientX, y: event.clientY };
    dragRef.current = { pointerId: event.pointerId, start: point, point,
      left: bounds.left - area.left, top: bounds.top - area.top, width: bounds.width, height: bounds.height,
      parentWidth: area.width, parentHeight: area.height,
      inset: Number.parseFloat(getComputedStyle(panel).getPropertyValue('--map-inset')) || 16, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    drag.point = { x: event.clientX, y: event.clientY };
    if (!frameRef.current) frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      paint();
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    finish();
    setDock(event.key === 'ArrowLeft' ? 'left' : 'right');
  };

  return { dock, panelRef, handleRef, handleProps: {
    onPointerDown, onPointerMove, onKeyDown,
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) finish();
    },
  } };
}
