import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { DEFAULT_LOGO_APPEARANCE } from '@/lib/logoAppearance';

describe('AppearanceFilteredContent', () => {
  it('filters shader content in the rendered layer viewport instead of a square viewBox', () => {
    const markup = renderToStaticMarkup(
      <AppearanceFilteredContent
        ariaLabel='Shader-filled mark'
        settings={{ ...DEFAULT_LOGO_APPEARANCE, invert: true }}
      >
        <canvas />
      </AppearanceFilteredContent>
    );

    expect(markup).toContain('<foreignObject');
    expect(markup).toContain('width="100%"');
    expect(markup).toContain('height="100%"');
    expect(markup).not.toContain('viewBox="0 0 100 100"');
  });

  it('renders the filter graph as SVG elements without injecting markup', () => {
    const markup = renderToStaticMarkup(
      <LogoAppearancePreview
        ariaLabel='Logo'
        color='#FFFFFF'
        logoPath='data:image/svg+xml,%3Csvg%2F%3E'
        settings={{
          ...DEFAULT_LOGO_APPEARANCE,
          borderEnabled: true,
          ditherEnabled: true,
          invert: true,
          shadowEnabled: true,
        }}
      />
    );

    expect(markup).toContain('<feTurbulence');
    expect(markup).toContain('<feMorphology');
    expect(markup).toContain('<feGaussianBlur');
    expect(markup).toContain('<feMergeNode in="dithered"');
    expect(markup).not.toContain('dangerouslySetInnerHTML');
  });

  it('can fit imported-image effects to the exact editable frame', () => {
    const markup = renderToStaticMarkup(
      <LogoAppearancePreview
        ariaLabel='Imported image border'
        color='#FFFFFF'
        fillFrame
        logoPath='data:image/png;base64,aGVybw=='
        settings={DEFAULT_LOGO_APPEARANCE}
      />
    );

    expect(markup).toContain('preserveAspectRatio="none"');
    expect(markup).not.toContain('preserveAspectRatio="xMidYMid meet"');
  });
});
