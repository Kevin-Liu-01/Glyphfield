import assert from 'node:assert/strict';
import { nativePointerClick } from './safari-native-click.mjs';

const activeWorkspace = '.studio-project-workspace-layer[data-active="true"] .studio-workspace-layer[data-active="true"]';
const textSelector = `${activeWorkspace} [data-testid="shader-lab-live-stage"] [data-canvas-editable]`;
const sizeSelector = `${activeWorkspace} input[aria-label="Text size"]`;
const retainedKey = 'glyphfield-safari-owned-retained-text';

async function tabPoint(harness, id, region = 'padding') {
  const selector = `.project-tab[data-project-id="${id}"]`;
  const box = await harness.rect(selector);
  const point = region === 'bottom' ? { x: box.x + box.width / 2, y: box.y + box.height - 2 }
    : { x: box.x + 4, y: box.y + box.height / 2 };
  const hit = await harness.evaluate((selector, point) => {
    const target = document.elementFromPoint(point.x, point.y);
    return { belongs: Boolean(target?.closest(selector)), interactive: Boolean(target?.closest('button, input')) };
  }, selector, point);
  assert(hit.belongs, `Expected ${region} tab chrome to belong to ${id}: ${JSON.stringify(hit)}`);
  return point;
}

async function clickPoint(harness, point) {
  await nativePointerClick(harness, point);
}

async function expectProject(harness, id) {
  await harness.waitFor((id) => new URL(location.href).searchParams.get('project') === id
    && document.querySelector(`.project-tab[data-project-id="${id}"]`)?.dataset.selected === 'true', `selected ${id} project`, id);
}

async function sourceText(harness) {
  return harness.evaluate(() => {
    const source = JSON.parse(window.glyphfield.studio.readSource());
    const text = Object.values(source.elements ?? {}).find((element) => element.kind === 'text');
    return { text: text?.content, scale: text?.data.transform.scale };
  });
}

async function expectText(harness, expected) {
  await harness.waitFor((selector, expected) => document.querySelector(selector)?.textContent === expected
    && Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements ?? {})
      .some((element) => element.kind === 'text' && element.content === expected), 'visible text and matching public source', textSelector, expected);
}

