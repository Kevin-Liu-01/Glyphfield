import { describe, expect, it, vi } from 'vitest';

import {
  buildImageSvgFilter,
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
  hasLogoAppearanceEffects,
  logoAppearanceCssFilter,
  resolveLogoSvgFilterModel,
} from '../logoAppearance';

function appearanceContext(width = 4, height = 4) {
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const getImageData = vi.fn(() => ({
    colorSpace: 'srgb' as const,
    data: pixels.slice(),
    height,
    width,
  }));
  const putImageData = vi.fn();
  const context = {
    canvas: { height, width } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement,
    drawImage: vi.fn(),
    filter: 'none',
    getImageData,
    globalAlpha: 1,
    putImageData,
    restore: vi.fn(),
    save: vi.fn(),
  } as Pick<
    CanvasRenderingContext2D,
    'canvas' | 'drawImage' | 'filter' | 'getImageData' | 'globalAlpha' | 'putImageData' | 'restore' | 'save'
  > as CanvasRenderingContext2D;
  return { context, getImageData, putImageData };
}

function canvasWithContext(context: CanvasRenderingContext2D | null): HTMLCanvasElement {
  const canvas = {
    height: context?.canvas.height ?? 0,
    width: context?.canvas.width ?? 0,
  } as Pick<HTMLCanvasElement, 'height' | 'width'> as HTMLCanvasElement;
  Object.defineProperty(canvas, 'getContext', {
    value: (contextId: string) => contextId === '2d' ? context : null,
  });
  return canvas;
}

