'use client';

import { useRef } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useViewportActivity } from '@/hooks/useViewportActivity';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

// Start the GPU runtime about half a desktop viewport before it is visible.
// The idle delay below still keeps offscreen shaders out of the initial render path.
const SHADER_PREWARM_MARGIN = '520px 0px';

export default function MarketingArcField({
  className = '',
  materialId,
  maxPixelCount,
  paperShaderOverrides,
  renderScale = 0.5,
  settings,
}: {
  className?: string;
  materialId: LiveMaterialId;
  maxPixelCount?: number;
  paperShaderOverrides?: Readonly<Record<string, unknown>>;
  renderScale?: number;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = useViewportActivity(containerRef, { rootMargin: SHADER_PREWARM_MARGIN });
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
      {runtimeReady ? (
        <LazyLiveMaterialCanvas
          activeWhileMounted
          enabled={visible}
          frameRate={24}
          materialId={materialId}
          maxPixelCount={maxPixelCount}
          paperShaderOverrides={paperShaderOverrides}
          paused={!visible}
          renderScale={renderScale}
          settings={settings}
        />
      ) : null}
      {isPaperShader ? null : <div className='marketing-v5-field-grain' />}
    </div>
  );
}
