'use client';

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

const PERSISTENCE_DELAY_MS = 120;
const pendingPersistentWrites = new Map<string, unknown>();
let persistentWriteTimer: number | null = null;
let persistenceFlushListenerAttached = false;

export function flushPendingPersistentWrites(): void {
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
  const initialValueRef = useRef(initialValue);
  const [value, setValue] = useState<T>(() => {
    const currentInitialValue = initialValueRef.current;
    return typeof currentInitialValue === 'function'
      ? (currentInitialValue as () => T)()
      : currentInitialValue;
  });
  const valueRef = useRef(value);
  valueRef.current = value;

  useMountEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue !== null) {
        const parsedValue = JSON.parse(storedValue) as T;
        valueRef.current = parsedValue;
        setValue(parsedValue);
      }
    } catch {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        return;
      }
    }
  });

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (current: T) => T)(valueRef.current)
          : nextValue;
      valueRef.current = resolvedValue;
      setValue(resolvedValue);
      schedulePersistentWrite(storageKey, resolvedValue);
    },
    [storageKey]
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
