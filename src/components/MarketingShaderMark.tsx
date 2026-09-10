'use client';

import { useRef } from 'react';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import { useLandingRenderQuality } from '@/hooks/useLandingRenderQuality';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useViewportActivity } from '@/hooks/useViewportActivity';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';
import { LANDING_RENDER_FRAME_RATE, landingRenderBudget } from '@/lib/landingRenderQuality';

export default function MarketingShaderMark({ materialId, settings }: { materialId: LiveMaterialId; settings: LiveMaterialSettings }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const visible = useViewportActivity(containerRef, { rootMargin: '0px' });
  const prefersReducedMotion = usePrefersReducedMotion();
  const active = visible && !prefersReducedMotion;
  const { quality } = useLandingRenderQuality(active);
  const renderBudget = landingRenderBudget(quality, 1);

  return (
    <span aria-hidden='true' className='marketing-v5-hero-mark' data-motion-item data-render-quality={quality} ref={containerRef}>
      <LiveMaterialCanvas
        activeWhileMounted
        frameRate={LANDING_RENDER_FRAME_RATE}
        materialId={materialId}
        maxPixelCount={renderBudget.maxPixelCount}
        paused={!active}
        renderScale={renderBudget.renderScale}
        settings={settings}
      />
    </span>
  );
}
