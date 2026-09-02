'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MoveDiagonal2 } from '@/components/ui/SolidIcons';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useDocumentBody } from '@/hooks/useMountEffect';
import {
  MIN_CANVAS_LAYER_SCALE,
  canvasLayerBounds,
  canvasLayerDimensions,
  isAdditiveCanvasSelection,
  resizeCanvasLayerScale,
  shouldDeselectCanvasLayer,
  snapCanvasLayer,
  type CanvasLayerBounds,
  type CanvasLayerResizeMode,
  type CanvasLayerTransform,
  type CanvasPointerMode,
  type CanvasSmartGuides,
  type CanvasSnapTargets,
} from '@/lib/canvasInteraction';

type PointerSession = {
  groupElements: Array<{ element: HTMLElement; height: number; width: number }>;
  groupOverlay: HTMLElement | null;
  moved: boolean;
  mode: CanvasPointerMode;
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

type BeginPointer = (
  event: ReactPointerEvent<HTMLElement>,
  mode: PointerSession['mode']
) => void;

const CANVAS_SELECTION_SIDES = ['top', 'right', 'bottom', 'left'] as const;

function CanvasLayerSelectionOverlay({
  beginPointer,
  label,
  portalHost,
  resizeMode,
  selectionBounds,
  selectionOverlayRef,
}: {
  beginPointer: BeginPointer;
  label: string;
  portalHost: HTMLElement | null;
  resizeMode: CanvasLayerResizeMode;
  selectionBounds: SelectionBounds | null;
  selectionOverlayRef: RefObject<HTMLDivElement | null>;
}) {
  if (!portalHost || !selectionBounds) return null;
  return createPortal(
    <div
      className='editable-canvas-layer-selection'
      data-canvas-selection-preserve
      ref={selectionOverlayRef}
      style={selectionBounds}
    >
      <span aria-hidden='true' className='editable-canvas-layer-name'>{label}</span>
      {CANVAS_SELECTION_SIDES.map((side) => (
        <button
          aria-label={`Move ${label} from ${side} edge`}
          className={`editable-canvas-layer-move-edge editable-canvas-layer-move-edge--${side}`}
          key={`move-${side}`}
          onPointerDown={(event) => beginPointer(event, 'move')}
          tabIndex={-1}
          title={`Move ${label}`}
          type='button'
        />
      ))}
      <button
        aria-label={`Move ${label}`}
        className='editable-canvas-layer-move'
        onPointerDown={(event) => beginPointer(event, 'move')}
        tabIndex={-1}
        title={`Move ${label}`}
        type='button'
      />
      {resizeMode === 'box' ? CANVAS_SELECTION_SIDES.map((side) => (
        <button
          aria-label={`Resize ${label} from ${side}`}
          className={`editable-canvas-layer-edge editable-canvas-layer-edge--${side}`}
          key={side}
          onPointerDown={(event) => beginPointer(event, `resize-${side}`)}
          tabIndex={-1}
          title={`Resize from ${side}`}
          type='button'
        />
      )) : null}
      <button
        aria-label={`Resize ${label}`}
        className='editable-canvas-layer-resize'
        onPointerDown={(event) => beginPointer(event, 'resize')}
        tabIndex={-1}
        type='button'
      >
        <MoveDiagonal2 aria-hidden='true' />
      </button>
    </div>,
    portalHost
  );
}

function CanvasLayerSmartGuides({
  canvasHeight,
  canvasWidth,
  guideHost,
  smartGuides,
}: {
  canvasHeight: number;
  canvasWidth: number;
  guideHost: HTMLElement | null;
  smartGuides: CanvasSmartGuides;
}) {
  if (!guideHost || (smartGuides.x === null && smartGuides.y === null)) return null;
  return createPortal(
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
  );
}

function canvasLayerPresentation({
  allowContentInteraction,
  fitContentHeight,
  movementBounds,
  selected,
  selectionMember,
  showSelectionControls,
}: {
  allowContentInteraction: boolean;
  fitContentHeight: boolean;
  movementBounds: CanvasLayerBounds | null;
  selected: boolean;
  selectionMember: boolean;
  showSelectionControls: boolean;
}) {
  return {
    assemblyMove: allowContentInteraction && movementBounds ? 'true' : undefined,
    contentInteractive: allowContentInteraction ? 'true' : undefined,
    fitContent: fitContentHeight ? 'true' : undefined,
    multiSelection: selectionMember && !showSelectionControls ? 'true' : undefined,
    role: allowContentInteraction ? 'group' as const : 'button' as const,
    selectionBounds: selected && showSelectionControls,
    selectionMember: selectionMember ? 'true' : undefined,
    tabIndex: allowContentInteraction || !selected ? -1 : 0,
  };
}

function canvasLayerStyle({
  canvasHeight,
  canvasWidth,
  centerX,
  centerY,
  contentHeight,
  fitContentHeight,
  height,
  width,
  zIndex,
}: {
  canvasHeight: number;
  canvasWidth: number;
  centerX: number;
  centerY: number;
  contentHeight: number | null;
  fitContentHeight: boolean;
  height: number;
  width: number;
  zIndex: number;
}): CSSProperties {
  return {
    height: fitContentHeight && contentHeight !== null
      ? `max(${(height / canvasHeight) * 100}%, ${contentHeight}px)`
      : `${(height / canvasHeight) * 100}%`,
    left: `${((centerX - width / 2) / canvasWidth) * 100}%`,
    top: `${((centerY - height / 2) / canvasHeight) * 100}%`,
    transformOrigin: 'center',
    width: `${(width / canvasWidth) * 100}%`,
    zIndex,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useCanvasLayerContentHeight({
  fitContentHeight,
  layerRef,
  width,
}: {
  fitContentHeight: boolean;
  layerRef: RefObject<HTMLDivElement | null>;
  width: number;
}) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

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
  }, [fitContentHeight, layerRef, width]);

  return contentHeight;
}

