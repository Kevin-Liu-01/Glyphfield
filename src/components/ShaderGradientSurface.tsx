'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';

import { liveMaterialMotionRate, type LiveMaterialSettings } from '@/lib/liveMaterials';
import { resolveLiveMaterialPixelRatio } from '@/lib/liveMaterialRenderBudget';
import { createLiveMaterialClock } from '@/lib/liveMaterialClock';
import { normalizeLiveMaterialFrameState, registerLiveMaterialRuntime, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import ShaderSkeleton from './ShaderSkeleton';

function ShaderGradientRenderLifecycle({
  captureTimeMs,
  frameState,
  loopDurationMs,
  maxPixelCount,
  onReady,
  paused,
  ready,
  renderScale,
}: {
  captureTimeMs: number | null;
  frameState?: LiveMaterialFrameState;
  loopDurationMs: number;
  maxPixelCount?: number;
  onReady: (ready: boolean) => void;
  paused: boolean;
  ready: boolean;
  renderScale: number;
}) {
  const { gl: renderer, invalidate, setDpr, setFrameloop, size } = useThree();
  const firstLitFrame = useRef<number | null>(null);
  const clockRef = useRef(createLiveMaterialClock('shadergradient', 'shadergradient-prismatic-sphere'));
  const latest = useCommittedRef({ captureTimeMs, frameState, loopDurationMs, paused, ready });
  const didRender = useRef(false);

  useEffect(() => {
    const clock = clockRef.current;
    return registerLiveMaterialRuntime(renderer.domElement, {
      readFrame: (timeline) => latest.current.ready && didRender.current
        ? { ...clock.read(timeline), loopDurationMs: latest.current.loopDurationMs } : undefined,
      freeze: () => { clock.freeze(); setFrameloop('never'); },
      redraw: invalidate,
      resume: () => {
        clock.resume();
        setFrameloop(latest.current.paused && latest.current.ready ? 'demand' : 'always');
        invalidate();
      },
    });
  }, [invalidate, latest, renderer, setFrameloop]);

  useEffect(() => {
    setDpr(resolveLiveMaterialPixelRatio({
      cssHeight: size.height,
      cssWidth: size.width,
      devicePixelRatio: 1,
      maxDevicePixelRatio: 2,
      maxPixelCount,
      renderScale,
    }));
  }, [maxPixelCount, renderScale, setDpr, size.height, size.width]);

  useEffect(() => {
    // ShaderGradient's animate="off" only freezes time; R3F otherwise still
    // redraws the entire sphere and postprocessing pipeline every frame.
    setFrameloop(clockRef.current.frozen ? 'never' : paused && ready ? 'demand' : 'always');
    invalidate();
  }, [captureTimeMs, frameState, invalidate, paused, ready, setFrameloop]);

  useFrame(({ gl, scene }) => {
    const clock = clockRef.current;
    if (clock.frozen) return;
    const mesh = scene.getObjectByName('shadergradient-mesh') as {
      material?: { userData?: Record<string, { value: number }> };
    } | undefined;
    const uniform = mesh?.material?.userData?.uTime;
    if (uniform) {
      const frame = clock.draw({ now: performance.now(), active: true, paused,
        captureTimeMs, frameState, rate: 1 });
      uniform.value = ((frame % loopDurationMs) + loopDurationMs) % loopDurationMs / 1000;
      didRender.current = true;
    }
    if (ready || !scene.environment) return;
    // HDR environment loading is asynchronous. Wait for actual lit draws,
    // rather than accepting a mounted canvas containing the black silhouette.
    firstLitFrame.current ??= gl.info.render.frame;
    if (gl.info.render.frame > firstLitFrame.current + 1) onReady(true);
  });

  return null;
}

export default function ShaderGradientSurface({
  captureTimeMs,
  className,
  frameState,
  loopDurationMs,
  maxPixelCount,
  patternScale,
  paused,
  renderScale,
  settings,
}: {
  captureTimeMs: number | null;
  className: string;
  frameState?: LiveMaterialFrameState;
  loopDurationMs: number;
  maxPixelCount?: number;
  patternScale: number;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const [ready, setReady] = useState(false);
  const anchor = normalizeLiveMaterialFrameState(frameState);
  const resolvedLoopDuration = Math.max(1, anchor?.engine === 'shadergradient' ? anchor.loopDurationMs ?? loopDurationMs : loopDurationMs);
  return (
    <div className={`absolute inset-0 size-full ${className}`} data-live-material-ready={ready}>
      {!ready && <ShaderSkeleton />}
      <ShaderGradientCanvas
        className='absolute inset-0 size-full'
        fov={45}
        lazyLoad={false}
        pixelDensity={1}
        pointerEvents='none'
        preserveDrawingBuffer
        style={{ height: '100%', inset: 0, opacity: ready ? 1 : 0, position: 'absolute', width: '100%' }}
      >
        <ShaderGradientRenderLifecycle
          captureTimeMs={captureTimeMs}
          frameState={frameState}
          loopDurationMs={resolvedLoopDuration}
          maxPixelCount={maxPixelCount}
          onReady={setReady}
          paused={paused || captureTimeMs !== null}
          ready={ready}
          renderScale={renderScale}
        />
        <ambientLight intensity={settings.brightness * Math.PI * 0.6} />
        <ShaderGradient
          // The native R3F frame loop owns a continuous anchored uniform clock.
          // Vendor animate='on' restarts THREE.Clock after every pause.
          animate='off'
          brightness={settings.brightness}
          cAzimuthAngle={270}
          cDistance={0.5}
          cPolarAngle={180}
          cameraZoom={15.1 * patternScale}
          color1={settings.colorA}
          color2={settings.colorB}
          color3={settings.colorC}
          control='props'
          // CameraControls otherwise advances a separate damped clock on each
          // invalidation, even when the shader itself is frozen for capture.
          enableTransition={false}
          envPreset='city'
          grain={settings.grain > 0 ? 'on' : 'off'}
          lightType='env'
          loop='on'
          loopDuration={resolvedLoopDuration / 1_000}
          positionX={-0.1}
          positionY={0}
          positionZ={0}
          range='enabled'
          rangeEnd={40}
          rangeStart={0}
          reflection={0.4}
          rotationX={settings.rotationX}
          rotationY={settings.rotationY}
          rotationZ={settings.rotationZ}
          shader='defaults'
          type='sphere'
          uAmplitude={settings.amplitude}
          uDensity={settings.density}
          uFrequency={settings.frequency}
          uSpeed={liveMaterialMotionRate(settings.speed)}
          uStrength={settings.strength}
          uTime={0}
          wireframe={false}
          zoomOut
        />
      </ShaderGradientCanvas>
    </div>
  );
}
