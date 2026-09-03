'use client';

import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  normalizeLiveMaterialId,
} from '@/lib/liveMaterials';
import { shaderMaterialPreviewStyle, shaderPreviewCaptureSettings } from '@/lib/shaderLab';

export default function ShaderPreviewCapture({ materialId: requestedMaterialId }: { materialId: string }) {
  const materialId = normalizeLiveMaterialId(requestedMaterialId);
  const settings = shaderPreviewCaptureSettings(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);

  return (
    <main
      data-material-id={materialId}
      data-testid='shader-preview-capture'
      style={{
        ...shaderMaterialPreviewStyle(materialId, settings),
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        width: '100vw',
      }}
    >
      <LiveMaterialCanvas
        activeWhileMounted
        captureTimeMs={1_600}
        className='absolute inset-0 size-full'
        materialId={materialId}
        paused
        preservePresetGeometry
        renderScale={1}
        settings={settings}
      />
    </main>
  );
}
