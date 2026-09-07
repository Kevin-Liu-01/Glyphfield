'use client';

import { memo, useState } from 'react';

import {
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  shaderPreviewAssetPath,
} from '@/lib/shaderLab';
import ShaderSkeleton from '@/components/ShaderSkeleton';

function AuthenticShaderPreview({
  className = '',
  materialId,
}: {
  className?: string;
  materialId: LiveMaterialId;
  settings?: LiveMaterialSettings;
}) {
  const src = shaderPreviewAssetPath(materialId);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const ready = loadedSource === src && failedSource !== src;

  return (
    <span
      aria-hidden='true'
      className={`authentic-shader-preview ${className}`}
      data-shader-preview-ready={ready}
    >
      {!ready && <ShaderSkeleton state={failedSource === src ? 'unavailable' : 'loading'} />}
      <img
        alt=''
        className='authentic-shader-preview-image'
        decoding='async'
        key={src}
        loading='lazy'
        onError={() => setFailedSource(src)}
        onLoad={async (event) => {
          const image = event.currentTarget;
          try {
            await image.decode();
            if (!image.isConnected) return;
            setLoadedSource(src);
            setFailedSource(null);
          } catch {
            if (image.isConnected) setFailedSource(src);
          }
        }}
        src={src}
        style={{ opacity: ready ? 1 : 0 }}
      />
    </span>
  );
}

export default memo(AuthenticShaderPreview);
