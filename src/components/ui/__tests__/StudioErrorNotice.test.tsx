// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioErrorNotice from '../StudioErrorNotice';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('keeps a visible compact indicator and opens complete, wrapping details on click', async () => {
  const dismiss = vi.fn();
  const error = 'This file could not be opened. '.repeat(30);
  await act(() => root.render(<StudioErrorNotice error={error} onDismiss={dismiss} title='Import failed' />));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(error);
  expect(document.querySelector('[role="menu"]')).toBeNull();
  const trigger = container.querySelector('button')!;
  await act(() => trigger.click());
  const menu = document.querySelector('[role="menu"]')!;
  expect(menu.textContent).toContain(error);
  expect(menu.querySelector('span')?.style.whiteSpace).toBe('normal');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await act(() => menu.querySelector<HTMLButtonElement>('button')!.click());
  expect(dismiss).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it('Escape closes only details; dismissing or retrying clears the indicator', async () => {
  await act(() => root.render(<StudioErrorNotice error='Storage full' />));
  await act(() => container.querySelector('button')!.click());
  await act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(container.querySelector('button')).not.toBeNull();
  await act(() => root.render(<StudioErrorNotice error={null} />));
  expect(container.textContent).toBe('');
  await act(() => root.render(<StudioErrorNotice error='Another error' />));
  expect(document.querySelector('[role="menu"]')).toBeNull();
});
