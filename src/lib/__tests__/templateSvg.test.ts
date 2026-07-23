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
});
