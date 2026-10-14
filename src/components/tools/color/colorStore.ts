'use client';

import { createContext, useContext } from 'react';

import { useLiveValue, type LiveStore } from '@/hooks/useLiveStore';
import type { ColorWorkingState } from '@/lib/colorToolSource';

/** The working palette store shared by the Color tokens tool's library, canvas and inspector. */
export const ColorStoreContext = createContext<LiveStore<ColorWorkingState> | null>(null);

export function useColorStore(): LiveStore<ColorWorkingState> {
  const store = useContext(ColorStoreContext);
  if (!store) throw new Error('useColorStore must be used inside the Color tokens tool.');
  return store;
}

export function useColorState<S>(selector: (state: ColorWorkingState) => S, isEqual?: (first: S, second: S) => boolean): S {
  return useLiveValue(useColorStore(), selector, isEqual);
}
