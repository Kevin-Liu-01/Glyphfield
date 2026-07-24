'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { useRef, useState } from 'react';

import type { RefObject } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import { normalizeLiveMaterialId, type LiveMaterialId, type LiveMaterialSettings } from '@/lib/liveMaterials';
import { cancelWebGLContextRelease, scheduleWebGLContextRelease } from '@/lib/webglContext';

export type LiveMaterialCanvasProps = {
  className?: string;
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

const SHADERS_FRAGMENT_BODIES: Record<Exclude<LiveMaterialId, 'shadergradient-prismatic-sphere'>, string> = {
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
void main() {
  vec2 p = studioUv();
  float field = fbm(p * max(0.8, u_detail) + vec2(u_time * 0.18, u_time * 0.09));
  float fold = abs(sin((p.x - p.y * 0.6 + field * (2.0 + u_strength * 3.0)) * u_frequency));
  float ridge = smoothstep(0.18, 0.95, fold);
  float glint = pow(ridge, 5.0 - min(3.0, u_strength));
  vec3 tinted = colorRamp(clamp(field * 0.7 + fold * 0.45, 0.0, 1.0));
  vec3 chrome = mix(vec3(0.025), vec3(1.0), glint);
  vec3 color = mix(tinted, chrome, 0.38 + u_strength * 0.24);
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
  className,
  onContextLost,
  paused,
  renderScale,
  settings,
}: {
  className: string;
  onContextLost: () => void;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useMountEffect(() => {
    const surface = rootRef.current;
    if (!surface) return;
    const mountedSurface: HTMLDivElement = surface;
    const canvases = new Set<HTMLCanvasElement>();

    function handleContextLost(event: Event) {
      event.preventDefault();
      window.setTimeout(onContextLost, 120);
    }

    function bindCanvases() {
      mountedSurface.querySelectorAll('canvas').forEach((canvas) => {
        if (canvases.has(canvas)) return;
        canvases.add(canvas);
        cancelWebGLContextRelease(canvas);
        canvas.addEventListener('webglcontextlost', handleContextLost);
      });
    }

    bindCanvases();
    const observer = new MutationObserver(bindCanvases);
    observer.observe(mountedSurface, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      canvases.forEach((canvas) => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        if (context) scheduleWebGLContextRelease(canvas, context);
      });
    };
  });

  return (
    <div className={`absolute inset-0 size-full ${className}`} ref={rootRef}>
      <ShaderGradientCanvas
        className='absolute inset-0 size-full'
        fov={45}
        pixelDensity={Math.min(2, renderScale)}
        pointerEvents='none'
        preserveDrawingBuffer
        style={{ height: '100%', inset: 0, position: 'absolute', width: '100%' }}
      >
        <ShaderGradient
          animate={paused ? 'off' : 'on'}
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
          uSpeed={paused ? 0 : settings.speed}
          uStrength={settings.strength}
          uTime={0}
          wireframe={false}
          zoomOut
        />
      </ShaderGradientCanvas>
    </div>
  );
}

function OriginalMaterialCanvas({
  canvasRef,
  fragmentSource,
  onContextLost,
  paused,
  renderScale,
  settings,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  fragmentSource: string;
  onContextLost: () => void;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const pausedRef = useRef(paused);
  const settingsRef = useRef(settings);
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
    let elapsed = 0;
    let previous = performance.now();
    let disposed = false;

    function handleContextLost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      if (!disposed) window.setTimeout(onContextLost, 0);
    }

    drawingCanvas.addEventListener('webglcontextlost', handleContextLost);

    function draw(time: number) {
      const current = settingsRef.current;
      const delta = Math.min(64, time - previous);
      previous = time;
      if (!pausedRef.current) elapsed += delta * current.speed;
      const pixelRatio = Math.min(3, (window.devicePixelRatio || 1) * renderScale);
      const width = Math.max(1, Math.round(drawingCanvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(drawingCanvas.clientHeight * pixelRatio));
      if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
      }
      drawingContext.viewport(0, 0, width, height);
      drawingContext.uniform2f(resolutionLocation, width, height);
      drawingContext.uniform1f(timeLocation, elapsed / 1000);
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
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
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

export default function LiveMaterialCanvas({
  className = '',
  materialId,
  paused = false,
  renderScale = 1,
  settings,
}: LiveMaterialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedMaterialId = normalizeLiveMaterialId(materialId);
  const [contextRecovery, setContextRecovery] = useState(() => ({
    failed: false,
    materialId: resolvedMaterialId,
    version: 0,
  }));
  const activeRecovery = contextRecovery.materialId === resolvedMaterialId
    ? contextRecovery
    : { failed: false, materialId: resolvedMaterialId, version: 0 };
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

  if (activeRecovery.failed) {
    return (
      <div
        aria-label='Static shader fallback'
        className={`absolute inset-0 size-full ${className}`}
        style={{ background: `linear-gradient(135deg, ${settings.colorA}, ${settings.colorB} 52%, ${settings.colorC})` }}
      />
    );
  }

  if (resolvedMaterialId === 'shadergradient-prismatic-sphere') {
    return (
      <ShaderGradientSurface
        className={className}
        key={`shadergradient-${activeRecovery.version}`}
        onContextLost={recoverContext}
        paused={paused}
        renderScale={renderScale}
        settings={settings}
      />
    );
  }

  return (
    <div className={`absolute inset-0 size-full ${className}`}>
      <OriginalMaterialCanvas
        canvasRef={canvasRef}
        fragmentSource={`${FRAGMENT_SHARED}${SHADERS_FRAGMENT_BODIES[resolvedMaterialId]}`}
        key={`${resolvedMaterialId}-${activeRecovery.version}`}
        onContextLost={recoverContext}
        paused={paused}
        renderScale={renderScale}
        settings={settings}
      />
    </div>
  );
}
