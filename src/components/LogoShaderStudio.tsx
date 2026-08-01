'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { T, useGT } from 'gt-next';
import { Download, Pause, Play, X } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { LiveMaterialSourceBadge } from '@/components/LiveMaterialSourceLabel';
import MaterialFinishControls from '@/components/MaterialFinishControls';
import MaterialPalettePresets from '@/components/MaterialPalettePresets';
import ResizableSidebar from '@/components/ResizableSidebar';
import ShaderLibrarySidebar, { ShaderLibraryButton } from '@/components/ShaderLibrarySidebar';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cancelWebGLContextRelease, scheduleWebGLContextRelease } from '@/lib/webglContext';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  getLiveMaterial,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  compositeFinishedLayer,
  finishColor,
  materialFinishPreset,
  materialFinishOutlineOffsets,
  normalizeMaterialFinish,
  type MaterialFinishSettings,
} from '@/lib/materialFinish';
import { SHADER_PRESETS, type ShaderPreset } from '@/lib/shaderPresets';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';
import type { StudioTool } from '@/lib/studioCatalog';

const VERTEX_SOURCE = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const DEFAULT_SHADER_PRESET =
  SHADER_PRESETS.find(({ id }) => id === 'polished-chrome') ?? SHADER_PRESETS[0]!;

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
type ShaderLayer = 'background' | 'logo';
type ShaderEngine = 'studio-glsl' | 'shadergradient' | 'glyphfield' | 'shaders' | 'fluid' | 'paper' | 'custom-glsl';
type ExportQuality = 'standard' | 'high' | 'ultra';
type PreviewFinishStyle = CSSProperties & { WebkitBoxReflect?: string };
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
const GIF_FRAME_DELAY_MS = 80;
const GIF_FRAME_COUNT = 25;

function normalizeShaderEngine(value: string): ShaderEngine {
  if (value === 'studio-glsl' || value === 'shadergradient' || value === 'glyphfield' || value === 'shaders' || value === 'fluid' || value === 'paper' || value === 'custom-glsl') return value;
  return 'shaders';
}

