'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  DataTexture,
  LinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from 'three';

import type { BackgroundSettings, SurfaceMaterial } from '@/lib/backgroundSvg';
import { openSurfaceMapPath, type OpenSurfaceAsset, type OpenSurfaceMap } from '@/lib/openSurfaceLibrary';
import {
  surfaceTextureCacheKey,
  surfaceTextureSettings,
  type SurfaceTextureSettings,
} from '@/lib/surfaceRendering';
import { browserSupportsWebGL2 } from '@/lib/webglContext';

const TEXTURE_SIZE = 256;

type SurfaceMaterialStageProps = {
  asset?: OpenSurfaceAsset;
  className?: string;
  settings: BackgroundSettings;
};

type LoadedSurfaceMaps = Partial<Record<OpenSurfaceMap, Texture>>;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function line(value: number, width: number) {
  const distance = Math.abs((value - Math.floor(value)) - 0.5);
  return 1 - Math.min(1, distance / Math.max(0.001, width));
}

function reliefAt(material: SurfaceMaterial, x: number, y: number, openArea: number, irregularity: number) {
  const noise = hash(Math.floor(x * 96), Math.floor(y * 96));
  const irregularNoise = (noise - 0.5) * irregularity;
  switch (material) {
    case 'kerf-wood':
      return clamp01(0.28 + line(x * 11 + Math.sin(y * 7) * (0.06 + irregularity * 0.16), 0.14) * 0.54 + noise * 0.12);
    case 'woven-wire': {
      const weaveA = line((x + y) * 10, 0.18);
      const weaveB = line((x - y) * 10, 0.18);
      return clamp01(Math.max(weaveA, weaveB) * 0.88 + Math.min(weaveA, weaveB) * 0.12);
    }
    case 'perforated-metal': {
      const gridX = x * 12 - Math.floor(x * 12) - 0.5;
      const gridY = y * 8 - Math.floor(y * 8) - 0.5;
      const radius = 0.12 + openArea * 0.3;
      return Math.hypot(gridX, gridY) < radius ? 0.02 : 0.86 + noise * 0.08;
    }
    case 'carved-stone':
      return clamp01(0.5 + Math.sin(x * 18 + Math.sin(y * 9) * 2.4) * 0.18 + Math.sin(y * 23) * 0.12 + (noise - 0.5) * 0.25);
    case 'embossed-paper':
      return clamp01(0.48 + Math.sin(x * 38) * Math.sin(y * 31) * 0.09 + (noise - 0.5) * 0.22);
    case 'brushed-metal':
      return clamp01(0.5 + (noise - 0.5) * 0.16 + Math.sin(y * 180) * 0.07 + Math.sin(y * 57) * 0.05);
    case 'hammered-foil':
      return clamp01(0.48 + Math.sin(x * 31 + Math.sin(y * 17) * 2) * 0.16 + Math.sin(y * 29 + x * 7) * 0.15 + (noise - 0.5) * 0.18);
    case 'corrugated-polymer':
      return clamp01(0.5 + Math.cos(x * Math.PI * 18) * 0.42 + (noise - 0.5) * 0.04);
    case 'cork-composite':
      return clamp01(0.34 + noise * 0.42 + (hash(Math.floor(x * 35), Math.floor(y * 35)) > 0.82 ? 0.22 : 0));
    case 'frosted-glass':
      return clamp01(0.5 + (noise - 0.5) * 0.34 + Math.sin(x * 51 + y * 37) * 0.05);
    case 'linen-weave': {
      const warp = line(x * 18 + Math.sin(y * 8) * irregularity * 0.24, 0.2);
      const weft = line(y * 18 + Math.sin(x * 7) * irregularity * 0.2, 0.2);
      return clamp01(0.18 + Math.max(warp, weft) * 0.62 + Math.min(warp, weft) * 0.18 + irregularNoise * 0.12);
    }
    case 'felted-wool':
      return clamp01(0.44 + irregularNoise * 0.42 + Math.sin(x * 83 + y * 31) * 0.06 + Math.sin(y * 97 - x * 17) * 0.05);
    case 'pebbled-leather': {
      const cellX = x * 9 - Math.floor(x * 9) - 0.5;
      const cellY = y * 11 - Math.floor(y * 11) - 0.5;
      const pebble = 1 - clamp01(Math.hypot(cellX, cellY) * (1.8 + irregularity * 0.5));
      return clamp01(0.3 + pebble * 0.58 + irregularNoise * 0.18);
    }
    case 'crackle-glaze': {
      const crackA = Math.abs(Math.sin(x * 19 + Math.sin(y * 11) * 1.8));
      const crackB = Math.abs(Math.sin(y * 23 - Math.sin(x * 13) * 1.5));
      const crack = Math.min(crackA, crackB) < 0.11 + irregularity * 0.05 ? 0.1 : 0.72;
      return clamp01(crack + irregularNoise * 0.08);
    }
    case 'sandblasted-plaster':
      return clamp01(0.46 + irregularNoise * 0.58 + Math.sin(x * 41 + y * 53) * 0.07);
    case 'carbon-twill': {
      const twill = (Math.floor(x * 18) + Math.floor(y * 18) * 2) % 4;
      const diagonal = line((x - y) * 18, 0.26);
      return clamp01(0.22 + diagonal * 0.48 + (twill === 0 || twill === 3 ? 0.2 : 0.04));
    }
    default:
      return 0.5;
  }
}

