import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('shader swap fade and reduced motion', () => {
  it('drops the swap fade under the Studio Reduce motion switch as well as the system setting', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const canvas = readFileSync(join(process.cwd(), 'src/components/LiveMaterialCanvas.tsx'), 'utf8');
    // The held view fades with an inline transition, which only an !important rule can override.
    expect(canvas).toMatch(/data-live-material-held=''[\s\S]*?transition: `opacity \$\{SWAP_FADE_MS\}ms/);
    expect(css).toMatch(/\.studio-app\[data-studio-motion='reduced'\] \[data-live-material-held\] \{\s*transition-duration: 0ms !important;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{[^}]*transition-duration: 0\.01ms !important;/);
  });
});
