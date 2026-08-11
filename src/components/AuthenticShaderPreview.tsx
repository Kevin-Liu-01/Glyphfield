'use client';

import { useEffect, useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  isPaperLiveMaterialId,
  type LiveMaterialId,
} from '@/lib/liveMaterials';
import {
  shaderLabSettingsFor,
  shaderMaterialPreviewStyle,
  shaderPreviewAssetPath,
} from '@/lib/shaderLab';
import { requestShaderPreviewSlot } from '@/lib/shaderPreviewBudget';

const capturedPreviews = new Map<LiveMaterialId, string>();

export default function AuthenticShaderPreview({
  className = '',
  materialId,
}: {
  className?: string;
  materialId: LiveMaterialId;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [preview, setPreview] = useState(() => capturedPreviews.get(materialId));
  const settings = shaderLabSettingsFor(materialId, DEFAULT_LIVE_MATERIAL_SETTINGS);
  const needsAuthenticCapture = isPaperLiveMaterialId(materialId);

  useEffect(() => {
    setPreview(capturedPreviews.get(materialId));
    setRendering(false);
  }, [materialId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !needsAuthenticCapture || preview) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    }, { rootMargin: '240px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, [needsAuthenticCapture, preview]);

  useEffect(() => {
    if (!needsAuthenticCapture || !visible || preview) return;
    let released = false;
    const releaseSlot = requestShaderPreviewSlot(() => {
      if (!released) setRendering(true);
    });
    return () => {
      released = true;
      setRendering(false);
      releaseSlot();
    };
  }, [needsAuthenticCapture, preview, visible]);

  useEffect(() => {
    if (!rendering || preview) return;
    let disposed = false;
    let attempts = 0;
    let timer = 0;
    const capture = () => {
      if (disposed) return;
      const canvas = hostRef.current?.querySelector('canvas');
      if (canvas?.width && canvas.height) {
        try {
          const dataUrl = canvas.toDataURL('image/webp', 0.86);
          capturedPreviews.set(materialId, dataUrl);
          setPreview(dataUrl);
          setRendering(false);
          return;
        } catch {
          // Retry below; the deterministic background remains visible meanwhile.
        }
      }
      attempts += 1;
      if (attempts < 14) timer = window.setTimeout(capture, 90);
      else {
        setPreview(shaderPreviewAssetPath(materialId));
        setRendering(false);
      }
    };
    timer = window.setTimeout(capture, 180);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [materialId, preview, rendering]);

  return (
    <span
      aria-hidden='true'
      className={`absolute inset-0 block overflow-hidden ${className}`}
      ref={hostRef}
      style={needsAuthenticCapture && !preview
        ? { background: '#111' }
        : shaderMaterialPreviewStyle(materialId, settings)}
    >
      {preview || !needsAuthenticCapture ? (
        <span
          className='absolute inset-0 block bg-cover bg-center'
          style={{ backgroundImage: `url("${preview ?? shaderPreviewAssetPath(materialId)}")` }}
        />
      ) : rendering ? (
        <LazyLiveMaterialCanvas
          activeWhileMounted
          captureTimeMs={1_600}
          frameRate={1}
          materialId={materialId}
          maxPixelCount={90_000}
          paused
          preservePresetAppearance
          renderScale={0.65}
          settings={settings}
        />
      ) : null}
    </span>
  );
}
