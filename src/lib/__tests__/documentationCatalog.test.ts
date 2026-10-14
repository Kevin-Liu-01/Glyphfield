import { existsSync, globSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AGENT_SHADER_LIBRARY } from '../agentCatalog';
import { BRAND_ELEMENTS } from '../brandElements';
import { COMPONENT_PATTERNS } from '../componentLibrary';
import { DESIGN_LAB_IMAGE_EFFECTS } from '../designLabImageEffects';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { STUDIO_TOOLS } from '../studioCatalog';

const read = (file: string) => readFileSync(`content/docs/${file}`, 'utf8');

/** The integer captured by the first group of a pattern that must appear in the page. */
function documentedCount(file: string, pattern: RegExp): number {
  const match = pattern.exec(read(file));
  if (!match) throw new Error(`${file} no longer states ${pattern}`);
  return Number(match[1]);
}

describe('documented catalog facts', () => {
  // Counts in prose go stale silently; these tie each one to the catalog it describes.
  it('states the current catalog counts', () => {
    expect(documentedCount('studio/shader-library.mdx', /lists (\d+) materials/)).toBe(AGENT_SHADER_LIBRARY.count);
    expect(documentedCount('studio/design-lab/effects.mdx', /there are (\d+) in/)).toBe(DESIGN_LAB_IMAGE_EFFECTS.length);
    expect(documentedCount('studio/brand-elements.mdx', /catalog of (\d+) templates/)).toBe(BRAND_ELEMENTS.length);
    expect(documentedCount('studio/components.mdx', /library has (\d+) components/)).toBe(COMPONENT_PATTERNS.length);
  });

  it('lists the image effect groups with their counts', () => {
    const effects = read('studio/design-lab/effects.mdx');
    const counts = new Map<string, number>();
    for (const { category } of DESIGN_LAB_IMAGE_EFFECTS) counts.set(category, (counts.get(category) ?? 0) + 1);
    for (const [category, count] of counts) expect(effects).toContain(`| ${category} | ${count} |`);
  });

  it('lists every Studio tool and built-in identity by ID', () => {
    const overview = read('studio/index.mdx');
    for (const tool of STUDIO_TOOLS) expect(overview).toContain(`| \`${tool.id}\` |`);
    const identity = read('studio/brand-settings.mdx');
    for (const preset of BUILT_IN_BRAND_IDENTITIES) expect(identity).toContain(`| \`${preset.id}\` | ${preset.name} |`);
  });

  it('links only to documentation pages that exist', () => {
    const pages = globSync('content/docs/**/*.mdx');
    for (const page of pages) {
      const body = readFileSync(page, 'utf8').replace(/```[\s\S]*?```/g, '');
      for (const [, href] of body.matchAll(/\]\((\/docs[^)#\s]*)/g)) {
        const slug = href.replace(/^\/docs\/?/, '').replace(/\.md$/, '').replace(/\/$/, '');
        const target = slug ? `content/docs/${slug}` : 'content/docs/index';
        expect(existsSync(`${target}.mdx`) || existsSync(`${target}/index.mdx`), `${page} links to ${href}`).toBe(true);
      }
    }
  });
});
