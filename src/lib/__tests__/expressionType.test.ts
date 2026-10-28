import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';
import { buildBackgroundSvg, DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import { EXPRESSION_TOOL_KINDS, elementComponent, elementSlot, pageElements, readLockupPartners, slotElement } from '../expressionModel';
import { estimateTextWidth, renderExpressionElement, wrapCodeLines, type ExpressionRenderContext } from '../expressionSvg';
import { applyExpressionLayout, brandPatternSettings, createExpressionDocument, expressionColors, expressionLayouts } from '../expressionTemplates';
import { assetArtworkLookup, expressionTypeScale, inkAspect, opticalLogoSize, placeInk, TYPE_RATIO, trackingFor } from '../expressionType';
import { LOGO_ARTWORK } from '../logoArtwork';

const identity = (id: string) => BUILT_IN_BRAND_IDENTITIES.find((candidate) => candidate.id === id)!;

function contextFor(document: ReturnType<typeof createExpressionDocument>, id = 'gt'): ExpressionRenderContext {
  const brand = identity(id);
  return {
    assetArtwork: assetArtworkLookup(document.assets),
    assetSource: (assetId) => (assetId ? document.assets[assetId]?.source ?? null : null),
    colors: expressionColors(brand),
    fontFamily: (_id, family) => family,
    greetings: brand.greetings,
    idPrefix: 't',
    measure: estimateTextWidth,
    pageCount: document.pageIds.length,
    pageIndex: 0,
    products: brand.products,
    proof: brand.proof,
  };
}

/** Every page of every layout of every tool for every identity. */
function everyPage() {
  return BUILT_IN_BRAND_IDENTITIES.flatMap((brand) => EXPRESSION_TOOL_KINDS.flatMap((kind) => expressionLayouts(kind).map(({ id: layout }) => {
    const base = createExpressionDocument(kind, brand, kind === 'slides' ? { deck: [{ layout }] } : { layout });
    const pageId = base.pageIds[0]!;
    return { brand, document: base, kind, layout, pageId };
  })));
}

describe('expression type scale', () => {
  it('keeps a 16:9 slide title within 6–8% of the height and steps by a perfect fourth', () => {
    const scale = expressionTypeScale('slides', 1600, 900);
    expect(scale.title / 900).toBeGreaterThanOrEqual(0.06);
    expect(scale.title / 900).toBeLessThanOrEqual(0.08);
    expect(scale.headline).toBeLessThan(scale.title);
    expect(scale.title / scale.headline).toBeCloseTo(TYPE_RATIO, 1);
    expect(scale.body).toBeGreaterThanOrEqual(18);
  });

  it('tightens display sizes, leaves reading sizes alone, and is never positive', () => {
    const scale = expressionTypeScale('social', 1200, 630);
    expect(trackingFor(scale.hero, scale)).toBeLessThanOrEqual(-0.01);
    expect(trackingFor(scale.hero, scale)).toBeGreaterThanOrEqual(-0.025);
    expect(trackingFor(scale.body, scale)).toBe(0);
    expect(trackingFor(scale.title, scale, { code: true })).toBe(0);
    for (const size of [8, 14, 24, 40, 60, 90, 140]) expect(trackingFor(size, scale)).toBeLessThanOrEqual(0);
  });

  it('sets every template text layer with size-tuned tracking and no positive spacing', () => {
    for (const { document, pageId } of everyPage()) {
      for (const element of pageElements(document, pageId)) {
        if (element.kind !== 'text' || !element.textStyle) continue;
        expect(element.textStyle.letterSpacing, `${document.id} ${element.id}`).toBeLessThanOrEqual(0);
        expect(element.textStyle.letterSpacing).toBeGreaterThanOrEqual(-0.025);
      }
    }
  });
});

describe('expression templates without eyebrows', () => {
  it('never places a kicker, issue label, brand name, or numbered label above content', () => {
    for (const { document, layout, pageId } of everyPage()) {
      const slots = pageElements(document, pageId).map((element) => elementSlot(element) ?? '');
      expect(slots, `${document.id} ${layout}`).not.toContain('kicker');
      expect(slots).not.toContain('brand-name');
      expect(slots).not.toContain('issue');
      // Numbers survive only as list markers on the agenda.
      if (layout !== 'agenda') expect(slots.some((slot) => slot.startsWith('number-'))).toBe(false);
    }
  });

  it('keeps headlines on the scale: slide titles ≤ 8% of the height, content headlines smaller', () => {
    for (const { brand, document, layout, pageId } of everyPage().filter(({ kind }) => kind === 'slides')) {
      const headline = slotElement(document, pageId, 'headline');
      if (!headline?.textStyle) continue;
      expect(headline.textStyle.fontSize, `${brand.id} ${layout}`).toBeLessThanOrEqual(900 * 0.08);
      if (!['title', 'section', 'statement', 'quote', 'closing'].includes(layout)) expect(headline.textStyle.fontSize).toBeLessThanOrEqual(900 * 0.06);
    }
  });
});

describe('expression logos', () => {
  it('measures every bundled logo with an ink box inside its artwork', () => {
    for (const [path, { aspect, ink }] of Object.entries(LOGO_ARTWORK)) {
      expect(aspect, path).toBeGreaterThan(0);
      expect(ink[0]).toBeLessThan(ink[2]);
      expect(ink[1]).toBeLessThan(ink[3]);
    }
  });

  it('gives wide wordmarks less height and more width than square marks', () => {
    const mark = opticalLogoSize(1, 48);
    const wordmark = opticalLogoSize(6, 48);
    expect(wordmark.height).toBeLessThan(mark.height);
    expect(wordmark.width).toBeGreaterThan(mark.width * 2);
    expect(opticalLogoSize(8, 48, 120).width).toBe(120);
  });

  it('places artwork so its ink, not its padding, fills the layer box', () => {
    const ink = [0.1, 0.25, 0.9, 0.75] as const;
    const placed = placeInk({ height: 50, width: 200, x: 10, y: 20 }, 1, ink, 'start');
    const visibleWidth = placed.width * (ink[2] - ink[0]);
    const visibleHeight = placed.height * (ink[3] - ink[1]);
    expect(visibleWidth / visibleHeight).toBeCloseTo(inkAspect(1, ink), 5);
    expect(placed.x + ink[0] * placed.width).toBeCloseTo(10, 5);
    expect(placed.y + ink[1] * placed.height + visibleHeight / 2).toBeCloseTo(45, 5);
  });

  it('signs every slide with a logo whose ink is at least 2% of the slide height', () => {
    for (const brand of BUILT_IN_BRAND_IDENTITIES) {
      const document = createExpressionDocument('slides', brand, { deck: [{ layout: 'agenda' }] });
      const logo = slotElement(document, document.pageIds[0]!, 'logo')!;
      expect(logo.bounds.height, brand.id).toBeGreaterThanOrEqual(900 * 0.02);
      const markup = renderExpressionElement(logo, contextFor(document, brand.id));
      expect(markup).toContain('preserveAspectRatio="none"');
    }
  });
});

describe('expression proof and comparison content', () => {
  it('sets non-numeric proof as a logo wall instead of names posing as figures', () => {
    const gt = createExpressionDocument('slides', identity('gt'), { deck: [{ layout: 'metrics' }] });
    const pageId = gt.pageIds[0]!;
    expect(slotElement(gt, pageId, 'metric-1')).toBeNull();
    const wall = pageElements(gt, pageId).find((element) => elementComponent(element) === 'lockup')!;
    expect(readLockupPartners(wall).map(({ label }) => label)).toEqual(identity('gt').proofAssets.map(({ label }) => label));
    const ramp = createExpressionDocument('slides', identity('ramp'), { deck: [{ layout: 'metrics' }] });
    expect(slotElement(ramp, ramp.pageIds[0]!, 'metric-1')?.content).toBe('70,000+');
  });

  it('compares the identity challenge with its promise, labelled after the content', () => {
    const stripe = identity('stripe');
    const document = createExpressionDocument('slides', stripe, { deck: [{ layout: 'comparison' }] });
    const pageId = document.pageIds[0]!;
    expect(slotElement(document, pageId, 'item-2')?.content).toBe(stripe.strategy.promise);
    expect(slotElement(document, pageId, 'item-1')?.content).toBe(`${stripe.strategy.challenge.split(/[—;:]/)[0]!.trim().replace(/[.,]$/, '')}.`);
    const label = slotElement(document, pageId, 'label-1')!;
    expect(label.bounds.y).toBeGreaterThan(slotElement(document, pageId, 'item-1')!.bounds.y);
  });

  it('keeps proof walls and figures when a slide changes layout and back', () => {
    const gt = createExpressionDocument('slides', identity('gt'), { deck: [{ layout: 'metrics' }] });
    const pageId = gt.pageIds[0]!;
    const back = applyExpressionLayout(applyExpressionLayout(gt, pageId, 'agenda', identity('gt')), pageId, 'metrics', identity('gt'));
    expect(pageElements(back, pageId).some((element) => elementComponent(element) === 'lockup')).toBe(true);
  });
});

describe('terminal code', () => {
  it('sizes code at least at the format body size and lets the window fill the card', () => {
    for (const brand of BUILT_IN_BRAND_IDENTITIES) {
      const document = createExpressionDocument('terminal', brand, { layout: 'card' });
      const code = pageElements(document, document.pageIds[0]!).find((element) => elementComponent(element) === 'code')!;
      expect(code.textStyle!.fontSize, brand.id).toBeGreaterThanOrEqual(expressionTypeScale('social', 1200, 630).body);
      expect(code.bounds.y + code.bounds.height, brand.id).toBeGreaterThan(630 * 0.85);
    }
  });

  it('wraps long lines after punctuation with an indented continuation', () => {
    const measure = (text: string) => text.length * 10;
    const rows = wrapCodeLines([[{ color: '#fff', content: '  const value = await client.call(first, second);' }]], 260, measure);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row) => measure(row.tokens.map(({ content }) => content).join('')) <= 260)).toBe(true);
    expect(rows[1]!.continuation).toBe(true);
    expect(rows[1]!.tokens[0]!.content).toBe('    ');
    expect(rows.map((row) => row.line)).toEqual(rows.map(() => 1));
  });
});

