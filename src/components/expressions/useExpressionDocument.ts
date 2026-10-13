'use client';

import { useCallback, useRef, useState } from 'react';

import type { CanvasDocument } from '@/lib/canvasDocument';

const HISTORY_LIMIT = 120;
const COALESCE_WINDOW_MS = 900;

export type CommitOptions = {
  /** Consecutive commits with the same key inside a short window share one undo step. */
  coalesce?: string;
  label?: string;
};

export type ExpressionCommit = (
  update: CanvasDocument | ((current: CanvasDocument) => CanvasDocument),
  options?: CommitOptions
) => CanvasDocument;

type HistoryEntry = { document: CanvasDocument; label: string };

/**
 * Owns the expression document and its undo stack. Documents are immutable, so
 * history keeps references, not clones; untouched layers stay referentially
 * equal and their memoized canvas layers skip rendering.
 */
export function useExpressionDocument(initial: () => CanvasDocument) {
  const [snapshot, setSnapshot] = useState(() => ({ document: initial(), version: 0 }));
  const documentRef = useRef(snapshot.document);
  const stackRef = useRef<{ at: number; future: HistoryEntry[]; key: string; past: HistoryEntry[] }>({ at: 0, future: [], key: '', past: [] });
  const editedRef = useRef(false);

  const publish = useCallback((document: CanvasDocument) => {
    documentRef.current = document;
    setSnapshot((current) => ({ document, version: current.version + 1 }));
  }, []);

  const commit = useCallback<ExpressionCommit>((update, options = {}) => {
    const current = documentRef.current;
    const next = typeof update === 'function' ? update(current) : update;
    if (next === current) return current;
    const stack = stackRef.current;
    const now = Date.now();
    const coalesce = Boolean(options.coalesce) && stack.key === options.coalesce && now - stack.at < COALESCE_WINDOW_MS;
    if (!coalesce) {
      stack.past.push({ document: current, label: options.label ?? 'Edit' });
      if (stack.past.length > HISTORY_LIMIT) stack.past.shift();
    }
    stack.future = [];
    stack.key = options.coalesce ?? '';
    stack.at = now;
    editedRef.current = true;
    publish(next);
    return next;
  }, [publish]);

  const undo = useCallback(() => {
    const stack = stackRef.current;
    const previous = stack.past.pop();
    if (!previous) return false;
    stack.future.unshift({ document: documentRef.current, label: previous.label });
    stack.key = '';
    publish(previous.document);
    return true;
  }, [publish]);

  const redo = useCallback(() => {
    const stack = stackRef.current;
    const next = stack.future.shift();
    if (!next) return false;
    stack.past.push({ document: documentRef.current, label: next.label });
    stack.key = '';
    publish(next.document);
    return true;
  }, [publish]);

  /** Replace without an undo step (hydration from autosave or a template reset). */
  const reset = useCallback((document: CanvasDocument) => {
    stackRef.current = { at: 0, future: [], key: '', past: [] };
    publish(document);
  }, [publish]);

  const stack = stackRef.current;
  return {
    canRedo: stack.future.length > 0,
    canUndo: stack.past.length > 0,
    commit,
    document: snapshot.document,
    documentRef,
    editedRef,
    entries: [
      ...stack.past.slice(-12).map((entry, index) => ({ id: `past-${stack.past.length - 12 + index}`, label: entry.label })),
      ...stack.future.slice(0, 6).map((entry, index) => ({ detail: 'Undone', id: `future-${index}`, label: entry.label })),
    ],
    redo,
    reset,
    undo,
  };
}
