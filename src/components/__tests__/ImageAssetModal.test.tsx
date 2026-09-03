// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImageAssetModal, { type ImageAssetPlacementMode, type PendingImageImport } from '@/components/ImageAssetModal';
import type { BrandAsset } from '@/lib/brandIdentity';

const SAVED_ASSET: BrandAsset = {
  alt: 'Campaign image',
  focalPoint: { x: 0.5, y: 0.5 },
  id: 'asset-campaign',
  label: 'Campaign image',
  path: 'data:image/png;base64,iVBORw0KGgo=',
  redistribution: 'original',
  surface: 'any',
  tags: ['imported'],
  type: 'image',
  usage: 'Reusable artwork',
};

function buttonWithText(text: string): HTMLButtonElement {
  const candidate = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.includes(text));
  if (!candidate) throw new Error(`Missing button containing: ${text}`);
  return candidate;
}

describe('ImageAssetModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:image-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render({
    assets = [SAVED_ASSET],
    files = [new File(['image'], 'homepage.png', { type: 'image/png' })],
    onCreateTextSticker,
    onImport = vi.fn(),
    onPlace = vi.fn(),
    placementMode = 'image',
  }: {
    assets?: readonly BrandAsset[];
    files?: readonly File[];
    onCreateTextSticker?: () => void;
    onImport?: (items: readonly PendingImageImport[]) => Promise<void> | void;
    onPlace?: (asset: BrandAsset) => Promise<void> | void;
    placementMode?: ImageAssetPlacementMode;
  } = {}) {
    await act(() => {
      root.render(
        <ImageAssetModal
          assets={assets}
          busy={false}
          error={null}
          onClose={vi.fn()}
          onCreateTextSticker={onCreateTextSticker}
          onImport={onImport}
          onPlace={onPlace}
          open
          placementMode={placementMode}
          request={{ files, id: 1 }}
        />
      );
    });
    return { onImport, onPlace };
  }

  it('lets users name queued uploads before one explicit import-and-save action', async () => {
    const { onImport } = await render();
    const nameInput = document.querySelector<HTMLInputElement>('[aria-label="Asset name for homepage.png"]');
    expect(nameInput).not.toBeNull();

    await act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(nameInput, 'Homepage hero');
      nameInput?.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Homepage hero' }));
    });
    await act(() => buttonWithText('Import & save').click());

    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Homepage hero' }),
    ]);
  });

  it('places a saved asset without creating a second upload', async () => {
    const { onImport, onPlace } = await render({ files: [] });

    await act(() => buttonWithText('Campaign image').click());

    expect(onPlace).toHaveBeenCalledWith(SAVED_ASSET);
    expect(onImport).not.toHaveBeenCalled();
    expect(buttonWithText('Import & save').disabled).toBe(true);
  });

  it('can remove a queued file before it reaches the asset library', async () => {
    await render();
    const removeButton = document.querySelector<HTMLButtonElement>('[aria-label="Remove homepage.png"]');

    await act(() => removeButton?.click());

    expect(document.querySelector('[aria-label="Asset name for homepage.png"]')).toBeNull();
    expect(buttonWithText('Import & save').disabled).toBe(true);
  });

  it('offers native text and image sticker sources in sticker mode', async () => {
    const onCreateTextSticker = vi.fn();
    await render({ files: [], onCreateTextSticker, placementMode: 'sticker' });

    expect(document.querySelector('dialog')?.getAttribute('aria-label')).toBe('Add sticker artwork');
    expect(document.body.textContent).toContain('Sticker artwork');
    await act(() => buttonWithText('Create text sticker').click());
    expect(onCreateTextSticker).toHaveBeenCalledOnce();
  });
});
