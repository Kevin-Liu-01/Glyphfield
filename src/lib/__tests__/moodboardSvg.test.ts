import { describe, expect, it } from 'vitest';

import { brandFontAssets, GT_BRAND_IDENTITY } from '../brandIdentity';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { MOODBOARD_COMPOSITIONS, moodboardAssets } from '../moodboard';
import { defaultMoodboardTiles } from '../moodboardBoard';
import {
  buildMoodboardSvg,
  layoutMoodboard,
  moodboardFontFaceCss,
  moodboardPreviewAssets,
  renderMoodboardTile,
} from '../moodboardSvg';

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

const TILE_COUNTS = { campaign: 8, catalog: 12, showcase: 8, specimen: 8, system: 11 } as const;

describe('buildMoodboardSvg', () => {
  it('embeds each brand typography role under its real family without interface-font fallbacks', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system');

    expect(svg).toContain("font-family:'Rasmus Inter'");
    expect(svg).toContain("font-family:'Geist Mono'");
    expect(svg).toContain(assets.displayFont);
    expect(svg).toContain(assets.codeFont);
    expect(svg).not.toContain('Arial');
    expect(svg).not.toContain('Helvetica');
    expect(svg).not.toContain('Moodboard Sans');
    expect(svg).not.toContain("'Brand Display'");
  });

  it('embeds every brand font file with its real weight range when supplied', () => {
    const sources = new Map(brandFontAssets(GT_BRAND_IDENTITY).map((font) => [font.path, `data:font/ttf;base64,${font.id}`]));
    const css = moodboardFontFaceCss(GT_BRAND_IDENTITY, sources);
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, { ...assets, fontFaceCss: css }, 'showcase');

    expect(svg).toContain('data:font/ttf;base64,inter-variable');
    expect(svg).toContain('font-weight:100 900');
    expect(svg).not.toContain(assets.displayFont);
  });

  it.each(MOODBOARD_COMPOSITIONS)('renders the default %s board as clipped grid tiles', (composition) => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, composition);

    expect(svg.match(/class="application-panel/g)).toHaveLength(TILE_COUNTS[composition]);
    expect(svg).toContain(`data-board-mode="${composition}"`);
    expect(svg).toContain('data-board-recipe="monochrome-language"');
    expect(svg).toMatch(/<svg class="application-panel [^"]+" data-panel="[a-z]+" data-tile="[a-z0-9-]+"/);
    expect(svg).not.toContain('LIVE REFERENCE');
    expect(svg).not.toContain('/screenshots/');
    expect(svg).not.toContain('/references/');
  });

  it('keeps showcase and system ratios at 16:9 and 4:5', () => {
    expect(buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'showcase')).toContain('width="1600" height="900"');
    expect(buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'campaign')).toContain('width="1600" height="900"');
    expect(buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system')).toContain('width="1600" height="2000"');
    expect(buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'specimen')).toContain('width="1600" height="2000"');
    expect(buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'catalog')).toContain('width="1600" height="2400"');
  });

  it('builds the GT key visual from its monochrome light field and tagline', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'showcase');

    expect(svg).toMatch(/radialGradient id="[^"]*cover-device0-field"/);
    expect(svg).toMatch(/pattern id="[^"]*cover-device0-dither"/);
    expect(svg).toContain('>Every language.</tspan>');
  });

  it('keeps General Translation boards black and white through and through', () => {
    for (const composition of MOODBOARD_COMPOSITIONS) {
      const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, composition);
      const chromatic = [...svg.matchAll(/#([0-9a-f]{6})\b/gi)].map(([, hex]) => hex!).filter((hex) => {
        const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
        return Math.max(red!, green!, blue!) - Math.min(red!, green!, blue!) > 6;
      });
      expect(chromatic).toEqual([]);
    }
  });

  it('renders every system tile, source asset, and generated application in the complete catalog', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, { ...assets, artAssets: moodboardAssets(GT_BRAND_IDENTITY) }, 'catalog');

    expect(svg.match(/class="source-asset"/g)).toHaveLength(moodboardAssets(GT_BRAND_IDENTITY).length);
    expect(svg.match(/class="generated-application"/g)).toHaveLength(GT_BRAND_IDENTITY.applications.length);
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

    expect(svg).toContain('A&amp;B');
    expect(svg).toContain('&lt;Studio&gt;');
    expect(svg).not.toContain('A&B');
    expect(svg).not.toContain('<Studio>');
  });

  it('applies tile edits: copy, order, visibility, size, layout, and surface', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'showcase', {
      showcase: {
        order: ['voice', 'cover'],
        tiles: {
          card: { hidden: true },
          cover: { copy: { headline: 'Edited headline' }, span: 12, tone: 'paper', variant: 'type' },
        },
        title: 'Client review',
      },
    });

    expect(svg.match(/class="application-panel/g)).toHaveLength(7);
    expect(svg.indexOf('data-tile="voice"')).toBeLessThan(svg.indexOf('data-tile="cover"'));
    expect(svg).not.toContain('data-tile="card"');
    expect(svg).toContain('Edited');
    expect(svg).toContain('data-variant="type"');
    expect(svg).toContain('Client review');
  });

  it('records editable text slots inside the tile bounds', () => {
    const tile = defaultMoodboardTiles(GT_BRAND_IDENTITY, 'showcase')[0]!;
    const render = renderMoodboardTile({ assets, height: 400, identity: GT_BRAND_IDENTITY, scope: 'test', tile, width: 900 });
    const headline = render.slots.find((slot) => slot.field === 'headline')!;

    expect(headline).toBeDefined();
    expect(headline.x).toBeGreaterThanOrEqual(0);
    expect(headline.y).toBeGreaterThanOrEqual(0);
    expect(headline.x + headline.width).toBeLessThanOrEqual(900);
    expect(headline.y + headline.height).toBeLessThanOrEqual(400);
  });

  it.each(BUILT_IN_BRAND_IDENTITIES.map((identity) => [identity.name, identity] as const))(
    'renders every %s board from original or source-native assets with non-overlapping tiles',
    (_name, identity) => {
      const boardAssets = moodboardAssets(identity);
      for (const composition of MOODBOARD_COMPOSITIONS) {
        const svg = buildMoodboardSvg(identity, moodboardPreviewAssets(identity, boardAssets), composition);
        const layout = layoutMoodboard(identity, composition);

        expect(svg.match(/class="application-panel/g)).toHaveLength(TILE_COUNTS[composition]);
        expect(svg).toContain(`data-brand="${identity.id}"`);
        expect(svg).not.toContain('opacity=".94"');
        expect(svg).not.toMatch(/\/(?:references|screenshots)\//i);
        expect(svg).not.toMatch(/href="[^"]*(?:screen[-_ ]?shot|capture|homepage)/i);
        for (const [index, { rect }] of layout.tiles.entries()) {
          expect(rect.x + rect.width).toBeLessThanOrEqual(layout.width);
          expect(rect.y + rect.height).toBeLessThanOrEqual(layout.height);
          for (const { rect: other } of layout.tiles.slice(index + 1)) {
            const overlaps = rect.x < other.x + other.width && other.x < rect.x + rect.width && rect.y < other.y + other.height && other.y < rect.y + rect.height;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  );

  it('keeps product shots and authored diagrams whole rather than cropping them', () => {
    const identity = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'stripe')!;
    const svg = buildMoodboardSvg(identity, moodboardPreviewAssets(identity, moodboardAssets(identity)), 'catalog');
    const products = moodboardAssets(identity).filter((asset) => asset.tags?.includes('centered-product'));

    for (const product of products) {
      const images = [...svg.matchAll(new RegExp(`href="${product.path}"[^>]*preserveAspectRatio="([^"]+)"`, 'g'))];
      for (const [, aspect] of images) expect(aspect).toMatch(/meet$/);
    }
  });
});
