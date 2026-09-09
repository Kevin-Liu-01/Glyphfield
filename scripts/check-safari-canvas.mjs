#!/usr/bin/env node
// Native Safari regression. Start /usr/bin/safaridriver -p 4445 first, with
// Safari's Allow Remote Automation enabled by the user. This script creates
// and deletes only its isolated WebDriver session; no user tabs or storage are
// accessed. Canvas fixtures use the public Studio API; all inputs are native.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSafariDisplayBaseline, checkSafariShader } from './lib/safari-shader-check.mjs';
import { checkSafariProjectRoundTrip, checkSafariTabChrome, checkSafariToolRoundTrip } from './lib/safari-tab-checks.mjs';
import { nativePointerClick } from './lib/safari-native-click.mjs';
import { checkSafariFrameExport } from './lib/safari-frame-export-check.mjs';

const baseUrl = process.env.GLYPHFIELD_SAFARI_BASE_URL ?? 'http://localhost:3014';
const driverUrl = process.env.SAFARI_WEBDRIVER_URL ?? 'http://localhost:4445';
const filter = process.env.GLYPHFIELD_SAFARI_ONLY;
const pointerClick = process.env.GLYPHFIELD_SAFARI_POINTER_CLICK !== '0';
const textSelector = '[data-testid="shader-lab-live-stage"] [data-canvas-editable]';
const sizeSelector = 'input[aria-label="Text size"]';
const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
const keys = { meta: '\uE03D', shift: '\uE008', right: '\uE014', backspace: '\uE003', escape: '\uE00C' };
const results = [];
let sessionId;
let interrupted = false;
let artifactDir;
let nativeUndoCapability;

async function request(method, path, body) {
  const response = await fetch(`${driverUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${result.value?.message ?? result.value?.error ?? response.statusText}`);
  }
  return result.value;
}

async function startSession() {
  let session;
  try {
    session = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', pageLoadStrategy: 'eager' } } });
  } catch (error) {
    throw new Error(`Native Safari session unavailable. Start /usr/bin/safaridriver -p 4445 and enable Safari > Developer > Allow Remote Automation yourself. ${error}`);
  }
  sessionId = session.sessionId;
  await command('POST', '/timeouts', { script: 30_000, pageLoad: 60_000, implicit: 0 });
  const handle = await command('GET', '/window');
  await command('POST', '/window', { handle });
  await command('POST', '/window/rect', { x: 0, y: 0, width: 1440, height: 1000 });
  // Opt-in foreground activation, only after this runner owns an automation
  // window. This never changes Safari settings or accesses another tab.
  if (process.env.GLYPHFIELD_SAFARI_ACTIVATE_APP === '1') execFileSync('/usr/bin/open', ['-a', 'Safari']);
  return session.capabilities;
}

