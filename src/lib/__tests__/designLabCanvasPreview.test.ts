// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';

import { previewSelectedTextStyle, selectedCanvasLayerElement } from '@/lib/designLabCanvasPreview';

function createWorkspace(active: boolean) {
  const workspace = document.createElement('section');
  workspace.className = 'studio-project-workspace-layer';
  workspace.dataset.active = String(active);
  workspace.innerHTML = '<div class="shader-lab-v2-stage"><div class="editable-canvas-layer" aria-pressed="true"><span class="shader-lab-v2-layer-text" style="font-size: 20px">Canvas text</span></div></div>';
  document.body.append(workspace);
  return {
    layer: workspace.querySelector<HTMLElement>('.editable-canvas-layer')!,
    stage: workspace.querySelector<HTMLElement>('.shader-lab-v2-stage')!,
    text: workspace.querySelector<HTMLElement>('.shader-lab-v2-layer-text')!,
    workspace,
  };
}

afterEach(() => document.body.replaceChildren());

describe('Design Lab DOM-only inspector previews', () => {
  it('updates only the owning artboard when a retained hidden workspace has an earlier selection', () => {
    const hidden = createWorkspace(false);
    const active = createWorkspace(true);

    previewSelectedTextStyle(active.stage, 1, 'fontSize', '64px');

    expect(active.text.style.fontSize).toBe('64px');
    expect(hidden.text.style.fontSize).toBe('20px');
    expect(selectedCanvasLayerElement(active.stage, 1)).toBe(active.layer);
  });

  it('does not use a different visible canvas when the owner has no selection', () => {
    const unrelated = createWorkspace(true);
    const active = createWorkspace(true);
    active.layer.setAttribute('aria-pressed', 'false');

    previewSelectedTextStyle(active.stage, 1, 'fontSize', '64px');

    expect(selectedCanvasLayerElement(active.stage, 1)).toBeNull();
    expect(unrelated.text.style.fontSize).toBe('20px');
  });

  it('does not mutate a missing or inactive owner', () => {
    const hidden = createWorkspace(false);

    previewSelectedTextStyle(null, 1, 'fontSize', '64px');
    previewSelectedTextStyle(hidden.stage, 1, 'fontSize', '64px');

    expect(selectedCanvasLayerElement(null, 1)).toBeNull();
    expect(selectedCanvasLayerElement(hidden.stage, 1)).toBeNull();
    expect(hidden.text.style.fontSize).toBe('20px');
  });

  it.each(['hidden', 'inert'])('does not mutate an owner blocked by %s', (attribute) => {
    const active = createWorkspace(true);
    active.workspace.setAttribute(attribute, '');
    previewSelectedTextStyle(active.stage, 1, 'fontSize', '64px');
    expect(active.text.style.fontSize).toBe('20px');
    expect(selectedCanvasLayerElement(active.stage, 1)).toBeNull();
  });

  it('does not apply a delayed preview after its owner unmounts', () => {
    const active = createWorkspace(true);
    active.workspace.remove();
    previewSelectedTextStyle(active.stage, 1, 'fontSize', '64px');
    expect(active.text.style.fontSize).toBe('20px');
    expect(selectedCanvasLayerElement(active.stage, 1)).toBeNull();
  });

  it.each([0, 2])('does not preview one layer for a selection count of %i', (count) => {
    const active = createWorkspace(true);
    previewSelectedTextStyle(active.stage, count, 'fontSize', '64px');
    expect(active.text.style.fontSize).toBe('20px');
    expect(selectedCanvasLayerElement(active.stage, count)).toBeNull();
  });
});
