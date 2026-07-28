'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo, useRef, useState } from 'react';

import type { RefObject } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import { normalizeLiveMaterialId, type LiveMaterialId, type LiveMaterialSettings } from '@/lib/liveMaterials';
import { cancelWebGLContextRelease, scheduleWebGLContextRelease } from '@/lib/webglContext';

export type LiveMaterialCanvasProps = {
  className?: string;
  captureTimeMs?: number | null;
  enabled?: boolean;
  materialId: LiveMaterialId;
  paused?: boolean;
  renderScale?: number;
  settings: LiveMaterialSettings;
};

const VERTEX_SOURCE = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
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

const SHADERS_FRAGMENT_BODIES: Record<Exclude<LiveMaterialId, 'shadergradient-prismatic-sphere' | 'glyphfield-glyph-field'>, string> = {
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
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float rays = 0.5 + 0.5 * sin(angle * max(3.0, u_frequency) + radius * u_amplitude * 3.0 - u_time);
  float rings = 0.5 + 0.5 * sin(radius * (8.0 + u_detail * 4.0) - u_time * 1.4);
  vec3 color = colorRamp(fract(rays * 0.75 + rings * 0.5 + radius));
  color *= 1.0 - smoothstep(0.72, 1.4, radius) * 0.72;
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
  'shaders-dedalus-bloom': `
void main() {
  vec2 p = studioUv();
  float field = fbm(p * max(1.0, u_detail) - vec2(u_time * 0.1, u_time * 0.14));
  vec2 center = vec2(0.08, 0.16);
  float radius = length(p - center + (field - 0.5) * u_strength * 0.32);
  float bloom = smoothstep(0.78 + u_strength * 0.18, 0.12, radius);
  float wave = smoothstep(0.12, 0.0, abs(p.y + 0.55 + sin(p.x * u_frequency + u_time) * 0.12));
  vec3 color = mix(u_color_a, colorRamp(field), bloom);
  color = mix(color, u_color_c, wave * 0.72);
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

function OriginalMaterialCanvas({
  active,
  canvasRef,
  captureTimeMs,
  fragmentSource,
  onContextLost,
  paused,
  renderScale,
  settings,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  fragmentSource: string;
  onContextLost: () => void;
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
    if (!canvas) return;
    const context = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    if (!context) return;
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

function LiveMaterialCanvas({
  className = '',
  captureTimeMs = null,
  enabled = true,
  materialId,
  paused = false,
  renderScale = 1,
  settings,
}: LiveMaterialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedMaterialId = normalizeLiveMaterialId(materialId);
  const [renderVisible, setRenderVisible] = useState(true);
  const [contextRecovery, setContextRecovery] = useState(() => ({
    failed: false,
    materialId: resolvedMaterialId,
    version: 0,
  }));
  const activeRecovery = contextRecovery.materialId === resolvedMaterialId
    ? contextRecovery
    : { failed: false, materialId: resolvedMaterialId, version: 0 };
  const renderActive = renderVisible && enabled;
  const recoverContext = () => {
    setContextRecovery((current) => {
      const currentVersion = current.materialId === resolvedMaterialId ? current.version : 0;
      return {
        failed: currentVersion >= 2,
        materialId: resolvedMaterialId,
        version: Math.min(2, currentVersion + 1),
      };
    });
  };

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

  if (activeRecovery.failed) {
    return (
      <div
        aria-label='Static shader fallback'
        className={`absolute inset-0 size-full ${className}`}
        ref={containerRef}
        style={{ background: `linear-gradient(135deg, ${settings.colorA}, ${settings.colorB} 52%, ${settings.colorC})` }}
      />
    );
  }

  if (resolvedMaterialId === 'shadergradient-prismatic-sphere') {
    return (
      <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
        <ShaderGradientSurface
          captureTimeMs={captureTimeMs}
          className=''
          key={`shadergradient-${activeRecovery.version}`}
          paused={paused || !renderActive}
          renderScale={renderScale}
          settings={settings}
        />
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
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 size-full ${className}`} ref={containerRef}>
      <OriginalMaterialCanvas
        active={renderActive}
        canvasRef={canvasRef}
        captureTimeMs={captureTimeMs}
        fragmentSource={`${FRAGMENT_SHARED}${SHADERS_FRAGMENT_BODIES[resolvedMaterialId]}`}
        key={`${resolvedMaterialId}-${activeRecovery.version}`}
        onContextLost={recoverContext}
        paused={paused || !renderActive}
        renderScale={renderScale}
        settings={settings}
      />
    </div>
  );
}

export default memo(LiveMaterialCanvas);
