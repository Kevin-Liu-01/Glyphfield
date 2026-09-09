'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';

import { resolveTimeline } from '@/lib/animation';

const noSubscription = () => () => {};
const hiddenOnServer = () => false;

/** Selection geometry describes a static hold, never a moving transition. */
export default function AnimationCanvasSelection({
  active,
  children,
  currentMsRef,
  holdMs,
  isPlaying,
  itemCount,
  selectedIndex,
  subscribeToPlayhead,
  transitionMs,
  viewportVisible = true,
}: {
  active: boolean;
  children: ReactNode;
  currentMsRef: { current: number };
  holdMs: number;
  isPlaying: boolean;
  itemCount: number;
  selectedIndex: number;
  subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
  transitionMs: number;
  viewportVisible?: boolean;
}) {
  const enabled = active && viewportVisible && !isPlaying && selectedIndex >= 0 && selectedIndex < itemCount;
  const readVisible = useCallback(() => {
    if (!enabled) return false;
    const position = resolveTimeline(currentMsRef.current, { holdMs, itemCount, transitionMs });
    return position.phase === 'hold' && position.index === selectedIndex;
  }, [currentMsRef, enabled, holdMs, itemCount, selectedIndex, transitionMs]);
  // A boolean snapshot updates only this boundary when selection visibility
  // changes, without rendering the Studio or its controls on every clock tick.
  const visible = useSyncExternalStore(
    enabled ? subscribeToPlayhead : noSubscription,
    readVisible,
    hiddenOnServer
  );
  return visible ? children : null;
}
