import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '../brandIdentity';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { moodboardAssets } from '../moodboard';
import { buildMoodboardSvg } from '../moodboardSvg';

const artAssetIds = [
  'library-overview',
  'library-editorial',
  'library-detail',
  'library-atmosphere',
  'library-campaign',
  'library-interface',
  'library-motion',
  'library-hero',
  'library-workflow',
  'library-system',
  'library-material',
  'library-signal',
] as const;

const assets = {
  accentFont: 'data:font/woff2;base64,ACCENT',
  artAssets: artAssetIds.map((id) => ({
    id,
    label: id.replace('library-', ''),
    path: `data:image/svg+xml;base64,${id}`,
    type: 'image' as const,
  })),
  bodyFont: 'data:font/woff2;base64,BODY',
  codeFont: 'data:font/woff2;base64,CODE',
  displayFont: 'data:font/woff2;base64,DISPLAY',
  logoMarks: ['data:image/svg+xml;base64,LOGO-DARK', 'data:image/svg+xml;base64,LOGO-LIGHT'],
  markDark: 'data:image/svg+xml;base64,DARK',
  markLight: 'data:image/svg+xml;base64,LIGHT',
};

describe('buildMoodboardSvg', () => {
  it('embeds each brand typography role without interface-font fallbacks', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system');

    expect(svg).toContain("font-family:'Brand Display'");
    expect(svg).toContain("font-family:'Brand Body'");
    expect(svg).toContain("font-family:'Brand Accent'");
    expect(svg).toContain("font-family:'Brand Code'");
    expect(svg).toContain(assets.displayFont);
    expect(svg).toContain(assets.bodyFont);
    expect(svg).not.toContain('Arial');
    expect(svg).not.toContain('Moodboard Sans');
  });

  it('renders a simple six-panel identity contact sheet from eligible assets', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system');

    expect(svg.match(/class="application-panel/g)).toHaveLength(6);
    expect(svg).toContain('data-board-mode="system"');
    expect(svg).toContain('data-board-recipe="monochrome-language"');
    expect(svg).toContain('data-panel="logo"');
    expect(svg).toContain('data-panel="type"');
    expect(svg).toContain('data-panel="palette"');
    expect(svg).toContain('data-panel="system"');
    expect(svg).toContain('data:image/svg+xml;base64,library-system');
    expect(svg).toContain('<rect width="1600" height="2000" fill="#1A1A1A"/>');
    expect(svg).toContain('id="gt-fine-dither"');
    expect(svg).not.toContain('preserveAspectRatio="xMidYMid slice"');
    expect(svg).not.toContain('LIVE REFERENCE');
    expect(svg).not.toContain('CAPTURED');
  });

  it('renders a presentation-ready application board with side-by-side image compositions', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'showcase');

    expect(svg).toContain('data-board-mode="showcase"');
    expect(svg.match(/class="application-panel/g)).toHaveLength(6);
    expect(svg).toContain('data-panel="hero"');
    expect(svg).toContain('data-panel="triptych"');
    expect(svg).toContain('data-panel="logo"');
    expect(svg).toContain('data-panel="application"');
    expect(svg).toContain('data-panel="system"');
    expect(svg).toContain('<rect width="1600" height="900" fill="#C8C8C2"/>');
    expect(svg).toContain('id="gt-hero-field"');
    expect(svg).toContain('id="gt-hero-dither"');
    expect(svg).toContain('Language, in sync.');
    expect(svg).not.toContain('ONE SOURCE / EVERY LANGUAGE');
    expect(svg).not.toContain('id="gt-hero-fade"');
    expect(svg).toContain('preserveAspectRatio="xMinYMid meet"');
    expect(svg).not.toContain('opacity=".94"');
    expect(svg).not.toContain('/screenshots/');
    expect(svg).not.toContain('/references/');
  });

  it('renders every system view, source asset, and generated application in the complete catalog', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'catalog');

    expect(svg).toContain('data-board-mode="catalog"');
    expect(svg.match(/class="application-panel/g)).toHaveLength(9);
    expect(svg.match(/class="source-asset"/g)).toHaveLength(assets.artAssets.length);
    expect(svg.match(/class="generated-application"/g)).toHaveLength(
      GT_BRAND_IDENTITY.applications.length
    );
    expect(svg).toContain('data-panel="source-catalog"');
    expect(svg).toContain('data-panel="application-catalog"');

    for (const application of GT_BRAND_IDENTITY.applications) {
      expect(svg).toContain(`data-application="${application.id}"`);
    }
  });

  it('escapes identity copy before placing it in the SVG', () => {
    const svg = buildMoodboardSvg(
      { ...GT_BRAND_IDENTITY, id: 'custom', tagline: 'A&B <Studio>' },
      assets,
      'showcase'
    );

    expect(svg).toContain('A&amp;B &lt;Studio&gt;');
    expect(svg).not.toContain('A&B <Studio>');
  });

  it.each(BUILT_IN_BRAND_IDENTITIES.map((identity) => [identity.name, identity] as const))(
    'renders both canonical %s boards from original or source-native assets',
    (_name, identity) => {
      const boardAssets = moodboardAssets(identity);
      const logoMarks = identity.assets
        .filter((asset) => asset.type === 'logo')
        .map((asset) => asset.path);

      for (const composition of ['showcase', 'system', 'catalog'] as const) {
        const svg = buildMoodboardSvg(
          identity,
          {
            artAssets: boardAssets,
            logoMarks,
            markDark: logoMarks[0],
            markLight: logoMarks[1],
          },
          composition
        );

        expect(svg.match(/class="application-panel/g)).toHaveLength(
          composition === 'catalog' ? 9 : 6
        );
        expect(svg).toContain(`data-brand="${identity.id}"`);
        expect(svg).toContain(`data-board-mode="${composition}"`);
        expect(svg).not.toContain(' slice"');
        expect(svg).not.toContain('opacity=".94"');
        expect(svg).not.toMatch(/\/(?:references|screenshots)\//i);
        expect(svg).not.toMatch(/(?:screen[-_ ]?shot|capture|homepage)/i);
      }
    }
  );
});
