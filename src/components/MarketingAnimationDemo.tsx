'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';

import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useViewportActivity } from '@/hooks/useViewportActivity';

const MarketingAnimationStudioLive = dynamic(() => import('@/components/MarketingAnimationStudioLive'), {
  loading: () => <AnimationStudioPlaceholder />,
  ssr: false,
});

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
  const inRange = useViewportActivity(containerRef, { initialActive: eager, rootMargin: '420px' });
  const visible = useViewportActivity(containerRef, { rootMargin: '0px' });
  const runtimeReady = useDeferredRuntime(inRange, eager ? 600 : 300, {
    deferWhileInteracting: true,
  });

  return (
    <div className='marketing-animation-lazy-shell' ref={containerRef}>
      {/* Retain this one editor's state after loading; visibility suspends work,
          not the user's edits or their chosen play/pause state. */}
      {runtimeReady ? <MarketingAnimationStudioLive viewportVisible={visible} /> : <AnimationStudioPlaceholder />}
    </div>
  );
}
