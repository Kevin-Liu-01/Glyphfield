'use client';

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from '@/components/ui/SolidIcons';
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

type ResizeEdge = 'left' | 'right';

type ResizableSidebarProps = {
  children: ReactNode;
  className?: string;
  defaultWidth?: number;
  label: string;
  maxWidth?: number;
  minWidth?: number;
  resizeEdge?: ResizeEdge;
  storageKey: string;
};

const COLLAPSED_WIDTH = 40;

function readStoredNumber(key: string, fallback: number) {
  const storedValue = window.localStorage.getItem(key);
  if (storedValue === null) return fallback;
  const value = Number(storedValue);
  return Number.isFinite(value) ? value : fallback;
}

function readStoredBoolean(key: string) {
  return window.localStorage.getItem(key) === 'true';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function ResizableSidebar({
  children,
  className = '',
  defaultWidth = 292,
  label,
  maxWidth = 520,
  minWidth = 220,
  resizeEdge = 'right',
  storageKey,
}: ResizableSidebarProps) {
  const widthStorageKey = `glyphfield:sidebar:${storageKey}:width`;
  const collapsedStorageKey = `glyphfield:sidebar:${storageKey}:collapsed`;
  const [width, setWidth] = useState(() =>
    clamp(defaultWidth, minWidth, maxWidth)
  );
  const [collapsed, setCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef({
    currentWidth: width,
    pointerId: 0,
    startWidth: width,
    startX: 0,
  });

  useMountEffect(() => {
    setWidth(
      clamp(readStoredNumber(widthStorageKey, defaultWidth), minWidth, maxWidth)
    );
    setCollapsed(readStoredBoolean(collapsedStorageKey));
  });

  const style = {
    '--resizable-sidebar-expanded-width': `${width}px`,
    width: collapsed ? `${COLLAPSED_WIDTH}px` : `${width}px`,
  } as CSSProperties;

  function storeWidth(nextWidth: number) {
    window.localStorage.setItem(widthStorageKey, String(nextWidth));
  }

  function updateWidth(nextWidth: number) {
    const clampedWidth = clamp(nextWidth, minWidth, maxWidth);
    dragRef.current.currentWidth = clampedWidth;
    setWidth(clampedWidth);
    return clampedWidth;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (collapsed || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      currentWidth: width,
      pointerId: event.pointerId,
      startWidth: width,
      startX: event.clientX,
    };
    setResizing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    const direction = resizeEdge === 'right' ? 1 : -1;
    updateWidth(
      dragRef.current.startWidth +
        (event.clientX - dragRef.current.startX) * direction
    );
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    setResizing(false);
    storeWidth(dragRef.current.currentWidth);
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (collapsed) return;
    const step = event.shiftKey ? 32 : 8;
    let nextWidth: number | null = null;

    if (event.key === 'Home') nextWidth = minWidth;
    if (event.key === 'End') nextWidth = maxWidth;
    if (event.key === 'ArrowLeft') {
      nextWidth = width + (resizeEdge === 'left' ? step : -step);
    }
    if (event.key === 'ArrowRight') {
      nextWidth = width + (resizeEdge === 'left' ? -step : step);
    }
    if (nextWidth === null) return;

    event.preventDefault();
    const clampedWidth = updateWidth(nextWidth);
    storeWidth(clampedWidth);
  }

  function toggleCollapsed() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    window.localStorage.setItem(collapsedStorageKey, String(nextCollapsed));
  }

  const CollapseIcon = resizeEdge === 'right' ? PanelLeftClose : PanelRightClose;
  const RestoreIcon = resizeEdge === 'right' ? PanelLeftOpen : PanelRightOpen;
  const ToggleIcon = collapsed ? RestoreIcon : CollapseIcon;

  return (
    <aside
      className={`resizable-sidebar ${className}`}
      data-canvas-selection-preserve
      data-collapsed={collapsed ? 'true' : 'false'}
      data-resize-edge={resizeEdge}
      data-resizing={resizing ? 'true' : 'false'}
      style={style}
    >
      <div className='resizable-sidebar-scroll studio-scroll-area'>{children}</div>
      <button
        aria-label={`${collapsed ? 'Show' : 'Hide'} ${label}`}
        className='resizable-sidebar-toggle'
        onClick={toggleCollapsed}
        title={`${collapsed ? 'Show' : 'Hide'} ${label}`}
        type='button'
      >
        <ToggleIcon aria-hidden='true' />
      </button>
      <div
        aria-label={`Resize ${label}`}
        aria-orientation='vertical'
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={width}
        className='resizable-sidebar-handle'
        onKeyDown={handleResizeKeyDown}
        onPointerCancel={finishResize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishResize}
        role='separator'
        tabIndex={collapsed ? -1 : 0}
      />
    </aside>
  );
}
