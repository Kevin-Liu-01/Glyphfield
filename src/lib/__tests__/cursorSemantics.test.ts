import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('interactive cursor semantics', () => {
  it('gives semantic controls a low-specificity pointer baseline', () => {
    const styles = source('src/app/globals.css');

    expect(styles).toMatch(
      /:where\(\s*a\[href\],[\s\S]*?button:not\(:disabled\),[\s\S]*?\[role='tab'\]:not\(\[aria-disabled='true'\]\),[\s\S]*?\[role='option'\]:not\(\[aria-disabled='true'\]\)[\s\S]*?\)\s*\{\s*cursor: pointer;/
    );
    expect(styles).toMatch(
      /:where\(\s*button:disabled,[\s\S]*?\[aria-disabled='true'\][\s\S]*?\)\s*\{\s*cursor: not-allowed;/
    );
  });

  it('keeps project tabs and select options visibly clickable', () => {
    const styles = source('src/app/globals.css');
    const select = source('src/components/ui/StudioSelect.tsx');

    expect(styles).toMatch(
      /\.app-navbar \.project-tab\s*\{[\s\S]*?cursor: pointer;/
    );
    expect(styles).toMatch(
      /\.app-navbar \.project-tab\[data-dragging='true'\]\s*\{[\s\S]*?cursor: grabbing;/
    );
    expect(select).toContain('cursor-pointer');
    expect(select).toContain('data-[disabled]:cursor-not-allowed');
    expect(select).not.toContain('cursor-default');
  });

  it('does not regress specialized canvas and resize affordances', () => {
    const styles = source('src/app/globals.css');

    expect(styles).toContain('cursor: grab;');
    expect(styles).toContain('cursor: grabbing;');
    expect(styles).toContain('cursor: crosshair;');
    expect(styles).toContain('cursor: ew-resize;');
    expect(styles).toContain('cursor: text;');
  });
});
