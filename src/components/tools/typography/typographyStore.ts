'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { useLiveValue, type LiveStore } from '@/hooks/useLiveStore';
import type { BrandTypeScale, BrandTypography } from '@/lib/brandIdentity';
import { loadFontAxes, type FontAxis } from '@/lib/fontAxes';
import type { TypographySpecimenSettings } from '@/lib/typeSystem';

/** Role and scale edits in flight; committed to the identity on release. */
export type TypeWorkingState = {
  typeScale: BrandTypeScale | undefined;
  typography: BrandTypography[];
};

/** Specimen copy and the typing meter's counters; changes on every keystroke. */
export type SpecimenState = TypographySpecimenSettings & {
  charactersEntered: number;
  inputAt: number | null;
  startedAt: number | null;
};

export const TypeStoreContext = createContext<LiveStore<TypeWorkingState> | null>(null);
export const SpecimenStoreContext = createContext<LiveStore<SpecimenState> | null>(null);

export function useTypeStore(): LiveStore<TypeWorkingState> {
  const store = useContext(TypeStoreContext);
  if (!store) throw new Error('useTypeStore must be used inside the Typography tool.');
  return store;
}

export function useSpecimenStore(): LiveStore<SpecimenState> {
  const store = useContext(SpecimenStoreContext);
  if (!store) throw new Error('useSpecimenStore must be used inside the Typography tool.');
  return store;
}

export function useTypeState<S>(selector: (state: TypeWorkingState) => S, isEqual?: (first: S, second: S) => boolean): S {
  return useLiveValue(useTypeStore(), selector, isEqual);
}

export function useSpecimen<S>(selector: (state: SpecimenState) => S, isEqual?: (first: S, second: S) => boolean): S {
  return useLiveValue(useSpecimenStore(), selector, isEqual);
}

/** Record a specimen edit: the new text plus typing-meter counters. */
export function typeIntoSpecimen(store: LiveStore<SpecimenState>, value: string) {
  const now = Date.now();
  store.set((current) => ({
    ...current,
    charactersEntered: current.charactersEntered + Math.max(0, Array.from(value).length - Array.from(current.sampleText).length),
    inputAt: now,
    sampleText: value,
    startedAt: current.startedAt ?? now,
  }));
}

/** Variation axes of a font file, read once per URL: undefined while loading, null when unreadable. */
export function useFontAxes(path: string | undefined): FontAxis[] | null | undefined {
  const [axes, setAxes] = useState<{ axes: FontAxis[] | null; path: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    void loadFontAxes(path).then((result) => {
      if (active) setAxes({ axes: result, path });
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!path) return null;
  return axes && axes.path === path ? axes.axes : undefined;
}
