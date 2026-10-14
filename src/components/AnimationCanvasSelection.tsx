'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';

import { resolveSequencePosition, type SequenceLayout } from '@/lib/animation';

const noSubscription = () => () => {};
const hiddenOnServer = () => -1;

/**
 * Selection geometry describes a static hold, never a moving transition. A
 * render-prop child also receives the time into the hold, so keyframed layers
 * show their pose at the paused playhead.
 */
export default function AnimationCanvasSelection({
  active,
  children,
  currentMsRef,
  isPlaying,
  layout,
  selectedIndex,
  subscribeToPlayhead,
  viewportVisible = true,
}: {
  active: boolean;
  children: ReactNode | ((sceneElapsedMs: number) => ReactNode);
  currentMsRef: { current: number };
  isPlaying: boolean;
  layout: SequenceLayout;
  selectedIndex: number;
  subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
  viewportVisible?: boolean;
}) {
  const enabled = active && viewportVisible && !isPlaying && selectedIndex >= 0 && selectedIndex < layout.count;
  const tracksTime = typeof children === 'function';
  const readScene = useCallback(() => {
    if (!enabled) return -1;
    const position = resolveSequencePosition(currentMsRef.current, layout);
    if (position.phase !== 'hold' || position.index !== selectedIndex) return -1;
    // A boolean-like snapshot for static children updates only on visibility changes.
    return tracksTime ? Math.round(position.sceneElapsedMs ?? 0) : 0;
  }, [currentMsRef, enabled, layout, selectedIndex, tracksTime]);
  // This boundary re-renders when visibility (or, for keyframed layers, the
  // paused scene time) changes, never the Studio or its controls per tick.
  const sceneElapsedMs = useSyncExternalStore(
    enabled ? subscribeToPlayhead : noSubscription,
    readScene,
    hiddenOnServer
  );
  if (sceneElapsedMs < 0) return null;
  return typeof children === 'function' ? children(sceneElapsedMs) : children;
}
