'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { landingRenderQualityStore } from '@/lib/landingRenderQuality';

/** Subscribe everywhere; only actually visible, ready, moving demos sample frames. */
export function useLandingRenderQuality(samplingActive = false) {
  const quality = useSyncExternalStore(
    landingRenderQualityStore.subscribe,
    landingRenderQualityStore.getSnapshot,
    landingRenderQualityStore.getServerSnapshot
  );
  useEffect(() => {
    if (!samplingActive) return;
    return landingRenderQualityStore.registerVisibleRenderer();
  }, [samplingActive]);
  return quality;
}
