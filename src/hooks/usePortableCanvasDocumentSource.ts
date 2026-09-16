'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  canvasDocumentNeedsAssetEmbedding,
  preparePortableCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument,
} from '@/lib/canvasDocument';
import { imageUrlToDataUrl } from '@/lib/download';
import { createPortableAssetResolverCache } from '@/lib/portableCanvasAssets';
import { isShaderFrameAssetSource, resolveShaderFrameAssetSource } from '@/lib/shaderFrameAssets';

export type PortableCanvasDocumentSource = {
  document: CanvasDocument | null;
  error: Error | null;
  source: string | null;
  status: 'error' | 'preparing' | 'ready';
};

function serializeImmediateDocument(document: CanvasDocument): PortableCanvasDocumentSource | null {
  if (canvasDocumentNeedsAssetEmbedding(document)) return null;
  try {
    return {
      document,
      error: null,
      source: serializeCanvasDocument(document),
      status: 'ready',
    };
  } catch (error) {
    return {
      document: null,
      error: error instanceof Error ? error : new Error('The canvas document could not be serialized.'),
      source: null,
      status: 'error',
    };
  }
}

export function usePortableCanvasDocumentSource(
  document: CanvasDocument | null
): PortableCanvasDocumentSource & { prepareSource: () => Promise<string> } {
  const immediate = useMemo(() => document ? serializeImmediateDocument(document) : null, [document]);
  const assetResolver = useMemo(
    () => createPortableAssetResolverCache((source) => isShaderFrameAssetSource(source)
      ? resolveShaderFrameAssetSource(source)
      : imageUrlToDataUrl(source)),
    []
  );
  const [resolved, setResolved] = useState<{
    input: CanvasDocument;
    result: PortableCanvasDocumentSource;
  } | null>(null);

  const prepareSource = useCallback(async () => {
    if (!document) throw new Error('The canvas is not ready to copy yet.');
    if (immediate?.error) throw immediate.error;
    if (immediate?.source) return immediate.source;
    return serializeCanvasDocument(await preparePortableCanvasDocument(document, assetResolver.resolve));
  }, [assetResolver, document, immediate]);

  useEffect(() => {
    if (!document) {
      assetResolver.clear();
      return;
    }
    assetResolver.retain(Object.values(document.assets).map(({ source }) => source));
    if (immediate) return;
    let active = true;
    void preparePortableCanvasDocument(document, assetResolver.resolve)
      .then((portableDocument) => {
        if (!active) return;
        setResolved({
          input: document,
          result: {
            document: portableDocument,
            error: null,
            source: serializeCanvasDocument(portableDocument),
            status: 'ready',
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        setResolved({
          input: document,
          result: {
            document: null,
            error: error instanceof Error ? error : new Error('Canvas assets could not be embedded.'),
            source: null,
            status: 'error',
          },
        });
      });
    return () => {
      active = false;
    };
  }, [assetResolver, document, immediate]);

  useEffect(() => () => assetResolver.clear(), [assetResolver]);

  if (!document) return { document: null, error: null, source: null, status: 'ready', prepareSource };
  if (immediate) return { ...immediate, prepareSource };
  if (resolved?.input === document) return { ...resolved.result, prepareSource };
  return { document: null, error: null, source: null, status: 'preparing', prepareSource };
}
