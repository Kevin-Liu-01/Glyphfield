'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { T, useGT } from 'gt-next';
import { History, Maximize2, Minus, Plus, RotateCcw, RotateCw, ScanLine } from '@/components/ui/SolidIcons';

import { Button } from '@/components/ui/Button';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioRange from '@/components/ui/StudioRange';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { isCanvasTextEditingTarget } from '@/lib/canvasInteraction';
import CanvasMinimap, { type CanvasMinimapHandle } from './CanvasMinimap';
import { canvasNavigationBounds, centerCanvasNavigation, fitCanvasNavigation, resizeCanvasNavigationPan,
  type CanvasNavigationItem } from '@/lib/canvasNavigation';
export type { CanvasNavigationItem } from '@/lib/canvasNavigation';

function hasNavigationItems(items: readonly CanvasNavigationItem[] | undefined) {
  return Boolean(items?.length);
}

function OptionalCanvasMinimap(props: Omit<ComponentProps<typeof CanvasMinimap>, 'items'> & { items?: readonly CanvasNavigationItem[] }) {
  return props.items?.length ? <CanvasMinimap {...props} items={props.items} /> : null;
}

import {
  clampCanvasZoom,
  resolveCanvasGridStep,
  resolveCanvasStageTransform,
  resolveCanvasWheelZoomDelta,
  resolveCenteredCanvasPan,
} from '@/lib/canvasViewport';

export type CanvasActionHistory = {
  canRedo: boolean;
  canUndo: boolean;
  entries: Array<{
    current?: boolean;
    detail?: string;
    id: string;
    label: string;
  }>;
  onRedo: () => void;
  onUndo: () => void;
};

function handleHistoryShortcut(event: KeyboardEvent, history?: CanvasActionHistory): boolean {
  if (!history || !(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return false;
  const redo = event.shiftKey;
  if ((redo && history.canRedo) || (!redo && history.canUndo)) {
    event.preventDefault();
    if (redo) history.onRedo();
    else history.onUndo();
  }
  return true;
}

function historyOwnerActive(trigger: HTMLButtonElement | null): boolean {
  return Boolean(trigger?.isConnected && !trigger.closest('[inert], [hidden], .studio-workspace-layer[data-active="false"], .studio-project-workspace-layer[data-active="false"]'));
}

function useCanvasHistoryDismiss(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
  surfaceRef: RefObject<HTMLElement | null>,
  onDismiss: () => void
) {
  const dismissRef = useCommittedRef(onDismiss);
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && (trigger?.contains(event.target) || surfaceRef.current?.contains(event.target))) return;
      dismissRef.current();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      dismissRef.current();
      // Another workspace may have taken focus before its observer is delivered.
      if (!historyOwnerActive(trigger)) return;
      event.preventDefault();
      trigger?.focus({ preventScroll: true });
    };
    const owners = [
      trigger?.closest<HTMLElement>('.studio-workspace-layer'),
      trigger?.closest<HTMLElement>('.studio-project-workspace-layer'),
    ].filter((owner): owner is HTMLElement => Boolean(owner));
    const dismissInactive = () => {
      if (!historyOwnerActive(trigger)) dismissRef.current();
    };
    // Observe just the owning retained layers, never the whole page.
    const observer = new MutationObserver(dismissInactive);
    owners.forEach((owner) => observer.observe(owner, { attributes: true, attributeFilter: ['data-active', 'inert', 'hidden'] }));
    dismissInactive();
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [dismissRef, open, surfaceRef, triggerRef]);
}

