// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioSelect from '@/components/ui/StudioSelect';

const OPTIONS = [{ label: 'Banner animation', value: 'banner' }, { label: 'Square animation', value: 'square' }];

describe('StudioSelect server markup', () => {
  it('names a controlled selection in the trigger before the option list mounts', () => {
    const markup = renderToStaticMarkup(<StudioSelect ariaLabel='Artboard' options={OPTIONS} value='square' />);
    expect(markup).toContain('Square animation');
    expect(markup).not.toContain('Banner animation');
  });

  it('shows the placeholder when the controlled value is not an option', () => {
    const markup = renderToStaticMarkup(<StudioSelect ariaLabel='Artboard' options={OPTIONS} placeholder='Pick one' value='' />);
    expect(markup).toContain('Pick one');
  });
});
