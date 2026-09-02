'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps imperative callbacks and animation loops pointed at the latest value
 * without mutating refs during a render that React may later discard.
 */
export function useCommittedRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
