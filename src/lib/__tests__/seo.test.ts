import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import packageJson from '../../../package.json';
import { PRODUCT_BRAND } from '../productBrand';
import {
  HOME_DESCRIPTION,
  HOME_FAQS,
  HOME_TITLE,
  SITE_URL,
  STUDIO_DESCRIPTION,
  STUDIO_SCREENSHOT,
  STUDIO_TITLE,
  absoluteUrl,
  docsPageJsonLd,
  docsPageMetadata,
  docsPageTitle,
  homeJsonLd,
  serializeJsonLd,
  studioJsonLd,
  websiteJsonLd,
} from '../seo';
import { STUDIO_TOOLS } from '../studioCatalog';

type JsonLdNode = Record<string, unknown> & { '@id'?: string; '@type': string };

function graphNodes(graph: { '@graph': readonly unknown[] }) {
  return graph['@graph'] as JsonLdNode[];
}

function nodeOfType(graph: { '@graph': readonly unknown[] }, type: string) {
  const node = graphNodes(graph).find((candidate) => candidate['@type'] === type);
  if (!node) throw new Error(`Missing ${type}`);
  return node;
}

function sentenceCount(text: string) {
  return text.match(/[.!?](?=\s+[A-Z]|$)/g)?.length ?? 0;
}

function collectReferences(value: unknown, references: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, references);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 1 && typeof record['@id'] === 'string') references.push(record['@id']);
    for (const item of Object.values(record)) collectReferences(item, references);
  }
  return references;
}

const DOCS_INPUT = {
  description: 'Add and edit Design Lab layers.',
  imageUrl: '/og/docs/studio/design-lab/layers/image.png',
  sections: [
    { name: 'Studio', url: '/docs/studio' },
    { name: 'Design Lab', url: '/docs/studio/design-lab' },
  ],
  title: 'Layers and editing',
  url: '/docs/studio/design-lab/layers',
};

describe('site origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to the live www host', async () => {
    vi.stubEnv('NEXT_PUBLIC_STUDIO_URL', '');
    const seo = await import('../seo');

    expect(seo.SITE_URL).toBe('https://www.glyphfield.com');
    expect(seo.absoluteUrl('/docs')).toBe('https://www.glyphfield.com/docs');
  });

  it('lets a self-hosted deployment set its own origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_STUDIO_URL', 'https://brand.example.com/');
    const seo = await import('../seo');

    expect(seo.SITE_URL).toBe('https://brand.example.com');
    expect(seo.absoluteUrl('/studio')).toBe('https://brand.example.com/studio');
  });
});

describe('page copy', () => {
  it('keeps titles and descriptions inside search-result lengths without em dashes', () => {
    for (const title of [HOME_TITLE, STUDIO_TITLE]) {
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title).not.toContain('—');
    }
    for (const description of [HOME_DESCRIPTION, STUDIO_DESCRIPTION]) {
      expect(description.length).toBeGreaterThanOrEqual(120);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description).not.toContain('—');
    }
  });

  it('answers five to eight questions in one to three sentences each', () => {
    expect(HOME_FAQS.length).toBeGreaterThanOrEqual(5);
    expect(HOME_FAQS.length).toBeLessThanOrEqual(8);
    for (const { answer, question } of HOME_FAQS) {
      expect(question).toMatch(/\?$/);
      expect(sentenceCount(answer)).toBeGreaterThanOrEqual(1);
      expect(sentenceCount(answer)).toBeLessThanOrEqual(3);
      expect(answer).not.toContain('—');
    }
  });

  it('names every public Studio tool in the FAQ', () => {
    // A new Studio tool has no phrase here, so this test fails until the FAQ names it.
    const phrases: Partial<Record<string, string>> = {
      animation: 'animation',
      blog: 'blog covers',
      'brand-book': 'brand books',
      'brand-elements': 'brand elements',
      buttons: 'component library',
      colors: 'color tokens',
      'design-board': 'moodboards',
      identity: 'brand identity',
      lottie: 'Lottie files',
      material: 'Design Lab compositions',
      opengraph: 'OpenGraph images',
      partnership: 'partnership lockups',
      slides: 'slide decks',
      terminal: 'terminal cards',
      typography: 'typography',
    };
    const answer = HOME_FAQS.find(({ question }) => question === 'What can I make with Glyphfield?')?.answer ?? '';
    for (const tool of STUDIO_TOOLS) expect(answer).toContain(phrases[tool.id] ?? `missing phrase for ${tool.id}`);
  });
});

