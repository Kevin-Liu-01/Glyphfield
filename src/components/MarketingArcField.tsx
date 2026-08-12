'use client';

import { useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useMountEffect } from '@/hooks/useMountEffect';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingArcField({
  className = '',
  materialId,
  maxPixelCount,
  renderScale = 0.5,
  settings,
}: {
  className?: string;
  materialId: LiveMaterialId;
  maxPixelCount?: number;
  renderScale?: number;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const isPaperShader = materialId.startsWith('paper-');
  const runtimeReady = useDeferredRuntime(visible, 500);

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
    <div
      className={`marketing-v5-arc-field${isPaperShader ? ' marketing-v5-paper-field' : ''} ${className}`}
      ref={containerRef}
      aria-hidden='true'
    >
      <div
        className='marketing-v5-field-fallback'
        style={isPaperShader ? { background: settings.colorA } : undefined}
      />
      {visible && runtimeReady ? (
        <LazyLiveMaterialCanvas
          activeWhileMounted
          frameRate={24}
          materialId={materialId}
          maxPixelCount={maxPixelCount}
          renderScale={renderScale}
          settings={settings}
        />
      ) : null}
      {isPaperShader ? null : <div className='marketing-v5-field-grain' />}
    </div>
  );
}
