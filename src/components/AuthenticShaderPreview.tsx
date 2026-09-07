'use client';

import { memo } from 'react';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  shaderLabSettingsFor,
  shaderMaterialPreviewStyle,
  shaderPreviewAssetPath,
} from '@/lib/shaderLab';
function AuthenticShaderPreview({
  className = '',
  materialId,
  settings,
}: {
  className?: string;
  materialId: LiveMaterialId;
  settings?: LiveMaterialSettings;
}) {
  const resolvedSettings = settings ?? shaderLabSettingsFor(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);

  return (
    <span
      aria-hidden='true'
      className={`absolute inset-0 block overflow-hidden ${className}`}
      style={shaderMaterialPreviewStyle(materialId, resolvedSettings)}
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
