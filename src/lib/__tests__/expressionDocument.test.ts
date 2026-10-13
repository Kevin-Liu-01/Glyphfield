import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';
import { parseCanvasDocument, preflightCanvasDocument } from '../canvasDocument';
import {
  duplicateElements,
  duplicatePage,
  EXPRESSION_TOOL_KINDS,
  expressionState,
  movePage,
  pageElements,
  pageSettings,
  removeElements,
  removePage,
  reorderElement,
  slotElement,
} from '../expressionModel';
import { addExpressionLayer, alignExpressionLayers, describeExpressionDocument, updateExpressionLayer } from '../expressionOperations';
import { estimateTextWidth, layoutExpressionText, type ExpressionRenderContext } from '../expressionSvg';
import {
  applyExpressionLayout,
  createExpressionDocument,
  expressionColors,
  expressionLayouts,
  expressionRecipe,
  newSlidePage,
  setExpressionFormat,
  setPageSurface,
} from '../expressionTemplates';

const gt = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;
const ramp = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'ramp')!;

function context(identityId = 'gt'): ExpressionRenderContext {
  const identity = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === identityId)!;
  return {
    assetSource: () => null,
    colors: expressionColors(identity),
    fontFamily: (_id, family) => family,
    greetings: identity.greetings,
    idPrefix: 'test',
    measure: estimateTextWidth,
    pageCount: 1,
    pageIndex: 0,
    products: identity.products,
    proof: identity.proof,
  };
}

