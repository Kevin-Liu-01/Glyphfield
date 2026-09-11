// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerStudioAutomation } from '../studioAutomation';

describe('Studio browser automation workspace scope', () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete window.glyphfield;
    vi.restoreAllMocks();
  });

  it('lists and activates controls only inside the adapter workspace', () => {
    const first = document.createElement('section');
    first.className = 'tool-shell';
    const firstButton = document.createElement('button');
    firstButton.textContent = 'Export';
    first.append(firstButton);

    const second = document.createElement('section');
    second.className = 'tool-shell';
    const secondButton = document.createElement('button');
    secondButton.textContent = 'Export';
    const secondInput = document.createElement('input');
    secondInput.setAttribute('aria-label', 'Title');
    secondInput.value = 'Second workspace';
    second.append(secondButton, secondInput);
    document.body.append(first, second);

    const firstClick = vi.spyOn(firstButton, 'click');
    const secondClick = vi.spyOn(secondButton, 'click');
    const unregisterFirst = registerStudioAutomation({ toolId: 'colors' }, first);
    const unregisterSecond = registerStudioAutomation({ toolId: 'terminal' }, second);

    expect(window.glyphfield!.studio.controls()).toEqual([
      { kind: 'button', label: 'Export' },
      { kind: 'input', label: 'Title', value: 'Second workspace' },
    ]);
    window.glyphfield!.studio.activate('Export');
    expect(secondClick).toHaveBeenCalledOnce();
    expect(firstClick).not.toHaveBeenCalled();

    unregisterSecond();
    expect(window.glyphfield!.studio.activeTool()).toBe('colors');
    unregisterFirst();
  });

  it('derives standard actions and publishes exact contracts from adapter support', () => {
    const owner = document.createElement('section');
    owner.className = 'tool-shell';
    document.body.append(owner);
    const unregister = registerStudioAutomation({
      actions: ['identity.export.json'],
      applySource: () => undefined,
      getSource: () => '{"id":"gt"}',
      invoke: () => null,
      toolId: 'identity',
    }, owner);

    const description = window.glyphfield!.studio.describe();
    expect(description.actions).toEqual([
      'controls.list',
      'control.activate',
      'control.set',
      'artifact.download',
      'source.read',
      'source.apply',
      'identity.export.json',
    ]);
    expect(description.actionContracts['identity.export.json']).toMatchObject({
      input: 'No input',
      output: expect.stringContaining('Blob'),
    });
    expect(description.capabilities?.source).toMatchObject({
      apply: true,
      boundary: 'Complete BrandIdentity',
      read: true,
    });

    unregister();
  });
});
