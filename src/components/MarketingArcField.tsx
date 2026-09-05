'use client';

import { useRef, type CSSProperties } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useViewportActivity } from '@/hooks/useViewportActivity';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

// Fetch and prepare the renderer well before the field is visible, but only spend
// recurring GPU time once it is at the edge of the viewport.
const SHADER_PREWARM_MARGIN = '960px 0px';
const SHADER_ACTIVE_MARGIN = '96px 0px';

export default function MarketingArcField({
  className = '',
  frameRate = 20,
  materialId,
  maxPixelCount,
  paperShaderOverrides,
  persistAfterReady = false,
  renderScale = 0.5,
  settings,
}: {
  className?: string;
  frameRate?: number;
  materialId: LiveMaterialId;
  maxPixelCount?: number;
  paperShaderOverrides?: Readonly<Record<string, unknown>>;
  persistAfterReady?: boolean;
  renderScale?: number;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearViewport = useViewportActivity(containerRef, { rootMargin: SHADER_PREWARM_MARGIN });
  const active = useViewportActivity(containerRef, { rootMargin: SHADER_ACTIVE_MARGIN });
  const isPaperShader = materialId.startsWith('paper-');
  const runtimeReady = useDeferredRuntime(nearViewport, 420, {
    deferWhileScrolling: true,
    resetWhenDisabled: !persistAfterReady,
    useIdleCallback: true,
  });
  const fallbackStyle = isPaperShader ? {
    '--marketing-shader-color-a': settings.colorA,
    '--marketing-shader-color-b': settings.colorB,
    '--marketing-shader-color-c': settings.colorC,
  } as CSSProperties : undefined;

  return (
    <div
      className={`marketing-v5-arc-field${isPaperShader ? ' marketing-v5-paper-field' : ''} ${className}`}
      data-shader-active={active ? 'true' : 'false'}
      data-shader-runtime={runtimeReady ? 'ready' : 'fallback'}
      ref={containerRef}
      aria-hidden='true'
      style={fallbackStyle}
    >
      <div
        className='marketing-v5-field-fallback'
        data-material={isPaperShader ? materialId : undefined}
      />
      {runtimeReady ? (
        <div className='marketing-v5-field-runtime'>
          <LazyLiveMaterialCanvas
            activeWhileMounted
            enabled={active}
            frameRate={frameRate}
            materialId={materialId}
            maxPixelCount={maxPixelCount}
            paperShaderOverrides={paperShaderOverrides}
            paused={!active}
            renderScale={renderScale}
            settings={settings}
          />
        </div>
      ) : null}
      {isPaperShader ? null : <div className='marketing-v5-field-grain' />}
    </div>
  );
}
