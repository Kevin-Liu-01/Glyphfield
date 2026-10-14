import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';
import { buildPdf, deflate, rgbaToRgb } from '../expressionExport';
import { addExpressionLayer, updateExpressionLayer } from '../expressionOperations';
import { patchElement, slotElement, pageElements, elementComponent } from '../expressionModel';
import {
  buildExpressionPageSvg,
  estimateTextWidth,
  highlightCodeLines,
  layoutExpressionText,
  layoutLockup,
  renderExpressionElement,
  resolveCodeTheme,
  resolveTextTokens,
  type ExpressionRenderContext,
} from '../expressionSvg';
import { addLockupPartner, setLockupPartner, updateLockup } from '../expressionToolOperations';
import { createExpressionDocument, expressionColors } from '../expressionTemplates';
import { colorContrastRatio } from '../color';

const gt = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;
const tailwind = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'tailwind')!;

function contextFor(document: ReturnType<typeof createExpressionDocument>, identity = gt, pageIndex = 0): ExpressionRenderContext {
  return {
    assetSource: (id) => (id ? document.assets[id]?.source ?? null : null),
    colors: expressionColors(identity),
    fontFamily: (_id, family) => `"${family}", Inter, Arial, sans-serif`,
    greetings: identity.greetings,
    idPrefix: 'p',
    measure: estimateTextWidth,
    pageCount: document.pageIds.length,
    pageIndex,
    products: identity.products,
    proof: identity.proof,
  };
}

describe('expression renderer', () => {
  it('renders every layer of every template as one SVG with escaped text', () => {
    for (const kind of ['opengraph', 'terminal', 'partnership', 'blog', 'slides'] as const) {
      const document = createExpressionDocument(kind, tailwind);
      for (const [index, pageId] of document.pageIds.entries()) {
        const svg = buildExpressionPageSvg(document, pageId, contextFor(document, tailwind, index), [{ family: 'x1', source: 'data:font/woff2;base64,AA==' }]);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg).toContain('<![CDATA[@font-face{font-family:"x1"');
        for (const element of pageElements(document, pageId)) expect(svg).toContain(`data-element-id="${element.id}"`);
      }
    }
    const document = createExpressionDocument('blog', gt);
    const headline = slotElement(document, document.pageIds[0]!, 'headline')!;
    const escaped = patchElement(document, headline.id, { content: 'A&B <launch>' });
    expect(renderExpressionElement(escaped.elements[headline.id]!, contextFor(escaped))).toContain('A&amp;B &lt;launch&gt;');
  });

  it('wraps, shrinks, aligns, rotates, and numbers text', () => {
    let document = createExpressionDocument('slides', gt);
    const pageId = document.pageIds[0]!;
    const headline = slotElement(document, pageId, 'headline')!;
    document = updateExpressionLayer(document, headline.id, { align: 'center', bounds: { rotation: 30 }, content: 'Every language moves with the product it describes, line by line' }, gt);
    const element = document.elements[headline.id]!;
    const layout = layoutExpressionText(element, contextFor(document));
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.fontSize).toBeLessThanOrEqual(element.textStyle!.fontSize);
    expect(layout.overflow).toBe(false);
    const svg = renderExpressionElement(element, contextFor(document));
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toMatch(/transform="rotate\(30 /);
    expect(resolveTextTokens('{page} / {pages}', { pageCount: 12, pageIndex: 2 })).toBe('03 / 12');
  });

  it('draws multi-tab code windows with highlighted lines and brand themes that stay readable', () => {
    const document = createExpressionDocument('terminal', gt);
    const code = pageElements(document, document.pageIds[0]!).find((element) => elementComponent(element) === 'code')!;
    const svg = renderExpressionElement(code, contextFor(document));
    expect(svg).toContain('greeting.tsx');
    expect(svg).toContain('Terminal');
    expect(svg).toContain('opacity="0.14"');
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      for (const themeId of ['brand-dark', 'brand-light']) {
        const theme = resolveCodeTheme(themeId, expressionColors(identity));
        expect(colorContrastRatio(theme.foreground, theme.background), `${identity.id} ${themeId}`).toBeGreaterThanOrEqual(4.5);
        for (const [type, color] of Object.entries(theme.tokens)) {
          expect(colorContrastRatio(color, theme.background), `${identity.id} ${themeId} ${type}`).toBeGreaterThanOrEqual(type === 'comment' || type === 'punctuation' ? 3 : 4.5);
        }
      }
    }
    const lines = highlightCodeLines('const a = "b";\n// c', 'typescript', resolveCodeTheme('brand-dark', expressionColors(gt)));
    expect(lines).toHaveLength(2);
    expect(lines[0]!.map(({ content }) => content).join('')).toBe('const a = "b";');
  });

  it('balances three or more partners optically and follows lockup rules', () => {
    let document = createExpressionDocument('partnership', gt);
    const pageId = document.pageIds[0]!;
    const lockup = pageElements(document, pageId).find((element) => elementComponent(element) === 'lockup')!;
    document = addLockupPartner(document, lockup.id, gt, { partnerId: 'cursor' }).document;
    document = addLockupPartner(document, lockup.id, gt, { kind: 'text', label: 'Acme' }).document;
    document = setLockupPartner(document, lockup.id, 'partner-1', { aspect: 1 });
    document = updateLockup(document, lockup.id, { justify: 'center', separator: '|', sizing: 'optical' }, gt);
    const updated = document.elements[lockup.id]!;
    const layout = layoutLockup(updated, contextFor(document));
    expect(layout.partners).toHaveLength(4);
    const square = layout.boxes[1]!;
    const wide = layout.boxes[2]!;
    expect(square.height).toBeGreaterThan(wide.height);
    expect(Math.abs(square.width * square.height - wide.width * wide.height) / (square.width * square.height)).toBeLessThan(0.35);
    expect(layout.natural * layout.scale).toBeLessThanOrEqual(updated.bounds.width + 0.5);
    const svg = renderExpressionElement(updated, contextFor(document));
    expect(svg.match(/data-lockup-partner=/g)).toHaveLength(4);
    expect(svg).toContain('stroke-opacity="0.32"');
    expect(() => updateLockup(document, lockup.id, { separator: '&' }, gt)).toThrow('separator');
  });

  it('renders added shapes, dividers, textures, devices, and shader stills', () => {
    let document = createExpressionDocument('opengraph', gt);
    const pageId = document.pageIds[0]!;
    for (const kind of ['shape', 'divider', 'texture', 'device', 'shader'] as const) {
      const result = addExpressionLayer(document, pageId, { kind }, gt);
      document = result.document;
      const svg = renderExpressionElement(document.elements[result.id]!, contextFor(document));
      expect(svg.length, kind).toBeGreaterThan(40);
    }
    const shader = pageElements(document, pageId).find((element) => element.kind === 'shader')!;
    expect(renderExpressionElement(shader, contextFor(document))).toContain('/shader-previews/');
  });
});

describe('expression PDF writer', () => {
  it('writes one lossless page image per slide with a valid cross-reference table', async () => {
    const rgb = rgbaToRgb(new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]));
    expect([...rgb]).toEqual([255, 0, 0, 255, 255, 255]);
    const deflated = await deflate(rgb);
    const pdf = buildPdf([
      { deflated, height: 900, pixelHeight: 1, pixelWidth: 2, width: 1600 },
      { deflated, height: 900, pixelHeight: 1, pixelWidth: 2, width: 1600 },
    ], 'Deck (draft)');
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/MediaBox [0 0 1200 675]');
    expect(text).toContain('/Title (Deck draft)');
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    offsets.forEach((offset, index) => expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`)));
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
