import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENT_ROOT = join(process.cwd(), 'src/components');

function componentSources(directory = COMPONENT_ROOT): { path: string; source: string }[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : componentSources(path);
    }
    if (!entry.name.endsWith('.tsx')) return [];
    return [{ path: relative(process.cwd(), path), source: readFileSync(path, 'utf8') }];
  });
}

function nativeControlLeaks(
  pattern: RegExp,
  allowedPaths: readonly string[] = []
): string[] {
  return componentSources()
    .filter(({ path, source }) => !allowedPaths.includes(path) && pattern.test(source))
    .map(({ path }) => path);
}

describe('Studio control system', () => {
  it('routes discrete selection controls through shared components', () => {
    expect(nativeControlLeaks(/<select\b/)).toEqual([]);
    expect(nativeControlLeaks(/<input\b[^>]*\btype\s*=\s*['"]color['"]/)).toEqual([]);
    expect(nativeControlLeaks(/<input\b[^>]*\btype\s*=\s*['"]checkbox['"]/, [
      'src/components/ui/StudioCheckbox.tsx',
    ])).toEqual([]);
    expect(nativeControlLeaks(/<input\b[^>]*\btype\s*=\s*['"]radio['"]/, [
      'src/components/ui/StudioRadio.tsx',
    ])).toEqual([]);
  });

  it('routes continuous range controls through StudioRange', () => {
    expect(nativeControlLeaks(/<input\b[^>]*\btype\s*=\s*['"]range['"]/, [
      'src/components/ui/StudioRange.tsx',
    ])).toEqual([]);
  });

  it('uses the shared dropdown and color popover at the former native leaks', () => {
    const sourceDrawer = readFileSync(join(COMPONENT_ROOT, 'SourceCodeDrawer.tsx'), 'utf8');
    const compactColor = readFileSync(join(COMPONENT_ROOT, 'CompactColorControl.tsx'), 'utf8');

    expect(sourceDrawer).toContain('<StudioSelect');
    expect(sourceDrawer).toContain("leadingIcon={<ListTree aria-hidden='true' />}");
    expect(compactColor).toContain('<ColorControl');
    expect(compactColor).toContain('compact');
  });
});
