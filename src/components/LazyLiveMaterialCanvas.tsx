'use client';

import dynamic from 'next/dynamic';

import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';

const LazyLiveMaterialCanvas = dynamic<LiveMaterialCanvasProps>(
  () => import('@/components/LiveMaterialCanvas'),
  {
    loading: () => <div className='absolute inset-0' data-live-material-ready='false' aria-hidden='true' />,
    ssr: false,
  }
);

export default LazyLiveMaterialCanvas;
