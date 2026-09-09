// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerStudioAutomation, studioAutomationForOwner } from '@/lib/studioAutomation';

const disposers: Array<() => void> = [];

function workspace(project: string, active: boolean, tool = 'material') {
  const outer = document.createElement('div');
  outer.className = 'studio-project-workspace-layer';
  outer.dataset.project = project;
  const inner = document.createElement('div');
  inner.className = 'studio-workspace-layer';
  inner.dataset.tool = tool;
  inner.dataset.active = 'true';
  outer.append(inner);
  document.body.append(outer);
  setActive(outer, active);
  return { outer, inner };
}

function setActive(element: HTMLElement, active: boolean) {
  element.dataset.active = String(active);
  element.toggleAttribute('inert', !active);
  element.setAttribute('aria-hidden', String(!active));
}

function register(owner: HTMLElement, source: string, toolId: 'material' | 'animation' = 'material') {
  const applySource = vi.fn();
  const invoke = vi.fn(() => source);
  disposers.push(registerStudioAutomation({ toolId, getSource: () => source, applySource, invoke }, owner));
  return { applySource, invoke };
}

afterEach(() => {
  disposers.splice(0).reverse().forEach((dispose) => dispose());
  document.body.replaceChildren();
  delete window.glyphfield;
  vi.restoreAllMocks();
});

describe('retained workspace Browser API ownership', () => {
  it('switches to an already-mounted project synchronously without re-registering it', async () => {
    const first = workspace('first', true);
    const second = workspace('second', false);
    const firstAdapter = register(first.inner, 'first source');
    register(second.inner, 'second source');
    expect(window.glyphfield?.studio.readSource()).toBe('first source');

    setActive(first.outer, false);
    setActive(second.outer, true);
    expect(window.glyphfield?.studio.readSource()).toBe('second source');

    setActive(first.outer, true);
    setActive(second.outer, false);
    expect(window.glyphfield?.studio.readSource()).toBe('first source');
    await expect(window.glyphfield?.studio.invoke('custom')).resolves.toBe('first source');
    expect(firstAdapter.invoke).toHaveBeenCalledWith('custom', undefined);
  });

  it('does not let a retained hidden tool steal ownership when its source changes', () => {
    const project = workspace('first', true);
    const animation = document.createElement('div');
    animation.className = 'studio-workspace-layer';
    project.outer.append(animation);
    setActive(animation, true);
    setActive(project.inner, false);
    register(animation, 'animation source', 'animation');
    register(project.inner, 'background source update');
    expect(window.glyphfield?.studio.activeTool()).toBe('animation');
    expect(window.glyphfield?.studio.readSource()).toBe('animation source');

    setActive(animation, false);
    setActive(project.inner, true);
    expect(window.glyphfield?.studio.readSource()).toBe('background source update');
  });

  it('only lists and activates controls in interactive workspaces', () => {
    const first = workspace('first', false);
    const second = workspace('second', true);
    const hidden = document.createElement('button');
    const visible = document.createElement('button');
    hidden.textContent = visible.textContent = 'Add text';
    first.inner.append(hidden);
    second.inner.append(visible);
    const hiddenClick = vi.fn();
    const visibleClick = vi.fn();
    hidden.addEventListener('click', hiddenClick);
    visible.addEventListener('click', visibleClick);
    register(second.inner, 'second source');
    expect(window.glyphfield?.studio.controls().filter(({ label }) => label === 'Add text')).toHaveLength(1);
    window.glyphfield?.studio.activate('Add text');
    expect(visibleClick).toHaveBeenCalledOnce();
    expect(hiddenClick).not.toHaveBeenCalled();
  });

  it('never resurrects an already disposed adapter when a newer one unmounts', () => {
    const project = workspace('first', true);
    register(project.inner, 'header');
    register(project.inner, 'source');
    const first = disposers.shift()!;
    const second = disposers.shift()!;
    first();
    expect(window.glyphfield?.studio.readSource()).toBe('source');
    second();
    expect(window.glyphfield).toBeUndefined();
  });

  it('rejects stale captured handles instead of sending delayed writes to another project', async () => {
    const first = workspace('first', true);
    const second = workspace('second', false);
    register(first.inner, 'first source');
    register(second.inner, 'second source');
    const studio = window.glyphfield!.studio;
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    firstInput.setAttribute('aria-label', 'Text size');
    secondInput.setAttribute('aria-label', 'Text size');
    firstInput.value = secondInput.value = '1';
    first.inner.append(firstInput);
    second.inner.append(secondInput);

    setActive(first.outer, false);
    setActive(second.outer, true);
    expect(() => studio.readSource()).toThrow('no longer active');
    expect(() => studio.set('Text size', 0.8)).toThrow('no longer active');
    expect(() => studio.activate('Add text')).toThrow('no longer active');
    await expect(studio.applySource('delayed source')).rejects.toThrow('no longer active');
    await expect(studio.invoke('custom')).rejects.toThrow('no longer active');
    expect(secondInput.value).toBe('1');
    expect(window.glyphfield?.studio.readSource()).toBe('second source');
    window.glyphfield?.studio.set('Text size', 0.8);
    expect(secondInput.value).toBe('0.8');
    expect(firstInput.value).toBe('1');
  });

  it('keeps source drawer delegation bound to its own workspace without recursive routing', async () => {
    const first = workspace('first', false);
    const second = workspace('second', true);
    const firstAdapter = register(first.inner, 'first source');
    register(second.inner, 'second source');
    const drawer = document.createElement('textarea');
    first.inner.append(drawer);
    const underlying = studioAutomationForOwner(drawer)!;
    expect(underlying.activeTool()).toBe('material');
    disposers.push(registerStudioAutomation({
      toolId: underlying.activeTool(),
      getSource: () => 'drawer source',
      invoke: underlying.invoke,
    }, drawer));
    expect(window.glyphfield?.studio.readSource()).toBe('second source');

    setActive(first.outer, true);
    setActive(second.outer, false);
    expect(window.glyphfield?.studio.readSource()).toBe('drawer source');
    await expect(window.glyphfield?.studio.invoke('custom')).resolves.toBe('first source');
    expect(firstAdapter.invoke).toHaveBeenCalledOnce();
  });

  it('reports an inactive workspace instead of reading hidden or disconnected source', () => {
    const project = workspace('first', true);
    register(project.inner, 'first source');
    setActive(project.outer, false);
    expect(() => window.glyphfield?.studio.readSource()).toThrow('No active Studio workspace');
    setActive(project.outer, true);
    project.outer.remove();
    expect(() => window.glyphfield?.studio.readSource()).toThrow('No active Studio workspace');
  });
});