function buildSurfaceTextures(settings: SurfaceTextureSettings) {
  const colorA = new Color(settings.colorA);
  const colorB = new Color(settings.colorB);
  const colorC = new Color(settings.colorC);
  const colorData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const bumpData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const angle = (settings.surfaceAngle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = Math.max(0.45, 72 / Math.max(12, settings.surfaceScale));
  const openArea = settings.surfaceOpenArea / 100;
  const textureAmount = settings.surfaceTextureAmount / 100;
  const irregularity = settings.surfaceIrregularity / 100;

  for (let py = 0; py < TEXTURE_SIZE; py += 1) {
    for (let px = 0; px < TEXTURE_SIZE; px += 1) {
      const u = px / TEXTURE_SIZE - 0.5;
      const v = py / TEXTURE_SIZE - 0.5;
      const x = (u * cos - v * sin) * scale + 0.5;
      const y = (u * sin + v * cos) * scale + 0.5;
      const relief = reliefAt(settings.surfaceMaterial, x, y, openArea, irregularity);
      const sweep = clamp01(px / (TEXTURE_SIZE - 1) * 0.72 + py / (TEXTURE_SIZE - 1) * 0.28);
      const base = colorA.clone().lerp(colorB, sweep);
      base.lerp(colorC, clamp01((relief - 0.5) * (0.24 + textureAmount * 0.72) + 0.18));
      const offset = (py * TEXTURE_SIZE + px) * 4;
      colorData[offset] = Math.round(clamp01(base.r) * 255);
      colorData[offset + 1] = Math.round(clamp01(base.g) * 255);
      colorData[offset + 2] = Math.round(clamp01(base.b) * 255);
      colorData[offset + 3] = 255;
      const height = Math.round(relief * 255);
      bumpData[offset] = height;
      bumpData[offset + 1] = height;
      bumpData[offset + 2] = height;
      bumpData[offset + 3] = 255;
    }
  }

  const colorTexture = new DataTexture(colorData, TEXTURE_SIZE, TEXTURE_SIZE, RGBAFormat);
  colorTexture.colorSpace = SRGBColorSpace;
  const bumpTexture = new DataTexture(bumpData, TEXTURE_SIZE, TEXTURE_SIZE, RGBAFormat);
  for (const texture of [colorTexture, bumpTexture]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
  }
  return { bumpTexture, colorTexture };
}

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

function useOpenSurfaceMaps(asset: OpenSurfaceAsset | undefined, settings: BackgroundSettings) {
  const [maps, setMaps] = useState<LoadedSurfaceMaps | null>(null);

  useEffect(() => {
    let active = true;
    const loaded: Texture[] = [];
    setMaps(null);
    if (!asset) return () => undefined;

    const loader = new TextureLoader();
    const mapTypes = Object.keys(asset.mapNames) as OpenSurfaceMap[];
    Promise.all(mapTypes.map(async (mapType) => {
      try {
        const texture = await loader.loadAsync(openSurfaceMapPath(asset.id, mapType));
        loaded.push(texture);
        return [mapType, texture] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!active) return;
      const next = Object.fromEntries(
        entries.filter((entry): entry is readonly [OpenSurfaceMap, Texture] => entry !== null)
      ) as LoadedSurfaceMaps;
      if (next.color) next.color.colorSpace = SRGBColorSpace;
      setMaps(next);
    });

    return () => {
      active = false;
      loaded.forEach((texture) => texture.dispose());
    };
  }, [asset]);

  useEffect(() => {
    if (!maps) return;
    const repeat = Math.max(0.55, 84 / Math.max(12, settings.surfaceScale));
    const rotation = (settings.surfaceAngle * Math.PI) / 180;
    Object.values(maps).forEach((texture) => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.center.set(0.5, 0.5);
      texture.repeat.set(repeat, repeat);
      texture.rotation = rotation;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    });
  }, [maps, settings.surfaceAngle, settings.surfaceScale]);

  return maps;
}

function SurfacePanel({ asset, settings }: SurfaceMaterialStageProps) {
  const textureCacheKey = surfaceTextureCacheKey(settings);
  const { bumpTexture, colorTexture } = useMemo(
    () => buildSurfaceTextures(surfaceTextureSettings(settings)),
    [textureCacheKey]
  );
  const openMaps = useOpenSurfaceMaps(asset, settings);
  const isGlass = settings.surfaceMaterial === 'frosted-glass';
  const metallic = isGlass ? 0.05 : settings.surfaceMetallic / 100;
  const roughness = Math.max(0.08, settings.surfaceRoughness / 100);
  const bumpScale = 0.006 + settings.surfaceDepth / 100 * 0.22 * (settings.surfaceTextureAmount / 100);
  const normalScale = useMemo(() => new Vector2(1, asset?.normalFormat === 'directx' ? -1 : 1), [asset?.normalFormat]);

  useEffect(() => () => {
    colorTexture.dispose();
    bumpTexture.dispose();
  }, [bumpTexture, colorTexture]);

  return (
    <>
      <color attach='background' args={['#101115']} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#f4f6ff', '#13141a', 1.2]} />
      <directionalLight color='#ffffff' intensity={3.4} position={[-3.5, 4.5, 5]} />
      <directionalLight color={settings.colorC} intensity={1.65} position={[4, -1.5, 3]} />
      <group rotation={[-0.08, 0.12, -0.018]}>
        <mesh>
          <boxGeometry args={[4.5, 2.55, 0.2, 96, 56, 4]} />
          <meshPhysicalMaterial
            bumpMap={openMaps?.displacement ?? bumpTexture}
            bumpScale={bumpScale}
            clearcoat={isGlass || metallic > 0.45 ? 0.78 : 0.2}
            clearcoatRoughness={Math.max(0.04, roughness * 0.42)}
            color='#ffffff'
            envMapIntensity={1.25}
            ior={1.46}
            map={openMaps?.color ?? colorTexture}
            metalnessMap={openMaps?.metalness}
            metalness={metallic}
            normalMap={openMaps?.normal}
            normalScale={normalScale}
            roughnessMap={openMaps?.roughness}
            roughness={roughness}
            thickness={isGlass ? 0.65 : 0}
            transmission={isGlass ? 0.62 : 0}
          />
        </mesh>
      </group>
    </>
  );
}

export default function SurfaceMaterialStage({ asset, className = '', settings }: SurfaceMaterialStageProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const recoveryTimerRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let retryTimer = 0;
    const checkSupport = () => {
      const supported = browserSupportsWebGL2();
      if (disposed) return;
      setAvailable(supported);
      if (!supported) retryTimer = window.setTimeout(checkSupport, 2_500);
    };
    checkSupport();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  const recoverContext = () => {
    if (recoveryTimerRef.current) return;
    setAvailable(false);
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = 0;
      setContextVersion((current) => current + 1);
      setAvailable(browserSupportsWebGL2());
    }, 350);
  };

  if (available !== true) return null;

  return (
    <div className={className} data-surface-relief-preview='true'>
      <Canvas
        camera={{ fov: 34, position: [0, 0, 4.65] }}
        dpr={[1, 1.5]}
        frameloop='demand'
        gl={{ alpha: false, antialias: true, powerPreference: 'low-power' }}
        key={contextVersion}
      >
        <ContextGuard onLost={recoverContext} />
        <SurfacePanel asset={asset} settings={settings} />
      </Canvas>
      <div className='pointer-events-none absolute right-3 top-3 z-[1] border border-white/20 bg-black/55 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/70 backdrop-blur-sm'>
        {asset ? `${asset.provider} · ${asset.license}` : 'Procedural fallback'}
      </div>
    </div>
  );
}
