'use client';

import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { MoveDiagonal2 } from 'lucide-react';

export type CanvasLayerTransform = {
  scale: number;
  x: number;
  y: number;
};

export type CanvasLayerAlignment =
  | 'left'
  | 'horizontal-center'
  | 'right'
  | 'top'
  | 'vertical-center'
  | 'bottom';

export type CanvasLayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

type PointerSession = {
  mode: 'move' | 'resize';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScale: number;
  startX: number;
  startY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function alignCanvasLayer(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry,
  canvasWidth: number,
  canvasHeight: number,
  alignment: CanvasLayerAlignment
): CanvasLayerTransform {
  const scaledWidth = geometry.baseWidth * transform.scale;
  const scaledHeight = geometry.baseHeight * transform.scale;
  const centerX = geometry.baseX + geometry.baseWidth / 2;
  const centerY = geometry.baseY + geometry.baseHeight / 2;

  if (alignment === 'left') {
    return { ...transform, x: scaledWidth / 2 - centerX };
  }
  if (alignment === 'horizontal-center') {
    return { ...transform, x: canvasWidth / 2 - centerX };
  }
  if (alignment === 'right') {
    return { ...transform, x: canvasWidth - scaledWidth / 2 - centerX };
  }
  if (alignment === 'top') {
    return { ...transform, y: scaledHeight / 2 - centerY };
  }
  if (alignment === 'vertical-center') {
    return { ...transform, y: canvasHeight / 2 - centerY };
  }
  return { ...transform, y: canvasHeight - scaledHeight / 2 - centerY };
}

export default function EditableCanvasLayer({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  canvasHeight,
  canvasWidth,
  children,
  className = '',
  label,
  onChange,
  onSelect,
  selected,
  transform,
  zIndex,
}: {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
  canvasHeight: number;
  canvasWidth: number;
  children: ReactNode;
  className?: string;
  label: string;
  onChange: (transform: CanvasLayerTransform) => void;
  onSelect: () => void;
  selected: boolean;
  transform: CanvasLayerTransform;
  zIndex: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);

  function beginPointer(event: ReactPointerEvent<HTMLElement>, mode: PointerSession['mode']) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect();
    sessionRef.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScale: transform.scale,
      startX: transform.x,
      startY: transform.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const session = sessionRef.current;
    const layer = layerRef.current;
    const parent = layer?.parentElement;
    if (!session || !parent || session.pointerId !== event.pointerId) return;
    const bounds = parent.getBoundingClientRect();
    const deltaX = ((event.clientX - session.startClientX) / bounds.width) * canvasWidth;
    const deltaY = ((event.clientY - session.startClientY) / bounds.height) * canvasHeight;

    if (session.mode === 'resize') {
      const scaleDelta = (deltaX + deltaY) / Math.max(baseWidth, baseHeight);
      onChange({ ...transform, scale: clamp(session.startScale + scaleDelta, 0.2, 3) });
      return;
    }

    onChange({
      ...transform,
      x: clamp(session.startX + deltaX, -canvasWidth, canvasWidth),
      y: clamp(session.startY + deltaY, -canvasHeight, canvasHeight),
    });
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') onChange({ ...transform, x: transform.x - step });
    else if (event.key === 'ArrowRight') onChange({ ...transform, x: transform.x + step });
    else if (event.key === 'ArrowUp') onChange({ ...transform, y: transform.y - step });
    else if (event.key === 'ArrowDown') onChange({ ...transform, y: transform.y + step });
    else return;
    event.preventDefault();
  }

  const style: CSSProperties = {
    height: `${(baseHeight / canvasHeight) * 100}%`,
    left: `${((baseX + transform.x) / canvasWidth) * 100}%`,
    top: `${((baseY + transform.y) / canvasHeight) * 100}%`,
    transform: `scale(${transform.scale})`,
    transformOrigin: 'center',
    width: `${(baseWidth / canvasWidth) * 100}%`,
    zIndex,
  };

  return (
    <div
      aria-label={label}
      aria-selected={selected}
      className={`editable-canvas-layer ${className}`}
      onKeyDown={handleKeyDown}
      onPointerCancel={endPointer}
      onPointerDown={(event) => beginPointer(event, 'move')}
      onPointerMove={updatePointer}
      onPointerUp={endPointer}
      ref={layerRef}
      role='button'
      style={style}
      tabIndex={selected ? 0 : -1}
    >
      <div className='editable-canvas-layer-content'>{children}</div>
      {selected ? (
        <>
          <span aria-hidden='true' className='editable-canvas-layer-name'>{label}</span>
          <span
            aria-label={`Resize ${label}`}
            className='editable-canvas-layer-resize'
            onPointerDown={(event) => beginPointer(event, 'resize')}
            role='button'
          >
            <MoveDiagonal2 aria-hidden='true' />
          </span>
        </>
      ) : null}
    </div>
  );
}
