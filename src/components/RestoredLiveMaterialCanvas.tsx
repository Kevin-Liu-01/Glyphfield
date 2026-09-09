'use client';

import { useEffect, useRef, useState } from 'react';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { getShaderMotionCapabilities } from '@/lib/shaderMotionCapabilities';

export type RestoredLiveMaterialCanvasProps = LiveMaterialCanvasProps & {
  restoreTimeMs?: number;
  holdRestoredPlayback: boolean;
  onRestoreReady: () => void;
};

/** A source-apply boundary, not a playback clock. Its key changes only on restore. */
export default function RestoredLiveMaterialCanvas({ restoreTimeMs, holdRestoredPlayback, onRestoreReady, ...props }: RestoredLiveMaterialCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latestReady = useCommittedRef(onRestoreReady);
  const [seedTime] = useState(() => Number.isFinite(restoreTimeMs) ? Math.max(0, restoreTimeMs!) : null);
  const [painted, setPainted] = useState(false);
  const [released, setReleased] = useState(false);
  const restoring = seedTime !== null && !released && (!painted || holdRestoredPlayback);
  const seekable = getShaderMotionCapabilities(props.materialId).motionModel !== 'stateful';
  useEffect(() => {
    if (painted && !holdRestoredPlayback) setReleased(true);
  }, [holdRestoredPlayback, painted]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || seedTime === null) return;
    let firstPaint = 0;
    let secondPaint = 0;
    let finished = false;
    const ready = () => {
      const surfaces = [...host.querySelectorAll('[data-live-material-ready]')];
      return surfaces.length > 0 && surfaces.every((surface) => surface.getAttribute('data-live-material-ready') === 'true');
    };
    const check = () => {
      if (finished || firstPaint || secondPaint || !ready()) return;
      firstPaint = requestAnimationFrame(() => {
        firstPaint = 0;
        secondPaint = requestAnimationFrame(() => {
          secondPaint = 0;
          if (!ready()) return;
          finished = true;
          setPainted(true);
          latestReady.current();
        });
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(host, { attributes: true, attributeFilter: ['data-live-material-ready'], childList: true, subtree: true });
    check();
    return () => { observer.disconnect(); cancelAnimationFrame(firstPaint); cancelAnimationFrame(secondPaint); };
  }, [latestReady, seedTime]);

  return <div className='absolute inset-0 size-full' data-shader-time-restoring={restoring ? 'true' : undefined} ref={hostRef}>
    <LiveMaterialCanvas {...props}
      captureTimeMs={props.captureTimeMs ?? (restoring && seekable ? seedTime : null)}
      paused={Boolean(props.paused || restoring)}
    />
  </div>;
}
