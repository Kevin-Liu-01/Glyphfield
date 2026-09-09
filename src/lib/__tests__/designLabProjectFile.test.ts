import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCanvasDocument, toCanvasJsonObject, type CanvasJsonObject } from '../canvasDocument';
import { brandTypographyFamily, createBrandIdentity } from '../brandIdentity';
import { createDesignLabCanvasDocument } from '../designLabDocument';
import {
  DESIGN_LAB_PROJECT_FILE_MAX_BYTES,
  designLabProjectIdentity,
  namespaceDesignLabProjectIdentity,
  prepareDesignLabProjectFile,
  readDesignLabProjectFile,
} from '../designLabProjectFile';
import { clearShaderFrameAssetCache, createShaderFrameAsset, importShaderFrameAssets, resolveShaderFrameAssetSource } from '../shaderFrameAssets';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const SVG = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
const FONT = 'data:font/woff2;base64,d09GMgABAAAAAAAB';

function projectIdentity() {
  const identity = createBrandIdentity('Shared typography', 'test-brand');
  identity.fonts = [{ id: 'custom-variable', family: 'Custom Sans', fileName: 'custom.woff2', format: 'woff2', label: 'Custom variable', path: 'blob:custom-font', style: 'normal', weight: 400, weightMin: 100, weightMax: 900 }];
  identity.typography = [{ family: 'Custom Sans', fontId: 'custom-variable', role: 'Display', usage: 'Headlines', weight: 625, lineHeight: 1.2, letterSpacing: -2 }];
  return identity;
}

function fixture() {
  const image = { id: 'asset-photo', name: 'Uploaded photo', url: 'blob:local-photo', transform: { scale: 1, x: 0, y: 0 } };
  const snapshot = { assets: [image], logos: [], textLayers: [], shaderLayers: [], layerShaders: {}, ratio: 'wide', dimensions: { width: 960, height: 540 }, timeline: { frame: 12, timeMs: 412.75, paused: true } };
  return createDesignLabCanvasDocument({
    assets: [image], backgroundColor: '#111111', brandId: 'test-brand', createdAt: '2026-09-09T00:00:00.000Z',
    effectLayers: [], exportSettings: { fps: 30 }, groups: [], height: 540, id: 'project-test', layerOrder: ['asset-photo'],
    layerShaders: {}, logos: [], ratio: 'wide', revision: 5, shaderLayers: [], shaderSequence: {}, textLayers: [],
    timeline: snapshot.timeline, title: 'Share study', updatedAt: '2026-09-09T00:00:00.000Z', width: 960,
    workspace: { activeArtboardId: 'artboard-one', futureWorkspace: { keep: true }, artboards: [
      { id: 'artboard-one', name: 'First', x: 10, y: 20, snapshot },
      { id: 'artboard-two', name: 'Second', x: 1100, y: 220, futureArtboard: true, snapshot: {
        ...snapshot, assets: [], logos: [{ id: 'logo-local', name: 'Local logo', url: '/brand-logo.svg' }], futureSnapshot: { untouched: true },
      } },
    ] },
  });
}

function artboards(document: ReturnType<typeof fixture>) {
  return ((document.metadata.designLab as CanvasJsonObject).workspace as CanvasJsonObject).artboards as CanvasJsonObject[];
}

