// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/expressions/expressionEditorUtils', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/expressions/expressionEditorUtils')>(),
  measureImageAspect: vi.fn(async () => 0),
}));

import { measureImageAspect } from '@/components/expressions/expressionEditorUtils';
import { useAssetAspects } from '@/components/expressions/useAssetAspects';
import type { CanvasAsset, CanvasDocument } from '@/lib/canvasDocument';

const image = (id: string, source: string): CanvasAsset => ({
  byteLength: 0,
  id,
  kind: 'image',
  mimeType: 'image/png',
  name: id,
  source,
});

describe('useAssetAspects', () => {
  let container: HTMLDivElement;
  let root: Root;

  function Probe({ assets }: { assets: CanvasDocument['assets'] }) {
    useAssetAspects(assets);
    return null;
  }

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('measures a failing image once until its source changes', async () => {
    await act(async () => root.render(<Probe assets={{ a: image('a', 'not-a-data-url') }} />));
    expect(measureImageAspect).toHaveBeenCalledTimes(1);

    // Re-rendering with a fresh assets object must not re-measure the failure.
    await act(async () => root.render(<Probe assets={{ a: image('a', 'not-a-data-url') }} />));
    await act(async () => root.render(<Probe assets={{}} />));
    await act(async () => root.render(<Probe assets={{ a: image('a', 'not-a-data-url') }} />));
    expect(measureImageAspect).toHaveBeenCalledTimes(1);

    // A changed source is measured again.
    await act(async () => root.render(<Probe assets={{ a: image('a', 'another-bad-source') }} />));
    expect(measureImageAspect).toHaveBeenCalledTimes(2);
  });
});
