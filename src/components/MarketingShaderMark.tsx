'use client';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';

import type { LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingShaderMark({ settings }: { settings: LiveMaterialSettings }) {
  return (
    <span aria-hidden='true' className='marketing-v5-hero-mark' data-motion-item>
      <LiveMaterialCanvas
        activeWhileMounted
        frameRate={30}
        materialId='paper-dithering-swirl'
        renderScale={1}
        settings={settings}
      />
    </span>
  );
}
