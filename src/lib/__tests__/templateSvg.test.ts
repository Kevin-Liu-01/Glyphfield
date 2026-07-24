import { describe, expect, it } from 'vitest';

import { buildTemplateSvg } from '../templateSvg';

const baseOptions = {
  background: '#FFFFFF',
  brandLogo: 'data:image/svg+xml;base64,BRAND',
  eyebrow: 'BRAND / STUDIO',
  foreground: '#181818',
  height: 600,
  identityName: 'Brand',
  kind: 'partnership' as const,
  partnerLogo: 'data:image/svg+xml;base64,PARTNER',
  texture: 'white' as const,
  title: 'Built better, together.',
  website: 'brand.test',
  width: 1200,
};

describe('buildTemplateSvg', () => {
  it('embeds real brand and partner logo assets in a partnership export', () => {
    const svg = buildTemplateSvg(baseOptions);

    expect(svg).toContain(`href="${baseOptions.brandLogo}"`);
    expect(svg).toContain(`href="${baseOptions.partnerLogo}"`);
    expect(svg).not.toContain('>PARTNER<');
  });

  it('keeps a real brand logo on slide exports and escapes content', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      height: 900,
      kind: 'slides',
      title: 'A&B <launch>',
      width: 1600,
    });

    expect(svg).toContain(`href="${baseOptions.brandLogo}"`);
    expect(svg).toContain('A&amp;B &lt;launch&gt;');
    expect(svg).not.toContain('A&B <launch>');
  });

  it('exports background opacity and independent artwork placement', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      backgroundImage: 'data:image/png;base64,BACKGROUND',
      backgroundImageOpacity: 32,
      backgroundImageScale: 120,
      backgroundImageX: 10,
      backgroundImageY: -5,
      brandLogoScale: 150,
      brandLogoX: 12,
      partnerLogoScale: 50,
      partnerLogoX: -10,
      texture: 'grid',
      textureOpacity: 25,
    });

    expect(svg).toContain('href="data:image/png;base64,BACKGROUND"');
    expect(svg).toContain('opacity="0.32"');
    expect(svg).toContain('fill="url(#texture)" opacity="0.25"');
    expect(svg).toContain(`href="${baseOptions.brandLogo}" x="62"`);
    expect(svg).toContain('width="204"');
    expect(svg).toContain(`href="${baseOptions.partnerLogo}" x="950"`);
    expect(svg).toContain('width="104"');
  });

  it('renders distinct slide-library layouts into exports', () => {
    const metrics = buildTemplateSvg({
      ...baseOptions,
      body: 'Coverage\nMarkets\nLaunch',
      height: 900,
      kind: 'slides',
      slideLayout: 'metrics',
      width: 1600,
    });
    const timeline = buildTemplateSvg({
      ...baseOptions,
      body: 'Discover\nDesign\nBuild\nShip',
      height: 900,
      kind: 'slides',
      slideLayout: 'timeline',
      width: 1600,
    });
    const chart = buildTemplateSvg({
      ...baseOptions,
      height: 900,
      kind: 'slides',
      slideLayout: 'chart',
      width: 1600,
    });

    expect(metrics).toContain('98.7%');
    expect(metrics).toContain('Coverage');
    expect(timeline).toContain('Discover');
    expect(timeline).toContain('Ship');
    expect(timeline).not.toBe(metrics);
    expect(chart).toContain('+42%');
    expect(chart).not.toBe(metrics);
  });

  it('embeds the selected identity font and caps its exported weight', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      fontData: 'data:font/ttf;base64,FONT',
      fontFamily: 'Identity Display',
      fontWeight: 650,
    });

    expect(svg).toContain("font-family:'TemplateBrand'");
    expect(svg).toContain('font-family:"TemplateBrand"');
    expect(svg).toContain('data:font/ttf;base64,FONT');
    expect(svg).toContain('font-weight:550');
  });

  it('exports canvas transforms and foreground layer order', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      brandScale: 1.25,
      brandX: 18,
      brandY: -9,
      contentScale: 0.8,
      contentX: -24,
      footerY: 12,
      layerOrder: ['footer', 'brand', 'content'],
    });

    expect(svg).toContain('data-layer="brand" transform="translate(18 -9)');
    expect(svg).toContain('scale(1.25)');
    expect(svg).toContain('data-layer="content" transform="translate(-24 0)');
    expect(svg).toContain('data-layer="footer" transform="translate(0 12)');
    expect(svg.indexOf('data-layer="footer"')).toBeLessThan(svg.indexOf('data-layer="brand"'));
    expect(svg.indexOf('data-layer="brand"')).toBeLessThan(svg.indexOf('data-layer="content"'));
  });
});
