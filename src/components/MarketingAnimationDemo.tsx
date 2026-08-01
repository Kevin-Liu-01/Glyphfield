'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

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
  const [ready, setReady] = useState(eager);

  useMountEffect(() => {
    if (eager) {
      setReady(true);
      return;
    }

    const container = containerRef.current;
    if (!container || !('IntersectionObserver' in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: '420px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  });

  return (
    <div className='marketing-animation-lazy-shell' ref={containerRef}>
      {ready ? <MarketingAnimationStudioLive /> : <AnimationStudioPlaceholder />}
    </div>
  );
}