describe('editable Design Lab project files', () => {
  afterEach(() => {
    clearShaderFrameAssetCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('round-trips all artboards, local assets, identity metadata, and unknown editable fields without a new envelope', async () => {
    const input = fixture();
    const before = structuredClone(input);
    const resolve = vi.fn(async (url: string) => url === 'blob:local-photo' ? PNG : SVG);
    const artifact = await prepareDesignLabProjectFile(input, 'Share study', resolve);
    expect(artifact).toMatchObject({ fileName: 'Share study.glyphfield.json', format: 'JSON', previewKind: 'file' });
    expect(artifact.blob.type).toBe('application/json');
    expect(artifact.blob.size).toBeGreaterThan(0);
    expect(artifact.description).toContain('2 artboards');
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(input).toEqual(before);
    const source = await artifact.blob.text();
    expect(source).not.toContain('blob:');
    expect(source).not.toContain('/brand-logo.svg');
    const fetch = vi.fn(() => { throw new Error('Imports must not fetch'); });
    vi.stubGlobal('fetch', fetch);
    const restored = parseCanvasDocument(await readDesignLabProjectFile(artifact.blob));
    expect(fetch).not.toHaveBeenCalled();
    expect(restored.schemaVersion).toBe(2);
    expect(restored.brandId).toBe('test-brand');
    expect(restored.revision).toBe(5);
    expect(restored.elements['asset-photo']!.data.url).toBe(PNG);
    expect(artboards(restored)).toMatchObject([
      { id: 'artboard-one', x: 10, y: 20, snapshot: { assets: [{ url: PNG }], timeline: { timeMs: 412.75 } } },
      { id: 'artboard-two', x: 1100, y: 220, futureArtboard: true, snapshot: { logos: [{ url: SVG }], futureSnapshot: { untouched: true } } },
    ]);
  });

  it('embeds and reimports exact existing inactive shader frames with their native recipe anchors', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('crypto', webcrypto);
    const bytes = Uint8Array.from(Buffer.from(PNG.split(',')[1]!, 'base64'));
    const frame = await createShaderFrameAsset(new Blob([bytes], { type: 'image/png' }), { height: 1, width: 1 });
    const input = fixture();
    const frameState = { version: 2, engine: 'paper', frame: 412.75, timelineTimeMs: 700.125, materialId: 'paper-gem-smoke' };
    const snapshot = artboards(input)[1]!.snapshot as CanvasJsonObject;
    snapshot.shaderLayers = [toCanvasJsonObject({ id: 'shader-inactive', materialId: 'paper-gem-smoke', frameSnapshot: frame, frameState })];
    input.assets[frame.assetId] = { id: frame.assetId, kind: 'image', name: 'Frame', source: `glyphfield-${frame.assetId}`, mimeType: 'image/png', byteLength: 0 };
    const artifact = await prepareDesignLabProjectFile(input, undefined, (url) => url.startsWith('glyphfield-shader-frame:')
      ? resolveShaderFrameAssetSource(url)
      : Promise.resolve(url === 'blob:local-photo' ? PNG : SVG));
    clearShaderFrameAssetCache();
    const restored = parseCanvasDocument(await readDesignLabProjectFile(artifact.blob));
    await importShaderFrameAssets(restored);
    expect(restored.assets[frame.assetId]!.source).toBe(PNG);
    expect((artboards(restored)[1]!.snapshot as CanvasJsonObject).shaderLayers).toEqual(snapshot.shaderLayers);
  });

  it('does not mutate the source when an inactive image fails to embed', async () => {
    const input = fixture();
    const before = structuredClone(input);
    await expect(prepareDesignLabProjectFile(input, undefined, async () => { throw new Error('Image unavailable'); }))
      .rejects.toThrow('Image unavailable');
    expect(input).toEqual(before);
  });

  it('embeds exact font files and role metrics without including or mutating unrelated brand collections', async () => {
    const identity = projectIdentity();
    const before = structuredClone(identity);
    const resolve = vi.fn(async (url: string) => url === 'blob:custom-font' ? FONT : PNG);
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, resolve, identity);
    const source = await readDesignLabProjectFile(artifact.blob);
    const restored = designLabProjectIdentity(source)!;
    expect(restored).toEqual({ id: identity.id, name: identity.name, fonts: [{ ...identity.fonts![0], path: FONT }], typography: identity.typography });
    expect(source).not.toContain('blob:');
    expect(restored).not.toHaveProperty('assets');
    expect(restored).not.toHaveProperty('colors');
    expect(identity).toEqual(before);
    expect(resolve).toHaveBeenCalledWith('blob:custom-font');
    expect(artifact.description).toContain('brand fonts');
    restored.fonts[0]!.family = 'Changed';
    expect(designLabProjectIdentity(source)!.fonts[0]!.family).toBe('Custom Sans');
  });

  it('isolates imported families by receiving workspace and remains idempotent across repeated imports', async () => {
    const identity = projectIdentity();
    identity.typography.push({ family: 'Custom Sans', role: 'Body', usage: 'Body without an explicit asset id' });
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, async (url) => url === 'blob:custom-font' ? FONT : PNG, identity);
    const original = designLabProjectIdentity(await artifact.blob.text())!;
    const isolated = namespaceDesignLabProjectIdentity(original, 'receiver-brand');
    expect(isolated.id).toBe('receiver-brand');
    expect(isolated.fonts[0]!.family).not.toBe('Custom Sans');
    expect(isolated.fonts[0]).toMatchObject({ id: 'custom-variable', path: FONT, weightMin: 100, weightMax: 900 });
    expect(isolated.typography.every(({ family }) => family === isolated.fonts[0]!.family)).toBe(true);
    expect(brandTypographyFamily({ ...identity, ...isolated }, 'Display')).toBe(isolated.fonts[0]!.family);
    expect(namespaceDesignLabProjectIdentity(isolated, 'receiver-brand')).toEqual(isolated);
    expect(namespaceDesignLabProjectIdentity(isolated, 'another-brand')).toEqual(namespaceDesignLabProjectIdentity(original, 'another-brand'));
    expect(original.fonts[0]!.family).toBe('Custom Sans');
  });

  it('rejects missing fonts and mismatched identity instead of falsely promising portable typography', async () => {
    const identity = projectIdentity();
    identity.id = 'another-brand';
    await expect(prepareDesignLabProjectFile(fixture(), undefined, async () => FONT, identity)).rejects.toThrow(/does not match/);
    identity.id = 'test-brand';
    identity.typography[0]!.fontId = 'missing-font';
    await expect(prepareDesignLabProjectFile(fixture(), undefined, async () => FONT, identity)).rejects.toThrow(/not embedded/);
    identity.typography[0]!.fontId = 'custom-variable';
    await expect(prepareDesignLabProjectFile(fixture(), undefined, async () => 'data:text/html,Not%20a%20font', identity)).rejects.toThrow(/font bytes/);
  });

  it('validates imported typography before the host applies it and never fetches untrusted font URLs', async () => {
    const identity = projectIdentity();
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, async (url) => url === 'blob:custom-font' ? FONT : PNG, identity);
    const document = parseCanvasDocument(await artifact.blob.text());
    const embedded = (document.metadata.designLab as CanvasJsonObject).identity as CanvasJsonObject;
    const font = (embedded.fonts as CanvasJsonObject[])[0]!;
    vi.stubGlobal('fetch', vi.fn());
    font.path = 'https://example.com/custom.woff2';
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/embedded/);
    font.path = 'data:font/woff2;base64,%%%%';
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/base64/);
    font.path = FONT;
    font.weightMax = -1;
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/weights/);
    expect(fetch).not.toHaveBeenCalled();
    expect(designLabProjectIdentity(fixture())).toBeNull();
  });

  it.each(['format', 'style', 'role'] as const)('rejects an array masquerading as the %s string enum', async (key) => {
    const identity = projectIdentity();
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, async (url) => url === 'blob:custom-font' ? FONT : PNG, identity);
    const document = parseCanvasDocument(await artifact.blob.text());
    const embedded = (document.metadata.designLab as CanvasJsonObject).identity as CanvasJsonObject;
    const target = (embedded[key === 'role' ? 'typography' : 'fonts'] as CanvasJsonObject[])[0]!;
    target[key] = [target[key]!];
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/invalid/);
  });

  it.each(['image', 'text'] as const)('rejects a remote active image with no asset record even when element.kind is %s', async (kind) => {
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, async () => PNG);
    const document = parseCanvasDocument(await artifact.blob.text());
    const image = document.elements['asset-photo']!;
    // The Design Lab adapter dispatches data.layerType, not element.kind.
    image.kind = kind;
    image.data.url = 'https://example.invalid/untrusted-image';
    delete image.assetId;
    document.assets = {};
    vi.stubGlobal('fetch', vi.fn());
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/embedded/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates the resolved active image bytes instead of trusting the asset kind', async () => {
    const artifact = await prepareDesignLabProjectFile(fixture(), undefined, async () => PNG);
    const document = parseCanvasDocument(await artifact.blob.text());
    const asset = document.assets[document.elements['asset-photo']!.assetId!]!;
    asset.kind = 'binary';
    asset.source = 'data:text/plain,Not%20an%20image';
    asset.mimeType = 'text/plain';
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow(/embedded image/);
  });

  it.each(['https://example.com/image.png', 'data:image/png;base64,', 'data:image/png;base64,%%%%', 'data:text/plain;base64,aGk='])(
    'rejects a resolver returning an unusable image %s', async (source) => {
      await expect(prepareDesignLabProjectFile(fixture(), undefined, async () => source)).rejects.toThrow();
    }
  );

  it.each(['', '{bad JSON', '[]', '{"schemaVersion":99}'])(
    'rejects malformed project contents without applying anything', async (source) => {
      await expect(readDesignLabProjectFile(new Blob([source]))).rejects.toThrow();
    }
  );

  it('rejects non-Design Lab source and nonportable imported assets without network requests', async () => {
    const input = fixture();
    vi.stubGlobal('fetch', vi.fn());
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(input)]))).rejects.toThrow(/embedded/);
    input.metadata.tool = 'animation';
    await expect(readDesignLabProjectFile(new Blob([JSON.stringify(input)]))).rejects.toThrow(/not a Design Lab/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects missing frame assets and duplicate artboard ids', async () => {
    const input = fixture();
    artboards(input)[1]!.id = 'artboard-one';
    await expect(prepareDesignLabProjectFile(input, undefined, async () => PNG)).rejects.toThrow(/unique id/);
    artboards(input)[1]!.id = 'artboard-two';
    (artboards(input)[1]!.snapshot as CanvasJsonObject).shaderLayers = [{ frameSnapshot: { version: 1, assetId: `shader-frame:${'a'.repeat(64)}`, width: 1, height: 1 } }];
    await expect(prepareDesignLabProjectFile(input, undefined, async () => PNG)).rejects.toThrow(/missing its PNG/);
  });

  it('rejects oversized input before reading and sanitizes the download name', async () => {
    const text = vi.fn();
    await expect(readDesignLabProjectFile({ size: DESIGN_LAB_PROJECT_FILE_MAX_BYTES + 1, text })).rejects.toThrow(/128 MB/);
    expect(text).not.toHaveBeenCalled();
    const artifact = await prepareDesignLabProjectFile(fixture(), '../bad/name.json', async () => PNG);
    expect(artifact.fileName).toBe('..-bad-name.glyphfield.json');
  });
});
