import { describe, expect, it } from 'vitest';

import {
  applyCanvasMutation,
  commitCanvasChange,
  createCanvasDocument,
  createCanvasElement,
  createCanvasHistory,
  insertCanvasElement,
  preflightCanvasDocument,
  redoCanvasChange,
  restoreCanvasVersion,
  saveCanvasVersion,
  undoCanvasChange,
} from '../canvasDocument';

function documentWithImage() {
  const document = createCanvasDocument(
    'deck',
    'gt',
    'GT deck',
    1200,
    675,
    ['assets', 'guides', 'history', 'layers', 'pages', 'text']
  );
  const image = {
    ...createCanvasElement('hero', 'Hero image', 'image', {
      height: 320,
      rotation: 0,
      width: 480,
      x: 80,
      y: 90,
    }),
    assetId: 'source-one',
    imageTreatment: {
      blur: 0,
      crop: { height: 1, width: 1, x: 0, y: 0 },
      dither: 18,
      focalPoint: { x: 0.62, y: 0.38 },
      grain: 32,
      halation: 8,
      objectFit: 'cover' as const,
      posterize: 0,
      saturation: 0.8,
    },
  };
  return insertCanvasElement(document, document.pageIds[0]!, image);
}

describe('canvas document', () => {
  it('moves, resizes, locks, and reorders layers immutably', () => {
    const source = documentWithImage();
    const pageId = source.pageIds[0]!;
    const moved = applyCanvasMutation(source, {
      deltaX: 24,
      deltaY: -10,
      elementIds: ['hero'],
      type: 'move-elements',
    });
    const locked = applyCanvasMutation(moved, { elementId: 'hero', locked: true, type: 'set-lock' });
    const ignoredMove = applyCanvasMutation(locked, {
      deltaX: 100,
      deltaY: 100,
      elementIds: ['hero'],
      type: 'move-elements',
    });

    expect(source.elements.hero?.bounds).toMatchObject({ x: 80, y: 90 });
    expect(moved.elements.hero?.bounds).toMatchObject({ x: 104, y: 80 });
    expect(ignoredMove).toBe(locked);
    expect(locked.pages[pageId]?.elementIds).toEqual(['hero']);
  });

  it('replaces an image without destroying crop, geometry, or effects', () => {
    const source = documentWithImage();
    const replaced = applyCanvasMutation(source, {
      assetId: 'source-two',
      elementId: 'hero',
      type: 'replace-asset',
    });

    expect(replaced.elements.hero?.assetId).toBe('source-two');
    expect(replaced.elements.hero?.bounds).toEqual(source.elements.hero?.bounds);
    expect(replaced.elements.hero?.imageTreatment).toEqual(source.elements.hero?.imageTreatment);
    expect(replaced.elements.hero?.style).toEqual(source.elements.hero?.style);
  });

  it('treats a batch as one undoable history change', () => {
    const source = documentWithImage();
    const history = createCanvasHistory(source);
    const changed = commitCanvasChange(history, [
      { deltaX: 20, deltaY: 0, elementIds: ['hero'], type: 'move-elements' },
      { bounds: { width: 600 }, elementId: 'hero', type: 'resize-element' },
    ]);
    const undone = undoCanvasChange(changed);
    const redone = redoCanvasChange(undone);

    expect(changed.past).toHaveLength(1);
    expect(changed.present.elements.hero?.bounds).toMatchObject({ width: 600, x: 100 });
    expect(undone.present.elements.hero?.bounds).toEqual(source.elements.hero?.bounds);
    expect(redone.present.elements.hero?.bounds).toEqual(changed.present.elements.hero?.bounds);
  });

  it('restores a pixel-identical saved checkpoint', () => {
    const source = documentWithImage();
    const version = saveCanvasVersion(source, 'version-one', 'Approved direction', 'Kevin');
    const restored = restoreCanvasVersion(version);

    expect(restored).toEqual(source);
    expect(restored).not.toBe(source);
  });

  it('preflights missing resources, clipping, and title line limits', () => {
    const source = documentWithImage();
    const pageId = source.pageIds[0]!;
    const title = {
      ...createCanvasElement('title', 'Title', 'text', {
        height: 120,
        rotation: 0,
        width: 520,
        x: 760,
        y: 600,
      }),
      content: 'One\nTwo\nThree',
      textStyle: {
        align: 'left' as const,
        casing: 'none' as const,
        color: '#181818',
        fontFamily: 'Inter',
        fontId: 'inter-500',
        fontSize: 72,
        fontWeight: 500,
        letterSpacing: 0,
        lineHeight: 1,
        maxLines: 2,
        tokenBound: true,
      },
    };
    const withTitle = insertCanvasElement(source, pageId, title);
    const issues = preflightCanvasDocument(withTitle);

    expect(issues.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['clipped', 'missing-asset', 'missing-font', 'text-overflow'])
    );
  });
});
