import { describe, expect, it } from 'vitest';

import { buildTemplateSvg } from '../templateSvg';

const baseOptions = {
  background: '#FFFFFF',
  brandLogo: 'data:image/svg+xml;base64,BRAND',
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

  it('writes a partner name in its own uploaded font and keeps the lockup compact', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      partnerFontData: 'data:font/woff2;base64,LAUSANNE',
      partnerFontFamily: 'Lausanne',
      partnerFontWeight: 350,
      partnerGap: 18,
      partnerLetterSpacing: -1.1,
      partnerName: 'Ramp',
      partnerTreatment: 'text',
    });

    expect(svg).toContain("font-family:'TemplatePartner'");
    expect(svg).toContain('data:font/woff2;base64,LAUSANNE');
    expect(svg).toContain('data-template-partner="text"');
    expect(svg).toContain('class="template-partner-text" x="274"');
    expect(svg).toContain('font-weight="350"');
    expect(svg).toContain('letter-spacing="-1.1"');
    expect(svg).toContain('>Ramp</text>');
    expect(svg).not.toContain(`href="${baseOptions.partnerLogo}"`);
  });

  it('keeps the official partner logo while typesetting each headline brand independently', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      fontData: 'data:font/ttf;base64,SWITZER',
      fontFamily: 'Switzer',
      fontWeight: 500,
      partnerFontData: 'data:font/woff2;base64,LAUSANNE',
      partnerFontFamily: 'Lausanne',
      partnerFontWeight: 350,
      partnerLetterSpacing: -1.1,
      partnerName: 'Ramp',
      partnerTreatment: 'logo',
      title: 'General Translation × Ramp',
    });

    expect(svg).toContain(`href="${baseOptions.partnerLogo}"`);
    expect(svg).toContain('data-template-partner="logo"');
    expect(svg).toContain('data-template-headline="mixed"');
    expect(svg).toContain('<tspan class="template-headline-brand">General Translation</tspan>');
    expect(svg).toContain('<tspan class="template-headline-separator"> × </tspan>');
    expect(svg).toContain('<tspan class="template-headline-partner">Ramp</tspan>');
    expect(svg).toContain("font-family:'TemplateBrand'");
    expect(svg).toContain("font-family:'TemplatePartner'");
    expect(svg).toContain('.template-partner-text,.template-headline-partner');
    expect(svg).toContain('letter-spacing:-1.1px');
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
    expect(svg).not.toContain('ui-monospace');
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
    expect(svg).toContain(`href="${baseOptions.partnerLogo}" x="362"`);
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

  it('keeps every title word while centering title and statement slide layouts', () => {
    const title = buildTemplateSvg({
      ...baseOptions,
      height: 900,
      kind: 'slides',
      slideLayout: 'title',
      title: 'Code is the source of truth.',
      width: 1600,
    });
    const statement = buildTemplateSvg({
      ...baseOptions,
      height: 900,
      kind: 'slides',
      slideLayout: 'statement',
      title: 'Every language. One source.',
      width: 1600,
    });

    expect(title).toContain('data-text-block="slide-title" data-center-y="450"');
    expect(title).toContain('Code is the source of truth.');
    expect(statement).toContain('data-text-block="slide-statement" data-center-y="450"');
    expect(statement).toContain('data-line-count="2"');
    expect(statement).toContain('Every language.');
    expect(statement).toContain('One source.');
  });

  it('vertically centers the partnership headline without losing its mixed fonts', () => {
    const svg = buildTemplateSvg({
      ...baseOptions,
      title: 'General Translation × Ramp',
    });

    expect(svg).toContain('data-text-block="partnership-title" data-center-y="324"');
    expect(svg).toContain('<tspan class="template-headline-brand">General Translation</tspan>');
    expect(svg).toContain('<tspan class="template-headline-partner">Ramp</tspan>');
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
