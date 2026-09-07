'use client';

import dynamic from 'next/dynamic';

import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import ShaderSkeleton from '@/components/ShaderSkeleton';

const LazyLiveMaterialCanvas = dynamic<LiveMaterialCanvasProps>(
  () => import('@/components/LiveMaterialCanvas'),
  {
    loading: () => <div data-live-material-ready='false'><ShaderSkeleton /></div>,
    ssr: false,
  }
);

export default LazyLiveMaterialCanvas;
