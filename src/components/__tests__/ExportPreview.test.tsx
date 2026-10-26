// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExportPreview, { type ExportPreviewAsset } from '../ExportPreview';
import { downloadBlob } from '@/lib/download';

vi.mock('@/lib/download', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/download')>(),
  downloadBlob: vi.fn(),
}));

describe('export preview', () => {
  let container: HTMLDivElement;
  let root: Root;
  const asset: ExportPreviewAsset = {
    blob: new Blob(['frame'], { type: 'image/png' }),
    fileName: 'board.png',
    format: 'PNG',
    previewKind: 'file',
  };
  const dialogButtons = () => [...document.querySelectorAll<HTMLButtonElement>('dialog button')];
  const dialogButton = (label: string) => dialogButtons().find((button) => button.textContent?.trim() === label);

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('stays open on a success state after the download', async () => {
    await act(() => root.render(<ExportPreview asset={asset} autoRefresh={false} />));
    await act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    expect(dialogButton('Cancel')).toBeDefined();

    await act(() => dialogButton('Download PNG')!.click());
    expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(asset.blob, 'board.png');
    expect(document.querySelector('dialog')).not.toBeNull();
    expect(dialogButton('Downloaded')).toBeDefined();
    expect(dialogButton('Done')).toBeDefined();

    await act(() => dialogButton('Done')!.click());
    expect(document.querySelector('dialog')).toBeNull();
  });
});
