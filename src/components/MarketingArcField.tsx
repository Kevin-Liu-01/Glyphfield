'use client';

import { useRef } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useViewportActivity } from '@/hooks/useViewportActivity';

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
  const visible = useViewportActivity(containerRef, { rootMargin: '180px' });
  const isPaperShader = materialId.startsWith('paper-');
  const runtimeReady = useDeferredRuntime(visible, 500);

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
