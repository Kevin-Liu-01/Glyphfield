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
 */
export function usePortableCanvasWorkspace({
  applySource,
  document,
  workspaceKey,
}: {
  applySource: (source: string) => Promise<void> | void;
  document: CanvasDocument;
  workspaceKey: string;
}): PortableCanvasWorkspace {
  const portable = usePortableCanvasDocumentSource(document);
  const autosaveState = useCanvasDocumentAutosave({
    applySource,
    revision: String(document.revision),
    source: portable.source,
    workspaceKey,
  });
  return { ...portable, autosaveState };
}
