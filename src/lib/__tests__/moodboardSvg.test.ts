import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '../brandIdentity';
import { buildMoodboardSvg } from '../moodboardSvg';

const assets = {
  interFont: 'data:font/woff2;base64,INTER',
  markDark: 'data:image/svg+xml;base64,DARK',
  markLight: 'data:image/svg+xml;base64,LIGHT',
  monoFont: 'data:font/woff2;base64,MONO',
  motionPreview: 'data:image/gif;base64,MOTION',
  proofMarks: ['data:image/svg+xml;base64,PROOF'],
};

describe('buildMoodboardSvg', () => {
  it('embeds the selected sans and mono fonts without browser fallbacks', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system');

    expect(svg).toContain("font-family:'Moodboard Sans'");
    expect(svg).toContain("font-family:'Moodboard Mono'");
    expect(svg).toContain(assets.interFont);
    expect(svg).toContain(assets.monoFont);
    expect(svg).not.toContain('Arial');
  });

  it('composes brand foundations and concrete applications as one board', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'system');

    expect(svg.match(/class="application-panel/g)).toHaveLength(7);
    expect(svg).toContain('GT IDENTITY');
    expect(svg).toContain('STRATEGY');
    expect(svg).toContain('LOGO ARCHITECTURE');
    expect(svg).toContain('COLOR ROLES');
    expect(svg).toContain('TYPOGRAPHY');
    expect(svg).toContain('THE TRANSLATION FRAME');
    expect(svg).toContain('Engineering story');
    expect(svg).toContain('Localization');
    expect(svg).toContain('workspace');
    expect(svg).toContain('Language morph');
    expect(svg).not.toContain('#3B82F6');
    expect(svg).not.toContain('#F97316');
  });

  it('composes a presentation-ready application collage without guideline chrome', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets, 'showcase');

    expect(svg).toContain('data-board-mode="showcase"');
    expect(svg).toContain('class="application-panel hero-application"');
    expect(svg).toContain('class="application-panel editorial-application"');
    expect(svg).toContain('class="application-panel type-application"');
    expect(svg).toContain('class="application-panel product-application"');
    expect(svg).toContain('class="application-panel system-application"');
    expect(svg).not.toContain('01 / GT IDENTITY');
  });

  it('escapes identity copy before placing it in the SVG', () => {
    const svg = buildMoodboardSvg(
      { ...GT_BRAND_IDENTITY, name: 'A&B <Studio>' },
      assets,
      'showcase'
    );

    expect(svg).toContain('A&amp;B &lt;Studio&gt;');
    expect(svg).not.toContain('A&B <Studio>');
  });
});
