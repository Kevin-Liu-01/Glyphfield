'use client';

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

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

  useMountEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue !== null) setValue(JSON.parse(storedValue) as T);
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
      setValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === 'function'
            ? (nextValue as (current: T) => T)(currentValue)
            : nextValue;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolvedValue));
        } catch {
          return resolvedValue;
        }
        return resolvedValue;
      });
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
