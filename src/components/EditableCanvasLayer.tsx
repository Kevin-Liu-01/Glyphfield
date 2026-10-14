'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MoveDiagonal2, RotateCw } from '@/components/ui/SolidIcons';

import CanvasSelectionClip, { canvasSelectionLocalBounds, canvasSelectionProjector, paintCanvasSelectionBounds, trackCanvasSelectionNavigation } from '@/components/CanvasSelectionClip';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import {
  canvasLayerBounds,
  canvasLayerDimensions,
  canvasRotationFromPointer,
  isAdditiveCanvasSelection,
  resizeCanvasLayerBox,
  resizeCanvasLayerScale,
  rotateCanvasVector,
  rotatedCanvasExtent,
  sameCanvasLayerBox,
  shouldDeselectCanvasLayer,
  snapCanvasLayer,
  type CanvasLayerBounds,
  type CanvasLayerGeometry,
  type CanvasLayerResizeMode,
  type CanvasLayerTransform,
  type CanvasPointerMode,
  type CanvasSmartGuides,
  type CanvasSnapTargets,
} from '@/lib/canvasInteraction';
import styles from './EditableCanvasLayer.module.css';

type PointerSession = {
  captureTarget: HTMLElement;
  groupElements: Array<{ element: HTMLElement; height: number; rotation: number; width: number }>;
  groupOverlay: HTMLElement | null;
  moved: boolean;
  mode: CanvasPointerMode;
  parentBounds: { height: number; left: number; top: number; width: number };
  pointerId: number;
  /** Client-space center of the layer, for rotate drags. */
  rotationCenter: { x: number; y: number };
  selectionProjector: ReturnType<typeof canvasSelectionProjector> | null;
  snapTargets: CanvasSnapTargets;
  startSelected: boolean;
  startClientX: number;
  startClientY: number;
  startHeightScale: number;
  startRotation: number;
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
  viewport: HTMLElement;
  width: number;
};

type BeginPointer = (
  event: ReactPointerEvent<HTMLElement>,
  mode: PointerSession['mode']
) => void;

const CANVAS_SELECTION_SIDES = ['top', 'right', 'bottom', 'left'] as const;
/** Shift-drag rotates in these steps. */
const ROTATION_STEP_DEGREES = 15;

function rotationStyle(rotation: number): string | undefined {
  return rotation ? `${rotation}deg` : undefined;
}

/**
 * The client rect of the layer's own box. A rotated layer's bounding rect is
 * the axis-aligned hull, so take its center and the unrotated layout size.
 */
function unrotatedClientRect(layer: HTMLElement, rotation: number): DOMRect {
  const hull = layer.getBoundingClientRect();
  const parent = layer.parentElement;
  if (!rotation || !parent || !layer.offsetWidth || !parent.offsetWidth) return hull;
  const zoom = parent.getBoundingClientRect().width / parent.offsetWidth;
  const width = layer.offsetWidth * zoom;
  const height = layer.offsetHeight * zoom;
  return new DOMRect(hull.left + hull.width / 2 - width / 2, hull.top + hull.height / 2 - height / 2, width, height);
}

function findCanvasAssemblyOverlay(layer: Element): HTMLElement | null {
  return layer.closest('.canvas-viewport')?.querySelector<HTMLElement>('.canvas-selection-assembly') ?? null;
}

/** Editable content (such as text) keeps the pointer instead of starting a move. */
function pointerStartsContentEdit(target: EventTarget, allowContentInteraction: boolean): boolean {
  return allowContentInteraction && target instanceof HTMLElement && target.closest('[data-canvas-editable="true"]') !== null;
}

