'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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

export type CanvasLayerBounds = {
  bottom: number;
  centerX: number;
  centerY: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type CanvasSelectionItem = {
  geometry: CanvasLayerGeometry;
  transform: CanvasLayerTransform;
};

type PointerSession = {
  moved: boolean;
  mode: 'move' | 'resize' | 'resize-bottom' | 'resize-left' | 'resize-right' | 'resize-top';
  parentBounds: { height: number; left: number; top: number; width: number };
  pointerId: number;
  snapTargets: CanvasSnapTargets;
  startSelected: boolean;
  startClientX: number;
  startClientY: number;
  startHeightScale: number;
  startScale: number;
  startTransform: CanvasLayerTransform;
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

export function canvasLayerBounds(
  transform: CanvasLayerTransform,
  geometry: CanvasLayerGeometry
): CanvasLayerBounds {
  const { height, width } = canvasLayerDimensions(transform, geometry);
  const centerX = geometry.baseX + geometry.baseWidth / 2 + transform.x;
  const centerY = geometry.baseY + geometry.baseHeight / 2 + transform.y;
  return {
    bottom: centerY + height / 2,
    centerX,
    centerY,
    height,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    width,
  };
}

export function canvasSelectionBounds(items: readonly CanvasSelectionItem[]): CanvasLayerBounds | null {
  if (items.length === 0) return null;
  const bounds = items.map(({ geometry, transform }) => canvasLayerBounds(transform, geometry));
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  return {
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

export function alignCanvasSelection(
  items: readonly CanvasSelectionItem[],
  canvasWidth: number,
  canvasHeight: number,
  alignment: CanvasLayerAlignment
): CanvasLayerTransform[] {
  const bounds = canvasSelectionBounds(items);
  if (!bounds) return [];
  let deltaX = 0;
  let deltaY = 0;
  if (alignment === 'left') deltaX = -bounds.left;
  else if (alignment === 'horizontal-center') deltaX = canvasWidth / 2 - bounds.centerX;
  else if (alignment === 'right') deltaX = canvasWidth - bounds.right;
  else if (alignment === 'top') deltaY = -bounds.top;
  else if (alignment === 'vertical-center') deltaY = canvasHeight / 2 - bounds.centerY;
  else deltaY = canvasHeight - bounds.bottom;
  return items.map(({ transform }) => ({
    ...transform,
    x: transform.x + deltaX,
    y: transform.y + deltaY,
  }));
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
  movementBounds = null,
  onChange,
  onContextMenu,
  onDeselect,
  onSelect,
  resizeMode = 'scale',
  selected,
  selectionMember = false,
  showSelectionControls = true,
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
  movementBounds?: CanvasLayerBounds | null;
  onChange: (transform: CanvasLayerTransform) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDeselect: () => void;
  onSelect: (additive?: boolean) => void;
  resizeMode?: CanvasLayerResizeMode;
  selected: boolean;
  selectionMember?: boolean;
  showSelectionControls?: boolean;
  transform: CanvasLayerTransform;
  zIndex: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
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

  const measureSelectionBounds = useCallback(() => {
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
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
  }, []);

  useLayoutEffect(() => {
    if (!selected) {
      setSelectionBounds(null);
      return;
    }
    measureSelectionBounds();
  }, [contentHeight, height, measureSelectionBounds, selected, transform.x, transform.y, width]);

  useEffect(() => {
    if (!selected) return;
    const layer = layerRef.current;
    if (!layer) return;
    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureSelectionBounds);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(layer);
    if (layer.parentElement) resizeObserver.observe(layer.parentElement);
    const stage = layer.closest('.canvas-viewport-stage');
    const stageObserver = stage ? new MutationObserver(scheduleMeasure) : null;
    if (stage) stageObserver?.observe(stage, { attributeFilter: ['style'], attributes: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    document.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      stageObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      document.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [measureSelectionBounds, selected]);

  const updatePointerRef = useRef(updatePointer);
  const endPointerRef = useRef(endPointer);
  const detachWindowPointerListenersRef = useRef<() => void>(() => undefined);
  updatePointerRef.current = updatePointer;
  endPointerRef.current = endPointer;

  const flushPendingPointer = useCallback(() => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (pending) updatePointerRef.current(pending.clientX, pending.clientY, pending.pointerId);
  }, []);

  const handleWindowPointerMove = useCallback((event: PointerEvent) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    pendingPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    };
    if (pointerFrameRef.current === null) {
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const pending = pendingPointerRef.current;
        pendingPointerRef.current = null;
        if (pending) updatePointerRef.current(pending.clientX, pending.clientY, pending.pointerId);
      });
    }
  }, []);

  const handleWindowPointerEnd = useCallback((event: PointerEvent) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') {
      pendingPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      };
      flushPendingPointer();
    } else {
      pendingPointerRef.current = null;
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
    }
    endPointerRef.current(event.type, event.pointerId);
    detachWindowPointerListenersRef.current();
  }, [flushPendingPointer]);

  const detachWindowPointerListeners = useCallback(() => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerEnd);
    window.removeEventListener('pointercancel', handleWindowPointerEnd);
  }, [handleWindowPointerEnd, handleWindowPointerMove]);
  detachWindowPointerListenersRef.current = detachWindowPointerListeners;

  const attachWindowPointerListeners = useCallback(() => {
    detachWindowPointerListeners();
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
  }, [detachWindowPointerListeners, handleWindowPointerEnd, handleWindowPointerMove]);

  useEffect(() => () => {
    detachWindowPointerListeners();
    if (pointerFrameRef.current !== null) window.cancelAnimationFrame(pointerFrameRef.current);
  }, [detachWindowPointerListeners]);

  function beginPointer(event: ReactPointerEvent<HTMLElement>, mode: PointerSession['mode']) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey;
    if (
      mode === 'move'
      && allowContentInteraction
      && event.target instanceof HTMLElement
      && event.target.closest('[data-canvas-editable="true"]')
    ) {
      onSelect(additive);
      return;
    }
    onSelect(additive);
    if (mode === 'move' && additive && selected) return;
    setSmartGuides({ x: null, y: null });
    const layer = layerRef.current;
    const parent = layer?.parentElement;
    if (!layer || !parent) return;
    const parentBounds = parent.getBoundingClientRect();
    if (parentBounds.width <= 0 || parentBounds.height <= 0) return;
    const targetX = [0, canvasWidth / 2, canvasWidth];
    const targetY = [0, canvasHeight / 2, canvasHeight];
    Array.from(parent.children).forEach((sibling) => {
      if (
        !(sibling instanceof HTMLElement)
        || sibling === layer
        || !sibling.classList.contains('editable-canvas-layer')
        || sibling.dataset.canvasSelectionMember === 'true'
      ) return;
      const siblingBounds = sibling.getBoundingClientRect();
      const left = (siblingBounds.left - parentBounds.left) / parentBounds.width * canvasWidth;
      const right = (siblingBounds.right - parentBounds.left) / parentBounds.width * canvasWidth;
      const top = (siblingBounds.top - parentBounds.top) / parentBounds.height * canvasHeight;
      const bottom = (siblingBounds.bottom - parentBounds.top) / parentBounds.height * canvasHeight;
      targetX.push(left, (left + right) / 2, right);
      targetY.push(top, (top + bottom) / 2, bottom);
    });
    sessionRef.current = {
      moved: false,
      mode,
      parentBounds,
      pointerId: event.pointerId,
      snapTargets: { x: targetX, y: targetY },
      startSelected: selected && !additive,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeightScale: transform.heightScale ?? transform.scale,
      startScale: transform.scale,
      startTransform: transform,
      startWidthScale: transform.widthScale ?? transform.scale,
      startX: transform.x,
      startY: transform.y,
    };
    attachWindowPointerListeners();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePointer(clientX: number, clientY: number, pointerId: number) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    const bounds = session.parentBounds;
    if (Math.hypot(clientX - session.startClientX, clientY - session.startClientY) > 3) {
      session.moved = true;
    }
    const deltaX = ((clientX - session.startClientX) / bounds.width) * canvasWidth;
    const deltaY = ((clientY - session.startClientY) / bounds.height) * canvasHeight;

    if (session.mode !== 'move') {
      if (session.mode === 'resize' && resizeMode === 'scale') {
        const scaleDelta = (deltaX + deltaY) / Math.max(baseWidth, baseHeight);
        onChange({ ...session.startTransform, scale: clamp(session.startScale + scaleDelta, 0.2, 3) });
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
      onChange({ ...session.startTransform, heightScale, widthScale, x, y });
      return;
    }

    const proposedTransform = {
      ...session.startTransform,
      scale: session.startScale,
      x: clamp(session.startX + deltaX, -canvasWidth, canvasWidth),
      y: clamp(session.startY + deltaY, -canvasHeight, canvasHeight),
    };
    const movementGeometry = movementBounds ? {
      baseHeight: movementBounds.height,
      baseWidth: movementBounds.width,
      baseX: movementBounds.left,
      baseY: movementBounds.top,
    } : { baseHeight, baseWidth, baseX, baseY };
    const movementTransform = movementBounds ? {
      scale: 1,
      x: proposedTransform.x - session.startX,
      y: proposedTransform.y - session.startY,
    } : proposedTransform;
    const snapped = snapCanvasLayer(
      movementTransform,
      movementGeometry,
      session.snapTargets,
      6 / bounds.width * canvasWidth,
      6 / bounds.height * canvasHeight
    );
    setSmartGuides((current) => current.x === snapped.guides.x && current.y === snapped.guides.y
      ? current
      : snapped.guides);
    onChange(movementBounds ? {
      ...proposedTransform,
      x: session.startX + snapped.transform.x,
      y: session.startY + snapped.transform.y,
    } : snapped.transform);
  }

  function endPointer(eventType: string, pointerId: number) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    sessionRef.current = null;
    setSmartGuides({ x: null, y: null });
    if (eventType === 'pointercancel') {
      onChange(session.startTransform);
      return;
    }
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
        data-assembly-move={allowContentInteraction && movementBounds ? 'true' : undefined}
        data-canvas-selection-member={selectionMember ? 'true' : undefined}
        data-content-interactive={allowContentInteraction ? 'true' : undefined}
        data-fit-content-height={fitContentHeight ? 'true' : undefined}
        data-multi-selection={selectionMember && !showSelectionControls ? 'true' : undefined}
        onKeyDown={handleKeyDown}
        onContextMenu={onContextMenu}
        onPointerDown={(event) => beginPointer(event, 'move')}
        ref={layerRef}
        role={allowContentInteraction ? 'group' : 'button'}
        style={style}
        tabIndex={allowContentInteraction ? -1 : selected ? 0 : -1}
      >
        <div className='editable-canvas-layer-content'>{children}</div>
      </div>
      {selected && showSelectionControls && selectionBounds ? createPortal(
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
