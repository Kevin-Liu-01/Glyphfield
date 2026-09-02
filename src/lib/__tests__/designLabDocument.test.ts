import { describe, expect, it } from 'vitest';

import { applyCanvasMutation, parseCanvasDocument } from '../canvasDocument';
import {
  createDesignLabCanvasDocument,
  designLabSourceFromCanvasDocument,
  parseDesignLabCanvasDocument,
  reconcileDesignLabLayerGroups,
  reconcileDesignLabLayerOrder,
  serializeDesignLabCanvasDocument,
  withDesignLabTimeline,
  type DesignLabDocumentInput,
} from '../designLabDocument';

const CREATED_AT = '2026-09-01T12:00:00.000Z';

function designLabInput(): DesignLabDocumentInput {
  return {
    assets: [{
      id: 'asset-photo',
      libraryAssetId: 'asset-library-photo',
      name: 'Photo',
      opacity: 0.8,
      transform: { heightScale: 2, scale: 0.6, widthScale: 3, x: 12, y: -8 },
      url: 'data:image/png;base64,aGVybw==',
      visible: true,
    }],
    backgroundColor: '#111216',
    brandId: 'gt',
    createdAt: CREATED_AT,
    effectLayers: [{
      id: 'effect-bayer',
      name: 'Bayer',
      opacity: 0.35,
      settings: { cellSize: 2, kind: 'bayer' },
      visible: true,
    }],
    exportSettings: { durationMs: 1600, fps: 15, width: 960 },
    groups: [{ id: 'group-lockup', layerIds: ['text-title', 'asset-photo'], name: 'Lockup' }],
    height: 540,
    id: 'gt-design-lab',
    layerOrder: ['shader-background', 'effect-bayer', 'asset-photo', 'text-title'],
    layerShaders: {},
    logos: [],
    ratio: 'wide',
    revision: 7,
    shaderLayers: [{
      blendMode: 'normal',
      id: 'shader-background',
      materialId: 'paper-gem-smoke',
      name: 'Canvas shader',
      opacity: 1,
      settings: { colorA: '#111216', colorB: '#E8500A' },
      shaderSize: 0.65,
      transform: { heightScale: 0.8, scale: 1, widthScale: 0.7, x: 42, y: -18 },
      visible: true,
    }],
    shaderSequence: { cutCount: 10, pace: 'accelerating', targetLayerId: 'shader-background' },
    textLayers: [{
      align: 'center',
      id: 'text-title',
      lineHeight: 1,
      name: 'Title',
      opacity: 1,
      tracking: -0.06,
      transform: { heightScale: 0.5, scale: 0.4, widthScale: 0.7, x: 74, y: 304 },
      value: 'Open Source',
      visible: true,
      weight: 500,
      wrap: 'wrap',
    }],
    timeline: { frame: 23, paused: true },
    title: 'GT Design Lab',
    updatedAt: CREATED_AT,
    width: 960,
  };
}

