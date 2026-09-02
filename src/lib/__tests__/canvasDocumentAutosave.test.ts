import { describe, expect, it } from 'vitest';

import {
  canvasDocumentAutosaveSnapshotMatches,
  type CanvasDocumentAutosaveSnapshot,
} from '../../hooks/useCanvasDocumentAutosave';

function snapshot(
  revision: string,
  source: string | null
): CanvasDocumentAutosaveSnapshot {
  return { revision, source };
}

describe('canvas document autosave snapshots', () => {
  it('treats only the exact revision and portable source as saved', () => {
    const saved = snapshot('revision-1', '{"version":3}');

    expect(canvasDocumentAutosaveSnapshotMatches(saved, snapshot('revision-1', '{"version":3}'))).toBe(true);
    expect(canvasDocumentAutosaveSnapshotMatches(saved, snapshot('revision-2', '{"version":3}'))).toBe(false);
    expect(canvasDocumentAutosaveSnapshotMatches(saved, snapshot('revision-1', '{"version":3,"layers":[]}'))).toBe(false);
    expect(canvasDocumentAutosaveSnapshotMatches(saved, snapshot('revision-1', null))).toBe(false);
  });
});
