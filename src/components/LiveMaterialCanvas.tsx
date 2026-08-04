'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import {
  ColorPanels,
  Dithering,
  DotGrid,
  DotOrbit,
  FlutedGlass,
  GemSmoke,
  GodRays,
  GrainGradient,
  HalftoneCmyk,
  HalftoneDots,
  Heatmap,
  ImageDithering,
  LiquidMetal,
  MeshGradient,
  Metaballs,
  NeuroNoise,
  PaperTexture,
  PerlinNoise,
  PulsingBorder,
  SimplexNoise,
  SmokeRing,
  Spiral,
  StaticMeshGradient,
  StaticRadialGradient,
  Swirl,
  Voronoi,
  Warp,
  Water,
  Waves,
  colorPanelsPresets,
  ditheringPresets,
  dotGridPresets,
  dotOrbitPresets,
  flutedGlassPresets,
  gemSmokePresets,
  godRaysPresets,
  grainGradientPresets,
  halftoneCmykPresets,
  halftoneDotsPresets,
  heatmapPresets,
  imageDitheringPresets,
  liquidMetalPresets,
  meshGradientPresets,
  metaballsPresets,
  neuroNoisePresets,
  paperTexturePresets,
  perlinNoisePresets,
  pulsingBorderPresets,
  simplexNoisePresets,
  smokeRingPresets,
  spiralPresets,
  staticMeshGradientPresets,
  staticRadialGradientPresets,
  swirlPresets,
  voronoiPresets,
  warpPresets,
  waterPresets,
  wavesPresets,
  type ShaderComponentProps,
} from '@paper-design/shaders-react';
import {
  Component,
  createElement,
  memo,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

import type { RefObject } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import {
  getPaperLiveMaterialDefinition,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialSettings,
  type PaperLiveMaterialId,
  type PaperShaderFamilyId,
} from '@/lib/liveMaterials';
import {
  browserSupportsWebGL2,
  cancelWebGLContextRelease,
  scheduleWebGLContextRelease,
} from '@/lib/webglContext';

export type LiveMaterialCanvasProps = {
  activeWhileMounted?: boolean;
  className?: string;
  captureTimeMs?: number | null;
  enabled?: boolean;
  frameRate?: number;
  materialId: LiveMaterialId;
  paused?: boolean;
  renderScale?: number;
  settings: LiveMaterialSettings;
  sourceImage?: string;
  sourceImageOpacity?: number;
};

const CONTEXT_RECOVERY_DELAY_MS = 350;
const CONTEXT_RECOVERY_COOLDOWN_MS = 2_500;
const WEBGL_SUPPORT_RETRY_MS = 2_500;

const VERTEX_SOURCE = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FLUID_VERTEX_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FLUID_VELOCITY_SOURCE = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
uniform vec2 u_pointer;
uniform vec2 u_pointer_velocity;
uniform float u_pointer_active;
uniform float u_dt;
uniform float u_time;
uniform float u_strength;
uniform float u_frequency;

vec2 decodeVelocity(vec2 value) {
  return value * 2.0 - 1.0;
}

vec2 vortex(vec2 uv, vec2 center, float direction, float radius) {
  vec2 delta = uv - center;
  float influence = exp(-dot(delta, delta) / max(0.001, radius));
  return vec2(-delta.y, delta.x) * influence * direction;
}

void main() {
  vec2 velocity = decodeVelocity(texture2D(u_velocity, v_uv).xy);
  vec2 previousUv = clamp(v_uv - velocity * u_dt, u_texel, 1.0 - u_texel);
  velocity = decodeVelocity(texture2D(u_velocity, previousUv).xy) * 0.996;

  float motion = u_time * (1.35 + u_frequency * 0.06);
  vec2 sourceA = vec2(0.27 + sin(motion * 0.83) * 0.14, 0.38 + cos(motion * 0.71) * 0.16);
  vec2 sourceB = vec2(0.7 + cos(motion * 0.64) * 0.16, 0.64 + sin(motion * 0.77) * 0.14);
  vec2 sourceC = vec2(0.5 + sin(motion * 0.39) * 0.2, 0.5 + cos(motion * 0.48) * 0.2);
  float force = 0.032 + u_strength * 0.026;
  velocity += vortex(v_uv, sourceA, 1.0, 0.035) * force;
  velocity += vortex(v_uv, sourceB, -1.0, 0.04) * force;
  velocity += vortex(v_uv, sourceC, 0.7, 0.06) * force;
  velocity += vec2(
    sin((v_uv.y + motion * 0.08) * 6.2831),
    cos((v_uv.x - motion * 0.06) * 6.2831)
  ) * (0.0008 + u_strength * 0.0007);

  vec2 pointerDelta = v_uv - u_pointer;
  float pointerForce = exp(-dot(pointerDelta, pointerDelta) * 120.0) * u_pointer_active;
  velocity += u_pointer_velocity * pointerForce * 0.24;
  velocity = clamp(velocity, vec2(-0.46), vec2(0.46));
  gl_FragColor = vec4(velocity * 0.5 + 0.5, 0.0, 1.0);
}
`;

const FLUID_DYE_SOURCE = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_dye;
uniform sampler2D u_velocity;
uniform vec3 u_color_a;
uniform vec3 u_color_b;
uniform vec3 u_color_c;
uniform vec2 u_texel;
uniform vec2 u_pointer;
uniform float u_pointer_active;
uniform float u_dt;
uniform float u_time;
uniform float u_amplitude;
uniform float u_density;
uniform float u_strength;
uniform float u_frequency;

float splat(vec2 uv, vec2 center, float radius) {
  vec2 delta = uv - center;
  return exp(-dot(delta, delta) / max(0.001, radius));
}

float filament(vec2 uv, vec2 center, vec2 direction, float radius) {
  vec2 delta = uv - center;
  vec2 axis = normalize(direction);
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(delta, axis);
  float across = dot(delta, normal);
  float body = exp(
    -across * across / max(0.00008, radius * 0.16)
    -along * along / max(0.0002, radius * 5.5)
  );
  float core = exp(
    -across * across / max(0.00004, radius * 0.045)
    -along * along / max(0.0002, radius * 3.4)
  );
  return body * 0.58 + core * 0.72;
}

void main() {
  vec2 velocity = texture2D(u_velocity, v_uv).xy * 2.0 - 1.0;
  vec2 previousUv = clamp(v_uv - velocity * u_dt, u_texel, 1.0 - u_texel);
  vec3 dye = texture2D(u_dye, previousUv).rgb * mix(0.982, 0.997, clamp(u_density * 0.5, 0.0, 1.0));

  float motion = u_time * (1.35 + u_frequency * 0.06);
  vec2 sourceA = vec2(0.27 + sin(motion * 0.83) * 0.14, 0.38 + cos(motion * 0.71) * 0.16);
  vec2 sourceB = vec2(0.7 + cos(motion * 0.64) * 0.16, 0.64 + sin(motion * 0.77) * 0.14);
  vec2 sourceC = vec2(0.5 + sin(motion * 0.39) * 0.2, 0.5 + cos(motion * 0.48) * 0.2);
  float radius = 0.0018 + u_amplitude * 0.00055;
  float injection = 0.024 + u_strength * 0.02;
  float plumeA = splat(v_uv, sourceA, radius * 1.1)
    + filament(v_uv, sourceA, vec2(0.92, 0.38), radius) * 0.92;
  float plumeB = splat(v_uv, sourceB, radius * 1.28)
    + filament(v_uv, sourceB, vec2(-0.72, 0.7), radius * 1.08) * 0.88;
  float plumeC = splat(v_uv, sourceC, radius * 0.88)
    + filament(v_uv, sourceC, vec2(0.48, -0.88), radius * 0.82) * 0.76;
  dye += u_color_a * plumeA * injection;
  dye += u_color_b * plumeB * injection;
  dye += u_color_c * plumeC * injection;
  dye += u_color_c * (
    splat(v_uv, u_pointer, radius * 0.64)
    + filament(v_uv, u_pointer, vec2(0.8, 0.6), radius * 0.58)
  ) * u_pointer_active * 0.09;
  gl_FragColor = vec4(clamp(dye, 0.0, 1.5), 1.0);
}
`;

const FLUID_DISPLAY_SOURCE = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_brightness;
uniform float u_grain;
uniform float u_time;

float displayHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 dye = texture2D(u_dye, v_uv).rgb;
  vec3 dyeLeft = texture2D(u_dye, v_uv - vec2(u_texel.x, 0.0)).rgb;
  vec3 dyeRight = texture2D(u_dye, v_uv + vec2(u_texel.x, 0.0)).rgb;
  vec3 dyeDown = texture2D(u_dye, v_uv - vec2(0.0, u_texel.y)).rgb;
  vec3 dyeUp = texture2D(u_dye, v_uv + vec2(0.0, u_texel.y)).rgb;
  vec3 localAverage = (dyeLeft + dyeRight + dyeDown + dyeUp) * 0.25;
  vec3 sharpened = max(vec3(0.0), dye + (dye - localAverage) * 0.74);
  float edge = length(dyeRight - dyeLeft) + length(dyeUp - dyeDown);
  float luminance = dot(sharpened, vec3(0.2126, 0.7152, 0.0722));
  vec3 color = sharpened * u_brightness;
  vec3 edgeTint = mix(vec3(0.34, 0.48, 0.72), normalize(sharpened + 0.045), 0.72);
  color += edge * edgeTint * 0.42;
  color += pow(max(0.0, luminance), 2.0) * sharpened * 0.22;
  color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, 1.12);
  color = color / (vec3(1.0) + color * 0.12);
  color = pow(max(vec3(0.0), color), vec3(0.9));
  float grain = (displayHash(gl_FragCoord.xy + floor(u_time * 10.0)) - 0.5) * u_grain * 0.00038;
  gl_FragColor = vec4(max(vec3(0.0), color + grain), 1.0);
}
`;

const FRAGMENT_SHARED = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color_a;
uniform vec3 u_color_b;
uniform vec3 u_color_c;
uniform float u_strength;
uniform float u_detail;
uniform float u_frequency;
uniform float u_grain;
uniform float u_amplitude;
uniform float u_density;
uniform float u_brightness;
uniform float u_rotation;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  for (int index = 0; index < 5; index++) {
    value += amplitude * noise(p);
    p = mat2(1.62, 1.18, -1.18, 1.62) * p + 0.17;
    amplitude *= 0.5;
  }
  return value;
}

vec2 studioUv() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float angle = radians(u_rotation);
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
}

vec3 colorRamp(float t) {
  return t < 0.5 ? mix(u_color_a, u_color_b, t * 2.0) : mix(u_color_b, u_color_c, (t - 0.5) * 2.0);
}

vec3 finishColor(vec3 color) {
  float texture = (hash(gl_FragCoord.xy + u_time * 23.0) - 0.5) * (u_grain / 100.0) * 0.26;
  return max(vec3(0.0), color * u_brightness + texture);
}
`;

