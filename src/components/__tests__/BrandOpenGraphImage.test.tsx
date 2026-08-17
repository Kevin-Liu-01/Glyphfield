import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import BrandOpenGraphImage from '@/components/BrandOpenGraphImage';

describe('BrandOpenGraphImage', () => {
  it('renders a prominent URL without legacy labels or footer metadata', () => {
    const markup = renderToStaticMarkup(
      <BrandOpenGraphImage
        accent='#6f5cff'
        description='Build identity, motion, graphics, and production-ready assets.'
        highlightedTitle='the whole brand'
        title='One studio for the whole brand.'
        url='glyphfield.com/studio'
      />
    );

    expect(markup).toContain('glyphfield.com/studio');
    expect(markup).toContain('font-size:21px');
    expect(markup).not.toContain('OPEN BRAND STUDIO');
    expect(markup).not.toContain('IDENTITY SYSTEMS');
    expect(markup).not.toContain('GLYPH FIELD / LIVE SYSTEM');
    expect(markup).not.toContain('LOCAL-FIRST');
    expect(markup).not.toContain('1200 × 630');
    expect(markup).not.toContain('1600 × 720');
    expect(markup).not.toContain('1680 × 720');
    expect(markup).toContain('data-og-shader="paper-dithering-swirl"');
    expect(markup).toContain('data-og-panel="copy"');
    expect(markup).toContain('width:720px');
    expect(markup).toContain('data-og-panel="image"');
    expect(markup).toContain('width:480px');
  });

  it('highlights a phrase wherever it appears in the title', () => {
    const markup = renderToStaticMarkup(
      <BrandOpenGraphImage
        accent='#8b5cf6'
        description='A connected brand workspace.'
        highlightedTitle='the whole brand'
        title='One studio for the whole brand.'
      />
    );

    expect(markup).toContain('One studio for');
    expect(markup).toContain('the whole brand.');
    expect(markup).toContain('color:#8b5cf6');
  });
});
