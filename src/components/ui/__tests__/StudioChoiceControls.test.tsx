import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRadio from '@/components/ui/StudioRadio';

describe('Studio choice controls', () => {
  it('keeps native checkbox semantics inside the branded indicator', () => {
    const markup = renderToStaticMarkup(
      <label>
        Loop
        <StudioCheckbox aria-label='Loop' checked readOnly />
      </label>
    );

    expect(markup).toContain('data-studio-checkbox="true"');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('studio-checkbox-indicator');
    expect(markup).toContain('checked=""');
  });

  it('keeps native radio semantics inside the branded indicator', () => {
    const markup = renderToStaticMarkup(
      <label>
        Public
        <StudioRadio aria-label='Public' checked name='visibility' readOnly />
      </label>
    );

    expect(markup).toContain('data-studio-radio="true"');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('studio-radio-indicator');
    expect(markup).toContain('name="visibility"');
  });
});
