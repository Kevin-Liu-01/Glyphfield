import { describe, expect, it } from 'vitest';

import { asciiBanner, asciiBannerWord } from '../asciiBanner';

describe('asciiBanner', () => {
  it('sets a word in six rows of ANSI Shadow with letters drawn in full blocks', () => {
    const banner = asciiBanner('Ramp');
    const rows = banner.split('\n');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBe('██████╗  █████╗ ███╗   ███╗██████╗');
    expect(banner).not.toMatch(/[a-z]/);
  });

  it('banners the name when it fits and the short name otherwise', () => {
    expect(asciiBannerWord('Stripe', 'Stripe')).toBe('Stripe');
    expect(asciiBannerWord('Vite+', 'VP')).toBe('Vite+');
    expect(asciiBannerWord('General Translation', 'GT')).toBe('GT');
    expect(asciiBannerWord('Cloudflare', 'CF')).toBe('CF');
    expect(asciiBanner('?!')).toBe('');
  });
});
