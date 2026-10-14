'use client';

import { useRef, useState, useSyncExternalStore } from 'react';

import { readPersistentValue, schedulePersistentWrite } from '@/hooks/usePersistentState';
import { useMountEffect } from '@/hooks/useMountEffect';

/**
 * A tiny external store for values that change on every pointer move or keystroke.
 * Components subscribe to a slice with useLiveValue, so a slider drag re-renders the
 * views that read the value instead of the whole tool.
 */
export type LiveStore<T> = {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createLiveStore<T>(initial: T, onChange?: (value: T) => void): LiveStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      onChange?.(value);
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** One store per component instance. */
export function useLiveStore<T>(initial: () => T): LiveStore<T> {
  const [store] = useState(() => createLiveStore(initial()));
  return store;
}

/**
 * A store persisted under `storageKey` with the shared debounced localStorage writer.
 * The stored value loads after mount so server and first client render agree;
 * `migrate` turns a stored value (or null when none exists) into the current shape.
 */
export function usePersistentLiveStore<T>(storageKey: string, initial: () => T, migrate?: (stored: unknown) => T | null): LiveStore<T> {
  const [store] = useState(() => createLiveStore(initial(), (value) => schedulePersistentWrite(storageKey, value)));
  useMountEffect(() => {
    const stored = readPersistentValue<unknown>(storageKey, null);
    const next = migrate ? migrate(stored) : (stored as T | null);
    if (next !== null && next !== undefined) store.set(next);
  });
  return store;
}

/** Subscribe to a derived slice; the component re-renders only when the slice changes. */
export function useLiveValue<T, S>(store: LiveStore<T>, selector: (value: T) => S, isEqual: (first: S, second: S) => boolean = Object.is): S {
  const cache = useRef<{ selected: S; selector: (value: T) => S; source: T } | null>(null);
  const read = () => {
    const source = store.get();
    const previous = cache.current;
    // A new selector (props changed) must re-run even when the store did not.
    if (previous && Object.is(previous.source, source) && previous.selector === selector) return previous.selected;
    const selected = selector(source);
    if (previous && isEqual(previous.selected, selected)) {
      cache.current = { selected: previous.selected, selector, source };
      return previous.selected;
    }
    cache.current = { selected, selector, source };
    return selected;
  };
  return useSyncExternalStore(store.subscribe, read, read);
}
