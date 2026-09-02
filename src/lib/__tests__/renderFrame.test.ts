import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';
import { DEFAULT_MATERIAL_FINISH } from '../materialFinish';
import {
  canCompositeShaderDirectly,
  hasAnimatedShaderBackgrounds,
  renderFrame,
  resolveDrawableImageSize,
  type AnimationPackageId,
  type RenderConfig,
  type StudioSource,
} from '../renderFrame';

describe('resolveDrawableImageSize', () => {
  it('rejects a shader canvas until it has drawable dimensions', () => {
    const canvas = { height: 0, width: 0 } as HTMLCanvasElement;

    expect(resolveDrawableImageSize(canvas, 1_000, 300)).toBeNull();
  });

  it('returns the live canvas dimensions once the renderer has drawn', () => {
    const canvas = { height: 328, width: 1_099 } as HTMLCanvasElement;

    expect(resolveDrawableImageSize(canvas, 1_000, 300)).toEqual({ height: 328, width: 1_099 });
  });
});

const shaderBackground = {
  angle: 0,
  colorA: '#111111',
  colorB: '#555555',
  colorC: '#FFFFFF',
  materialId: 'paper-dithering-swirl' as const,
  materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
  style: 'shader' as const,
};

function textSource(id: string): StudioSource {
  return { background: shaderBackground, id, kind: 'text', text: id };
}

function renderConfig(overrides: Partial<RenderConfig> = {}): RenderConfig {
  return {
    alignX: 0,
    alignY: 0,
    background: '#111111',
    backgroundAngle: 0,
    backgroundSecondary: '#555555',
    backgroundStyle: 'shader',
    backgroundTransition: 'crossfade',
    bezier: [0.4, 0, 0.2, 1],
    blur: 8,
    fit: 'contain',
    fontSize: 24,
    fontWeight: 600,
    foreground: '#FFFFFF',
    height: 100,
    packageId: 'morph-fade',
    scale: 1,
    width: 200,
    ...overrides,
  };
}

function createRenderContext() {
  const gradient = {
    addColorStop: vi.fn(),
  } as Pick<CanvasGradient, 'addColorStop'> as CanvasGradient;
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    canvas: { height: 100, width: 200 } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement,
    clip: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    filter: 'none',
    font: '',
    globalAlpha: 1,
    lineWidth: 1,
    measureText: vi.fn((text: string) => ({
      width: Math.max(1, text.length * 20),
    } as Pick<TextMetrics, 'width'> as TextMetrics)),
    rect: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    strokeRect: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    translate: vi.fn(),
  } as Pick<
    CanvasRenderingContext2D,
    | 'arc'
    | 'beginPath'
    | 'canvas'
    | 'clip'
    | 'createLinearGradient'
    | 'createRadialGradient'
    | 'drawImage'
    | 'fill'
    | 'fillRect'
    | 'fillStyle'
    | 'fillText'
    | 'filter'
    | 'font'
    | 'globalAlpha'
    | 'lineWidth'
    | 'measureText'
    | 'rect'
    | 'restore'
    | 'roundRect'
    | 'rotate'
    | 'save'
    | 'scale'
    | 'strokeRect'
    | 'stroke'
    | 'strokeStyle'
    | 'textAlign'
    | 'textBaseline'
    | 'translate'
  > as CanvasRenderingContext2D;
  return { context, gradient };
}

