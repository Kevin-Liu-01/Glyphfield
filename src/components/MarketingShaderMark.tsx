'use client';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingShaderMark({ materialId, settings }: { materialId: LiveMaterialId; settings: LiveMaterialSettings }) {
  const runtimeReady = useDeferredRuntime(true, 700);

  return (
    <span aria-hidden='true' className='marketing-v5-hero-mark' data-motion-item>
      {runtimeReady ? (
        <LazyLiveMaterialCanvas
          frameRate={60}
          materialId={materialId}
          renderScale={1}
          settings={settings}
        />
      ) : null}
    </span>
  );
}
