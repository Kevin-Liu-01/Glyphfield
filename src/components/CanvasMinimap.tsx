'use client';

import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { useGT } from 'gt-next';
import { Minus, PanelsTopLeft } from '@/components/ui/SolidIcons';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { canvasMinimapBounds, canvasMinimapPoint, canvasVisibleRect, centerCanvasNavigation,
  validCanvasNavigationRect, type CanvasNavigationItem, type CanvasNavigationRect, type CanvasNavigationView } from '@/lib/canvasNavigation';
import styles from './CanvasMinimap.module.css';

export type CanvasMinimapHandle = { updateView: (view: CanvasNavigationView) => void };
type Drag = { pointerId: number; bounds: CanvasNavigationRect; screen: CanvasNavigationRect;
  offset: { x: number; y: number }; point?: { x: number; y: number } };

/** Geometry only: no cloned artboards, shader canvases, image decoding or polling. */
export default function CanvasMinimap({ items, view, onPan, onFitAll, onCenterSelected, ref }: {
  items: readonly CanvasNavigationItem[];
  view: CanvasNavigationView;
  onPan: (pan: { x: number; y: number }, commit: boolean) => void;
  onFitAll: () => void;
  onCenterSelected: () => void;
  ref?: Ref<CanvasMinimapHandle>;
}) {
  const gt = useGT();
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const compact = view.height < 300;
  const open = openOverride ?? !compact;
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGRectElement>(null);
  const itemsRef = useCommittedRef(items);
  const onPanRef = useCommittedRef(onPan);
  const viewRef = useRef(view);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef(0);
  const boundsRef = useRef(canvasMinimapBounds(items, view));

  const paint = useCallback(() => {
    const bounds = dragRef.current?.bounds ?? canvasMinimapBounds(itemsRef.current, viewRef.current);
    boundsRef.current = bounds;
    svgRef.current?.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    const visible = canvasVisibleRect(viewRef.current);
    for (const [attribute, value] of Object.entries(visible)) viewportRef.current?.setAttribute(attribute, String(value));
    const centerX = visible.x + visible.width / 2;
    svgRef.current?.setAttribute('aria-valuemin', String(Math.floor(bounds.x)));
    svgRef.current?.setAttribute('aria-valuemax', String(Math.ceil(bounds.x + bounds.width)));
    svgRef.current?.setAttribute('aria-valuenow', String(Math.round(Math.max(bounds.x, Math.min(bounds.x + bounds.width, centerX)))));
    svgRef.current?.setAttribute('aria-valuetext', `X ${Math.round(centerX)}, Y ${Math.round(visible.y + visible.height / 2)}`);
  }, [itemsRef]);

  useImperativeHandle(ref, () => ({ updateView: (next) => { viewRef.current = next; paint(); } }), [paint]);
  useLayoutEffect(() => { if (!dragRef.current) viewRef.current = view; paint(); }, [paint, view]);
  useLayoutEffect(paint, [items, open, paint]);

  const move = useCallback((point: { x: number; y: number }) => {
    const drag = dragRef.current;
    if (!drag) return;
    const world = canvasMinimapPoint(point, drag.screen, drag.bounds);
    const pan = centerCanvasNavigation(viewRef.current, { x: world.x - drag.offset.x, y: world.y - drag.offset.y });
    viewRef.current = { ...viewRef.current, pan };
    paint();
    onPanRef.current(pan, false);
  }, [onPanRef, paint]);

  const finish = useCallback((point?: { x: number; y: number }) => {
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (point ?? drag.point) move((point ?? drag.point)!);
    dragRef.current = null;
    svgRef.current?.removeAttribute('data-dragging');
    if (svgRef.current?.hasPointerCapture?.(drag.pointerId)) svgRef.current.releasePointerCapture(drag.pointerId);
    onPanRef.current(viewRef.current.pan, true);
    paint();
  }, [move, onPanRef, paint]);

  useLayoutEffect(() => { if (!open) finish(); }, [finish, open]);

  useMountEffect(() => {
    const end = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      finish(event.type === 'pointerup' ? { x: event.clientX, y: event.clientY } : undefined);
    };
    const blur = () => finish();
    const hidden = () => { if (document.hidden) finish(); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frameRef.current);
      dragRef.current = null;
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    };
  });

  return <aside role='region' aria-label={gt('Canvas map')} className={styles.panel} data-canvas-selection-preserve
    data-compact={compact ? 'true' : undefined} data-collapsed={!open ? 'true' : undefined}>
    <button className={styles.toggle} type='button' aria-expanded={open}
      aria-label={gt(open ? 'Hide artboard map' : 'Show artboard map')}
      onClick={() => { finish(); setOpenOverride(!open); }}>
      <span>{gt('Artboard map')}</span>{open ? <Minus aria-hidden='true' /> : <PanelsTopLeft aria-hidden='true' />}
    </button>
    {open && <>
      <svg className={styles.map} ref={svgRef} tabIndex={0} role='slider' aria-label={gt('Navigate canvas map')}
        aria-description={gt('Click or drag to pan the canvas. Arrow keys move the visible area.')}
        preserveAspectRatio='xMidYMid meet'
        onKeyDown={(event) => {
          const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!delta) return;
          event.preventDefault();
          const current = viewRef.current;
          onPanRef.current({ x: current.pan.x - delta[0] * current.width * 0.15,
            y: current.pan.y - delta[1] * current.height * 0.15 }, true);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || dragRef.current) return;
          event.preventDefault();
          event.currentTarget.focus();
          const screen = event.currentTarget.getBoundingClientRect();
          const bounds = boundsRef.current;
          const point = { x: event.clientX, y: event.clientY };
          const world = canvasMinimapPoint(point, screen, bounds);
          const visible = canvasVisibleRect(viewRef.current);
          const grabbedViewport = event.target === viewportRef.current;
          dragRef.current = { pointerId: event.pointerId, bounds: { ...bounds },
            screen: { x: screen.x, y: screen.y, width: screen.width, height: screen.height },
            offset: grabbedViewport ? { x: world.x - visible.x - visible.width / 2,
              y: world.y - visible.y - visible.height / 2 } : { x: 0, y: 0 } };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.currentTarget.setAttribute('data-dragging', 'true');
          move(point);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag?.pointerId !== event.pointerId) return;
          drag.point = { x: event.clientX, y: event.clientY };
          if (!frameRef.current) frameRef.current = requestAnimationFrame(() => {
            frameRef.current = 0;
            if (dragRef.current?.point) move(dragRef.current.point);
          });
        }}
        onLostPointerCapture={(event) => { if (dragRef.current?.pointerId === event.pointerId) finish(); }}>
        {items.filter(validCanvasNavigationRect).map((item) => <rect key={item.id} className={styles.board}
          data-active={item.active ? 'true' : undefined} data-canvas-map-item={item.id}
          x={item.x} y={item.y} width={item.width} height={item.height} vectorEffect='non-scaling-stroke'>
          <title>{item.label}</title>
        </rect>)}
        <rect className={styles.viewport} data-canvas-map-viewport ref={viewportRef} vectorEffect='non-scaling-stroke'>
          <title>{gt('Current viewport')}</title>
        </rect>
      </svg>
      <div className={styles.actions}>
        <button type='button' onClick={onFitAll}>{gt('Fit all')}</button>
        <button type='button' aria-label={gt('Center selected artboard')} disabled={!items.some((item) => item.active)} onClick={onCenterSelected}>{gt('Center selected')}</button>
      </div>
    </>}
  </aside>;
}