async function toolPoint(harness, name) {
  return harness.evaluateAsync(async (name) => {
    const button = Array.from(document.querySelectorAll('aside button')).find((element) => element.textContent.trim() === name);
    if (!button) throw new Error(`Missing tool navigation button ${name}`);
    button.scrollIntoView({ block: 'nearest' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const box = button.getBoundingClientRect();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (!button.contains(document.elementFromPoint(point.x, point.y))) throw new Error(`Tool button ${name} is obscured`);
    return point;
  }, name);
}

async function expectTool(harness, toolId) {
  await harness.waitFor((id) => new URL(location.href).searchParams.get('tool') === id
    && window.glyphfield.studio.activeTool() === id && window.glyphfield.studio.describe().toolId === id,
  `visible ${toolId} tool and matching public adapter`, toolId);
  const canRead = await harness.evaluate(() => window.glyphfield.studio.describe().source.read);
  let openedDrawer = false;
  if (!canRead) {
    assert.notEqual(toolId, 'material', 'Visible Design Lab lost its public source adapter');
    // Animation and identity advertise source only while their actual drawer is
    // open. Exercise that UI and ownership instead of assuming the capability.
    const codeButton = `${activeWorkspace} button[aria-label="Edit source code"]:not([disabled])`;
    await harness.waitFor((selector) => Boolean(document.querySelector(selector)), `${toolId} source ready`, codeButton);
    await harness.click(codeButton);
    openedDrawer = true;
    await harness.waitFor(() => window.glyphfield.studio.describe().source.read, `${toolId} source drawer adapter`);
  }
  try {
    const result = await harness.evaluate((selector, id) => {
      const source = window.glyphfield.studio.readSource();
      if (typeof source !== 'string' || !source.length) throw new Error(`${id} source unavailable`);
      const parsed = JSON.parse(source);
      if (id !== 'material' && parsed.metadata?.designLab) throw new Error(`${id} returned the retained Design Lab source`);
      return { toolId: window.glyphfield.studio.activeTool(), visibleEditors: document.querySelectorAll(selector).length };
    }, activeWorkspace, toolId);
    assert.equal(result.toolId, toolId, 'Opening the source drawer changed its tool owner');
    return { ...result, sourceViaDrawer: openedDrawer };
  } finally {
    if (openedDrawer) {
      await harness.click(`${activeWorkspace} button[aria-label="Close source editor"]`);
      await harness.waitFor((id) => window.glyphfield.studio.activeTool() === id, `${toolId} adapter after closing source`, toolId);
    }
  }
}

async function typeThenSwitch(harness, point, selector) {
  await harness.click(textSelector);
  await harness.press(harness.keys.meta, harness.keys.right);
  await harness.evaluate((textSelector, selector) => {
    document.querySelector(textSelector).addEventListener('input', () => {
      document.documentElement.dataset.safariTabLastInput = String(performance.now());
    }, { once: true });
    document.querySelector(selector).addEventListener('click', () => {
      document.documentElement.dataset.safariTabSwitchClick = String(performance.now());
    }, { once: true });
  }, textSelector, selector);
  await harness.actions(
    harness.keyboard([{ type: 'keyDown', value: '!' }, { type: 'keyUp', value: '!' }, { type: 'pause', duration: 0 }, { type: 'pause', duration: 0 }]),
    harness.mouse([{ type: 'pause', duration: 0 }, harness.pointerMove(point.x, point.y), harness.pointerDown, harness.pointerUp])
  );
  const delay = await harness.evaluate(() => Number(document.documentElement.dataset.safariTabSwitchClick)
    - Number(document.documentElement.dataset.safariTabLastInput));
  assert(Number.isFinite(delay) && delay >= 0, `Native input or switch click was not delivered: ${delay}ms`);
  return { inputToSwitchMs: delay, pendingWindowExercised: delay < 140 };
}

export async function checkSafariTabChrome(harness) {
  await harness.command('POST', '/url', { url: `${harness.baseUrl}/studio?tool=material&project=starter` });
  await harness.waitFor(() => document.querySelector('.project-tab[data-project-id="starter"]')?.dataset.selected === 'true'
    && Boolean(document.querySelector('.project-tab[data-project-id="gt"]')), 'initial project tabs');
  const order = () => harness.evaluate(() => Array.from(document.querySelectorAll('.project-tab[data-project-id]'), (tab) => tab.dataset.projectId));
  const originalOrder = await order();
  for (const [id, region] of [['gt', 'padding'], ['starter', 'bottom'], ['gt', 'bottom'], ['starter', 'padding']]) {
    await clickPoint(harness, await tabPoint(harness, id, region));
    await expectProject(harness, id);
  }
  const starter = await tabPoint(harness, 'starter');
  const target = await tabPoint(harness, 'gt');
  // Jump outside before a tab-local move/up listener can see the end, then
  // re-enter with no button down. Hover must never resume a stale tab drag.
  await harness.actions(harness.mouse([
    harness.pointerMove(starter.x, starter.y), harness.pointerDown,
    harness.pointerMove(starter.x, starter.y + 130), harness.pointerUp,
    harness.pointerMove(target.x, target.y), { type: 'pause', duration: 120 },
    harness.pointerMove(target.x + 25, target.y),
  ]));
  const dragMarkers = await harness.evaluate(() => document.querySelectorAll('.project-tab[data-dragging], .project-tab[data-shifting]').length);
  assert.equal(dragMarkers, 0, 'Hover resumed a tab drag after release outside');
  assert.deepEqual(await order(), originalOrder, 'Release outside plus hover reordered project tabs');
  await expectProject(harness, 'starter');
  await clickPoint(harness, await tabPoint(harness, 'gt'));
  await expectProject(harness, 'gt');
  return { tabOrder: originalOrder, chromeRegions: ['padding', 'bottom'], staleDragMarkers: dragMarkers };
}

export async function checkSafariProjectRoundTrip(harness) {
  const timing = await typeThenSwitch(harness, await tabPoint(harness, 'gt'), '.project-tab[data-project-id="gt"]');
  await expectProject(harness, 'gt');
  await harness.click(`${activeWorkspace} button[aria-label="Add text layer"]`);
  await harness.waitFor((selector) => Boolean(document.querySelector(selector)), 'General Translation text editor', textSelector);
  await harness.click(textSelector);
  await harness.press(harness.keys.meta, 'a');
  await harness.type('GT stays separate');
  await harness.press(harness.keys.escape);
  await expectText(harness, 'GT stays separate');
  const gtBefore = await sourceText(harness);
  await clickPoint(harness, await tabPoint(harness, 'starter'));
  await expectProject(harness, 'starter');
  await expectText(harness, 'Select this text!');
  await harness.click(textSelector);
  const value = await harness.drag(sizeSelector, 0.4);
  await harness.waitFor((expected) => {
    const studio = window.glyphfield.studio;
    const text = Object.values(JSON.parse(studio.readSource()).elements).find((element) => element.kind === 'text');
    const controls = studio.controls().filter((control) => control.label === 'Text size');
    return Math.abs(text.data.transform.scale - expected) < 0.001 && controls.length === 1
      && Math.abs(Number(controls[0].value) - expected) < 0.001;
  }, 'visible Starter text size and public controls agree', value);
  await clickPoint(harness, await tabPoint(harness, 'gt'));
  await expectProject(harness, 'gt');
  await expectText(harness, 'GT stays separate');
  assert.deepEqual(await sourceText(harness), gtBefore, 'Starter control edited the retained GT document');
  return { ...timing, starterScale: value, gt: gtBefore };
}

export async function checkSafariToolRoundTrip(harness) {
  await harness.evaluate((selector, key) => { document[Symbol.for(key)] = document.querySelector(selector); }, textSelector, retainedKey);
  try {
    const animationPoint = await toolPoint(harness, 'Animation');
    // Own a diagnostic selector on the visible navigation button, not app state.
    await harness.evaluate(() => {
      Array.from(document.querySelectorAll('aside button')).find((button) => button.textContent.trim() === 'Animation')
        .setAttribute('data-safari-tool-switch', 'animation');
    });
    const timing = await typeThenSwitch(harness, animationPoint, '[data-safari-tool-switch="animation"]');
    const tools = [await expectTool(harness, 'animation')];
    await clickPoint(harness, await toolPoint(harness, 'Brand identity'));
    tools.push(await expectTool(harness, 'identity'));
    await clickPoint(harness, await toolPoint(harness, 'Design Lab'));
    tools.push(await expectTool(harness, 'material'));
    assert(tools.every((tool) => tool.visibleEditors === 1), `Multiple active editors: ${JSON.stringify(tools)}`);
    await expectText(harness, 'Select this text!');
    const retained = await harness.evaluate((selector, key) => document[Symbol.for(key)]?.isConnected
      && document[Symbol.for(key)] === document.querySelector(selector), textSelector, retainedKey);
    assert(retained, 'Design Lab text editor remounted across a tool round trip');
    await harness.click(textSelector);
    await harness.press(harness.keys.meta, harness.keys.right);
    await harness.type('?');
    await harness.press(harness.keys.escape);
    await expectText(harness, 'Select this text!?');
    return { ...timing, tools, retainedEditor: retained, finalText: (await sourceText(harness)).text };
  } finally {
    await harness.evaluate((key) => {
      delete document[Symbol.for(key)];
      document.querySelector('[data-safari-tool-switch]')?.removeAttribute('data-safari-tool-switch');
    }, retainedKey);
  }
}
