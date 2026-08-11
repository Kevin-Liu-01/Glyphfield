'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

export type CanvasSmartGuides = {
  x: number | null;
  y: number | null;
};

export type CanvasSnapTargets = {
  x: readonly number[];
  y: readonly number[];
};

type PointerSession = {
  moved: boolean;
  mode: 'move' | 'resize';
  pointerId: number;
  startSelected: boolean;
  startClientX: number;
  startClientY: number;
  startScale: number;
  startX: number;
  startY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shouldDeselectCanvasLayer(
  eventType: string,
  mode: PointerSession['mode'],
  startSelected: boolean,
  moved: boolean
): boolean {
  return eventType === 'pointerup' && mode === 'move' && startSelected && !moved;
}

function nearestSnap(
  anchors: readonly number[],
  targets: readonly number[],
  threshold: number
): { delta: number; guide: number } | null {
  let nearest: { delta: number; guide: number } | null = null;

  targets.forEach((target) => {
    anchors.forEach((anchor) => {
      const delta = target - anchor;
      if (Math.abs(delta) > threshold) return;
      if (!nearest || Math.abs(delta) < Math.abs(nearest.delta)) {
        nearest = { delta, guide: target };
      }
    });
  });

  return nearest;
}

export function snapCanvasLayer(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry,
  targets: CanvasSnapTargets,
  thresholdX: number,
  thresholdY: number
): { guides: CanvasSmartGuides; transform: CanvasLayerTransform } {
  const scaledWidth = geometry.baseWidth * transform.scale;
  const scaledHeight = geometry.baseHeight * transform.scale;
  const centerX = geometry.baseX + geometry.baseWidth / 2 + transform.x;
  const centerY = geometry.baseY + geometry.baseHeight / 2 + transform.y;
  const xSnap = nearestSnap(
    [centerX - scaledWidth / 2, centerX, centerX + scaledWidth / 2],
    targets.x,
    thresholdX
  );
  const ySnap = nearestSnap(
    [centerY - scaledHeight / 2, centerY, centerY + scaledHeight / 2],
    targets.y,
    thresholdY
  );

  return {
    guides: {
      x: xSnap?.guide ?? null,
      y: ySnap?.guide ?? null,
    },
    transform: {
      ...transform,
      x: transform.x + (xSnap?.delta ?? 0),
      y: transform.y + (ySnap?.delta ?? 0),
    },
  };
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
  onDeselect,
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
  onDeselect: () => void;
  onSelect: () => void;
  selected: boolean;
  transform: CanvasLayerTransform;
  zIndex: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const [smartGuides, setSmartGuides] = useState<CanvasSmartGuides>({ x: null, y: null });

  function beginPointer(event: ReactPointerEvent<HTMLElement>, mode: PointerSession['mode']) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect();
    setSmartGuides({ x: null, y: null });
    sessionRef.current = {
      moved: false,
      mode,
      pointerId: event.pointerId,
      startSelected: selected,
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
    if (Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY) > 3) {
      session.moved = true;
    }
    const deltaX = ((event.clientX - session.startClientX) / bounds.width) * canvasWidth;
    const deltaY = ((event.clientY - session.startClientY) / bounds.height) * canvasHeight;

    if (session.mode === 'resize') {
      const scaleDelta = (deltaX + deltaY) / Math.max(baseWidth, baseHeight);
      onChange({ ...transform, scale: clamp(session.startScale + scaleDelta, 0.2, 3) });
      return;
    }

    const proposedTransform = {
      scale: session.startScale,
      x: clamp(session.startX + deltaX, -canvasWidth, canvasWidth),
      y: clamp(session.startY + deltaY, -canvasHeight, canvasHeight),
    };
    const targetX = [0, canvasWidth / 2, canvasWidth];
    const targetY = [0, canvasHeight / 2, canvasHeight];

    Array.from(parent.children).forEach((sibling) => {
      if (!(sibling instanceof HTMLElement) || sibling === layer || !sibling.classList.contains('editable-canvas-layer')) return;
      const siblingBounds = sibling.getBoundingClientRect();
      const left = (siblingBounds.left - bounds.left) / bounds.width * canvasWidth;
      const right = (siblingBounds.right - bounds.left) / bounds.width * canvasWidth;
      const top = (siblingBounds.top - bounds.top) / bounds.height * canvasHeight;
      const bottom = (siblingBounds.bottom - bounds.top) / bounds.height * canvasHeight;
      targetX.push(left, (left + right) / 2, right);
      targetY.push(top, (top + bottom) / 2, bottom);
    });

    const snapped = snapCanvasLayer(
      proposedTransform,
      { baseHeight, baseWidth, baseX, baseY },
      { x: targetX, y: targetY },
      6 / bounds.width * canvasWidth,
      6 / bounds.height * canvasHeight
    );
    setSmartGuides(snapped.guides);
    onChange(snapped.transform);
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    setSmartGuides({ x: null, y: null });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (shouldDeselectCanvasLayer(event.type, session.mode, session.startSelected, session.moved)) {
      onDeselect();
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
  const guideHost = layerRef.current?.parentElement ?? null;

  return (
    <>
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
      {guideHost && (smartGuides.x !== null || smartGuides.y !== null) ? createPortal(
        <>
          {smartGuides.x !== null ? (
            <span
              aria-hidden='true'
              className='canvas-smart-guide canvas-smart-guide--vertical'
              style={{ left: `${smartGuides.x / canvasWidth * 100}%` }}
            />
          ) : null}
          {smartGuides.y !== null ? (
            <span
              aria-hidden='true'
              className='canvas-smart-guide canvas-smart-guide--horizontal'
              style={{ top: `${smartGuides.y / canvasHeight * 100}%` }}
            />
          ) : null}
        </>,
        guideHost
      ) : null}
    </>
  );
}