export default function CanvasViewport({
  actionHistory,
  autoFit = false,
  children,
  className = '',
  draftKey = 'canvas-zoom',
  fitKey,
  focusKey,
  focusOffsetY = 0,
  fontFamily,
  fontWeight,
  identityId,
  initialPan = { x: 0, y: 0 },
  initialViewReady = true,
  initialZoom = 100,
  maxZoom = 200,
  minZoom = 40,
  navigationItems,
  onDeselect,
  stageClassName = '',
  toolId,
}: {
  actionHistory?: CanvasActionHistory;
  autoFit?: boolean;
  children: ReactNode;
  className?: string;
  draftKey?: string;
  fitKey?: number | string;
  focusKey?: string;
  focusOffsetY?: number;
  fontFamily?: CSSProperties['fontFamily'];
  fontWeight?: CSSProperties['fontWeight'];
  identityId: string;
  initialPan?: { x: number; y: number };
  initialViewReady?: boolean;
  initialZoom?: number;
  maxZoom?: number;
  minZoom?: number;
  navigationItems?: readonly CanvasNavigationItem[];
  onDeselect?: () => void;
  stageClassName?: string;
  toolId: string;
}) {
  const gt = useGT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<CanvasMinimapHandle>(null);
  const navigationSizeRef = useRef({ width: 0, height: 0 });
  const [navigationSize, setNavigationSize] = useState(navigationSizeRef.current);
  const wheelDeltaRef = useRef(0);
  const canvasHoveredRef = useRef(false);
  const fitKeyRef = useRef(fitKey);
  const panRef = useRef<{
    currentX: number;
    currentY: number;
    pointerId: number;
    startPanX: number;
    startPanY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const [zoom, setZoom] = useStudioDraft(identityId, toolId, draftKey, initialZoom);
  const constrainedZoom = clampCanvasZoom(zoom, minZoom, maxZoom);
  const zoomRef = useCommittedRef(constrainedZoom);
  const [panOffset, setPanOffset] = useState(initialPan);
  const [viewInitialized, setViewInitialized] = useState(initialViewReady);
  const viewInitializedRef = useCommittedRef(viewInitialized);
  const viewInitializing = !initialViewReady || !viewInitialized;
  const panOffsetRef = useCommittedRef(panOffset);
  const navigationView = useMemo(() => ({ pan: panOffset, zoom: constrainedZoom, ...navigationSize }),
    [constrainedZoom, navigationSize, panOffset]);
  const navigationEnabled = hasNavigationItems(navigationItems);
  const [spacePressed, setSpacePressed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
  const historySurfaceRef = useRef<HTMLElement>(null);
  useCanvasHistoryDismiss(historyOpen, historyTriggerRef, historySurfaceRef, () => setHistoryOpen(false));
  const actionHistoryRef = useCommittedRef(actionHistory);
  const [viewMenuPosition, setViewMenuPosition] = useState<StudioContextMenuPosition | null>(null);
  useCanvasSelectionDismiss(viewportRef, onDeselect);

  function applyStageTransform(x: number, y: number) {
    if (!stageRef.current) return;
    stageRef.current.style.transform = resolveCanvasStageTransform({ x, y, zoom: zoomRef.current });
    scrollRef.current?.style.setProperty('--canvas-grid-x', `${x}px`);
    scrollRef.current?.style.setProperty('--canvas-grid-y', `${y}px`);
    scrollRef.current?.style.setProperty('--canvas-grid-step', `${resolveCanvasGridStep(zoomRef.current)}px`);
    minimapRef.current?.updateView({ pan: { x, y }, zoom: zoomRef.current, ...navigationSizeRef.current });
  }

  function navigateCanvas(pan: { x: number; y: number }, commit: boolean) {
    applyStageTransform(pan.x, pan.y);
    if (!commit) return;
    panOffsetRef.current = pan;
    setPanOffset(pan);
  }

  function fitAllArtboards() {
    if (!navigationItems?.length) return;
    const next = fitCanvasNavigation(navigationItems, { ...navigationView, zoom: zoomRef.current }, minZoom, maxZoom);
    zoomRef.current = next.zoom;
    setZoom(next.zoom);
    navigateCanvas(next.pan, true);
  }

  function centerSelectedArtboard() {
    const selected = navigationItems?.filter((item) => item.active);
    if (!selected?.length) return;
    const bounds = canvasNavigationBounds(selected);
    navigateCanvas(centerCanvasNavigation({ ...navigationView, zoom: zoomRef.current }, {
      x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
    }), true);
  }

  function cancelPanFrame() {
    if (panFrameRef.current === null) return;
    window.cancelAnimationFrame(panFrameRef.current);
    panFrameRef.current = null;
  }

  function schedulePanTransform() {
    if (panFrameRef.current !== null) return;
    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null;
      const pan = panRef.current;
      if (pan) applyStageTransform(pan.currentX, pan.currentY);
    });
  }

  function changeZoom(value: number, point?: { x: number; y: number }) {
    const nextZoom = clampCanvasZoom(value, minZoom, maxZoom);
    const scrollElement = scrollRef.current;
    const currentZoom = zoomRef.current;
    if (!scrollElement || nextZoom === currentZoom) return;
    const anchor = point ?? {
      x: scrollElement.clientWidth / 2,
      y: scrollElement.clientHeight / 2,
    };
    const ratio = nextZoom / Math.max(1, currentZoom);
    const current = panOffsetRef.current;
    const nextPan = {
      x: anchor.x - (anchor.x - current.x) * ratio,
      y: anchor.y - (anchor.y - current.y) * ratio,
    };
    panOffsetRef.current = nextPan;
    zoomRef.current = nextZoom;
    applyStageTransform(nextPan.x, nextPan.y);
    setPanOffset(nextPan);
    setZoom(nextZoom);
  }

  const handleCanvasWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    const delta = resolveCanvasWheelZoomDelta({
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
    });
    if (delta === 0) return;
    wheelDeltaRef.current += delta;
    const zoomSteps = Math.trunc(wheelDeltaRef.current / 40);
    if (zoomSteps === 0) return;
    wheelDeltaRef.current -= zoomSteps * 40;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const bounds = scrollElement.getBoundingClientRect();
    changeZoom(zoomRef.current - zoomSteps * 5, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  });

  function fitCanvas() {
    const scrollElement = scrollRef.current;
    const stageElement = stageRef.current;
    if (!scrollElement || !stageElement) return;
    const fitTargets = Array.from(stageElement.querySelectorAll<HTMLElement>('[data-canvas-fit-target="true"]'));
    const fitBounds = fitTargets.length > 0
      ? fitTargets.reduce((bounds, target) => ({
          bottom: Math.max(bounds.bottom, target.offsetTop + target.offsetHeight),
          left: Math.min(bounds.left, target.offsetLeft),
          right: Math.max(bounds.right, target.offsetLeft + target.offsetWidth),
          top: Math.min(bounds.top, target.offsetTop - 36),
        }), { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity })
      : { bottom: stageElement.offsetHeight, left: 0, right: stageElement.offsetWidth, top: 0 };
    const fitWidth = Math.max(1, fitBounds.right - fitBounds.left);
    const fitHeight = Math.max(1, fitBounds.bottom - fitBounds.top);
    const fittedZoom = clampCanvasZoom(Math.min(
      100,
      (scrollElement.clientWidth - 48) / fitWidth * 100,
      (scrollElement.clientHeight - 48) / fitHeight * 100
    ), minZoom, maxZoom);
    const scale = fittedZoom / 100;
    zoomRef.current = fittedZoom;
    setZoom(fittedZoom);
    const nextPan = {
      x: (scrollElement.clientWidth - fitWidth * scale) / 2 - fitBounds.left * scale,
      y: (scrollElement.clientHeight - fitHeight * scale) / 2 - fitBounds.top * scale,
    };
    panOffsetRef.current = nextPan;
    setPanOffset(nextPan);
  }

  useMountEffect(() => {
    // A restored editor supplies its focus target only after its document is ready.
    // Do not paint the default centering before that first, authoritative focus.
    if (!initialViewReady || focusKey) return;
    const scrollElement = scrollRef.current;
    let animationFrame = 0;

    function syncView() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (autoFit) fitCanvas();
        else {
          const nextPan = resolveCenteredCanvasPan({
            initialPan,
            viewportHeight: scrollElement?.clientHeight ?? 0,
            viewportWidth: scrollElement?.clientWidth ?? 0,
            zoom: zoomRef.current,
          });
          panOffsetRef.current = nextPan;
          setPanOffset(nextPan);
        }
      });
    }

    syncView();
    if (!autoFit || navigationEnabled || !scrollElement || !('ResizeObserver' in window)) {
      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new ResizeObserver(syncView);
    observer.observe(scrollElement);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  });

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    if (!navigationEnabled || !scrollElement) return;
    const resize = () => {
      const size = { width: scrollElement.clientWidth, height: scrollElement.clientHeight };
      const previous = navigationSizeRef.current;
      if (!size.width || !size.height || (size.width === previous.width && size.height === previous.height)) return;
      navigationSizeRef.current = size;
      setNavigationSize(size);
      if (previous.width && previous.height && viewInitializedRef.current) {
        navigateCanvas(resizeCanvasNavigationPan({ ...previous, pan: panOffsetRef.current, zoom: zoomRef.current }, size), true);
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [navigationEnabled]);

  useEffect(() => () => cancelPanFrame(), []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => scrollElement.removeEventListener('wheel', handleCanvasWheel);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || viewportRef.current?.closest('[inert]')) return;
      const target = event.target;
      const editing = isCanvasTextEditingTarget(target);
      const canvasFocused = viewportRef.current?.contains(document.activeElement) ?? false;
      if (editing || (!canvasHoveredRef.current && !canvasFocused)) return;
      if (handleHistoryShortcut(event, actionHistoryRef.current)) return;
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      setSpacePressed(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpacePressed(false);
    }

    function handleBlur() {
      setSpacePressed(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [actionHistoryRef]);

  useEffect(() => {
    if (fitKey === undefined || fitKey === fitKeyRef.current) {
      fitKeyRef.current = fitKey;
      return;
    }
    fitKeyRef.current = fitKey;
    const frame = window.requestAnimationFrame(fitCanvas);
    return () => window.cancelAnimationFrame(frame);
  }, [fitKey]);

  useLayoutEffect(() => {
    if (!initialViewReady) return;
    if (!focusKey) {
      setViewInitialized(true);
      return;
    }
    const scrollElement = scrollRef.current;
    const stageElement = stageRef.current;
    const target = stageElement?.querySelector<HTMLElement>('[data-canvas-focus-target="true"]');
    if (!scrollElement || !stageElement || !target) return;
    const focusTarget = () => {
      const focusedZoom = clampCanvasZoom(Math.min(
        100,
        (scrollElement.clientWidth - 96) / Math.max(1, target.offsetWidth) * 100,
        (scrollElement.clientHeight - 96) / Math.max(1, target.offsetHeight) * 100
      ), minZoom, maxZoom);
      const scale = focusedZoom / 100;
      zoomRef.current = focusedZoom;
      setZoom(focusedZoom);
      const nextPan = {
        x: scrollElement.clientWidth / 2 - (target.offsetLeft + target.offsetWidth / 2) * scale,
        y: scrollElement.clientHeight / 2 - (target.offsetTop + target.offsetHeight / 2) * scale + focusOffsetY,
      };
      panOffsetRef.current = nextPan;
      setPanOffset(nextPan);
      setViewInitialized(true);
    };
    if (!viewInitializedRef.current && 'ResizeObserver' in window) {
      // The restored editor is still hidden. Wait for browser layout instead of
      // forcing its first full geometry calculation inside React's commit.
      const observer = new ResizeObserver(() => {
        observer.disconnect();
        focusTarget();
      });
      observer.observe(scrollElement);
      return () => observer.disconnect();
    }
    focusTarget();
  }, [focusKey, focusOffsetY, initialViewReady, viewInitializedRef, zoomRef]);

  function resetView() {
    wheelDeltaRef.current = 0;
    zoomRef.current = 100;
    setZoom(100);
    panOffsetRef.current = initialPan;
    setPanOffset(initialPan);
  }

  function openViewMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      isCanvasTextEditingTarget(target)
      || (target instanceof Element
      && target.closest('button, a, [data-canvas-interactive], [data-studio-context-trigger]'))
    ) return;
    event.preventDefault();
    setViewMenuPosition(contextMenuPositionFromEvent(event));
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>, forcePan = false) {
    if (panRef.current || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1)) return;
    const target = event.target;
    if (!forcePan && (isCanvasTextEditingTarget(target) || (target instanceof Element
      && target.closest('button, a, .editable-canvas-layer, [data-canvas-interactive]')))) return;
    const currentPan = panOffsetRef.current;
    panRef.current = { currentX: currentPan.x, currentY: currentPan.y, pointerId: event.pointerId,
      startPanX: currentPan.x, startPanY: currentPan.y, startX: event.clientX, startY: event.clientY };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.setAttribute('data-panning', 'true');
  }

  return (
    <div
      aria-busy={viewInitializing || undefined}
      className={`canvas-viewport ${className}`}
      onPointerDownCapture={(event) => {
        if (event.button === 1 || spacePressed) return;
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
        <Button aria-label={gt('Zoom out')} disabled={constrainedZoom <= minZoom} onClick={() => changeZoom(constrainedZoom - 10)} size='icon-sm' title={gt('Zoom out')} type='button' variant='ghost'>
          <Minus aria-hidden='true' />
        </Button>
        <label className='canvas-zoom-range'>
          <span className='sr-only'><T>Canvas zoom</T></span>
          <StudioRange max={maxZoom} min={minZoom} onChange={(event) => changeZoom(Number(event.target.value))} step={5} value={constrainedZoom} />
        </label>
        <button className='canvas-zoom-value' onClick={() => changeZoom(100)} title={gt('Reset to 100%')} type='button'>{constrainedZoom}%</button>
        <Button aria-label={gt('Zoom in')} disabled={constrainedZoom >= maxZoom} onClick={() => changeZoom(constrainedZoom + 10)} size='icon-sm' title={gt('Zoom in')} type='button' variant='ghost'>
          <Plus aria-hidden='true' />
        </Button>
        <span className='canvas-toolbar-divider' />
        <Button aria-label={gt('Reset view')} onClick={resetView} size='icon-sm' title={gt('Reset view')} type='button' variant='ghost'>
          <ScanLine aria-hidden='true' />
        </Button>
        <Button aria-label={gt('Fit canvas')} onClick={fitCanvas} size='icon-sm' title={gt('Fit canvas')} type='button' variant='ghost'>
          <Maximize2 aria-hidden='true' />
        </Button>
        {actionHistory ? (
          <>
            <span className='canvas-toolbar-divider' />
            <Button aria-keyshortcuts='Meta+Z Control+Z' aria-label={gt('Undo')} disabled={!actionHistory.canUndo} onClick={actionHistory.onUndo} size='icon-sm' title={gt('Undo')} type='button' variant='ghost'>
              <RotateCcw aria-hidden='true' />
            </Button>
            <Button aria-keyshortcuts='Meta+Shift+Z Control+Shift+Z' aria-label={gt('Redo')} disabled={!actionHistory.canRedo} onClick={actionHistory.onRedo} size='icon-sm' title={gt('Redo')} type='button' variant='ghost'>
              <RotateCw aria-hidden='true' />
            </Button>
            <Button
              aria-expanded={historyOpen}
              aria-haspopup='dialog'
              aria-label={gt('Action history')}
              onClick={() => setHistoryOpen((open) => !open)}
              ref={historyTriggerRef}
              size='icon-sm'
              title={gt('Action history')}
              type='button'
              variant='ghost'
            >
              <History aria-hidden='true' />
            </Button>
          </>
        ) : null}
      </div>
      <OptionalCanvasMinimap ref={minimapRef} items={navigationItems} view={navigationView}
        onPan={navigateCanvas} onFitAll={fitAllArtboards} onCenterSelected={centerSelectedArtboard} />
      {actionHistory && historyOpen ? (
        <aside aria-label={gt('Action history')} className='canvas-action-history' data-canvas-selection-preserve ref={historySurfaceRef} role='dialog'>
          <header>
            <span><History aria-hidden='true' /><strong><T>Action history</T></strong></span>
          </header>
          <ol className='studio-scroll-area'>
            {actionHistory.entries.length > 0 ? actionHistory.entries.map((entry) => (
              <li aria-current={entry.current ? 'step' : undefined} key={entry.id}>
                <span aria-hidden='true' />
                <div><strong>{entry.label}</strong>{entry.detail ? <small>{entry.detail}</small> : null}</div>
              </li>
            )) : <li className='canvas-action-history-empty'><div><strong><T>No canvas actions yet</T></strong></div></li>}
          </ol>
        </aside>
      ) : null}
      <div
        aria-keyshortcuts='Shift+F10'
        aria-label={gt('Canvas viewport')}
        className='canvas-viewport-scroll'
        data-space-pressed={spacePressed ? 'true' : undefined}
        onContextMenu={openViewMenu}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
            event.preventDefault();
            setViewMenuPosition(contextMenuPositionFromElement(event.currentTarget));
          }
        }}
        onPointerCancel={(event) => {
          if (panRef.current?.pointerId !== event.pointerId) return;
          cancelPanFrame();
          panRef.current = null;
          applyStageTransform(panOffsetRef.current.x, panOffsetRef.current.y);
          event.currentTarget.removeAttribute('data-panning');
        }}
        onPointerDown={(event) => {
          beginPan(event);
        }}
        onPointerDownCapture={(event) => {
          if (event.button !== 1 && !spacePressed) return;
          beginPan(event, true);
          event.stopPropagation();
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (!pan || pan.pointerId !== event.pointerId) return;
          event.preventDefault();
          pan.currentX = pan.startPanX + event.clientX - pan.startX;
          pan.currentY = pan.startPanY + event.clientY - pan.startY;
          schedulePanTransform();
        }}
        onPointerUp={(event) => {
          const pan = panRef.current;
          if (pan?.pointerId !== event.pointerId) return;
          cancelPanFrame();
          applyStageTransform(pan.currentX, pan.currentY);
          panRef.current = null;
          panOffsetRef.current = { x: pan.currentX, y: pan.currentY };
          setPanOffset({ x: pan.currentX, y: pan.currentY });
          event.currentTarget.removeAttribute('data-panning');
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerEnter={() => {
          canvasHoveredRef.current = true;
        }}
        onPointerLeave={() => {
          canvasHoveredRef.current = false;
        }}
        ref={scrollRef}
        role='region'
        style={{
          '--canvas-grid-step': `${resolveCanvasGridStep(constrainedZoom)}px`,
          '--canvas-grid-x': `${panOffset.x}px`,
          '--canvas-grid-y': `${panOffset.y}px`,
        } as CSSProperties}
        tabIndex={0}
      >
        <div
          className={`canvas-viewport-stage ${stageClassName}`}
          data-canvas-font={fontFamily ? 'enforced' : undefined}
          data-canvas-initializing={viewInitializing ? 'true' : undefined}
          ref={stageRef}
          style={{
            '--canvas-selected-font': fontFamily,
            '--canvas-zoom': constrainedZoom / 100,
            '--canvas-zoom-inverse': 100 / constrainedZoom,
            fontFamily,
            fontWeight,
            transform: resolveCanvasStageTransform({ ...panOffset, zoom: constrainedZoom }),
            visibility: viewInitializing ? 'hidden' : undefined,
          } as CSSProperties}
        >
          {children}
        </div>
      </div>
      <StudioContextMenu
        detail={`${constrainedZoom}% zoom`}
        label={gt('Canvas view')}
        onClose={() => setViewMenuPosition(null)}
        position={viewMenuPosition}
        sections={[
          {
            items: [
              { icon: <Maximize2 aria-hidden='true' />, id: 'fit', label: gt('Fit canvas'), onSelect: fitCanvas, shortcut: 'F' },
              { icon: <ScanLine aria-hidden='true' />, id: 'reset', label: gt('Reset view'), onSelect: resetView },
            ],
          },
          {
            label: gt('Zoom'),
            items: [
              { disabled: constrainedZoom >= maxZoom, icon: <Plus aria-hidden='true' />, id: 'zoom-in', label: gt('Zoom in'), onSelect: () => changeZoom(constrainedZoom + 10), shortcut: '+' },
              { disabled: constrainedZoom <= minZoom, icon: <Minus aria-hidden='true' />, id: 'zoom-out', label: gt('Zoom out'), onSelect: () => changeZoom(constrainedZoom - 10), shortcut: '−' },
              { checked: constrainedZoom === 100, icon: <span aria-hidden='true'>1:1</span>, id: 'actual-size', label: gt('Actual size'), onSelect: () => changeZoom(100), shortcut: '100%' },
            ],
          },
        ]}
      />
    </div>
  );
}
