import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioRange from '@/components/ui/StudioRange';

describe('StudioRange', () => {
  it('keeps native range semantics and exposes its initial progress to the shared skin', () => {
    const markup = renderToStaticMarkup(
      <StudioRange aria-label='Speed' max={3} min={1} value={1.5} />
    );

    expect(markup).toContain('type="range"');
    expect(markup).toContain('data-studio-range="true"');
    expect(markup).toContain('--studio-range-progress:25%');
    expect(markup).toContain('aria-label="Speed"');
  });

  it('uses a neutral foreground by default and accepts an explicit workspace highlight', () => {
    const styles = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const sharedRangeStyles = styles.slice(
      styles.indexOf("input.studio-range[data-studio-range='true'] {"),
      styles.indexOf("input.studio-range[data-studio-range='true']::-webkit-slider-runnable-track")
    );

    expect(sharedRangeStyles).toContain(
      '--studio-range-accent: var(--studio-highlight-color, hsl(var(--foreground)));'
    );
    expect(sharedRangeStyles).toContain('--studio-range-thumb-border: var(--studio-range-accent);');
    expect(sharedRangeStyles).not.toContain('#5b7cff');
    expect(styles.match(/--studio-highlight-color: hsl\(var\(--primary\)\);/g)).toHaveLength(3);
  });
});
