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
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets);

    expect(svg).toContain("font-family:'Moodboard Sans'");
    expect(svg).toContain("font-family:'Moodboard Mono'");
    expect(svg).toContain(assets.interFont);
    expect(svg).toContain(assets.monoFont);
    expect(svg).not.toContain('Arial');
  });

  it('composes brand foundations and concrete applications as one board', () => {
    const svg = buildMoodboardSvg(GT_BRAND_IDENTITY, assets);

    expect(svg.match(/class="application-panel"/g)).toHaveLength(10);
    expect(svg).toContain('GT IDENTITY');
    expect(svg).toContain('STRATEGY');
    expect(svg).toContain('LOGO ARCHITECTURE');
    expect(svg).toContain('COLOR ROLES');
    expect(svg).toContain('TYPOGRAPHY');
    expect(svg).toContain('THE TRANSLATION FRAME');
    expect(svg).toContain('LOCALIZATION WORKSPACE');
    expect(svg).toContain('LANGUAGE MORPH');
    expect(svg).toContain('DEVELOPER CLI');
    expect(svg).toContain('GLOBAL PRODUCT PASS');
    expect(svg).not.toContain('#3B82F6');
    expect(svg).not.toContain('#F97316');
  });

  it('escapes identity copy before placing it in the SVG', () => {
    const svg = buildMoodboardSvg(
      { ...GT_BRAND_IDENTITY, name: 'A&B <Studio>' },
      assets
    );

    expect(svg).toContain('A&amp;B &lt;Studio&gt;');
    expect(svg).not.toContain('A&B <Studio>');
  });
});