describe('kerning in rendered text', () => {
  it('turns kerning on and sets optical size from the export size', () => {
    const document = createExpressionDocument('opengraph', identity('mintlify'));
    const headline = slotElement(document, document.pageIds[0]!, 'headline')!;
    const markup = renderExpressionElement(headline, contextFor(document, 'mintlify'));
    expect(markup).toContain("font-kerning:normal;font-feature-settings:'kern' 1");
    expect(markup).toMatch(/font-variation-settings:'opsz' \d+/);
  });
});

describe('brand pattern backgrounds', () => {
  it('draws the brand pattern in a contrasting brand colour at a readable scale', () => {
    const settings = { ...DEFAULT_BACKGROUND_SETTINGS, ...brandPatternSettings(identity('starter'), 1600, 900), height: 900, style: 'pattern' as const, width: 1600 };
    expect(settings.spacing).toBeGreaterThanOrEqual(56);
    expect(settings.patternOpacity).toBeGreaterThanOrEqual(50);
    const svg = buildBackgroundSvg(settings);
    expect(svg).toContain('id="pattern-crosshatch"');
    // A wide pattern draws heavier lines than the 1px hairline it starts from.
    expect(/stroke-width="([\d.]+)"/.exec(svg.slice(svg.indexOf('pattern-crosshatch')))![1]).not.toBe('0.55');
  });
});

