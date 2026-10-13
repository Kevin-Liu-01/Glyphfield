'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { landingRenderQualityStore, type RenderQualityStore } from '@/lib/landingRenderQuality';

/** Subscribe everywhere; only actually visible, ready, moving renderers sample frames. */
export function useRenderQuality(store: RenderQualityStore, samplingActive = false) {
  const quality = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    if (!samplingActive) return;
    return store.registerVisibleRenderer();
  }, [samplingActive, store]);
  return quality;
}

export function useLandingRenderQuality(samplingActive = false) {
  return useRenderQuality(landingRenderQualityStore, samplingActive);
}