describe('logo appearance', () => {
  it('keeps the default shader mask on the direct compositing path', () => {
    expect(hasLogoAppearanceEffects(DEFAULT_LOGO_APPEARANCE)).toBe(false);
    expect(hasLogoAppearanceEffects({
      ...DEFAULT_LOGO_APPEARANCE,
      ditherEnabled: true,
    })).toBe(true);
    expect(hasLogoAppearanceEffects({
      ...DEFAULT_LOGO_APPEARANCE,
      shadowEnabled: true,
      shadowOpacity: 0,
    })).toBe(false);
  });

  it('builds an alpha-aware CSS treatment for inversion, outline, and shadow', () => {
    const filter = logoAppearanceCssFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderColor: '#FF0000',
      borderEnabled: true,
      borderOpacity: 50,
      invert: true,
      shadowEnabled: true,
    });

    expect(filter).toContain('invert(1)');
    expect(filter).toContain('drop-shadow(0px 8px 18px #00000047)');
    expect(filter).toContain('drop-shadow(0.5px 0 0 #FF000080)');
    expect(filter).toContain('drop-shadow(-0.5px -0.5px 0 #FF000080)');
  });

  it('builds an SVG filter around the source alpha instead of its bounding box', () => {
    const filter = buildLogoSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderEnabled: true,
      invert: true,
      shadowEnabled: true,
    }, '#181818', 'test-logo');

    expect(filter).toContain('id="test-logo"');
    expect(filter).toContain('<feMorphology in="SourceAlpha"');
    expect(filter).toContain('<feComponentTransfer in="colored"');
    expect(filter).toContain('<feGaussianBlur in="inverted"');
    expect(filter).toContain('<feComposite in="shadow-color" in2="shadow-offset" operator="in" result="shadow"/>');
    expect(filter).not.toContain('<feDropShadow');
  });

  it('adds a configurable dither pass before outline and shadow composition', () => {
    const filter = buildLogoSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      ditherAmount: 80,
      ditherAngle: 45,
      ditherEnabled: true,
      ditherScale: 8,
      shadowEnabled: true,
    }, '#FFFFFF', 'dither-logo');

    expect(filter).toContain('result="dither-noise"');
    expect(filter).toContain('result="dithered"');
    expect(filter).toContain('<feGaussianBlur in="dithered"');
    expect(filter).toContain('tableValues="0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1"');
  });

  it('filters live shader and image content without replacing its colors', () => {
    const filter = buildImageSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderEnabled: true,
      ditherEnabled: true,
      shadowEnabled: true,
    }, 'live-content');

    expect(filter).toContain('id="live-content"');
    expect(filter).toContain('<feComposite in="SourceGraphic" in2="dither-threshold"');
    expect(filter).toContain('<feMorphology in="SourceAlpha"');
    expect(buildImageSvgFilter(DEFAULT_LOGO_APPEARANCE)).not.toContain('<feTurbulence');
    expect(buildImageSvgFilter(DEFAULT_LOGO_APPEARANCE)).not.toContain('<feGaussianBlur');
  });

  it('can render only silhouette effects for a shader-filled mark', () => {
    const filter = buildLogoSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderEnabled: true,
      shadowEnabled: true,
    }, '#FFFFFF', 'silhouette-effects', false);

    expect(filter).toContain('<feMorphology in="SourceAlpha"');
    expect(filter).toContain('<feGaussianBlur in="SourceAlpha"');
    expect(filter).toContain('<feMergeNode in="shadow"/>');
    expect(filter).toContain('<feMergeNode in="outline"/>');
    expect(filter).not.toContain('<feMergeNode in="colored"/>');
  });

  it('uses the same resolved source chain for declarative previews and exported filters', () => {
    const settings = {
      ...DEFAULT_LOGO_APPEARANCE,
      ditherAmount: 64,
      ditherAngle: 30,
      ditherEnabled: true,
      ditherScale: 5,
      invert: true,
    };
    const logoModel = resolveLogoSvgFilterModel(settings, false);
    const imageModel = resolveLogoSvgFilterModel(settings, true);

    expect(logoModel.source).toBe('colored');
    expect(logoModel.filteredSource).toBe('inverted');
    expect(logoModel.outputSource).toBe('dithered');
    expect(imageModel.source).toBe('SourceGraphic');
    expect(imageModel.filteredSource).toBe('inverted');
    expect(imageModel.outputSource).toBe('dithered');
    expect(buildLogoSvgFilter(settings, '#FFFFFF')).toContain(
      `baseFrequency="${logoModel.ditherFrequencyX.toFixed(4)} ${logoModel.ditherFrequencyY.toFixed(4)}"`
    );
    expect(buildImageSvgFilter(settings)).toContain(
      `baseFrequency="${imageModel.ditherFrequencyX.toFixed(4)} ${imageModel.ditherFrequencyY.toFixed(4)}"`
    );
  });

  it('draws, inverts, clamps opacity, and dithers the same layer before compositing', () => {
    const { context: parent } = appearanceContext();
    const { context: layerContext, putImageData } = appearanceContext();
    const layer = canvasWithContext(layerContext);
    const source = canvasWithContext(null);
    vi.stubGlobal('document', { createElement: vi.fn(() => layer) });

    try {
      drawLogoAppearanceLayer(parent, source, 0, 0, 4, 4, {
        ...DEFAULT_LOGO_APPEARANCE,
        ditherAmount: 100,
        ditherAngle: 45,
        ditherEnabled: true,
        ditherScale: 1,
        invert: true,
      }, 2);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(layerContext.globalAlpha).toBe(1);
    expect(layerContext.filter).toBe('invert(1)');
    expect(layerContext.drawImage).toHaveBeenCalledWith(source, 0, 0, 4, 4);
    expect(putImageData).toHaveBeenCalled();
    const dithered = putImageData.mock.calls[0]?.[0];
    expect(Array.from(dithered?.data ?? []).filter((_, index) => index % 4 === 3))
      .toContain(0);
    expect(parent.drawImage).toHaveBeenCalledWith(layer, 0, 0);
  });

  it('skips dither work outside the canvas and safely handles unavailable layer contexts', () => {
    const { context: parent } = appearanceContext();
    const { context: outsideContext, getImageData } = appearanceContext();
    const canvases = [canvasWithContext(outsideContext), canvasWithContext(null)];
    vi.stubGlobal('document', { createElement: vi.fn(() => canvases.shift()!) });

    try {
      drawLogoAppearanceLayer(parent, canvasWithContext(null), 10, 10, 4, 4, {
        ...DEFAULT_LOGO_APPEARANCE,
        ditherEnabled: true,
      });
      drawLogoAppearanceLayer(parent, canvasWithContext(null), 0, 0, 4, 4, DEFAULT_LOGO_APPEARANCE);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(getImageData).not.toHaveBeenCalled();
  });
});
