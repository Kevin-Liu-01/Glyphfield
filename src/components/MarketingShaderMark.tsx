'use client';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingShaderMark({ materialId, settings }: { materialId: LiveMaterialId; settings: LiveMaterialSettings }) {
  return (
    <span aria-hidden='true' className='marketing-v5-hero-mark' data-motion-item>
      <LiveMaterialCanvas
        activeWhileMounted
        frameRate={30}
        materialId={materialId}
        renderScale={1}
        settings={settings}
      />
    </span>
  );
}