function engineForLiveMaterial(materialId: LiveMaterialId): ShaderEngine {
  if (materialId === 'shadergradient-prismatic-sphere') return 'shadergradient';
  if (materialId === 'pavel-fluid-energy') return 'fluid';
  if (isPaperLiveMaterialId(materialId)) return 'paper';
  if (materialId.startsWith('glyphfield-')) return 'glyphfield';
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
    const message = context.getShaderInfoLog(shader)?.trim()
      || (context.isContextLost()
        ? 'WebGL context lost during shader compilation'
        : 'Shader compilation failed');
    context.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function ShaderCanvas({
  canvasRef,
  captureTimeMs,
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
  captureTimeMs: number | null;
  colorA: string;
  colorB: string;
  onError: (message: string | null) => void;
  parameters: ShaderParameters;
  paused: boolean;
  preset: ShaderPreset;
  renderScale: number;
  speed: number;
}) {
  const captureTimeRef = useRef(captureTimeMs);
  const colorARef = useRef(colorA);
  const colorBRef = useRef(colorB);
  const pausedRef = useRef(paused);
  const parametersRef = useRef(parameters);
  const speedRef = useRef(speed);
  captureTimeRef.current = captureTimeMs;
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
    cancelWebGLContextRelease(canvas);
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
        const controlledTime = captureTimeRef.current;
        const delta = Math.min(64, time - previousTime);
        previousTime = time;
        if (controlledTime === null && !pausedRef.current) elapsed += delta * speedRef.current;
        const renderedTime = controlledTime === null ? elapsed : controlledTime * speedRef.current;
        const pixelRatio = Math.min(3, (window.devicePixelRatio || 1) * renderScale);
        const width = Math.max(1, Math.round(shaderCanvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.round(shaderCanvas.clientHeight * pixelRatio));
        if (shaderCanvas.width !== width || shaderCanvas.height !== height) {
          shaderCanvas.width = width;
          shaderCanvas.height = height;
        }
        webgl.viewport(0, 0, width, height);
        webgl.uniform2f(webgl.getUniformLocation(program, 'u_resolution'), width, height);
        webgl.uniform1f(webgl.getUniformLocation(program, 'u_time'), renderedTime / 1000);
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
      scheduleWebGLContextRelease(canvas, context);
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
  navigation,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  tool: StudioTool;
}) {
  const gt = useGT();
  const defaultPalette = brandMaterialPalette(identity);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
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
    () => ({
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: defaultPalette.colors[0],
      colorB: defaultPalette.colors[1],
      colorC: defaultPalette.colors[2],
    })
  );
  const [logoLiveMaterialId, setLogoLiveMaterialId] = useStudioDraft<LiveMaterialId>(
    identity.id,
    tool.id,
    'logo-live-material',
    DEFAULT_LIVE_MATERIAL_ID
  );
  const [logoLiveSettings, setLogoLiveSettings] = useStudioDraft<LiveMaterialSettings>(
    identity.id,
    tool.id,
    'logo-live-settings',
    () => ({
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: defaultPalette.colors[1],
      colorB: defaultPalette.colors[0],
      colorC: defaultPalette.colors[2],
    })
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
    defaultPalette.colors[0]
  );
  const [colorB, setColorB] = useStudioDraft(
    identity.id,
    tool.id,
    'color-b',
    defaultPalette.colors[1]
  );
  const [colorC, setColorC] = useStudioDraft(
    identity.id,
    tool.id,
    'color-c',
    defaultPalette.colors[2]
  );
  const [logoTone, setLogoTone] = useStudioDraft<LogoTone>(identity.id, tool.id, 'logo-tone', 'light');
  const [logoColor, setLogoColor] = useStudioDraft(identity.id, tool.id, 'logo-color', '#FFFFFF');
  const [logoInvert, setLogoInvert] = useStudioDraft(identity.id, tool.id, 'logo-invert', false);
  const [logoScale, setLogoScale] = useStudioDraft(identity.id, tool.id, 'logo-scale', 40);
  const [logoOpacity, setLogoOpacity] = useStudioDraft(identity.id, tool.id, 'logo-opacity', 100);
  const [logoX, setLogoX] = useStudioDraft(identity.id, tool.id, 'logo-x', 0);
  const [logoY, setLogoY] = useStudioDraft(identity.id, tool.id, 'logo-y', 0);
  const [target, setTarget] = useStudioDraft<EffectTarget>(identity.id, tool.id, 'target', 'background');
  const [selectedLayer, setSelectedLayer] = useStudioDraft<ShaderLayer>(identity.id, tool.id, 'selected-layer', 'background');
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
  const [exportDialog, setExportDialog] = useState<'png' | 'gif' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoSelected, setLogoSelected] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [shaderLibraryOpen, setShaderLibraryOpen] = useState(true);
  const engine = normalizeShaderEngine(storedEngine);
  const resolvedLiveMaterialId = normalizeLiveMaterialId(liveMaterialId);
  const resolvedLogoLiveMaterialId = normalizeLiveMaterialId(logoLiveMaterialId);
  const isLiveMaterial = engine === 'shadergradient' || engine === 'glyphfield' || engine === 'shaders' || engine === 'fluid' || engine === 'paper';
  const preset: ShaderPreset =
    engine === 'custom-glsl'
      ? {
          description: 'A local GLSL fragment using Studio’s resolution, time, and two-color uniforms.',
          fragmentSource: customSource,
          id: 'custom',
          name: 'Custom GLSL',
        }
      : SHADER_PRESETS.find(({ id }) => id === presetId) ?? DEFAULT_SHADER_PRESET;
  const backgroundMaterial = getLiveMaterial(resolvedLiveMaterialId);
  const backgroundActiveMaterial = isLiveMaterial
    ? backgroundMaterial
    : {
        description: preset.description,
        engine: 'WebGL / GLSL',
        id: preset.id,
        name: preset.name,
      };
  const resolvedLiveSettings = useMemo<LiveMaterialSettings>(() => ({
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...liveSettings,
    colorA,
    colorB,
    colorC,
    speed,
  }), [colorA, colorB, colorC, liveSettings, speed]);
  const resolvedLogoLiveSettings = useMemo<LiveMaterialSettings>(() => ({
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...logoLiveSettings,
  }), [logoLiveSettings]);
  const logoMaterial = getLiveMaterial(resolvedLogoLiveMaterialId);
  const backgroundShaderEnabled = target === 'background' || target === 'both';
  const logoShaderEnabled = target === 'logo' || target === 'both';
  const selectedMaterialId = selectedLayer === 'background'
    ? resolvedLiveMaterialId
    : resolvedLogoLiveMaterialId;
  const selectedMaterialSettings = selectedLayer === 'background'
    ? resolvedLiveSettings
    : resolvedLogoLiveSettings;
  const selectedMaterial = selectedLayer === 'background'
    ? backgroundActiveMaterial
    : logoMaterial;
  const selectedLayerUsesLiveMaterial = selectedLayer === 'logo' || isLiveMaterial;
  const selectedLayerEnabled = selectedLayer === 'background'
    ? backgroundShaderEnabled
    : logoShaderEnabled;
  const selectedLayerSpeed = selectedLayer === 'background'
    ? resolvedLiveSettings.speed
    : resolvedLogoLiveSettings.speed;
  const exportMaterialId = target === 'both'
    ? `${backgroundActiveMaterial.id}-${logoMaterial.id}`
    : target === 'logo'
      ? logoMaterial.id
      : backgroundActiveMaterial.id;
  const canvasMaterialName = target === 'both'
    ? `BG · ${backgroundActiveMaterial.name}  /  LOGO · ${logoMaterial.name}`
    : target === 'logo'
      ? `LOGO · ${logoMaterial.name}`
      : `BG · ${backgroundActiveMaterial.name}`;
  const canvasMaterialDescription = target === 'both'
    ? `${backgroundActiveMaterial.description} Logo: ${logoMaterial.description}`
    : target === 'logo'
      ? logoMaterial.description
      : backgroundActiveMaterial.description;
  const identityLogoPath = brandAssetPath(identity, logoTone === 'light' ? 'mark-light' : 'mark-dark');
  const logoPath = customLogo?.url ?? identityLogoPath ?? monogramMask(identity);
  const aspectRatio = ratio === 'square' ? '1 / 1' : ratio === 'opengraph' ? '1200 / 630' : '16 / 10';
  const previewDimensions = outputDimensions('high');
  const previewLogoSize = Math.min(previewDimensions.width, previewDimensions.height) * 0.4;
  const exportRenderScale = EXPORT_QUALITY_OPTIONS.find(({ value }) => value === exportQuality)?.multiplier ?? 1;
  const logoMaskStyle: CSSProperties = {
    WebkitMaskImage: `url('${logoPath}')`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskImage: `url('${logoPath}')`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
  };
  const outlineFilters = finish.borderEnabled && finish.borderWidth > 0 && finish.borderOpacity > 0
    ? materialFinishOutlineOffsets(finish.borderWidth).map(
        ([x, y], index) => ({ index, value: `drop-shadow(${x.toFixed(2)}px ${y.toFixed(2)}px 0 ${finishColor(finish.borderColor, finish.borderOpacity / 100)})` })
      ).filter(({ index }) => index % 4 === 0).map(({ value }) => value)
    : [];
  const shadowFilter = finish.shadowEnabled && !finish.glassEnabled && finish.shadowOpacity > 0
    ? `drop-shadow(${finish.shadowOffsetX}px ${finish.shadowOffsetY}px ${finish.shadowBlur}px ${finishColor(finish.shadowColor, finish.shadowOpacity / 100)})`
    : '';
  const logoFinishStyle: PreviewFinishStyle = {
    filter: [logoInvert ? 'invert(1)' : '', ...outlineFilters, shadowFilter].filter(Boolean).join(' ') || undefined,
    WebkitBoxReflect: finish.reflectionEnabled && finish.reflectionOpacity > 0
      ? `below ${finish.reflectionGap}px linear-gradient(to bottom, ${finishColor('#000000', finish.reflectionOpacity / 100)} 0%, transparent ${Math.min(100, finish.reflectionLength)}%)`
      : undefined,
  };
  const glassFinishStyle: CSSProperties = {
    WebkitBackdropFilter: `blur(${Math.min(24, finish.glassBlur)}px)`,
    backdropFilter: `blur(${Math.min(24, finish.glassBlur)}px)`,
    background: `linear-gradient(135deg, ${finishColor('#FFFFFF', finish.glassHighlight / 100)}, ${finishColor(finish.glassTint, finish.glassOpacity / 100)} 42%, ${finishColor(finish.glassTint, finish.glassOpacity / 250)})`,
    border: finish.borderEnabled && finish.borderWidth > 0
      ? `${finish.borderWidth}px solid ${finishColor(finish.borderColor, finish.borderOpacity / 100)}`
      : undefined,
    borderRadius: `${finish.glassRadius}px`,
    boxShadow: finish.shadowEnabled && finish.shadowOpacity > 0
      ? `${finish.shadowOffsetX}px ${finish.shadowOffsetY}px ${Math.min(48, finish.shadowBlur)}px ${finishColor(finish.shadowColor, finish.shadowOpacity / 100)}`
      : undefined,
    inset: `-${finish.glassPadding}px`,
    transform: `scale(${1 + finish.glassRefraction / 100})`,
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
    if (nextEngine === 'fluid' && resolvedLiveMaterialId !== 'pavel-fluid-energy') {
      setLiveMaterialId('pavel-fluid-energy');
    }
    if (nextEngine === 'paper' && !isPaperLiveMaterialId(resolvedLiveMaterialId)) {
      setLiveMaterialId('paper-mesh-gradient');
    }
    if (nextEngine === 'glyphfield' && !resolvedLiveMaterialId.startsWith('glyphfield-')) {
      setLiveMaterialId('glyphfield-glyph-field');
      setColorA('#08080A');
      setColorB('#F4F4F0');
      setColorC('#8A73FF');
      updateLiveSettings({
        colorA: '#08080A',
        colorB: '#F4F4F0',
        colorC: '#8A73FF',
        density: 0.9,
        detail: 4.2,
        frequency: 4.6,
        grain: 28,
        strength: 0.52,
      });
    }
  }

  function updateLiveSettings(patch: Partial<LiveMaterialSettings>) {
    setLiveSettings((current) => ({ ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...current, ...patch }));
  }

  function replaceLiveSettings(settings: LiveMaterialSettings) {
    setLiveSettings(settings);
    setColorA(settings.colorA);
    setColorB(settings.colorB);
    setColorC(settings.colorC);
    setSpeed(settings.speed);
  }

  function setLayerEnabled(layer: ShaderLayer, enabled: boolean) {
    const nextBackgroundEnabled = layer === 'background' ? enabled : backgroundShaderEnabled;
    const nextLogoEnabled = layer === 'logo' ? enabled : logoShaderEnabled;
    if (!nextBackgroundEnabled && !nextLogoEnabled) return;
    setTarget(
      nextBackgroundEnabled && nextLogoEnabled
        ? 'both'
        : nextBackgroundEnabled
          ? 'background'
          : 'logo'
    );
  }

  function replaceSelectedLiveSettings(settings: LiveMaterialSettings) {
    if (selectedLayer === 'background') {
      replaceLiveSettings(settings);
      return;
    }
    setLogoLiveSettings(settings);
  }

  function setSelectedLayerSpeed(nextSpeed: number) {
    if (selectedLayer === 'background') {
      if (isLiveMaterial) {
        replaceLiveSettings({ ...resolvedLiveSettings, speed: nextSpeed });
      } else {
        setSpeed(nextSpeed);
      }
      return;
    }
    setLogoLiveSettings({ ...resolvedLogoLiveSettings, speed: nextSpeed });
  }

  function selectLiveMaterial(materialId: LiveMaterialId) {
    if (selectedLayer === 'background') {
      setLiveMaterialId(materialId);
      setEngine(engineForLiveMaterial(materialId));
    } else {
      setLogoLiveMaterialId(materialId);
    }
    setLayerEnabled(selectedLayer, true);
    setError(null);
  }

  function applySelectedShaderToBoth() {
    if (selectedLayer === 'background') {
      if (!isLiveMaterial) return;
      setLogoLiveMaterialId(resolvedLiveMaterialId);
      setLogoLiveSettings(resolvedLiveSettings);
    } else {
      setLiveMaterialId(resolvedLogoLiveMaterialId);
      setEngine(engineForLiveMaterial(resolvedLogoLiveMaterialId));
      replaceLiveSettings(resolvedLogoLiveSettings);
    }
    setTarget('both');
    setError(null);
  }

  function applyMaterialSource(source: string) {
    const parsed = parseSourceObject(source);
    const nextLayers = sourceObject(parsed, 'layers');
    const nextBackgroundLayer = nextLayers ? sourceObject(nextLayers, 'background') : undefined;
    const nextLogoLayer = nextLayers ? sourceObject(nextLayers, 'logo') : undefined;
    const nextEngine = sourceString(nextBackgroundLayer ?? parsed, 'engine', engine);
    const nextBackgroundEnabled = nextBackgroundLayer
      ? sourceBoolean(nextBackgroundLayer, 'enabled', backgroundShaderEnabled)
      : backgroundShaderEnabled;
    const nextLogoEnabled = nextLogoLayer
      ? sourceBoolean(nextLogoLayer, 'enabled', logoShaderEnabled)
      : logoShaderEnabled;
    const nextTarget = nextLayers
      ? nextBackgroundEnabled && nextLogoEnabled
        ? 'both'
        : nextBackgroundEnabled
          ? 'background'
          : 'logo'
      : sourceString(parsed, 'target', target);
    const nextRatio = sourceString(parsed, 'ratio', ratio);
    const nextQuality = sourceString(parsed, 'exportQuality', exportQuality);
    const nextColors = sourceObject(parsed, 'colors');
    const nextLogo = sourceObject(parsed, 'logo');
    const nextParameters = sourceObject(nextBackgroundLayer ?? parsed, 'parameters');
    const nextLiveSettings = sourceObject(nextBackgroundLayer ?? parsed, 'liveSettings');
    const nextLogoLiveSettings = nextLogoLayer ? sourceObject(nextLogoLayer, 'liveSettings') : undefined;
    const nextFinish = (nextLogoLayer ? sourceObject(nextLogoLayer, 'finish') : undefined)
      ?? sourceObject(parsed, 'finish');
    const nextSpeed = sourceNumber(parsed, 'speed', speed);
    const nextColorA = nextColors ? sourceString(nextColors, 'a', colorA) : colorA;
    const nextColorB = nextColors ? sourceString(nextColors, 'b', colorB) : colorB;
    const nextColorC = nextColors ? sourceString(nextColors, 'c', colorC) : colorC;

    if (!['studio-glsl', 'shadergradient', 'glyphfield', 'shaders', 'fluid', 'paper', 'custom-glsl'].includes(nextEngine)) {
      throw new TypeError('Engine must be a supported material engine.');
    }
    if (nextLayers && !nextBackgroundEnabled && !nextLogoEnabled) {
      throw new TypeError('At least one shader layer must be enabled.');
    }
    if (!['background', 'logo', 'both'].includes(nextTarget)) {
      throw new TypeError('Target must be background, logo, or both.');
    }
    if (!['square', 'wide', 'opengraph'].includes(nextRatio)) {
      throw new TypeError('Ratio must be square, wide, or opengraph.');
    }
    if (!['standard', 'high', 'ultra'].includes(nextQuality)) {
      throw new TypeError('Export quality must be standard, high, or ultra.');
    }

    setEngine(nextEngine as ShaderEngine);
    setTarget(nextTarget as EffectTarget);
    setRatio(nextRatio as ShaderRatio);
    setExportQuality(nextQuality as ExportQuality);
    setPresetId(sourceString(nextBackgroundLayer ?? parsed, 'presetId', presetId));
    setLiveMaterialId(normalizeLiveMaterialId(sourceString(nextBackgroundLayer ?? parsed, 'liveMaterialId', resolvedLiveMaterialId)));
    if (nextLogoLayer) {
      setLogoLiveMaterialId(normalizeLiveMaterialId(sourceString(nextLogoLayer, 'liveMaterialId', resolvedLogoLiveMaterialId)));
    }
    setCustomDraft(sourceString(parsed, 'customSource', customDraft));
    setCustomSource(sourceString(parsed, 'customSource', customSource));
    setCustomVersion((current) => current + 1);
    setTransparent(sourceBoolean(parsed, 'transparent', transparent));
    setSpeed(nextSpeed);

    if (nextColors) {
      setColorA(nextColorA);
      setColorB(nextColorB);
      setColorC(nextColorC);
    }
    if (nextParameters) {
      setParameters({
        contour: sourceNumber(nextParameters, 'contour', parameters.contour),
        distortion: sourceNumber(nextParameters, 'distortion', parameters.distortion),
        repetition: sourceNumber(nextParameters, 'repetition', parameters.repetition),
        scale: sourceNumber(nextParameters, 'scale', parameters.scale),
        softness: sourceNumber(nextParameters, 'softness', parameters.softness),
      });
    }
    if (nextLiveSettings) {
      replaceLiveSettings({
        ...resolvedLiveSettings,
        ...nextLiveSettings,
        colorA: sourceString(nextLiveSettings, 'colorA', nextColorA),
        colorB: sourceString(nextLiveSettings, 'colorB', nextColorB),
        colorC: sourceString(nextLiveSettings, 'colorC', nextColorC),
        speed: sourceNumber(nextLiveSettings, 'speed', nextSpeed),
      } as LiveMaterialSettings);
    }
    if (nextLogoLiveSettings) {
      setLogoLiveSettings({
        ...resolvedLogoLiveSettings,
        ...nextLogoLiveSettings,
      } as LiveMaterialSettings);
    }
    if (nextFinish) {
      setStoredFinish(normalizeMaterialFinish({
        ...finish,
        ...nextFinish,
      } as MaterialFinishSettings));
    }
    if (nextLogo) {
      const nextTone = sourceString(nextLogo, 'tone', logoTone);
      if (!['light', 'dark'].includes(nextTone)) {
        throw new TypeError('Logo tone must be light or dark.');
      }
      setLogoTone(nextTone as LogoTone);
      setLogoColor(sourceString(nextLogo, 'color', logoColor));
      setLogoInvert(sourceBoolean(nextLogo, 'invert', logoInvert));
      setLogoScale(sourceNumber(nextLogo, 'scale', logoScale));
      setLogoOpacity(sourceNumber(nextLogo, 'opacity', logoOpacity));
      setLogoX(sourceNumber(nextLogo, 'x', logoX));
      setLogoY(sourceNumber(nextLogo, 'y', logoY));
    }
    setLogoSelected(false);
    setError(null);
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

  const composeFrameRef = useRef(composeFrame);
  const exportDialogRef = useRef(exportDialog);
  const previewLogoPathRef = useRef(logoPath);
  composeFrameRef.current = composeFrame;
  exportDialogRef.current = exportDialog;
  previewLogoPathRef.current = logoPath;

  useMountEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    let loadedLogo: HTMLImageElement | null = null;
    let loadedPath = '';
    let loadingPath = '';
    let previousDraw = 0;
    let rendering = false;

    function drawPreview(time: number) {
      const canvas = exportPreviewCanvasRef.current;
      const path = previewLogoPathRef.current;
      if (exportDialogRef.current && canvas) {
        if (path !== loadedPath && path !== loadingPath) {
          loadingPath = path;
          void loadImage(path).then((image) => {
            if (disposed || previewLogoPathRef.current !== path) return;
            loadedLogo = image;
            loadedPath = path;
            loadingPath = '';
          }).catch(() => {
            loadingPath = '';
          });
        }

        if (loadedLogo && loadedPath === path && !rendering && time - previousDraw >= 1000 / 24) {
          const bounds = canvas.getBoundingClientRect();
          const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.round(bounds.width * pixelRatio));
          const height = Math.max(1, Math.round(bounds.height * pixelRatio));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          const context = canvas.getContext('2d');
          if (context) {
            rendering = true;
            previousDraw = time;
            void composeFrameRef.current(context, width, height, loadedLogo).finally(() => {
              rendering = false;
            });
          }
        }
      }
      animationFrame = requestAnimationFrame(drawPreview);
    }

    animationFrame = requestAnimationFrame(drawPreview);
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
    };
  });

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
      downloadBlob(blob, `${identity.id}-${exportMaterialId}-${target}.png`);
    } finally {
      setExporting(null);
    }
  }

  async function captureGif() {
    setExporting('gif');
    setExportProgress(0);
    try {
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
      let sharedPalette: ReturnType<typeof quantize> | undefined;
      let transparentIndex = -1;
      for (let index = 0; index < GIF_FRAME_COUNT; index += 1) {
        setCaptureTimeMs(index * GIF_FRAME_DELAY_MS);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        await composeFrame(context, width, height, logo);
        const frame = context.getImageData(0, 0, width, height).data;
        if (!sharedPalette) {
          sharedPalette = quantize(frame, 256, {
            format,
            oneBitAlpha: useTransparency,
          });
          transparentIndex = sharedPalette.findIndex((color) => (color[3] ?? 255) === 0);
        }
        const indexed = applyPalette(frame, sharedPalette, format);
        gif.writeFrame(indexed, width, height, {
          delay: GIF_FRAME_DELAY_MS,
          dispose: 2,
          transparent: transparentIndex >= 0,
          ...(index === 0 ? { palette: sharedPalette, repeat: 0 } : {}),
          ...(transparentIndex >= 0 ? { transparentIndex } : {}),
        });
        setExportProgress((index + 1) / GIF_FRAME_COUNT);
      }
      gif.finish();
      downloadBlob(
        new Blob([Uint8Array.from(gif.bytes())], { type: 'image/gif' }),
        `${identity.id}-${exportMaterialId}-${target}.gif`
      );
    } finally {
      setCaptureTimeMs(null);
      setExporting(null);
      setExportProgress(0);
    }
  }

  function renderMaterial(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    placement: 'background' | 'logo'
  ) {
    if (placement === 'logo') {
      return (
        <LiveMaterialCanvas
          captureTimeMs={captureTimeMs}
          className='absolute inset-0 size-full'
          key={`logo-${resolvedLogoLiveMaterialId}-${exportQuality}`}
          materialId={resolvedLogoLiveMaterialId}
          paused={paused || captureTimeMs !== null}
          renderScale={exportRenderScale}
          settings={resolvedLogoLiveSettings}
        />
      );
    }

    if (isLiveMaterial) {
      return (
        <LiveMaterialCanvas
          captureTimeMs={captureTimeMs}
          className='absolute inset-0 size-full'
          key={`background-${engine}-${resolvedLiveMaterialId}-${exportQuality}`}
          materialId={resolvedLiveMaterialId}
          paused={paused || captureTimeMs !== null}
          renderScale={exportRenderScale}
          settings={resolvedLiveSettings}
        />
      );
    }

    return (
      <ShaderCanvas
        canvasRef={canvasRef}
        captureTimeMs={captureTimeMs}
        colorA={colorA}
        colorB={colorB}
        key={`background-${engine}-${preset.id}-${customVersion}-${exportQuality}`}
        onError={setError}
        parameters={parameters}
        paused={paused || captureTimeMs !== null}
        preset={preset}
        renderScale={exportRenderScale}
        speed={speed}
      />
    );
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='app-navbar tool-header flex items-center justify-between gap-4 border-b border-border px-5'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <ShaderLibraryButton onClick={() => setShaderLibraryOpen((current) => !current)} open={shaderLibraryOpen} />
          {navigation}
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <Button
            aria-label={paused ? gt('Play shader') : gt('Pause shader')}
            onClick={() => setPaused((current) => !current)}
            size='icon'
            type='button'
            variant='outline'
          >
            {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
          </Button>
          <Button aria-label={gt('Export PNG')} onClick={() => setExportDialog('png')} title={gt('Export PNG')} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'><T>PNG</T></span>
          </Button>
          <Button aria-label={gt('Export GIF')} onClick={() => setExportDialog('gif')} title={gt('Export GIF')} type='button'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'><T>GIF</T></span>
          </Button>
        </div>
      </header>

      <div className={`tool-body ${shaderLibraryOpen ? 'tool-body-with-shader-library' : ''}`}>
        {shaderLibraryOpen ? (
          <ShaderLibrarySidebar
            activeMaterialId={selectedMaterialId}
            onClose={() => setShaderLibraryOpen(false)}
            onSelect={selectLiveMaterial}
            settings={selectedMaterialSettings}
            storageKey='material-shader-library'
          />
        ) : null}
        <ResizableSidebar
          className='tool-inspector min-h-0 border-r border-border bg-background'
          label={gt(`${tool.name} controls`)}
          storageKey={`tool-${tool.id}`}
        >
          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Shader layers</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Choose and edit the background and logo independently.</T></p>
            </div>
            <div className='grid grid-cols-2 gap-px overflow-hidden border border-border bg-border'>
              {([
                ['background', 'Behind', backgroundShaderEnabled],
                ['logo', 'Logo', logoShaderEnabled],
              ] as const).map(([layer, label, enabled]) => (
                <button
                  aria-pressed={selectedLayer === layer}
                  className='flex min-w-0 flex-col items-start gap-1 bg-background px-3 py-2.5 text-left hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background'
                  key={layer}
                  onClick={() => setSelectedLayer(layer)}
                  type='button'
                >
                  <span className='text-xs font-semibold'>{label}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${selectedLayer === layer ? 'text-background/65' : 'text-muted-foreground'}`}>
                    {enabled ? gt('On') : gt('Off')}
                  </span>
                </button>
              ))}
            </div>
            <div className='flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <p className='text-xs font-medium'>{selectedLayer === 'background' ? <T>Background shader</T> : <T>Logo shader</T>}</p>
                <p className='mt-0.5 truncate text-[10px] text-muted-foreground'>{selectedMaterial.name}</p>
              </div>
              <Button
                disabled={selectedLayerEnabled && (selectedLayer === 'background' ? !logoShaderEnabled : !backgroundShaderEnabled)}
                onClick={() => setLayerEnabled(selectedLayer, !selectedLayerEnabled)}
                size='sm'
                type='button'
                variant={selectedLayerEnabled ? 'default' : 'outline'}
              >
                {selectedLayerEnabled ? <T>Enabled</T> : <T>Enable</T>}
              </Button>
            </div>
            <Button
              disabled={selectedLayer === 'background' && !isLiveMaterial}
              onClick={applySelectedShaderToBoth}
              size='sm'
              type='button'
              variant='outline'
            >
              <T>Apply this shader to both</T>
            </Button>
          </section>
          {selectedLayerUsesLiveMaterial ? (
            <section className='flex flex-col gap-4 border-b border-border p-5'>
              <div>
                <h2 className='text-sm font-semibold'>{selectedLayer === 'background' ? <T>Background shader</T> : <T>Logo shader</T>}</h2>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>{selectedMaterial.description}</p>
              </div>
              <LiveMaterialControls
                identity={identity}
                materialId={selectedMaterialId}
                onMaterialIdChange={selectLiveMaterial}
                onSettingsChange={replaceSelectedLiveSettings}
                showMaterialSelector={false}
                settings={selectedMaterialSettings}
              />
            </section>
          ) : (
            <>
              <section className='flex flex-col gap-4 border-b border-border p-5'>
                <h2 className='text-sm font-semibold'><T>Material colors</T></h2>
                <MaterialPalettePresets
                  identity={identity}
                  onSelect={([nextA, nextB]) => { setColorA(nextA); setColorB(nextB); }}
                  value={[colorA, colorB, colorC]}
                />
                <ColorControl ariaLabel={gt('Material color one')} label={<T>Color 1</T>} onChange={setColorA} value={colorA} />
                <ColorControl ariaLabel={gt('Material color two')} label={<T>Color 2</T>} onChange={setColorB} value={colorB} />
              </section>
              <section className='flex flex-col gap-4 border-b border-border p-5'>
                <div>
                  <h2 className='text-sm font-semibold'><T>Material</T></h2>
                  <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Controls are shared across previews and downloaded frames.</T></p>
                </div>
                {([
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
            </>
          )}

          {selectedLayer === 'logo' ? (
            <>
              <section className='flex flex-col gap-4 border-b border-border p-5'>
                <div>
                  <h2 className='text-sm font-semibold'><T>Logo finish</T></h2>
                  <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Add outline, glass, reflection, shadow, and depth to the logo layer.</T></p>
                </div>
                <MaterialFinishControls onChange={setStoredFinish} settings={finish} />
              </section>

              <section className='flex flex-col gap-4 border-b border-border p-5'>
                <h2 className='text-sm font-semibold'><T>Logo artwork</T></h2>
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
            </>
          ) : null}

          {selectedLayer === 'background' ? <details className='border-b border-border p-5' open={!isLiveMaterial}>
            <summary className='cursor-pointer text-sm font-semibold'><T>Advanced GLSL</T></summary>
            <div className='mt-4 flex flex-col gap-3'>
              <p className='text-xs leading-5 text-muted-foreground'><T>Studio and custom GLSL remain available here. Choosing any library preview returns to live materials.</T></p>
              <div className='grid grid-cols-2 gap-2'>
                <Button onClick={() => selectEngine('studio-glsl')} size='sm' type='button' variant={engine === 'studio-glsl' ? 'default' : 'outline'}>
                  <T>Studio GLSL</T>
                </Button>
                <Button onClick={() => selectEngine('custom-glsl')} size='sm' type='button' variant={engine === 'custom-glsl' ? 'default' : 'outline'}>
                  <T>Custom GLSL</T>
                </Button>
              </div>
              {engine === 'studio-glsl' ? (
                <StudioSelect
                  ariaLabel={gt('Studio shader')}
                  onValueChange={setPresetId}
                  options={SHADER_PRESETS.map((shader) => ({ label: shader.name, value: shader.id }))}
                  value={preset.id}
                />
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
            </div>
          </details> : null}

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
            {selectedLayer === 'background' && !isLiveMaterial ? (
              <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
                <span className='flex justify-between gap-3'><T>GLSL speed</T><span className='font-mono'>{speed.toFixed(2)}×</span></span>
                <input className='studio-range' max='2' min='0.2' onChange={(event) => setSpeed(Number(event.target.value))} step='0.05' type='range' value={speed} />
              </label>
            ) : null}
            {target === 'logo' ? (
              <label className='flex items-center justify-between gap-4 text-sm'>
                <T>Transparent export</T>
                <input checked={transparent} onChange={(event) => setTransparent(event.target.checked)} type='checkbox' />
              </label>
            ) : null}
          </section>
        </ResizableSidebar>

        <div className='tool-canvas min-h-0 overflow-hidden'>
          <CanvasViewport identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-5 sm:p-8' toolId={tool.id}>
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
                  <div className='relative size-full' data-material-finish-preview={finish.presetId} key='logo-finish'>
                    {finish.glassEnabled ? (
                      <div
                        aria-hidden='true'
                        className='pointer-events-none absolute z-0'
                        data-material-glass-preview
                        style={{ ...glassFinishStyle, ...logoMaskStyle }}
                      />
                    ) : null}
                    <div className='relative z-10 size-full' style={logoFinishStyle}>
                      {target === 'logo' || target === 'both' ? (
                        <div
                          className='relative size-full overflow-hidden'
                          ref={materialLayerRef}
                          style={logoMaskStyle}
                        >
                          {renderMaterial(materialCanvasRef, 'logo')}
                        </div>
                      ) : (
                        <div
                          aria-label={`${identity.name} logo`}
                          className='size-full'
                          style={{
                            ...logoMaskStyle,
                            backgroundColor: logoColor,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </EditableCanvasLayer>
              <div className='pointer-events-none absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest text-white/60 mix-blend-difference'>
                {canvasMaterialName}
              </div>
            </div>
            <div className='flex flex-wrap items-start justify-between gap-4 border-x border-b border-border bg-background p-4'>
              <div>
                <p className='text-sm font-semibold'>{canvasMaterialName}</p>
                <p className='mt-1 max-w-xl text-xs leading-5 text-muted-foreground'>{canvasMaterialDescription}</p>
              </div>
              <div className='flex items-center gap-4 text-muted-foreground'>
                <p className='font-mono text-[10px] uppercase tracking-wider'>
                  {identity.name} / {ratio} / {target === 'both' ? '2 layers' : '1 layer'} / {finish.presetId}
                </p>
                {target !== 'logo' && isLiveMaterial ? <LiveMaterialSourceBadge engine={backgroundMaterial.engine} /> : null}
                {target !== 'background' ? <LiveMaterialSourceBadge engine={logoMaterial.engine} /> : null}
              </div>
            </div>
            {error ? <p className='border-x border-b border-status-error-border bg-status-error-background p-3 text-sm text-status-error' role='alert'>{error}</p> : null}
          </div>
          </CanvasViewport>
        </div>
      </div>
      {exportDialog ? (
        <div
          className='shader-export-overlay'
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !exporting) setExportDialog(null);
          }}
        >
          <section
            aria-label={gt('{format} export preview', { format: exportDialog.toLocaleUpperCase() })}
            aria-modal='true'
            className='shader-export-dialog'
            role='dialog'
          >
            <header className='flex items-start justify-between gap-6 border-b border-border p-5'>
              <div>
                <h2 className='text-lg font-semibold tracking-tight'><T>Review export</T></h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {exportDialog === 'gif'
                    ? <T>Preview the exact shader speed before encoding.</T>
                    : <T>Preview the live surface before saving the current frame.</T>}
                </p>
              </div>
              <Button aria-label={gt('Close export preview')} disabled={Boolean(exporting)} onClick={() => setExportDialog(null)} size='icon-sm' type='button' variant='ghost'>
                <X aria-hidden='true' />
              </Button>
            </header>

            <div className='shader-export-content'>
              <div className='min-w-0 bg-muted/35 p-5'>
                <canvas
                  aria-label={gt('Live export preview')}
                  className={`artifact-frame mx-auto block h-auto w-full max-w-4xl ${target === 'logo' && transparent ? 'studio-stage' : 'bg-black'}`}
                  ref={exportPreviewCanvasRef}
                  style={{ aspectRatio }}
                />
              </div>

              <aside className='flex min-w-0 flex-col gap-5 border-l border-border p-5' data-canvas-selection-preserve>
                <div>
                  <p className='text-sm font-semibold'>{exportDialog.toLocaleUpperCase()}</p>
                  <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                    {outputDimensions().width} × {outputDimensions().height} · {exportDialog === 'gif' ? '2.0 s · 12.5 fps · 256 colors' : 'Lossless RGBA'}
                  </p>
                </div>
                <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
                  <span className='flex items-center justify-between gap-3'>
                    {selectedLayer === 'background' ? <T>Background speed</T> : <T>Logo speed</T>}
                    <output className='text-xs tabular-nums'>{selectedLayerSpeed.toFixed(2)}×</output>
                  </span>
                  <input className='studio-range' max='2' min='0.2' onChange={(event) => setSelectedLayerSpeed(Number(event.target.value))} step='0.05' type='range' value={selectedLayerSpeed} />
                </label>
                <div className='mt-auto flex gap-2 pt-3'>
                  <Button className='flex-1' disabled={Boolean(exporting)} onClick={() => setExportDialog(null)} type='button' variant='outline'><T>Cancel</T></Button>
                  <Button
                    className='flex-1'
                    loading={exporting === exportDialog}
                    onClick={async () => {
                      if (exportDialog === 'gif') await captureGif();
                      else await capturePng();
                      setExportDialog(null);
                    }}
                    type='button'
                  >
                    <Download aria-hidden='true' />
                    {exporting === 'gif' ? `${Math.round(exportProgress * 100)}%` : <T>Download</T>}
                  </Button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · material scene + GLSL'
          onApply={applyMaterialSource}
          onClose={() => setSourceOpen(false)}
          source={stringifySource({
            colors: { a: colorA, b: colorB, c: colorC },
            customSource,
            engine,
            exportQuality,
            finish,
            layers: {
              background: {
                enabled: backgroundShaderEnabled,
                engine,
                liveMaterialId: resolvedLiveMaterialId,
                liveSettings: resolvedLiveSettings,
                parameters,
                presetId,
              },
              logo: {
                enabled: logoShaderEnabled,
                finish,
                liveMaterialId: resolvedLogoLiveMaterialId,
                liveSettings: resolvedLogoLiveSettings,
              },
            },
            liveMaterialId: resolvedLiveMaterialId,
            liveSettings: resolvedLiveSettings,
            logo: {
              color: logoColor,
              invert: logoInvert,
              opacity: logoOpacity,
              scale: logoScale,
              tone: logoTone,
              x: logoX,
              y: logoY,
            },
            parameters,
            presetId,
            ratio,
            speed,
            target,
            transparent,
          })}
          title={gt('Shader layers source')}
        />
      ) : null}
    </div>
  );
}
