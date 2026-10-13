import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '../brandIdentity';
import {
  BOOK_PAGE_VARIANTS,
  BOOK_SECTION_IDS,
  bookPageDefinitions,
  bookSource,
  parseBookSource,
  resetBookPage,
  resolveBook,
  sanitizeBookOverrides,
  updateBookPage,
  updateBookSection,
  visibleBookPages,
} from '../brandBookModel';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';

describe('brand book structure', () => {
  it('opens with the introduction, covers every required section, and closes', () => {
    const sections = resolveBook(GT_BRAND_IDENTITY, {});
    expect(sections.map(({ id }) => id)).toEqual(['intro', ...BOOK_SECTION_IDS, 'closing']);
    for (const required of ['strategy', 'logo', 'colour', 'typography', 'device', 'imagery', 'voice', 'applications', 'motion']) {
      expect(sections.find(({ id }) => id === required)!.pages.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('includes logo clear space, minimum size, and misuse plus colour pairings and voice do/don’t', () => {
    const ids = Object.values(bookPageDefinitions(GT_BRAND_IDENTITY)).flat().map(({ id }) => id);
    for (const id of ['logo-clearspace', 'logo-minimum', 'logo-misuse', 'colour-proportion', 'colour-pairings', 'type-scale', 'type-pairing', 'voice-dodont', 'motion-tokens']) {
      expect(ids).toContain(id);
    }
  });

  it.each(BUILT_IN_BRAND_IDENTITIES.map((identity) => [identity.name, identity] as const))('gives %s unique page IDs, real copy, and valid variants', (_name, identity) => {
    const pages = Object.values(bookPageDefinitions(identity)).flat();
    expect(new Set(pages.map(({ id }) => id)).size).toBe(pages.length);
    for (const page of pages) {
      expect(BOOK_PAGE_VARIANTS[page.kind].length).toBeGreaterThanOrEqual(2);
      for (const value of Object.values(page.copy)) expect(value).not.toMatch(/lorem|ipsum/i);
    }
    expect(pages.length).toBeGreaterThanOrEqual(48);
  });

  it('numbers visible pages consecutively and skips hidden pages and sections', () => {
    let overrides = updateBookPage(GT_BRAND_IDENTITY, {}, 'foreword', { hidden: true });
    overrides = updateBookSection(overrides, 'motion', { hidden: true });
    const visible = visibleBookPages(resolveBook(GT_BRAND_IDENTITY, overrides));
    expect(visible.map(({ folio }) => folio)).toEqual(visible.map((_, index) => index + 1));
    expect(visible.some(({ id }) => id === 'foreword')).toBe(false);
    expect(visible.some(({ section }) => section.id === 'motion')).toBe(false);
    expect(visible.at(-1)!.id).toBe('closing');
  });
});

describe('brand book source', () => {
  it('round-trips the resolved source without creating overrides', () => {
    expect(parseBookSource(GT_BRAND_IDENTITY, bookSource(GT_BRAND_IDENTITY, {}), {})).toEqual({});
  });

  it('reorders sections, hides pages, and stores only edited copy', () => {
    const source = bookSource(GT_BRAND_IDENTITY, {});
    const sections = source.sections;
    const voice = sections.find(({ id }) => id === 'voice')!;
    sections.splice(sections.indexOf(voice), 1);
    sections.splice(1, 0, voice);
    const premise = sections.find(({ id }) => id === 'strategy')!.pages.find(({ id }) => id === 'strategy-premise')!;
    premise.copy = { ...premise.copy, statement: 'One source, every language.' };
    premise.variant = 'centered';
    premise.tone = 'ink';
    sections.find(({ id }) => id === 'logo')!.pages.find(({ id }) => id === 'logo-misuse')!.hidden = true;

    const overrides = parseBookSource(GT_BRAND_IDENTITY, source, {});
    expect(overrides.sectionOrder?.[0]).toBe('voice');
    expect(overrides.pages).toEqual({
      'logo-misuse': { hidden: true },
      'strategy-premise': { copy: { statement: 'One source, every language.' }, tone: 'ink', variant: 'centered' },
    });
    const resolved = resolveBook(GT_BRAND_IDENTITY, overrides);
    expect(resolved[1]!.id).toBe('voice');
    expect(resolved.find(({ id }) => id === 'strategy')!.pages[1]!.copy.statement).toBe('One source, every language.');
  });

  it('rejects unknown sections, foreign pages, slots, variants, surfaces, and images with field paths', () => {
    const page = (patch: Record<string, unknown>) => ({ sections: [{ id: 'strategy', pages: [{ id: 'strategy-premise', ...patch }] }], version: 1 });
    expect(() => parseBookSource(GT_BRAND_IDENTITY, { sections: [{ id: 'appendix' }] }, {})).toThrow(/sections\.0\.id/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, { sections: [{ id: 'logo', pages: [{ id: 'strategy-premise' }] }] }, {})).toThrow(/not a page of section logo/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, page({ copy: { footnote: 'x' } }), {})).toThrow(/not an editable slot/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, page({ variant: 'wild' }), {})).toThrow(/variant/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, page({ tone: 'neon' }), {})).toThrow(/tone/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, { sections: [{ id: 'imagery', pages: [{ assetId: 'https://x.example/a.png', id: 'imagery-direction' }] }] }, {})).toThrow(/assetId/);
    expect(() => parseBookSource(GT_BRAND_IDENTITY, { version: 9 }, {})).toThrow(/version 9/);
  });

  it('keeps omitted sections and pages unchanged when applying a partial source', () => {
    const previous = updateBookPage(GT_BRAND_IDENTITY, {}, 'type-scale', { variant: 'sample' });
    const next = parseBookSource(GT_BRAND_IDENTITY, { sections: [{ hidden: true, id: 'motion' }] }, previous);
    expect(next.pages).toEqual({ 'type-scale': { variant: 'sample' } });
    expect(next.sections).toEqual({ motion: { hidden: true } });
  });

  it('sanitizes stale persisted edits and resets pages', () => {
    const overrides = updateBookPage(GT_BRAND_IDENTITY, {}, 'cover', { copy: { title: 'Edited' } });
    expect(sanitizeBookOverrides(GT_BRAND_IDENTITY, overrides)).toEqual(overrides);
    expect(sanitizeBookOverrides(GT_BRAND_IDENTITY, { pages: { cover: { variant: 'nope' } } })).toEqual({});
    expect(sanitizeBookOverrides(GT_BRAND_IDENTITY, 'corrupt')).toEqual({});
    expect(resetBookPage(overrides, 'cover').pages).toEqual({});
  });
});
