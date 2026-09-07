'use client';

import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useRef, useState } from 'react';
import ShaderPreviewDiagnostics from '@/components/ShaderPreviewDiagnostics';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  normalizeLiveMaterialId,
} from '@/lib/liveMaterials';
import { shaderPreviewCaptureSettings } from '@/lib/shaderLab';

export default function ShaderPreviewCapture({ diagnostics = false, livePlayback = false, materialId: requestedMaterialId }: { diagnostics?: boolean; livePlayback?: boolean; materialId: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [captureTimeMs, setCaptureTimeMs] = useState(1_600);
  const materialId = normalizeLiveMaterialId(requestedMaterialId);
  const settings = shaderPreviewCaptureSettings(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);
  // Explicit benchmark mode only; catalog captures stay deterministic by default.
  const live = diagnostics && livePlayback;

  return (
    <main
      data-material-id={materialId}
      data-shader-playback={live ? 'live' : 'captured'}
      data-testid='shader-preview-capture'
      ref={rootRef}
      style={{
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        width: '100vw',
      }}
    >
      <LiveMaterialCanvas
        activeWhileMounted
        captureTimeMs={live ? null : captureTimeMs}
        className='absolute inset-0 size-full'
        diagnostics={diagnostics && !live}
        materialId={materialId}
        paused={!live}
        preservePresetGeometry
        renderScale={1}
        settings={settings}
      />
      {diagnostics && !live && <ShaderPreviewDiagnostics captureTimeMs={captureTimeMs} materialId={materialId} rootRef={rootRef} setCaptureTimeMs={setCaptureTimeMs} />}
    </main>
  );
}
