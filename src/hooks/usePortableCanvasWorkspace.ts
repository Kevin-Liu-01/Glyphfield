'use client';

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
  return { ...portable, autosaveState };
}
