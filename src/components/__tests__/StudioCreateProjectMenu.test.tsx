// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
  useLocale: () => 'en-US',
}));
vi.mock('@/lib/studioProjectCreation', () => ({
  createScratchStudioProject: vi.fn(async (toolId: string, name: string) => ({ identity: { id: `new-${toolId}`, name }, toolId })),
  importStudioProject: vi.fn(),
}));

import StudioCreateProjectMenu from '@/components/StudioCreateProjectMenu';
import { requestBrandIdentitySection, takeBrandIdentitySection } from '@/components/brandIdentityEntry';
import { createScratchStudioProject } from '@/lib/studioProjectCreation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('new project menu', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onCreated = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<StudioCreateProjectMenu disabled={false} identities={[]} onCreated={onCreated} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll('.studio-context-menu').forEach((menu) => menu.remove());
    vi.clearAllMocks();
  });

  function openMenu() {
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Add brand project"]')!.click());
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  }

  it('starts with the brand, putting the agent first, before blank files and imports', () => {
    const labels = openMenu().map((item) => item.textContent ?? '');
    expect(labels).toHaveLength(6);
    expect(labels[0]).toContain('Set up with your agent');
    expect(labels[1]).toContain('Blank brand');
    expect(labels[2]).toContain('Copy a reference brand');
    expect(labels[3]).toContain('Blank design');
    expect(labels[4]).toContain('Blank animation');
    expect(labels[5]).toContain('Import project…');
    expect(document.body.textContent).toContain('Start a brand');
    expect(document.body.textContent).toContain('Start with a file');
  });

  it('opens a brand made for the agent on Set up with agent, and a blank brand on its overview', async () => {
    const items = openMenu();
    act(() => items[0]!.click());
    await act(async () => { await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1)); });
    expect(createScratchStudioProject).toHaveBeenLastCalledWith('identity', 'Untitled brand');
    expect(onCreated).toHaveBeenLastCalledWith({ identity: { id: 'new-identity', name: 'Untitled brand' }, toolId: 'identity' });
    expect(takeBrandIdentitySection('new-identity')).toBe('agent');

    const again = openMenu();
    act(() => again[1]!.click());
    await act(async () => { await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2)); });
    expect(takeBrandIdentitySection('new-identity')).toBeUndefined();
  });
});

describe('Brand identity section request', () => {
  it('is read once by the next editor that mounts for that project', () => {
    requestBrandIdentitySection('brand-a', 'agent');
    expect(takeBrandIdentitySection('brand-b')).toBeUndefined();
    expect(takeBrandIdentitySection('brand-a')).toBe('agent');
    expect(takeBrandIdentitySection('brand-a')).toBeUndefined();
  });
});
