import { describe, expect, it, vi } from 'vitest';

import { createCanvasDocument, createCanvasElement, insertCanvasElement } from '../canvasDocument';
import { createCanvasRenderPlan, renderCanvasDocumentPage } from '../canvasRenderer';

function renderDocument() {
  let document = createCanvasDocument('render', 'gt', 'Render', 1000, 500, ['layers', 'pages']);
  const pageId = document.pageIds[0]!;
  document = insertCanvasElement(document, pageId, createCanvasElement('back', 'Back', 'shape', {
    height: 250,
    rotation: 12,
    width: 400,
    x: 100,
    y: 50,
  }));
  document = insertCanvasElement(document, pageId, {
    ...createCanvasElement('hidden', 'Hidden', 'text', {
      height: 100,
      rotation: 0,
      width: 200,
      x: 20,
      y: 20,
    }),
    hidden: true,
  });
  return document;
}

describe('canvas render plan', () => {
  it('uses canonical page order, visibility, background, and scaled geometry', () => {
    const document = renderDocument();
    const pageId = document.pageIds[0]!;
    document.pages[pageId]!.background = '#111216';
    const plan = createCanvasRenderPlan({
      document,
      height: 250,
      pageId,
      width: 500,
    });

    expect(plan.background).toBe('#111216');
    expect(plan.layers.map(({ element }) => element.id)).toEqual(['back']);
    expect(plan.layers[0]?.outputBounds).toEqual({
      height: 125,
      rotation: 12,
      width: 200,
      x: 50,
      y: 25,
    });
  });

  it('reports missing requested layers and paints each id at most once', () => {
    const document = renderDocument();
    const pageId = document.pageIds[0]!;
    const plan = createCanvasRenderPlan({
      document,
      elementIds: ['back', 'missing', 'back', 'hidden'],
      height: 500,
      pageId,
      width: 1000,
    });

    expect(plan.layers.map(({ element }) => element.id)).toEqual(['back']);
    expect(plan.missingElementIds).toEqual(['missing']);
  });

  it('rejects missing pages and invalid output dimensions', () => {
    const document = renderDocument();
    const pageId = document.pageIds[0]!;

    expect(() => createCanvasRenderPlan({ document, height: 100, pageId: 'missing', width: 100 })).toThrow(/does not exist/);
    expect(() => createCanvasRenderPlan({ document, height: 0, pageId, width: 100 })).toThrow(/positive/);
  });

  it('paints the background and ordered layers with canonical compositing', () => {
    const document = renderDocument();
    const pageId = document.pageIds[0]!;
    document.pages[pageId]!.background = '#111216';
    document.elements.back!.style.opacity = 0.6;
    document.elements.back!.style.blendMode = 'multiply';
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      restore: vi.fn(),
      save: vi.fn(),
    } as Pick<
      CanvasRenderingContext2D,
      'clearRect' | 'fillRect' | 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation' | 'restore' | 'save'
    > as CanvasRenderingContext2D;
    const rendered: string[] = [];

    const report = renderCanvasDocumentPage({
      context,
      document,
      elementIds: ['missing', 'back'],
      height: 250,
      pageId,
      renderElement: ({ element, outputBounds }) => {
        rendered.push(element.id);
        expect(outputBounds.width).toBe(200);
        expect(context.globalAlpha).toBe(0.6);
        expect(context.globalCompositeOperation).toBe('multiply');
      },
      width: 500,
    });

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 500, 250);
    expect(context.fillStyle).toBe('#111216');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 500, 250);
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
    expect(rendered).toEqual(['back']);
    expect(report).toEqual({
      height: 250,
      missingElementIds: ['missing'],
      pageId,
      paintedElementIds: ['back'],
      width: 500,
    });
  });

  it('can delegate compositing and still restores context after renderer failures', () => {
    const document = renderDocument();
    const pageId = document.pageIds[0]!;
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      restore: vi.fn(),
      save: vi.fn(),
    } as Pick<
      CanvasRenderingContext2D,
      'clearRect' | 'fillRect' | 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation' | 'restore' | 'save'
    > as CanvasRenderingContext2D;

    expect(() => renderCanvasDocumentPage({
      context,
      document,
      height: 500,
      manageCompositing: false,
      pageId,
      renderElement: () => {
        expect(context.globalAlpha).toBe(1);
        throw new Error('paint failed');
      },
      width: 1000,
    })).toThrow(/paint failed/i);
    expect(context.restore).toHaveBeenCalledTimes(2);

    renderCanvasDocumentPage({
      context,
      document,
      height: 500,
      pageId,
      renderElement: () => {
        expect(context.globalCompositeOperation).toBe('source-over');
      },
      width: 1000,
    });
  });
});
