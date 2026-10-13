import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';
import { serializeCanvasDocument } from '../canvasDocument';
import {
  activeCodeTab,
  elementComponent,
  expressionState,
  pageElements,
  pageSettings,
  readLockupPartners,
  slotElement,
} from '../expressionModel';
import { expressionMirrors, parseExpressionSource, slideItems, withExpressionMirrors } from '../expressionSource';
import { createExpressionDocument } from '../expressionTemplates';
import { DEFAULT_LOGO_APPEARANCE } from '../logoAppearance';
import { createStudioCanvasDocument } from '../studioCanvasDocument';

const gt = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;
const stripe = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'stripe')!;

function legacyDocument(toolId: string, state: object, layers: Parameters<typeof createStudioCanvasDocument>[0]['layers'] = []) {
  return serializeCanvasDocument(createStudioCanvasDocument({
    background: '#FFFFFF',
    brandId: 'gt',
    createdAt: '2026-01-01T00:00:00.000Z',
    height: 630,
    id: `gt:${toolId}:legacy`,
    layers,
    revision: 3,
    state,
    title: 'Legacy',
    toolId,
    updatedAt: '2026-01-01T00:00:00.000Z',
    width: 1200,
  }), { portable: false });
}

function code(document: ReturnType<typeof parseExpressionSource>) {
  return pageElements(document, document.pageIds[0]!).find((element) => elementComponent(element) === 'code')!;
}

