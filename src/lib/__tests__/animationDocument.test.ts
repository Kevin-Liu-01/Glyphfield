import { describe, expect, it } from 'vitest';

import { parseCanvasDocument } from '../canvasDocument';
import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
} from '../liveMaterials';
import {
  animationAssetsFromCanvasDocument,
  animationStateFromCanvasDocument,
  createAnimationCanvasDocument,
  parseAnimationCanvasDocument,
  serializeAnimationCanvasDocument,
  type AnimationDocumentInput,
} from '../animationDocument';

const CREATED_AT = '2026-09-01T12:00:00.000Z';

function input(): AnimationDocumentInput {
  return {
    brandId: 'gt',
    createdAt: CREATED_AT,
    id: 'gt-animation',
    revision: 5,
    sources: [
      {
        alignX: -0.25,
        alignY: 0.2,
        fontSize: 96,
        id: 'text-0',
        kind: 'text',
        opacity: 0.8,
        scale: 1.1,
        text: 'Welcome',
      },
      {
        height: 320,
        id: 'image-one',
        image: {} as CanvasImageSource,
        kind: 'image',
        name: 'Launch image',
        url: 'data:image/png;base64,aGVybw==',
        width: 640,
      },
    ],
    state: {
      backgroundOverrides: { 'text-0': true },
      frameSettings: { 'text-0': { scale: 1.1 } },
      includeBrandLogo: false,
      mode: 'sequence',
      playbackRate: 1.5,
      sequenceBackground: { colorA: '#111216', style: 'solid' },
      sequenceOrder: ['text-0', 'image-one'],
      settings: { background: '#111216', height: 300, width: 1000 },
      textFrames: 'Welcome',
    },
    title: 'GT Animation',
    updatedAt: CREATED_AT,
  };
}

describe('Animation Studio canvas document adapter', () => {
  it('models every animation frame as a canonical page and embeds image bytes', () => {
    const document = createAnimationCanvasDocument(input());

    expect(document.pageIds).toEqual([
      'gt-animation:frame:text-0',
      'gt-animation:frame:image-one',
    ]);
    expect(document.pages[document.pageIds[0]!]!.elementIds).toEqual(['text-0']);
    expect(document.elements['text-0']).toMatchObject({
      content: 'Welcome',
      kind: 'text',
      style: { opacity: 0.8 },
    });
    expect(document.assets['animation:image-one']).toMatchObject({
      byteLength: 4,
      source: 'data:image/png;base64,aGVybw==',
    });
  });

  it('serializes deterministically and restores settings plus imported assets', () => {
    const source = serializeAnimationCanvasDocument(createAnimationCanvasDocument(input()));
    const parsed = parseAnimationCanvasDocument(source);

    expect(serializeAnimationCanvasDocument(parseCanvasDocument(source))).toBe(source);
    expect(parsed.state).toMatchObject({
      mode: 'sequence',
      playbackRate: 1.5,
      sequenceOrder: ['text-0', 'image-one'],
      textFrames: 'Welcome',
    });
    expect(parsed.assets).toEqual([{
      assetId: 'animation:image-one',
      height: 320,
      id: 'image-one',
      name: 'Launch image',
      source: 'data:image/png;base64,aGVybw==',
      width: 640,
    }]);
  });

  it('exposes the same state and asset projections without reparsing', () => {
    const document = createAnimationCanvasDocument(input());
    expect(animationStateFromCanvasDocument(document).backgroundOverrides).toEqual({ 'text-0': true });
    expect(animationAssetsFromCanvasDocument(document)[0]?.id).toBe('image-one');
  });

  it('preserves remote image types, cover bounds, and image background metadata', () => {
    const next = input();
    const extensions = ['svg', 'png', 'webp', 'gif', 'avif', 'jpg', 'jpeg', 'bin'];
    next.sources = extensions.map((extension, index) => ({
      ...(index === 0 ? {
        background: {
          angle: 0,
          colorA: '#111216',
          colorB: '#FFFFFF',
          colorC: '#533AFD',
          materialId: DEFAULT_LIVE_MATERIAL_ID,
          materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
          style: 'solid' as const,
        },
        fit: 'cover' as const,
      } : {}),
      height: 100,
      id: `remote-${extension}`,
      image: {} as CanvasImageSource,
      kind: 'image' as const,
      name: `Remote ${extension}`,
      url: `https://example.com/asset.${extension}?v=1`,
      width: 200,
    }));

    const document = createAnimationCanvasDocument(next);
    expect(extensions.map((extension) => document.assets[`animation:remote-${extension}`]?.mimeType))
      .toEqual([
        'image/svg+xml',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
        'image/jpeg',
        'image/jpeg',
        'application/octet-stream',
      ]);
    expect(document.elements['remote-svg']?.data.background).toMatchObject({ colorA: '#111216' });
    expect(document.elements['remote-svg']?.bounds.width).toBe(780);
  });

  it('rejects invalid adapter state and defaults malformed restored metadata', () => {
    const invalidInput = input();
    invalidInput.state = { ...invalidInput.state, settings: [] };
    expect(() => createAnimationCanvasDocument(invalidInput)).toThrow('Animation settings');

    const wrongTool = createAnimationCanvasDocument(input());
    wrongTool.metadata.tool = 'another-tool';
    expect(() => animationStateFromCanvasDocument(wrongTool)).toThrow('not an Animation Studio scene');

    const malformedSequence = createAnimationCanvasDocument(input());
    const metadata = malformedSequence.metadata.animation;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('Missing animation metadata fixture');
    }
    malformedSequence.metadata.animation = { ...metadata, sequenceOrder: 'invalid' };
    expect(animationStateFromCanvasDocument(malformedSequence).sequenceOrder).toEqual([]);
  });
});