describe('Design Lab canvas document adapter', () => {
  it('writes the standard canvas schema with embedded image bytes', () => {
    const source = serializeDesignLabCanvasDocument(designLabInput());
    const document = parseCanvasDocument(source);

    expect(document.schemaVersion).toBe(2);
    expect(document.pages[document.pageIds[0]!]!.elementIds).toEqual([
      'shader-background',
      'effect-bayer',
      'asset-photo',
      'text-title',
    ]);
    expect(document.assets['brand-asset:asset-library-photo']).toMatchObject({
      byteLength: 4,
      source: 'data:image/png;base64,aGVybw==',
    });
    expect(document.elements['shader-background']?.bounds).toEqual({
      height: 0.8,
      rotation: 0,
      width: 0.7,
      x: 42,
      y: -18,
    });
    expect(document.elements['text-title']?.content).toBe('Open Source');
  });

  it('reuses one embedded library asset across duplicated canvas placements', () => {
    const input = designLabInput();
    input.assets = [...input.assets, {
      ...input.assets[0]!,
      id: 'asset-photo-copy',
      name: 'Photo copy',
      transform: { heightScale: 2, scale: 0.6, widthScale: 3, x: 112, y: 42 },
    }];
    input.layerOrder = ['shader-background', 'asset-photo', 'asset-photo-copy', 'text-title'];

    const document = createDesignLabCanvasDocument(input);

    expect(Object.keys(document.assets)).toEqual(['brand-asset:asset-library-photo']);
    expect(document.elements['asset-photo']?.assetId).toBe('brand-asset:asset-library-photo');
    expect(document.elements['asset-photo-copy']?.assetId).toBe('brand-asset:asset-library-photo');
    expect(parseDesignLabCanvasDocument(JSON.stringify(document)).composition).toMatchObject({
      assets: [
        { id: 'asset-photo', libraryAssetId: 'asset-library-photo' },
        { id: 'asset-photo-copy', libraryAssetId: 'asset-library-photo' },
      ],
    });
  });

  it('round-trips current Design Lab source fields without losing transforms or order', () => {
    const restored = parseDesignLabCanvasDocument(serializeDesignLabCanvasDocument(designLabInput()));
    const composition = restored.composition as Record<string, object[]>;

    expect(restored.version).toBe(3);
    expect(composition.assets?.[0]).toMatchObject({
      id: 'asset-photo',
      libraryAssetId: 'asset-library-photo',
      transform: { heightScale: 2, scale: 0.6, widthScale: 3, x: 12, y: -8 },
      url: 'data:image/png;base64,aGVybw==',
    });
    expect(composition.textLayers?.[0]).toMatchObject({
      id: 'text-title',
      transform: { heightScale: 0.5, scale: 0.4, widthScale: 0.7, x: 74, y: 304 },
      value: 'Open Source',
    });
    expect(composition.shaderLayers?.[0]).toMatchObject({
      id: 'shader-background',
      transform: { heightScale: 0.8, scale: 1, widthScale: 0.7, x: 42, y: -18 },
    });
    expect((restored.composition as Record<string, string[]>).layerOrder).toEqual(designLabInput().layerOrder);
  });

  it('upgrades legacy full-canvas shaders with an explicit adjustable frame', () => {
    const input = designLabInput();
    const legacyShader = { ...input.shaderLayers[0] } as Record<string, unknown>;
    delete legacyShader.transform;
    input.shaderLayers = [legacyShader];

    const restored = parseDesignLabCanvasDocument(serializeDesignLabCanvasDocument(input));
    const shaders = (restored.composition as Record<string, Array<{ transform: object }>>).shaderLayers;

    expect(shaders?.[0]?.transform).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('preserves uniform logo scale without inventing independent dimensions after reload', () => {
    const input = designLabInput();
    input.logos = [{
      id: 'logo-uniform',
      name: 'Uniform mark',
      transform: { scale: 0.457_760_103, x: -168.5, y: 305.2 },
      url: 'data:image/svg+xml;base64,PHN2Zy8+',
      visible: true,
    }];
    input.layerOrder = [...input.layerOrder, 'logo-uniform'];

    const document = createDesignLabCanvasDocument(input);
    expect(document.elements['logo-uniform']?.bounds).toMatchObject({
      height: 0.457_760_103,
      width: 0.457_760_103,
    });

    const restored = parseDesignLabCanvasDocument(serializeDesignLabCanvasDocument(input));
    const logos = (restored.composition as Record<string, Array<{ transform: object }>>).logos;
    expect(logos?.[0]?.transform).toEqual({
      scale: 0.457_760_103,
      x: -168.5,
      y: 305.2,
    });
  });

  it('uses canonical element geometry when a canvas mutation changes the design', () => {
    const document = createDesignLabCanvasDocument(designLabInput());
    const moved = applyCanvasMutation(document, {
      deltaX: 18,
      deltaY: -4,
      elementIds: ['asset-photo', 'text-title'],
      type: 'move-elements',
    });
    const restored = designLabSourceFromCanvasDocument(moved);
    const composition = restored.composition as Record<string, Array<{ transform: { x: number; y: number } }>>;

    expect(composition.assets?.[0]?.transform).toMatchObject({ x: 30, y: -12 });
    expect(composition.textLayers?.[0]?.transform).toMatchObject({ x: 92, y: 300 });
  });

  it('updates only timeline metadata and revision for a live source snapshot', () => {
    const document = createDesignLabCanvasDocument(designLabInput());
    const snapshot = withDesignLabTimeline(document, { frame: 11, paused: false }, 48);

    expect(snapshot).not.toBe(document);
    expect(snapshot.elements).toBe(document.elements);
    expect(snapshot.pages).toBe(document.pages);
    expect(snapshot.assets).toBe(document.assets);
    expect(snapshot.revision).toBe(48);
    expect(designLabSourceFromCanvasDocument(snapshot)).toMatchObject({
      timeline: { frame: 11, paused: false },
    });
  });

  it('reconciles stale and missing layers into one deterministic render order', () => {
    expect(reconcileDesignLabLayerOrder({
      assets: ['asset-photo'],
      effects: ['effect-bayer'],
      logos: ['logo-mark'],
      shaders: ['shader-a', 'shader-b'],
      stored: ['stale', 'shader-a', 'text-title', 'shader-a', 'asset-photo'],
      text: ['text-title', 'text-caption'],
    })).toEqual([
      'shader-a',
      'shader-b',
      'text-title',
      'asset-photo',
      'text-caption',
      'logo-mark',
      'effect-bayer',
    ]);
  });

  it('reconciles overlapping groups against the live layer set', () => {
    expect(reconcileDesignLabLayerGroups([
      { id: 'primary', layerIds: ['text-title', 'asset-photo', 'stale'], name: 'Primary' },
      { id: 'overlap', layerIds: ['asset-photo', 'logo-mark', 'effect-bayer'], name: 'Overlap' },
      { id: 'too-small', layerIds: ['shader-background'], name: 'Too small' },
    ], ['shader-background', 'effect-bayer', 'asset-photo', 'text-title', 'logo-mark'])).toEqual([
      { id: 'primary', layerIds: ['text-title', 'asset-photo'], name: 'Primary' },
      { id: 'overlap', layerIds: ['logo-mark', 'effect-bayer'], name: 'Overlap' },
    ]);
  });

  it('infers external resource MIME types for every supported image format and fallback', () => {
    const sources = [
      ['/art.svg?revision=2', 'image/svg+xml'],
      ['/art.png', 'image/png'],
      ['/art.webp', 'image/webp'],
      ['/art.gif', 'image/gif'],
      ['/art.avif', 'image/avif'],
      ['/art.jpg#frame', 'image/jpeg'],
      ['/art.bin', 'application/octet-stream'],
    ] as const;
    const input = designLabInput();
    input.assets = sources.map(([url], index) => ({
      id: `asset-${index}`,
      name: `Asset ${index}`,
      transform: { heightScale: 100, widthScale: 100, x: 0, y: 0 },
      url,
    }));
    input.logos = [{
      id: 'logo-fallback',
      name: 'Logo fallback',
      transform: { heightScale: 100, widthScale: 100, x: 0, y: 0 },
      url: '/brand-mark.unknown',
    }];
    input.layerOrder = [
      ...sources.map((_, index) => `asset-${index}`),
      'logo-fallback',
    ];
    const document = createDesignLabCanvasDocument(input);

    expect(sources.map((_, index) => document.assets[`resource:asset-${index}`]?.mimeType))
      .toEqual(sources.map(([, mimeType]) => mimeType));
    expect(document.assets['resource:logo-fallback']?.mimeType).toBe('image/svg+xml');
  });

  it('rejects malformed layer payloads, missing ids, and missing Design Lab metadata', () => {
    const invalidPayload = designLabInput();
    invalidPayload.assets = [[]];
    expect(() => createDesignLabCanvasDocument(invalidPayload)).toThrow(/asset layer must serialize to an object/i);

    const missingId = designLabInput();
    missingId.assets = [{ name: 'Missing id', url: '/image.png' }];
    missingId.layerOrder = [''];
    expect(() => createDesignLabCanvasDocument(missingId)).toThrow(/asset layer is missing its id/i);

    const missingMetadata = { ...createDesignLabCanvasDocument(designLabInput()), metadata: {} };
    expect(() => withDesignLabTimeline(missingMetadata, { frame: 1 }, 2)).toThrow(/metadata is missing/i);
    expect(() => designLabSourceFromCanvasDocument(missingMetadata)).toThrow(/not a Design Lab composition/i);

    const unsupportedBlend = designLabInput();
    unsupportedBlend.shaderLayers = [{
      ...(unsupportedBlend.shaderLayers[0] as Record<string, object | string | number | boolean>),
      blendMode: 'color-dodge',
    }];
    expect(createDesignLabCanvasDocument(unsupportedBlend).elements['shader-background']?.style.blendMode)
      .toBe('normal');
  });
});