describe('expression source', () => {
  it('round-trips the current source version without changing content', () => {
    for (const kind of ['opengraph', 'terminal', 'partnership', 'blog', 'slides'] as const) {
      const document = withExpressionMirrors(createExpressionDocument(kind, stripe));
      const source = serializeCanvasDocument(document, { portable: false });
      const parsed = parseExpressionSource(source, kind, kind, stripe);
      expect(parsed.pageIds).toEqual(document.pageIds);
      expect(Object.keys(parsed.elements).sort()).toEqual(Object.keys(document.elements).sort());
      for (const id of Object.keys(document.elements)) {
        expect(parsed.elements[id]!.content).toBe(document.elements[id]!.content);
        expect(parsed.elements[id]!.bounds).toEqual(document.elements[id]!.bounds);
      }
      expect(expressionMirrors(parsed)).toEqual(expressionMirrors(document));
    }
  });

  it('applies flat mirror edits so earlier automation keeps working', () => {
    const terminal = withExpressionMirrors(createExpressionDocument('terminal', gt));
    const edited = JSON.parse(serializeCanvasDocument(terminal, { portable: false }));
    edited.metadata.studio.state.title = 'Edited title';
    edited.metadata.studio.state.code = 'const edited = true;';
    const parsed = parseExpressionSource(JSON.stringify(edited), 'terminal', 'terminal', gt);
    expect(slotElement(parsed, parsed.pageIds[0]!, 'title')?.content).toBe('Edited title');
    expect(activeCodeTab(code(parsed))?.code).toBe('const edited = true;');
    expect(expressionState(withExpressionMirrors(parsed))).toMatchObject({ code: 'const edited = true;', title: 'Edited title' });

    const slides = withExpressionMirrors(createExpressionDocument('slides', gt, { deck: [{ layout: 'agenda' }] }));
    const slideSource = JSON.parse(serializeCanvasDocument(slides, { portable: false }));
    slideSource.metadata.studio.state.body = 'One\nTwo\nThree';
    const parsedSlides = parseExpressionSource(JSON.stringify(slideSource), 'slides', 'slides', gt);
    expect(slideItems(parsedSlides, parsedSlides.pageIds[0]!)).toEqual(['One', 'Two', 'Three']);
  });

  it('rejects another tool’s document and malformed layers', () => {
    const blog = serializeCanvasDocument(createExpressionDocument('blog', gt), { portable: false });
    expect(() => parseExpressionSource(blog, 'slides', 'slides', gt)).toThrow('blog document, not slides');
    const broken = JSON.parse(serializeCanvasDocument(createExpressionDocument('terminal', gt), { portable: false }));
    const codeId = Object.keys(broken.elements).find((id) => broken.elements[id].data.component === 'code')!;
    broken.elements[codeId].data.tabs = [];
    expect(() => parseExpressionSource(JSON.stringify(broken), 'terminal', 'terminal', gt)).toThrow('at least one tab');
  });

  it('migrates a version-1 OpenGraph workspace with its uploads, logo placement, and font', () => {
    const source = legacyDocument('opengraph', {
      background: { asset: null, assetId: 'none', opacity: 80, scale: 120, x: 10, y: -5 },
      customFont: { name: 'Brand.woff2', url: 'data:font/woff2;base64,Zm9udA==' },
      fontRole: 'Body',
      fontWeight: 450,
      logo: { appearance: { ...DEFAULT_LOGO_APPEARANCE, invert: true }, asset: null, assetId: 'mark-light', scale: 150, x: 12, y: 8 },
      surface: 'dark',
      title: 'Legacy social card',
    }, [
      { asset: { name: 'Upload', source: 'data:image/png;base64,Ymc=' }, bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 }, id: 'opengraph-background', kind: 'image', name: 'Supporting image' },
    ]);
    const document = parseExpressionSource(source, 'opengraph', 'opengraph', gt);
    const pageId = document.pageIds[0]!;
    const headline = slotElement(document, pageId, 'headline')!;
    expect(headline.content).toBe('Legacy social card');
    expect(headline.textStyle).toMatchObject({ fontRole: 'Body', fontWeight: 450 });
    expect(headline.textStyle?.fontId).toMatch(/^font:upload-/);
    expect(pageSettings(document, pageId).surface).toBe('ink');
    const logo = slotElement(document, pageId, 'logo')!;
    expect(logo.bounds).toMatchObject({ height: 78, width: 78, x: 71, y: 59 });
    expect(logo.data.appearance).toMatchObject({ invert: true });
    const media = slotElement(document, pageId, 'media')!;
    expect(media.kind).toBe('image');
    expect(media.style.opacity).toBe(0.8);
    expect(media.data).toMatchObject({ panX: 0.1, panY: -0.05, zoom: 1.2 });
    expect(document.assets[media.assetId!]?.source).toBe('data:image/png;base64,Ymc=');
  });

  it('migrates a version-1 terminal card to one tab with its language, code, and fonts', () => {
    const source = legacyDocument('terminal', {
      background: { assetId: 'none', opacity: 14 },
      code: 'print("hi")',
      codeTypography: { role: 'Code', weight: 500 },
      language: 'python',
      title: 'Legacy terminal',
      titleTypography: { role: 'Body', weight: 400 },
    });
    const document = parseExpressionSource(source, 'terminal', 'terminal', gt);
    const element = code(document);
    expect(activeCodeTab(element)).toMatchObject({ code: 'print("hi")', language: 'python', name: 'Python' });
    expect(element.data.theme).toBe('github-dark');
    expect(slotElement(document, document.pageIds[0]!, 'title')).toMatchObject({ content: 'Legacy terminal', textStyle: { fontRole: 'Body', fontWeight: 400 } });
    expect(() => parseExpressionSource(JSON.stringify({ language: 'cobol' }), 'terminal', 'terminal', gt)).toThrow('language');
  });

  it('migrates version-1 templates: slides layout and list, texture, and a partnership lockup', () => {
    const slides = parseExpressionSource(JSON.stringify({
      body: 'Discover\nDesign\nShip',
      slideLayout: 'timeline',
      texture: { opacity: 50, type: 'grid' },
      title: 'From idea to launch',
    }), 'slides', 'slides', gt);
    const pageId = slides.pageIds[0]!;
    expect(slides.pageIds).toHaveLength(1);
    expect(pageSettings(slides, pageId).layout).toBe('timeline');
    expect(slideItems(slides, pageId)).toEqual(['Discover', 'Design', 'Ship']);
    expect(slotElement(slides, pageId, 'headline')?.content).toBe('From idea to launch');
    expect(slotElement(slides, pageId, 'texture')?.data.texture).toBe('grid');

    const partnership = parseExpressionSource(JSON.stringify({
      partner: { gap: 20, id: 'cursor', name: 'Cursor', treatment: 'text' },
      partnerRenderingVersion: 2,
      texture: { opacity: 100, type: 'dark' },
      title: 'General Translation × Cursor',
    }), 'partnership', 'partnership', gt);
    const lockup = pageElements(partnership, partnership.pageIds[0]!).find((element) => elementComponent(element) === 'lockup')!;
    const partners = readLockupPartners(lockup);
    expect(partners).toHaveLength(2);
    expect(partners[1]).toMatchObject({ kind: 'text', label: 'Cursor' });
    expect(lockup.data.gap).toBe(28);
    expect(pageSettings(partnership, partnership.pageIds[0]!).surface).toBe('ink');
  });
});
