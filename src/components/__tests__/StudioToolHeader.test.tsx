import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioToolHeader from '@/components/StudioToolHeader';

describe('StudioToolHeader', () => {
  it('renders named sections in a stable order', () => {
    const markup = renderToStaticMarkup(
      <StudioToolHeader
        actions={<button type='button'>Export</button>}
        context={<span>Context</span>}
        metadata='Identity · 51 pages'
        navigation={<button type='button'>Overview</button>}
        status={<span>Saved</span>}
        title='Brand book'
        toolId='brand-book'
      />
    );

    expect(markup).toContain('<header');
    expect(markup).toContain('<h1>Brand book</h1>');
    expect(markup.indexOf("data-slot=\"identity\"")).toBeLessThan(markup.indexOf("data-slot=\"middle\""));
    expect(markup.indexOf("data-slot=\"middle\"")).toBeLessThan(markup.indexOf("data-slot=\"trailing\""));
    expect(markup.indexOf("data-slot=\"status\"")).toBeLessThan(markup.indexOf("data-slot=\"actions\""));
  });

  it('omits optional section content when it is not supplied', () => {
    const markup = renderToStaticMarkup(<StudioToolHeader title='Typography' toolId='typography' />);

    expect(markup).toContain('<h1>Typography</h1>');
    expect(markup).not.toContain('data-slot="context"');
    expect(markup).not.toContain('data-slot="navigation"');
    expect(markup).not.toContain('data-slot="status"');
    expect(markup).not.toContain('data-slot="actions"');
  });

  it('uses a second-level heading when embedded in a dialog', () => {
    const markup = renderToStaticMarkup(
      <StudioToolHeader headingLevel={2} title='Review export' />
    );

    expect(markup).toContain('<h2>Review export</h2>');
    expect(markup).not.toContain('<h1>');
  });
});
