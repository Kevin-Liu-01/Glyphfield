import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeCanvasLayerTransform } from '@/lib/canvasInteraction';
import { checkpointCanvasHistory, redoCanvasCheckpointHistory, undoCanvasCheckpointHistory, type CanvasCheckpointHistory } from '@/lib/canvasCheckpointHistory';

type Snapshot = { text: string | null; x: number; widthScale: number };
type Entry = { signature: string; snapshot: Snapshot };

function entry(text: string | null, x = 0, widthScale = 1): Entry {
  const transform = normalizeCanvasLayerTransform({ x, widthScale }, { x: 0, y: 0, scale: 1 });
  const snapshot = { text, x: transform.x, widthScale: transform.widthScale! };
  return { signature: JSON.stringify(snapshot), snapshot };
}

afterEach(() => vi.useRealTimers());

describe('canvas history transaction boundaries', () => {
  it('undoes an immediate post-source drag without deleting the newly applied text', () => {
    vi.useFakeTimers();
    const opened = entry(null);
    const source = entry('Browser text');
    const moved = entry('Browser text', 40);
    let history: CanvasCheckpointHistory<Entry> = { past: [], present: opened, future: [] };
    // The source action closes before another gesture, not 220ms afterward.
    history = checkpointCanvasHistory(history, source);
    history = checkpointCanvasHistory(history, source);
    const settled = setTimeout(() => { history = checkpointCanvasHistory(history, moved); }, 220);
    vi.advanceTimersByTime(20);
    clearTimeout(settled);
    const undo = undoCanvasCheckpointHistory(history, moved)!;

    expect(undo.restored.snapshot).toEqual(source.snapshot);
    expect(undo.history.future[0]?.snapshot).toEqual(moved.snapshot);
    const undoSource = undoCanvasCheckpointHistory(undo.history, source)!;
    expect(undoSource.restored.snapshot).toEqual(opened.snapshot);
  });

  it('separates two completed gestures even when both finish before the debounce', () => {
    const source = entry('Browser text');
    const moved = entry('Browser text', 40);
    const resized = entry('Browser text', 40, 0.6);
    let history: CanvasCheckpointHistory<Entry> = { past: [], present: source, future: [] };
    history = checkpointCanvasHistory(history, moved);
    const undoResize = undoCanvasCheckpointHistory(history, resized)!;
    expect(undoResize.restored.snapshot).toEqual(moved.snapshot);
    const undoMove = undoCanvasCheckpointHistory(undoResize.history, moved)!;
    expect(undoMove.restored.snapshot).toEqual(source.snapshot);
  });

  it('preserves a pending edit before applying new source as a separate action', () => {
    const opened = entry(null);
    const added = entry('Text 1');
    const applied = entry('Browser text', 20);
    let history: CanvasCheckpointHistory<Entry> = { past: [], present: opened, future: [] };
    history = checkpointCanvasHistory(history, added);
    history = checkpointCanvasHistory(history, applied);
    expect(history.past.map(({ snapshot }) => snapshot)).toEqual([opened.snapshot, added.snapshot]);
    expect(undoCanvasCheckpointHistory(history, applied)?.restored.snapshot).toEqual(added.snapshot);
  });

  it('preserves redo and reference identity for no-op focus or selection interactions', () => {
    const source = entry('Browser text');
    const moved = entry('Browser text', 40);
    const history: CanvasCheckpointHistory<Entry> = { past: [], present: source, future: [moved] };
    expect(checkpointCanvasHistory(history, entry('Browser text'))).toBe(history);
    expect(history.future).toEqual([moved]);
  });

  it('clears redo only when a genuinely new edit is checkpointed', () => {
    const source = entry('Browser text');
    const moved = entry('Browser text', 40);
    const history: CanvasCheckpointHistory<Entry> = { past: [], present: source, future: [moved] };
    expect(checkpointCanvasHistory(history, entry('New text')).future).toEqual([]);
    expect(history.future).toEqual([moved]);
  });

  it('restores the exact move after undo followed by no-op interaction and redo', () => {
    const source = entry('Browser text');
    const moved = entry('Browser text', 40);
    const history: CanvasCheckpointHistory<Entry> = { past: [], present: source, future: [] };
    const undone = undoCanvasCheckpointHistory(history, moved)!;
    const focused = checkpointCanvasHistory(undone.history, source);
    const redone = redoCanvasCheckpointHistory(focused, source.signature)!;
    expect(redone.restored.snapshot).toEqual(moved.snapshot);
    expect(redone.history.past).toEqual([source]);
    expect(redone.history.future).toEqual([]);
  });

  it('does not redo an obsolete branch over a pending edit before its debounce', () => {
    const source = entry('Browser text');
    const oldMove = entry('Browser text', 40);
    const pending = entry('A new edit', 0);
    const history: CanvasCheckpointHistory<Entry> = { past: [], present: source, future: [oldMove] };
    expect(redoCanvasCheckpointHistory(history, pending.signature)).toBeNull();
    const undone = undoCanvasCheckpointHistory(history, pending)!;
    expect(undone.history.future).toEqual([pending]);
    const redone = redoCanvasCheckpointHistory(undone.history, source.signature)!;
    expect(redone.restored).toEqual(pending);
    expect(redoCanvasCheckpointHistory(redone.history, pending.signature)).toBeNull();
  });

  it('does not mutate a previous history snapshot or exceed forty checkpoints', () => {
    let history: CanvasCheckpointHistory<Entry> = { past: [], present: null, future: [] };
    const original = history;
    for (let i = 0; i < 50; i++) history = checkpointCanvasHistory(history, entry('Browser text', i));
    expect(history.past).toHaveLength(39);
    expect(history.present?.snapshot.x).toBe(49);
    expect(original).toEqual({ past: [], present: null, future: [] });
  });
});
