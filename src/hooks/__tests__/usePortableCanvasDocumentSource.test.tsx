// @vitest-environment happy-dom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const download = vi.hoisted(() => ({
  imageUrlToDataUrl: vi.fn(),
}));

vi.mock('@/lib/download', () => download);

import {
  usePortableCanvasDocumentSource,
  type PortableCanvasDocumentSource,
} from '@/hooks/usePortableCanvasDocumentSource';
import { parseCanvasDocument, type CanvasDocument } from '@/lib/canvasDocument';
import { createStudioCanvasDocument } from '@/lib/studioCanvasDocument';

function documentWithAsset(source: string): CanvasDocument {
  return createStudioCanvasDocument({
    background: '#111216',
    brandId: 'gt',
    createdAt: '2026-09-01T00:00:00.000Z',
    height: 540,
    id: 'gt:portable-hook',
    layers: [{
      asset: { name: 'Artwork', source },
      bounds: { height: 120, rotation: 0, width: 200, x: 24, y: 32 },
      id: 'artwork',
      kind: 'image',
      name: 'Artwork',
    }],
    revision: 3,
    state: { selected: 'artwork' },
    title: 'Portable hook',
    toolId: 'portable-hook',
    updatedAt: '2026-09-01T00:00:00.000Z',
    width: 960,
  });
}

function PortableHarness({
  document,
  onValue,
}: {
  document: CanvasDocument;
  onValue: (value: PortableCanvasDocumentSource) => void;
}) {
  const value = usePortableCanvasDocumentSource(document);
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return <output>{value.status}</output>;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('usePortableCanvasDocumentSource', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    download.imageUrlToDataUrl.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (container.isConnected) {
      await act(async () => {
        root.unmount();
        await settle();
      });
    }
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  async function render(document: CanvasDocument) {
    const values: PortableCanvasDocumentSource[] = [];
    await act(async () => {
      root.render(<PortableHarness document={document} onValue={(value) => values.push(value)} />);
      await settle();
    });
    return values;
  }

  it('invariant_embedded_documents_are_available_synchronously_without_refetching', async () => {
    const embedded = 'data:image/png;base64,aGVsbG8=';
    const values = await render(documentWithAsset(embedded));

    expect(values.at(-1)?.status).toBe('ready');
    expect(parseCanvasDocument(values.at(-1)!.source!).assets['resource:artwork']?.source)
      .toBe(embedded);
    expect(download.imageUrlToDataUrl).not.toHaveBeenCalled();
  });

  it('invariant_remote_assets_are_embedded_before_the_document_becomes_saveable', async () => {
    const embedded = 'data:image/png;base64,cG9ydGFibGU=';
    download.imageUrlToDataUrl.mockResolvedValue(embedded);
    const values = await render(documentWithAsset('/uploads/artwork.png'));

    expect(values[0]?.status).toBe('preparing');
    expect(values.at(-1)?.status).toBe('ready');
    expect(download.imageUrlToDataUrl).toHaveBeenCalledWith('/uploads/artwork.png');
    expect(parseCanvasDocument(values.at(-1)!.source!).assets['resource:artwork']?.source)
      .toBe(embedded);
  });

  it('invariant_embedding_failures_surface_an_error_instead_of_saving_partial_source', async () => {
    download.imageUrlToDataUrl.mockRejectedValue(new Error('asset unavailable'));
    const values = await render(documentWithAsset('/missing.png'));
    const failed = values.at(-1)!;

    expect(failed.status).toBe('error');
    expect(failed.document).toBeNull();
    expect(failed.source).toBeNull();
    expect(failed.error?.message).toBe('asset unavailable');
  });

  it('invariant_invalid_immediate_documents_surface_a_serialization_error', async () => {
    const invalid = { ...documentWithAsset('data:image/png;base64,aGVsbG8='), schemaVersion: 99 };
    const values = await render(invalid);

    expect(values.at(-1)?.status).toBe('error');
    expect(values.at(-1)?.source).toBeNull();
    expect(values.at(-1)?.error).toBeInstanceOf(Error);
  });
});
