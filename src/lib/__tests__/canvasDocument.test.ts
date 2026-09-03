import { describe, expect, it } from 'vitest';

import {
  applyCanvasMutation,
  asCanvasJsonObject,
  canvasJsonBoolean,
  canvasDocumentContentRevision,
  canvasDocumentNeedsAssetEmbedding,
  canvasElementAsset,
  canvasElementAssetSource,
  canvasRevisionFromSignature,
  canvasSignatureFromValue,
  canvasSourceContentRevision,
  canvasJsonNumber,
  canvasJsonString,
  commitCanvasChange,
  createCanvasDocument,
  createCanvasElement,
  createEmbeddedCanvasAsset,
  createCanvasHistory,
  createCanvasPage,
  embedCanvasDocumentAssets,
  insertCanvasElement,
  inferCanvasAssetMimeType,
  isCanvasDocumentEnvelope,
  parseCanvasDocument,
  preflightCanvasDocument,
  preparePortableCanvasDocument,
  redoCanvasChange,
  registerCanvasAsset,
  restoreCanvasVersion,
  saveCanvasVersion,
  serializeCanvasDocument,
  serializePortableCanvasDocument,
  toCanvasJsonObject,
  toCanvasJsonValue,
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
  it('distinguishes shared canvas envelopes from legacy workspace payloads', () => {
    expect(isCanvasDocumentEnvelope({ schemaVersion: 2 })).toBe(true);
    expect(isCanvasDocumentEnvelope({ schemaVersion: 2, pages: null })).toBe(true);
    expect(isCanvasDocumentEnvelope({ composition: {}, version: 3 })).toBe(false);
  });

  it('derives stable unsigned revisions from composition signatures', () => {
    expect(canvasRevisionFromSignature('same composition')).toBe(
      canvasRevisionFromSignature('same composition')
    );
    expect(canvasRevisionFromSignature('same composition')).not.toBe(
      canvasRevisionFromSignature('different composition')
    );
    expect(canvasRevisionFromSignature('same composition')).toBeGreaterThanOrEqual(0);
    expect(canvasSignatureFromValue({ beta: 2, alpha: { zeta: 3, gamma: 1 } })).toBe(
      canvasSignatureFromValue({ alpha: { gamma: 1, zeta: 3 }, beta: 2 })
    );
  });

  it('derives the same semantic revision across timestamp and revision changes', () => {
    const first = createCanvasDocument('deck', 'gt', 'GT deck', 1200, 675, ['pages']);
    const second = {
      ...first,
      createdAt: '2030-01-01T00:00:00.000Z',
      revision: first.revision + 99,
      updatedAt: '2030-01-02T00:00:00.000Z',
    };

    expect(canvasDocumentContentRevision(second)).toBe(canvasDocumentContentRevision(first));
    expect(canvasSourceContentRevision(serializeCanvasDocument(second))).toBe(
      canvasDocumentContentRevision(first)
    );
    expect(canvasSourceContentRevision('{"version":3}')).toBeNull();

    const withPeaks = { ...first, metadata: { waveform: { peaks: [0.1, 0.8] } } };
    const regeneratedPeaks = { ...first, metadata: { waveform: { peaks: [0.2, 1] } } };
    expect(canvasDocumentContentRevision(withPeaks)).not.toBe(
      canvasDocumentContentRevision(regeneratedPeaks)
    );
    expect(canvasDocumentContentRevision(withPeaks, { omitMetadataKeys: ['peaks'] })).toBe(
      canvasDocumentContentRevision(regeneratedPeaks, { omitMetadataKeys: ['peaks'] })
    );
  });

  it('normalizes runtime state into strict JSON without serialization clones', () => {
    expect(toCanvasJsonValue({
      finite: 2,
      list: [undefined, Number.POSITIVE_INFINITY, 'kept'],
      nonFinite: Number.NaN,
      omitted: undefined,
    })).toEqual({
      finite: 2,
      list: [null, null, 'kept'],
      nonFinite: null,
    });

    const circular: Record<string, object> = {};
    circular.self = circular;
    expect(() => toCanvasJsonValue(circular)).toThrow(/circular/i);
    expect(() => toCanvasJsonValue(new Date())).toThrow(/plain JSON objects/i);
    expect(() => toCanvasJsonValue(BigInt(1))).toThrow(/BigInt/i);
    expect(() => toCanvasJsonValue(undefined, 'Composition')).toThrow(/Composition must be JSON serializable/i);
  });

  it('shares strict JSON readers and asset MIME inference across every workspace adapter', () => {
    const object = toCanvasJsonObject({ enabled: true, name: 'Layer', opacity: 0.5 });
    expect(asCanvasJsonObject(object)).toBe(object);
    expect(asCanvasJsonObject(['not-an-object'])).toBeNull();
    expect(() => toCanvasJsonObject('invalid', 'Layer state')).toThrow(/Layer state must serialize to an object/i);
    expect(canvasJsonBoolean(object.enabled, false)).toBe(true);
    expect(canvasJsonBoolean(object.name, false)).toBe(false);
    expect(canvasJsonNumber(object.opacity, 1)).toBe(0.5);
    expect(canvasJsonNumber(Number.NaN, 1)).toBe(1);
    expect(canvasJsonString(object.name, '')).toBe('Layer');
    expect(canvasJsonString(object.opacity, 'fallback')).toBe('fallback');
    expect(inferCanvasAssetMimeType('data:image/PNG;base64,AA')).toBe('image/png');
    expect(inferCanvasAssetMimeType('/asset.svg?revision=2')).toBe('image/svg+xml');
    expect(inferCanvasAssetMimeType('/font.woff2')).toBe('font/woff2');
    expect(inferCanvasAssetMimeType('/asset.bin', 'image/svg+xml')).toBe('image/svg+xml');
  });

  it('creates validated pages and measures percent-encoded embedded assets', () => {
    expect(createCanvasPage('page-two', 'Page 2', 800, 600, '#111216')).toMatchObject({
      background: '#111216',
      height: 600,
      id: 'page-two',
      name: 'Page 2',
      width: 800,
    });
    expect(createEmbeddedCanvasAsset({
      id: 'plain-text',
      kind: 'binary',
      name: 'Plain text',
      source: 'data:text/plain,hello%20world',
    })).toMatchObject({ byteLength: 11, mimeType: 'text/plain' });
    expect(() => createCanvasPage('', 'Page', 800, 600)).toThrow(/id cannot be empty/i);
    expect(() => createCanvasPage('page', '', 800, 600)).toThrow(/name cannot be empty/i);
    expect(() => createCanvasPage('page', 'Page', Number.NaN, 600)).toThrow(/dimensions/i);
    expect(() => createEmbeddedCanvasAsset({
      id: 'remote',
      kind: 'image',
      name: 'Remote image',
      source: '/remote.png',
    })).toThrow(/embedded data URL/i);
  });

  it('serializes embedded assets deterministically and restores them byte-for-byte', () => {
    const source = registerCanvasAsset(documentWithImage(), createEmbeddedCanvasAsset({
      id: 'source-one',
      kind: 'image',
      name: 'Hero image',
      source: 'data:image/svg+xml;base64,PHN2Zy8+',
    }));
    const serialized = serializeCanvasDocument(source);
    const restored = parseCanvasDocument(serialized);

    expect(serialized).toContain('data:image/svg+xml;base64,PHN2Zy8+');
    expect(serializeCanvasDocument(restored)).toBe(serialized);
    expect(restored).toEqual(source);
    expect(restored.assets['source-one']).toMatchObject({
      byteLength: 6,
      mimeType: 'image/svg+xml',
    });
    expect(canvasElementAsset(restored, 'hero')).toBe(restored.assets['source-one']);
    expect(canvasElementAssetSource(restored, 'hero')).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(canvasElementAsset(restored, 'missing')).toBeNull();
    expect(canvasElementAssetSource(restored, 'missing', '/preview.png')).toBe('/preview.png');
  });

  it('embeds external resources through one resolver before sharing', async () => {
    const source = registerCanvasAsset(documentWithImage(), {
      byteLength: 0,
      id: 'source-one',
      kind: 'image',
      mimeType: 'image/png',
      name: 'Hero image',
      source: '/uploads/hero.png',
    });
    const embedded = await embedCanvasDocumentAssets(source, async (url, asset) => {
      expect(url).toBe('/uploads/hero.png');
      expect(asset.id).toBe('source-one');
      return 'data:image/png;base64,aGVybw==';
    });

    expect(embedded.assets['source-one']).toMatchObject({
      byteLength: 4,
      source: 'data:image/png;base64,aGVybw==',
    });
    expect(() => serializeCanvasDocument(source)).toThrow(/not portable/i);
    expect(() => serializeCanvasDocument(embedded)).not.toThrow();
  });

  it('invariant_portable_preparation_embeds_assets_without_changing_the_canvas_revision', async () => {
    const source = registerCanvasAsset(documentWithImage(), {
      byteLength: 0,
      id: 'source-one',
      kind: 'image',
      mimeType: 'image/png',
      name: 'Hero image',
      source: '/uploads/hero.png',
    });
    const resolve = async () => 'data:image/png;base64,aGVybw==';
    const portable = await preparePortableCanvasDocument(source, resolve);

    expect(portable.revision).toBe(source.revision);
    expect(portable.updatedAt).toBe(source.updatedAt);
    expect(portable.assets['source-one']?.source).toBe('data:image/png;base64,aGVybw==');
    expect(await serializePortableCanvasDocument(source, resolve)).toBe(serializeCanvasDocument(portable));
  });

  it('leaves an already portable document and its revision untouched', async () => {
    const source = registerCanvasAsset(documentWithImage(), createEmbeddedCanvasAsset({
      id: 'source-one',
      kind: 'image',
      name: 'Hero image',
      source: 'data:image/png;base64,aGVybw==',
    }));
    const resolve = async () => {
      throw new Error('resolver should not run');
    };

    expect(canvasDocumentNeedsAssetEmbedding(source)).toBe(false);
    expect(await preparePortableCanvasDocument(source, resolve)).toBe(source);
    expect(await embedCanvasDocumentAssets(source, resolve)).toBe(source);
  });

  it('migrates schema v1 resource ids without losing document geometry', () => {
    const current = documentWithImage();
    const legacyElements = Object.fromEntries(Object.entries(current.elements).map(([id, element]) => {
      const { data: _data, ...legacyElement } = element;
      return [id, legacyElement];
    }));
    const legacy = {
      ...current,
      assetIds: ['source-one'],
      assets: undefined,
      elements: legacyElements,
      fontIds: [],
      metadata: undefined,
      schemaVersion: 1,
    };
    const migrated = parseCanvasDocument(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.elements.hero?.bounds).toEqual(current.elements.hero?.bounds);
    expect(migrated.elements.hero?.data).toEqual({});
    expect(migrated.assets['source-one']).toMatchObject({
      kind: 'binary',
      source: '',
    });
    expect(migrated.metadata.migratedFromSchemaVersion).toBe(1);
  });

  it('rejects future schema versions and undeclared capabilities', () => {
    const source = documentWithImage();
    expect(() => parseCanvasDocument(JSON.stringify({
      ...source,
      schemaVersion: 99,
    }))).toThrow(/schema version 99 is unsupported/i);

    const serialized = serializeCanvasDocument(source, { portable: false });
    const unsupportedCapability = serialized.replace(
      '"capabilities": [\n    "assets"',
      '"capabilities": [\n    "warp-drive"'
    );
    expect(() => parseCanvasDocument(unsupportedCapability)).toThrow(/unsupported capability/i);
  });

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

  it('applies resize constraints, nested patches, ordering, and deletion through one mutation API', () => {
    const source = documentWithImage();
    const pageId = source.pageIds[0]!;
    const caption = createCanvasElement('caption', 'Caption', 'text', {
      height: 80,
      rotation: 0,
      width: 240,
      x: 500,
      y: 500,
    });
    const withCaption = insertCanvasElement(source, pageId, caption, 0);
    const constrained = applyCanvasMutation(withCaption, {
      elementId: 'hero',
      patch: {
        constraints: { lockAspectRatio: true },
        style: { opacity: 0.7 },
      },
      type: 'update-element',
    });
    const resized = applyCanvasMutation(constrained, {
      bounds: { width: 960 },
      elementId: 'hero',
      type: 'resize-element',
    });
    const reordered = applyCanvasMutation(resized, {
      elementId: 'hero',
      index: -10,
      pageId,
      type: 'reorder-element',
    });
    const deleted = applyCanvasMutation(reordered, {
      elementIds: ['caption'],
      type: 'delete-elements',
    });

    expect(resized.elements.hero?.bounds).toMatchObject({ height: 640, width: 960 });
    expect(resized.elements.hero?.style.opacity).toBe(0.7);
    expect(reordered.pages[pageId]?.elementIds[0]).toBe('hero');
    expect(deleted.elements.caption).toBeUndefined();
    expect(deleted.pages[pageId]?.elementIds).not.toContain('caption');
    expect(applyCanvasMutation(deleted, {
      elementId: 'missing',
      index: 0,
      pageId,
      type: 'reorder-element',
    })).toBe(deleted);
    expect(insertCanvasElement(deleted, 'missing-page', caption)).toBe(deleted);
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

  it('keeps no-op changes and empty history navigation referentially stable', () => {
    const source = documentWithImage();
    const history = createCanvasHistory(source);
    const noChange = commitCanvasChange(history, {
      deltaX: 10,
      deltaY: 10,
      elementIds: ['missing'],
      type: 'move-elements',
    });

    expect(noChange).toBe(history);
    expect(undoCanvasChange(history)).toBe(history);
    expect(redoCanvasChange(history)).toBe(history);
  });

  it('round-trips guides and complete text styles', () => {
    const source = documentWithImage();
    const pageId = source.pageIds[0]!;
    const text = {
      ...createCanvasElement('caption', 'Caption', 'text', {
        height: 80,
        rotation: 0,
        width: 300,
        x: 100,
        y: 500,
      }),
      content: 'Hello',
      textStyle: {
        align: 'center' as const,
        casing: 'uppercase' as const,
        color: '#FFFFFF',
        fontFamily: 'Inter',
        fontId: 'inter-500',
        fontRole: 'Display' as const,
        fontSize: 48,
        fontWeight: 500,
        letterSpacing: 0.01,
        lineHeight: 1.1,
        maxLines: 1,
        tokenBound: true,
      },
    };
    const withText = insertCanvasElement(source, pageId, text);
    const withGuide = {
      ...withText,
      guides: [{ axis: 'x' as const, id: 'center-x', locked: true, position: 600 }],
    };
    const restored = parseCanvasDocument(serializeCanvasDocument(withGuide, { portable: false }));

    expect(restored.guides).toEqual(withGuide.guides);
    expect(restored.elements.caption?.textStyle).toEqual(text.textStyle);
  });

  it('reports a referenced but unembedded font as non-portable', () => {
    const source = documentWithImage();
    const pageId = source.pageIds[0]!;
    const text = {
      ...createCanvasElement('caption', 'Caption', 'text', {
        height: 80,
        rotation: 0,
        width: 300,
        x: 100,
        y: 500,
      }),
      content: 'Hello',
      textStyle: {
        align: 'left' as const,
        casing: 'none' as const,
        color: '#FFFFFF',
        fontFamily: 'Inter',
        fontId: 'inter-500',
        fontSize: 48,
        fontWeight: 500,
        letterSpacing: 0,
        lineHeight: 1.1,
        tokenBound: true,
      },
    };
    const withText = insertCanvasElement(source, pageId, text);
    const withFont = registerCanvasAsset(withText, {
      byteLength: 0,
      id: 'inter-500',
      kind: 'font',
      mimeType: 'font/woff2',
      name: 'Inter 500',
      source: '/fonts/inter-500.woff2',
    });

    expect(preflightCanvasDocument(withFont)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'unembedded-font' }),
    ]));
    expect(() => serializeCanvasDocument(withFont)).toThrow(/Font inter-500 is not embedded/i);
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
