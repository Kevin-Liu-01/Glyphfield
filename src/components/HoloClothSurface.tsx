'use client';

import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { BackgroundSettings } from '@/lib/backgroundSvg';
import { HoloClothSimulation } from '@/lib/holoClothSimulation';

const SEGMENTS_X = 36;
const SEGMENTS_Y = 25;
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XcWQ9QAAAABJRU5ErkJggg==';

const VERTEX_SHADER = /* glsl */ `
varying vec2 vHoloUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vHoloUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/* MIT adaptation of HoloCloth's view-angle diffraction and micro-flake model. */
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vHoloUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform vec3 uCamera;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uTime;
uniform float uHolo;
uniform float uScale;
uniform float uBands;
uniform float uHue;
uniform float uSparkle;
uniform float uRoughness;
uniform float uMetalness;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
vec3 studio(vec3 ray, float roughness) {
  float ceiling = smoothstep(-0.1, 0.9, ray.y);
  float key = pow(max(dot(ray, normalize(vec3(-0.56, 0.62, 0.55))), 0.0), mix(90.0, 8.0, roughness));
  float rim = pow(max(dot(ray, normalize(vec3(0.76, -0.08, 0.64))), 0.0), mix(110.0, 12.0, roughness));
  return vec3(0.055, 0.06, 0.08) + ceiling * vec3(0.34, 0.37, 0.45) + key * 3.2 + rim * vec3(0.7, 0.85, 1.4);
}

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 view = normalize(uCamera - vWorldPosition);
  float facing = clamp(abs(dot(normal, view)), 0.0, 1.0);
  float fresnel = pow(1.0 - facing, 1.45);
  vec2 cells = floor(vHoloUv * uScale);
  float randomA = hash21(cells);
  float randomB = hash21(cells + 71.7);
  float radial = length(vHoloUv - 0.5) * 1.58;
  float foldPhase = dot(normal.xy, vec2(0.78, 0.62)) * 0.2;
  float hue = fract(uHue + facing * uBands + radial + foldPhase + randomA * 0.055 + uTime * 0.006);
  vec3 rainbow = hsv2rgb(vec3(hue, 0.86, 1.0));

  float diagonal = clamp(vHoloUv.x * 0.58 + (1.0 - vHoloUv.y) * 0.42, 0.0, 1.0);
  vec3 brand = mix(mix(uColorA, uColorB, diagonal), uColorC, smoothstep(0.48, 1.0, length(vHoloUv - vec2(0.72, 0.2))));
  float warp = 0.84 + 0.16 * sin(vHoloUv.x * 330.0);
  float weft = 0.84 + 0.16 * sin(vHoloUv.y * 330.0 + 1.57);
  float weave = mix(warp, weft, step(0.5, fract((vHoloUv.x + vHoloUv.y) * 92.0)));
  brand *= mix(0.88, 1.08, weave);

  vec3 reflection = studio(reflect(-view, normal), uRoughness);
  float dielectric = mix(0.04, 0.88, uMetalness);
  float specularFresnel = dielectric + (1.0 - dielectric) * pow(1.0 - facing, 5.0);
  float cavity = smoothstep(-0.22, 0.52, normal.z);
  vec3 base = brand * (0.38 + facing * 0.32) * mix(vec3(1.0), rainbow * 1.7 + 0.25, uHolo * 0.72);
  vec3 specular = reflection * specularFresnel * (1.0 - uRoughness * 0.64);
  vec3 film = rainbow * reflection * uHolo * (0.26 + fresnel * 1.7);

  float gate = fract(randomB * 13.7 + facing * 7.0 + uTime * 0.08);
  float glint = smoothstep(1.0 - 0.014 * uSparkle, 1.0, gate) * 4.6 * fresnel;
  vec3 color = (base + specular + film + rainbow * glint * uSparkle) * mix(0.62, 1.0, cavity);
  float grain = (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.045;
  color += grain;
  gl_FragColor = vec4(pow(max(color, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

export default function HoloClothSurface({
  artworkOpacity = 1,
  artworkScale = 0.28,
  artworkUrl,
  artworkX = 0,
  artworkY = 0,
  settings,
  transparent = false,
}: {
  artworkOpacity?: number;
  artworkScale?: number;
  artworkUrl?: string;
  artworkX?: number;
  artworkY?: number;
  settings: BackgroundSettings;
  transparent?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const planeRef = useRef(new THREE.Plane());
  const grabPointRef = useRef(new THREE.Vector3());
  const [grabbing, setGrabbing] = useState(false);
  const { camera } = useThree();
  const drape = settings.surfaceDepth / 100;
  const simulation = useMemo(() => new HoloClothSimulation(3.7, 2.5, SEGMENTS_X, SEGMENTS_Y, drape), []);
  const geometry = useMemo(() => {
    const value = new THREE.PlaneGeometry(3.7, 2.5, SEGMENTS_X, SEGMENTS_Y);
    (value.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    value.attributes.position.array.set(simulation.positions);
    value.attributes.position.needsUpdate = true;
    value.computeVertexNormals();
    return value;
  }, [simulation]);
  const colors = useMemo(() => ({
    a: new THREE.Color(settings.colorA),
    b: new THREE.Color(settings.colorB),
    c: new THREE.Color(settings.colorC),
  }), [settings.colorA, settings.colorB, settings.colorC]);
  const artworkTexture = useLoader(THREE.TextureLoader, artworkUrl ?? TRANSPARENT_PIXEL);
  artworkTexture.colorSpace = THREE.SRGBColorSpace;
  const artworkLayerTexture = useMemo(() => {
    if (!artworkUrl) return null;
    const image = artworkTexture.image as CanvasImageSource & { height?: number; naturalHeight?: number; naturalWidth?: number; width?: number };
    const imageWidth = image.naturalWidth ?? image.width ?? 0;
    const imageHeight = image.naturalHeight ?? image.height ?? 0;
    if (!imageWidth || !imageHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 810;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const maxWidth = canvas.width * Math.max(0.08, artworkScale);
    const maxHeight = canvas.height * Math.max(0.08, artworkScale);
    const fit = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
    const width = imageWidth * fit;
    const height = imageHeight * fit;
    const x = canvas.width * (0.5 + artworkX) - width / 2;
    const y = canvas.height * (0.5 + artworkY) - height / 2;
    context.drawImage(image, x, y, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [artworkScale, artworkTexture, artworkUrl, artworkX, artworkY]);
  const uniforms = useMemo(() => ({
    uBands: { value: 1.6 + settings.surfaceAngle / 36 },
    uCamera: { value: camera.position },
    uColorA: { value: colors.a },
    uColorB: { value: colors.b },
    uColorC: { value: colors.c },
    uHolo: { value: settings.surfaceTextureAmount / 100 },
    uHue: { value: settings.surfaceAngle / 180 },
    uMetalness: { value: settings.surfaceMetallic / 100 },
    uRoughness: { value: settings.surfaceRoughness / 100 },
    uScale: { value: 28 + settings.surfaceScale * 2.8 },
    uSparkle: { value: settings.surfaceIrregularity / 100 },
    uTime: { value: 0 },
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => artworkLayerTexture?.dispose(), [artworkLayerTexture]);
  useEffect(() => {
    simulation.reset(drape);
    geometry.attributes.position.array.set(simulation.positions);
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [drape, geometry, simulation]);

  useEffect(() => {
    uniforms.uColorA.value.copy(colors.a);
    uniforms.uColorB.value.copy(colors.b);
    uniforms.uColorC.value.copy(colors.c);
    uniforms.uHolo.value = settings.surfaceTextureAmount / 100;
    uniforms.uScale.value = 28 + settings.surfaceScale * 2.8;
    uniforms.uBands.value = 1.6 + settings.surfaceAngle / 36;
    uniforms.uHue.value = settings.surfaceAngle / 180;
    uniforms.uSparkle.value = settings.surfaceIrregularity / 100;
    uniforms.uRoughness.value = settings.surfaceRoughness / 100;
    uniforms.uMetalness.value = settings.surfaceMetallic / 100;
  }, [colors, settings.surfaceAngle, settings.surfaceIrregularity, settings.surfaceMetallic, settings.surfaceRoughness, settings.surfaceScale, settings.surfaceTextureAmount, uniforms]);

  useFrame((state, delta) => {
    simulation.step(delta, {
      damping: 0.1 + (100 - settings.surfaceOpenArea) / 250,
      iterations: 2 + Math.round(settings.surfaceOpenArea / 28),
      relaxation: 0.04 + settings.surfaceRoughness / 280,
      stiffness: 0.38 + settings.surfaceOpenArea / 180,
    });
    const position = geometry.attributes.position;
    position.array.set(simulation.positions);
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uCamera.value.copy(camera.position);
  });

  function localPoint(point: THREE.Vector3) {
    return meshRef.current?.worldToLocal(point.clone()) ?? point.clone();
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const local = localPoint(event.point);
    if (!simulation.startGrab([local.x, local.y, local.z], 0.46)) return;
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, event.point);
    (event.nativeEvent.target as Element | null)?.setPointerCapture?.(event.pointerId);
    setGrabbing(true);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!simulation.isGrabbing) return;
    const world = event.ray.intersectPlane(planeRef.current, grabPointRef.current);
    if (!world) return;
    const local = localPoint(world);
    simulation.moveGrab([local.x, local.y, local.z]);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    simulation.endGrab();
    (event.nativeEvent.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    setGrabbing(false);
  }

  return (
    <>
      {!transparent ? <color attach='background' args={['#07080b']} /> : null}
      {!transparent ? (
        <mesh position={[0, -1.22, -0.56]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.2, 3.8]} />
          <meshBasicMaterial color='#020204' transparent opacity={0.72} />
        </mesh>
      ) : null}
      <mesh
        frustumCulled={false}
        geometry={geometry}
        onDoubleClick={() => simulation.poke(0, 0, 0.24)}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={meshRef}
        rotation={[-0.08, 0.16, -0.035]}
        scale={grabbing ? 1.01 : 1}
      >
        <shaderMaterial
          fragmentShader={FRAGMENT_SHADER}
          ref={materialRef}
          side={THREE.DoubleSide}
          uniforms={uniforms}
          vertexShader={VERTEX_SHADER}
        />
      </mesh>
      {artworkLayerTexture ? (
        <mesh
          frustumCulled={false}
          geometry={geometry}
          renderOrder={2}
          rotation={[-0.08, 0.16, -0.035]}
          scale={grabbing ? 1.01 : 1}
        >
          <meshBasicMaterial
            alphaTest={0.015}
            depthWrite={false}
            map={artworkLayerTexture}
            opacity={artworkOpacity}
            polygonOffset
            polygonOffsetFactor={-2}
            side={THREE.DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
      ) : null}
    </>
  );
}
