import { describe, expect, it } from 'vitest';

import { parseCanvasDocument } from '../canvasDocument';
import {
  createStudioCanvasDocument,
  parseStudioCanvasDocument,
  serializeStudioCanvasDocument,
  studioCanvasStateFromDocument,
} from '../studioCanvasDocument';

const CREATED_AT = '2026-09-01T12:00:00.000Z';

function documentWithLayers(
  layers: Parameters<typeof createStudioCanvasDocument>[0]['layers'],
  state: object = { backgroundEnabled: true, stickerPlacements: [{ id: 'placed-1', x: 50, y: 50 }] }
) {
  return createStudioCanvasDocument({
    background: '#111216',
    brandId: 'gt',
    createdAt: CREATED_AT,
    height: 630,
    id: 'gt-playground',
    layers,
    revision: 9,
    state,
    title: 'GT Playground',
    toolId: 'surface',
    updatedAt: CREATED_AT,
    width: 1200,
  });
}

function document() {
  return documentWithLayers([
      {
        bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 },
        id: 'shader',
        kind: 'shader',
        name: 'Background shader',
      },
      {
        asset: {
          name: 'Custom artwork',
          source: 'data:image/png;base64,aGVybw==',
        },
        bounds: { height: 200, rotation: 0, width: 200, x: 500, y: 215 },
        id: 'artwork',
        kind: 'image',
        name: 'Custom artwork',
      },
    ]);
}

describe('generic studio canvas document adapter', () => {
  it('preserves layer order, state, and embedded assets in the shared schema', () => {
    const source = serializeStudioCanvasDocument(document());
    const parsed = parseStudioCanvasDocument(source, 'surface');

    expect(parsed.document.pages[parsed.document.pageIds[0]!]!.elementIds).toEqual(['shader', 'artwork']);
    expect(parsed.document.assets['resource:artwork']).toMatchObject({ byteLength: 4 });
    expect(parsed.state).toMatchObject({ backgroundEnabled: true });
    expect(serializeStudioCanvasDocument(parseCanvasDocument(source))).toBe(source);
  });

  it('rejects opening a document in the wrong studio', () => {
    expect(() => studioCanvasStateFromDocument(document(), 'partnership')).toThrow(/not a partnership/i);
  });

  it('infers external asset MIME types while preserving layer presentation', () => {
    const sources = [
      ['/art.svg?revision=2', 'image/svg+xml'],
      ['/art.png', 'image/png'],
      ['/art.webp', 'image/webp'],
      ['/art.gif', 'image/gif'],
      ['/art.avif', 'image/avif'],
      ['/art.jpeg#frame', 'image/jpeg'],
      ['/type.woff2', 'font/woff2'],
      ['/asset.bin', 'application/octet-stream'],
    ] as const;
    const created = documentWithLayers(sources.map(([source], index) => ({
      asset: { name: `Asset ${index}`, source },
      bounds: { height: 100, rotation: 0, width: 100, x: index * 10, y: index * 10 },
      content: index === 0 ? 'Caption' : undefined,
      data: index === 0 ? { fit: 'cover' } : undefined,
      hidden: index === 0,
      id: `asset-${index}`,
      kind: 'image',
      name: `Asset ${index}`,
      opacity: index === 0 ? 0.4 : undefined,
    })));

    expect(sources.map((_, index) => created.assets[`resource:asset-${index}`]?.mimeType))
      .toEqual(sources.map(([, mimeType]) => mimeType));
    expect(created.elements['asset-0']).toMatchObject({
      content: 'Caption',
      data: { fit: 'cover' },
      hidden: true,
      style: { opacity: 0.4 },
    });
    expect(created.elements['asset-1']).toMatchObject({ hidden: false, style: { opacity: 1 } });
  });

  it('rejects duplicate layers and non-object studio payloads', () => {
    const layer = {
      bounds: { height: 100, rotation: 0, width: 100, x: 0, y: 0 },
      id: 'duplicate',
      kind: 'image' as const,
      name: 'Duplicate',
    };
    expect(() => documentWithLayers([layer, layer])).toThrow(/duplicated/i);
    expect(() => documentWithLayers([{ ...layer, data: [] }])).toThrow(/layer data must serialize to an object/i);
  });

  it('rejects missing metadata and non-object studio state', () => {
    const missingMetadata = { ...document(), metadata: {} };
    expect(() => studioCanvasStateFromDocument(missingMetadata)).toThrow(/not a studio document/i);

    const invalidState = document();
    invalidState.metadata.studio = { sourceVersion: 1, state: [], toolId: 'surface' };
    expect(() => studioCanvasStateFromDocument(invalidState, 'surface')).toThrow(/state is missing/i);
  });

  it('invariant_studio_source_never_silently_serializes_external_assets', () => {
    const external = document();
    external.assets['resource:artwork'] = {
      byteLength: 0,
      id: 'resource:artwork',
      kind: 'image',
      mimeType: 'image/png',
      name: 'Custom artwork',
      source: '/uploads/artwork.png',
    };
    expect(() => serializeStudioCanvasDocument(external)).toThrow(/not portable/i);
  });
});
