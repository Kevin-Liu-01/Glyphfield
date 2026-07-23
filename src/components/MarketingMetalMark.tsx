'use client';

import { useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useMountEffect } from '@/hooks/useMountEffect';

import type { LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingMetalMark({
  label,
  settings,
}: {
  label: string;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: '400px' }
    );
    observer.observe(container);
    return () => observer.disconnect();
  });

  return (
    <div className='marketing-v4-metal' ref={containerRef}>
      <div className='marketing-v4-metal-aura' aria-hidden='true' />
      <div className='marketing-v4-metal-mask' aria-hidden='true'>
        <div className='marketing-v4-metal-fallback' />
        {visible ? (
          <LazyLiveMaterialCanvas materialId='shaders-fluid-chrome' settings={settings} />
        ) : null}
      </div>
      <span>{label}</span>
    </div>
  );
}
