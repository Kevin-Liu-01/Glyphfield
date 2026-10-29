import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';
import { buildPdf, deflate, rgbaToRgb } from '../expressionExport';
import { addExpressionLayer, updateExpressionLayer } from '../expressionOperations';
import { activeCodeTab, patchElement, resolveExpressionColor, slotElement, pageElements, elementComponent } from '../expressionModel';
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
import { serializeCanvasDocument } from '../canvasDocument';
import { parseExpressionSource, setCodeTab } from '../expressionSource';
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

  it('badges code tabs with the real TypeScript, Python, and Bash artwork', () => {
    let document = createExpressionDocument('terminal', gt);
    const code = pageElements(document, document.pageIds[0]!).find((element) => elementComponent(element) === 'code')!;
    expect(renderExpressionElement(code, contextFor(document))).toContain('data-language-icon="bash"');
    document = setCodeTab(document, code.id, activeCodeTab(code)!.id, { code: 'print("hello")', language: 'python' });
    const svg = renderExpressionElement(document.elements[code.id]!, contextFor(document));
    expect(svg).toContain('data-language-icon="python"');
    expect(svg).toContain('stop-color="#387EB8"');
    expect(svg).toContain('stop-color="#FFE052"');
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

describe('expression markup safety', () => {
  type DraftElement = { data: Record<string, unknown>; kind: string; textStyle?: Record<string, unknown> };
  type DraftDocument = {
    elements: Record<string, DraftElement>;
    pageIds: string[];
    pages: Record<string, { background: string }>;
  };

  function tamperedDocument(
    kind: Parameters<typeof createExpressionDocument>[0],
    edit: (draft: DraftDocument) => void
  ) {
    const draft = JSON.parse(serializeCanvasDocument(createExpressionDocument(kind, gt), { portable: false })) as DraftDocument;
    edit(draft);
    return parseExpressionSource(JSON.stringify(draft), kind, kind, gt);
  }

  it('escapes a stored textStyle color that tries to break out of the fill attribute', () => {
    const document = tamperedDocument('blog', (draft) => {
      const headline = Object.values(draft.elements).find((element) => element.kind === 'text')!;
      headline.textStyle!.color = '#000" onload="alert(1)';
      headline.textStyle!.tokenBound = false;
      delete headline.data.fill;
    });
    const element = Object.values(document.elements).find((candidate) => candidate.kind === 'text')!;
    const markup = renderExpressionElement(element, contextFor(document));
    expect(markup).not.toContain('<script');
    expect(markup).not.toContain('onload=');
    expect(markup).toContain('fill="#000000"');
  });

  it('rejects a stored page background that tries to inject markup', () => {
    const document = tamperedDocument('opengraph', (draft) => {
      draft.pages[draft.pageIds[0]!].background = '#fff"/><script>alert(1)</script><rect fill="';
    });
    const markup = buildExpressionPageSvg(document, document.pageIds[0]!, contextFor(document));
    expect(markup).not.toContain('<script');
    expect(markup).toContain('fill="#FFFFFF"');
  });

  it('normalizes a stored logo appearance before it reaches the SVG filter', () => {
    const document = tamperedDocument('opengraph', (draft) => {
      const logo = Object.values(draft.elements).find((element) => element.data.slot === 'logo')!;
      logo.data.appearance = { shadowEnabled: true, shadowOffsetX: '0"/><script>alert(1)</script><x a="' };
    });
    const logo = Object.values(document.elements).find((candidate) => candidate.data.slot === 'logo')!;
    const markup = renderExpressionElement(logo, contextFor(document));
    expect(markup).not.toContain('<script');
    expect(markup).toContain('dx="0"');
  });

  it('resolves expression colors without returning unvalidated strings', () => {
    const colors = { emphasis: '#D7FF64', ink: '#101010' };
    expect(resolveExpressionColor('ink', colors, '#000000')).toBe('#101010');
    expect(resolveExpressionColor('#a1b2c3', colors, '#000000')).toBe('#A1B2C3');
    expect(resolveExpressionColor(undefined, colors, '#abcdef')).toBe('#abcdef');
    expect(resolveExpressionColor('missing', colors, '#ABCDEF')).toBe('#ABCDEF');
    expect(resolveExpressionColor(undefined, colors, '#000" onload="x"')).toBe('#000000');
    expect(resolveExpressionColor('missing', colors, 'not a color')).toBe('#000000');
    expect(resolveExpressionColor('constructor', colors, '#112233')).toBe('#112233');
    expect(resolveExpressionColor('toString', colors, '#112233')).toBe('#112233');
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
