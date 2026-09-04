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
  const runtimeReady = useDeferredRuntime(inRange, eager ? 900 : 300);

  return (
    <div className='marketing-animation-lazy-shell' ref={containerRef}>
      {runtimeReady ? <MarketingAnimationStudioLive /> : <AnimationStudioPlaceholder />}
    </div>
  );
}
