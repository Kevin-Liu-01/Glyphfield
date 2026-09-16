import assert from 'node:assert/strict';
import { selectSafariStudioTool } from './safari-tab-checks.mjs';

export async function checkSafariProjectCopy(harness) {
  const { baseUrl, command, click, waitFor, evaluate, evaluateAsync, press, keys, captureScreenshot } = harness;
  const activeWorkspace = '.studio-project-workspace-layer[data-active="true"] .studio-workspace-layer[data-active="true"]';
  async function readyTool(toolId) {
    await waitFor((toolId) => {
      try {
        const api = window.glyphfield?.studio;
        return api?.activeTool() === toolId && Boolean(api.readSource());
      } catch (error) {
        if (/still prepar|still being prepared|No active Studio workspace/.test(error.message)) return false;
        throw error;
      }
    }, `${toolId} ready`, toolId);
  }
  await command('POST', '/url', { url: `${baseUrl}/studio?tool=identity&project=starter` });
  await click('button[aria-label="Add brand project"]');
  await click('[role="menu"][aria-label="New project"] [role="menuitem"]'); // First item: empty Design Lab project.
  await waitFor(() => Boolean(document.querySelector('[aria-label="Edit source code"]:not(:disabled)')), 'new Design Lab ready');
  await waitFor(() => [...document.querySelectorAll('[data-design-version-status]')].some((element) => element.checkVisibility() && element.textContent === 'Autosaved'), 'empty project hydrated');
  await evaluateAsync(async () => { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await click(`${activeWorkspace} button[aria-label="Add text layer"]`);
  const original = await evaluateAsync(async () => {
    const api = window.glyphfield.studio;
    const source = JSON.parse(api.readSource());
    const layer = Object.values(source.elements).find((element) => element.kind === 'text');
    layer.content = 'Native Safari project copy';
    layer.data.value = layer.content;
    await api.applySource(source);
    return { brandId: source.brandId, textId: layer.id };
  });
  console.log(JSON.stringify({ check: 'project copy', phase: 'Design Lab edited' }));
  await selectSafariStudioTool(harness, 'Animation');
  await readyTool('animation');
  await evaluateAsync(async () => {
    const api = window.glyphfield.studio;
    const state = JSON.parse(api.readSource()).metadata.animation;
    state.includeBrandLogo = false;
    state.mode = 'sequence';
    state.textFrames = 'Native motion copy';
    state.sequenceOrder = ['text-0'];
    state.sequenceBackground = { ...state.sequenceBackground, style: 'solid', colorA: '#112233' };
    delete state.artboards;
    delete state.activeArtboardId;
    await api.applySource(state);
  });
  console.log(JSON.stringify({ check: 'project copy', phase: 'Animation edited' }));
  await click('button[aria-label="Duplicate active project"]');
  await waitFor((id) => document.querySelector('.project-tab[data-selected="true"]')?.dataset.projectId !== id, 'copied project selected', original.brandId);
  await readyTool('animation');
  const animation = await evaluate(() => JSON.parse(window.glyphfield.studio.readSource()).metadata.animation);
  assert.equal(animation.textFrames, 'Native motion copy');
  console.log(JSON.stringify({ check: 'project copy', phase: 'Animation copied' }));
  await waitFor(() => [...document.querySelectorAll('[data-design-version-status]')].some((element) => element.checkVisibility() && element.textContent === 'Autosaved'), 'copied animation hydrated');
  await selectSafariStudioTool(harness, 'Design Lab');
  await readyTool('material');
  console.log(JSON.stringify({ check: 'project copy', phase: 'Copied Design Lab opened' }));
  const copied = await waitFor((originalId, textId) => {
    if (!document.querySelector('[aria-label="Edit source code"]:not(:disabled)')) return null;
    const source = JSON.parse(window.glyphfield.studio.readSource());
    return source.brandId !== originalId && source.elements[textId]?.content === 'Native Safari project copy' ? source : null;
  }, 'copied canvas content', original.brandId, original.textId);
  await waitFor(() => [...document.querySelectorAll('[data-design-version-status]')].some((element) => element.checkVisibility() && element.textContent === 'Autosaved'), 'copied canvas persisted');
  await command('POST', '/refresh', {});
  await waitFor((id, textId) => {
    if (!document.querySelector('[aria-label="Edit source code"]:not(:disabled)')) return false;
    const source = JSON.parse(window.glyphfield.studio.readSource());
    return source.brandId === id && source.elements[textId]?.content === 'Native Safari project copy';
  }, 'reloaded copied project', copied.brandId, original.textId);
  await evaluateAsync(async () => window.glyphfield.studio.invoke('design.workspace.activate', { target: 'canvas' }));
  await click(`${activeWorkspace} button[aria-label="Open export settings"]`);
  const errorSelector = `${activeWorkspace} button[aria-label="Design action failed: show details"]`;
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'compact export error', errorSelector);
  await click(errorSelector);
  await waitFor(() => Boolean(document.querySelector('[role="menu"][aria-label="Design action failed"]')), 'complete error details');
  const message = await evaluate(() => document.querySelector('[role="menu"][aria-label="Design action failed"]').textContent);
  assert.match(message, /artboard/i);
  await captureScreenshot('project-copy-error-details');
  await press(keys.escape);
  await waitFor((selector) => document.activeElement === document.querySelector(selector), 'Escape restores error trigger focus', errorSelector);
  return { originalProject: original.brandId, copiedProject: copied.brandId, textId: original.textId, reloaded: true, errorDetails: message };
}