function useCanvasLayerSelectionBounds({
  contentHeight,
  height,
  layerRef,
  selected,
  transform,
  width,
}: {
  contentHeight: number | null;
  height: number;
  layerRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  transform: CanvasLayerTransform;
  width: number;
}) {
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds | null>(null);
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
  }, [layerRef]);

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
  }, [layerRef, measureSelectionBounds, selected]);

  return { measureSelectionBounds, selectionBounds };
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
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const portalHost = useDocumentBody();
  const [smartGuides, setSmartGuides] = useState<CanvasSmartGuides>({ x: null, y: null });
  const resizePreviewTransformRef = useRef<CanvasLayerTransform | null>(null);
  const directPreviewActiveRef = useRef(false);
  const directPreviewCommitPendingRef = useRef(false);
  const directPreviewElementsRef = useRef<HTMLElement[]>([]);
  const directPreviewOverlayRef = useRef<HTMLElement | null>(null);
  const { height, width } = canvasLayerDimensions(transform, { baseHeight, baseWidth });
  const contentHeight = useCanvasLayerContentHeight({ fitContentHeight, layerRef, width });
  const { measureSelectionBounds, selectionBounds } = useCanvasLayerSelectionBounds({
    contentHeight,
    height,
    layerRef,
    selected,
    transform,
    width,
  });

  function clearDirectInteractionPreview() {
    directPreviewElementsRef.current.forEach((element) => {
      element.style.removeProperty('transform');
      element.style.removeProperty('will-change');
      delete element.dataset.interactionPreview;
    });
    directPreviewOverlayRef.current?.style.removeProperty('transform');
    directPreviewElementsRef.current = [];
    directPreviewOverlayRef.current = null;
    directPreviewActiveRef.current = false;
    directPreviewCommitPendingRef.current = false;
  }

  function applyDirectInteractionPreview(nextTransform: CanvasLayerTransform, session: PointerSession) {
    const layer = layerRef.current;
    if (!layer) return;
    const startDimensions = canvasLayerDimensions(session.startTransform, { baseHeight, baseWidth });
    const nextDimensions = canvasLayerDimensions(nextTransform, { baseHeight, baseWidth });
    const translateX = (nextTransform.x - session.startTransform.x) / Math.max(startDimensions.width, 0.001) * 100;
    const translateY = (nextTransform.y - session.startTransform.y) / Math.max(startDimensions.height, 0.001) * 100;
    const scaleX = nextDimensions.width / Math.max(startDimensions.width, 0.001);
    const scaleY = nextDimensions.height / Math.max(startDimensions.height, 0.001);
    layer.style.transform = `translate3d(${translateX}%, ${translateY}%, 0) scale3d(${scaleX}, ${scaleY}, 1)`;
    layer.style.willChange = 'transform';
    layer.dataset.interactionPreview = 'gpu';
    directPreviewElementsRef.current = [layer];

    const overlay = selectionOverlayRef.current;
    if (overlay) {
      const nextBounds = canvasLayerBounds(nextTransform, { baseHeight, baseWidth, baseX, baseY });
      overlay.style.left = `${session.parentBounds.left + nextBounds.left / canvasWidth * session.parentBounds.width}px`;
      overlay.style.top = `${session.parentBounds.top + nextBounds.top / canvasHeight * session.parentBounds.height}px`;
      overlay.style.width = `${nextBounds.width / canvasWidth * session.parentBounds.width}px`;
      overlay.style.height = `${nextBounds.height / canvasHeight * session.parentBounds.height}px`;
    }

    resizePreviewTransformRef.current = nextTransform;
    directPreviewActiveRef.current = true;
  }

  function applyDirectBoxResizePreview(nextTransform: CanvasLayerTransform, session: PointerSession) {
    const layer = layerRef.current;
    if (!layer) return;
    const nextBounds = canvasLayerBounds(nextTransform, { baseHeight, baseWidth, baseX, baseY });
    layer.style.left = `${nextBounds.left / canvasWidth * 100}%`;
    layer.style.top = `${nextBounds.top / canvasHeight * 100}%`;
    layer.style.width = `${nextBounds.width / canvasWidth * 100}%`;
    layer.style.height = fitContentHeight && contentHeight !== null
      ? `max(${nextBounds.height / canvasHeight * 100}%, ${contentHeight}px)`
      : `${nextBounds.height / canvasHeight * 100}%`;
    layer.style.willChange = 'left, top, width, height';
    layer.dataset.interactionPreview = 'direct-box';

    const overlay = selectionOverlayRef.current;
    if (overlay) {
      overlay.style.left = `${session.parentBounds.left + nextBounds.left / canvasWidth * session.parentBounds.width}px`;
      overlay.style.top = `${session.parentBounds.top + nextBounds.top / canvasHeight * session.parentBounds.height}px`;
      overlay.style.width = `${nextBounds.width / canvasWidth * session.parentBounds.width}px`;
      overlay.style.height = `${nextBounds.height / canvasHeight * session.parentBounds.height}px`;
    }

    directPreviewElementsRef.current = [layer];
    resizePreviewTransformRef.current = nextTransform;
    directPreviewActiveRef.current = true;
  }

  function restoreCommittedLayerLayout() {
    const layer = layerRef.current;
    if (!layer) return;
    const bounds = canvasLayerBounds(transform, { baseHeight, baseWidth, baseX, baseY });
    layer.style.left = `${bounds.left / canvasWidth * 100}%`;
    layer.style.top = `${bounds.top / canvasHeight * 100}%`;
    layer.style.width = `${bounds.width / canvasWidth * 100}%`;
    layer.style.height = fitContentHeight && contentHeight !== null
      ? `max(${bounds.height / canvasHeight * 100}%, ${contentHeight}px)`
      : `${bounds.height / canvasHeight * 100}%`;
  }

  function applyDirectGroupMovePreview(nextTransform: CanvasLayerTransform, session: PointerSession) {
    const deltaX = (nextTransform.x - session.startTransform.x) / canvasWidth * session.parentBounds.width;
    const deltaY = (nextTransform.y - session.startTransform.y) / canvasHeight * session.parentBounds.height;
    session.groupElements.forEach(({ element, height: elementHeight, width: elementWidth }) => {
      const translateX = deltaX / Math.max(elementWidth, 0.001) * 100;
      const translateY = deltaY / Math.max(elementHeight, 0.001) * 100;
      element.style.transform = `translate3d(${translateX}%, ${translateY}%, 0)`;
      element.style.willChange = 'transform';
      element.dataset.interactionPreview = 'gpu-group';
    });
    if (session.groupOverlay) {
      session.groupOverlay.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    }
    directPreviewElementsRef.current = session.groupElements.map(({ element }) => element);
    directPreviewOverlayRef.current = session.groupOverlay;
    resizePreviewTransformRef.current = nextTransform;
    directPreviewActiveRef.current = true;
  }

  useLayoutEffect(() => {
    if (!directPreviewActiveRef.current || !directPreviewCommitPendingRef.current) return;
    const preview = resizePreviewTransformRef.current;
    if (
      !preview
      || preview.x !== transform.x
      || preview.y !== transform.y
      || preview.scale !== transform.scale
      || preview.widthScale !== transform.widthScale
      || preview.heightScale !== transform.heightScale
    ) return;
    clearDirectInteractionPreview();
    resizePreviewTransformRef.current = null;
    measureSelectionBounds();
  }, [measureSelectionBounds, transform.heightScale, transform.scale, transform.widthScale, transform.x, transform.y]);

  const updatePointerRef = useCommittedRef(updatePointer);
  const endPointerRef = useCommittedRef(endPointer);
  const detachWindowPointerListenersRef = useRef<() => void>(() => undefined);

  const flushPendingPointer = useCallback(() => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (pending) updatePointerRef.current(pending.clientX, pending.clientY, pending.pointerId);
  }, [updatePointerRef]);

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
  }, [updatePointerRef]);

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
  }, [endPointerRef, flushPendingPointer]);

  const detachWindowPointerListeners = useCallback(() => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerEnd);
    window.removeEventListener('pointercancel', handleWindowPointerEnd);
  }, [handleWindowPointerEnd, handleWindowPointerMove]);
  useLayoutEffect(() => {
    detachWindowPointerListenersRef.current = detachWindowPointerListeners;
  }, [detachWindowPointerListeners]);

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
    const additive = isAdditiveCanvasSelection(event);
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
    const startingTransform = resizePreviewTransformRef.current ?? transform;
    clearDirectInteractionPreview();
    resizePreviewTransformRef.current = null;
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
      groupElements: movementBounds ? Array.from(parent.children).flatMap((sibling) => {
        if (
          !(sibling instanceof HTMLElement)
          || !sibling.classList.contains('editable-canvas-layer')
          || sibling.dataset.canvasSelectionMember !== 'true'
        ) return [];
        const siblingBounds = sibling.getBoundingClientRect();
        return [{ element: sibling, height: siblingBounds.height, width: siblingBounds.width }];
      }) : [],
      groupOverlay: movementBounds ? document.querySelector<HTMLElement>('.canvas-selection-assembly') : null,
      moved: false,
      mode,
      parentBounds,
      pointerId: event.pointerId,
      snapTargets: { x: targetX, y: targetY },
      startSelected: selected && !additive,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeightScale: startingTransform.heightScale ?? startingTransform.scale,
      startScale: startingTransform.scale,
      startTransform: startingTransform,
      startWidthScale: startingTransform.widthScale ?? startingTransform.scale,
      startX: startingTransform.x,
      startY: startingTransform.y,
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
    if (!session.moved) return;

    if (session.mode !== 'move') {
      if (session.mode === 'resize' && resizeMode === 'scale') {
        const scaleDelta = (deltaX + deltaY) / Math.max(baseWidth, baseHeight);
        const nextTransform = resizeCanvasLayerScale(session.startTransform, scaleDelta);
        applyDirectInteractionPreview(nextTransform, session);
        return;
      }
      let heightScale = session.startHeightScale;
      let widthScale = session.startWidthScale;
      let x = session.startX;
      let y = session.startY;
      if (session.mode === 'resize' || session.mode === 'resize-right') {
        widthScale = Math.max(session.startWidthScale + deltaX / baseWidth, MIN_CANVAS_LAYER_SCALE);
        x += baseWidth * (widthScale - session.startWidthScale) / 2;
      }
      if (session.mode === 'resize-left') {
        widthScale = Math.max(session.startWidthScale - deltaX / baseWidth, MIN_CANVAS_LAYER_SCALE);
        x -= baseWidth * (widthScale - session.startWidthScale) / 2;
      }
      if (session.mode === 'resize' || session.mode === 'resize-bottom') {
        heightScale = Math.max(session.startHeightScale + deltaY / baseHeight, MIN_CANVAS_LAYER_SCALE);
        y += baseHeight * (heightScale - session.startHeightScale) / 2;
      }
      if (session.mode === 'resize-top') {
        heightScale = Math.max(session.startHeightScale - deltaY / baseHeight, MIN_CANVAS_LAYER_SCALE);
        y -= baseHeight * (heightScale - session.startHeightScale) / 2;
      }
      const nextTransform = { ...session.startTransform, heightScale, widthScale, x, y };
      applyDirectBoxResizePreview(nextTransform, session);
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
    const nextTransform = movementBounds ? {
      ...proposedTransform,
      x: session.startX + snapped.transform.x,
      y: session.startY + snapped.transform.y,
    } : snapped.transform;
    if (movementBounds) {
      applyDirectGroupMovePreview(nextTransform, session);
      return;
    }
    resizePreviewTransformRef.current = nextTransform;
    applyDirectInteractionPreview(nextTransform, session);
  }

  function endPointer(eventType: string, pointerId: number) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    const resizePreview = resizePreviewTransformRef.current;
    const usedDirectPreview = directPreviewActiveRef.current;
    sessionRef.current = null;
    setSmartGuides({ x: null, y: null });
    if (eventType === 'pointercancel') {
      clearDirectInteractionPreview();
      restoreCommittedLayerLayout();
      resizePreviewTransformRef.current = null;
      if (session.mode === 'move' && !resizePreview) onChange(session.startTransform);
      return;
    }
    if (resizePreview) {
      directPreviewCommitPendingRef.current = usedDirectPreview;
      if (!usedDirectPreview) resizePreviewTransformRef.current = null;
      onChange(resizePreview);
    } else {
      clearDirectInteractionPreview();
      resizePreviewTransformRef.current = null;
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
  const style = canvasLayerStyle({
    canvasHeight,
    canvasWidth,
    centerX,
    centerY,
    contentHeight,
    fitContentHeight,
    height,
    width,
    zIndex,
  });
  const presentation = canvasLayerPresentation({
    allowContentInteraction,
    fitContentHeight,
    movementBounds,
    selected,
    selectionMember,
    showSelectionControls,
  });
  const guideHost = layerRef.current?.parentElement ?? null;

  return (
    <>
      <div
        aria-label={label}
        aria-selected={selected}
        className={`editable-canvas-layer ${className}`}
        data-assembly-move={presentation.assemblyMove}
        data-canvas-selection-member={presentation.selectionMember}
        data-content-interactive={presentation.contentInteractive}
        data-fit-content-height={presentation.fitContent}
        data-multi-selection={presentation.multiSelection}
        onKeyDown={handleKeyDown}
        onContextMenu={onContextMenu}
        onPointerDown={(event) => beginPointer(event, 'move')}
        ref={layerRef}
        role={presentation.role}
        style={style}
        tabIndex={presentation.tabIndex}
      >
        <div className='editable-canvas-layer-content'>{children}</div>
      </div>
      <CanvasLayerSelectionOverlay
        beginPointer={beginPointer}
        label={label}
        portalHost={portalHost}
        resizeMode={resizeMode}
        selectionBounds={presentation.selectionBounds ? selectionBounds : null}
        selectionOverlayRef={selectionOverlayRef}
      />
      <CanvasLayerSmartGuides
        canvasHeight={canvasHeight}
        canvasWidth={canvasWidth}
        guideHost={guideHost}
        smartGuides={smartGuides}
      />
    </>
  );
}