describe('direct shader compositing', () => {
  it('detects shader backgrounds that need continuously sampled hold frames', () => {
    expect(hasAnimatedShaderBackgrounds([textSource('a')])).toBe(true);
    expect(hasAnimatedShaderBackgrounds([{ id: 'plain', kind: 'text', text: 'Plain' }])).toBe(false);
  });

  it('uses the live GPU layer when adjacent frames share an unfinished sequence shader', () => {
    expect(canCompositeShaderDirectly(textSource('a'), textSource('b'), {})).toBe(true);
  });

  it('keeps 2D compositing for overrides and backdrop-dependent finishes', () => {
    expect(canCompositeShaderDirectly(textSource('a'), textSource('b'), { b: true })).toBe(false);
    expect(canCompositeShaderDirectly(
      { ...textSource('a'), finish: { ...DEFAULT_MATERIAL_FINISH, glassEnabled: true } },
      textSource('b'),
      {}
    )).toBe(false);
    expect(canCompositeShaderDirectly(undefined, textSource('b'), {})).toBe(false);
    expect(canCompositeShaderDirectly(textSource('a'), undefined, {})).toBe(false);
    expect(canCompositeShaderDirectly(
      textSource('a'),
      {
        ...textSource('b'),
        background: { ...shaderBackground, materialId: 'shadergradient-prismatic-sphere' },
      },
      {}
    )).toBe(false);
  });

  it('can render only foreground content over a directly composited shader', () => {
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const context = {
      canvas: { height: 100, width: 200 },
      fillRect,
      fillText,
      measureText: () => ({ width: 40 }),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const config = renderConfig();

    renderFrame(
      context,
      [textSource('a')],
      config,
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 },
      { omitBackground: true }
    );

    expect(fillRect).not.toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith('a', 0, 0);
  });

  it('renders every motion package through the shared source transform', () => {
    const packages: AnimationPackageId[] = [
      'blur-swipe',
      'crossfade',
      'drift-fade',
      'flip-fade',
      'morph-fade',
      'rise-fade',
      'rotate-fade',
      'scale-fade',
      'slide-fade',
      'spring-pop',
      'zoom-through',
    ];
    const { context } = createRenderContext();

    for (const packageId of packages) {
      renderFrame(
        context,
        [
          { ...textSource('a'), alignX: -0.2, alignY: 0.3, opacity: 0.8, rotation: 4, scale: 0.9 },
          textSource('b'),
        ],
        renderConfig({ packageId }),
        { elapsedMs: 120, index: 0, nextIndex: 1, phase: 'transition', progress: 0.42 },
        { omitBackground: true }
      );
    }

    expect(context.fillText).toHaveBeenCalledTimes(packages.length * 2);
    expect(context.translate).toHaveBeenCalled();
    expect(context.rotate).toHaveBeenCalled();
    expect(context.scale).toHaveBeenCalled();
  });

  it('renders type-delete graphemes in both directions and falls back for image pairs', () => {
    const { context } = createRenderContext();
    const config = renderConfig({ packageId: 'type-delete' });
    renderFrame(
      context,
      [
        { id: 'current', kind: 'text', text: 'A👩‍💻B' },
        { id: 'next', kind: 'text', text: 'Next' },
      ],
      config,
      { elapsedMs: 50, index: 0, nextIndex: 1, phase: 'transition', progress: 0.25 },
      { omitBackground: true }
    );
    renderFrame(
      context,
      [
        { id: 'current', kind: 'text', text: 'Current' },
        { id: 'next', kind: 'text', text: 'N👨‍👩‍👧‍👦X' },
      ],
      config,
      { elapsedMs: 150, index: 0, nextIndex: 1, phase: 'transition', progress: 0.75 },
      { omitBackground: true }
    );

    const image = { height: 50, width: 100 } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement;
    renderFrame(
      context,
      [
        { height: 50, id: 'image', image, kind: 'image', name: 'Image', width: 100 },
        { id: 'text', kind: 'text', text: 'Text' },
      ],
      config,
      { elapsedMs: 200, index: 0, nextIndex: 1, phase: 'transition', progress: 0.5 },
      { omitBackground: true }
    );

    expect(context.fillText).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalled();
  });

  it('renders empty, solid, gradient, shader-image, wipe, radial, and finished backgrounds', () => {
    const { context, gradient } = createRenderContext();
    const config = renderConfig({ backgroundStyle: 'solid' });
    renderFrame(
      context,
      [],
      config,
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 }
    );

    const finish = {
      ...DEFAULT_MATERIAL_FINISH,
      borderEnabled: true,
      glassEnabled: true,
      reflectionEnabled: true,
      reflectionOpacity: 40,
      shadowEnabled: true,
      shadowOpacity: 40,
    };
    const solid: StudioSource = {
      background: { ...shaderBackground, colorA: '#181818', finish, style: 'solid' },
      id: 'solid',
      kind: 'text',
      text: 'Solid',
    };
    const gradientSource: StudioSource = {
      background: { ...shaderBackground, angle: 45, style: 'gradient' },
      id: 'gradient',
      kind: 'text',
      text: 'Gradient',
    };
    for (const backgroundTransition of ['crossfade', 'wipe', 'radial'] as const) {
      renderFrame(
        context,
        [solid, gradientSource],
        renderConfig({ backgroundTransition }),
        { elapsedMs: 100, index: 0, nextIndex: 1, phase: 'transition', progress: 0.5 }
      );
    }

    const shaderImage = { height: 40, width: 80 } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement;
    renderFrame(
      context,
      [{
        ...textSource('image-background'),
        background: { ...shaderBackground, image: shaderImage },
      }],
      renderConfig(),
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 }
    );

    expect(context.fillRect).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledWith(shaderImage, 0, 0, 200, 100);
    expect(context.rect).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(context.strokeRect).toHaveBeenCalled();
    expect(gradient.addColorStop).toHaveBeenCalled();
  });

  it('uses cover and contain geometry for image sources', () => {
    const { context } = createRenderContext();
    const image = { height: 100, width: 100 } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement;
    const source: StudioSource = {
      fit: 'contain',
      height: 100,
      id: 'image',
      image,
      kind: 'image',
      name: 'Image',
      width: 100,
    };
    renderFrame(
      context,
      [source],
      renderConfig({ fit: 'cover' }),
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 },
      { omitBackground: true }
    );
    renderFrame(
      context,
      [{ ...source, fit: 'cover' }],
      renderConfig({ fit: 'contain' }),
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 },
      { omitBackground: true }
    );

    expect(context.drawImage).toHaveBeenCalledTimes(2);
  });

  it('captures the canvas backdrop and composites finished source layers', () => {
    const { context } = createRenderContext();
    const createdCanvases: HTMLCanvasElement[] = [];
    vi.stubGlobal('document', {
      createElement: vi.fn(() => {
        const { context: layerContext } = createRenderContext();
        const canvas = {
          height: 0,
          width: 0,
        } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement;
        Object.defineProperty(canvas, 'getContext', {
          value: (contextId: string) => contextId === '2d' ? layerContext : null,
        });
        createdCanvases.push(canvas);
        return canvas;
      }),
    });

    try {
      renderFrame(
        context,
        [{
          ...textSource('glass'),
          finish: {
            ...DEFAULT_MATERIAL_FINISH,
            borderEnabled: true,
            glassEnabled: true,
            shadowEnabled: true,
          },
        }],
        renderConfig(),
        { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 }
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(createdCanvases).toHaveLength(3);
    expect(createdCanvases[0]).toMatchObject({ height: 100, width: 200 });
    expect(context.drawImage).toHaveBeenCalled();
    expect(context.roundRect).toHaveBeenCalled();
  });
});
