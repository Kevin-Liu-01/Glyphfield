'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShaderMaterial } from 'three';

import type { BackgroundSettings } from '@/lib/backgroundSvg';
import { stickerShaderSource, type StickerFinishSettings } from '@/lib/surfaceSticker';
import { browserSupportsWebGL2 } from '@/lib/webglContext';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/*
  Spectrum offset + mask-strength model adapted from GMHoloSticker (MIT),
  copyright 2025 Tero Hannula. Cell shimmer model adapted from
  FoilStickerShader (Unlicense) by TastiestLemon.
*/
const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;
uniform float uTexture;
uniform float uAngle;
uniform float uMode;

vec3 spectrum(float t) {
  vec3 p = abs(fract(t + vec3(0.0, 0.333333, 0.666667)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float angle = radians(uAngle);
  mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 uv = turn * (vUv - 0.5) + 0.5;

  // GMHoloSticker: mask strength plus per-channel spectrum offsets and tilt.
  float holoMask = smoothstep(0.05, 0.92, 0.44 + 0.36 * sin((uv.x - uv.y) * 21.0) + uTexture * 0.2);
  vec2 maskOffset = vec2(fract(uv.x * 3.0), fract(uv.y * 4.0));
  float tilt = 0.5 + 0.5 * sin(uTime * 0.34 + uv.x * 2.2);
  vec3 holo = spectrum(maskOffset.x + maskOffset.y * 0.35 + tilt + uTime * 0.025);

  // FoilStickerShader: diagonal sine shimmer combined with a bright cell field.
  float frequency = mix(2.5, 8.0, uTexture);
  float shimmer = 1.0 + sin(((uv.x + uv.y) + uTime * 0.08) * 3.1415926 * frequency) / 3.4;
  float cells = mix(7.0, 28.0, uTexture);
  vec2 cell = fract(uv * cells);
  float cellLight = (2.5 - cell.x + cell.y) / 2.25;
  float sparkle = step(0.965 - uTexture * 0.04, hash21(floor(uv * cells) + floor(uTime * 2.0)));

  vec3 foil = holo * max(shimmer, cellLight) + sparkle * vec3(1.0);
  vec3 color = mix(holo, foil, step(0.5, uMode));
  float alpha = clamp(uIntensity * mix(holoMask, max(holoMask, sparkle), step(0.5, uMode)), 0.0, 0.88);
  gl_FragColor = vec4(color, alpha);
}
`;

function ContextGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onLost]);
  return null;
}

function StickerOpticalLayer({ finish }: { finish: StickerFinishSettings }) {
  const materialRef = useRef<ShaderMaterial>(null);
  // Keep the WebGL uniform bindings stable while live controls update values.
  // Replacing this object on every slider event can churn renderer resources.
  const uniforms = useMemo(() => ({
    uAngle: { value: finish.glintAngle },
    uIntensity: { value: finish.intensity / 100 },
    uMode: { value: finish.presetId === 'holo-vinyl' ? 0 : 1 },
    uTexture: { value: finish.texture / 100 },
    uTime: { value: 0 },
  }), []);

  useEffect(() => {
    uniforms.uAngle.value = finish.glintAngle;
    uniforms.uIntensity.value = finish.intensity / 100;
    uniforms.uMode.value = finish.presetId === 'holo-vinyl' ? 0 : 1;
    uniforms.uTexture.value = finish.texture / 100;
  }, [finish.glintAngle, finish.intensity, finish.presetId, finish.texture, uniforms]);

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        depthWrite={false}
        fragmentShader={FRAGMENT_SHADER}
        ref={materialRef}
        transparent
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
      />
    </mesh>
  );
}

export default function OpenStickerShaderStage({
  finish,
  logoPath,
  settings,
}: {
  finish: StickerFinishSettings;
  logoPath?: string;
  settings: BackgroundSettings;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const recoveryTimerRef = useRef(0);
  const source = stickerShaderSource(finish.presetId);

  useEffect(() => {
    let disposed = false;
    let retryTimer = 0;
    const checkSupport = () => {
      const supported = Boolean(source) && browserSupportsWebGL2();
      if (disposed) return;
      setAvailable(supported);
      if (source && !supported) retryTimer = window.setTimeout(checkSupport, 2_500);
    };
    checkSupport();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(recoveryTimerRef.current);
    };
  }, [source]);

  const recoverContext = () => {
    if (recoveryTimerRef.current) return;
    setAvailable(false);
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = 0;
      setContextVersion((current) => current + 1);
      setAvailable(browserSupportsWebGL2());
    }, 350);
  };

  if (!source || available !== true) return null;

  const markSize = Math.min(settings.width, settings.height) * Math.max(0.24, Math.min(0.7, settings.logoScale / 100 * 1.72));
  const markX = (settings.width - markSize) / 2 + (settings.logoX / 100) * settings.width;
  const markY = (settings.height - markSize) / 2 + (settings.logoY / 100) * settings.height;
  const maskImage = logoPath ? `url("${logoPath.replaceAll('"', '%22')}")` : undefined;

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute z-[2] overflow-hidden'
      data-open-sticker-shader={source.name}
      style={{
        borderRadius: logoPath ? undefined : '20%',
        height: `${markSize / settings.height * 100}%`,
        left: `${markX / settings.width * 100}%`,
        maskImage,
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
        mixBlendMode: 'screen',
        top: `${markY / settings.height * 100}%`,
        WebkitMaskImage: maskImage,
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        width: `${markSize / settings.width * 100}%`,
      }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 1.25]}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        key={contextVersion}
      >
        <ContextGuard onLost={recoverContext} />
        <StickerOpticalLayer finish={finish} />
      </Canvas>
    </div>
  );
}
