import { describe, expect, it } from 'vitest';

import type { CompositionAsset, CompositionLogoLayer, CompositionTextLayer } from '../designLabModel';
import { applyAssetEdit, applyPeerTextEdit, peerEdit, type TextLayerEdit } from '../designLabSelectionEdit';

const text = (id: `text-${string}`, overrides: Partial<CompositionTextLayer> = {}): CompositionTextLayer => ({
  align: 'center', id, lineHeight: 1, name: id, tracking: 0, transform: { scale: 1, x: 10, y: 20 },
  value: 'Hello world', visible: true, weight: 400, wrap: 'wrap', ...overrides,
});
const logo: CompositionLogoLayer = { id: 'logo-a', name: 'Mark', transform: { scale: 1, x: 0, y: 0 }, url: 'data:image/svg+xml,', visible: true };
const image: CompositionAsset = { id: 'asset-a', name: 'Photo', transform: { scale: 1, x: 5, y: 5 }, url: 'data:image/png;base64,', visible: true };

describe('multi-layer inspector edits', () => {
  it('shares settings with the same kind but never content, crop or position', () => {
    const primary = text('text-a', { transform: { scale: 1, widthScale: 1, x: 10, y: 20 } });
    const edit: TextLayerEdit = { color: '#FF0000', transform: { scale: 1, widthScale: 2, x: 40, y: 50 }, value: 'Primary copy' };
    expect(peerEdit(edit, primary, 'text-b')).toEqual({ color: '#FF0000', transform: { widthScale: 2 } });
    expect(peerEdit({ value: 'Only mine' }, primary, 'text-b')).toBeNull();
    expect(peerEdit({ imageCrop: { enabled: true } } as never, image, 'asset-b')).toBeNull();
  });

  it('shares opacity across kinds and mark appearance between marks and images', () => {
    expect(peerEdit({ color: '#00FF00', opacity: 0.4 }, text('text-a'), 'logo-a')).toEqual({ opacity: 0.4 });
    expect(peerEdit({ appearance: { borderEnabled: true }, color: '#FFFFFF' }, logo, 'asset-a')).toEqual({ appearance: { borderEnabled: true } });
    expect(peerEdit({ appearance: { borderEnabled: true } }, logo, 'text-a')).toBeNull();
  });

  it('applies a font to another box over its inline runs, and sizes it from its own box', () => {
    const peer = text('text-b', {
      fontSize: 20, runs: [{ end: 5, start: 0, style: { color: '#00FF00', fontRole: 'Code' } }], transform: { scale: 2, x: 300, y: 400 },
    });
    const fonted = applyPeerTextEdit(peer, { fontId: 'katagami-sans-variable', weight: 600 });
    expect(fonted).toMatchObject({ fontId: 'katagami-sans-variable', weight: 600, value: 'Hello world' });
    expect(fonted.runs).toEqual([{ end: 5, start: 0, style: { color: '#00FF00' } }]);
    const sized = applyPeerTextEdit(peer, { fontSize: 64, transform: { heightScale: 1, scale: 1, widthScale: 1 } });
    expect(sized.fontSize).toBe(64);
    expect(sized.transform).toMatchObject({ scale: 1, x: 300, y: 400 });
  });

  it('merges partial appearance and sticker finish into each image', () => {
    const sticker = applyAssetEdit({ ...image, appearance: { borderEnabled: false } as CompositionAsset['appearance'] }, {
      appearance: { borderWidth: 9 }, stickerFinish: { curl: 12 },
    });
    expect(sticker.appearance).toMatchObject({ borderEnabled: false, borderWidth: 9 });
    expect(sticker.stickerFinish?.curl).toBe(12);
  });
});