/** Canvas edges and center, the host's extra lines, and every other unselected layer's edges and center. */
function siblingSnapTargets(
  layer: HTMLElement,
  parentBounds: { height: number; left: number; top: number; width: number },
  canvas: { height: number; width: number },
  extra: Partial<CanvasSnapTargets> | undefined
): CanvasSnapTargets {
  const x = [0, canvas.width / 2, canvas.width, ...(extra?.x ?? [])];
  const y = [0, canvas.height / 2, canvas.height, ...(extra?.y ?? [])];
  Array.from(layer.parentElement?.children ?? []).forEach((sibling) => {
    if (
      !(sibling instanceof HTMLElement)
      || sibling === layer
      || !sibling.classList.contains('editable-canvas-layer')
      || sibling.dataset.canvasSelectionMember === 'true'
    ) return;
    const bounds = sibling.getBoundingClientRect();
    const left = (bounds.left - parentBounds.left) / parentBounds.width * canvas.width;
    const right = (bounds.right - parentBounds.left) / parentBounds.width * canvas.width;
    const top = (bounds.top - parentBounds.top) / parentBounds.height * canvas.height;
    const bottom = (bounds.bottom - parentBounds.top) / parentBounds.height * canvas.height;
    x.push(left, (left + right) / 2, right);
    y.push(top, (top + bottom) / 2, bottom);
  });
  return { x, y };
}

/** The other layers of a moving selection, with their own rotation so previews move them along screen axes. */
function selectionMemberElements(parent: HTMLElement): PointerSession['groupElements'] {
  return Array.from(parent.children).flatMap((sibling) => {
    if (
      !(sibling instanceof HTMLElement)
      || !sibling.classList.contains('editable-canvas-layer')
      || sibling.dataset.canvasSelectionMember !== 'true'
    ) return [];
    const rotation = Number.parseFloat(sibling.style.rotate) || 0;
    const bounds = unrotatedClientRect(sibling, rotation);
    return [{ element: sibling, height: bounds.height, rotation, width: bounds.width }];
  });
}

