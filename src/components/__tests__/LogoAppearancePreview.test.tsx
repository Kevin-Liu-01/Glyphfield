import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
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
});
