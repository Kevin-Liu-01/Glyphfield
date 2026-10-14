'use client';

import { useState, useSyncExternalStore } from 'react';

/** A single value outside React state. Only its subscribers re-render on change. */
export type ValueStore<T> = {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** One store per component instance, created on first render. */
export function useLocalValueStore<T>(initial: T): ValueStore<T> {
  const [store] = useState(() => createValueStore(initial));
  return store;
}

export function useValueStore<T>(store: ValueStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
