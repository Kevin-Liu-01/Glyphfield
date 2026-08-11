import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('smooth elevation system', () => {
  it('replaces Tailwind shadows with the official layered scale', () => {
    const css = source('src/app/globals.css');
    const packageJson = source('package.json');

    expect(css).toContain("@import 'shadow-plugin/unprefixed';");
    expect(css).toContain('--studio-shadow-ring-sm: var(--shadow-sm)');
    expect(css).toContain('--studio-shadow-ring-2xl: var(--shadow-2xl)');
    expect(packageJson).toContain('"shadow-plugin"');
  });

  it('uses integrated shadow rings on floating product surfaces', () => {
    const select = source('src/components/ui/StudioSelect.tsx');
    const colorControl = source('src/components/ui/ColorControl.tsx');
    const componentLibrary = source('src/components/ComponentLibraryPreview.tsx');

    expect(select).toContain('smooth-shadow-ring-lg');
    expect(select).not.toContain('shadow-[0_18px_50px');
    expect(colorControl).toContain('smooth-shadow-ring-xl');
    expect(componentLibrary).toContain('smooth-shadow-ring-2xl');
    expect(componentLibrary).toContain('smooth-shadow-ring-xl');
  });
});
