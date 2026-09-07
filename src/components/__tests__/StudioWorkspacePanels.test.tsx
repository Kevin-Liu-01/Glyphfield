// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retainedProjectWorkspaceIdentities, StudioWorkspacePanels } from '@/components/StudioApp';
import { GT_BRAND_IDENTITY, STARTER_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { STUDIO_TOOLS, type StudioToolId } from '@/lib/studioCatalog';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<unknown>) => function EditorStub({ active }: { active?: boolean }) {
    return <div data-editor={load.name} data-render-active={String(active)} />;
  },
}));

describe('retained Studio project workspaces', () => {
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
    vi.unstubAllGlobals();
  });

  async function render(active: boolean, activeToolId: StudioToolId) {
    const activeTool = STUDIO_TOOLS.find(({ id }) => id === activeToolId)!;
    await act(() => root.render(
      <StudioWorkspacePanels
        active={active}
        activeIdentity={STARTER_BRAND_IDENTITY}
        activeTool={activeTool}
        activeToolId={activeToolId}
        hasPendingIdentityChanges={false}
        onIdentityChange={vi.fn()}
        onIdentitySave={vi.fn()}
      />
    ));
  }

  it('keeps editor and font stylesheet order stable when project tabs reorder', () => {
    const identities = [STARTER_BRAND_IDENTITY, GT_BRAND_IDENTITY];
    const openIds = identities.map(({ id }) => id);
    const before = retainedProjectWorkspaceIdentities(identities, openIds, openIds, openIds[0]);
    const after = retainedProjectWorkspaceIdentities(identities, [...openIds].reverse(), [...openIds].reverse(), openIds[0]);
    expect(after).toEqual(before);
    expect(after[0]).toBe(STARTER_BRAND_IDENTITY);
    expect(after[1]).toBe(GT_BRAND_IDENTITY);
  });

  it('retains only open visited projects and always includes the active open project', () => {
    const identities = [STARTER_BRAND_IDENTITY, GT_BRAND_IDENTITY];
    const openIds = identities.map(({ id }) => id);
    expect(retainedProjectWorkspaceIdentities(identities, openIds, [], openIds[0])).toEqual([STARTER_BRAND_IDENTITY]);
    expect(retainedProjectWorkspaceIdentities(identities, [openIds[1]], openIds, openIds[1])).toEqual([GT_BRAND_IDENTITY]);
  });

  it('does not mount a renderer just because an inactive project was warmed', async () => {
    await render(false, 'material');
    expect(container.querySelector('[data-editor]')).toBeNull();

    await render(false, 'animation');
    expect(container.querySelector('[data-editor]')).toBeNull();
  });

  it('retains a visited renderer but pauses it immediately when its project is hidden', async () => {
    await render(true, 'material');
    const shader = container.querySelector('[data-editor="loadShaderLabStudio"]');
    expect(shader?.getAttribute('data-render-active')).toBe('true');

    await render(false, 'material');
    expect(container.querySelector('[data-editor="loadShaderLabStudio"]')).toBe(shader);
    expect(shader?.getAttribute('data-render-active')).toBe('false');
    expect(shader?.closest('.studio-workspace-layer')?.hasAttribute('inert')).toBe(true);

    await render(false, 'animation');
    expect(container.querySelector('[data-editor="loadAnimationStudio"]')).toBeNull();
    expect(shader?.getAttribute('data-render-active')).toBe('false');

    await render(true, 'material');
    expect(container.querySelector('[data-editor="loadShaderLabStudio"]')).toBe(shader);
    expect(shader?.getAttribute('data-render-active')).toBe('true');
  });

  it('activates only the selected editor when switching between retained tools', async () => {
    await render(true, 'material');
    await render(true, 'animation');
    expect(container.querySelector('[data-editor="loadShaderLabStudio"]')?.getAttribute('data-render-active')).toBe('false');
    expect(container.querySelector('[data-editor="loadAnimationStudio"]')?.getAttribute('data-render-active')).toBe('true');
    expect(container.querySelectorAll('[data-render-active="true"]')).toHaveLength(1);

    await render(true, 'identity');
    expect(container.querySelectorAll('[data-render-active="true"]')).toHaveLength(0);
  });
});