const SHADERS_FRAGMENT_BODIES: Record<Exclude<LiveMaterialId, 'shadergradient-prismatic-sphere' | 'glyphfield-glyph-field' | 'pavel-fluid-energy' | PaperLiveMaterialId>, string> = {
  'glyphfield-mesh-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.24;
  vec2 focusA = vec2(-0.52 + sin(time) * 0.18, -0.36 + cos(time * 0.7) * 0.16);
  vec2 focusB = vec2(0.48 + cos(time * 0.8) * 0.2, 0.4 + sin(time * 0.6) * 0.18);
  float fieldA = exp(-length(p - focusA) * (1.5 + u_frequency * 0.12));
  float fieldB = exp(-length(p - focusB) * (1.3 + u_frequency * 0.1));
  float warp = fbm(p * max(0.65, u_detail * 0.42) + time) * u_strength;
  vec3 color = mix(u_color_a, u_color_b, clamp(fieldA + warp * 0.22, 0.0, 1.0));
  color = mix(color, u_color_c, clamp(fieldB + warp * 0.16, 0.0, 1.0));
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'glyphfield-grain-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.3;
  float pigment = fbm(p * max(0.72, u_detail * 0.38) + vec2(time, -time * 0.72));
  pigment += sin((p.x * 0.7 + p.y) * u_frequency + time) * 0.13 * u_strength;
  float tone = smoothstep(0.08, 0.92, pigment);
  vec3 color = colorRamp(tone);
  float paper = hash(floor(gl_FragCoord.xy * 0.72) + floor(time * 5.0)) - 0.5;
  color += paper * (0.025 + u_grain / 100.0 * 0.22);
  gl_FragColor = vec4(max(vec3(0.0), color * u_brightness), 1.0);
}`,
  'glyphfield-dither-gradient': `
float bayer4(vec2 position) {
  vec2 cell = mod(floor(position), 4.0);
  float index = cell.x + cell.y * 4.0;
  if (index < 0.5) return 0.0 / 16.0;
  if (index < 1.5) return 8.0 / 16.0;
  if (index < 2.5) return 2.0 / 16.0;
  if (index < 3.5) return 10.0 / 16.0;
  if (index < 4.5) return 12.0 / 16.0;
  if (index < 5.5) return 4.0 / 16.0;
  if (index < 6.5) return 14.0 / 16.0;
  if (index < 7.5) return 6.0 / 16.0;
  if (index < 8.5) return 3.0 / 16.0;
  if (index < 9.5) return 11.0 / 16.0;
  if (index < 10.5) return 1.0 / 16.0;
  if (index < 11.5) return 9.0 / 16.0;
  if (index < 12.5) return 15.0 / 16.0;
  if (index < 13.5) return 7.0 / 16.0;
  if (index < 14.5) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.36;
  float flow = 0.5 + 0.5 * sin((p.x + p.y * 0.38 + fbm(p * max(0.8, u_detail) + time) * u_strength) * u_frequency);
  float cellSize = mix(2.0, 10.0, u_grain / 100.0);
  float threshold = bayer4(gl_FragCoord.xy / cellSize);
  float level = floor(clamp(flow + 0.5 - threshold, 0.0, 1.0) * 2.0) / 2.0;
  vec3 color = level < 0.25 ? u_color_a : level < 0.75 ? u_color_b : u_color_c;
  gl_FragColor = vec4(max(vec3(0.0), color * u_brightness), 1.0);
}`,
  'shaders-pixel-beams': `
