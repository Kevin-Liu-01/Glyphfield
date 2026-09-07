'use client';

import { useRef } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import ShaderSkeleton from '@/components/ShaderSkeleton';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useLandingRenderQuality } from '@/hooks/useLandingRenderQuality';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useViewportActivity } from '@/hooks/useViewportActivity';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';
import { LANDING_RENDER_FRAME_RATE, landingRenderBudget } from '@/lib/landingRenderQuality';

// Fetch and prepare the renderer well before the field is visible, but only spend
// recurring GPU time once it is at the edge of the viewport.
const SHADER_PREWARM_MARGIN = '960px 0px';
const SHADER_ACTIVE_MARGIN = '96px 0px';

export default function MarketingArcField({
  className = '',
  frameRate = LANDING_RENDER_FRAME_RATE,
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
  const nearViewport = useViewportActivity(containerRef, {
    respectDocumentVisibility: false,
    rootMargin: SHADER_PREWARM_MARGIN,
  });
  const viewportActive = useViewportActivity(containerRef, { rootMargin: SHADER_ACTIVE_MARGIN });
  const visible = useViewportActivity(containerRef, { rootMargin: '0px' });
  const prefersReducedMotion = usePrefersReducedMotion();
  const active = viewportActive && !prefersReducedMotion;
  const isPaperShader = materialId.startsWith('paper-');
  const runtimeReady = useDeferredRuntime(nearViewport, 420, {
    deferWhileScrolling: true,
    resetWhenDisabled: !persistAfterReady,
    useIdleCallback: true,
  });
  const runtimeMounted = runtimeReady && (nearViewport || persistAfterReady);
  const { quality } = useLandingRenderQuality(visible && active && runtimeMounted);
  const renderBudget = landingRenderBudget(quality, renderScale, maxPixelCount);

  return (
    <div
      className={`marketing-v5-arc-field${isPaperShader ? ' marketing-v5-paper-field' : ''} ${className}`}
      data-shader-active={active ? 'true' : 'false'}
      data-shader-runtime={runtimeMounted ? 'ready' : 'fallback'}
      data-render-quality={quality}
      ref={containerRef}
      aria-hidden='true'
    >
      <ShaderSkeleton />
      {runtimeMounted ? (
        <div className='marketing-v5-field-runtime'>
          <LazyLiveMaterialCanvas
            activeWhileMounted
            // Keep the prepared context and native phase while nearby. Disabling
            // the renderer here would defer GPU compilation until the active edge.
            frameRate={frameRate}
            materialId={materialId}
            maxPixelCount={renderBudget.maxPixelCount}
            paperShaderOverrides={paperShaderOverrides}
            paused={!active}
            renderScale={renderBudget.renderScale}
            settings={settings}
          />
        </div>
      ) : null}
      {isPaperShader ? null : <div className='marketing-v5-field-grain' />}
    </div>
  );
}
