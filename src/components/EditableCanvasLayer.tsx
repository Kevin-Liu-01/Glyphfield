'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoveDiagonal2 } from 'lucide-react';

export type CanvasLayerTransform = {
  heightScale?: number;
  scale: number;
  widthScale?: number;
  x: number;
  y: number;
};

export type CanvasLayerResizeMode = 'box' | 'scale';

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
  mode: 'move' | 'resize' | 'resize-bottom' | 'resize-left' | 'resize-right' | 'resize-top';
  pointerId: number;
  startSelected: boolean;
  startClientX: number;
  startClientY: number;
  startHeightScale: number;
  startScale: number;
  startWidthScale: number;
  startX: number;
  startY: number;
};

type SelectionBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
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

export function canvasLayerDimensions(
  transform: CanvasLayerTransform,
  geometry: Pick<CanvasLayerGeometry, 'baseHeight' | 'baseWidth'>
): { height: number; width: number } {
  return {
    height: geometry.baseHeight * (transform.heightScale ?? transform.scale),
    width: geometry.baseWidth * (transform.widthScale ?? transform.scale),
  };
}

export function snapCanvasLayer(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry,
  targets: CanvasSnapTargets,
  thresholdX: number,
  thresholdY: number
): { guides: CanvasSmartGuides; transform: CanvasLayerTransform } {
  const { height: scaledHeight, width: scaledWidth } = canvasLayerDimensions(transform, geometry);
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
  const { height: scaledHeight, width: scaledWidth } = canvasLayerDimensions(transform, geometry);
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
  allowContentInteraction = false,
  fitContentHeight = false,
  label,
  onChange,
  onDeselect,
  onSelect,
  resizeMode = 'scale',
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
  allowContentInteraction?: boolean;
  fitContentHeight?: boolean;
  label: string;
  onChange: (transform: CanvasLayerTransform) => void;
  onDeselect: () => void;
  onSelect: () => void;
  resizeMode?: CanvasLayerResizeMode;
  selected: boolean;
  transform: CanvasLayerTransform;
  zIndex: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds | null>(null);
  const [smartGuides, setSmartGuides] = useState<CanvasSmartGuides>({ x: null, y: null });
  const { height, width } = canvasLayerDimensions(transform, { baseHeight, baseWidth });

  useLayoutEffect(() => {
    if (!fitContentHeight) {
      setContentHeight(null);
      return;
    }
    const content = layerRef.current?.querySelector<HTMLElement>('.editable-canvas-layer-content > *');
    if (!content) return;
    const measure = () => setContentHeight(Math.ceil(Math.max(content.offsetHeight, content.scrollHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fitContentHeight, width]);

  useLayoutEffect(() => {
    if (!selected) {
      setSelectionBounds(null);
      return;
    }

    let frame = 0;
    const measure = () => {
      const bounds = layerRef.current?.getBoundingClientRect();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const next = {
          height: bounds.height,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
        };
        setSelectionBounds((current) => current
          && Math.abs(current.height - next.height) < 0.25
          && Math.abs(current.left - next.left) < 0.25
          && Math.abs(current.top - next.top) < 0.25
          && Math.abs(current.width - next.width) < 0.25
          ? current
          : next);
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => updatePointer(event.clientX, event.clientY, event.pointerId);
    const handlePointerEnd = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY, event.pointerId);
      endPointer(event.type, event.pointerId);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [baseHeight, baseWidth, baseX, baseY, canvasHeight, canvasWidth, onChange, onDeselect, transform]);

  function beginPointer(event: ReactPointerEvent<HTMLElement>, mode: PointerSession['mode']) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (
      mode === 'move'
      && allowContentInteraction
      && event.target instanceof HTMLElement
      && event.target.closest('[data-canvas-editable="true"]')
    ) {
      onSelect();
      return;
    }
    onSelect();
    setSmartGuides({ x: null, y: null });
    sessionRef.current = {
      moved: false,
      mode,
      pointerId: event.pointerId,
      startSelected: selected,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeightScale: transform.heightScale ?? transform.scale,
      startScale: transform.scale,
      startWidthScale: transform.widthScale ?? transform.scale,
      startX: transform.x,
      startY: transform.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePointer(clientX: number, clientY: number, pointerId: number) {
    const session = sessionRef.current;
    const layer = layerRef.current;
    const parent = layer?.parentElement;
    if (!session || !parent || session.pointerId !== pointerId) return;
    const bounds = parent.getBoundingClientRect();
    if (Math.hypot(clientX - session.startClientX, clientY - session.startClientY) > 3) {
      session.moved = true;
    }
    const deltaX = ((clientX - session.startClientX) / bounds.width) * canvasWidth;
    const deltaY = ((clientY - session.startClientY) / bounds.height) * canvasHeight;

    if (session.mode !== 'move') {
      if (session.mode === 'resize' && resizeMode === 'scale') {
        const scaleDelta = (deltaX + deltaY) / Math.max(baseWidth, baseHeight);
        onChange({ ...transform, scale: clamp(session.startScale + scaleDelta, 0.2, 3) });
        return;
      }
      let heightScale = session.startHeightScale;
      let widthScale = session.startWidthScale;
      let x = session.startX;
      let y = session.startY;
      if (session.mode === 'resize' || session.mode === 'resize-right') {
        widthScale = clamp(session.startWidthScale + deltaX / baseWidth, 0.2, 3);
        x += baseWidth * (widthScale - session.startWidthScale) / 2;
      }
      if (session.mode === 'resize-left') {
        widthScale = clamp(session.startWidthScale - deltaX / baseWidth, 0.2, 3);
        x -= baseWidth * (widthScale - session.startWidthScale) / 2;
      }
      if (session.mode === 'resize' || session.mode === 'resize-bottom') {
        heightScale = clamp(session.startHeightScale + deltaY / baseHeight, 0.2, 3);
        y += baseHeight * (heightScale - session.startHeightScale) / 2;
      }
      if (session.mode === 'resize-top') {
        heightScale = clamp(session.startHeightScale - deltaY / baseHeight, 0.2, 3);
        y -= baseHeight * (heightScale - session.startHeightScale) / 2;
      }
      onChange({ ...transform, heightScale, widthScale, x, y });
      return;
    }

    const proposedTransform = {
      ...transform,
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

  function endPointer(eventType: string, pointerId: number) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    sessionRef.current = null;
    setSmartGuides({ x: null, y: null });
    if (shouldDeselectCanvasLayer(eventType, session.mode, session.startSelected, session.moved)) {
      onDeselect();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      allowContentInteraction
      && event.target instanceof HTMLElement
      && event.target.closest('[data-canvas-editable="true"]')
    ) return;
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') onChange({ ...transform, x: transform.x - step });
    else if (event.key === 'ArrowRight') onChange({ ...transform, x: transform.x + step });
    else if (event.key === 'ArrowUp') onChange({ ...transform, y: transform.y - step });
    else if (event.key === 'ArrowDown') onChange({ ...transform, y: transform.y + step });
    else return;
    event.preventDefault();
  }

  const centerX = baseX + baseWidth / 2 + transform.x;
  const centerY = baseY + baseHeight / 2 + transform.y;
  const style: CSSProperties = {
    height: fitContentHeight && contentHeight !== null
      ? `max(${(height / canvasHeight) * 100}%, ${contentHeight}px)`
      : `${(height / canvasHeight) * 100}%`,
    left: `${((centerX - width / 2) / canvasWidth) * 100}%`,
    top: `${((centerY - height / 2) / canvasHeight) * 100}%`,
    width: `${(width / canvasWidth) * 100}%`,
    zIndex,
  };
  const guideHost = layerRef.current?.parentElement ?? null;

  return (
    <>
      <div
        aria-label={label}
        aria-selected={selected}
        className={`editable-canvas-layer ${className}`}
        data-content-interactive={allowContentInteraction ? 'true' : undefined}
        data-fit-content-height={fitContentHeight ? 'true' : undefined}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => beginPointer(event, 'move')}
        ref={layerRef}
        role={allowContentInteraction ? 'group' : 'button'}
        style={style}
        tabIndex={allowContentInteraction ? -1 : selected ? 0 : -1}
      >
        <div className='editable-canvas-layer-content'>{children}</div>
      </div>
      {selected && selectionBounds ? createPortal(
        <div
          className='editable-canvas-layer-selection'
          data-canvas-selection-preserve
          style={selectionBounds}
        >
          <span aria-hidden='true' className='editable-canvas-layer-name'>{label}</span>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <span
              aria-label={`Move ${label} from ${side} edge`}
              className={`editable-canvas-layer-move-edge editable-canvas-layer-move-edge--${side}`}
              key={`move-${side}`}
              onPointerDown={(event) => beginPointer(event, 'move')}
              role='button'
              title={`Move ${label}`}
            />
          ))}
          <span
            aria-label={`Move ${label}`}
            className='editable-canvas-layer-move'
            onPointerDown={(event) => beginPointer(event, 'move')}
            role='button'
            title={`Move ${label}`}
          />
          {resizeMode === 'box' ? (['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <span
              aria-label={`Resize ${label} from ${side}`}
              className={`editable-canvas-layer-edge editable-canvas-layer-edge--${side}`}
              key={side}
              onPointerDown={(event) => beginPointer(event, `resize-${side}`)}
              role='button'
              title={`Resize from ${side}`}
            />
          )) : null}
          <span
            aria-label={`Resize ${label}`}
            className='editable-canvas-layer-resize'
            onPointerDown={(event) => beginPointer(event, 'resize')}
            role='button'
          >
            <MoveDiagonal2 aria-hidden='true' />
          </span>
        </div>,
        document.body
      ) : null}
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
