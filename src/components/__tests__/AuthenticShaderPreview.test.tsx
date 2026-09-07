// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import ShaderSkeleton from '@/components/ShaderSkeleton';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('authentic shader preview lifecycle', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('uses the shared skeleton until the real thumbnail loads', async () => {
    act(() => root.render(<AuthenticShaderPreview materialId='paper-gem-smoke' />));
    expect(container.querySelector('[data-shader-skeleton="loading"]')).not.toBeNull();
    const image = container.querySelector('img')!;
    expect(image.className).toBe('authentic-shader-preview-image');
    expect(image.style.opacity).toBe('0');
    expect(container.innerHTML).not.toContain('gradient(');
    await act(async () => { image.dispatchEvent(new Event('load')); });
    expect(image.style.opacity).toBe('1');
    expect(container.querySelector('[data-shader-skeleton]')).toBeNull();
  });

  it('does not show the previous frame when changing materials', async () => {
    act(() => root.render(<AuthenticShaderPreview materialId='paper-gem-smoke' />));
    const previous = container.querySelector('img')!;
    await act(async () => { previous.dispatchEvent(new Event('load')); });
    act(() => root.render(<AuthenticShaderPreview materialId='shadergradient-prismatic-sphere' />));
    const next = container.querySelector('img')!;
    expect(next).not.toBe(previous);
    expect(next.style.opacity).toBe('0');
    expect(container.querySelectorAll('img')).toHaveLength(1);
    await act(async () => { next.dispatchEvent(new Event('load')); });
    expect(next.style.opacity).toBe('1');
  });

  it('uses the same quiet skeleton for failed assets, never a broken image', () => {
    act(() => root.render(<AuthenticShaderPreview materialId='paper-gem-smoke' />));
    const image = container.querySelector('img')!;
    act(() => image.dispatchEvent(new Event('error')));
    expect(image.style.opacity).toBe('0');
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
    expect(container.textContent).not.toContain('LIVE');
  });

  it('waits for decoded pixels and ignores a replaced image finishing late', async () => {
    let finishDecode: () => void = () => {};
    vi.mocked(HTMLImageElement.prototype.decode).mockImplementationOnce(() => new Promise<void>((resolve) => { finishDecode = resolve; }));
    act(() => root.render(<AuthenticShaderPreview materialId='paper-gem-smoke' />));
    const previous = container.querySelector('img')!;
    act(() => { previous.dispatchEvent(new Event('load')); });
    expect(container.querySelector('[data-shader-skeleton="loading"]')).not.toBeNull();
    act(() => root.render(<AuthenticShaderPreview materialId='shadergradient-prismatic-sphere' />));
    await act(async () => finishDecode());
    expect(container.querySelector('img')?.style.opacity).toBe('0');
    expect(container.querySelector('[data-shader-skeleton="loading"]')).not.toBeNull();
  });

  it('needs no canvas, image asset, or animation to paint the fallback', () => {
    act(() => root.render(<ShaderSkeleton />));
    expect(container.querySelectorAll('*')).toHaveLength(1);
    expect(container.firstElementChild?.className).toBe('shader-skeleton ');
    expect(container.querySelector('canvas, img, svg')).toBeNull();
  });
});
