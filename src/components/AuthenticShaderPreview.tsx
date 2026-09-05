'use client';

import { memo } from 'react';

import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialId } from '@/lib/liveMaterials';
import {
  shaderLabSettingsFor,
  shaderMaterialPreviewStyle,
  shaderPreviewAssetPath,
} from '@/lib/shaderLab';
function AuthenticShaderPreview({
  className = '',
  materialId,
}: {
  className?: string;
  materialId: LiveMaterialId;
}) {
  const settings = shaderLabSettingsFor(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);

  return (
    <span
      aria-hidden='true'
      className={`absolute inset-0 block overflow-hidden ${className}`}
      style={shaderMaterialPreviewStyle(materialId, settings)}
    >
      <img
        alt=''
        className='absolute inset-0 block size-full object-cover'
        decoding='async'
        loading='lazy'
        src={shaderPreviewAssetPath(materialId)}
      />
    </span>
  );
}

export default memo(AuthenticShaderPreview);
