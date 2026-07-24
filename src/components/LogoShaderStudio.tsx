'use client';

import { useRef, useState, type CSSProperties, type RefObject } from 'react';
import { T, useGT } from 'gt-next';
import { Download, ExternalLink, Pause, Play } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import MaterialFinishControls from '@/components/MaterialFinishControls';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  getLiveMaterial,
  LIVE_MATERIAL_PALETTES,
  LIVE_MATERIAL_OPTIONS,
  normalizeLiveMaterialId,
  SHADER_GRADIENT_SOURCE_URL,
  SHADERS_SOURCE_URL,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  compositeFinishedLayer,
  finishColor,
  materialFinishPreset,
  normalizeMaterialFinish,
  type MaterialFinishSettings,
} from '@/lib/materialFinish';
import { SHADER_PRESETS, type ShaderPreset } from '@/lib/shaderPresets';
import type { StudioTool } from '@/lib/studioCatalog';

const VERTEX_SOURCE = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const DEFAULT_SHADER_PRESET =
  SHADER_PRESETS.find(({ id }) => id === 'liquid-metal') ?? SHADER_PRESETS[0]!;

const CUSTOM_FRAGMENT_TEMPLATE = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color_a;
uniform vec3 u_color_b;
uniform float u_scale;
uniform float u_distortion;
uniform float u_softness;
uniform float u_repetition;
uniform float u_contour;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float wave = sin((uv.x + uv.y) * 12.0 + u_time) * 0.5 + 0.5;
  gl_FragColor = vec4(mix(u_color_a, u_color_b, wave), 1.0);
}`;

type ShaderRatio = 'square' | 'wide' | 'opengraph';
type LogoTone = 'light' | 'dark';
type EffectTarget = 'background' | 'logo' | 'both';
type ShaderEngine = 'studio-glsl' | 'shadergradient' | 'shaders' | 'custom-glsl';
type ExportQuality = 'standard' | 'high' | 'ultra';
type ShaderParameters = {
  contour: number;
  distortion: number;
  repetition: number;
  scale: number;
  softness: number;
};

const DEFAULT_PARAMETERS: ShaderParameters = {
  contour: 0.58,
  distortion: 0.72,
  repetition: 8,
  scale: 1.1,
  softness: 0.62,
};

const EXPORT_QUALITY_OPTIONS: readonly { label: string; multiplier: number; value: ExportQuality }[] = [
  { label: 'Standard · 0.75×', multiplier: 0.75, value: 'standard' },
  { label: 'High · 1×', multiplier: 1, value: 'high' },
  { label: 'Ultra · 1.5×', multiplier: 1.5, value: 'ultra' },
];

function normalizeShaderEngine(value: string): ShaderEngine {
  if (value === 'studio-glsl' || value === 'shadergradient' || value === 'shaders' || value === 'custom-glsl') return value;
  return 'shaders';
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
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
    const message = context.getShaderInfoLog(shader) ?? 'Shader compilation failed';
    context.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function ShaderCanvas({
  canvasRef,
  colorA,
  colorB,
  onError,
  parameters,
  paused,
  preset,
  renderScale,
  speed,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  colorA: string;
  colorB: string;
  onError: (message: string | null) => void;
  parameters: ShaderParameters;
  paused: boolean;
  preset: ShaderPreset;
  renderScale: number;
  speed: number;
}) {
  const colorARef = useRef(colorA);
  const colorBRef = useRef(colorB);
  const pausedRef = useRef(paused);
  const parametersRef = useRef(parameters);
  const speedRef = useRef(speed);
  colorARef.current = colorA;
  colorBRef.current = colorB;
  pausedRef.current = paused;
  parametersRef.current = parameters;
  speedRef.current = speed;

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    if (!context) {
      onError('WebGL is unavailable in this browser.');
      return;
    }
    const shaderCanvas = canvas;
    const webgl = context;

    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let animationFrame = 0;
    let elapsed = 0;
    let previousTime = performance.now();

    try {
      vertexShader = compileShader(context, context.VERTEX_SHADER, VERTEX_SOURCE);
      fragmentShader = compileShader(context, context.FRAGMENT_SHADER, preset.fragmentSource);
      program = context.createProgram();
      if (!program) throw new Error('Shader program allocation failed');
      context.attachShader(program, vertexShader);
      context.attachShader(program, fragmentShader);
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) {
        throw new Error(context.getProgramInfoLog(program) ?? 'Shader program link failed');
      }
      buffer = context.createBuffer();
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
      onError(null);

      function render(time: number) {
        if (!program) return;
        const delta = Math.min(64, time - previousTime);
        previousTime = time;
        if (!pausedRef.current) elapsed += delta * speedRef.current;
        const pixelRatio = Math.min(3, (window.devicePixelRatio || 1) * renderScale);
        const width = Math.max(1, Math.round(shaderCanvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.round(shaderCanvas.clientHeight * pixelRatio));
        if (shaderCanvas.width !== width || shaderCanvas.height !== height) {
          shaderCanvas.width = width;
          shaderCanvas.height = height;
        }
        webgl.viewport(0, 0, width, height);
        webgl.uniform2f(webgl.getUniformLocation(program, 'u_resolution'), width, height);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_time'), elapsed / 1000);
        webgl.uniform3fv(
          webgl.getUniformLocation(program, 'u_color_a'),
          hexToRgb(colorARef.current)
        );
        webgl.uniform3fv(
          webgl.getUniformLocation(program, 'u_color_b'),
          hexToRgb(colorBRef.current)
        );
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_scale'), parametersRef.current.scale);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_distortion'), parametersRef.current.distortion);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_softness'), parametersRef.current.softness);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_repetition'), parametersRef.current.repetition);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_contour'), parametersRef.current.contour);
        webgl.drawArrays(webgl.TRIANGLES, 0, 6);
        animationFrame = requestAnimationFrame(render);
      }

      animationFrame = requestAnimationFrame(render);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The shader could not be rendered.');
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      if (buffer) context.deleteBuffer(buffer);
      if (program) context.deleteProgram(program);
      if (fragmentShader) context.deleteShader(fragmentShader);
      if (vertexShader) context.deleteShader(vertexShader);
    };
  });

  return <canvas aria-label='Live shader preview' className='absolute inset-0 size-full' ref={canvasRef} />;
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = path;
  });
}

function monogramMask(identity: BrandIdentity): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><text x="256" y="340" text-anchor="middle" fill="white" font-family="Switzer,Arial,sans-serif" font-size="250" font-weight="550">${identity.shortName}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LogoShaderStudio({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const gt = useGT();
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const materialCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundLayerRef = useRef<HTMLDivElement>(null);
  const materialLayerRef = useRef<HTMLDivElement>(null);
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [presetId, setPresetId] = useStudioDraft(
    identity.id,
    tool.id,
    'preset',
    DEFAULT_SHADER_PRESET.id
  );
  const [storedEngine, setEngine] = useStudioDraft<ShaderEngine>(
    identity.id,
    tool.id,
    'engine',
    'shadergradient'
  );
  const [liveMaterialId, setLiveMaterialId] = useStudioDraft<LiveMaterialId>(
    identity.id,
    tool.id,
    'live-material',
    DEFAULT_LIVE_MATERIAL_ID
  );
  const [liveSettings, setLiveSettings] = useStudioDraft<LiveMaterialSettings>(
    identity.id,
    tool.id,
    'live-settings',
    DEFAULT_LIVE_MATERIAL_SETTINGS
  );
  const [customDraft, setCustomDraft] = useStudioDraft(
    identity.id,
    tool.id,
    'custom-draft',
    CUSTOM_FRAGMENT_TEMPLATE
  );
  const [customSource, setCustomSource] = useStudioDraft(
    identity.id,
    tool.id,
    'custom-source',
    CUSTOM_FRAGMENT_TEMPLATE
  );
  const [customVersion, setCustomVersion] = useStudioDraft(
    identity.id,
    tool.id,
    'custom-version',
    0
  );
  const [colorA, setColorA] = useStudioDraft(
    identity.id,
    tool.id,
    'color-a',
    DEFAULT_LIVE_MATERIAL_SETTINGS.colorA
  );
  const [colorB, setColorB] = useStudioDraft(
    identity.id,
    tool.id,
    'color-b',
    DEFAULT_LIVE_MATERIAL_SETTINGS.colorB
  );
  const [colorC, setColorC] = useStudioDraft(
    identity.id,
    tool.id,
    'color-c',
    DEFAULT_LIVE_MATERIAL_SETTINGS.colorC
  );
  const [logoTone, setLogoTone] = useStudioDraft<LogoTone>(identity.id, tool.id, 'logo-tone', 'light');
  const [logoColor, setLogoColor] = useStudioDraft(identity.id, tool.id, 'logo-color', '#FFFFFF');
  const [logoInvert, setLogoInvert] = useStudioDraft(identity.id, tool.id, 'logo-invert', false);
  const [logoScale, setLogoScale] = useStudioDraft(identity.id, tool.id, 'logo-scale', 40);
  const [logoOpacity, setLogoOpacity] = useStudioDraft(identity.id, tool.id, 'logo-opacity', 100);
  const [logoX, setLogoX] = useStudioDraft(identity.id, tool.id, 'logo-x', 0);
  const [logoY, setLogoY] = useStudioDraft(identity.id, tool.id, 'logo-y', 0);
  const [target, setTarget] = useStudioDraft<EffectTarget>(identity.id, tool.id, 'target', 'background');
  const [transparent, setTransparent] = useStudioDraft(identity.id, tool.id, 'transparent', false);
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'ratio', 'wide');
  const [exportQuality, setExportQuality] = useStudioDraft<ExportQuality>(identity.id, tool.id, 'export-quality', 'high');
  const [speed, setSpeed] = useStudioDraft(
    identity.id,
    tool.id,
    'speed',
    DEFAULT_LIVE_MATERIAL_SETTINGS.speed
  );
  const [parameters, setParameters] = useStudioDraft<ShaderParameters>(
    identity.id,
    tool.id,
    'parameters',
    DEFAULT_PARAMETERS
  );
  const [storedFinish, setStoredFinish] = useStudioDraft<MaterialFinishSettings>(
    identity.id,
    tool.id,
    'material-finish',
    materialFinishPreset('soft-depth')
  );
  const finish = normalizeMaterialFinish(storedFinish);
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'gif' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logoSelected, setLogoSelected] = useState(false);
  const engine = normalizeShaderEngine(storedEngine);
  const resolvedLiveMaterialId = normalizeLiveMaterialId(liveMaterialId);
  const isLiveMaterial = engine === 'shadergradient' || engine === 'shaders';
  const preset: ShaderPreset =
    engine === 'custom-glsl'
      ? {
          description: 'A local GLSL fragment using Studio’s resolution, time, and two-color uniforms.',
          fragmentSource: customSource,
          id: 'custom',
          name: 'Custom GLSL',
        }
      : SHADER_PRESETS.find(({ id }) => id === presetId) ?? DEFAULT_SHADER_PRESET;
  const liveMaterial = getLiveMaterial(resolvedLiveMaterialId);
  const activeMaterial = isLiveMaterial
    ? liveMaterial
    : {
        description: preset.description,
        engine: 'WebGL / GLSL',
        id: preset.id,
        name: preset.name,
      };
  const resolvedLiveSettings: LiveMaterialSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...liveSettings,
    colorA,
    colorB,
    colorC,
    speed,
  };
  const identityLogoPath = brandAssetPath(identity, logoTone === 'light' ? 'mark-light' : 'mark-dark');
  const logoPath = customLogo?.url ?? identityLogoPath ?? monogramMask(identity);
  const aspectRatio = ratio === 'square' ? '1 / 1' : ratio === 'opengraph' ? '1200 / 630' : '16 / 10';
  const previewDimensions = outputDimensions('high');
  const previewLogoSize = Math.min(previewDimensions.width, previewDimensions.height) * 0.4;
  const exportRenderScale = EXPORT_QUALITY_OPTIONS.find(({ value }) => value === exportQuality)?.multiplier ?? 1;
  const outlineFilter = finish.borderEnabled && finish.borderWidth > 0
    ? [
        [finish.borderWidth, 0],
        [-finish.borderWidth, 0],
        [0, finish.borderWidth],
        [0, -finish.borderWidth],
        [finish.borderWidth * 0.72, finish.borderWidth * 0.72],
        [-finish.borderWidth * 0.72, finish.borderWidth * 0.72],
        [finish.borderWidth * 0.72, -finish.borderWidth * 0.72],
        [-finish.borderWidth * 0.72, -finish.borderWidth * 0.72],
      ].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${finishColor(finish.borderColor, finish.borderOpacity / 100)})`).join(' ')
    : '';
  const shadowFilter = finish.shadowEnabled && !finish.glassEnabled
    ? `drop-shadow(${finish.shadowOffsetX}px ${finish.shadowOffsetY}px ${finish.shadowBlur}px ${finishColor(finish.shadowColor, finish.shadowOpacity / 100)})`
    : '';
  const logoFinishStyle: CSSProperties = {
    filter: [logoInvert ? 'invert(1)' : '', outlineFilter, shadowFilter].filter(Boolean).join(' ') || undefined,
    WebkitBoxReflect: finish.reflectionEnabled
      ? `below ${finish.reflectionGap}px linear-gradient(to bottom, ${finishColor('#000000', finish.reflectionOpacity / 100)}, transparent ${finish.reflectionLength}%)`
      : undefined,
  };
  const glassPreviewStyle: CSSProperties = {
    backdropFilter: `blur(${finish.glassBlur}px)`,
    background: `linear-gradient(135deg, ${finishColor('#FFFFFF', finish.glassHighlight / 100)}, ${finishColor(finish.glassTint, finish.glassOpacity / 100)} 44%, ${finishColor(finish.glassTint, finish.glassOpacity / 250)})`,
    border: finish.borderEnabled
      ? `${finish.borderWidth}px solid ${finishColor(finish.borderColor, finish.borderOpacity / 100)}`
      : undefined,
    borderRadius: finish.glassRadius,
    boxShadow: finish.shadowEnabled
      ? `${finish.shadowOffsetX}px ${finish.shadowOffsetY}px ${finish.shadowBlur}px ${finishColor(finish.shadowColor, finish.shadowOpacity / 100)}`
      : undefined,
    inset: -finish.glassPadding,
    transform: `scale(${1 + finish.glassRefraction / 300})`,
    WebkitBackdropFilter: `blur(${finish.glassBlur}px)`,
  };

  customLogoRef.current = customLogo;
  useMountEffect(
    () => () => {
      if (customLogoRef.current) URL.revokeObjectURL(customLogoRef.current.url);
    }
  );

  function selectLogo(file: File) {
    if (customLogoRef.current) URL.revokeObjectURL(customLogoRef.current.url);
    const nextLogo = { name: file.name, url: URL.createObjectURL(file) };
    customLogoRef.current = nextLogo;
    setCustomLogo(nextLogo);
  }

  function selectEngine(nextEngine: ShaderEngine) {
    setEngine(nextEngine);
    setError(null);
    if (nextEngine === 'shadergradient') {
      setLiveMaterialId('shadergradient-prismatic-sphere');
      setLiveSettings(DEFAULT_LIVE_MATERIAL_SETTINGS);
      setColorA(DEFAULT_LIVE_MATERIAL_SETTINGS.colorA);
      setColorB(DEFAULT_LIVE_MATERIAL_SETTINGS.colorB);
      setColorC(DEFAULT_LIVE_MATERIAL_SETTINGS.colorC);
      setSpeed(DEFAULT_LIVE_MATERIAL_SETTINGS.speed);
    }
    if (nextEngine === 'shaders' && !resolvedLiveMaterialId.startsWith('shaders-')) {
      setLiveMaterialId('shaders-fluid-chrome');
    }
  }

  function updateLiveSettings(patch: Partial<LiveMaterialSettings>) {
    setLiveSettings((current) => ({ ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...current, ...patch }));
  }

  function outputDimensions(quality: ExportQuality = exportQuality) {
    const base = ratio === 'square'
      ? { height: 1200, width: 1200 }
      : ratio === 'opengraph'
        ? { height: 630, width: 1200 }
        : { height: 1000, width: 1600 };
    const multiplier = EXPORT_QUALITY_OPTIONS.find(({ value }) => value === quality)?.multiplier ?? 1;
    return { height: Math.round(base.height * multiplier), width: Math.round(base.width * multiplier) };
  }

  async function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    logo: HTMLImageElement
  ) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, width, height);
    const backgroundCanvas =
      backgroundLayerRef.current?.querySelector('canvas') ?? backgroundCanvasRef.current;
    const materialCanvas =
      materialLayerRef.current?.querySelector('canvas') ?? materialCanvasRef.current;
    if ((target === 'background' || target === 'both') && backgroundCanvas) {
      context.drawImage(backgroundCanvas, 0, 0, width, height);
    } else if (!transparent) {
      context.fillStyle = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
      context.fillRect(0, 0, width, height);
    }

    const markSize = Math.round(Math.min(width, height) * (logoScale / 100));
    const markX = Math.round((width - markSize) / 2 + (logoX / 100) * width);
    const markY = Math.round((height - markSize) / 2 + (logoY / 100) * height);
    const markLayer = document.createElement('canvas');
    markLayer.width = width;
    markLayer.height = height;
    const markContext = markLayer.getContext('2d');
    if (!markContext) return;
    markContext.imageSmoothingEnabled = true;
    markContext.imageSmoothingQuality = 'high';
    markContext.globalAlpha = logoOpacity / 100;
    markContext.filter = logoInvert ? 'invert(1)' : 'none';
    if ((target === 'logo' || target === 'both') && materialCanvas) {
      const cutout = document.createElement('canvas');
      cutout.width = markSize;
      cutout.height = markSize;
      const cutoutContext = cutout.getContext('2d');
      if (!cutoutContext) {
        return;
      }
      cutoutContext.imageSmoothingEnabled = true;
      cutoutContext.imageSmoothingQuality = 'high';
      cutoutContext.drawImage(materialCanvas, 0, 0, markSize, markSize);
      cutoutContext.globalCompositeOperation = 'destination-in';
      cutoutContext.drawImage(logo, 0, 0, markSize, markSize);
      markContext.drawImage(cutout, markX, markY);
    } else {
      const solidMark = document.createElement('canvas');
      solidMark.width = markSize;
      solidMark.height = markSize;
      const solidContext = solidMark.getContext('2d');
      if (!solidContext) return;
      solidContext.drawImage(logo, 0, 0, markSize, markSize);
      solidContext.globalCompositeOperation = 'source-in';
      solidContext.fillStyle = logoColor;
      solidContext.fillRect(0, 0, markSize, markSize);
      markContext.drawImage(solidMark, markX, markY);
    }
    compositeFinishedLayer(
      context,
      markLayer,
      { height: markSize, width: markSize, x: markX, y: markY },
      finish,
      logoOpacity / 100
    );
  }

  async function capturePng() {
    setExporting('png');
    try {
      const { height, width } = outputDimensions();
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      if (!context) return;
      const logo = await loadImage(logoPath);
      await composeFrame(context, width, height, logo);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
      if (!blob) return;
      downloadBlob(blob, `${identity.id}-${activeMaterial.id}-${target}.png`);
    } finally {
      setExporting(null);
    }
  }

  async function captureGif() {
    setExporting('gif');
    setExportProgress(0);
    try {
      const fps = 20;
      const frameCount = 30;
      const { height, width } = outputDimensions();
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      const logo = await loadImage(logoPath);
      const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
      const gif = GIFEncoder();
      const useTransparency = target === 'logo' && transparent;
      const format = useTransparency ? 'rgba4444' : 'rgb565';
      for (let index = 0; index < frameCount; index += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000 / fps));
        await composeFrame(context, width, height, logo);
        const frame = context.getImageData(0, 0, width, height).data;
        const palette = quantize(frame, 256, {
          format,
          oneBitAlpha: useTransparency,
        });
        const indexed = applyPalette(frame, palette, format);
        const transparentIndex = palette.findIndex((color) => (color[3] ?? 255) === 0);
        gif.writeFrame(indexed, width, height, {
          delay: Math.round(1000 / fps),
          dispose: 2,
          palette,
          transparent: transparentIndex >= 0,
          ...(index === 0 ? { repeat: 0 } : {}),
          ...(transparentIndex >= 0 ? { transparentIndex } : {}),
        });
        setExportProgress((index + 1) / frameCount);
        if (index % 2 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
      gif.finish();
      downloadBlob(
        new Blob([Uint8Array.from(gif.bytes())], { type: 'image/gif' }),
        `${identity.id}-${activeMaterial.id}-${target}.gif`
      );
    } finally {
      setExporting(null);
      setExportProgress(0);
    }
  }

  function renderMaterial(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    placement: 'background' | 'logo'
  ) {
    if (isLiveMaterial) {
      return (
        <LiveMaterialCanvas
          className='absolute inset-0 size-full'
          key={`${placement}-${engine}-${resolvedLiveMaterialId}-${exportQuality}`}
          materialId={resolvedLiveMaterialId}
          paused={paused}
          renderScale={exportRenderScale}
          settings={
            placement === 'logo'
              ? { ...resolvedLiveSettings, colorA: colorB, colorB: colorA }
              : resolvedLiveSettings
          }
        />
      );
    }

    return (
      <ShaderCanvas
        canvasRef={canvasRef}
        colorA={placement === 'logo' ? colorB : colorA}
        colorB={placement === 'logo' ? colorA : colorB}
        key={`${placement}-${engine}-${preset.id}-${customVersion}-${exportQuality}`}
        onError={setError}
        parameters={parameters}
        paused={paused}
        preset={preset}
        renderScale={exportRenderScale}
        speed={speed}
      />
    );
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='app-navbar tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            aria-label={paused ? gt('Play shader') : gt('Pause shader')}
            onClick={() => setPaused((current) => !current)}
            size='icon'
            type='button'
            variant='outline'
          >
            {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
          </Button>
          <Button loading={exporting === 'png'} onClick={capturePng} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <T>PNG</T>
          </Button>
          <Button loading={exporting === 'gif'} onClick={captureGif} type='button'>
            <Download aria-hidden='true' />
            {exporting === 'gif' ? `${Math.round(exportProgress * 100)}%` : <T>GIF</T>}
          </Button>
        </div>
      </header>

      <div className='tool-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Apply shader to</T></h2>
            <div className='grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border'>
              {([
                ['background', 'Behind'],
                ['logo', 'Logo'],
                ['both', 'Both'],
              ] as const).map(([value, label]) => (
                <Button className='rounded-none border-0 px-2' key={value} onClick={() => setTarget(value)} size='sm' type='button' variant={target === value ? 'default' : 'secondary'}>
                  {label}
                </Button>
              ))}
            </div>
            <p className='text-xs leading-5 text-muted-foreground'>
              {target === 'logo'
                ? gt('The shader is cut to the logo alpha, producing a material-filled mark.')
                : target === 'both'
                  ? gt('The live field fills the surface and the cutout logo.')
                  : gt('The shader stays behind a solid identity mark.')}
            </p>
          </section>
          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Material engine</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>{activeMaterial.description}</p>
            </div>
            <StudioSelect
              ariaLabel={gt('Material engine')}
              onValueChange={(value) => selectEngine(value as ShaderEngine)}
              options={[
                { label: 'ShaderGradient / Three.js', value: 'shadergradient' },
                { label: 'Shaders.com studies / local WebGL', value: 'shaders' },
                { label: 'Studio GLSL', value: 'studio-glsl' },
                { label: gt('Custom GLSL'), value: 'custom-glsl' },
              ]}
              value={engine}
            />
            {engine === 'studio-glsl' ? (
              <StudioSelect
                ariaLabel={gt('Studio shader')}
                onValueChange={setPresetId}
                options={SHADER_PRESETS.map((shader) => ({ label: shader.name, value: shader.id }))}
                value={preset.id}
              />
            ) : null}
            {engine === 'shaders' ? (
              <StudioSelect
                ariaLabel={gt('Shaders.com study')}
                onValueChange={(value) => setLiveMaterialId(value as LiveMaterialId)}
                options={LIVE_MATERIAL_OPTIONS.filter(({ engine: materialEngine }) => materialEngine === 'Shaders.com study').map((material) => ({
                  label: material.name,
                  value: material.id,
                }))}
                value={resolvedLiveMaterialId}
              />
            ) : null}
            {engine === 'shadergradient' ? (
              <a
                className='flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted'
                href={SHADER_GRADIENT_SOURCE_URL}
                rel='noreferrer'
                target='_blank'
              >
                <span><T>Open supplied ShaderGradient preset</T></span>
                <ExternalLink className='size-3.5' aria-hidden='true' />
              </a>
            ) : null}
            {engine === 'shaders' ? (
              <a className='flex items-center justify-between border border-border px-3 py-2 text-xs font-medium hover:bg-muted' href={SHADERS_SOURCE_URL} rel='noreferrer' target='_blank'>
                <span><T>Explore Shaders.com</T></span>
                <ExternalLink className='size-3.5' aria-hidden='true' />
              </a>
            ) : null}
            {engine === 'custom-glsl' ? (
              <div className='flex flex-col gap-2'>
                <textarea
                  aria-label={gt('Custom fragment shader')}
                  className='min-h-64 w-full resize-y rounded-md border border-input bg-foreground p-3 font-mono text-xs leading-5 text-background outline-none focus:border-emphasis'
                  onChange={(event) => setCustomDraft(event.target.value)}
                  spellCheck={false}
                  value={customDraft}
                />
                <Button
                  onClick={() => {
                    setCustomSource(customDraft);
                    setCustomVersion((current) => current + 1);
                  }}
                  size='sm'
                  type='button'
                  variant='outline'
                >
                  <T>Compile shader</T>
                </Button>
              </div>
            ) : null}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Material colors</T></h2>
            <div className='grid grid-cols-2 gap-2'>
              {LIVE_MATERIAL_PALETTES.map((palette) => (
                <button
                  className='flex min-w-0 flex-col gap-2 border border-border p-2 text-left hover:border-foreground hover:bg-muted'
                  key={palette.id}
                  onClick={() => {
                    const [nextA, nextB, nextC] = palette.colors;
                    setColorA(nextA);
                    setColorB(nextB);
                    setColorC(nextC);
                    updateLiveSettings({ colorA: nextA, colorB: nextB, colorC: nextC });
                  }}
                  title={palette.description}
                  type='button'
                >
                  <span className='grid h-5 w-full grid-cols-3 overflow-hidden border border-border'>{palette.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}</span>
                  <span className='truncate text-[10px] font-medium'>{palette.name}</span>
                </button>
              ))}
            </div>
            <ColorControl ariaLabel={gt('Material color one')} label={<T>Color 1</T>} onChange={setColorA} value={colorA} />
            <ColorControl ariaLabel={gt('Material color two')} label={<T>Color 2</T>} onChange={setColorB} value={colorB} />
            {isLiveMaterial ? <ColorControl ariaLabel={gt('Material color three')} label={<T>Color 3</T>} onChange={setColorC} value={colorC} /> : null}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Material</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Controls are shared across previews and downloaded frames.</T></p>
            </div>
            {isLiveMaterial
              ? ([
                  ['Strength', 'strength', 0, 2, 0.01],
                  ['Detail', 'detail', 0.5, 8, 0.1],
                  ['Frequency', 'frequency', 0.2, 10, 0.1],
                  ['Amplitude', 'amplitude', 0, 8, 0.1],
                  ['Density', 'density', 0.1, 2, 0.05],
                  ['Brightness', 'brightness', 0.1, 2, 0.05],
                  ['Grain', 'grain', 0, 100, 1],
                  ['Rotation X', 'rotationX', 0, 360, 1],
                  ['Rotation Y', 'rotationY', 0, 360, 1],
                  ['Rotation Z', 'rotationZ', 0, 360, 1],
                ] as const).map(([label, key, min, max, step]) => (
                  <label className='flex flex-col gap-2 text-sm text-muted-foreground' key={key}>
                    <span className='flex justify-between gap-3'><span>{label}</span><span className='font-mono text-xs'>{resolvedLiveSettings[key].toFixed(step < 1 ? 2 : 0)}{key === 'grain' ? '%' : ''}</span></span>
                    <input className='studio-range' max={max} min={min} onChange={(event) => updateLiveSettings({ [key]: Number(event.target.value) })} step={step} type='range' value={resolvedLiveSettings[key]} />
                  </label>
                ))
              : ([
                  ['Scale', 'scale', 0.5, 2.4, 0.05],
                  ['Distortion', 'distortion', 0, 1, 0.01],
                  ['Softness', 'softness', 0, 1, 0.01],
                  ['Repetition', 'repetition', 2, 16, 0.5],
                  ['Contour', 'contour', 0, 1, 0.01],
                ] as const).map(([label, key, min, max, step]) => (
                  <label className='flex flex-col gap-2 text-sm text-muted-foreground' key={key}>
                    <span className='flex justify-between gap-3'><span>{label}</span><span className='font-mono text-xs'>{parameters[key].toFixed(key === 'repetition' ? 1 : 2)}</span></span>
                    <input className='studio-range' max={max} min={min} onChange={(event) => setParameters((current) => ({ ...current, [key]: Number(event.target.value) }))} step={step} type='range' value={parameters[key]} />
                  </label>
                ))}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Surface finish</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Layer glass, reflection, edge, and depth over the live material.</T></p>
            </div>
            <MaterialFinishControls onChange={setStoredFinish} settings={finish} />
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Logo</T></h2>
            <div className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'>
              {(['light', 'dark'] as const).map((tone) => (
                <Button className='rounded-none border-0' key={tone} onClick={() => { setLogoTone(tone); setLogoColor(tone === 'light' ? '#FFFFFF' : '#000000'); }} size='sm' type='button' variant={logoTone === tone ? 'default' : 'secondary'}>
                  {tone === 'light' ? <T>White</T> : <T>Black</T>}
                </Button>
              ))}
            </div>
            <ColorControl ariaLabel={gt('Custom logo color')} label={<T>Custom logo color</T>} onChange={setLogoColor} value={logoColor} />
            <label className='flex items-center justify-between gap-4 text-sm'>
              <span><T>Invert logo color</T></span>
              <input checked={logoInvert} onChange={(event) => setLogoInvert(event.target.checked)} type='checkbox' />
            </label>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <span className='flex justify-between gap-3'><T>Logo size</T><span className='font-mono'>{logoScale}%</span></span>
              <input className='studio-range' max='64' min='16' onChange={(event) => setLogoScale(Number(event.target.value))} type='range' value={logoScale} />
            </label>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <span className='flex justify-between gap-3'><T>Opacity</T><span className='font-mono'>{logoOpacity}%</span></span>
              <input className='studio-range' max='100' min='0' onChange={(event) => setLogoOpacity(Number(event.target.value))} type='range' value={logoOpacity} />
            </label>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <span className='flex justify-between gap-3'><T>Horizontal</T><span className='font-mono'>{logoX}%</span></span>
              <input className='studio-range' max='50' min='-50' onChange={(event) => setLogoX(Number(event.target.value))} type='range' value={logoX} />
            </label>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <span className='flex justify-between gap-3'><T>Vertical</T><span className='font-mono'>{logoY}%</span></span>
              <input className='studio-range' max='50' min='-50' onChange={(event) => setLogoY(Number(event.target.value))} type='range' value={logoY} />
            </label>
            <label className='flex min-h-18 cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-input p-3 text-sm'>
              <span className='min-w-0'>
                <span className='block font-medium text-foreground'><T>Upload transparent logo</T></span>
                <span className='block truncate text-xs text-muted-foreground'>{customLogo?.name ?? 'PNG or SVG'}</span>
              </span>
              <input
                accept='image/png,image/svg+xml'
                className='sr-only'
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectLogo(file);
                  event.target.value = '';
                }}
                type='file'
              />
            </label>
          </section>

          <section className='flex flex-col gap-4 p-5'>
            <h2 className='text-sm font-semibold'><T>Output</T></h2>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Aspect ratio</T>
              <StudioSelect ariaLabel={gt('Aspect ratio')} onValueChange={(value) => setRatio(value as ShaderRatio)} options={[
                { label: '16:10', value: 'wide' },
                { label: 'OpenGraph', value: 'opengraph' },
                { label: gt('Square'), value: 'square' },
              ]} value={ratio} />
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Export quality</T>
              <StudioSelect ariaLabel={gt('Export quality')} onValueChange={(value) => setExportQuality(value as ExportQuality)} options={EXPORT_QUALITY_OPTIONS.map((option) => ({ label: option.label, value: option.value }))} value={exportQuality} />
              <p className='font-mono text-[10px]'>{outputDimensions().width} × {outputDimensions().height} · PNG lossless · GIF 256 colors</p>
            </div>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <span className='flex justify-between gap-3'><T>Speed</T><span className='font-mono'>{speed.toFixed(2)}×</span></span>
              <input className='studio-range' max='2' min='0.2' onChange={(event) => setSpeed(Number(event.target.value))} step='0.05' type='range' value={speed} />
            </label>
            {target === 'logo' ? (
              <label className='flex items-center justify-between gap-4 text-sm'>
                <T>Transparent export</T>
                <input checked={transparent} onChange={(event) => setTransparent(event.target.checked)} type='checkbox' />
              </label>
            ) : null}
          </section>
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto'>
          <CanvasViewport identityId={identity.id} stageClassName='grid min-h-full place-items-center p-5 sm:p-8' toolId={tool.id}>
          <div className='w-full max-w-5xl'>
            <div
              className={`artifact-frame relative w-full overflow-hidden ${target === 'logo' && transparent ? 'studio-stage' : 'bg-black'}`}
              onPointerDown={() => setLogoSelected(false)}
              style={{ aspectRatio }}
            >
              {target === 'background' || target === 'both' ? (
                <div className='absolute inset-0 size-full' ref={backgroundLayerRef}>
                  {renderMaterial(backgroundCanvasRef, 'background')}
                </div>
              ) : null}
              <EditableCanvasLayer
                baseHeight={previewLogoSize}
                baseWidth={previewLogoSize}
                baseX={(previewDimensions.width - previewLogoSize) / 2}
                baseY={(previewDimensions.height - previewLogoSize) / 2}
                canvasHeight={previewDimensions.height}
                canvasWidth={previewDimensions.width}
                label={gt('Logo')}
                onChange={(transform) => {
                  setLogoX((transform.x / previewDimensions.width) * 100);
                  setLogoY((transform.y / previewDimensions.height) * 100);
                  setLogoScale(transform.scale * 40);
                }}
                onSelect={() => setLogoSelected(true)}
                selected={logoSelected}
                transform={{ scale: logoScale / 40, x: (logoX / 100) * previewDimensions.width, y: (logoY / 100) * previewDimensions.height }}
                zIndex={12}
              >
                <div className='relative grid size-full place-items-center' style={{ opacity: logoOpacity / 100 }}>
                  {finish.glassEnabled ? <div aria-hidden='true' className='absolute' style={glassPreviewStyle} /> : null}
                  <div className='relative size-full' style={logoFinishStyle}>
                    {target === 'logo' || target === 'both' ? (
                      <div
                        className='relative size-full overflow-hidden'
                        ref={materialLayerRef}
                        style={{
                          WebkitMaskImage: `url('${logoPath}')`,
                          WebkitMaskPosition: 'center',
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskSize: 'contain',
                          maskImage: `url('${logoPath}')`,
                          maskPosition: 'center',
                          maskRepeat: 'no-repeat',
                          maskSize: 'contain',
                        }}
                      >
                        {renderMaterial(materialCanvasRef, 'logo')}
                      </div>
                    ) : (
                      <div
                        aria-label={`${identity.name} logo`}
                        className='size-full'
                        style={{
                          backgroundColor: logoColor,
                          WebkitMaskImage: `url('${logoPath}')`,
                          WebkitMaskPosition: 'center',
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskSize: 'contain',
                          maskImage: `url('${logoPath}')`,
                          maskPosition: 'center',
                          maskRepeat: 'no-repeat',
                          maskSize: 'contain',
                        }}
                      />
                    )}
                  </div>
                </div>
              </EditableCanvasLayer>
              <div className='pointer-events-none absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest text-white/60 mix-blend-difference'>
                {activeMaterial.name} / {activeMaterial.engine}
              </div>
            </div>
            <div className='flex flex-wrap items-start justify-between gap-4 border-x border-b border-border bg-background p-4'>
              <div>
                <p className='text-sm font-semibold'>{activeMaterial.name}</p>
                <p className='mt-1 max-w-xl text-xs leading-5 text-muted-foreground'>{activeMaterial.description}</p>
              </div>
              <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                {identity.name} / {ratio} / {speed.toFixed(2)}× / {finish.presetId}
              </p>
            </div>
            {error ? <p className='border-x border-b border-status-error-border bg-status-error-background p-3 text-sm text-status-error' role='alert'>{error}</p> : null}
          </div>
          </CanvasViewport>
        </div>
      </div>
    </div>
  );
}
