'use client';

import { MoveDiagonal2 } from '@/components/ui/SolidIcons';
import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

type ResizeMode = 'width' | 'height' | 'both';

type ResizeSession = {
  boundsHeight: number;
  boundsWidth: number;
  mode: ResizeMode;
  pointerId: number;
  startHeight: number;
  startWidth: number;
  startX: number;
  startY: number;
};

function clampDimension(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value / 10) * 10));
}

export default function CanvasDimensionHandles({
  canvasRef,
  height,
  onChange,
  width,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  height: number;
  onChange: (dimensions: { height: number; width: number }) => void;
  width: number;
}) {
  const sessionRef = useRef<ResizeSession | null>(null);
  const [resizing, setResizing] = useState(false);

  function beginResize(event: ReactPointerEvent<HTMLElement>, mode: ResizeMode) {
    if (event.button !== 0) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      boundsHeight: bounds.height,
      boundsWidth: bounds.width,
      mode,
      pointerId: event.pointerId,
      startHeight: height,
      startWidth: width,
      startX: event.clientX,
      startY: event.clientY,
    };
    setResizing(true);
  }

  function updateResize(event: ReactPointerEvent<HTMLElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaWidth = ((event.clientX - session.startX) / session.boundsWidth) * session.startWidth;
    const deltaHeight = ((event.clientY - session.startY) / session.boundsHeight) * session.startHeight;
    let nextWidth = session.mode === 'height' ? session.startWidth : session.startWidth + deltaWidth;
    let nextHeight = session.mode === 'width' ? session.startHeight : session.startHeight + deltaHeight;

    if (session.mode === 'both' && event.shiftKey) {
      const widthScale = nextWidth / session.startWidth;
      const heightScale = nextHeight / session.startHeight;
      const scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
        ? widthScale
        : heightScale;
      nextWidth = session.startWidth * scale;
      nextHeight = session.startHeight * scale;
    }

    onChange({
      height: clampDimension(nextHeight, 120, 2400),
      width: clampDimension(nextWidth, 120, 3200),
    });
  }

  function endResize(event: ReactPointerEvent<HTMLElement>) {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLElement>, mode: ResizeMode) {
    const step = event.shiftKey ? 100 : 10;
    let delta = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') delta = step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') delta = -step;
    else return;
    event.preventDefault();
    event.stopPropagation();
    onChange({
      height: clampDimension(mode === 'width' ? height : height + delta, 120, 2400),
      width: clampDimension(mode === 'height' ? width : width + delta, 120, 3200),
    });
  }

  const sharedHandlers = (mode: ResizeMode) => ({
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => resizeWithKeyboard(event, mode),
    onPointerCancel: endResize,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginResize(event, mode),
    onPointerMove: updateResize,
    onPointerUp: endResize,
  });

  return (
    <div className='canvas-dimension-handles' data-resizing={resizing ? 'true' : 'false'}>
      <span
        aria-label='Resize animation width'
        aria-orientation='vertical'
        aria-valuemax={3200}
        aria-valuemin={120}
        aria-valuenow={width}
        className='canvas-dimension-handle canvas-dimension-handle-width'
        role='separator'
        tabIndex={0}
        {...sharedHandlers('width')}
      />
      <span
        aria-label='Resize animation height'
        aria-orientation='horizontal'
        aria-valuemax={2400}
        aria-valuemin={120}
        aria-valuenow={height}
        className='canvas-dimension-handle canvas-dimension-handle-height'
        role='separator'
        tabIndex={0}
        {...sharedHandlers('height')}
      />
      <button
        aria-label='Resize animation canvas'
        className='canvas-dimension-handle canvas-dimension-handle-corner'
        title='Drag to resize canvas. Hold Shift to preserve its aspect ratio.'
        type='button'
        {...sharedHandlers('both')}
      >
        <MoveDiagonal2 aria-hidden='true' />
      </button>
      {resizing ? (
        <output className='canvas-dimension-readout' aria-live='polite'>
          {width} × {height}
        </output>
      ) : null}
    </div>
  );
}
