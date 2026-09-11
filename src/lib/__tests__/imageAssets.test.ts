// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  createImportedBrandAsset,
  detectImageMimeType,
  embeddedImageSourceBytes,
  imageLibraryErrorMessage,
  readEmbeddedImageFile,
} from '../imageAssets';

describe('shared image asset ingestion', () => {
  it('detects supported formats from bytes', () => {
    expect(detectImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe('image/png');
    expect(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMimeType(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(detectImageMimeType(new TextEncoder().encode('<svg viewBox="0 0 1 1"></svg>'))).toBe('image/svg+xml');
  });

  it('corrects a misleading file extension and supplied MIME type', async () => {
    const file = new File(
      [Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
      'homepage.png',
      { type: 'image/png' }
    );

    const image = await readEmbeddedImageFile(file);

    expect(image).toMatchObject({
      byteLength: 6,
      mimeType: 'image/jpeg',
      name: 'homepage',
    });
    expect(image.source).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('creates a reusable brand asset with an explicit library identity', () => {
    const asset = createImportedBrandAsset({
      byteLength: 8,
      mimeType: 'image/png',
      name: 'Campaign',
      source: 'data:image/png;base64,iVBORw0KGgo=',
    }, 'Campaign hero', 'asset-campaign');

    expect(asset).toMatchObject({
      id: 'asset-campaign',
      label: 'Campaign hero',
      path: 'data:image/png;base64,iVBORw0KGgo=',
      tags: ['design-lab', 'imported'],
      type: 'image',
    });
  });

  it('rejects unsupported bytes and oversized local assets', async () => {
    await expect(readEmbeddedImageFile(new File(['not an image'], 'notes.png')))
      .rejects.toThrow('not a supported');
    await expect(readEmbeddedImageFile(new File(['12345'], 'large.png'), 4))
      .rejects.toThrow('under 4 bytes');
  });

  it('turns browser quota failures into an actionable library cleanup message', () => {
    expect(imageLibraryErrorMessage(new DOMException('The quota has been exceeded.', 'QuotaExceededError')))
      .toBe('Browser storage is full. Delete unused assets from the library below, then retry.');
    expect(imageLibraryErrorMessage(new Error('decode failed'))).toBe('decode failed');
  });

  it('measures embedded sources so cleanup can prioritize larger assets', () => {
    expect(embeddedImageSourceBytes('data:image/png;base64,iVBORw0KGgo=')).toBe(8);
    expect(embeddedImageSourceBytes('data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E')).toBe(11);
    expect(embeddedImageSourceBytes('/assets/brand-mark.svg')).toBeNull();
  });
});
