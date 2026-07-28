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

    expect(mesh).toContain('id="band-gradient"');
    expect(mesh).toContain('data-gradient-layout="bands"');
    expect(mesh).toContain('data-band-count="15"');
    expect(mesh.match(/data-band-index=/g)?.length).toBe(15);
    expect(mesh).toContain('id="surface-relief"');
    expect(mesh).not.toContain('<g filter="url(#surface-relief)">');
    expect(dither).toContain('data-dither-shape="squares"');
    expect(dither.match(/<rect /g)?.length).toBeGreaterThan(100);
  });

  it('can render flat bands without gradient lighting', () => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorA: '#000000',
      colorB: '#FFFFFF',
      gradient: 'mesh',
      lightingEnabled: false,
    });

    expect(svg).toContain('data-gradient-layout="bands"');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).not.toContain('fill="url(#band-gradient)"');
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
});
