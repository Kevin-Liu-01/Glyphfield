'use client';

import { useLayoutEffect, useRef, useState } from 'react';

type Handler = (...args: never[]) => unknown;

/**
 * Returns handlers that keep one identity for the component's lifetime and
 * always call the latest committed implementation. Memoized editor regions can
 * receive them without re-rendering on every unrelated commit. Call them from
 * events and effects, not during render. The key set must not change.
 */
export function useStableHandlers<Handlers extends Record<string, Handler>>(handlers: Handlers): Handlers {
  const latestRef = useRef(handlers);
  useLayoutEffect(() => {
    latestRef.current = handlers;
  });
  const [stable] = useState(() => Object.fromEntries(Object.keys(handlers).map((key) => [
    key,
    (...args: never[]) => (latestRef.current[key] as Handler)(...args),
  ])) as Handlers);
  return stable;
}
