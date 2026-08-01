'use client';

import { useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useMountEffect } from '@/hooks/useMountEffect';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingArcField({
  className = '',
  materialId,
  settings,
}: {
  className?: string;
  materialId: LiveMaterialId;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useMountEffect(() => {
    const container = containerRef.current;
    let intersecting = false;

    function syncVisibility() {
      setVisible(intersecting && document.visibilityState === 'visible');
    }

    if (!container || !('IntersectionObserver' in window)) {
      intersecting = true;
      syncVisibility();
      document.addEventListener('visibilitychange', syncVisibility);
      return () => document.removeEventListener('visibilitychange', syncVisibility);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        syncVisibility();
      },
      { rootMargin: '180px' }
    );

    observer.observe(container);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  });

  return (
    <div className={`marketing-v5-arc-field ${className}`} ref={containerRef} aria-hidden='true'>
      <div className='marketing-v5-field-fallback' />
      {visible ? (
        <LazyLiveMaterialCanvas
          frameRate={24}
          materialId={materialId}
          renderScale={0.5}
          settings={settings}
        />
      ) : null}
      <div className='marketing-v5-field-grain' />
    </div>
  );
}
