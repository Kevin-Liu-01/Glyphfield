'use client';

import { useLayoutEffect } from 'react';
import { useCommittedRef } from './useCommittedRef';
import { registerStudioProjectSnapshot } from '@/lib/studioProjectSnapshots';
import { useCanvasDocumentAutosave, type CanvasDocumentAutosaveState } from './useCanvasDocumentAutosave';
import {
  usePortableCanvasDocumentSource,
  type PortableCanvasDocumentSource,
} from './usePortableCanvasDocumentSource';
import type { CanvasDocument } from '@/lib/canvasDocument';

export type PortableCanvasWorkspace = PortableCanvasDocumentSource & {
  autosaveState: CanvasDocumentAutosaveState;
};

/**
 * One source lifecycle for every canvas-backed Studio surface: embed assets,
 * serialize the portable document, hydrate its autosave, and persist changes.
 * A null document leaves presentation-only editors outside this lifecycle.
 */
export function usePortableCanvasWorkspace({
  applySource,
  document,
  suspendAutosave = false,
  workspaceKey,
}: {
  applySource: (source: string) => Promise<void> | void;
  document: CanvasDocument | null;
  suspendAutosave?: boolean;
  workspaceKey: string;
}): PortableCanvasWorkspace {
  const portable = usePortableCanvasDocumentSource(document);
  const autosaveState = useCanvasDocumentAutosave({
    applySource,
    enabled: document !== null,
    revision: String(document?.revision ?? ''),
    source: suspendAutosave ? null : portable.source,
    workspaceKey,
  });
  const snapshotRef = useCommittedRef({ autosaveState, document, prepareSource: portable.prepareSource, suspendAutosave });
  useLayoutEffect(() => {
    if (!document) return;
    let mounted = true;
    const unregister = registerStudioProjectSnapshot(workspaceKey, async () => {
      const deadline = Date.now() + 10_000;
      // Some editors debounce document construction separately from autosave.
      // Wait for that current input, never serialize their previous document.
      while (snapshotRef.current.autosaveState === 'loading' || snapshotRef.current.suspendAutosave) {
        if (!mounted || Date.now() >= deadline) throw new Error('This project is still loading or preparing a canvas. Wait a moment and duplicate it again.');
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
      if (!mounted) throw new Error('The editor closed before its current canvas could be copied. Open it and try again.');
      const snapshot = snapshotRef.current;
      if (snapshot.autosaveState === 'error') throw new Error('This project has a save error. Resolve it before duplicating the project.');
      return { source: await snapshot.prepareSource(), revision: String(snapshot.document?.revision ?? '') };
    });
    return () => { mounted = false; unregister(); };
  }, [document !== null, snapshotRef, workspaceKey]);
  return { document: portable.document, error: portable.error, source: portable.source, status: portable.status, autosaveState };
}
