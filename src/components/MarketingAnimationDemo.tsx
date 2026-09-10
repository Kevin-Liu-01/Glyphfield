'use client';

import { useEffect, useRef, useState } from 'react';

import MarketingAnimationStudioLive from '@/components/MarketingAnimationStudioLive';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useViewportActivity } from '@/hooks/useViewportActivity';

function AnimationStudioPlaceholder() {
  return (
    <div className='marketing-animation-placeholder'>
      <i aria-hidden='true' />
      <span>Loading live Animation Studio…</span>
    </div>
  );
}

export default function MarketingAnimationDemo({ eager = false }: { eager?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const inRange = useViewportActivity(containerRef, { initialActive: eager, rootMargin: '420px' });
  const visible = useViewportActivity(containerRef, { rootMargin: '0px' });
  const deferredReady = useDeferredRuntime(!eager && inRange, 300, {
    deferWhileInteracting: true,
  });
  // The hero is primary content: render its real controls into the initial HTML
  // without a streamed loading boundary. Only optional offscreen demos idle.
  const runtimeReady = eager || deferredReady;
  useEffect(() => { setHydrated(true); }, []);

  return (
    <div className='marketing-animation-lazy-shell' data-studio-interactive={hydrated && runtimeReady} ref={containerRef}>
      {/* Retain this one editor's state after loading; visibility suspends work,
          not the user's edits or their chosen play/pause state. */}
      {runtimeReady ? <MarketingAnimationStudioLive viewportVisible={visible} /> : <AnimationStudioPlaceholder />}
    </div>
  );
}
