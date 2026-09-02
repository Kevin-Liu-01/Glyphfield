import { useEffect, useSyncExternalStore } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';

const subscribeToHydration = () => () => {};

export function useDocumentBody(): HTMLElement | null {
  return useSyncExternalStore(subscribeToHydration, () => document.body, () => null);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

export function useMountEffect(effect: () => void | (() => void)): void {
  const effectRef = useCommittedRef(effect);
  useEffect(() => effectRef.current(), [effectRef]);
}
