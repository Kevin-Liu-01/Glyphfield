// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolShell } from '@/components/StudioToolWorkspace';
import { STUDIO_TOOLS } from '@/lib/studioCatalog';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

describe('ToolShell source adapter lifetime', () => {
  let container: HTMLDivElement;
  let root: Root;
  const tool = STUDIO_TOOLS.find(({ id }) => id === 'colors')!;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function render(
    source: string,
    onApply: (source: string) => void,
    automation?: { actions: readonly string[]; invoke: (action: string, input?: unknown) => unknown }
  ) {
    await act(() => root.render(
      <ToolShell automation={automation} inspector={null} sourceCode={{ format: 'JSON', source, onApply }} tool={tool}>
        <p>Canvas</p>
      </ToolShell>
    ));
  }

  it('keeps drawer delegation valid across equivalent parent rerenders', async () => {
    const apply = vi.fn();
    await render('{"color":"first"}', apply);
    await act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Edit source code"]')!.click());
    const drawer = window.glyphfield!.studio;
    expect(container.querySelector('.source-code-drawer')).not.toBeNull();
    // Unknown actions delegate to the parent and correctly report capability,
    // rather than treating the still-open editor as an inactive/disposed tab.
    await expect(drawer.invoke('unsupported-action')).rejects.toThrow(RangeError);

    await render('{"color":"first"}', apply);
    expect(drawer.readSource()).toBe('{"color":"first"}');
    await expect(drawer.invoke('unsupported-action')).rejects.toThrow(RangeError);
    expect(window.glyphfield!.studio).toBe(drawer);
  });

  it('keeps the same parent handle while reading and applying current callbacks', async () => {
    const oldApply = vi.fn();
    const nextApply = vi.fn();
    await render('{"color":"first"}', oldApply);
    const parent = window.glyphfield!.studio;

    await render('{"color":"second"}', nextApply);
    expect(window.glyphfield!.studio).toBe(parent);
    expect(parent.readSource()).toBe('{"color":"second"}');
    await parent.applySource('{"color":"third"}');
    expect(nextApply).toHaveBeenCalledExactlyOnceWith('{"color":"third"}');
    expect(oldApply).not.toHaveBeenCalled();
  });

  it('keeps tool-specific action implementations current without replacing the adapter', async () => {
    const apply = vi.fn();
    const firstInvoke = vi.fn(() => 'first');
    const secondInvoke = vi.fn(() => 'second');
    await render('{"color":"first"}', apply, { actions: ['colors.tokens.read'], invoke: firstInvoke });
    const studio = window.glyphfield!.studio;
    expect(studio.describe().actions).toContain('colors.tokens.read');
    await expect(studio.invoke('colors.tokens.read')).resolves.toBe('first');

    await render('{"color":"second"}', apply, { actions: ['colors.tokens.read'], invoke: secondInvoke });
    expect(window.glyphfield!.studio).toBe(studio);
    await expect(studio.invoke('colors.tokens.read')).resolves.toBe('second');
    expect(firstInvoke).toHaveBeenCalledOnce();
    expect(secondInvoke).toHaveBeenCalledOnce();
  });
});
