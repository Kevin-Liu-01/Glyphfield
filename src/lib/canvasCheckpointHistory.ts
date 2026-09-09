export type CanvasCheckpointEntry = { signature: string };

export type CanvasCheckpointHistory<Entry extends CanvasCheckpointEntry> = {
  future: Entry[];
  past: Entry[];
  present: Entry | null;
};

/** Close one edit transaction without merging it into the next user action. */
export function checkpointCanvasHistory<Entry extends CanvasCheckpointEntry>(
  history: CanvasCheckpointHistory<Entry>,
  entry: Entry
): CanvasCheckpointHistory<Entry> {
  if (history.present?.signature === entry.signature) return history;
  return {
    future: [],
    past: history.present ? [...history.past, history.present].slice(-39) : [],
    present: entry,
  };
}

/** A new live edit invalidates redo immediately, even before its debounce. */
export function redoCanvasCheckpointHistory<Entry extends CanvasCheckpointEntry>(
  history: CanvasCheckpointHistory<Entry>,
  liveSignature: string
): { history: CanvasCheckpointHistory<Entry>; restored: Entry } | null {
  const next = history.future[0];
  if (!history.present || !next || history.present.signature !== liveSignature) return null;
  return {
    history: { future: history.future.slice(1), past: [...history.past, history.present].slice(-39), present: next },
    restored: next,
  };
}

/** A live uncheckpointed edit is undone before any older committed action. */
export function undoCanvasCheckpointHistory<Entry extends CanvasCheckpointEntry>(
  history: CanvasCheckpointHistory<Entry>,
  live: Entry
): { history: CanvasCheckpointHistory<Entry>; restored: Entry; undone: Entry } | null {
  if (!history.present) return null;
  if (live.signature !== history.present.signature) {
    return {
      history: { ...history, future: [live] },
      restored: history.present,
      undone: live,
    };
  }
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    history: { future: [history.present, ...history.future], past: history.past.slice(0, -1), present: previous },
    restored: previous,
    undone: history.present,
  };
}
