import { describe, expect, it, vi } from 'vitest';
import { createAnimationCanvasDocument, parseAnimationCanvasDocument } from '../animationDocument';
import { createBrandIdentity } from '../brandIdentity';
import { asCanvasJsonObject, createCanvasDocument, parseCanvasDocument, toCanvasJsonObject, type CanvasJsonValue } from '../canvasDocument';
import { animationProjectIdentity, namespaceAnimationProjectIdentity, prepareAnimationProjectFile, readAnimationProjectFile, validateAnimationProjectDocument } from '../animationProjectFile';
import { createDefaultFrameSettings, DEFAULT_SETTINGS } from '../studio';

const PNG = 'data:image/png;base64,aGVsbG8=';
const AUDIO = 'data:audio/wav;base64,aGVsbG8=';
const FONT = 'data:font/woff2;base64,d09GMgABAAAAAAAB';

function fixture() {
  const frame = createDefaultFrameSettings(DEFAULT_SETTINGS);
  const state = {
    backgroundOverrides: {}, frameSettings: { 'text-0': frame }, includeBrandLogo: true,
    mode: 'sequence', playbackRate: 1, sequenceBackground: frame.background,
    sequenceOrder: ['brand-logo', 'text-0'], settings: DEFAULT_SETTINGS, textFrames: 'Welcome',
    audio: { assets: [{ id: 'audio', name: 'Score', source: '/score.wav', mimeType: 'audio/wav', durationMs: 3000, peaks: [] }],
      clips: [{ id: 'clip', assetId: 'audio', timelineStartMs: 0, trimStartMs: 0, trimEndMs: 3000, volume: 1 }], muted: false, volume: 1 },
  };
  return createAnimationCanvasDocument({
    brandId: 'gt', id: 'animation-project', title: 'Banner', revision: 12,
    createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:00:00Z',
    sources: [{ id: 'brand-logo', kind: 'image', name: 'GT', image: {} as CanvasImageSource, width: 200, height: 100, url: 'blob:logo' },
      { id: 'text-0', kind: 'text', text: 'Welcome', fontSize: 48 }],
    state: { ...state, activeArtboardId: 'animation-artboard-main', artboards: [
      { id: 'animation-artboard-main', name: 'Banner', snapshot: state },
      { id: 'animation-artboard-copy', name: 'Portrait', snapshot: { ...state, settings: { ...DEFAULT_SETTINGS, width: 900, height: 1600 } } },
    ] },
  });
}