void main() {
  vec2 p = studioUv();
  float cells = mix(3.0, 18.0, u_grain / 100.0);
  vec2 cell = floor(gl_FragCoord.xy / cells);
  float plasma = 0.5 + 0.5 * sin((p.x + sin(p.y * u_detail + u_time)) * u_frequency + u_time * 1.7);
  float threshold = hash(cell) * 0.78;
  float beam = step(threshold, plasma + u_strength * 0.16);
  vec3 color = mix(u_color_a, u_color_b, beam);
  color = mix(color, u_color_c, smoothstep(0.7, 1.0, plasma) * 0.65);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-soft-register': `
void main() {
  vec2 p = studioUv();
  float warp = fbm(p * max(0.6, u_detail) + vec2(u_time * 0.18, -u_time * 0.12));
  float flow = 0.5 + 0.5 * sin((p.x + p.y * 0.42 + warp * (1.0 + u_strength * 2.0)) * u_frequency);
  vec3 color = colorRamp(flow);
  float dots = smoothstep(0.72, 1.0, sin(gl_FragCoord.x * 0.42) * sin(gl_FragCoord.y * 0.42));
  color = mix(color, color.bgr, dots * (u_grain / 100.0) * 0.3);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-spectral-bloom': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.72;
  float strength = clamp(u_strength, 0.0, 1.5);
  float frequency = 1.25 + u_frequency * 0.22;

  vec2 flow = p;
  flow += vec2(
    sin(p.y * (1.35 + u_detail * 0.12) + time * 0.62),
    cos(p.x * (1.15 + u_detail * 0.1) - time * 0.48)
  ) * (0.1 + strength * 0.075);

  float radius = length(flow);
  float currentA = 0.5 + 0.5 * sin(
    (flow.x * 0.72 + flow.y) * frequency
    + radius * (1.4 + u_amplitude * 0.34)
    - time
  );
  float currentB = 0.5 + 0.5 * sin(
    (flow.x * 1.08 - flow.y * 0.58) * (frequency * 0.86)
    - radius * (1.8 + u_detail * 0.18)
    + time * 0.74
  );
  float pulse = 0.5 + 0.5 * sin(radius * (2.2 + u_detail * 0.24) - time * 0.56);
  float convergence = 1.0 - abs(currentA - currentB);
  float energy = currentA * 0.42 + currentB * 0.3 + pulse * 0.16 + convergence * 0.12;
  energy = smoothstep(0.08, 0.94, energy);

  float core = 1.0 - smoothstep(0.04, 1.6, radius);
  float bloom = smoothstep(0.12, 0.92, energy + core * 0.16);
  float crest = smoothstep(0.56, 1.08, energy + currentA * 0.14 + core * 0.08);
  vec3 color = mix(u_color_a, u_color_b, 0.1 + bloom * 0.74);
  color = mix(color, u_color_c, crest * (0.42 + strength * 0.22));
  color += mix(u_color_b, u_color_c, 0.5) * bloom * core * 0.08;

  float falloff = 1.0 - smoothstep(0.72, 1.78, length(p));
  color *= mix(0.34, 1.0, falloff);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-pistons': `
void main() {
  vec2 p = studioUv();
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float rays = pow(abs(sin(angle * max(3.0, floor(u_frequency)))), 5.0 - min(3.5, u_strength));
  float pulse = 0.65 + 0.35 * sin(radius * (9.0 + u_detail) - u_time * 2.0);
  vec3 color = mix(u_color_a, u_color_b, rays * pulse);
  color = mix(color, u_color_c, smoothstep(0.74, 1.0, rays) * u_strength);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-fluid-chrome': `
float chromeLobe(float value, float center, float width) {
  float position = (value - center) / max(width, 0.001);
  return exp(-position * position);
}

float chromeEnvironment(float reflection) {
  float broadSky = chromeLobe(reflection, -0.68, 0.43) * 0.3;
  float upperStrip = chromeLobe(reflection, -0.28, 0.06) * 0.9;
  float blackCard = chromeLobe(reflection, -0.02, 0.12) * 0.31;
  float lowerRoom = chromeLobe(reflection, 0.25, 0.27) * 0.55;
  float edgeStrip = chromeLobe(reflection, 0.61, 0.045) * 1.08;
  return clamp(0.018 + broadSky + upperStrip - blackCard + lowerRoom + edgeStrip, 0.0, 1.15);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.1;
  float field = fbm(p * max(0.76, u_detail * 0.52) + vec2(time, -time * 0.68));
  float fineField = fbm(p * max(1.8, u_detail * 1.35) - vec2(time * 0.45, time));
  float displacement = (field - 0.5) * (0.28 + u_strength * 0.66);
  float reflection = dot(p, normalize(vec2(0.24, 0.97)));
  reflection += displacement + (fineField - 0.5) * u_strength * 0.13;
  reflection += sin(p.x * 1.35 - p.y * 0.48 + time) * 0.08 * u_strength;
  float environment = chromeEnvironment(reflection);
  float edge = pow(smoothstep(0.5, 1.48, length(p)), 3.4) * 0.18;
  float brush = (hash(vec2(floor(gl_FragCoord.y * 1.8), floor(gl_FragCoord.x * 0.015))) - 0.5) * 0.014;
  vec3 shadow = mix(vec3(0.006), u_color_a * 0.18, 0.42);
  vec3 silver = mix(vec3(0.74), u_color_b, 0.28);
  vec3 color = mix(shadow, silver, clamp(environment, 0.0, 1.0));
  color += max(0.0, environment - 1.0) * vec3(0.9);
  color += edge * mix(vec3(0.3), u_color_c, 0.12) + brush;
  color = pow(max(color, vec3(0.0)), vec3(0.92));
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-chroma-flow': `
void main() {
  vec2 p = studioUv();
  float flow = sin(p.y * u_frequency + sin(p.x * u_detail + u_time) * (1.0 + u_strength * 2.0));
  float flutes = 0.5 + 0.5 * sin((p.x + flow * 0.16) * (18.0 + u_frequency * 3.0));
  vec3 color = mix(u_color_a, u_color_b, smoothstep(-0.6, 0.7, flow));
  color = mix(color, u_color_c, pow(flutes, 3.0) * (0.35 + u_strength * 0.35));
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-drift': `
void main() {
  vec2 p = studioUv();
  p.y += 0.55;
  float smoke = fbm(vec2(p.x * (1.5 + u_detail * 0.2), p.y * 1.4 - u_time * 0.45));
  float width = 0.2 + smoke * (0.3 + u_strength * 0.22) + max(0.0, p.y) * 0.24;
  float plume = smoothstep(width, width - 0.18, abs(p.x + (smoke - 0.5) * 0.32));
  plume *= smoothstep(-1.15, 0.72, p.y) * (1.0 - smoothstep(0.3, 1.05, p.y));
  vec3 color = mix(u_color_a, mix(u_color_b, u_color_c, smoke), plume);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-mosaic': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float cellSize = mix(0.018, 0.09, u_grain / 100.0);
  vec2 cellUv = floor(uv / cellSize) * cellSize;
  vec2 p = cellUv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float swirl = fbm(p * max(1.0, u_detail) + u_time * 0.16);
  float tone = 0.5 + 0.5 * sin((p.x + p.y + swirl * u_strength * 3.0) * u_frequency);
  vec2 edge = fract(uv / cellSize);
  float inset = step(0.04, edge.x) * step(0.04, edge.y);
  vec3 color = colorRamp(tone) * mix(0.72, 1.0, inset);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'shaders-circuit': `
void main() {
  vec2 p = studioUv();
  float warp = fbm(p * max(1.0, u_detail) + u_time * 0.1) * u_strength * 0.28;
  vec2 gridUv = fract((p + warp) * max(4.0, u_frequency));
  vec2 lines = smoothstep(vec2(0.82), vec2(0.98), abs(gridUv * 2.0 - 1.0));
  float grid = max(lines.x, lines.y);
  float field = 0.5 + 0.5 * sin((p.x - p.y + warp) * u_frequency + u_time);
  vec3 color = mix(u_color_a, u_color_b, field * 0.45);
  color = mix(color, u_color_c, grid);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-line-field': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.42;
  float warp = fbm(p * max(0.8, u_detail * 0.55) + vec2(time * 0.35, -time * 0.2));
  float sweep = p.y + sin(p.x * (1.2 + u_detail * 0.16) + time) * (0.18 + u_strength * 0.08);
  sweep += (warp - 0.5) * (0.34 + u_strength * 0.24);
  float bands = abs(fract(sweep * (1.4 + u_frequency * 0.28)) - 0.5);
  float line = smoothstep(0.13, 0.012, bands);
  float halo = smoothstep(0.34, 0.02, bands) * (0.18 + u_strength * 0.12);
  float crossFlow = 0.5 + 0.5 * sin((p.x - p.y * 0.42 + warp) * u_frequency - time * 0.7);
  vec3 color = mix(u_color_a, u_color_b, crossFlow * 0.42 + halo);
  color = mix(color, u_color_c, line * (0.64 + u_strength * 0.16));
  color += mix(u_color_b, u_color_c, 0.5) * halo * 0.18;
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-chrome-glares': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.12;
  float flow = fbm(p * max(0.7, u_detail * 0.58) + vec2(time, -time * 0.7));
  float reflection = p.y + (flow - 0.5) * (0.38 + u_strength * 0.3);
  reflection += sin(p.x * (1.2 + u_frequency * 0.08) + time) * 0.12;
  float broad = exp(-pow((reflection + 0.42) / 0.42, 2.0)) * 0.36;
  float stripA = exp(-pow((reflection + 0.08) / 0.045, 2.0));
  float stripB = exp(-pow((reflection - 0.48) / 0.028, 2.0));
  float darkCard = exp(-pow((reflection - 0.14) / 0.11, 2.0)) * 0.5;
  float metal = clamp(0.025 + broad + stripA * 0.85 + stripB * 1.15 - darkCard, 0.0, 1.2);
  float rim = pow(smoothstep(0.48, 1.5, length(p)), 3.0);
  vec3 shadow = mix(vec3(0.004), u_color_a, 0.16);
  vec3 silver = mix(vec3(0.82), u_color_b, 0.26);
  vec3 color = mix(shadow, silver, clamp(metal, 0.0, 1.0));
  color += max(0.0, metal - 1.0) * mix(vec3(1.0), u_color_c, 0.24);
  color += rim * u_color_c * 0.1;
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-relief-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.18;
  float turbulence = fbm(p * max(0.9, u_detail * 0.48) + vec2(time, -time * 0.45));
  float field = p.x * 0.7 + p.y * 0.42 + (turbulence - 0.5) * (0.9 + u_strength * 0.55);
  float ridges = sin(field * (2.2 + u_frequency * 0.52) + time);
  float relief = 0.5 + 0.5 * ridges;
  float edgeLight = pow(1.0 - abs(ridges), 3.0);
  float shadow = smoothstep(0.16, 0.9, relief);
  vec3 color = colorRamp(smoothstep(0.04, 0.96, relief));
  color *= 0.64 + shadow * 0.48;
  color += u_color_c * edgeLight * (0.16 + u_strength * 0.18);
  color = mix(color, u_color_a, smoothstep(0.84, 1.6, length(p)) * 0.36);
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-orbit-gradient': `
float orbitLobe(vec2 p, vec2 center, float radius) {
  vec2 delta = p - center;
  return exp(-dot(delta, delta) / max(0.01, radius));
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.25;
  float orbitRadius = 0.34 + u_amplitude * 0.018;
  vec2 centerA = vec2(cos(time), sin(time * 0.9)) * orbitRadius;
  vec2 centerB = vec2(cos(time * 0.74 + 2.1), sin(time * 0.82 + 2.1)) * orbitRadius * 1.2;
  vec2 centerC = vec2(cos(-time * 0.62 + 4.2), sin(-time * 0.7 + 4.2)) * orbitRadius * 0.82;
  float lobeA = orbitLobe(p, centerA, 0.18 + u_density * 0.06);
  float lobeB = orbitLobe(p, centerB, 0.22 + u_density * 0.05);
  float lobeC = orbitLobe(p, centerC, 0.15 + u_density * 0.05);
  float texture = fbm(p * max(0.7, u_detail * 0.42) + time * 0.12);
  vec3 color = mix(u_color_a, u_color_b, clamp(lobeA + texture * 0.16, 0.0, 1.0));
  color = mix(color, u_color_c, clamp(lobeB * 0.82 + lobeC * 0.72, 0.0, 1.0));
  color += mix(u_color_b, u_color_c, 0.5) * lobeA * lobeC * u_strength * 0.28;
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-radiant-void': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.2;
  float angle = atan(p.y, p.x);
  float distortion = fbm(p * max(0.8, u_detail * 0.5) + vec2(time, -time * 0.7));
  float radius = length(p) + (distortion - 0.5) * (0.16 + u_strength * 0.08);
  float aperture = smoothstep(0.19, 0.56, radius);
  float ring = exp(-pow((radius - 0.62) / (0.1 + u_amplitude * 0.008), 2.0));
  float rays = pow(0.5 + 0.5 * sin(angle * max(3.0, u_frequency) + time), 8.0);
  vec3 color = mix(u_color_a * 0.12, u_color_b, aperture * 0.48);
  color = mix(color, u_color_c, ring * (0.68 + rays * 0.24));
  color += mix(u_color_b, u_color_c, 0.5) * ring * rays * u_strength * 0.2;
  color *= 1.0 - smoothstep(1.0, 1.8, radius) * 0.68;
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
  'study-galactic-rings': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.24;
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float warp = fbm(p * max(0.75, u_detail * 0.48) + vec2(time * 0.3, -time * 0.22));
  float ringCoordinate = radius * (3.6 + u_frequency * 0.42) + angle * 0.34;
  ringCoordinate += (warp - 0.5) * (1.2 + u_strength * 0.8) - time;
  float rings = 0.5 + 0.5 * sin(ringCoordinate * 3.14159);
  float crest = pow(rings, 5.0);
  float glass = smoothstep(0.08, 0.92, rings + warp * 0.18);
  vec3 color = mix(u_color_a, u_color_b, glass * 0.72);
  color = mix(color, u_color_c, crest * (0.58 + u_strength * 0.18));
  float innerLight = 1.0 - smoothstep(0.0, 0.9, radius);
  color += mix(u_color_b, u_color_c, 0.5) * innerLight * crest * 0.16;
  color *= 1.0 - smoothstep(1.0, 1.75, radius) * 0.52;
  gl_FragColor = vec4(finishColor(color), 1.0);
}`,
};

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function cssRgb(
  color: readonly [number, number, number],
  opacity: number
): string {
  return `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)} / ${Math.max(0, Math.min(1, opacity))})`;
}

function blendRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  progress: number
): readonly [number, number, number] {
  const amount = Math.max(0, Math.min(1, progress));
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

function GlyphFieldCanvas({
  active,
  canvasRef,
  captureTimeMs,
  paused,
  renderScale,
  settings,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const activeRef = useRef(active);
  const captureTimeRef = useRef(captureTimeMs);
  const pausedRef = useRef(paused);
  const settingsRef = useRef(settings);
  activeRef.current = active;
  captureTimeRef.current = captureTimeMs;
  pausedRef.current = paused;
  settingsRef.current = settings;

  useMountEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const glyphs = 'GLYPHFIELD';
    let elapsed = 0;
    let frame = 0;
    let timeout = 0;
    let previous = performance.now();

    function scheduleNextFrame() {
      if (!activeRef.current || (pausedRef.current && captureTimeRef.current === null)) {
        timeout = window.setTimeout(
          () => { frame = requestAnimationFrame(draw); },
          activeRef.current ? 120 : 400
        );
        return;
      }
      frame = requestAnimationFrame(draw);
    }

    function draw(time: number) {
      if (!activeRef.current && captureTimeRef.current === null) {
        previous = time;
        scheduleNextFrame();
        return;
      }
      const current = settingsRef.current;
      const controlledTime = captureTimeRef.current;
      const delta = Math.min(64, time - previous);
      previous = time;
      if (controlledTime === null && !pausedRef.current) elapsed += delta * current.speed;
      const renderedTime = (controlledTime === null ? elapsed : controlledTime * current.speed) / 1000;
      const pixelRatio = Math.min(2.5, (window.devicePixelRatio || 1) * renderScale);
      const width = Math.max(1, drawingCanvas.clientWidth);
      const height = Math.max(1, drawingCanvas.clientHeight);
      const outputWidth = Math.round(width * pixelRatio);
      const outputHeight = Math.round(height * pixelRatio);
      if (drawingCanvas.width !== outputWidth || drawingCanvas.height !== outputHeight) {
        drawingCanvas.width = outputWidth;
        drawingCanvas.height = outputHeight;
      }

      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawingContext.fillStyle = current.colorA;
      drawingContext.fillRect(0, 0, width, height);

      const background = hexToRgb(current.colorA);
      const foreground = hexToRgb(current.colorB);
      const accent = hexToRgb(current.colorC);
      const columns = Math.round(34 + Math.min(7, current.detail) * 3.2);
      const rows = Math.round(22 + Math.min(7, current.detail) * 2.2);
      const fieldScale = Math.min(width, height) * (0.72 + current.amplitude * 0.025);
      const rotation = Math.sin(renderedTime * 0.46) * (0.18 + current.strength * 0.09);
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);
      const points: Array<{
        color: readonly [number, number, number];
        glyph: string;
        opacity: number;
        size: number;
        x: number;
        y: number;
        z: number;
      }> = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = (column / (columns - 1)) * 2 - 1;
          const y = (row / (rows - 1)) * 2 - 1;
          const radius = Math.hypot(x, y);
          const ring = radius > 0.45 && radius < 0.88;
          const opening = x > 0.18 && Math.abs(y) < 0.32;
          const crossbar = x > 0.08 && x < 0.82 && y > -0.08 && y < 0.18;
          const isGlyph = (ring && !opening) || crossbar;
          const seed = (row * 83 + column * 37) % 101;
          const keep = seed / 100 <= Math.min(1, 0.42 + current.density * 0.68);
          if (!isGlyph || !keep) continue;

          const wave = Math.sin(x * current.frequency + renderedTime * 1.2)
            * Math.cos(y * (current.frequency * 0.7) - renderedTime * 0.82);
          const depth = wave * (0.12 + current.strength * 0.18)
            + Math.sin((x + y) * current.detail + seed) * 0.035;
          const rotatedX = x * cosRotation + depth * sinRotation;
          const rotatedZ = -x * sinRotation + depth * cosRotation;
          const perspective = 1 / (1.8 - rotatedZ * 0.42);
          const screenX = width * 0.5 + rotatedX * fieldScale * perspective;
          const screenY = height * 0.5 + y * fieldScale * perspective;
          const depthProgress = Math.max(0, Math.min(1, 0.5 + rotatedZ * 0.75));
          const baseColor = blendRgb(foreground, accent, depthProgress);
          points.push({
            color: blendRgb(background, baseColor, 0.62 + depthProgress * 0.38),
            glyph: glyphs[(row * 3 + column) % glyphs.length]!,
            opacity: (0.28 + depthProgress * 0.72) * Math.min(1.25, current.brightness),
            size: Math.max(5.5, Math.min(14, fieldScale / columns * 1.05)) * (0.78 + perspective * 0.55),
            x: screenX,
            y: screenY,
            z: rotatedZ,
          });
        }
      }

      points.sort((a, b) => a.z - b.z);
      drawingContext.textAlign = 'center';
      drawingContext.textBaseline = 'middle';
      for (const point of points) {
        drawingContext.fillStyle = cssRgb(point.color, point.opacity);
        drawingContext.font = `500 ${point.size}px Switzer, Arial, sans-serif`;
        drawingContext.fillText(point.glyph, point.x, point.y);
      }

      const particleCount = Math.round(28 + current.grain * 0.72);
      for (let index = 0; index < particleCount; index += 1) {
        const phase = index * 29.17;
        const particleX = ((Math.sin(phase * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const particleY = ((Math.sin(phase * 78.233) * 15731.743) % 1 + 1) % 1;
        const drift = Math.sin(renderedTime * 0.3 + phase) * 18;
        const color = blendRgb(foreground, accent, index % 5 / 4);
        drawingContext.fillStyle = cssRgb(color, 0.1 + (index % 7) * 0.018);
        drawingContext.font = `500 ${5 + (index % 4)}px Switzer, Arial, sans-serif`;
        drawingContext.fillText(glyphs[index % glyphs.length]!, particleX * width + drift, particleY * height);
      }

      scheduleNextFrame();
    }

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  });

  return <canvas className='absolute inset-0 size-full' ref={canvasRef} />;
}

function compileShader(
  context: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = context.createShader(type);
  if (!shader) throw new Error('Shader allocation failed');
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const message = context.getShaderInfoLog(shader)?.trim()
      || (context.isContextLost()
        ? 'WebGL context lost during shader compilation'
        : 'Shader compilation failed');
    context.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function ShaderGradientSurface({
  captureTimeMs,
  className,
  paused,
  renderScale,
  settings,
}: {
  captureTimeMs: number | null;
  className: string;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  return (
    <ShaderGradientCanvas
      className={`absolute inset-0 size-full ${className}`}
      fov={45}
      pixelDensity={Math.min(2, renderScale)}
      pointerEvents='none'
      preserveDrawingBuffer
      style={{ height: '100%', inset: 0, position: 'absolute', width: '100%' }}
    >
      <ShaderGradient
        animate={paused || captureTimeMs !== null ? 'off' : 'on'}
        brightness={settings.brightness}
        cAzimuthAngle={270}
        cDistance={0.5}
        cPolarAngle={180}
        cameraZoom={15.1}
        color1={settings.colorA}
        color2={settings.colorB}
        color3={settings.colorC}
        control='props'
        envPreset='city'
        grain={settings.grain > 0 ? 'on' : 'off'}
        lightType='env'
        positionX={-0.1}
        positionY={0}
        positionZ={0}
        range='enabled'
        rangeEnd={40}
        rangeStart={0}
        rotationX={settings.rotationX}
        rotationY={settings.rotationY}
        rotationZ={settings.rotationZ}
        shader='defaults'
        type='sphere'
        uAmplitude={settings.amplitude}
        uDensity={settings.density}
        uFrequency={settings.frequency}
        uSpeed={paused || captureTimeMs !== null ? 0 : settings.speed}
        uStrength={settings.strength}
        uTime={captureTimeMs === null ? 0 : captureTimeMs / 1000 * settings.speed}
        wireframe={false}
        zoomOut
      />
    </ShaderGradientCanvas>
  );
}

class WebGLProviderBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  onFailure: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProviderContextGuard({
  children,
  className = '',
  onContextLost,
}: {
  children: ReactNode;
  className?: string;
  onContextLost: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useMountEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observedCanvases = new Set<HTMLCanvasElement>();
    let disposed = false;
    let recoveryRequested = false;
    let recoveryTimer = 0;

    const requestRecovery = () => {
      if (disposed || recoveryRequested) return;
      recoveryRequested = true;
      recoveryTimer = window.setTimeout(onContextLost, 0);
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      requestRecovery();
    };
    const observeCanvases = () => {
      host.querySelectorAll('canvas').forEach((canvas) => {
        if (observedCanvases.has(canvas)) return;
        observedCanvases.add(canvas);
        canvas.addEventListener('webglcontextlost', handleContextLost);
      });
    };

    observeCanvases();
    const observer = new MutationObserver(observeCanvases);
    observer.observe(host, { childList: true, subtree: true });
    const healthTimer = window.setTimeout(() => {
      const canvas = host.querySelector('canvas');
      if (!canvas || canvas.width < 1 || canvas.height < 1) requestRecovery();
    }, 1200);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(healthTimer);
      window.clearTimeout(recoveryTimer);
      observedCanvases.forEach((canvas) => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
      });
    };
  });

  return (
    <div
      className={`absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden ${className}`}
      ref={hostRef}
      style={{ contain: 'strict', isolation: 'isolate' }}
    >
      {children}
    </div>
  );
}

function SourceAssetOverlay({ opacity, source }: { opacity: number; source?: string }) {
  if (!source) return null;
  return (
    <img
      alt=''
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 z-[2] size-full object-cover'
      src={source}
      style={{ mixBlendMode: 'soft-light', opacity: Math.max(0, Math.min(1, opacity / 100)) }}
    />
  );
}

function OriginalMaterialCanvas({
  active,
  canvasRef,
  captureTimeMs,
  frameRate,
  fragmentSource,
  onContextLost,
  paused,
  renderScale,
  settings,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  frameRate: number;
  fragmentSource: string;
  onContextLost: () => void;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const activeRef = useRef(active);
  const captureTimeRef = useRef(captureTimeMs);
  const frameRateRef = useRef(frameRate);
  const pausedRef = useRef(paused);
  const settingsRef = useRef(settings);
  activeRef.current = active;
  captureTimeRef.current = captureTimeMs;
  frameRateRef.current = frameRate;
  pausedRef.current = paused;
  settingsRef.current = settings;

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!context) {
      window.setTimeout(onContextLost, 120);
      return;
    }
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: WebGLRenderingContext = context;
    cancelWebGLContextRelease(drawingCanvas);

    let vertexShader: WebGLShader;
    let fragmentShader: WebGLShader;
    try {
      vertexShader = compileShader(context, context.VERTEX_SHADER, VERTEX_SOURCE);
      fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
    } catch {
      scheduleWebGLContextRelease(drawingCanvas, context);
      window.setTimeout(onContextLost, 120);
      return;
    }
    const program = context.createProgram();
    if (!program) {
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      window.setTimeout(onContextLost, 120);
      return;
    }
    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      context.deleteProgram(program);
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      window.setTimeout(onContextLost, 120);
      return;
    }
    const buffer = context.createBuffer();
    if (!buffer) {
      context.deleteProgram(program);
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      window.setTimeout(onContextLost, 120);
      return;
    }
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      context.STATIC_DRAW
    );
    context.useProgram(program);
    const position = context.getAttribLocation(program, 'a_position');
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);

    const resolutionLocation = context.getUniformLocation(program, 'u_resolution');
    const timeLocation = context.getUniformLocation(program, 'u_time');
    const colorALocation = context.getUniformLocation(program, 'u_color_a');
    const colorBLocation = context.getUniformLocation(program, 'u_color_b');
    const colorCLocation = context.getUniformLocation(program, 'u_color_c');
    const strengthLocation = context.getUniformLocation(program, 'u_strength');
    const detailLocation = context.getUniformLocation(program, 'u_detail');
    const frequencyLocation = context.getUniformLocation(program, 'u_frequency');
    const grainLocation = context.getUniformLocation(program, 'u_grain');
    const amplitudeLocation = context.getUniformLocation(program, 'u_amplitude');
    const densityLocation = context.getUniformLocation(program, 'u_density');
    const brightnessLocation = context.getUniformLocation(program, 'u_brightness');
    const rotationLocation = context.getUniformLocation(program, 'u_rotation');

    let frame = 0;
    let timeout = 0;
    let elapsed = 0;
    let lastDrawn = 0;
    let previous = performance.now();
    let disposed = false;

    function handleContextLost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      if (!disposed) window.setTimeout(onContextLost, 0);
    }

    drawingCanvas.addEventListener('webglcontextlost', handleContextLost);

    function scheduleNextFrame() {
      if (!activeRef.current || (pausedRef.current && captureTimeRef.current === null)) {
        timeout = window.setTimeout(
          () => { frame = requestAnimationFrame(draw); },
          activeRef.current ? 120 : 400
        );
        return;
      }
      frame = requestAnimationFrame(draw);
    }

    function draw(time: number) {
      if (!activeRef.current && captureTimeRef.current === null) {
        previous = time;
        scheduleNextFrame();
        return;
      }
      const frameInterval = 1000 / Math.max(1, frameRateRef.current);
      if (
        captureTimeRef.current === null
        && !pausedRef.current
        && lastDrawn > 0
        && time - lastDrawn < frameInterval
      ) {
        scheduleNextFrame();
        return;
      }
      lastDrawn = time;
      const current = settingsRef.current;
      const controlledTime = captureTimeRef.current;
      const delta = Math.min(64, time - previous);
      previous = time;
      if (controlledTime === null && !pausedRef.current) elapsed += delta * current.speed;
      const renderedTime = controlledTime === null ? elapsed : controlledTime * current.speed;
      const pixelRatio = Math.min(3, (window.devicePixelRatio || 1) * renderScale);
      const width = Math.max(1, Math.round(drawingCanvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(drawingCanvas.clientHeight * pixelRatio));
      if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
      }
      drawingContext.viewport(0, 0, width, height);
      drawingContext.uniform2f(resolutionLocation, width, height);
      drawingContext.uniform1f(timeLocation, renderedTime / 1000);
      drawingContext.uniform3fv(colorALocation, hexToRgb(current.colorA));
      drawingContext.uniform3fv(colorBLocation, hexToRgb(current.colorB));
      drawingContext.uniform3fv(colorCLocation, hexToRgb(current.colorC));
      drawingContext.uniform1f(strengthLocation, current.strength);
      drawingContext.uniform1f(detailLocation, current.detail);
      drawingContext.uniform1f(frequencyLocation, current.frequency);
      drawingContext.uniform1f(grainLocation, current.grain);
      drawingContext.uniform1f(amplitudeLocation, current.amplitude);
      drawingContext.uniform1f(densityLocation, current.density);
      drawingContext.uniform1f(brightnessLocation, current.brightness);
      drawingContext.uniform1f(rotationLocation, current.rotationZ);
      drawingContext.drawArrays(drawingContext.TRIANGLES, 0, 6);
      scheduleNextFrame();
    }

    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      drawingCanvas.removeEventListener('webglcontextlost', handleContextLost);
      drawingContext.deleteBuffer(buffer);
      drawingContext.deleteProgram(program);
      drawingContext.deleteShader(fragmentShader);
      drawingContext.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, drawingContext);
    };
  });

  return <canvas className='absolute inset-0 size-full' ref={canvasRef} />;
}

type FluidRenderTarget = {
  framebuffer: WebGLFramebuffer;
  height: number;
  texture: WebGLTexture;
  width: number;
};

function FluidSimulationCanvas({
  active,
  canvasRef,
  captureTimeMs,
  frameRate,
  onContextLost,
  paused,
  renderScale,
  settings,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  frameRate: number;
  onContextLost: () => void;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const activeRef = useRef(active);
  const captureTimeRef = useRef(captureTimeMs);
  const frameRateRef = useRef(frameRate);
  const pausedRef = useRef(paused);
  const settingsRef = useRef(settings);
  activeRef.current = active;
  captureTimeRef.current = captureTimeMs;
  frameRateRef.current = frameRate;
  pausedRef.current = paused;
  settingsRef.current = settings;

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!context) {
      window.setTimeout(onContextLost, 120);
      return;
    }
    const drawingCanvas: HTMLCanvasElement = canvas;
    const gl: WebGLRenderingContext = context;
    cancelWebGLContextRelease(drawingCanvas);

    const shaders: WebGLShader[] = [];
    const programs: WebGLProgram[] = [];
    const targets: FluidRenderTarget[] = [];
    let buffer: WebGLBuffer | null = null;
    let disposed = false;

    function createProgram(fragmentSource: string): WebGLProgram {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, FLUID_VERTEX_SOURCE);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      shaders.push(vertexShader, fragmentShader);
      const program = gl.createProgram();
      if (!program) throw new Error('Fluid program allocation failed');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program)?.trim() || 'Fluid program linking failed';
        gl.deleteProgram(program);
        throw new Error(message);
      }
      programs.push(program);
      return program;
    }

    function createTarget(width: number, height: number): FluidRenderTarget {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      if (!texture || !framebuffer) throw new Error('Fluid render target allocation failed');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(texture);
        throw new Error('Fluid framebuffer is incomplete');
      }
      const target = { framebuffer, height, texture, width };
      targets.push(target);
      return target;
    }

    function deleteTargets() {
      targets.splice(0).forEach((target) => {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.texture);
      });
    }

    function prepareProgram(program: WebGLProgram, target: FluidRenderTarget | null, width: number, height: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    }

    function bindTexture(program: WebGLProgram, name: string, texture: WebGLTexture, unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    }

    let velocityProgram: WebGLProgram;
    let dyeProgram: WebGLProgram;
    let displayProgram: WebGLProgram;
    try {
      velocityProgram = createProgram(FLUID_VELOCITY_SOURCE);
      dyeProgram = createProgram(FLUID_DYE_SOURCE);
      displayProgram = createProgram(FLUID_DISPLAY_SOURCE);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Fluid geometry allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
    } catch {
      if (buffer) gl.deleteBuffer(buffer);
      programs.forEach((program) => gl.deleteProgram(program));
      shaders.forEach((shader) => gl.deleteShader(shader));
      deleteTargets();
      scheduleWebGLContextRelease(drawingCanvas, gl);
      window.setTimeout(onContextLost, 120);
      return;
    }

    let velocityRead: FluidRenderTarget | null = null;
    let velocityWrite: FluidRenderTarget | null = null;
    let dyeRead: FluidRenderTarget | null = null;
    let dyeWrite: FluidRenderTarget | null = null;
    let simulationWidth = 0;
    let simulationHeight = 0;
    let frame = 0;
    let timeout = 0;
    let previous = performance.now();
    let elapsed = 0;
    let lastDrawn = 0;
    const pointer = { activeUntil: 0, lastX: 0.5, lastY: 0.5, velocityX: 0, velocityY: 0, x: 0.5, y: 0.5 };

    function initializeTargets(width: number, height: number, current: LiveMaterialSettings) {
      deleteTargets();
      velocityRead = createTarget(width, height);
      velocityWrite = createTarget(width, height);
      dyeRead = createTarget(width, height);
      dyeWrite = createTarget(width, height);
      simulationWidth = width;
      simulationHeight = height;
      gl.viewport(0, 0, width, height);
      for (const target of [velocityRead, velocityWrite]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.clearColor(0.5, 0.5, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      const base = hexToRgb(current.colorA);
      for (const target of [dyeRead, dyeWrite]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.clearColor(base[0] * 0.08, base[1] * 0.08, base[2] * 0.08, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const bounds = drawingCanvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const nextY = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
      pointer.velocityX = Math.max(-0.35, Math.min(0.35, (nextX - pointer.lastX) * 2.8));
      pointer.velocityY = Math.max(-0.35, Math.min(0.35, (nextY - pointer.lastY) * 2.8));
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.lastX = nextX;
      pointer.lastY = nextY;
      pointer.activeUntil = performance.now() + 140;
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      if (!disposed) window.setTimeout(onContextLost, 0);
    }

    drawingCanvas.addEventListener('pointermove', handlePointerMove, { passive: true });
    drawingCanvas.addEventListener('webglcontextlost', handleContextLost);

    function scheduleNextFrame() {
      if (!activeRef.current || (pausedRef.current && captureTimeRef.current === null)) {
        timeout = window.setTimeout(
          () => { frame = requestAnimationFrame(draw); },
          activeRef.current ? 120 : 400
        );
        return;
      }
      frame = requestAnimationFrame(draw);
    }

    function draw(time: number) {
      if (!activeRef.current && captureTimeRef.current === null) {
        previous = time;
        scheduleNextFrame();
        return;
      }
      const maximumRate = Math.min(45, Math.max(1, frameRateRef.current));
      const frameInterval = 1000 / maximumRate;
      if (captureTimeRef.current === null && !pausedRef.current && lastDrawn > 0 && time - lastDrawn < frameInterval) {
        scheduleNextFrame();
        return;
      }
      lastDrawn = time;
      const current = settingsRef.current;
      const deltaMs = Math.min(42, Math.max(1, time - previous));
      previous = time;
      if (captureTimeRef.current === null && !pausedRef.current) elapsed += deltaMs * current.speed;
      const renderedTime = captureTimeRef.current === null ? elapsed / 1000 : captureTimeRef.current / 1000 * current.speed;
      const pixelRatio = Math.min(2.5, (window.devicePixelRatio || 1) * renderScale);
      const width = Math.max(1, Math.round(drawingCanvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(drawingCanvas.clientHeight * pixelRatio));
      if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
      }
      const aspect = width / Math.max(1, height);
      const simulationScale = Math.min(1.65, Math.max(0.6, renderScale * Math.sqrt(pixelRatio)));
      const simulationSize = Math.round(
        Math.min(720, 250 + current.detail * 48) * simulationScale
      );
      const nextSimulationWidth = Math.max(64, aspect >= 1 ? simulationSize : Math.round(simulationSize * aspect));
      const nextSimulationHeight = Math.max(64, aspect >= 1 ? Math.round(simulationSize / aspect) : simulationSize);

      try {
        if (!velocityRead || !velocityWrite || !dyeRead || !dyeWrite || simulationWidth !== nextSimulationWidth || simulationHeight !== nextSimulationHeight) {
          initializeTargets(nextSimulationWidth, nextSimulationHeight, current);
        }
        if (!velocityRead || !velocityWrite || !dyeRead || !dyeWrite) return;
        const texelX = 1 / simulationWidth;
        const texelY = 1 / simulationHeight;
        const dt = Math.min(0.032, deltaMs / 1000 * (0.72 + current.speed * 0.6));
        const pointerActive = time < pointer.activeUntil ? 1 : 0;

        prepareProgram(velocityProgram, velocityWrite, simulationWidth, simulationHeight);
        bindTexture(velocityProgram, 'u_velocity', velocityRead.texture, 0);
        gl.uniform2f(gl.getUniformLocation(velocityProgram, 'u_texel'), texelX, texelY);
        gl.uniform2f(gl.getUniformLocation(velocityProgram, 'u_pointer'), pointer.x, pointer.y);
        gl.uniform2f(gl.getUniformLocation(velocityProgram, 'u_pointer_velocity'), pointer.velocityX, pointer.velocityY);
        gl.uniform1f(gl.getUniformLocation(velocityProgram, 'u_pointer_active'), pointerActive);
        gl.uniform1f(gl.getUniformLocation(velocityProgram, 'u_dt'), dt);
        gl.uniform1f(gl.getUniformLocation(velocityProgram, 'u_time'), renderedTime);
        gl.uniform1f(gl.getUniformLocation(velocityProgram, 'u_strength'), current.strength);
        gl.uniform1f(gl.getUniformLocation(velocityProgram, 'u_frequency'), current.frequency);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        [velocityRead, velocityWrite] = [velocityWrite, velocityRead];

        prepareProgram(dyeProgram, dyeWrite, simulationWidth, simulationHeight);
        bindTexture(dyeProgram, 'u_dye', dyeRead.texture, 0);
        bindTexture(dyeProgram, 'u_velocity', velocityRead.texture, 1);
        gl.uniform3fv(gl.getUniformLocation(dyeProgram, 'u_color_a'), hexToRgb(current.colorA));
        gl.uniform3fv(gl.getUniformLocation(dyeProgram, 'u_color_b'), hexToRgb(current.colorB));
        gl.uniform3fv(gl.getUniformLocation(dyeProgram, 'u_color_c'), hexToRgb(current.colorC));
        gl.uniform2f(gl.getUniformLocation(dyeProgram, 'u_texel'), texelX, texelY);
        gl.uniform2f(gl.getUniformLocation(dyeProgram, 'u_pointer'), pointer.x, pointer.y);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_pointer_active'), pointerActive);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_dt'), dt);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_time'), renderedTime);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_amplitude'), current.amplitude);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_density'), current.density);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_strength'), current.strength);
        gl.uniform1f(gl.getUniformLocation(dyeProgram, 'u_frequency'), current.frequency);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        [dyeRead, dyeWrite] = [dyeWrite, dyeRead];

        prepareProgram(displayProgram, null, width, height);
        bindTexture(displayProgram, 'u_dye', dyeRead.texture, 0);
        gl.uniform2f(gl.getUniformLocation(displayProgram, 'u_texel'), texelX, texelY);
        gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_brightness'), current.brightness);
        gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_grain'), current.grain);
        gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_time'), renderedTime);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } catch {
        if (!disposed) window.setTimeout(onContextLost, 0);
        return;
      }
      pointer.velocityX *= 0.82;
      pointer.velocityY *= 0.82;
      scheduleNextFrame();
    }

    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      drawingCanvas.removeEventListener('pointermove', handlePointerMove);
      drawingCanvas.removeEventListener('webglcontextlost', handleContextLost);
      deleteTargets();
      if (buffer) gl.deleteBuffer(buffer);
      programs.forEach((program) => gl.deleteProgram(program));
      shaders.forEach((shader) => gl.deleteShader(shader));
      scheduleWebGLContextRelease(drawingCanvas, gl);
    };
  });

  return <canvas aria-label='Interactive WebGL fluid material' className='absolute inset-0 size-full' ref={canvasRef} />;
}

type PaperShaderPreset = {
  name: string;
  params: Record<string, unknown>;
};

type PaperShaderRenderer = {
  component: ComponentType<ShaderComponentProps & Record<string, unknown>>;
  presets: readonly PaperShaderPreset[];
};

function paperShaderRenderer(component: unknown, presets: readonly unknown[]): PaperShaderRenderer {
  return {
    component: component as PaperShaderRenderer['component'],
    presets: presets as readonly PaperShaderPreset[],
  };
}

const PAPER_SHADER_RENDERERS: Record<PaperShaderFamilyId, PaperShaderRenderer> = {
  'color-panels': paperShaderRenderer(ColorPanels, colorPanelsPresets),
  'dithering': paperShaderRenderer(Dithering, ditheringPresets),
  'dot-grid': paperShaderRenderer(DotGrid, dotGridPresets),
  'dot-orbit': paperShaderRenderer(DotOrbit, dotOrbitPresets),
  'fluted-glass': paperShaderRenderer(FlutedGlass, flutedGlassPresets),
  'gem-smoke': paperShaderRenderer(GemSmoke, gemSmokePresets),
  'god-rays': paperShaderRenderer(GodRays, godRaysPresets),
  'grain-gradient': paperShaderRenderer(GrainGradient, grainGradientPresets),
  'halftone-cmyk': paperShaderRenderer(HalftoneCmyk, halftoneCmykPresets),
  'halftone-dots': paperShaderRenderer(HalftoneDots, halftoneDotsPresets),
  'heatmap': paperShaderRenderer(Heatmap, heatmapPresets),
  'image-dithering': paperShaderRenderer(ImageDithering, imageDitheringPresets),
  'liquid-metal': paperShaderRenderer(LiquidMetal, liquidMetalPresets),
  'mesh-gradient': paperShaderRenderer(MeshGradient, meshGradientPresets),
  'metaballs': paperShaderRenderer(Metaballs, metaballsPresets),
  'neuro-noise': paperShaderRenderer(NeuroNoise, neuroNoisePresets),
  'paper-texture': paperShaderRenderer(PaperTexture, paperTexturePresets),
  'perlin-noise': paperShaderRenderer(PerlinNoise, perlinNoisePresets),
  'pulsing-border': paperShaderRenderer(PulsingBorder, pulsingBorderPresets),
  'simplex-noise': paperShaderRenderer(SimplexNoise, simplexNoisePresets),
  'smoke-ring': paperShaderRenderer(SmokeRing, smokeRingPresets),
  'spiral': paperShaderRenderer(Spiral, spiralPresets),
  'static-mesh-gradient': paperShaderRenderer(StaticMeshGradient, staticMeshGradientPresets),
  'static-radial-gradient': paperShaderRenderer(StaticRadialGradient, staticRadialGradientPresets),
  'swirl': paperShaderRenderer(Swirl, swirlPresets),
  'voronoi': paperShaderRenderer(Voronoi, voronoiPresets),
  'warp': paperShaderRenderer(Warp, warpPresets),
  'water': paperShaderRenderer(Water, waterPresets),
  'waves': paperShaderRenderer(Waves, wavesPresets),
};

const PAPER_IMAGE_SHADER_FAMILIES = new Set<PaperShaderFamilyId>([
  'fluted-glass',
  'gem-smoke',
  'halftone-cmyk',
  'halftone-dots',
  'heatmap',
  'image-dithering',
  'water',
]);

const PAPER_PROCEDURAL_BACKDROP_FAMILIES = new Set<PaperShaderFamilyId>([
  'gem-smoke',
  'liquid-metal',
]);

function paperControlOverrides(params: Record<string, unknown>, settings: LiveMaterialSettings): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const setIfPresent = (key: string, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) overrides[key] = value;
  };
  const scaledIfPresent = (
    keys: readonly string[],
    factor: number,
    zeroSpan = 0.25,
    integer = false
  ) => {
    keys.forEach((key) => {
      const original = params[key];
      if (typeof original !== 'number') return;
      const scaled = original === 0
        ? Math.max(0, (factor - 1) * zeroSpan)
        : Math.max(0, original * factor);
      overrides[key] = integer ? Math.max(1, Math.round(scaled)) : scaled;
    });
  };
  const factorFromDefault = (value: number, defaultValue: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, 0.4 + (value / defaultValue) * 0.6));
  const strengthFactor = factorFromDefault(settings.strength, 0.3, 0.35, 3.4);
  const detailFactor = factorFromDefault(settings.detail, 3.2, 0.35, 2.5);
  const frequencyFactor = factorFromDefault(settings.frequency, 5.5, 0.3, 2.3);
  const amplitudeFactor = factorFromDefault(settings.amplitude, 3.2, 0.3, 2.4);
  const densityFactor = factorFromDefault(settings.density, 0.8, 0.35, 2.2);
  const palette = [settings.colorB, settings.colorC, settings.colorA];
  if (Array.isArray(params.colors)) {
    overrides.colors = params.colors.map((_, index) => palette[index % palette.length]);
  }
  setIfPresent('colorBack', settings.colorA);
  setIfPresent('colorGap', settings.colorA);
  setIfPresent('colorShadow', settings.colorA);
  setIfPresent('colorFill', settings.colorB);
  setIfPresent('colorFront', settings.colorB);
  setIfPresent('colorInner', settings.colorB);
  setIfPresent('colorMid', settings.colorB);
  setIfPresent('colorBloom', settings.colorC);
  setIfPresent('colorGlow', settings.colorC);
  setIfPresent('colorHighlight', settings.colorC);
  setIfPresent('colorStroke', settings.colorC);
  setIfPresent('colorTint', settings.colorC);
  setIfPresent('colorC', settings.colorB);
  setIfPresent('colorM', settings.colorC);
  setIfPresent('colorY', settings.colorB);
  setIfPresent('colorK', settings.colorA);

  scaledIfPresent(
    ['intensity', 'contrast', 'bloom', 'outerGlow', 'innerGlow', 'highlights', 'glow'],
    strengthFactor,
    0.35
  );
  scaledIfPresent(
    ['noiseIterations', 'octaveCount', 'foldCount', 'count', 'bandCount', 'stepsPerColor', 'layering', 'edges'],
    detailFactor,
    2,
    true
  );
  scaledIfPresent(
    ['frequency', 'noiseFrequency', 'noiseScale', 'repetition', 'spots', 'gapX', 'gapY', 'strokeWidth'],
    frequencyFactor,
    1.5
  );
  scaledIfPresent(
    ['amplitude', 'waves', 'waveX', 'waveY', 'thickness', 'radius', 'size', 'distortion', 'swirl', 'stretch'],
    amplitudeFactor,
    0.3
  );
  scaledIfPresent(
    ['density', 'proportion', 'spreading', 'softness', 'spotty', 'smoke', 'noise', 'roughness', 'fiber', 'crumples', 'folds'],
    densityFactor,
    0.25
  );

  const presetScale = typeof params.scale === 'number' ? params.scale : 1;
  setIfPresent(
    'scale',
    presetScale * amplitudeFactor * Math.sqrt(frequencyFactor) * (0.92 + detailFactor * 0.08)
  );
  const presetRotation = typeof params.rotation === 'number' ? params.rotation : 0;
  setIfPresent('rotation', presetRotation + settings.rotationZ);
  const presetOffsetX = typeof params.offsetX === 'number' ? params.offsetX : 0;
  const presetOffsetY = typeof params.offsetY === 'number' ? params.offsetY : 0;
  setIfPresent('offsetX', presetOffsetX + Math.sin(settings.rotationY * Math.PI / 180) * 0.34);
  setIfPresent('offsetY', presetOffsetY - Math.sin(settings.rotationX * Math.PI / 180) * 0.34);

  const grainAmount = Math.min(1, Math.max(0, settings.grain / 100));
  setIfPresent('grainMixer', grainAmount);
  setIfPresent('grainOverlay', grainAmount);
  setIfPresent('grainSize', 0.12 + grainAmount * 1.6);
  setIfPresent('gridNoise', grainAmount);
  if (typeof params.brightness === 'number') {
    overrides.brightness = params.brightness * settings.brightness;
  }
  return overrides;
}

function PaperShaderSurface({
  captureTimeMs,
  materialId,
  paused,
  renderScale,
  settings,
  sourceImage,
}: {
  captureTimeMs: number | null;
  materialId: PaperLiveMaterialId;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
  sourceImage?: string;
}) {
  const definition = getPaperLiveMaterialDefinition(materialId);
  const renderer = PAPER_SHADER_RENDERERS[definition.family];
  const preset = renderer.presets[definition.presetIndex] ?? renderer.presets[0]!;
  const presetSpeed = typeof preset.params.speed === 'number' ? preset.params.speed : 1;
  const motionSpeed = presetSpeed > 0 ? presetSpeed : 0.35;
  const presetFrame = typeof preset.params.frame === 'number' ? preset.params.frame : 0;
  const effectiveSpeed = paused || captureTimeMs !== null ? 0 : motionSpeed * settings.speed;
  const controlledParams = {
    ...preset.params,
    ...paperControlOverrides(preset.params, settings),
  };
  const usesImage = PAPER_IMAGE_SHADER_FAMILIES.has(definition.family)
    && !PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(definition.family);
  const rendersBackdrop = usesImage || PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(definition.family);
  const rotation = typeof controlledParams.rotation === 'number' ? controlledParams.rotation : 0;
  const baseScale = typeof controlledParams.scale === 'number' ? controlledParams.scale : 1;
  const rotationCoverBoost = 1 + Math.abs(Math.sin(rotation * Math.PI / 180)) * 1.15;
  const backdropParams = rendersBackdrop ? {
    fit: 'cover',
    scale: Math.min(4, Math.max(1, baseScale) * rotationCoverBoost),
    worldHeight: 0,
    worldWidth: 0,
  } : {};
  // Canvas-fill mode exposes a flat rectangular plate in these edge-driven shaders.
  // Oversized organic masks keep the material full-bleed without hiding its texture.
  const proceduralBackdropParams = definition.family === 'gem-smoke'
    ? {
        colorInner: '#00000000',
        image: undefined,
        scale: Math.min(1.45, Math.max(1.12, baseScale * 1.45)),
        shape: 'metaballs',
      }
    : definition.family === 'liquid-metal'
      ? {
          image: undefined,
          shape: 'metaballs',
        }
      : {};
  const surfaceProps: ShaderComponentProps = {
    className: 'absolute inset-0 block size-full max-h-none max-w-none overflow-hidden',
    height: '100%',
    maxPixelCount: Math.max(18_000, Math.round(360_000 * Math.min(2, renderScale * renderScale))),
    minPixelRatio: 0.5,
    style: {
      display: 'block',
      height: '100%',
      inset: 0,
      margin: 0,
      maxHeight: 'none',
      maxWidth: 'none',
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      position: 'absolute',
      width: '100%',
    },
    webGlContextAttributes: {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    },
    width: '100%',
  };
  const surface = createElement(renderer.component, {
    ...surfaceProps,
    ...controlledParams,
    ...backdropParams,
    ...(usesImage ? { image: sourceImage ?? '/shader-source-art.svg' } : {}),
    ...proceduralBackdropParams,
    frame: captureTimeMs === null
      ? presetFrame
      : presetFrame + captureTimeMs / 1000 * motionSpeed * settings.speed,
    speed: effectiveSpeed,
  });

  return (
    <div
      aria-label={`Paper Shaders ${definition.name} material`}
      className='paper-shader-host absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden'
      data-paper-motion={effectiveSpeed === 0 ? 'paused' : 'running'}
      data-paper-speed={effectiveSpeed}
      style={{
        contain: 'strict',
        filter: [
          `brightness(${settings.brightness})`,
          `contrast(${Math.max(0.5, 1 + (settings.strength - 0.3) * 0.24)})`,
          `saturate(${Math.max(0.35, 1 + (settings.density - 0.8) * 0.3)})`,
        ].join(' '),
        isolation: 'isolate',
      }}
    >
      {surface}
      {settings.grain > 0 ? (
        <span
          aria-hidden='true'
          className='paper-material-grain pointer-events-none absolute inset-0'
          style={{ opacity: Math.min(0.34, settings.grain / 260) }}
        />
      ) : null}
    </div>
  );
}

function StaticMaterialFallback({
  className,
  containerRef,
  settings,
  sourceImage,
  sourceImageOpacity,
}: {
  className: string;
  containerRef: RefObject<HTMLDivElement | null>;
  settings: LiveMaterialSettings;
  sourceImage?: string;
  sourceImageOpacity: number;
}) {
  return (
    <div
      aria-label='Static shader fallback'
      className={`absolute inset-0 size-full ${className}`}
      ref={containerRef}
      style={{ background: settings.colorA }}
    >
      <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
    </div>
  );
}

function LiveMaterialCanvas({
  activeWhileMounted = false,
  className = '',
  captureTimeMs = null,
  enabled = true,
  frameRate = 60,
  materialId,
  paused = false,
  renderScale = 1,
  settings,
  sourceImage,
  sourceImageOpacity = 36,
}: LiveMaterialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedMaterialId = normalizeLiveMaterialId(materialId);
  const [webGL2Available, setWebGL2Available] = useState<boolean | null>(null);
  const [renderVisible, setRenderVisible] = useState(true);
  const [contextRecovery, setContextRecovery] = useState(() => ({
    failed: false,
    materialId: resolvedMaterialId,
    version: 0,
  }));
  const recoveryTimerRef = useRef(0);
  const activeRecovery = contextRecovery.materialId === resolvedMaterialId
    ? contextRecovery
    : { failed: false, materialId: resolvedMaterialId, version: 0 };
  const renderActive = (activeWhileMounted || renderVisible) && enabled;
  const requiresWebGL2 = resolvedMaterialId === 'shadergradient-prismatic-sphere'
    || isPaperLiveMaterialId(resolvedMaterialId);
  const paperDefinition = isPaperLiveMaterialId(resolvedMaterialId)
    ? getPaperLiveMaterialDefinition(resolvedMaterialId)
    : null;
  const paperUsesSourceImage = paperDefinition
    ? PAPER_IMAGE_SHADER_FAMILIES.has(paperDefinition.family)
      && !PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(paperDefinition.family)
    : false;
  const recoverContext = () => {
    if (recoveryTimerRef.current) return;
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = 0;
      setContextRecovery((current) => {
        const currentVersion = current.materialId === resolvedMaterialId ? current.version : 0;
        return {
          failed: currentVersion >= 5,
          materialId: resolvedMaterialId,
          version: Math.min(5, currentVersion + 1),
        };
      });
    }, CONTEXT_RECOVERY_DELAY_MS);
  };
  const failProviderContext = recoverContext;

  useEffect(() => {
    if (!requiresWebGL2) {
      setWebGL2Available(null);
      return;
    }

    let disposed = false;
    let retryTimer = 0;
    const checkSupport = () => {
      const available = browserSupportsWebGL2();
      if (disposed) return;
      setWebGL2Available(available);
      if (!available) retryTimer = window.setTimeout(checkSupport, WEBGL_SUPPORT_RETRY_MS);
    };
    checkSupport();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
    };
  }, [requiresWebGL2]);

  useEffect(() => () => {
    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = 0;
  }, [resolvedMaterialId]);

  useEffect(() => {
    if (!activeRecovery.failed || !enabled) return;
    const retryTimer = window.setTimeout(() => {
      setContextRecovery({ failed: false, materialId: resolvedMaterialId, version: 0 });
    }, CONTEXT_RECOVERY_COOLDOWN_MS);
    return () => window.clearTimeout(retryTimer);
  }, [activeRecovery.failed, enabled, resolvedMaterialId]);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let intersecting = true;
    const updateVisibility = () => {
      const nextVisible = intersecting && document.visibilityState !== 'hidden';
      setRenderVisible((current) => current === nextVisible ? current : nextVisible);
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      updateVisibility();
    }, { rootMargin: '160px' });
    observer.observe(container);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  });

  if (!enabled) {
    return (
      <StaticMaterialFallback
        className={className}
        containerRef={containerRef}
        settings={settings}
        sourceImage={sourceImage}
        sourceImageOpacity={sourceImageOpacity}
      />
    );
  }

  if (activeRecovery.failed) {
    return (
      <StaticMaterialFallback
        className={className}
        containerRef={containerRef}
        settings={settings}
        sourceImage={sourceImage}
        sourceImageOpacity={sourceImageOpacity}
      />
    );
  }

  if (resolvedMaterialId === 'shadergradient-prismatic-sphere') {
    if (webGL2Available !== true) {
      return (
        <StaticMaterialFallback
          className={className}
          containerRef={containerRef}
          settings={settings}
          sourceImage={sourceImage}
          sourceImageOpacity={sourceImageOpacity}
        />
      );
    }

    const providerFallback = (
      <div
        aria-label='Static shader fallback'
        className='absolute inset-0 size-full'
        style={{ background: `linear-gradient(135deg, ${settings.colorA}, ${settings.colorB} 52%, ${settings.colorC})` }}
      />
    );
    return (
      <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
        <WebGLProviderBoundary
          fallback={providerFallback}
          key={`shadergradient-boundary-${activeRecovery.version}`}
          onFailure={failProviderContext}
        >
          <ProviderContextGuard
            key={`shadergradient-${activeRecovery.version}`}
            onContextLost={failProviderContext}
          >
            <ShaderGradientSurface
              captureTimeMs={captureTimeMs}
              className=''
              paused={paused || !renderActive}
              renderScale={renderScale}
              settings={settings}
            />
          </ProviderContextGuard>
        </WebGLProviderBoundary>
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (resolvedMaterialId === 'glyphfield-glyph-field') {
    return (
      <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
        <GlyphFieldCanvas
          active={renderActive}
          canvasRef={canvasRef}
          captureTimeMs={captureTimeMs}
          paused={paused || !renderActive}
          renderScale={renderScale}
          settings={settings}
        />
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (resolvedMaterialId === 'pavel-fluid-energy') {
    return (
      <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
        <FluidSimulationCanvas
          active={renderActive}
          canvasRef={canvasRef}
          captureTimeMs={captureTimeMs}
          frameRate={frameRate}
          key={`pavel-fluid-${activeRecovery.version}`}
          onContextLost={recoverContext}
          paused={paused || !renderActive}
          renderScale={renderScale}
          settings={settings}
        />
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (isPaperLiveMaterialId(resolvedMaterialId)) {
    if (webGL2Available !== true) {
      return (
        <StaticMaterialFallback
          className={className}
          containerRef={containerRef}
          settings={settings}
          sourceImage={sourceImage}
          sourceImageOpacity={sourceImageOpacity}
        />
      );
    }

    return (
      <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
        <ProviderContextGuard
          key={`paper-${resolvedMaterialId}-${activeRecovery.version}`}
          onContextLost={failProviderContext}
        >
          <PaperShaderSurface
            captureTimeMs={captureTimeMs}
            materialId={resolvedMaterialId}
            paused={paused || !renderActive}
            renderScale={renderScale}
            settings={settings}
            sourceImage={sourceImage}
          />
        </ProviderContextGuard>
        {paperUsesSourceImage ? null : <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />}
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
      <OriginalMaterialCanvas
        active={renderActive}
        canvasRef={canvasRef}
        captureTimeMs={captureTimeMs}
        frameRate={frameRate}
        fragmentSource={`${FRAGMENT_SHARED}${SHADERS_FRAGMENT_BODIES[resolvedMaterialId]}`}
        key={`${resolvedMaterialId}-${activeRecovery.version}`}
        onContextLost={recoverContext}
        paused={paused || !renderActive}
        renderScale={renderScale}
        settings={settings}
      />
      <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
    </div>
  );
}

export default memo(LiveMaterialCanvas);
