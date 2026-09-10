'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import {
  checkpointCanvasHistory,
  redoCanvasCheckpointHistory,
  undoCanvasCheckpointHistory,
  type CanvasCheckpointHistory,
} from '@/lib/canvasCheckpointHistory';
import { useCommittedRef } from './useCommittedRef';

type Entry<T> = { id: string; label: string; signature: string; value: T };

/** Immutable editor snapshots: no serialization, DOM reads, or playback ticks. */
export function useAnimationActionHistory<T>({ disabled, enabled, onRestore, scope, value, workspaceRef }: {
  disabled: boolean;
  enabled: boolean;
  onRestore: (value: T) => void;
  scope: string;
  value: T;
  workspaceRef: RefObject<HTMLElement | null>;
}) {
  const sequenceRef = useRef(0);
  const live = useMemo<Entry<T>>(() => {
    const id = `animation-action-${++sequenceRef.current}`;
    return { id, label: 'Edited animation', signature: id, value };
  }, [value]);
  const liveRef = useCommittedRef(live);
  const restoreRef = useCommittedRef(onRestore);
  const historyRef = useRef<CanvasCheckpointHistory<Entry<T>>>({ past: [], present: null, future: [] });
  const restoringRef = useRef(false);
  const scopeRef = useRef(scope);
  const timerRef = useRef(0);
  const pointersRef = useRef(new Set<number>());
  const [, refresh] = useState(0);
  const commit = useCallback(() => {
    if (pointersRef.current.size > 0) return;
    const next = checkpointCanvasHistory(historyRef.current, liveRef.current);
    if (next !== historyRef.current) {
      historyRef.current = next;
      refresh((revision) => revision + 1);
    }
  }, [liveRef]);

  useLayoutEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!enabled || scopeRef.current !== scope) {
      scopeRef.current = scope;
      historyRef.current = { past: [], present: null, future: [] };
    }
    if (!enabled) return;
    if (restoringRef.current && historyRef.current.present) {
      // The host normalizes restored values. Adopt those new references without
      // recording normalization as another user edit or destroying redo.
      historyRef.current.present = { ...historyRef.current.present, signature: live.signature, value: live.value };
      return;
    }
    if (!historyRef.current.present) {
      historyRef.current = checkpointCanvasHistory(historyRef.current, { ...live, label: 'Opened animation' });
      refresh((revision) => revision + 1);
      return;
    }
    if (historyRef.current.present.signature !== live.signature) timerRef.current = window.setTimeout(commit, 450);
    return () => window.clearTimeout(timerRef.current);
  }, [commit, enabled, live, scope]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const start = (event: PointerEvent) => {
      if (event.target instanceof Node && workspaceRef.current?.contains(event.target)) pointersRef.current.add(event.pointerId);
    };
    const finish = (event: Event) => {
      const ownedPointer = event instanceof PointerEvent && pointersRef.current.delete(event.pointerId);
      if (!ownedPointer && (!(event.target instanceof Node) || !workspaceRef.current?.contains(event.target))) return;
      window.clearTimeout(timerRef.current);
      // Target handlers commit native range values after this capture listener.
      timerRef.current = window.setTimeout(commit, 0);
    };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('change', finish, true);
    return () => {
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('change', finish, true);
      window.clearTimeout(timerRef.current);
      pointersRef.current.clear();
    };
  }, [commit, enabled, workspaceRef]);

  const restore = (direction: 'undo' | 'redo') => {
    if (!enabled || disabled) return;
    window.clearTimeout(timerRef.current);
    const result = direction === 'undo'
      ? undoCanvasCheckpointHistory(historyRef.current, liveRef.current)
      : redoCanvasCheckpointHistory(historyRef.current, liveRef.current.signature);
    if (!result) return;
    historyRef.current = result.history;
    restoringRef.current = true;
    try {
      flushSync(() => restoreRef.current(result.restored.value));
    } finally {
      restoringRef.current = false;
      refresh((revision) => revision + 1);
    }
  };
  const history = historyRef.current;
  return {
    canRedo: enabled && !disabled && history.present?.signature === live.signature && history.future.length > 0,
    canUndo: enabled && !disabled && Boolean(history.present && (history.past.length > 0 || history.present.signature !== live.signature)),
    entries: [...history.past, ...(history.present ? [history.present] : [])].map((entry) => ({
      id: entry.id, label: entry.label, current: entry === history.present,
    })),
    onRedo: () => restore('redo'),
    onUndo: () => restore('undo'),
  };
}
