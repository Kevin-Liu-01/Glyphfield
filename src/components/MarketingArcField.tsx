'use client';

import { useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useMountEffect } from '@/hooks/useMountEffect';

import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

export default function MarketingArcField({
  className = '',
  materialId,
  settings,
}: {
  className?: string;
  materialId: LiveMaterialId;
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
      { rootMargin: '500px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  });

  return (
    <div className={`marketing-v5-arc-field ${className}`} ref={containerRef} aria-hidden='true'>
      <div className='marketing-v5-field-fallback' />
      {visible ? (
        <LazyLiveMaterialCanvas materialId={materialId} renderScale={0.82} settings={settings} />
      ) : null}
      <i className='marketing-v5-field-arc marketing-v5-field-arc--one' />
      <i className='marketing-v5-field-arc marketing-v5-field-arc--two' />
      <i className='marketing-v5-field-arc marketing-v5-field-arc--three' />
      <div className='marketing-v5-field-grain' />
    </div>
  );
}