describe('structured data', () => {
  it('publishes the FAQ with the exact visible text', () => {
    const faq = nodeOfType(homeJsonLd(), 'FAQPage');
    expect(faq.mainEntity).toEqual(HOME_FAQS.map(({ answer, question }) => ({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer', text: answer },
      name: question,
    })));
  });

  it('describes the application with its version, screenshot, tools, and free MIT license', () => {
    const software = nodeOfType(homeJsonLd(), 'SoftwareApplication');

    expect(software.softwareVersion).toBe(packageJson.version);
    expect(software.featureList).toEqual(STUDIO_TOOLS.map(({ name }) => name));
    expect(software.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    expect(software.license).toBe(`${PRODUCT_BRAND.repository.url}/blob/main/LICENSE`);
    expect(software.sameAs).toEqual([PRODUCT_BRAND.repository.url]);
    expect(software.url).toBe(absoluteUrl('/studio'));
    expect(software.screenshot).toMatchObject({ url: absoluteUrl(STUDIO_SCREENSHOT.path) });
    expect(existsSync(path.join('public', STUDIO_SCREENSHOT.path))).toBe(true);
    expect(studioJsonLd()['@graph']).toEqual([software]);
  });

  it('describes the repository as MIT-licensed TypeScript source', () => {
    const source = nodeOfType(homeJsonLd(), 'SoftwareSourceCode');

    expect(source).toMatchObject({
      codeRepository: PRODUCT_BRAND.repository.url,
      license: `${PRODUCT_BRAND.repository.url}/blob/main/LICENSE`,
      programmingLanguage: 'TypeScript',
      targetProduct: { '@id': `${SITE_URL}/#software` },
    });
  });

  it('names Kevin Liu as the creator and resolves every node reference', () => {
    const person = nodeOfType(websiteJsonLd(), 'Person');
    expect(person).toMatchObject({ name: 'Kevin Liu', url: 'https://github.com/Kevin-Liu-01' });

    const graphs = [websiteJsonLd(), homeJsonLd(), docsPageJsonLd(DOCS_INPUT)];
    const ids = new Set(graphs.flatMap((graph) => graphNodes(graph).map((node) => node['@id'])));
    for (const reference of graphs.flatMap((graph) => collectReferences(graph['@graph']))) {
      expect(ids).toContain(reference);
    }
  });

  it('escapes markup in serialized JSON-LD', () => {
    expect(serializeJsonLd({ text: '</script><script>' })).not.toContain('<');
  });
});

describe('docs pages', () => {
  it('names the nearest section in the title', () => {
    expect(docsPageTitle({ sections: [], title: 'Documentation', url: '/docs' })).toBe('Glyphfield documentation');
    expect(docsPageTitle(DOCS_INPUT)).toBe('Layers and editing · Design Lab · Glyphfield Docs');
    expect(docsPageTitle({ sections: [], title: 'Getting started', url: '/docs/getting-started' }))
      .toBe('Getting started · Glyphfield Docs');
  });

  it('sets the canonical URL, Markdown twin, Open Graph article, and large Twitter card', () => {
    const metadata = docsPageMetadata(DOCS_INPUT);

    expect(metadata.alternates).toEqual({
      canonical: DOCS_INPUT.url,
      types: { 'text/markdown': `${DOCS_INPUT.url}.md` },
    });
    expect(metadata.openGraph).toMatchObject({
      locale: 'en_US',
      siteName: 'Glyphfield',
      type: 'article',
      url: DOCS_INPUT.url,
    });
    expect(metadata.openGraph).not.toHaveProperty('modifiedTime');
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [DOCS_INPUT.imageUrl] });
  });

  it('adds modification dates only when they are known', () => {
    const dateModified = new Date('2026-09-11T16:54:16.000Z');
    const article = nodeOfType(docsPageJsonLd({ ...DOCS_INPUT, dateModified }), 'TechArticle');

    expect(article.dateModified).toBe('2026-09-11T16:54:16.000Z');
    expect(docsPageMetadata({ ...DOCS_INPUT, dateModified }).openGraph).toMatchObject({
      modifiedTime: '2026-09-11T16:54:16.000Z',
    });
    expect(nodeOfType(docsPageJsonLd(DOCS_INPUT), 'TechArticle')).not.toHaveProperty('dateModified');
  });

  it('builds a numbered breadcrumb trail of absolute URLs', () => {
    const breadcrumb = nodeOfType(docsPageJsonLd(DOCS_INPUT), 'BreadcrumbList');

    expect(breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', item: absoluteUrl('/'), name: 'Glyphfield', position: 1 },
      { '@type': 'ListItem', item: absoluteUrl('/docs'), name: 'Documentation', position: 2 },
      { '@type': 'ListItem', item: absoluteUrl('/docs/studio'), name: 'Studio', position: 3 },
      { '@type': 'ListItem', item: absoluteUrl('/docs/studio/design-lab'), name: 'Design Lab', position: 4 },
      { '@type': 'ListItem', item: absoluteUrl(DOCS_INPUT.url), name: 'Layers and editing', position: 5 },
    ]);
  });

  it('leaves sections without a page out of the breadcrumb', () => {
    const breadcrumb = nodeOfType(docsPageJsonLd({
      ...DOCS_INPUT,
      sections: [{ name: 'Studio' }, { name: 'Design Lab', url: '/docs/studio/design-lab' }],
    }), 'BreadcrumbList');

    expect((breadcrumb.itemListElement as { name: string }[]).map(({ name }) => name))
      .toEqual(['Glyphfield', 'Documentation', 'Design Lab', 'Layers and editing']);
  });
});
