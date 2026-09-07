'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';

import { resolveShaderGradientMotionClock, type LiveMaterialSettings } from '@/lib/liveMaterials';
import { resolveLiveMaterialPixelRatio } from '@/lib/liveMaterialRenderBudget';
import ShaderSkeleton from './ShaderSkeleton';

function ShaderGradientRenderLifecycle({
  maxPixelCount,
  onReady,
  paused,
  ready,
  renderScale,
}: {
  maxPixelCount?: number;
  onReady: (ready: boolean) => void;
  paused: boolean;
  ready: boolean;
  renderScale: number;
}) {
  const { invalidate, setDpr, setFrameloop, size } = useThree();
  const firstLitFrame = useRef<number | null>(null);

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
    setFrameloop(paused && ready ? 'demand' : 'always');
    invalidate();
  }, [invalidate, paused, ready, setFrameloop]);

  useFrame(({ gl, scene }) => {
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
  loopDurationMs,
  maxPixelCount,
  patternScale,
  paused,
  renderScale,
  settings,
}: {
  captureTimeMs: number | null;
  className: string;
  loopDurationMs: number;
  maxPixelCount?: number;
  patternScale: number;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const [ready, setReady] = useState(false);
  const motionClock = resolveShaderGradientMotionClock(captureTimeMs, settings.speed, paused);
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
          maxPixelCount={maxPixelCount}
          onReady={setReady}
          paused={paused || captureTimeMs !== null}
          ready={ready}
          renderScale={renderScale}
        />
        <ambientLight intensity={settings.brightness * Math.PI * 0.6} />
        <ShaderGradient
          animate={motionClock.animate}
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
          loopDuration={loopDurationMs / 1_000}
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
          uSpeed={motionClock.uSpeed}
          uStrength={settings.strength}
          uTime={motionClock.uTime}
          wireframe={false}
          zoomOut
        />
      </ShaderGradientCanvas>
    </div>
  );
}
