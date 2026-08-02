import { describe, expect, it } from 'vitest';

import { buildBackgroundSvg, DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';

describe('buildBackgroundSvg', () => {
  it('builds configurable gradient, grain, pattern, and logo layers', () => {
    const svg = buildBackgroundSvg(
      {
        ...DEFAULT_BACKGROUND_SETTINGS,
        grain: 36,
        logoOpacity: 42,
        logoX: 10,
        logoY: -5,
        pattern: 'dots',
        patternOpacity: 42,
        style: 'grain-gradient',
      },
      { logo: 'data:image/svg+xml;base64,LOGO', name: 'GT' }
    );

    expect(svg).toContain('linearGradient');
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('pattern-dots');
    expect(svg).toContain('opacity="0.42"');
    expect(svg).toContain('x="615"');
    expect(svg).toContain('y="232.5"');
    expect(svg).toContain('data:image/svg+xml;base64,LOGO');
  });

  it('renders an ordered dither field without an external shader dependency', () => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      ditherMatrix: 4,
      style: 'dither',
    });

    expect(svg).toContain('data-dither-matrix="4"');
    expect(svg).toContain('data-dither-shape="dots"');
    expect(svg.match(/<circle /g)?.length).toBeGreaterThan(100);
  });

  it('renders band and square-dither recipes as portable SVG', () => {
    const mesh = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorC: '#7BFFD9',
      gradient: 'mesh',
      relief: 42,
      style: 'grain-gradient',
    });
    const dither = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      ditherShape: 'squares',
      style: 'dither',
    });

    expect(mesh).toContain('data-gradient-layout="bands"');
    expect(mesh).toContain('data-band-count="15"');
    expect(mesh).toContain('data-band-geometry="full-height"');
    expect(mesh.match(/data-band-index=/g)?.length).toBe(15);
    expect(mesh).toContain('id="band-strip-0"');
    expect(mesh).toContain('height="750"');
    expect(mesh).not.toContain('clip-path=');
    expect(mesh).not.toContain('<path');
    expect(mesh).not.toContain('id="surface-relief"');
    expect(mesh).not.toContain('filter="url(#surface-relief)"');
    expect(dither).toContain('data-dither-shape="squares"');
    expect(dither.match(/<rect /g)?.length).toBeGreaterThan(100);
  });

  it.each([
    ['linear', 'linear'],
    ['radial', 'radial'],
    ['mesh', 'bands'],
    ['orbit', 'orbit'],
    ['wave', 'wave'],
    ['bloom', 'bloom'],
  ] as const)('renders the %s gradient as a portable mode-specific field', (gradient, layout) => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      gradient,
      relief: 64,
    });

    expect(svg).toContain(`data-gradient-layout="${layout}"`);
    if (gradient !== 'mesh') expect(svg).toContain('color-interpolation="sRGB"');
    expect(svg).not.toContain('filter="url(#surface-relief)"');
  });

  it.each(['linear', 'orbit', 'wave'] as const)(
    'interpolates intermediate colors through the %s field',
    (gradient) => {
      const svg = buildBackgroundSvg({
        ...DEFAULT_BACKGROUND_SETTINGS,
        colorA: '#000000',
        colorB: '#FFFFFF',
        colorC: '#808080',
        gradient,
      });

      expect(svg).toContain('#404040');
      expect(svg).toContain('#BFBFBF');
      expect(svg.match(/<stop /g)?.length).toBeGreaterThanOrEqual(17);
    }
  );

  it('uses a focused aperture instead of the linear color ramp for radial fields', () => {
    const svg = buildBackgroundSvg({ ...DEFAULT_BACKGROUND_SETTINGS, gradient: 'radial' });

    expect(svg).toContain('id="radial-aperture"');
    expect(svg).toContain('id="radial-vignette"');
    expect(svg).not.toContain('id="surface-gradient"');
  });

  it('can render flat bands without gradient lighting', () => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorA: '#000000',
      colorB: '#FFFFFF',
      colorC: '#FFFFFF',
      gradient: 'mesh',
      lightingEnabled: false,
    });

    expect(svg).toContain('data-gradient-layout="bands"');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).not.toContain('id="band-gradient"');
    expect(svg).not.toContain('id="band-strip-0"');
  });

  it('renders orbit and wave as full background fields', () => {
    const orbit = buildBackgroundSvg({ ...DEFAULT_BACKGROUND_SETTINGS, gradient: 'orbit' });
    const wave = buildBackgroundSvg({ ...DEFAULT_BACKGROUND_SETTINGS, gradient: 'wave' });

    expect(orbit).toContain('id="orbit-primary"');
    expect(orbit).toContain('id="orbit-secondary"');
    expect(orbit).not.toContain('<ellipse');
    expect(wave).toContain('id="surface-gradient"');
    expect(wave).toContain('id="wave-gradient"');
    expect(wave.match(/<path /g)?.length).toBe(2);
    expect(wave).toContain('fill="url(#surface-gradient)"');
  });

  it.each(['fibers', 'speckles', 'topographic', 'crosshatch'] as const)(
    'renders the %s static surface texture as portable SVG',
    (pattern) => {
      const svg = buildBackgroundSvg({
        ...DEFAULT_BACKGROUND_SETTINGS,
        pattern,
        patternOpacity: 30,
      });

      expect(svg).toContain(`id="pattern-${pattern}"`);
      expect(svg).toContain(`fill="url(#pattern-${pattern})"`);
    }
  );

  it('lets band depth reach the top edge', () => {
    const bands = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      bandDepth: 100,
      gradient: 'mesh',
    });

    expect(bands).toContain('<stop offset="0.00" stop-color="#FFFFFF"/>');
  });

  it('composes a reusable identity asset below the logo', () => {
    const svg = buildBackgroundSvg(DEFAULT_BACKGROUND_SETTINGS, {
      asset: 'data:image/svg+xml;base64,FIELD',
      assetFit: 'contain',
      assetOpacity: 35,
      logo: 'data:image/svg+xml;base64,MARK',
      name: 'GT',
    });

    expect(svg).toContain('href="data:image/svg+xml;base64,FIELD"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('opacity="0.35"');
    expect(svg.indexOf('base64,FIELD')).toBeLessThan(svg.indexOf('base64,MARK'));
  });

  it('applies shape-aware outline and shadow effects to the exported logo', () => {
    const svg = buildBackgroundSvg(DEFAULT_BACKGROUND_SETTINGS, {
      logo: 'data:image/svg+xml;base64,MARK',
      logoAppearance: {
        borderColor: '#FF0000',
        borderEnabled: true,
        borderOpacity: 75,
        borderWidth: 4,
        ditherAmount: 72,
        ditherAngle: 24,
        ditherEnabled: false,
        ditherScale: 6,
        invert: false,
        shadowBlur: 24,
        shadowColor: '#000000',
        shadowEnabled: true,
        shadowOffsetX: 3,
        shadowOffsetY: 9,
        shadowOpacity: 40,
      },
      name: 'GT',
    });

    expect(svg).toContain('<feMorphology in="SourceAlpha" operator="dilate" radius="4"');
    expect(svg).toContain('<feDropShadow in="colored" dx="3" dy="9" stdDeviation="12"');
    expect(svg).toContain('<g filter="url(#background-logo)">');
  });

  it.each([
    'kerf-wood',
    'woven-wire',
    'perforated-metal',
    'carved-stone',
    'embossed-paper',
    'brushed-metal',
    'hammered-foil',
    'corrugated-polymer',
    'cork-composite',
    'frosted-glass',
  ] as const)('renders the %s physical surface as editable SVG relief', (surfaceMaterial) => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      surfaceDepth: 64,
      surfaceMaterial,
      surfaceMetallic: 72,
      surfaceOpenArea: 44,
      surfaceRoughness: 36,
      surfaceScale: 52,
    });

    expect(svg).toContain(`data-surface-material="${surfaceMaterial}"`);
    expect(svg).toContain('data-surface-depth="64"');
    expect(svg).toContain('data-surface-roughness="36"');
    expect(svg).toContain('data-surface-metallic="72"');
    expect(svg).toContain('data-surface-open-area="44"');
    expect(svg).toContain('id="physical-surface-pattern"');
    expect(svg).toContain('id="physical-surface-light"');
    expect(svg).toContain('<feDiffuseLighting');
    expect(svg).toContain('<feSpecularLighting');
  });

  it('omits physical surface filters for the smooth material', () => {
    const svg = buildBackgroundSvg(DEFAULT_BACKGROUND_SETTINGS);

    expect(svg).not.toContain('data-surface-material=');
    expect(svg).not.toContain('id="physical-surface-light"');
  });
});
