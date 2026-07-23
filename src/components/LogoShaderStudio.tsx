'use client';

import { useRef, useState, type RefObject } from 'react';
import { T, useGT } from 'gt-next';
import { Download, Pause, Play } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
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

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';

type ShaderRatio = 'square' | 'wide' | 'opengraph';
type LogoTone = 'light' | 'dark';
type EffectTarget = 'background' | 'logo' | 'both';
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
  speed,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  colorA: string;
  colorB: string;
  onError: (message: string | null) => void;
  parameters: ShaderParameters;
  paused: boolean;
  preset: ShaderPreset;
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
        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><text x="256" y="340" text-anchor="middle" fill="white" font-family="Inter,Arial,sans-serif" font-size="250" font-weight="700">${identity.shortName}</text></svg>`;
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
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [presetId, setPresetId] = useStudioDraft(
    identity.id,
    tool.id,
    'preset',
    DEFAULT_SHADER_PRESET.id
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
    identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B'
  );
  const [colorB, setColorB] = useStudioDraft(
    identity.id,
    tool.id,
    'color-b',
    identity.colors.find(({ id }) => id === 'emphasis')?.hex ?? '#3B82F6'
  );
  const [logoTone, setLogoTone] = useStudioDraft<LogoTone>(identity.id, tool.id, 'logo-tone', 'light');
  const [logoScale, setLogoScale] = useStudioDraft(identity.id, tool.id, 'logo-scale', 40);
  const [logoOpacity, setLogoOpacity] = useStudioDraft(identity.id, tool.id, 'logo-opacity', 100);
  const [logoX, setLogoX] = useStudioDraft(identity.id, tool.id, 'logo-x', 0);
  const [logoY, setLogoY] = useStudioDraft(identity.id, tool.id, 'logo-y', 0);
  const [target, setTarget] = useStudioDraft<EffectTarget>(identity.id, tool.id, 'target', 'logo');
  const [transparent, setTransparent] = useStudioDraft(identity.id, tool.id, 'transparent', true);
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'ratio', 'wide');
  const [speed, setSpeed] = useStudioDraft(identity.id, tool.id, 'speed', 1);
  const [parameters, setParameters] = useStudioDraft<ShaderParameters>(
    identity.id,
    tool.id,
    'parameters',
    DEFAULT_PARAMETERS
  );
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'gif' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const preset: ShaderPreset =
    presetId === 'custom'
      ? {
          description: 'A local GLSL fragment using Studio’s resolution, time, and two-color uniforms.',
          fragmentSource: customSource,
          id: 'custom',
          name: 'Custom GLSL',
        }
      : SHADER_PRESETS.find(({ id }) => id === presetId) ?? DEFAULT_SHADER_PRESET;
  const identityLogoPath = brandAssetPath(identity, logoTone === 'light' ? 'mark-light' : 'mark-dark');
  const logoPath = customLogo?.url ?? identityLogoPath ?? monogramMask(identity);
  const aspectRatio = ratio === 'square' ? '1 / 1' : ratio === 'opengraph' ? '1200 / 630' : '16 / 10';

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

  function outputDimensions() {
    if (ratio === 'square') return { height: 1200, width: 1200 };
    if (ratio === 'opengraph') return { height: 630, width: 1200 };
    return { height: 1000, width: 1600 };
  }

  async function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    logo: HTMLImageElement
  ) {
    context.clearRect(0, 0, width, height);
    const backgroundCanvas = backgroundCanvasRef.current;
    const materialCanvas = materialCanvasRef.current;
    if ((target === 'background' || target === 'both') && backgroundCanvas) {
      context.drawImage(backgroundCanvas, 0, 0, width, height);
    } else if (!transparent) {
      context.fillStyle = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
      context.fillRect(0, 0, width, height);
    }

    const markSize = Math.round(Math.min(width, height) * (logoScale / 100));
    const markX = Math.round((width - markSize) / 2 + (logoX / 100) * width);
    const markY = Math.round((height - markSize) / 2 + (logoY / 100) * height);
    context.save();
    context.globalAlpha = logoOpacity / 100;
    if ((target === 'logo' || target === 'both') && materialCanvas) {
      const cutout = document.createElement('canvas');
      cutout.width = markSize;
      cutout.height = markSize;
      const cutoutContext = cutout.getContext('2d');
      if (!cutoutContext) {
        context.restore();
        return;
      }
      cutoutContext.drawImage(materialCanvas, 0, 0, markSize, markSize);
      cutoutContext.globalCompositeOperation = 'destination-in';
      cutoutContext.drawImage(logo, 0, 0, markSize, markSize);
      context.drawImage(cutout, markX, markY);
    } else {
      context.drawImage(logo, markX, markY, markSize, markSize);
    }
    context.restore();
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
      downloadBlob(blob, `${identity.id}-${preset.id}-${target}.png`);
    } finally {
      setExporting(null);
    }
  }

  async function captureGif() {
    setExporting('gif');
    setExportProgress(0);
    try {
      const fps = 12;
      const frameCount = 18;
      const { height: sourceHeight, width: sourceWidth } = outputDimensions();
      const scale = Math.min(1, 560 / sourceWidth);
      const width = Math.round(sourceWidth * scale);
      const height = Math.round(sourceHeight * scale);
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      const logo = await loadImage(logoPath);
      const frames: Uint8ClampedArray[] = [];
      for (let index = 0; index < frameCount; index += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000 / fps));
        await composeFrame(context, width, height, logo);
        frames.push(context.getImageData(0, 0, width, height).data);
        setExportProgress((index + 1) / (frameCount * 2));
      }
      const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
      const gif = GIFEncoder();
      for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) continue;
        const palette = quantize(frame, 64, {
          format: 'rgba4444',
          oneBitAlpha: target === 'logo' && transparent,
        });
        const indexed = applyPalette(frame, palette, 'rgba4444');
        const transparentIndex = palette.findIndex((color) => (color[3] ?? 255) === 0);
        gif.writeFrame(indexed, width, height, {
          delay: Math.round(1000 / fps),
          dispose: 2,
          palette,
          transparent: transparentIndex >= 0,
          ...(index === 0 ? { repeat: 0 } : {}),
          ...(transparentIndex >= 0 ? { transparentIndex } : {}),
        });
        setExportProgress(0.5 + (index + 1) / (frameCount * 2));
        if (index % 4 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
      gif.finish();
      downloadBlob(
        new Blob([Uint8Array.from(gif.bytes())], { type: 'image/gif' }),
        `${identity.id}-${preset.id}-${target}.gif`
      );
    } finally {
      setExporting(null);
      setExportProgress(0);
    }
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
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
            <h2 className='text-sm font-semibold'><T>Shader</T></h2>
            <div className='grid grid-cols-2 gap-2'>
              {SHADER_PRESETS.map((shader) => (
                <Button
                  className='h-auto min-h-16 flex-col items-start gap-1 px-3 py-2 text-left'
                  key={shader.id}
                  onClick={() => setPresetId(shader.id)}
                  type='button'
                  variant={preset.id === shader.id ? 'default' : 'outline'}
                >
                  <span>{shader.name}</span>
                  <span className={`text-xs font-normal ${preset.id === shader.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {shader.id}
                  </span>
                </Button>
              ))}
              <Button
                className='h-auto min-h-16 flex-col items-start gap-1 px-3 py-2 text-left'
                onClick={() => setPresetId('custom')}
                type='button'
                variant={preset.id === 'custom' ? 'default' : 'outline'}
              >
                <span><T>Custom GLSL</T></span>
                <span className={`text-xs font-normal ${preset.id === 'custom' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>import</span>
              </Button>
            </div>
            {preset.id === 'custom' ? (
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
            <h2 className='text-sm font-semibold'><T>Brand colors</T></h2>
            <label className='grid grid-cols-[36px_1fr] items-center gap-3 text-sm'>
              <input aria-label={gt('Shader color one')} className='size-9 rounded-md border border-input p-1' onChange={(event) => setColorA(event.target.value)} type='color' value={colorA} />
              <input aria-label={gt('Shader color one hex')} className={INPUT_CLASS} onChange={(event) => setColorA(event.target.value)} value={colorA} />
            </label>
            <label className='grid grid-cols-[36px_1fr] items-center gap-3 text-sm'>
              <input aria-label={gt('Shader color two')} className='size-9 rounded-md border border-input p-1' onChange={(event) => setColorB(event.target.value)} type='color' value={colorB} />
              <input aria-label={gt('Shader color two hex')} className={INPUT_CLASS} onChange={(event) => setColorB(event.target.value)} value={colorB} />
            </label>
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Material</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Shared controls tune every original shader recipe.</T></p>
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

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Logo</T></h2>
            <div className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'>
              {(['light', 'dark'] as const).map((tone) => (
                <Button className='rounded-none border-0' key={tone} onClick={() => setLogoTone(tone)} size='sm' type='button' variant={logoTone === tone ? 'default' : 'secondary'}>
                  {tone === 'light' ? <T>White</T> : <T>Black</T>}
                </Button>
              ))}
            </div>
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
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Aspect ratio</T>
              <select className={INPUT_CLASS} onChange={(event) => setRatio(event.target.value as ShaderRatio)} value={ratio}>
                <option value='wide'>16:10</option>
                <option value='opengraph'>OpenGraph</option>
                <option value='square'>Square</option>
              </select>
            </label>
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
              className={`relative w-full overflow-hidden border border-black/15 shadow-sm ${target === 'logo' && transparent ? 'studio-stage' : 'bg-black'}`}
              style={{ aspectRatio }}
            >
              {target === 'background' || target === 'both' ? (
                <ShaderCanvas
                  canvasRef={backgroundCanvasRef}
                  colorA={colorA}
                  colorB={colorB}
                  key={`background-${preset.id}-${customVersion}`}
                  onError={setError}
                  parameters={parameters}
                  paused={paused}
                  preset={preset}
                  speed={speed}
                />
              ) : null}
              <div className='pointer-events-none absolute inset-0 grid place-items-center' style={{ opacity: logoOpacity / 100, transform: `translate(${logoX}%, ${logoY}%)` }}>
                {target === 'logo' || target === 'both' ? (
                  <div
                    className='relative overflow-hidden'
                    style={{
                      WebkitMaskImage: `url('${logoPath}')`,
                      WebkitMaskPosition: 'center',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      height: `${logoScale}%`,
                      maskImage: `url('${logoPath}')`,
                      maskPosition: 'center',
                      maskRepeat: 'no-repeat',
                      maskSize: 'contain',
                      width: `${logoScale}%`,
                    }}
                  >
                    <ShaderCanvas
                      canvasRef={materialCanvasRef}
                      colorA={colorB}
                      colorB={colorA}
                      key={`material-${preset.id}-${customVersion}`}
                      onError={setError}
                      parameters={parameters}
                      paused={paused}
                      preset={preset}
                      speed={speed}
                    />
                  </div>
                ) : (
                  <img
                    alt={`${identity.name} logo`}
                    className='object-contain drop-shadow-[0_2px_20px_rgba(0,0,0,0.18)]'
                    src={logoPath}
                    style={{ height: `${logoScale}%`, width: `${logoScale}%` }}
                  />
                )}
              </div>
              <div className='pointer-events-none absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest text-white/60 mix-blend-difference'>
                {preset.name} / WebGL
              </div>
            </div>
            <div className='flex flex-wrap items-start justify-between gap-4 border-x border-b border-border bg-background p-4'>
              <div>
                <p className='text-sm font-semibold'>{preset.name}</p>
                <p className='mt-1 max-w-xl text-xs leading-5 text-muted-foreground'>{preset.description}</p>
              </div>
              <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                {identity.name} / {ratio} / {speed.toFixed(2)}×
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
