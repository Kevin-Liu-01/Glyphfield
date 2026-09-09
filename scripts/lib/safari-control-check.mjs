import assert from 'node:assert/strict';
import { nativePointerClick } from './safari-native-click.mjs';

// The runner prepares an isolated text-only Design Lab through its public source
// API. Every interaction below uses trusted native pointer/keyboard input.
export async function checkSafariControls(harness) {
  const { evaluate, waitFor, click, rect, press, type, keys, drag } = harness;
  const source = () => evaluate(() => {
    const document = JSON.parse(window.glyphfield.studio.readSource());
    const text = Object.values(document.elements).find((entry) => entry.kind === 'text');
    return { color: text.data.color, font: text.data.fontRole, scale: text.data.transform.scale,
      width: document.pages[document.pageIds[0]].width };
  });
  const hex = 'input[aria-label="Text color HEX"]';
  await click(hex);
  await press(keys.meta, 'a');
  await type('#FFFFFF');
  await click('button[aria-label="Text color"]');
  await waitFor(() => Boolean(document.querySelector('.color-picker-popover:popover-open')), 'first-click color picker');
  const hueSelector = 'input[aria-label="Text color hue"]';
  const hue = await rect(hueSelector);
  await nativePointerClick(harness, { x: hue.x + hue.width * 2 / 3, y: hue.y + hue.height / 2 }, hueSelector);
  const selectedHue = await waitFor((selector) => {
    const value = Number(document.querySelector(selector).value);
    return value > 220 && value < 260 ? value : false;
  }, 'hue retained on white', hueSelector);
  const squareSelector = '[aria-label="Text color saturation and brightness"]';
  const square = await rect(squareSelector);
  await nativePointerClick(harness, { x: square.x + square.width * 0.8, y: square.y + square.height * 0.25 }, squareSelector);
  await waitFor(() => {
    const text = Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements).find((entry) => entry.kind === 'text');
    return Number.parseInt(text.data.color.slice(5, 7), 16) - Number.parseInt(text.data.color.slice(1, 3), 16) > 90;
  }, 'first color gesture committed to the canvas');
  const color = (await source()).color;
  await press(keys.escape);
  await waitFor(() => !document.querySelector('.color-picker-popover:popover-open'), 'color picker Escape dismissal');

  await click('[role="combobox"][aria-label="Text font role"]');
  await waitFor(() => Boolean(document.querySelector('[role="listbox"]')), 'first-click font dropdown');
  await press('\uE010'); // End: last enabled font role (Code).
  await press('\uE007'); // Enter.
  await waitFor(() => Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
    .some((entry) => entry.kind === 'text' && entry.data.fontRole === 'Code'), 'font choice committed');

  const size = 'input[aria-label="Text size"]';
  await evaluate(() => {
    const trace = [];
    const record = (event) => {
      trace.push({ type: event.type, target: event.target.getAttribute?.('aria-label') ?? event.target.tagName,
        active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName });
      document.documentElement.dataset.safariRangeFocus = JSON.stringify(trace);
    };
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'focusin', 'focusout'].forEach((type) => document.addEventListener(type, record));
  });
  const draggedSize = await drag(size, 0.45);
  await waitFor((expected) => Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
    .some((entry) => entry.kind === 'text' && Math.abs(entry.data.transform.scale - expected) < 0.001),
  'native slider release committed', draggedSize);
  assert.equal(await evaluate((selector) => document.activeElement === document.querySelector(selector), size), true,
    `Completing a drag must retain keyboard focus: ${await evaluate(() => document.documentElement.dataset.safariRangeFocus)}`);
  await click(size);
  assert.equal(await evaluate((selector) => document.activeElement === document.querySelector(selector), size), true,
    `Clicking a range must focus it for the next keyboard action: ${await evaluate(() => document.documentElement.dataset.safariRangeFocus)}`);
  const beforeArrow = await evaluate((selector) => Number(document.querySelector(selector).value), size);
  await press(keys.right);
  await waitFor((selector, previous) => {
    const value = Number(document.querySelector(selector).value);
    const text = Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements).find((entry) => entry.kind === 'text');
    return value > previous && Math.abs(text.data.transform.scale - value) < 0.001;
  }, 'keyboard slider committed without blur', size, beforeArrow);
  assert.equal(await evaluate((selector) => document.activeElement === document.querySelector(selector), size), true);

  await click('button[aria-label^="Set artboard size."]');
  const width = '.artboard-size-popover input[type="number"]';
  await click(width);
  await press(keys.meta, 'a');
  await type('1440');
  await click('button[aria-label="Add text layer"]');
  await waitFor(() => {
    const source = JSON.parse(window.glyphfield.studio.readSource());
    return !document.querySelector('.artboard-size-popover')
      && source.pages[source.pageIds[0]].width === 1440
      && Object.values(source.elements).filter((entry) => entry.kind === 'text').length === 2;
  }, 'size committed before next first-click action');
  return { selectedHue, color, draggedSize, final: await source() };
}
