import { describe, expect, it } from 'vitest';

import { DEFAULT_LOGO_APPEARANCE } from '../logoAppearance';
import { buildOpenGraphSvg, type OpenGraphSvgOptions } from '../openGraphSvg';

function options(overrides: Partial<OpenGraphSvgOptions> = {}): OpenGraphSvgOptions {
  return {
    background: '#FFFFFF',
    backgroundImage: null,
    backgroundOpacity: 100,
    backgroundScale: 100,
    backgroundX: 0,
    backgroundY: 0,
    fontData: null,
    fontFamily: 'Switzer',
    fontWeight: 500,
    foreground: '#111216',
    identityId: 'gt',
    logoAppearance: DEFAULT_LOGO_APPEARANCE,
    logoScale: 100,
    logoSource: 'data:image/svg+xml;base64,TE9HTw==',
    logoX: 0,
    logoY: 0,
    panelColor: '#101010',
    panelForeground: '#FFFFFF',
    promiseLines: ['One source of truth.', 'Every language.'],
    proof: 'generaltranslation.com',
    proofChipBackground: '#C8FF6A',
    proofChipForeground: '#111216',
    recipe: 'translation-frame',
    titleFontSize: 56,
    titleLineHeight: 58,
    titleLines: ['Every language.', 'One source.'],
    usesMintlifyAtmosphere: false,
    usesTailwindAtmosphere: false,
    website: 'generaltranslation.com',
    ...overrides,
  };
}

describe('OpenGraph SVG renderer', () => {
  it('invariant_live_preview_and_export_share_one_fixed_1200_by_630_scene', () => {
    const svg = buildOpenGraphSvg(options());

    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('data:image/svg+xml;base64,TE9HTw==');
    expect(svg).toContain('Every language.');
    expect(svg).toContain('أهلاً وسهلاً');
  });

  it('renders the Mintlify and Tailwind atmospheres in the exported scene', () => {
    const mint = buildOpenGraphSvg(options({
      identityId: 'mintlify',
      recipe: 'knowledge-beam',
      usesMintlifyAtmosphere: true,
    }));
    const tailwind = buildOpenGraphSvg(options({
      identityId: 'tailwind',
      recipe: 'utility-wave',
      usesTailwindAtmosphere: true,
    }));

    expect(mint).toContain('id="og-mint-beam"');
    expect(mint).toContain('stroke="url(#og-mint-beam)"');
    expect(tailwind).toContain('id="og-tailwind-current"');
    expect(tailwind).toContain('stroke="url(#og-tailwind-current)"');
  });

  it('keeps embedded media and fonts self-contained for PNG rasterization', () => {
    const svg = buildOpenGraphSvg(options({
      backgroundImage: 'data:image/png;base64,Qkc=',
      fontData: 'data:font/woff2;base64,Rk9OVA==',
    }));

    expect(svg).toContain('data:image/png;base64,Qkc=');
    expect(svg).toContain('data:font/woff2;base64,Rk9OVA==');
    expect(svg).toContain("font-family:'StudioCustom'");
  });
});
