// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectFileControls, { DownloadProjectFileButton, OpenProjectFileButton } from '../ProjectFileControls';
import { downloadBlob } from '@/lib/download';
import * as projectFiles from '@/lib/designLabProjectFile';

vi.mock('@/lib/download', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/download')>(),
  downloadBlob: vi.fn(),
}));

describe('project-file controls', () => {
  let container: HTMLDivElement;
  let root: Root;
  const artifact: projectFiles.DesignLabProjectFile = {
    blob: new Blob(['{"schemaVersion":2}'], { type: 'application/json' }),
    description: 'Editable project', fileName: 'design.glyphfield.json', format: 'JSON', previewKind: 'file',
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

  function choose(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input;
  }

  it('downloads the prepared editable file once without rendering a PNG', async () => {
    const prepare = vi.fn(async () => artifact);
    await act(() => root.render(<DownloadProjectFileButton prepare={prepare} />));
    await act(async () => { container.querySelector<HTMLButtonElement>('button')!.click(); });
    expect(prepare).toHaveBeenCalledOnce();
    expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(artifact.blob, artifact.fileName);
    expect(container.textContent).toContain('Reopen it with Open project file');
  });

  it('disables repeated download requests while preparation is pending', async () => {
    let resolve!: (value: projectFiles.DesignLabProjectFile) => void;
    const prepare = vi.fn(() => new Promise<projectFiles.DesignLabProjectFile>((done) => { resolve = done; }));
    await act(() => root.render(<DownloadProjectFileButton prepare={prepare} />));
    const button = container.querySelector<HTMLButtonElement>('button')!;
    await act(() => { button.click(); button.click(); });
    expect(prepare).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    await act(async () => resolve(artifact));
    expect(button.disabled).toBe(false);
    expect(downloadBlob).toHaveBeenCalledOnce();
  });

  it('shows preparation failures and rejects empty artifacts without downloading', async () => {
    const prepare = vi.fn(async () => ({ ...artifact, blob: new Blob([], { type: 'application/json' }) }));
    await act(() => root.render(<DownloadProjectFileButton prepare={prepare} />));
    await act(async () => { container.querySelector<HTMLButtonElement>('button')!.click(); });
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be prepared');
  });

  it('validates chosen local bytes before applying source and permits choosing the same file again', async () => {
    const file = new File(['{}'], 'shared.glyphfield.json', { type: 'application/json' });
    const read = vi.spyOn(projectFiles, 'readDesignLabProjectFile').mockResolvedValue('validated source');
    const onOpen = vi.fn(async () => {});
    await act(() => root.render(<OpenProjectFileButton onOpen={onOpen} />));
    let input!: HTMLInputElement;
    await act(async () => { input = choose(file); });
    expect(read).toHaveBeenCalledExactlyOnceWith(file);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('validated source');
    expect(input.value).toBe('');
    await act(async () => { choose(file); });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Opened shared.glyphfield.json.');
  });

  it('does not apply invalid project contents and displays validation errors', async () => {
    vi.spyOn(projectFiles, 'readDesignLabProjectFile').mockRejectedValue(new TypeError('Missing frame PNG'));
    const onOpen = vi.fn();
    await act(() => root.render(<OpenProjectFileButton onOpen={onOpen} />));
    await act(async () => { choose(new File(['broken'], 'bad.json')); });
    expect(onOpen).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Missing frame PNG');
  });

  it('does not claim success when the host refuses an import', async () => {
    vi.spyOn(projectFiles, 'readDesignLabProjectFile').mockResolvedValue('validated source');
    await act(() => root.render(<OpenProjectFileButton onOpen={async () => { throw new Error('Capture in progress'); }} />));
    await act(async () => { choose(new File(['{}'], 'design.json')); });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Capture in progress');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('exposes both paths and explains replacement without hiding disabled state', async () => {
    await act(() => root.render(<ProjectFileControls disabled open={vi.fn()} prepare={vi.fn()} />));
    expect(container.textContent).toContain('Opening replaces this Design Lab workspace');
    expect([...container.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.accept).toContain('.glyphfield.json');
  });
});
