'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import {
  loadAutosavedDesign,
  saveAutosavedDesign,
  writeAutosaveRecovery,
} from '@/lib/savedDesigns';

export type CanvasDocumentAutosaveState = 'error' | 'loading' | 'preparing' | 'saved' | 'saving';

export type CanvasDocumentAutosaveSnapshot = {
  revision: string;
  source: string | null;
};

// Writes outlive an editor mount. A reopened workspace must wait for its previous
// editor's final flush instead of hydrating an older IndexedDB snapshot.
const workspaceWriteQueues = new Map<string, Promise<void>>();

export function canvasDocumentAutosaveSnapshotMatches(
  saved: CanvasDocumentAutosaveSnapshot,
  current: CanvasDocumentAutosaveSnapshot
): boolean {
  return saved.revision === current.revision && saved.source === current.source;
}

export function useCanvasDocumentAutosave({
  applySource,
  delayMs = 180,
  revision,
  source,
  workspaceKey,
}: {
  applySource: (source: string) => Promise<void> | void;
  delayMs?: number;
  revision: string;
  source: string | null;
  workspaceKey: string;
}): CanvasDocumentAutosaveState {
  const [hydrated, setHydrated] = useState(false);
  const [hydrationRetrySignal, setHydrationRetrySignal] = useState(0);
  const [retrySignal, setRetrySignal] = useState(0);
  const [state, setState] = useState<CanvasDocumentAutosaveState>('loading');
  const applySourceRef = useCommittedRef(applySource);
  const hydratedWorkspaceRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const savedSnapshotsRef = useRef(new Map<string, CanvasDocumentAutosaveSnapshot>());
  const snapshotsRef = useRef(new Map<string, CanvasDocumentAutosaveSnapshot>([
    [workspaceKey, { revision, source }],
  ]));
  useLayoutEffect(() => {
    snapshotsRef.current.set(workspaceKey, { revision, source });
  }, [revision, source, workspaceKey]);

  const queue = useCallback((snapshot: { revision: string; source: string }, reportState = true) => {
    if (reportState) setState('saving');
    const capturedAt = new Date().toISOString();
    const pending = (workspaceWriteQueues.get(workspaceKey) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => saveAutosavedDesign(
        workspaceKey,
        snapshot.source,
        snapshot.revision,
        capturedAt
      ));
    workspaceWriteQueues.set(workspaceKey, pending);
    void pending.then(() => {
      if (workspaceWriteQueues.get(workspaceKey) === pending) workspaceWriteQueues.delete(workspaceKey);
      savedSnapshotsRef.current.set(workspaceKey, snapshot);
      if (hydratedWorkspaceRef.current !== workspaceKey) return;
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      const current = snapshotsRef.current.get(workspaceKey);
      if (reportState && current && canvasDocumentAutosaveSnapshotMatches(current, snapshot)) {
        setState('saved');
      }
    }).catch(() => {
      if (workspaceWriteQueues.get(workspaceKey) === pending) workspaceWriteQueues.delete(workspaceKey);
      if (!reportState || hydratedWorkspaceRef.current !== workspaceKey) return;
      setState('error');
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setRetrySignal((current) => current + 1);
      }, Math.max(1_000, delayMs * 4));
    });
  }, [delayMs, workspaceKey]);

  useEffect(() => {
    let active = true;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    hydratedWorkspaceRef.current = null;
    savedSnapshotsRef.current.delete(workspaceKey);
    setHydrated(false);
    setState('loading');
    void (workspaceWriteQueues.get(workspaceKey) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => active ? loadAutosavedDesign(workspaceKey) : null)
      .then(async (draft) => {
        if (!active) return;
        if (draft) {
          await applySourceRef.current(draft.source);
          if (!active) return;
          savedSnapshotsRef.current.set(workspaceKey, {
            revision: draft.revision ?? '',
            source: draft.source,
          });
        }
        hydratedWorkspaceRef.current = workspaceKey;
        setHydrated(true);
        setState(draft ? 'saved' : 'saving');
      }).catch(() => {
        if (!active) return;
        // A failed read says nothing about whether a saved design exists. Keep
        // initial/default state out of storage until that read succeeds.
        hydratedWorkspaceRef.current = null;
        savedSnapshotsRef.current.delete(workspaceKey);
        setHydrated(false);
        setState('error');
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          setHydrationRetrySignal((current) => current + 1);
        }, 1_000);
      });
    return () => {
      active = false;
      if (hydratedWorkspaceRef.current === workspaceKey) hydratedWorkspaceRef.current = null;
    };
  }, [applySourceRef, hydrationRetrySignal, workspaceKey]);

  useEffect(() => {
    if (!hydrated || hydratedWorkspaceRef.current !== workspaceKey) return;
    const snapshot = snapshotsRef.current.get(workspaceKey);
    if (!snapshot) return;
    const snapshotSource = snapshot.source;
    if (snapshotSource === null) {
      setState('preparing');
      return;
    }
    const savedSnapshot = savedSnapshotsRef.current.get(workspaceKey);
    if (savedSnapshot && canvasDocumentAutosaveSnapshotMatches(savedSnapshot, snapshot)) {
      setState('saved');
      return;
    }
    setState((current) => current === 'error' ? current : 'saving');
    const timer = window.setTimeout(() => queue({
      revision: snapshot.revision,
      source: snapshotSource,
    }), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, hydrated, queue, retrySignal, revision, source, workspaceKey]);

  useEffect(() => {
    if (!hydrated || hydratedWorkspaceRef.current !== workspaceKey) return;
    function flush(recoverSynchronously = false) {
      const snapshot = snapshotsRef.current.get(workspaceKey);
      if (!snapshot) return;
      const savedSnapshot = savedSnapshotsRef.current.get(workspaceKey);
      if (
        snapshot.source !== null
        && (!savedSnapshot || !canvasDocumentAutosaveSnapshotMatches(savedSnapshot, snapshot))
      ) {
        if (recoverSynchronously) {
          writeAutosaveRecovery(workspaceKey, snapshot.source, snapshot.revision);
        }
        queue({ revision: snapshot.revision, source: snapshot.source }, false);
      }
    }
    const flushOnPageHide = () => flush(true);
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    window.addEventListener('pagehide', flushOnPageHide);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flushOnPageHide);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      flush();
    };
  }, [hydrated, queue, workspaceKey]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
  }, []);

  return state;
}
