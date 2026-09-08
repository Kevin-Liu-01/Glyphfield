'use client';

import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useCallback, useEffect, useRef, useState } from 'react';
import ShaderPreviewDiagnostics from '@/components/ShaderPreviewDiagnostics';
import ShaderFrameCaptureDiagnostics from '@/components/ShaderFrameCaptureDiagnostics';
import type { LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  normalizeLiveMaterialId,
} from '@/lib/liveMaterials';
import { shaderPreviewCaptureSettings } from '@/lib/shaderLab';

export default function ShaderPreviewCapture({ diagnostics = false, livePlayback = false, materialId: requestedMaterialId }: { diagnostics?: boolean; livePlayback?: boolean; materialId: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [captureTimeMs, setCaptureTimeMs] = useState(1_600);
  const [testFrame, setTestFrame] = useState<{ state?: LiveMaterialFrameState; timeMs: number | null; key: number }>({ timeMs: null, key: 0 });
  const pendingRestore = useRef<(() => void)[]>([]);
  const restore = useCallback((state: LiveMaterialFrameState, timeMs: number | null, remount: boolean) => new Promise<void>((resolve) => {
    pendingRestore.current.push(resolve);
    setTestFrame((previous) => ({ state, timeMs, key: previous.key + Number(remount) }));
  }), []);
  useEffect(() => { pendingRestore.current.splice(0).forEach((resolve) => resolve()); }, [testFrame]);
  const materialId = normalizeLiveMaterialId(requestedMaterialId);
  const settings = shaderPreviewCaptureSettings(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);
  // Explicit benchmark mode only; catalog captures stay deterministic by default.
  const live = diagnostics && livePlayback && testFrame.timeMs === null;

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
        captureTimeMs={live ? null : testFrame.timeMs ?? captureTimeMs}
        frameState={testFrame.state}
        key={testFrame.key}
        className='absolute inset-0 size-full'
        diagnostics={diagnostics && !live}
        materialId={materialId}
        paused={!live}
        preservePresetGeometry
        renderScale={1}
        settings={settings}
      />
      {diagnostics && !live && <ShaderPreviewDiagnostics captureTimeMs={captureTimeMs} materialId={materialId} rootRef={rootRef} setCaptureTimeMs={setCaptureTimeMs} />}
      {diagnostics && livePlayback && <ShaderFrameCaptureDiagnostics materialId={materialId} rootRef={rootRef} restore={restore} />}
    </main>
  );
}