describe('Animation project files', () => {
  it('embeds shared assets once and round-trips artboards, audio, timing and unknown fields without mutating input', async () => {
    const document = fixture();
    document.metadata.future = { preserved: true };
    const before = structuredClone(document);
    const resolve = vi.fn(async (source: string) => source === 'blob:logo' ? PNG : AUDIO);
    const file = await prepareAnimationProjectFile(document, 'Launch/September', resolve);
    expect(file).toMatchObject({ fileName: 'Launch-September.glyphfield.json', format: 'JSON', previewKind: 'file' });
    expect(file.blob.type).toBe('application/json');
    const imported = parseAnimationCanvasDocument(await readAnimationProjectFile(file.blob));
    expect(imported.document.metadata.future).toEqual({ preserved: true });
    expect(imported.state.artboards).toHaveLength(2);
    expect(imported.state.artboards?.[1]?.snapshot.settings).toMatchObject({ width: 900, height: 1600 });
    expect(imported.state.audio?.assets[0]?.source).toBe(AUDIO);
    expect(imported.assets[0]?.source).toBe(PNG);
    expect(imported.document.revision).toBe(12);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(document).toEqual(before);
  });

  it('embeds and validates brand fonts with private imported families', async () => {
    const identity = createBrandIdentity('General Translation', 'gt');
    identity.fonts = [{ id: 'inter', family: 'Inter', fileName: 'inter.woff2', format: 'woff2', label: 'Inter', path: '/inter.woff2', style: 'normal', weight: 400 }];
    identity.typography = [{ family: 'Inter', fontId: 'inter', role: 'Display', usage: 'Display' }];
    const file = await prepareAnimationProjectFile(fixture(), undefined, async (source) =>
      source.includes('woff') ? FONT : source.includes('logo') ? PNG : AUDIO, identity);
    const source = await readAnimationProjectFile(file.blob);
    const imported = animationProjectIdentity(source)!;
    expect(imported.fonts[0]?.path).toBe(FONT);
    expect(imported.typography[0]?.family).toBe('Inter');
    const isolated = namespaceAnimationProjectIdentity(imported, 'another-brand');
    expect(isolated.id).toBe('another-brand');
    expect(isolated.fonts[0]?.family).toMatch(/^Glyphfield Project /);
    expect(isolated.typography[0]?.family).toBe(isolated.fonts[0]?.family);
    expect(imported.id).toBe('gt');
  });

  it('opens older portable animations that do not contain a font snapshot', async () => {
    const file = await prepareAnimationProjectFile(fixture(), undefined, async (source) => source.includes('logo') ? PNG : AUDIO);
    expect(animationProjectIdentity(await readAnimationProjectFile(file.blob))).toBeNull();
  });

  it.each(['https://example.com/logo.png', 'blob:expired'])('rejects unembedded image %s without fetching it', async (source) => {
    const document = fixture();
    document.assets['animation:brand-logo']!.source = source;
    await expect(readAnimationProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow();
  });

  it('rejects wrong tools, empty/oversized files, corrupt data, and missing artboards', async () => {
    await expect(readAnimationProjectFile(new Blob([]))).rejects.toThrow('empty');
    await expect(readAnimationProjectFile({ size: 129 * 1024 * 1024, text: vi.fn() })).rejects.toThrow('128 MB');
    await expect(readAnimationProjectFile(new Blob(['{invalid']))).rejects.toThrow();
    await expect(prepareAnimationProjectFile(createCanvasDocument('a', 'gt', 'Design', 100, 100, []), undefined, async () => PNG)).rejects.toThrow('not an Animation');
    const document = fixture();
    asCanvasJsonObject(document.metadata.animation)!.activeArtboardId = 'absent';
    await expect(prepareAnimationProjectFile(document)).rejects.toThrow('active animation artboard');
  });

  it('rejects malformed font bytes and invalid animation settings before applying', async () => {
    const document = fixture();
    const metadata = asCanvasJsonObject(document.metadata.animation)!;
    metadata.playbackRate = 0;
    await expect(prepareAnimationProjectFile(document)).rejects.toThrow('playback rate');
    metadata.playbackRate = 1;
    metadata.identity = toCanvasJsonObject({ id: 'gt', name: 'GT', fonts: [], typography: [] });
    await expect(prepareAnimationProjectFile(document, undefined, async () => PNG)).rejects.toThrow('fonts');
  });

  it('rejects remote inactive-artboard audio even when registered images are embedded', async () => {
    const file = await prepareAnimationProjectFile(fixture(), undefined, async (source) => source.includes('logo') ? PNG : AUDIO);
    const document = parseCanvasDocument(await file.blob.text());
    const metadata = asCanvasJsonObject(document.metadata.animation)!;
    const boards = metadata.artboards as { snapshot: { audio: { assets: unknown[] } } }[];
    boards[1]!.snapshot.audio.assets = [{ id: 'remote', source: 'https://example.com/score.wav', name: 'Remote' }];
    await expect(readAnimationProjectFile(new Blob([JSON.stringify(document)]))).rejects.toThrow();
  });

  it('rejects a coerced mode before loading assets or altering the source document', () => {
    const document = fixture();
    asCanvasJsonObject(document.metadata.animation)!.mode = ['sequence'];
    const before = structuredClone(document);
    expect(() => validateAnimationProjectDocument(document)).toThrow('mode');
    expect(document).toEqual(before);
  });

  it.each([
    ['holdMs', 'bad'], ['holdMs', 0], ['holdMs', -1], ['holdMs', Number.POSITIVE_INFINITY],
    ['transitionMs', '240'], ['transitionMs', -1], ['transitionMs', Number.NaN],
  ])('rejects invalid %s=%s in active and inactive animation timing', (key, value) => {
    for (const inactive of [false, true]) {
      const document = fixture();
      const state = asCanvasJsonObject(document.metadata.animation)!;
      const board = asCanvasJsonObject((state.artboards as CanvasJsonValue[])[1])!;
      const owner = inactive ? asCanvasJsonObject(board.snapshot)! : state;
      asCanvasJsonObject(owner.settings)![key as string] = value as string | number;
      expect(() => validateAnimationProjectDocument(document)).toThrow(String(key));
    }
  });

  it('preserves positive source-authored holds and zero-duration transitions', () => {
    const document = fixture();
    const state = asCanvasJsonObject(document.metadata.animation)!;
    asCanvasJsonObject(state.settings)!.holdMs = 5000;
    asCanvasJsonObject(state.settings)!.transitionMs = 0;
    expect(() => validateAnimationProjectDocument(document)).not.toThrow();
  });

  it.each(['bezier', 'shaderSettings', 'frameBackground', 'sequenceMaterialSettings'])('rejects missing active snapshot field %s before packaging', async (field) => {
    const document = fixture();
    const state = asCanvasJsonObject(document.metadata.animation)!;
    if (field === 'bezier' || field === 'shaderSettings') delete asCanvasJsonObject(state.settings)![field];
    if (field === 'frameBackground') delete asCanvasJsonObject(asCanvasJsonObject(state.frameSettings)!['text-0'])!.background;
    if (field === 'sequenceMaterialSettings') delete asCanvasJsonObject(state.sequenceBackground)!.materialSettings;
    const resolve = vi.fn(async () => PNG);
    await expect(prepareAnimationProjectFile(document, undefined, resolve)).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(['bezier', 'frameBackground', 'duplicateFrame', 'wrongId'])('rejects an inactive artboard with invalid %s instead of silently dropping it', async (field) => {
    const portable = await prepareAnimationProjectFile(fixture(), undefined, async (source) => source.includes('logo') ? PNG : AUDIO);
    const document = parseCanvasDocument(await portable.blob.text());
    const state = asCanvasJsonObject(document.metadata.animation)!;
    if (!Array.isArray(state.artboards)) throw new Error('Fixture is missing artboards');
    const board = asCanvasJsonObject(state.artboards[1])!;
    const snapshot = asCanvasJsonObject(board.snapshot)!;
    if (field === 'bezier') delete asCanvasJsonObject(snapshot.settings)!.bezier;
    if (field === 'frameBackground') delete asCanvasJsonObject(asCanvasJsonObject(snapshot.frameSettings)!['text-0'])!.background;
    if (field === 'duplicateFrame') snapshot.sequenceOrder = ['text-0', 'text-0'];
    if (field === 'wrongId') board.id = 'unrestorable-id';
    const before = JSON.stringify(document);
    await expect(readAnimationProjectFile(new Blob([before]))).rejects.toThrow();
    expect(JSON.stringify(document)).toBe(before);
  });
});
