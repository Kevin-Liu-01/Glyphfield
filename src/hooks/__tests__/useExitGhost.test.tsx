// @vitest-environment happy-dom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExitGhost } from '../useExitGhost';

function Menu({ open }: { open: boolean }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useExitGhost(menuRef, open);
  return (
    <div className='owner'>
      {open ? (
        <div className='menu' id='menu-1' ref={menuRef} role='menu'>
          <button id='item-1' role='menuitem' type='button'>Rename</button>
        </div>
      ) : null}
    </div>
  );
}

describe('useExitGhost', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  });

  it('leaves an inert copy without ids or roles in place of a closed menu, then removes it', () => {
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, value: () => [] });
    act(() => root.render(<Menu open />));
    act(() => root.render(<Menu open={false} />));

    const ghost = host.querySelector<HTMLElement>('.owner > .menu');
    expect(ghost?.dataset.exiting).toBe('true');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
    expect(ghost?.inert).toBe(true);
    expect(host.querySelector('[role], [id]')).toBeNull();

    act(() => vi.advanceTimersByTime(260));
    expect(host.querySelector('.menu')).toBeNull();
  });

  it('closes at once where animations are unavailable', () => {
    act(() => root.render(<Menu open />));
    act(() => root.render(<Menu open={false} />));
    expect(host.querySelector('.menu')).toBeNull();
  });
});