const command = (method, path, body) => request(method, `/session/${sessionId}${path}`, body);
const evaluate = (fn, ...args) => command('POST', '/execute/sync', { script: `return (${fn})(...arguments);`, args });
async function evaluateAsync(fn, ...args) {
  const result = await command('POST', '/execute/async', {
    script: `const done = arguments[arguments.length - 1];
      Promise.resolve((${fn})(...Array.from(arguments).slice(0, -1)))
        .then(value => done({ ok: true, value }), error => done({ ok: false, error: String(error) }));`,
    args,
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

async function waitFor(fn, label, ...args) {
  const deadline = Date.now() + 25_000;
  let value;
  while (Date.now() < deadline) {
    value = await command('POST', '/execute/sync', {
      script: `try { return (${fn})(...arguments); } catch (error) {
        if (error instanceof Error && error.message === 'No active Studio workspace is ready for automation.') return false;
        throw error;
      }`, args,
    });
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Timed out waiting for ${label}; last result: ${JSON.stringify(value)}`);
}

async function click(selector) {
  await waitFor((selector) => Boolean(document.querySelector(selector)), selector, selector);
  if (process.env.GLYPHFIELD_SAFARI_ACTIVATE_APP === '1' && !await evaluate(() => document.hasFocus())) {
    const handle = await command('GET', '/window');
    await command('POST', '/window', { handle });
    execFileSync('/usr/bin/open', ['-a', 'Safari']);
    await waitFor(() => document.hasFocus(), 'foreground owned Safari automation window');
  }
  // Explicit pointer actions cover real user hit-testing. Safari Element Click
  // has intermittently returned without dispatching an input event at all.
  if (pointerClick) {
    const box = await rect(selector);
    await waitFor((selector, x, y) => {
      const target = document.querySelector(selector);
      return target?.contains(document.elementFromPoint(x, y));
    }, `unobscured click target ${selector}`, selector, box.x + box.width / 2, box.y + box.height / 2);
    await nativePointerClick({ evaluate, actions, mouse, pointerMove, pointerDown, pointerUp },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }, selector);
    return;
  }
  const element = await command('POST', '/element', { using: 'css selector', value: selector });
  await command('POST', `/element/${element[elementKey]}/click`, {});
}

function pointerMove(x, y, duration = 0) {
  return { type: 'pointerMove', origin: 'viewport', x: Math.round(x), y: Math.round(y), duration };
}

const pointerDown = { type: 'pointerDown', button: 0 };
const pointerUp = { type: 'pointerUp', button: 0 };
const mouse = (actions) => ({ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions });
const keyboard = (actions) => ({ type: 'key', id: 'keyboard', actions });
const actions = (...sources) => command('POST', '/actions', { actions: sources });

async function press(...values) {
  await actions(keyboard([
    ...values.map((value) => ({ type: 'keyDown', value })),
    ...values.toReversed().map((value) => ({ type: 'keyUp', value })),
  ]));
}

async function type(text) {
  await actions(keyboard([...text].flatMap((value) => [
    { type: 'keyDown', value }, { type: 'keyUp', value },
  ])));
}

async function rect(selector) {
  return evaluateAsync(async (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Scrolling and initial canvas fitting can change the target's position.
    // Give both layout/paint opportunities before native viewport-coordinate input.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }, selector);
}

async function readText() {
  return evaluate(() => {
    const source = JSON.parse(window.glyphfield.studio.readSource());
    const text = Object.values(source.elements).find((element) => element.kind === 'text');
    return { text: text?.content, scale: text?.data.transform.scale,
      bounds: text?.bounds, count: Object.keys(source.elements).length };
  });
}

async function prepareText() {
  await command('POST', '/url', { url: `${baseUrl}/studio?tool=material` });
  await waitFor(() => Boolean(window.glyphfield?.studio?.readSource), 'public Studio API');
  await click('button[aria-label="Add text layer"]');
  await waitFor(() => Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
    .some((element) => element.kind === 'text'), 'new text layer in public source');
  await evaluateAsync(async () => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const text = Object.values(source.elements).find((entry) => entry.kind === 'text');
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 1600, height: 900, background: '#101010', elementIds: [text.id] });
    text.name = 'Browser text';
    text.content = 'Select this text';
    text.hidden = false;
    text.bounds = { ...text.bounds, x: 0, y: 0, width: 1, height: 1 };
    Object.assign(text.data, { name: 'Browser text', value: text.content, color: '#FFFFFF', align: 'center',
      weight: 500, lineHeight: 1.2, tracking: 0, wrap: 'wrap', outlineEnabled: false, shadowEnabled: false,
      transform: { x: 0, y: 0, scale: 0.6, widthScale: 1, heightScale: 1 } });
    source.elements = { [text.id]: text };
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide',
      backgroundColor: '#101010', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [], logos: [],
      effectLayers: [], assets: [], groups: [], layerShaders: {}, timeline: design.timeline,
      shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
  });
  await waitFor((selector) => document.querySelector(selector)?.textContent === 'Select this text', 'text fixture', textSelector);
  await click('button[aria-label="Fit canvas"]');
  await evaluate((selector) => {
    const events = [];
    const text = document.querySelector(selector);
    document.documentElement.dataset.safariBeforeTextClick = JSON.stringify({
      alreadyFocused: document.activeElement === text,
      layerSelected: text?.closest('.editable-canvas-layer')?.getAttribute('aria-pressed'),
    });
    document.documentElement.dataset.safariClickTrace = '[]';
    for (const type of ['pointerdown', 'mousedown', 'focusin', 'click']) {
      document.addEventListener(type, (event) => {
        events.push({ type, trusted: event.isTrusted, target: event.target?.getAttribute?.('aria-label') ?? event.target?.tagName,
          active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName, x: event.clientX, y: event.clientY });
        document.documentElement.dataset.safariClickTrace = JSON.stringify(events);
      }, { capture: true, once: true });
    }
  }, textSelector);
  await click(textSelector);
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'Text size inspector', sizeSelector);
}

async function drag(selector, fraction) {
  const box = await rect(selector);
  const current = await evaluate((selector) => {
    const input = document.querySelector(selector);
    return (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
  }, selector);
  const start = box.x + 7 + current * (box.width - 14);
  const end = box.x + 7 + fraction * (box.width - 14);
  const y = box.y + box.height / 2;
  await actions(mouse([pointerMove(start, y), pointerDown,
    ...Array.from({ length: 16 }, (_, index) => pointerMove(start + (end - start) * (index + 1) / 16, y, 16)),
  ]));
  const during = await evaluate((selector) => Number(document.querySelector(selector).value), selector);
  await actions(mouse([pointerUp]));
  return during;
}

async function check(name, test, fixture = true) {
  if (interrupted || (filter && !name.includes(filter))) return;
  const start = performance.now();
  try {
    if (!sessionId) await startSession();
    if (fixture) await prepareText();
    const details = await test();
    results.push({ name, passed: true, elapsedMs: Math.round(performance.now() - start), ...details });
  } catch (error) {
    if (interrupted) return;
    const diagnostics = await evaluate((textSelector, sizeSelector) => {
      const text = document.querySelector(textSelector);
      const active = document.activeElement;
      const box = text?.getBoundingClientRect();
      const style = text ? getComputedStyle(text) : null;
      const topmost = box ? document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) : null;
      return { url: location.href, activeTool: window.glyphfield?.studio?.activeTool?.(),
        projectTabs: Array.from(document.querySelectorAll('.project-tab[data-project-id]'), (tab) => ({
          id: tab.dataset.projectId, selected: tab.dataset.selected, dragging: tab.dataset.dragging, shifting: tab.dataset.shifting })),
        text: text?.textContent, active: { tag: active?.tagName, label: active?.getAttribute('aria-label'), isEditor: active === text },
        sizeControl: Boolean(document.querySelector(sizeSelector)),
        isContentEditable: text?.isContentEditable, webkitUserSelect: style?.webkitUserSelect, userSelect: style?.userSelect,
        pointerEvents: style?.pointerEvents, clickTrace: document.documentElement.dataset.safariClickTrace,
        lastNativeClick: document.documentElement.dataset.safariLastClick,
        undoKeys: document.documentElement.dataset.safariUndoKeys,
        beforeClick: document.documentElement.dataset.safariBeforeTextClick,
        textRect: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
        topmost: topmost?.outerHTML?.slice(0, 350), initializing: Boolean(document.querySelector('[data-canvas-initializing="true"]')) };
    }, textSelector, sizeSelector).catch(() => null);
    let screenshot;
    try {
      artifactDir ??= await mkdtemp(join(tmpdir(), 'glyphfield-safari-canvas-'));
      screenshot = join(artifactDir, `${name.replace(/[^a-z0-9]+/gi, '-')}.png`);
      const png = await command('GET', '/screenshot');
      await writeFile(screenshot, Buffer.from(png, 'base64'));
    } catch { /* Keep the primary browser failure if diagnostic capture fails. */ }
    results.push({ name, passed: false, error: String(error), diagnostics, screenshot, elapsedMs: Math.round(performance.now() - start) });
    // Release only this session's held keys and pointer before the next case.
    await command('DELETE', '/actions').catch(() => {});
    process.exitCode = 1;
  } finally {
    // Safari's native input state and automation context are independent per case.
    await cleanup();
  }
  console.log(JSON.stringify(results.at(-1)));
}

async function cleanup() {
  const ownedSession = sessionId;
  sessionId = undefined;
  if (ownedSession) await request('DELETE', `/session/${ownedSession}`).catch((error) => console.error(`Safari session cleanup: ${error}`));
}

async function probeNativeUndo() {
  const controls = [];
  for (const kind of ['plaintext-only', 'textarea']) {
    await cleanup();
    await startSession();
    try {
      const markup = kind === 'textarea' ? '<textarea id="control"></textarea>'
        : '<div id="control" contenteditable="plaintext-only" tabindex="0" style="width:400px;min-height:100px;border:1px solid"></div>';
      await command('POST', '/url', { url: `data:text/html;charset=utf-8,${encodeURIComponent(markup)}` });
      const box = await rect('#control');
      await actions(mouse([pointerMove(box.x + box.width / 2, box.y + box.height / 2), pointerDown, pointerUp]));
      await type('works');
      await press(keys.backspace);
      const before = await evaluate(() => {
        const control = document.querySelector('#control');
        const trace = [];
        for (const type of ['keydown', 'keyup', 'beforeinput', 'input']) control.addEventListener(type, (event) => {
          queueMicrotask(() => {
            trace.push({ type, key: event.key, code: event.code, meta: event.metaKey, ctrl: event.ctrlKey,
              inputType: event.inputType, trusted: event.isTrusted, prevented: event.defaultPrevented });
            document.documentElement.dataset.safariUndoKeys = JSON.stringify(trace);
          });
        });
        return control.value ?? control.textContent;
      });
      assert.equal(before, 'work', `Standalone ${kind} did not receive native typing`);
      await press(keys.meta, 'z');
      const after = await evaluate(() => {
        const control = document.querySelector('#control');
        return { text: control.value ?? control.textContent, trace: JSON.parse(document.documentElement.dataset.safariUndoKeys ?? '[]') };
      });
      const shortcut = after.trace.find((event) => event.key === 'z');
      assert(shortcut?.trusted && shortcut.meta && !shortcut.prevented,
        `Standalone ${kind} did not receive the native undo shortcut: ${JSON.stringify(after)}`);
      controls.push({ kind, before, after: after.text, changed: after.text !== before, trace: after.trace });
    } finally {
      await cleanup();
    }
  }
  return { supported: controls.some((control) => control.changed), controls,
    note: controls.every((control) => !control.changed)
      ? 'This Safari WebDriver does not execute native undo even in bare controls. Only app shortcut delegation is verified.' : undefined };
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { interrupted = true; await cleanup(); process.exit(130); });
}

try {
  const capabilities = await startSession();
  console.log(JSON.stringify({ browser: capabilities.browserName, version: capabilities.browserVersion,
    platform: capabilities.platformName, baseUrl }));
  if (!filter || filter.includes('native selection')) {
    nativeUndoCapability = await probeNativeUndo();
    console.log(JSON.stringify({ nativeUndoCapability }));
  }

  await check('native range dragging and keyboard size', async () => {
    const before = await evaluate((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize), textSelector);
    const value = await drag(sizeSelector, 0.4);
    assert(value > 0.8, `Native thumb did not drag: ${value}`);
    await waitFor((expected) => {
      const source = JSON.parse(window.glyphfield.studio.readSource());
      return Math.abs(Object.values(source.elements).find((element) => element.kind === 'text').data.transform.scale - expected) < 0.001;
    }, 'committed range value', value);
    const after = await evaluate((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize), textSelector);
    assert(Math.abs(after / before - value / 0.6) < 0.06, `Font size did not follow thumb: ${before} → ${after}, scale ${value}`);
    // Exercise keyboard input separately from Safari's non-focusing mouse clicks.
    await evaluate((selector) => document.querySelector(selector).focus(), sizeSelector);
    await press('\uE012');
    const keyboardValue = await readText();
    assert(Math.abs(keyboardValue.scale - value + 0.05) < 0.001, 'Arrow key size failed to commit');
    return { beforeFontPx: before, afterFontPx: after, scale: value, keyboardScale: keyboardValue.scale };
  });

  await check('native selection, editing and undo delegation', async () => {
    const before = await readText();
    const points = await evaluate((selector) => {
      const node = document.querySelector(selector).firstChild;
      return [1, 12].map((offset) => {
        const range = document.createRange();
        range.setStart(node, offset); range.setEnd(node, offset + 1);
        const box = range.getBoundingClientRect();
        return { x: box.x + 1, y: box.y + box.height / 2 };
      });
    }, textSelector);
    await actions(mouse([pointerMove(points[0].x, points[0].y), pointerDown, pointerUp]));
    await actions(keyboard([{ type: 'keyDown', value: keys.shift }]));
    await actions(mouse([pointerMove(points[1].x, points[1].y), pointerDown, pointerUp]));
    await actions(keyboard([{ type: 'keyUp', value: keys.shift }]));
    const selected = await evaluate(() => window.getSelection()?.toString() ?? '');
    assert(selected.length > 5, `Shift-click did not extend the selection: ${JSON.stringify(selected)}`);
    await press(keys.meta, keys.right);
    await type(' works');
    await press(keys.backspace);
    await waitFor((selector) => document.querySelector(selector)?.textContent.includes(' work'), 'typed text', textSelector);
    const beforeUndo = await evaluate((selector) => document.querySelector(selector).textContent, textSelector);
    await evaluate((selector) => {
      const text = document.querySelector(selector);
      const trace = [];
      text.addEventListener('keydown', (event) => {
        queueMicrotask(() => {
          trace.push({ key: event.key, code: event.code, meta: event.metaKey, ctrl: event.ctrlKey, trusted: event.isTrusted,
            prevented: event.defaultPrevented });
          document.documentElement.dataset.safariUndoKeys = JSON.stringify(trace);
        });
      });
    }, textSelector);
    await press(keys.meta, 'z');
    assert(nativeUndoCapability, 'Native undo must be checked against bare controls before interpreting its result');
    if (nativeUndoCapability.supported) {
      // Browsers group typing and deletion differently. Verify an actual undo
      // followed by exact redo, not a particular browser's transaction boundary.
      await waitFor((selector, before) => document.querySelector(selector)?.textContent !== before, 'native text undo', textSelector, beforeUndo);
      await press(keys.meta, keys.shift, 'z');
      await waitFor((selector, before) => document.querySelector(selector)?.textContent === before, 'native text redo', textSelector, beforeUndo);
    } else {
      const trace = await evaluate(() => JSON.parse(document.documentElement.dataset.safariUndoKeys ?? '[]'));
      const shortcut = trace.find((event) => event.key === 'z');
      assert(shortcut?.trusted && shortcut.meta && !shortcut.prevented, 'Glyphfield blocked the native undo shortcut');
    }
    await press(keys.escape);
    await waitFor((expected) => Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
      .some((element) => element.kind === 'text' && element.content === expected), 'persisted text edit', beforeUndo);
    const after = await readText();
    assert.equal(after.count, before.count);
    assert.deepEqual(after.bounds, before.bounds);
    return { selected, finalText: after.text, nativeUndoVerified: nativeUndoCapability.supported,
      ...(!nativeUndoCapability.supported ? { unsupportedAssertion: nativeUndoCapability.note } : {}) };
  });

  await check('last keystroke survives immediate artboard switch', async () => {
    const originalId = await evaluate(() => JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace.activeArtboardId);
    const addSelector = 'button[title="Add blank artboard"]';
    const button = await rect(addSelector);
    await click(textSelector);
    await press(keys.meta, keys.right);
    await evaluate((textSelector, addSelector) => {
      const text = document.querySelector(textSelector);
      const button = document.querySelector(addSelector);
      text.addEventListener('input', () => { document.documentElement.dataset.safariLastInput = String(performance.now()); }, { once: true });
      button.addEventListener('click', () => { document.documentElement.dataset.safariSwitchClick = String(performance.now()); }, { once: true });
    }, textSelector, addSelector);
    await actions(
      keyboard([{ type: 'keyDown', value: '!' }, { type: 'keyUp', value: '!' }, { type: 'pause', duration: 0 }, { type: 'pause', duration: 0 }]),
      mouse([{ type: 'pause', duration: 0 }, pointerMove(button.x + button.width / 2, button.y + button.height / 2), pointerDown, pointerUp])
    );
    await waitFor((originalId) => JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace.activeArtboardId !== originalId,
      'new active artboard', originalId);
    const result = await evaluate((originalId) => {
      const board = JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace.artboards.find((entry) => entry.id === originalId);
      return { value: board.snapshot.textLayers.find((layer) => layer.name === 'Browser text').value,
        inputToSwitchMs: Number(document.documentElement.dataset.safariSwitchClick) - Number(document.documentElement.dataset.safariLastInput) };
    }, originalId);
    assert.equal(result.value, 'Select this text!', `Final edit lost after ${result.inputToSwitchMs} ms switch`);
    assert(result.inputToSwitchMs < 140, `Switch took ${result.inputToSwitchMs} ms; did not exercise pending edit`);
    return result;
  });

  await check('native layer move, resize and action undo', async () => {
    const before = await readText();
    for (const [selector, dx, dy, field] of [
      ['button[aria-label="Move Browser text"]', 40, 20, 'x'],
      ['button[aria-label="Resize Browser text from right"]', -30, 0, 'width'],
    ]) {
      const box = await rect(selector);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await actions(mouse([pointerMove(x, y), pointerDown, pointerMove(x + dx, y + dy, 250), pointerUp]));
      const changed = await readText();
      assert.notEqual(changed.bounds[field], before.bounds[field], `${field} did not change`);
      await click('button[aria-label="Action history"]');
      await click('button[aria-label="Undo"]');
      assert.deepEqual((await readText()).bounds, before.bounds);
      await click('button[aria-label="Action history"]');
      await click(textSelector);
    }
    return { bounds: before.bounds };
  });

  await check('native live shader foreground baseline', () => checkSafariDisplayBaseline({
    command, evaluateAsync, rect, actions, mouse, pointerMove, pointerDown, pointerUp,
  }), false);

  await check('native live shader drag and foreground cadence', () => checkSafariShader({
    evaluate, evaluateAsync, click, waitFor, drag, rect, actions, mouse, pointerMove, pointerDown, pointerUp,
  }));

  const tabHarness = { baseUrl, command, evaluate, evaluateAsync, waitFor, click, rect, actions, mouse, pointerMove,
    pointerDown, pointerUp, keyboard, keys, press, type, drag };
  for (const mode of ['pause-resume', 'capture', 'live-export', 'frozen-export', 'grain-export', 'motion-export']) {
    await check(`native shader frame ${mode}`, () => checkSafariFrameExport(tabHarness, mode), false);
  }
  await check('native tabs chrome and released pointer cleanup', () => checkSafariTabChrome(tabHarness), false);
  await check('native tabs project round trip and visible controls', () => checkSafariProjectRoundTrip(tabHarness));
  await check('native tabs tool round trip and active source', () => checkSafariToolRoundTrip(tabHarness));

  if (filter?.includes('standalone')) await check('standalone native undo controls', async () => ({ nativeUndoCapability: await probeNativeUndo() }), false);

  if (!interrupted) assert(results.length > 0, `No native Safari checks matched ${JSON.stringify(filter)}`);
  const summary = { passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length,
    unsupportedAssertions: results.filter((result) => result.unsupportedAssertion).length, nativeUndoCapability, results };
  artifactDir ??= await mkdtemp(join(tmpdir(), 'glyphfield-safari-canvas-'));
  const reportPath = join(artifactDir, 'results.json');
  await writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ reportPath, ...summary }, null, 2));
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await cleanup();
}
