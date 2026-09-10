'use client';

import { useEffect, useState, type ReactNode } from 'react';

import ShaderSkeleton from '@/components/ShaderSkeleton';
import { loadPaperShaderRenderer, readPaperShaderRenderer } from '@/components/paperShaderRegistry';
import type { PaperShaderRenderer } from '@/components/paperShaderRenderer';
import type { PaperShaderFamilyId } from '@/lib/liveMaterials';

export default function PaperShaderRendererBoundary({ children, family }: {
  children: (renderer: PaperShaderRenderer) => ReactNode;
  family: PaperShaderFamilyId;
}) {
  const [resolution, setResolution] = useState<{ family: PaperShaderFamilyId; failed: boolean }>({ family, failed: false });
  const renderer = readPaperShaderRenderer(family);
  useEffect(() => {
    if (renderer) return;
    let cancelled = false;
    void loadPaperShaderRenderer(family).then(() => {
      if (!cancelled) setResolution({ family, failed: false });
    }, () => {
      if (!cancelled) setResolution({ family, failed: true });
    });
    return () => { cancelled = true; };
  }, [family, renderer]);
  if (renderer) return children(renderer);
  const failed = resolution.family === family && resolution.failed;
  return <div aria-label={failed ? 'Shader preview unavailable' : 'Shader preview loading'}
    className='absolute inset-0 size-full' data-live-material-ready={failed ? 'error' : 'false'}>
    <ShaderSkeleton state={failed ? 'unavailable' : 'loading'} />
  </div>;
}