function CanvasLayerSelectionOverlay({
  beginPointer,
  label,
  resizeMode,
  rotatable,
  rotation,
  selectionMode,
  selectionBounds,
  selectionOverlayRef,
}: {
  beginPointer: BeginPointer;
  label: string;
  resizeMode: CanvasLayerResizeMode;
  rotatable: boolean;
  rotation: number;
  selectionMode: 'crop' | 'default';
  selectionBounds: SelectionBounds | null;
  selectionOverlayRef: RefObject<HTMLDivElement | null>;
}) {
  if (!selectionBounds) return null;
  const { viewport, ...bounds } = selectionBounds;
  return (
    <CanvasSelectionClip viewport={viewport}>
      <div
        className='editable-canvas-layer-selection'
        data-canvas-selection-preserve
        data-selection-mode={selectionMode}
        ref={selectionOverlayRef}
        style={{ ...bounds, rotate: rotationStyle(rotation) }}
      >
        <span aria-hidden='true' className='editable-canvas-layer-name'>{label}</span>
        {rotatable ? (
          <button
            aria-label={`Rotate ${label}`}
            className={styles.rotate}
            onPointerDown={(event) => beginPointer(event, 'rotate')}
            tabIndex={-1}
            title={`Rotate ${label}. Hold Shift for ${ROTATION_STEP_DEGREES}° steps.`}
            type='button'
          >
            <RotateCw aria-hidden='true' />
          </button>
        ) : null}
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
        {resizeMode === 'box' ? (
          <>
            <button
              aria-label={`Resize ${label} from top left`}
              className='editable-canvas-layer-corner editable-canvas-layer-corner--top-left'
              onPointerDown={(event) => beginPointer(event, 'resize-top-left')}
              tabIndex={-1}
              type='button'
            />
            <button
              aria-label={`Resize ${label} from top right`}
              className='editable-canvas-layer-corner editable-canvas-layer-corner--top-right'
              onPointerDown={(event) => beginPointer(event, 'resize-top-right')}
              tabIndex={-1}
              type='button'
            />
            <button
              aria-label={`Resize ${label} from bottom left`}
              className='editable-canvas-layer-corner editable-canvas-layer-corner--bottom-left'
              onPointerDown={(event) => beginPointer(event, 'resize-bottom-left')}
              tabIndex={-1}
              type='button'
            />
            <button
              aria-label={`Resize ${label} from bottom right`}
              className='editable-canvas-layer-corner editable-canvas-layer-corner--bottom-right'
              onPointerDown={(event) => beginPointer(event, 'resize')}
              tabIndex={-1}
              type='button'
            />
          </>
        ) : (
          <button
            aria-label={`Resize ${label}`}
            className='editable-canvas-layer-resize'
            onPointerDown={(event) => beginPointer(event, 'resize')}
            tabIndex={-1}
            type='button'
          >
            <MoveDiagonal2 aria-hidden='true' />
          </button>
        )}
      </div>
    </CanvasSelectionClip>
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

function canvasLayerElementInteractivity({
  beginPointer,
  handleKeyDown,
  interactive,
  onContextMenu,
  onDoubleClick,
  presentation,
  selected,
}: {
  beginPointer: BeginPointer;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  interactive: boolean;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  presentation: ReturnType<typeof canvasLayerPresentation>;
  selected: boolean;
}) {
  if (!interactive) {
    return {
      ariaKeyShortcuts: undefined,
      ariaPressed: undefined,
      onContextMenu: undefined,
      onDoubleClick: undefined,
      onKeyDown: undefined,
      onPointerDown: undefined,
      pointerEvents: 'none' as const,
      role: 'presentation' as const,
      tabIndex: -1,
    };
  }
  return {
    ariaKeyShortcuts: onContextMenu ? 'Shift+F10' : undefined,
    ariaPressed: presentation.role === 'button' ? selected : undefined,
    onContextMenu,
    onDoubleClick,
    onKeyDown: handleKeyDown,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => beginPointer(event, 'move'),
    pointerEvents: undefined,
    role: presentation.role,
    tabIndex: presentation.tabIndex,
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
  rotation,
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
  rotation: number;
  width: number;
  zIndex: number;
}): CSSProperties {
  return {
    rotate: rotationStyle(rotation),
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
  rotation,
  selected,
  selectionOverlayRef,
  transform,
  width,
}: {
  contentHeight: number | null;
  height: number;
  layerRef: RefObject<HTMLDivElement | null>;
  rotation: number;
  selected: boolean;
  selectionOverlayRef: RefObject<HTMLDivElement | null>;
  transform: CanvasLayerTransform;
  width: number;
}) {
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds | null>(null);
  const navigationRef = useRef<ReturnType<typeof trackCanvasSelectionNavigation>>(null);
  const measureSelectionBounds = useCallback(() => {
    const layer = layerRef.current;
    if (layer?.closest('[data-canvas-initializing="true"]')) {
      setSelectionBounds(null);
      return;
    }
    const bounds = layer ? unrotatedClientRect(layer, rotation) : undefined;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const viewport = layer?.closest<HTMLElement>('.canvas-viewport');
    if (!viewport) return;
    const next = {
      ...canvasSelectionLocalBounds(bounds, viewport),
      viewport,
    };
    const overlay = selectionOverlayRef.current;
    navigationRef.current = trackCanvasSelectionNavigation(next, viewport, layer?.closest('.canvas-viewport-stage') ?? null);
    if (overlay) {
      paintCanvasSelectionBounds(overlay, next);
      return;
    }
    setSelectionBounds((current) => current
      && Math.abs(current.height - next.height) < 0.25
      && Math.abs(current.left - next.left) < 0.25
      && Math.abs(current.top - next.top) < 0.25
      && Math.abs(current.width - next.width) < 0.25
      && current.viewport === next.viewport
      ? current
      : next);
  }, [layerRef, rotation, selectionOverlayRef]);

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
    let frame: number | null = null;
    const scheduleMeasure = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measureSelectionBounds();
      });
    };
    const measureImmediately = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      const overlay = selectionOverlayRef.current;
      const navigation = navigationRef.current;
      if (overlay && navigation) paintCanvasSelectionBounds(overlay, navigation());
      else measureSelectionBounds();
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(layer);
    if (layer.parentElement) resizeObserver.observe(layer.parentElement);
    const viewport = layer.closest('.canvas-viewport');
    if (viewport) resizeObserver.observe(viewport);
    const stage = layer.closest('.canvas-viewport-stage');
    const stageObserver = stage ? new MutationObserver(measureImmediately) : null;
    if (stage) stageObserver?.observe(stage, { attributeFilter: ['style'], attributes: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    document.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
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
  interactive = true,
  cropEditing = false,
  label,
  layerId,
  movementBounds = null,
  onChange,
  onMoveComplete,
  onContextMenu,
  onDoubleClick,
  onDeselect,
  onRotate,
  onSelect,
  resizeMode = 'scale',
  rotation = 0,
  selected,
  selectionMember = false,
  showSelectionControls = true,
  snapTargets,
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
  interactive?: boolean;
  cropEditing?: boolean;
  label: string;
  layerId?: string;
  movementBounds?: CanvasLayerBounds | null;
  onChange: (transform: CanvasLayerTransform) => void;
  onMoveComplete?: (point: { x: number; y: number }) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDeselect: () => void;
  /** Shows a rotate handle; receives the new rotation in degrees, (-180, 180], when a rotate drag ends. */
  onRotate?: (rotation: number) => void;
  onSelect: (additive?: boolean) => void;
  resizeMode?: CanvasLayerResizeMode;
  /** Degrees clockwise about the layer's center. The selection frame turns with it. */
  rotation?: number;
  selected: boolean;
  selectionMember?: boolean;
  showSelectionControls?: boolean;
  /** Extra canvas-space lines to snap to, such as thirds or custom guides. */
  snapTargets?: Partial<CanvasSnapTargets>;
  /**
   * After a gesture, the preview stays until these props draw the same box,
   * so a host may re-base (move offsets into baseX/baseY, or scale into
   * baseWidth/baseHeight) when it commits.
   */
  transform: CanvasLayerTransform;
  zIndex: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number; pointerId: number; shiftKey: boolean } | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const [smartGuides, setSmartGuides] = useState<CanvasSmartGuides>({ x: null, y: null });
  const resizePreviewTransformRef = useRef<CanvasLayerTransform | null>(null);
  const directPreviewActiveRef = useRef(false);
  const directPreviewCommitPendingRef = useRef(false);
  const directPreviewElementsRef = useRef<HTMLElement[]>([]);
  const directPreviewOverlayRef = useRef<HTMLElement | null>(null);
  const committedPreviewGeometryRef = useRef<CanvasLayerGeometry | null>(null);
  const rotationPreviewRef = useRef<number | null>(null);
  const { height, width } = canvasLayerDimensions(transform, { baseHeight, baseWidth });
  const contentHeight = useCanvasLayerContentHeight({ fitContentHeight, layerRef, width });
  const { measureSelectionBounds, selectionBounds } = useCanvasLayerSelectionBounds({
    contentHeight,
    height,
    layerRef,
    rotation,
    selected,
    selectionOverlayRef,
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

  function updateSelectionPreview(overlay: HTMLElement, nextTransform: CanvasLayerTransform, session: PointerSession) {
    if (!session.selectionProjector) return;
    const next = canvasLayerBounds(nextTransform, { baseHeight, baseWidth, baseX, baseY });
    const local = session.selectionProjector({
      left: session.parentBounds.left + next.left / canvasWidth * session.parentBounds.width,
      top: session.parentBounds.top + next.top / canvasHeight * session.parentBounds.height,
      width: next.width / canvasWidth * session.parentBounds.width,
      height: next.height / canvasHeight * session.parentBounds.height,
    });
    overlay.style.left = `${local.left}px`;
    overlay.style.top = `${local.top}px`;
    overlay.style.width = `${local.width}px`;
    overlay.style.height = `${local.height}px`;
  }

  function applyDirectInteractionPreview(nextTransform: CanvasLayerTransform, session: PointerSession) {
    const layer = layerRef.current;
    if (!layer) return;
    const overlay = selectionOverlayRef.current;
    if (overlay) updateSelectionPreview(overlay, nextTransform, session);
    const startDimensions = canvasLayerDimensions(session.startTransform, { baseHeight, baseWidth });
    const nextDimensions = canvasLayerDimensions(nextTransform, { baseHeight, baseWidth });
    // `transform` applies inside the layer's rotation, so express the move in its own axes.
    const shift = rotateCanvasVector({ x: nextTransform.x - session.startTransform.x, y: nextTransform.y - session.startTransform.y }, -rotation);
    const translateX = shift.x / Math.max(startDimensions.width, 0.001) * 100;
    const translateY = shift.y / Math.max(startDimensions.height, 0.001) * 100;
    const scaleX = nextDimensions.width / Math.max(startDimensions.width, 0.001);
    const scaleY = nextDimensions.height / Math.max(startDimensions.height, 0.001);
    layer.style.transform = `translate3d(${translateX}%, ${translateY}%, 0) scale3d(${scaleX}, ${scaleY}, 1)`;
    layer.style.willChange = 'transform';
    layer.dataset.interactionPreview = 'gpu';
    directPreviewElementsRef.current = [layer];

    resizePreviewTransformRef.current = nextTransform;
    directPreviewActiveRef.current = true;
  }

  function applyDirectBoxResizePreview(nextTransform: CanvasLayerTransform, session: PointerSession) {
    const layer = layerRef.current;
    if (!layer) return;
    const overlay = selectionOverlayRef.current;
    if (overlay) updateSelectionPreview(overlay, nextTransform, session);
    const nextBounds = canvasLayerBounds(nextTransform, { baseHeight, baseWidth, baseX, baseY });
    layer.style.left = `${nextBounds.left / canvasWidth * 100}%`;
    layer.style.top = `${nextBounds.top / canvasHeight * 100}%`;
    layer.style.width = `${nextBounds.width / canvasWidth * 100}%`;
    layer.style.height = fitContentHeight && contentHeight !== null
      ? `max(${nextBounds.height / canvasHeight * 100}%, ${contentHeight}px)`
      : `${nextBounds.height / canvasHeight * 100}%`;
    layer.style.willChange = 'left, top, width, height';
    layer.dataset.interactionPreview = 'direct-box';

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
    if (session.groupOverlay && session.selectionProjector) {
      const delta = session.selectionProjector({ left: 0, top: 0, width: deltaX, height: deltaY });
      session.groupOverlay.style.transform = `translate3d(${delta.width}px, ${delta.height}px, 0)`;
    }
    session.groupElements.forEach(({ element, height: elementHeight, rotation: elementRotation, width: elementWidth }) => {
      const shift = rotateCanvasVector({ x: deltaX, y: deltaY }, -elementRotation);
      const translateX = shift.x / Math.max(elementWidth, 0.001) * 100;
      const translateY = shift.y / Math.max(elementHeight, 0.001) * 100;
      element.style.transform = `translate3d(${translateX}%, ${translateY}%, 0)`;
      element.style.willChange = 'transform';
      element.dataset.interactionPreview = 'gpu-group';
    });
    directPreviewElementsRef.current = session.groupElements.map(({ element }) => element);
    directPreviewOverlayRef.current = session.groupOverlay;
    resizePreviewTransformRef.current = nextTransform;
    directPreviewActiveRef.current = true;
  }

  function previewRotation(nextRotation: number) {
    const value = rotationStyle(nextRotation) ?? '';
    const layer = layerRef.current;
    if (layer) {
      layer.style.rotate = value;
      layer.dataset.interactionPreview = 'rotate';
    }
    if (selectionOverlayRef.current) selectionOverlayRef.current.style.rotate = value;
    rotationPreviewRef.current = nextRotation;
  }

  function clearRotationPreview(restore: boolean) {
    const layer = layerRef.current;
    if (layer?.dataset.interactionPreview === 'rotate') delete layer.dataset.interactionPreview;
    rotationPreviewRef.current = null;
    if (!restore) return;
    const value = rotationStyle(rotation) ?? '';
    if (layer) layer.style.rotate = value;
    if (selectionOverlayRef.current) selectionOverlayRef.current.style.rotate = value;
  }

  useLayoutEffect(() => {
    if (!directPreviewActiveRef.current || !directPreviewCommitPendingRef.current) return;
    const preview = resizePreviewTransformRef.current;
    const previewGeometry = committedPreviewGeometryRef.current;
    if (!preview || !previewGeometry || !sameCanvasLayerBox(
      { geometry: previewGeometry, transform: preview },
      { geometry: { baseHeight, baseWidth, baseX, baseY }, transform }
    )) return;
    clearDirectInteractionPreview();
    resizePreviewTransformRef.current = null;
    committedPreviewGeometryRef.current = null;
    measureSelectionBounds();
  }, [baseHeight, baseWidth, baseX, baseY, measureSelectionBounds, transform]);

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
    if (pending) updatePointerRef.current(pending.clientX, pending.clientY, pending.pointerId, pending.shiftKey);
  }, [updatePointerRef]);

  const handleWindowPointerMove = useCallback((event: PointerEvent) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    pendingPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      shiftKey: event.shiftKey,
    };
    if (pointerFrameRef.current === null) {
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const pending = pendingPointerRef.current;
        pendingPointerRef.current = null;
        if (pending) updatePointerRef.current(pending.clientX, pending.clientY, pending.pointerId, pending.shiftKey);
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
        shiftKey: event.shiftKey,
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

  const cancelWindowPointer = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    pendingPointerRef.current = null;
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    endPointerRef.current('pointercancel', session.pointerId);
    detachWindowPointerListenersRef.current();
  }, [endPointerRef]);

  const cancelHiddenPointer = useCallback(() => {
    if (document.hidden) cancelWindowPointer();
  }, [cancelWindowPointer]);

  const detachWindowPointerListeners = useCallback(() => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerEnd);
    window.removeEventListener('pointercancel', handleWindowPointerEnd);
    window.removeEventListener('blur', cancelWindowPointer);
    document.removeEventListener('visibilitychange', cancelHiddenPointer);
  }, [cancelHiddenPointer, cancelWindowPointer, handleWindowPointerEnd, handleWindowPointerMove]);
  useLayoutEffect(() => {
    detachWindowPointerListenersRef.current = detachWindowPointerListeners;
  }, [detachWindowPointerListeners]);

  const attachWindowPointerListeners = useCallback(() => {
    detachWindowPointerListeners();
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    window.addEventListener('blur', cancelWindowPointer);
    document.addEventListener('visibilitychange', cancelHiddenPointer);
  }, [cancelHiddenPointer, cancelWindowPointer, detachWindowPointerListeners, handleWindowPointerEnd, handleWindowPointerMove]);

  useEffect(() => () => {
    detachWindowPointerListeners();
    if (pointerFrameRef.current !== null) window.cancelAnimationFrame(pointerFrameRef.current);
  }, [detachWindowPointerListeners]);

  function beginPointer(event: ReactPointerEvent<HTMLElement>, mode: PointerSession['mode']) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = isAdditiveCanvasSelection(event);
    onSelect(additive);
    if (mode === 'move' && pointerStartsContentEdit(event.target, allowContentInteraction)) return;
    if (mode === 'move' && additive && selected) return;
    setSmartGuides({ x: null, y: null });
    const layer = layerRef.current;
    const parent = layer?.parentElement;
    if (!layer || !parent) return;
    const parentBounds = parent.getBoundingClientRect();
    if (parentBounds.width <= 0 || parentBounds.height <= 0) return;
    const startingTransform = resizePreviewTransformRef.current ?? transform;
    const startingRotation = rotationPreviewRef.current ?? rotation;
    clearDirectInteractionPreview();
    clearRotationPreview(false);
    resizePreviewTransformRef.current = null;
    committedPreviewGeometryRef.current = null;
    const viewport = layer.closest<HTMLElement>('.canvas-viewport');
    const hull = layer.getBoundingClientRect();
    sessionRef.current = {
      captureTarget: event.currentTarget,
      selectionProjector: viewport ? canvasSelectionProjector(viewport) : null,
      groupElements: movementBounds ? selectionMemberElements(parent) : [],
      groupOverlay: movementBounds ? findCanvasAssemblyOverlay(parent) : null,
      moved: false,
      mode,
      parentBounds,
      pointerId: event.pointerId,
      rotationCenter: { x: hull.left + hull.width / 2, y: hull.top + hull.height / 2 },
      snapTargets: siblingSnapTargets(layer, parentBounds, { height: canvasHeight, width: canvasWidth }, snapTargets),
      startSelected: selected && !additive,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeightScale: startingTransform.heightScale ?? startingTransform.scale,
      startRotation: startingRotation,
      startScale: startingTransform.scale,
      startTransform: startingTransform,
      startWidthScale: startingTransform.widthScale ?? startingTransform.scale,
      startX: startingTransform.x,
      startY: startingTransform.y,
    };
    attachWindowPointerListeners();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /** Box or uniform resize, read along the layer's own axes. */
  function previewResize(delta: { x: number; y: number }, session: PointerSession) {
    if (session.mode === 'resize' && resizeMode === 'scale') {
      const local = rotateCanvasVector(delta, -rotation);
      const scaleDelta = (local.x + local.y) / Math.max(baseWidth, baseHeight);
      applyDirectInteractionPreview(resizeCanvasLayerScale(session.startTransform, scaleDelta), session);
      return;
    }
    const nextTransform = resizeCanvasLayerBox(session.startTransform, { baseHeight, baseWidth }, session.mode, delta, rotation);
    applyDirectBoxResizePreview(nextTransform, session);
  }

  /**
   * The frame that snapping measures: the group's bounds when moving an
   * assembly, the rotated layer's hull when rotated, else the layer itself.
   */
  function movementSnapFrame(proposed: CanvasLayerTransform, session: PointerSession) {
    if (movementBounds) {
      return {
        geometry: { baseHeight: movementBounds.height, baseWidth: movementBounds.width, baseX: movementBounds.left, baseY: movementBounds.top },
        transform: { scale: 1, x: proposed.x - session.startX, y: proposed.y - session.startY },
      };
    }
    if (!rotation) return { geometry: { baseHeight, baseWidth, baseX, baseY }, transform: proposed };
    const dimensions = canvasLayerDimensions(proposed, { baseHeight, baseWidth });
    const hull = rotatedCanvasExtent(dimensions.width, dimensions.height, rotation);
    return {
      geometry: { baseHeight: hull.height, baseWidth: hull.width, baseX: baseX + (baseWidth - hull.width) / 2, baseY: baseY + (baseHeight - hull.height) / 2 },
      transform: { scale: 1, x: proposed.x, y: proposed.y },
    };
  }

  function previewMove(delta: { x: number; y: number }, session: PointerSession) {
    const bounds = session.parentBounds;
    const proposedTransform = {
      ...session.startTransform,
      scale: session.startScale,
      x: session.startX + delta.x,
      y: session.startY + delta.y,
    };
    const frame = movementSnapFrame(proposedTransform, session);
    const snapped = snapCanvasLayer(
      frame.transform,
      frame.geometry,
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
    } : { ...proposedTransform, x: snapped.transform.x, y: snapped.transform.y };
    if (movementBounds) {
      applyDirectGroupMovePreview(nextTransform, session);
      return;
    }
    resizePreviewTransformRef.current = nextTransform;
    applyDirectInteractionPreview(nextTransform, session);
  }

  function updatePointer(clientX: number, clientY: number, pointerId: number, shiftKey = false) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    const bounds = session.parentBounds;
    if (Math.hypot(clientX - session.startClientX, clientY - session.startClientY) > 3) {
      session.moved = true;
    }
    if (!session.moved) return;
    if (session.mode === 'rotate') {
      previewRotation(canvasRotationFromPointer(
        session.startRotation,
        session.rotationCenter,
        { x: session.startClientX, y: session.startClientY },
        { x: clientX, y: clientY },
        shiftKey ? ROTATION_STEP_DEGREES : undefined
      ));
      return;
    }
    const delta = {
      x: ((clientX - session.startClientX) / bounds.width) * canvasWidth,
      y: ((clientY - session.startClientY) / bounds.height) * canvasHeight,
    };
    if (session.mode === 'move') previewMove(delta, session);
    else previewResize(delta, session);
  }

  function endRotation(eventType: string, session: PointerSession) {
    const preview = rotationPreviewRef.current;
    if (eventType === 'pointercancel' || preview === null || !session.moved) {
      clearRotationPreview(true);
      return;
    }
    // Keep the previewed angle on screen; the host's rotation prop replaces it.
    clearRotationPreview(false);
    onRotate?.(preview);
  }

  function endPointer(eventType: string, pointerId: number) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    if (session.mode === 'rotate') {
      sessionRef.current = null;
      if (session.captureTarget.hasPointerCapture(pointerId)) session.captureTarget.releasePointerCapture(pointerId);
      endRotation(eventType, session);
      return;
    }
    const resizePreview = resizePreviewTransformRef.current;
    const usedDirectPreview = directPreviewActiveRef.current;
    sessionRef.current = null;
    if (session.captureTarget.hasPointerCapture(pointerId)) session.captureTarget.releasePointerCapture(pointerId);
    setSmartGuides({ x: null, y: null });
    if (eventType === 'pointercancel') {
      clearDirectInteractionPreview();
      restoreCommittedLayerLayout();
      resizePreviewTransformRef.current = null;
      measureSelectionBounds();
      if (session.mode === 'move' && !resizePreview) onChange(session.startTransform);
      return;
    }
    if (resizePreview) {
      directPreviewCommitPendingRef.current = usedDirectPreview;
      committedPreviewGeometryRef.current = { baseHeight, baseWidth, baseX, baseY };
      if (!usedDirectPreview) resizePreviewTransformRef.current = null;
      onChange(resizePreview);
      if (session.mode === 'move' && session.moved) {
        onMoveComplete?.({
          x: session.parentBounds.left + (baseX + baseWidth / 2 + resizePreview.x) / canvasWidth * session.parentBounds.width,
          y: session.parentBounds.top + (baseY + baseHeight / 2 + resizePreview.y) / canvasHeight * session.parentBounds.height,
        });
      }
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
      onContextMenu
      && ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')
    ) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: bounds.left + Math.min(32, bounds.width / 2),
        clientY: bounds.top + Math.min(32, bounds.height),
      }));
      return;
    }
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
    rotation,
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
  const elementInteractivity = canvasLayerElementInteractivity({
    beginPointer,
    handleKeyDown,
    interactive,
    onContextMenu,
    onDoubleClick,
    presentation,
    selected,
  });
  const guideHost = layerRef.current?.parentElement ?? null;

  return (
    <>
      <div
        aria-keyshortcuts={elementInteractivity.ariaKeyShortcuts}
        aria-label={label}
        aria-pressed={elementInteractivity.ariaPressed}
        className={`editable-canvas-layer ${className}`}
        data-assembly-move={presentation.assemblyMove}
        data-canvas-layer-id={layerId}
        data-canvas-selection-member={presentation.selectionMember}
        data-content-interactive={presentation.contentInteractive}
        data-crop-editing={cropEditing ? 'true' : undefined}
        data-fit-content-height={presentation.fitContent}
        data-multi-selection={presentation.multiSelection}
        inert={!interactive}
        onKeyDown={elementInteractivity.onKeyDown}
        onContextMenu={elementInteractivity.onContextMenu}
        onDoubleClick={elementInteractivity.onDoubleClick}
        onPointerDown={elementInteractivity.onPointerDown}
        ref={layerRef}
        role={elementInteractivity.role}
        style={{ ...style, pointerEvents: elementInteractivity.pointerEvents }}
        tabIndex={elementInteractivity.tabIndex}
      >
        <div className='editable-canvas-layer-content'>{children}</div>
      </div>
      <CanvasLayerSelectionOverlay
        beginPointer={beginPointer}
        label={label}
        resizeMode={resizeMode}
        rotatable={Boolean(onRotate) && !cropEditing}
        rotation={rotation}
        selectionMode={cropEditing ? 'crop' : 'default'}
        selectionBounds={interactive && presentation.selectionBounds ? selectionBounds : null}
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
