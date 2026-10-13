'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';

const PERSISTENCE_DELAY_MS = 120;
// Upper bound on how long a quiet debounce can wait for an idle period.
const PERSISTENCE_IDLE_TIMEOUT_MS = 1_000;
// Without requestIdleCallback, serialize in slices of this budget between tasks.
const PERSISTENCE_FALLBACK_SLICE_MS = 8;
const pendingPersistentWrites = new Map<string, unknown>();
let persistentWriteTimer: number | null = null;
let persistentIdleFlush: { cancel: () => void } | null = null;
let persistenceFlushListenerAttached = false;

/** Include queued edits without forcing synchronous writes to the original. */
export function capturePersistentValues(prefixes: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  const matches = (key: string) => prefixes.some((prefix) => key.startsWith(prefix));
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && matches(key)) {
      const value = window.localStorage.getItem(key);
      if (value !== null) values.set(key, value);
    }
  }
  pendingPersistentWrites.forEach((value, key) => {
    if (matches(key)) values.set(key, JSON.stringify(value));
  });
  return values;
}

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === 'function'
    ? (initialValue as () => T)()
    : initialValue;
}

export function readPersistentValue<T>(storageKey: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  // A tool can remount before its debounced write reaches localStorage.
  if (pendingPersistentWrites.has(storageKey)) {
    return pendingPersistentWrites.get(storageKey) as T;
  }
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    return storedValue === null ? fallback : JSON.parse(storedValue) as T;
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // A disabled storage backend should not prevent the in-memory draft from working.
    }
    return fallback;
  }
}

function writePersistentValue(storageKey: string, value: unknown): void {
  // Leave the pending map only as the value lands, so reads always find the latest value.
  pendingPersistentWrites.delete(storageKey);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage can be disabled or full; the in-memory state remains authoritative.
  }
}

function cancelScheduledPersistentWrites(): void {
  if (persistentWriteTimer !== null) {
    window.clearTimeout(persistentWriteTimer);
    persistentWriteTimer = null;
  }
  persistentIdleFlush?.cancel();
  persistentIdleFlush = null;
}

/** Write everything now, before the page or tab can go away. */
function flushPendingPersistentWrites(): void {
  if (typeof window === 'undefined') return;
  cancelScheduledPersistentWrites();
  for (const [storageKey, value] of Array.from(pendingPersistentWrites)) writePersistentValue(storageKey, value);
}

function flushPendingPersistentWritesWhenHidden(): void {
  if (document.visibilityState === 'hidden') flushPendingPersistentWrites();
}

/**
 * Serialize queued values in idle time, one key at a time, so a large draft does not
 * land as one long task right after a gesture.
 */
function schedulePersistentIdleFlush(): void {
  persistentWriteTimer = null;
  const flushSlice = (hasTime: () => boolean) => {
    persistentIdleFlush = null;
    for (const [storageKey, value] of Array.from(pendingPersistentWrites)) {
      if (!hasTime()) {
        schedulePersistentIdleFlush();
        return;
      }
      writePersistentValue(storageKey, value);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(
      (deadline) => flushSlice(() => deadline.didTimeout || deadline.timeRemaining() > 1),
      { timeout: PERSISTENCE_IDLE_TIMEOUT_MS }
    );
    persistentIdleFlush = { cancel: () => window.cancelIdleCallback(handle) };
    return;
  }
  const handle = window.setTimeout(() => {
    const deadline = Date.now() + PERSISTENCE_FALLBACK_SLICE_MS;
    let first = true;
    // Always make progress: the first key is written even if it alone exceeds the slice.
    flushSlice(() => {
      const allowed = first || Date.now() < deadline;
      first = false;
      return allowed;
    });
  }, 0);
  persistentIdleFlush = { cancel: () => window.clearTimeout(handle) };
}

export function schedulePersistentWrite(storageKey: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  pendingPersistentWrites.set(storageKey, value);
  // A new edit restarts the quiet period, including a queued idle flush.
  cancelScheduledPersistentWrites();
  persistentWriteTimer = window.setTimeout(schedulePersistentIdleFlush, PERSISTENCE_DELAY_MS);
  if (!persistenceFlushListenerAttached) {
    window.addEventListener('pagehide', flushPendingPersistentWrites);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', flushPendingPersistentWritesWhenHidden);
    }
    persistenceFlushListenerAttached = true;
  }
}

export function usePersistentState<T>(
  storageKey: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [snapshot, setSnapshot] = useState<{ storageKey: string; value: T }>(() => ({
    storageKey,
    value: resolveInitialValue(initialValue),
  }));
  const value = snapshot.storageKey === storageKey
    ? snapshot.value
    : resolveInitialValue(initialValue);
  const valueRef = useCommittedRef(value);

  useEffect(() => {
    const nextValue = readPersistentValue(
      storageKey,
      valueRef.current
    );
    valueRef.current = nextValue;
    setSnapshot((current) => current.storageKey === storageKey && Object.is(current.value, nextValue)
      ? current
      : { storageKey, value: nextValue });
  }, [storageKey, valueRef]);

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (current: T) => T)(valueRef.current)
          : nextValue;
      if (Object.is(valueRef.current, resolvedValue)) return;
      valueRef.current = resolvedValue;
      setSnapshot({ storageKey, value: resolvedValue });
      schedulePersistentWrite(storageKey, resolvedValue);
    },
    [storageKey, valueRef]
  );

  return [value, setPersistentValue];
}

export function useStudioDraft<T>(
  identityId: string,
  toolId: string,
  field: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  return usePersistentState(
    `glyphfield-draft-v1:${identityId}:${toolId}:${field}`,
    initialValue
  );
}
