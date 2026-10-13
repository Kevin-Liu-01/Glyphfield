import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import type { AtRule } from 'postcss';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe('route stylesheets', () => {
  it('loads landing-only rules from the landing page, never the root layout', () => {
    const page = readFileSync('src/app/page.tsx', 'utf8');
    const importers = sourceFiles('src').filter((file) => readFileSync(file, 'utf8').includes("landing.css'"));

    // First import, so it precedes component CSS in the page chunk as globals.css did.
    expect(page.startsWith("import './landing.css';")).toBe(true);
    expect(importers).toEqual(['src/app/page.tsx']);
  });

  it('keeps landing.css plain, unlayered CSS that only matches landing markup', () => {
    const css = postcss.parse(readFileSync('src/app/landing.css', 'utf8'));
    const offRoute: string[] = [];

    css.walkAtRules((atRule) => {
      expect(['media', 'container', 'supports', 'keyframes']).toContain(atRule.name);
    });
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && (rule.parent as AtRule).name === 'keyframes') return;
      for (const selector of rule.selectors) if (!selector.includes('.marketing-')) offRoute.push(selector);
    });
    expect(offRoute).toEqual([]);
  });
});
