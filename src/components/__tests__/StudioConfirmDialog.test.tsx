// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioConfirmDialog from '@/components/StudioConfirmDialog';

describe('Studio confirmation dialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  let launcher: HTMLButtonElement;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    launcher = document.createElement('button');
    container = document.createElement('div');
    document.body.append(launcher, container);
    launcher.focus();
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    launcher.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render() {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    await act(() => root.render(
      <StudioConfirmDialog
        cancelLabel='Cancel'
        confirmLabel='Delete project'
        description='Acme is removed from your projects in this browser.'
        onCancel={onCancel}
        onConfirm={onConfirm}
        title='Delete Acme?'
      />
    ));
    return { onCancel, onConfirm };
  }

  const button = (name: string) => [...container.querySelectorAll('button')].find((element) => element.textContent === name)!;

  it('opens as a labelled modal alert dialog with focus on Cancel, and restores focus after', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    await render();
    const dialog = container.querySelector('dialog')!;
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete Acme?');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain('removed from your projects');
    expect(document.activeElement).toBe(button('Cancel'));
    await act(() => root.render(null));
    expect(document.activeElement).toBe(launcher);
  });

  it('confirms only through the destructive button; Escape, Cancel and the backdrop cancel', async () => {
    const { onCancel, onConfirm } = await render();
    await act(() => { container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })); });
    await act(() => button('Cancel').click());
    await act(() => container.querySelector<HTMLButtonElement>('.studio-modal-backdrop')!.click());
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
    await act(() => button('Delete project').click());
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
