'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';

const PERSISTENCE_DELAY_MS = 120;
const pendingPersistentWrites = new Map<string, unknown>();
let persistentWriteTimer: number | null = null;
let persistenceFlushListenerAttached = false;

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === 'function'
    ? (initialValue as () => T)()
    : initialValue;
}

export function readPersistentValue<T>(storageKey: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
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

function flushPendingPersistentWrites(): void {
  if (typeof window === 'undefined') return;
  if (persistentWriteTimer !== null) {
    window.clearTimeout(persistentWriteTimer);
    persistentWriteTimer = null;
  }
  const writes = Array.from(pendingPersistentWrites.entries());
  pendingPersistentWrites.clear();
  writes.forEach(([storageKey, value]) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage can be disabled or full; the in-memory state remains authoritative.
    }
  });
}

export function schedulePersistentWrite(storageKey: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  pendingPersistentWrites.set(storageKey, value);
  if (persistentWriteTimer !== null) window.clearTimeout(persistentWriteTimer);
  persistentWriteTimer = window.setTimeout(flushPendingPersistentWrites, PERSISTENCE_DELAY_MS);
  if (!persistenceFlushListenerAttached) {
    window.addEventListener('pagehide', flushPendingPersistentWrites);
    persistenceFlushListenerAttached = true;
  }
}

export function usePersistentState<T>(
  storageKey: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const initialValueRef = useCommittedRef(initialValue);
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
      resolveInitialValue(initialValueRef.current)
    );
    valueRef.current = nextValue;
    setSnapshot({ storageKey, value: nextValue });
  }, [initialValueRef, storageKey, valueRef]);

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (current: T) => T)(valueRef.current)
          : nextValue;
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
