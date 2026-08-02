'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { clampCanvasZoom } from '@/lib/canvasViewport';

export default function CanvasViewport({
  autoFit = false,
  children,
  className = '',
  draftKey = 'canvas-zoom',
  fontFamily,
  fontWeight,
  identityId,
  maxZoom = 200,
  onDeselect,
  stageClassName = '',
  toolId,
}: {
  autoFit?: boolean;
  children: ReactNode;
  className?: string;
  draftKey?: string;
  fontFamily?: CSSProperties['fontFamily'];
  fontWeight?: CSSProperties['fontWeight'];
  identityId: string;
  maxZoom?: number;
  onDeselect?: () => void;
  stageClassName?: string;
  toolId: string;
}) {
  const gt = useGT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wheelDeltaRef = useRef(0);
  const panRef = useRef<{
    pointerId: number;
    startPanX: number;
    startPanY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [zoom, setZoom] = useStudioDraft(identityId, toolId, draftKey, 100);
  const constrainedZoom = Math.min(zoom, maxZoom);
  const zoomRef = useRef(zoom);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  useCanvasSelectionDismiss(viewportRef, onDeselect);
  zoomRef.current = constrainedZoom;

  function changeZoom(value: number, point?: { x: number; y: number }) {
    const nextZoom = Math.min(Math.max(40, maxZoom), clampCanvasZoom(value));
    const scrollElement = scrollRef.current;
    const currentZoom = zoomRef.current;
    if (!scrollElement || nextZoom === currentZoom) return;
    const anchor = point ?? {
      x: scrollElement.clientWidth / 2,
      y: scrollElement.clientHeight / 2,
    };
    const ratio = nextZoom / Math.max(1, currentZoom);
    setPanOffset((current) => ({
      x: anchor.x - (anchor.x - current.x) * ratio,
      y: anchor.y - (anchor.y - current.y) * ratio,
    }));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }

  function fitCanvas() {
    const scrollElement = scrollRef.current;
    const stageElement = stageRef.current;
    if (!scrollElement || !stageElement) return;
    const fittedZoom = Math.min(
      100,
      scrollElement.clientWidth / Math.max(1, stageElement.scrollWidth) * 100,
      scrollElement.clientHeight / Math.max(1, stageElement.scrollHeight) * 100
    );
    changeZoom(fittedZoom);
    setPanOffset({ x: 0, y: 0 });
  }

  useMountEffect(() => {
    const scrollElement = scrollRef.current;
    let animationFrame = 0;

    function syncView() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (autoFit) fitCanvas();
        else if (zoomRef.current > maxZoom) changeZoom(maxZoom);
      });
    }

    syncView();
    if (!autoFit || !scrollElement || !('ResizeObserver' in window)) {
      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new ResizeObserver(syncView);
    observer.observe(scrollElement);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  });

  function resetView() {
    wheelDeltaRef.current = 0;
    zoomRef.current = 100;
    setZoom(100);
    setPanOffset({ x: 0, y: 0 });
  }

  return (
    <div
      className={`canvas-viewport ${className}`}
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (
          onDeselect &&
          target instanceof Element &&
          target.closest('.canvas-viewport-stage') &&
          !target.closest('.editable-canvas-layer')
        ) {
          onDeselect();
        }
      }}
      ref={viewportRef}
    >
      <div className='canvas-viewport-toolbar' data-canvas-selection-preserve role='group' aria-label={gt('Canvas zoom')}>
        <Button aria-label={gt('Zoom out')} disabled={constrainedZoom <= 40} onClick={() => changeZoom(constrainedZoom - 10)} size='icon-sm' title={gt('Zoom out')} type='button' variant='ghost'>
          <Minus aria-hidden='true' />
        </Button>
        <label className='canvas-zoom-range'>
          <span className='sr-only'><T>Canvas zoom</T></span>
          <input max={maxZoom} min={40} onChange={(event) => changeZoom(Number(event.target.value))} step={5} type='range' value={constrainedZoom} />
        </label>
        <button className='canvas-zoom-value' onClick={() => changeZoom(100)} title={gt('Reset to 100%')} type='button'>{constrainedZoom}%</button>
        <Button aria-label={gt('Zoom in')} disabled={constrainedZoom >= maxZoom} onClick={() => changeZoom(constrainedZoom + 10)} size='icon-sm' title={gt('Zoom in')} type='button' variant='ghost'>
          <Plus aria-hidden='true' />
        </Button>
        <span className='canvas-toolbar-divider' />
        <Button aria-label={gt('Reset view')} onClick={resetView} size='icon-sm' title={gt('Reset view')} type='button' variant='ghost'>
          <RotateCcw aria-hidden='true' />
        </Button>
        <Button aria-label={gt('Fit canvas')} onClick={fitCanvas} size='icon-sm' title={gt('Fit canvas')} type='button' variant='ghost'>
          <Maximize2 aria-hidden='true' />
        </Button>
      </div>
      <div
        className='canvas-viewport-scroll'
        onPointerCancel={(event) => {
          if (panRef.current?.pointerId !== event.pointerId) return;
          panRef.current = null;
          event.currentTarget.removeAttribute('data-panning');
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
          const target = event.target;
          if (
            target instanceof Element
            && target.closest('button, input, textarea, select, a, [contenteditable="true"], .editable-canvas-layer, [data-canvas-interactive]')
          ) return;
          panRef.current = {
            pointerId: event.pointerId,
            startPanX: panOffset.x,
            startPanY: panOffset.y,
            startX: event.clientX,
            startY: event.clientY,
          };
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.setAttribute('data-panning', 'true');
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (!pan || pan.pointerId !== event.pointerId) return;
          event.preventDefault();
          setPanOffset({
            x: pan.startPanX + event.clientX - pan.startX,
            y: pan.startPanY + event.clientY - pan.startY,
          });
        }}
        onPointerUp={(event) => {
          if (panRef.current?.pointerId !== event.pointerId) return;
          panRef.current = null;
          event.currentTarget.removeAttribute('data-panning');
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const deltaScale = event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? event.currentTarget.clientHeight
              : 1;
          const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * deltaScale;
          wheelDeltaRef.current += delta;
          const zoomSteps = Math.trunc(wheelDeltaRef.current / 40);
          if (zoomSteps === 0) return;
          wheelDeltaRef.current -= zoomSteps * 40;
          const bounds = event.currentTarget.getBoundingClientRect();
          changeZoom(zoomRef.current - zoomSteps * 5, {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
        }}
        ref={scrollRef}
      >
        <div
          className={`canvas-viewport-stage ${stageClassName}`}
          data-canvas-font={fontFamily ? 'enforced' : undefined}
          ref={stageRef}
          style={{
            '--canvas-selected-font': fontFamily,
            '--canvas-zoom': constrainedZoom / 100,
            fontFamily,
            fontWeight,
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${constrainedZoom / 100})`,
          } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
