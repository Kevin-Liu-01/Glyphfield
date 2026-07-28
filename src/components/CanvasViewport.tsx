'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Maximize2, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  clampCanvasZoom,
  resolveZoomedScrollPosition,
} from '@/lib/canvasViewport';

export default function CanvasViewport({
  children,
  className = '',
  draftKey = 'canvas-zoom',
  fontFamily,
  fontWeight,
  identityId,
  onDeselect,
  stageClassName = '',
  toolId,
}: {
  children: ReactNode;
  className?: string;
  draftKey?: string;
  fontFamily?: CSSProperties['fontFamily'];
  fontWeight?: CSSProperties['fontWeight'];
  identityId: string;
  onDeselect?: () => void;
  stageClassName?: string;
  toolId: string;
}) {
  const gt = useGT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [zoom, setZoom] = useStudioDraft(identityId, toolId, draftKey, 100);
  useCanvasSelectionDismiss(viewportRef, onDeselect);

  function changeZoom(value: number, point?: { x: number; y: number }) {
    const nextZoom = clampCanvasZoom(value);
    const scrollElement = scrollRef.current;
    if (!scrollElement || nextZoom === zoom) return;
    const anchor = point ?? {
      x: scrollElement.clientWidth / 2,
      y: scrollElement.clientHeight / 2,
    };
    const nextScroll = resolveZoomedScrollPosition({
      currentZoom: zoom,
      nextZoom,
      pointX: anchor.x,
      pointY: anchor.y,
      scrollLeft: scrollElement.scrollLeft,
      scrollTop: scrollElement.scrollTop,
    });
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      scrollElement.scrollTo(nextScroll);
    });
  }

  function fitCanvas() {
    const scrollElement = scrollRef.current;
    const stageElement = stageRef.current;
    if (!scrollElement || !stageElement) return;
    const scale = zoom / 100;
    const fittedZoom = Math.min(
      100,
      scrollElement.clientWidth / Math.max(1, stageElement.scrollWidth / scale) * 100,
      scrollElement.clientHeight / Math.max(1, stageElement.scrollHeight / scale) * 100
    );
    changeZoom(fittedZoom);
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
        <Button aria-label={gt('Zoom out')} disabled={zoom <= 40} onClick={() => changeZoom(zoom - 10)} size='icon-sm' title={gt('Zoom out')} type='button' variant='ghost'>
          <Minus aria-hidden='true' />
        </Button>
        <label className='canvas-zoom-range'>
          <span className='sr-only'><T>Canvas zoom</T></span>
          <input max={200} min={40} onChange={(event) => changeZoom(Number(event.target.value))} step={5} type='range' value={zoom} />
        </label>
        <button className='canvas-zoom-value' onClick={() => changeZoom(100)} title={gt('Reset to 100%')} type='button'>{zoom}%</button>
        <Button aria-label={gt('Zoom in')} disabled={zoom >= 200} onClick={() => changeZoom(zoom + 10)} size='icon-sm' title={gt('Zoom in')} type='button' variant='ghost'>
          <Plus aria-hidden='true' />
        </Button>
        <span className='canvas-toolbar-divider' />
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
            startScrollLeft: event.currentTarget.scrollLeft,
            startScrollTop: event.currentTarget.scrollTop,
            startX: event.clientX,
            startY: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.setAttribute('data-panning', 'true');
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (!pan || pan.pointerId !== event.pointerId) return;
          event.preventDefault();
          event.currentTarget.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startX);
          event.currentTarget.scrollTop = pan.startScrollTop - (event.clientY - pan.startY);
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
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          changeZoom(zoom + (event.deltaY < 0 ? 10 : -10), {
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
            '--canvas-zoom': zoom / 100,
            fontFamily,
            fontWeight,
          } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
