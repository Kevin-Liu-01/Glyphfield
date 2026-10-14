// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResizableSidebar from '@/components/ResizableSidebar';

describe('ResizableSidebar storage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mounts, resizes and collapses when every storage access throws', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    });

    await act(async () => {
      root.render(<ResizableSidebar label='Layers' storageKey='test'>content</ResizableSidebar>);
    });
    const aside = container.querySelector('aside');
    const handle = container.querySelector<HTMLElement>('[role="separator"]');
    expect(aside?.style.width).toBe('292px');

    await act(async () => {
      handle?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(aside?.style.width).toBe('300px');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(aside?.getAttribute('data-collapsed')).toBe('true');
  });

  it('restores a stored width and collapsed state when storage works', async () => {
    window.localStorage.setItem('glyphfield:sidebar:restore:width', '400');
    window.localStorage.setItem('glyphfield:sidebar:restore:collapsed', 'true');

    await act(async () => {
      root.render(<ResizableSidebar label='Layers' storageKey='restore'>content</ResizableSidebar>);
    });
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('data-collapsed')).toBe('true');
    expect(aside?.style.getPropertyValue('--resizable-sidebar-expanded-width')).toBe('400px');
    window.localStorage.clear();
  });
});