describe('wrapCodeLines cost', () => {
  type Token = { color: string; content: string };
  type Row = { continuation: boolean; line: number; tokens: Token[] };

  /** The previous implementation, kept as a behaviour oracle. */
  function oracleWrap(lines: readonly Token[][], room: number, m: (text: string) => number): Row[] {
    const BREAK = /[\s,;(){}[\]=>.+\-*/|&:]/;
    const slice = (tokens: readonly Token[], start: number, end: number): Token[] => {
      const result: Token[] = [];
      let offset = 0;
      for (const token of tokens) {
        const from = Math.max(start, offset);
        const to = Math.min(end, offset + token.content.length);
        if (to > from) result.push({ color: token.color, content: token.content.slice(from - offset, to - offset) });
        offset += token.content.length;
      }
      return result;
    };
    const cut = (rest: string, prefix: string): number => {
      let low = 1;
      let high = rest.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (m(prefix + rest.slice(0, middle)) <= room) low = middle;
        else high = middle - 1;
      }
      for (let back = low; back > low * 0.5; back -= 1) {
        if (BREAK.test(rest[back - 1]!)) return back;
      }
      return low;
    };
    return lines.flatMap((tokens, index) => {
      const text = tokens.map(({ content }) => content).join('');
      const indent = `${/^\s*/.exec(text)![0]}  `;
      const rows: Row[] = [];
      let start = 0;
      do {
        const prefix = rows.length > 0 ? indent : '';
        const rest = text.slice(start);
        const end = m(prefix + rest) <= room || rest.length <= 1 ? rest.length : cut(rest, prefix);
        rows.push({
          continuation: Boolean(prefix),
          line: index + 1,
          tokens: [...(prefix ? [{ color: tokens[0]?.color ?? '', content: prefix }] : []), ...slice(tokens, start, start + end)],
        });
        start += end;
        while (text[start] === ' ') start += 1;
      } while (start < text.length);
      return rows;
    });
  }

  it('produces the same rows as the previous implementation on generated lines', () => {
    const m = (text: string) => text.length * 7;
    const alphabet = 'ab;,(){}=>+  ';
    let seed = 42;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const lines: Token[][] = Array.from({ length: 40 }, () => {
      const indent = ' '.repeat(Math.floor(next() * 8));
      const body = Array.from({ length: 10 + Math.floor(next() * 200) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');
      return next() < 0.3
        ? [{ color: '#fff', content: indent + body }, { color: '#f0f', content: '// tail' }]
        : [{ color: '#fff', content: indent + body }];
    });
    for (const room of [200, 340, 900]) {
      expect(wrapCodeLines(lines, room, m), `room ${room}`).toEqual(oracleWrap(lines, room, m));
    }
  });

  it('drops the continuation indent when it is wider than half the row', () => {
    const m = (text: string) => text.length * 10;
    const indent = `${' '.repeat(40)}  `;
    const lines: Token[][] = [[{ color: '#fff', content: `${' '.repeat(40)}${'return '.repeat(20)}value;` }]];
    const rows = wrapCodeLines(lines, 600, m);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.slice(1).every((row) => row.continuation && row.tokens[0]?.content !== indent)).toBe(true);
  });

  it('measures a bounded amount of text while wrapping a very long line', () => {
    const source = 'word '.repeat(40_000);
    let measured = 0;
    const counting = (text: string) => {
      measured += text.length;
      return text.length * 5;
    };
    const rows = wrapCodeLines([[{ color: '#fff', content: source }]], 500, counting);
    expect(rows.length).toBeGreaterThan(10);
    expect(measured).toBeLessThanOrEqual(64 * source.length);
  });

  it('does not wrap one character per row behind a huge indent', () => {
    const source = `${' '.repeat(10_000)}return done();`;
    let measured = 0;
    const counting = (text: string) => {
      measured += text.length;
      return text.length * 5;
    };
    const rows = wrapCodeLines([[{ color: '#fff', content: source }]], 500, counting);
    expect(rows.length).toBeLessThan(500);
    expect(measured).toBeLessThanOrEqual(64 * source.length);
  });

  it('stops after maxRows rows', () => {
    const m = (text: string) => text.length * 10;
    const lines: Token[][] = [[{ color: '#fff', content: 'alpha beta gamma delta '.repeat(20) }]];
    expect(wrapCodeLines(lines, 100, m, 3)).toHaveLength(3);
  });
});
