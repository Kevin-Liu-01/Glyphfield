import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/docsSource', async () => (await import('./docsSourceFixture')).docsSourceMock);

import { GET as getDocsMarkdown } from '@/app/api/docs/[[...slug]]/route';
import { GET as getFullCorpus } from '@/app/llms-full.txt/route';
import { HOME_DESCRIPTION, SITE_URL, absoluteUrl } from '../seo';
import { STUDIO_TOOLS } from '../studioCatalog';
import { FIXTURE_PAGES } from './docsSourceFixture';

const llms = readFileSync('public/llms.txt', 'utf8');
const PUBLIC_ORIGIN = 'https://www.glyphfield.com';
const REPOSITORY = 'https://github.com/Kevin-Liu-01/Glyphfield';

function docsSourceFile(pathname: string) {
  const slug = pathname.replace(/^\/docs\/?/, '').replace(/\.md$/, '').replace(/^docs$/, '');
  return slug
    ? [`content/docs/${slug}.mdx`, `content/docs/${slug}/index.mdx`].find((file) => existsSync(file))
    : 'content/docs/index.mdx';
}

describe('/llms.txt', () => {
  it('opens with a title and a one-paragraph definition for a reader who has never heard of Glyphfield', () => {
    const [title, , summary] = llms.split('\n');
    expect(title).toBe('# Glyphfield');
    expect(summary).toMatch(/^> Glyphfield is a free, open-source brand design studio/);
    expect(summary).toContain('MIT License');
  });

  it('uses absolute links to the public site and the repository', () => {
    const urls = [...llms.matchAll(/https?:\/\/[^\s)`]+/g)].map(([url]) => url);
    expect(urls.length).toBeGreaterThan(40);
    for (const url of urls) {
      expect(url.startsWith(`${PUBLIC_ORIGIN}/`) || url === REPOSITORY || url.startsWith(`${REPOSITORY}/`)).toBe(true);
    }
    expect(llms).not.toMatch(/\]\(\//);
  });

  it('links only to docs pages and routes that exist', () => {
    const paths = [...llms.matchAll(/https:\/\/www\.glyphfield\.com(\/[^\s)`?]*)/g)].map(([, pathname]) => pathname);
    for (const pathname of paths) {
      if (pathname.startsWith('/docs')) {
        expect(docsSourceFile(pathname), pathname).toBeDefined();
      } else if (pathname.startsWith('/api/')) {
        expect(existsSync(`src/app${pathname}/route.ts`), pathname).toBe(true);
      }
    }
  });

  it('lists every public Studio tool with its ID and catalog description', () => {
    for (const tool of STUDIO_TOOLS) {
      expect(llms).toContain(`- ${tool.name} (\`${tool.id}\`): ${tool.description}`);
    }
  });

  it('follows the owner writing rules', () => {
    expect(llms).not.toContain('—');
    expect(llms).not.toMatch(/studio\.generaltranslation\.com/);
  });
});

describe('/llms-full.txt', () => {
  it('concatenates every docs page in sidebar order with absolute URLs', async () => {
    const response = await getFullCorpus();
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(text).toContain(HOME_DESCRIPTION);
    expect(text).toContain(`${SITE_URL}/docs`);
    for (const page of FIXTURE_PAGES) {
      expect(text).toContain(`# ${page.data.title}\n\n${page.data.description}`);
      expect(text).toContain(`Canonical page: ${absoluteUrl(page.url)}`);
      expect(text).toContain(`Markdown: ${absoluteUrl(`${page.url}.md`)}`);
      expect(text).toContain(`Body text for ${page.data.title}.`);
    }
    expect(text.indexOf('# Getting started')).toBeLessThan(text.indexOf('# Connect an agent'));
    expect(text.indexOf('# Layers and editing')).toBeLessThan(text.indexOf('# Skills moved'));
  });
});

describe('docs Markdown twins', () => {
  it('serves a docs page as Markdown with its title and description', async () => {
    const response = await getDocsMarkdown(new Request(`${SITE_URL}/docs/agents/connect.md`), {
      params: Promise.resolve({ slug: ['agents', 'connect'] }),
    });
    const markdown = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(markdown).toMatch(/^# Connect an agent\n\nDiscover Glyphfield and submit a generation request\.\n\n## Connect an agent body/);
  });

  it('serves the docs index at /docs.md and returns 404 for unknown pages', async () => {
    const index = await getDocsMarkdown(new Request(`${SITE_URL}/docs.md`), { params: Promise.resolve({}) });
    expect(await index.text()).toMatch(/^# Documentation/);

    const missing = await getDocsMarkdown(new Request(`${SITE_URL}/docs/missing.md`), {
      params: Promise.resolve({ slug: ['missing'] }),
    });
    expect(missing.status).toBe(404);
  });
});