describe('expression documents', () => {
  it('builds a valid, self-describing document for every tool and identity', () => {
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      for (const kind of EXPRESSION_TOOL_KINDS) {
        const document = createExpressionDocument(kind, identity);
        const reparsed = parseCanvasDocument(JSON.stringify(document));
        expect(reparsed.pageIds).toEqual(document.pageIds);
        const state = expressionState(document);
        expect(state.kind).toBe(kind);
        expect(state.expressionVersion).toBe(2);
        for (const pageId of document.pageIds) {
          const elements = pageElements(document, pageId);
          expect(elements.length).toBeGreaterThan(2);
          expect(slotElement(document, pageId, 'background')?.locked).toBe(true);
          for (const element of elements) {
            if (element.textStyle) expect(document.assets[element.textStyle.fontId], `${identity.id} ${kind} ${element.id}`).toBeDefined();
            if (element.assetId) expect(document.assets[element.assetId]).toBeDefined();
          }
        }
        expect(preflightCanvasDocument(document).filter(({ type }) => type === 'missing-asset' || type === 'missing-font')).toEqual([]);
      }
    }
  });

  it('starts slides as a real deck and keeps the identity in every template', () => {
    const deck = createExpressionDocument('slides', ramp);
    expect(deck.pageIds.length).toBeGreaterThanOrEqual(4);
    const layouts = deck.pageIds.map((pageId) => pageSettings(deck, pageId).layout);
    expect(layouts[0]).toBe('title');
    expect(layouts).toContain('metrics');
    const metrics = deck.pageIds[layouts.indexOf('metrics')]!;
    expect(slotElement(deck, metrics, 'metric-1')?.content).toBe('70,000+');
    expect(expressionRecipe(ramp).device).toBe('ledger');
    const opengraph = createExpressionDocument('opengraph', gt);
    expect(slotElement(opengraph, opengraph.pageIds[0]!, 'headline')?.content).toBe('Every language. One source.');
    expect(slotElement(opengraph, opengraph.pageIds[0]!, 'media')?.data.device).toBe('greetings');
  });

  it('keeps every headline inside its box at every format for every identity', () => {
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      for (const kind of EXPRESSION_TOOL_KINDS) {
        const base = createExpressionDocument(kind, identity);
        const formats = kind === 'slides' ? ['16x9', '4x3', 'square'] : ['opengraph', 'square', 'story', 'portrait'];
        for (const format of formats) {
          const document = setExpressionFormat(base, format, identity);
          for (const pageId of document.pageIds) {
            const headline = slotElement(document, pageId, 'headline') ?? slotElement(document, pageId, 'title');
            if (!headline) continue;
            const layout = layoutExpressionText(headline, context(identity.id));
            expect(layout.overflow, `${identity.id} ${kind} ${format} ${pageId}`).toBe(false);
            const page = document.pages[pageId]!;
            expect(headline.bounds.x).toBeGreaterThanOrEqual(0);
            expect(headline.bounds.x + headline.bounds.width).toBeLessThanOrEqual(page.width + 0.5);
          }
        }
      }
    }
  });

  it('re-flows layers into a layout while keeping content, ids, and hand-set style', () => {
    let document = createExpressionDocument('opengraph', gt);
    const pageId = document.pageIds[0]!;
    const headline = slotElement(document, pageId, 'headline')!;
    document = updateExpressionLayer(document, headline.id, { content: 'Ship every locale', fill: 'warning' }, gt);
    const dek = slotElement(document, pageId, 'dek')!;
    document = updateExpressionLayer(document, dek.id, { content: 'Custom supporting copy' }, gt);
    document = applyExpressionLayout(document, pageId, 'statement', gt);
    const moved = slotElement(document, pageId, 'headline')!;
    expect(moved.id).toBe(headline.id);
    expect(moved.content).toBe('Ship every locale');
    expect(moved.data.fill).toBe('warning');
    expect(moved.bounds).not.toEqual(headline.bounds);
    expect(slotElement(document, pageId, 'dek')).toBeNull();
    expect(pageSettings(document, pageId).stash?.dek).toBe('Custom supporting copy');
    document = applyExpressionLayout(document, pageId, 'split', gt);
    expect(slotElement(document, pageId, 'dek')?.content).toBe('Custom supporting copy');
  });

  it('keeps free layers on top and scales them with a new format', () => {
    let document = createExpressionDocument('blog', gt);
    const pageId = document.pageIds[0]!;
    const added = addExpressionLayer(document, pageId, { bounds: { height: 63, width: 120, x: 600, y: 315 }, kind: 'shape' }, gt);
    document = setExpressionFormat(added.document, 'square', gt);
    const page = document.pages[pageId]!;
    expect([page.width, page.height]).toEqual([1080, 1080]);
    expect(expressionState(document).format).toBe('square');
    const shape = document.elements[added.id]!;
    expect(document.pages[pageId]!.elementIds.at(-1)).toBe(added.id);
    expect(shape.bounds.x + shape.bounds.width / 2).toBeCloseTo(660 * 1080 / 1200, 0);
  });

  it('adds, edits, duplicates, reorders, aligns, and removes layers', () => {
    let document = createExpressionDocument('opengraph', ramp);
    const pageId = document.pageIds[0]!;
    const ids: string[] = [];
    for (const kind of ['text', 'image', 'logo', 'shape', 'divider', 'shader', 'texture', 'device'] as const) {
      const result = addExpressionLayer(document, pageId, { kind }, ramp);
      document = result.document;
      ids.push(result.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    const text = ids[0]!;
    document = updateExpressionLayer(document, text, { fontRole: 'Display', fontSize: 72, fontWeight: 900, letterSpacing: -0.02, lineHeight: 1, align: 'center', casing: 'uppercase', bounds: { rotation: 12 } }, ramp);
    const edited = document.elements[text]!;
    expect(edited.textStyle).toMatchObject({ align: 'center', casing: 'uppercase', fontRole: 'Display', fontSize: 72, fontWeight: 550 });
    expect(edited.bounds.rotation).toBe(12);
    expect(edited.data.styled).toEqual(expect.arrayContaining(['role', 'size', 'weight', 'tracking', 'lineHeight', 'align', 'casing']));
    expect(() => updateExpressionLayer(document, text, { fill: 'chartreuse' }, ramp)).toThrow('fill');
    const duplicated = duplicateElements(document, [text]);
    expect(duplicated.ids).toHaveLength(1);
    expect(duplicated.document.elements[duplicated.ids[0]!]!.bounds.x).toBe(edited.bounds.x + 24);
    document = reorderElement(duplicated.document, text, 'back');
    expect(document.pages[pageId]!.elementIds[0]).toBe(text);
    document = alignExpressionLayers(document, [text], 'right');
    expect(document.elements[text]!.bounds.x + document.elements[text]!.bounds.width).toBeCloseTo(1200, 1);
    const before = Object.keys(document.assets).length;
    document = removeElements(document, ids.slice(1));
    expect(Object.keys(document.assets).length).toBeLessThan(before);
    expect(describeExpressionDocument(document)[0]!.layers.map(({ id }) => id)).toContain(text);
  });

  it('manages a slide deck: add, duplicate, move, remove, and surfaces', () => {
    let document = createExpressionDocument('slides', gt);
    const count = document.pageIds.length;
    const added = newSlidePage(document, gt, 'timeline', 1);
    document = added.document;
    expect(document.pageIds[1]).toBe(added.pageId);
    expect(pageSettings(document, added.pageId).layout).toBe('timeline');
    const copy = duplicatePage(document, added.pageId);
    document = copy.document;
    expect(document.pageIds).toHaveLength(count + 2);
    expect(pageElements(document, copy.pageId).map(({ data }) => data.slot)).toEqual(pageElements(document, added.pageId).map(({ data }) => data.slot));
    document = movePage(document, copy.pageId, 0);
    expect(document.pageIds[0]).toBe(copy.pageId);
    document = removePage(document, copy.pageId);
    expect(document.pageIds).toHaveLength(count + 1);
    document = setPageSurface(document, document.pageIds[0]!, 'ink', gt);
    expect(document.pages[document.pageIds[0]!]!.background).toBe('#181818');
    expect(slotElement(document, document.pageIds[0]!, 'headline')?.data.fill).toBe('paper');
    expect(expressionLayouts('slides')).toHaveLength(14);
  });
});
