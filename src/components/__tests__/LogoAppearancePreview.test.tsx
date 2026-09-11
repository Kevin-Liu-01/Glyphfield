import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { DEFAULT_LOGO_APPEARANCE } from '@/lib/logoAppearance';

describe('AppearanceFilteredContent', () => {
  it('filters shader content without the WebKit-unsafe foreignObject path', () => {
    const markup = renderToStaticMarkup(
      <AppearanceFilteredContent
        ariaLabel='Shader-filled mark'
        settings={{ ...DEFAULT_LOGO_APPEARANCE, ditherEnabled: true, invert: true }}
      >
        <canvas />
      </AppearanceFilteredContent>
    );

    expect(markup).toContain('data-appearance-content="true"');
    expect(markup).toContain('data-appearance-dither-mask="true"');
    expect(markup).toContain('mask-image:url(&quot;data:image/svg+xml,');
    expect(markup).toContain('filter:invert(1)');
    expect(markup).not.toContain('<foreignObject');
    expect(markup).not.toContain('<feTurbulence');
  });

  it('renders logo effects through Safari-safe CSS masks without injecting markup', () => {
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

    expect(markup).toContain('data-appearance-content="true"');
    expect(markup).toContain('data-appearance-dither-mask="true"');
    expect(markup).toContain('mask-image:url(&quot;data:image/svg+xml,');
    expect(markup).toContain('drop-shadow');
    expect(markup).not.toContain('<foreignObject');
    expect(markup).not.toContain('<feTurbulence');
    expect(markup).not.toContain('dangerouslySetInnerHTML');
  });

  it('can fit imported-image effects to the exact editable frame', () => {
    const markup = renderToStaticMarkup(
      <LogoAppearancePreview
        ariaLabel='Imported image border'
        color='#FFFFFF'
        fillFrame
        logoPath='data:image/png;base64,aGVybw=='
        preserveColors
        settings={DEFAULT_LOGO_APPEARANCE}
      />
    );

    expect(markup).toContain('object-fit:fill');
    expect(markup).not.toContain('preserveAspectRatio');
  });
});
