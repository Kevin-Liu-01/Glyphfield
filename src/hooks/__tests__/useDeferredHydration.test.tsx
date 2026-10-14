// @vitest-environment happy-dom

import { act, useRef, useState, type ReactElement } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeferredHydration } from '@/hooks/useDeferredHydration';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

const lifecycle = vi.hoisted(() => ({ clicks: vi.fn(), mounts: vi.fn() }));

function LiveDemo() {
  const [count, setCount] = useState(0);
  lifecycle.mounts();
  return (
    <section data-live>
      <input aria-label='Name' />
      <button onClick={() => { lifecycle.clicks(); setCount((current) => current + 1); }} type='button'>Count {count}</button>
    </section>
  );
}

function Island({ enabled, load }: { enabled: boolean; load: () => Promise<unknown> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const island = useDeferredHydration(containerRef, { enabled, load });
  return (
    <div className='shell' data-live-ready={island.live} ref={containerRef} {...island.props}>
      {island.props ? null : <LiveDemo />}
    </div>
  );
}

function serverHtml(element: ReactElement) {
  const browserWindow = globalThis.window;
  vi.stubGlobal('window', undefined);
  try {
    return renderToString(element);
  } finally {
    vi.stubGlobal('window', browserWindow);
  }
}

describe('useDeferredHydration', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  let resolveLoad: () => void;
  let load: ReturnType<typeof vi.fn<() => Promise<unknown>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.body.appendChild(document.createElement('div'));
    root = null;
    load = vi.fn(() => new Promise<unknown>((resolve) => { resolveLoad = () => resolve(undefined); }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function hydrate(enabled: boolean) {
    container.innerHTML = serverHtml(<Island enabled={enabled} load={load} />);
    lifecycle.mounts.mockClear();
    const serverSection = container.querySelector('[data-live]');
    await act(async () => {
      root = hydrateRoot(container, <Island enabled={enabled} load={load} />);
    });
    return serverSection;
  }

  async function finishLoad() {
    await act(async () => {
      resolveLoad();
      await Promise.resolve();
    });
  }

  it('renders the live children into server HTML', () => {
    const html = serverHtml(<Island enabled={false} load={load} />);
    expect(html).toContain('data-live');
    expect(html).toContain('Count <!-- -->0');
  });

  it('keeps the server markup without rendering the children until enabled and loaded', async () => {
    const serverSection = await hydrate(false);
    expect(container.querySelector('[data-live]')).toBe(serverSection);
    expect(lifecycle.mounts).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();

    await act(async () => root!.render(<Island enabled load={load} />));
    expect(load).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-live]')).toBe(serverSection);
    expect(container.querySelector('.shell')?.getAttribute('data-live-ready')).toBe('false');

    await finishLoad();
    expect(lifecycle.mounts).toHaveBeenCalled();
    expect(container.querySelectorAll('[data-live]')).toHaveLength(1);
    expect(container.querySelector('[data-live]')).not.toBe(serverSection);
    expect(container.querySelector('.shell')?.getAttribute('data-live-ready')).toBe('true');
  });

  it('starts loading on a click in the server markup and replays it on the live element', async () => {
    await hydrate(false);
    await act(async () => container.querySelector('button')!.click());
    expect(load).toHaveBeenCalledOnce();
    expect(lifecycle.clicks).not.toHaveBeenCalled();

    await finishLoad();
    expect(lifecycle.clicks).toHaveBeenCalledOnce();
    expect(container.querySelector('button')?.textContent).toBe('Count 1');
  });

  it('moves focus from the server markup to the matching live element', async () => {
    await hydrate(true);
    act(() => container.querySelector('input')!.focus());
    await finishLoad();
    expect(document.activeElement).toBe(container.querySelector('input'));
    expect(container.querySelector('input')).not.toBeNull();
  });

  it('keeps the server markup when the code fails to load and retries on the next click', async () => {
    load.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await hydrate(false);
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('.shell')?.getAttribute('data-live-ready')).toBe('false');
    await act(async () => container.querySelector('button')!.click());
    expect(load).toHaveBeenCalledTimes(2);
    await finishLoad();
    expect(container.querySelector('.shell')?.getAttribute('data-live-ready')).toBe('true');
  });

  it('renders live children at once on a client-side navigation', () => {
    root = createRoot(container);
    act(() => root!.render(<Island enabled={false} load={load} />));
    expect(container.querySelector('[data-live]')).not.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
