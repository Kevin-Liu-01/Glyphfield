import { expect, test, type Locator, type Page } from '@playwright/test';
import type { CanvasElement } from '../src/lib/canvasDocument';

type FixtureText = CanvasElement & { content: string; data: { fontSize: number; transform: { scale: number } } };
type FixtureShader = CanvasElement & { data: { materialId: string; settings: { speed: number; strength: number } } };

test.beforeEach(async ({ browser }, testInfo) => {
  testInfo.annotations.push({ type: 'browser-version', description: browser.version() });
});

// Seed only through the product's public source API in a fresh browser context.
// Input tests use real pointer/keyboard events, never synthetic DOM input events.
async function prepareText(page: Page) {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const text = (Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'text') as FixtureText;
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 1600, height: 900, background: '#101010', elementIds: [text.id] });
    text.content = 'Select this text';
    text.name = 'Browser text';
    text.hidden = false;
    text.bounds = { ...text.bounds, x: 0, y: 0, width: 1, height: 1 };
    Object.assign(text.data, { name: 'Browser text', value: text.content, color: '#FFFFFF', align: 'center',
      fontSize: 153, fontStyle: 'normal', weight: 500, lineHeight: 1.2, tracking: 0, wrap: 'wrap', outlineEnabled: false, shadowEnabled: false,
      transform: { x: 0, y: 0, scale: 0.6, widthScale: 1, heightScale: 1 } });
    source.elements = { [text.id]: text };
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide',
      backgroundColor: '#101010', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [], logos: [],
      effectLayers: [], assets: [], groups: [], layerShaders: {}, timeline: design.timeline,
      shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
  });
  const text = page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]').first();
  await expect(text).toHaveText('Select this text');
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
  await text.click();
  await expect(page.getByRole('slider', { name: 'Text size', exact: true })).toBeVisible();
  return text;
}

async function textSource(page: Page) {
  return page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource() as string);
    const text = (Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'text') as FixtureText;
    return { text: text.content, fontSize: text.data.fontSize, scale: text.data.transform.scale, bounds: text.bounds,
      count: Object.keys(source.elements).length };
  });
}

async function dragRange(page: Page, range: Locator, fraction: number) {
  await range.scrollIntoViewIfNeeded();
  const rect = (await range.boundingBox())!;
  const current = await range.evaluate((input: HTMLInputElement) =>
    (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)));
  const start = rect.x + 7 + current * (rect.width - 14);
  const end = rect.x + 7 + fraction * (rect.width - 14);
  await page.mouse.move(start, rect.y + rect.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 16; step += 1) {
    await page.mouse.move(start + (end - start) * step / 16, rect.y + rect.height / 2);
    await page.waitForTimeout(16);
  }
  const value = Number(await range.inputValue());
  await page.mouse.up();
  return value;
}

async function dragTextSize(page: Page, pixels: number) {
  const range = page.getByRole('slider', { name: 'Text size', exact: true });
  const fraction = await range.evaluate((input: HTMLInputElement, value) =>
    (value - Number(input.min)) / (Number(input.max) - Number(input.min)), pixels);
  return dragRange(page, range, fraction);
}

test('native range drag changes text smoothly and commits the final visible size', async ({ page }) => {
  const text = await prepareText(page);
  const range = page.getByRole('slider', { name: 'Text size', exact: true });
  const initial = await text.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  const initialPixels = Number(await range.inputValue());
  const value = await dragTextSize(page, 160);
  expect(value).toBeGreaterThan(initialPixels);
  await expect.poll(async () => (await textSource(page)).fontSize).toBe(value);
  expect((await textSource(page)).scale).toBe(1);
  await expect(range).not.toHaveAttribute('data-canvas-preview-pending', 'true');
  const final = await text.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(final / initial).toBeCloseTo(value / initialPixels, 1);
  await range.focus();
  await range.press('ArrowLeft');
  await expect.poll(async () => (await textSource(page)).fontSize).toBe(value - 1);
});

test('text selection, spaces, deletion and native undo stay in the text editor', async ({ page }) => {
  const text = await prepareText(page);
  const before = await textSource(page);
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.dblclick();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? '')).not.toBe('');
  await text.press(modifier === 'Meta' ? 'Meta+ArrowRight' : 'Control+End');
  await text.press('Space');
  await page.keyboard.insertText('works');
  await expect(text).toContainText(' works');
  await text.press('Backspace');
  await expect(text).toContainText(' work');
  const afterDeletion = await text.innerText();
  await text.press(`${modifier}+z`);
  // WebKit groups typing/deletion differently from Chromium and Firefox. Test
  // real native undo/redo without prescribing the browser's undo-group boundary.
  await expect(text).not.toHaveText(afterDeletion);
  expect((await textSource(page)).count).toBe(before.count);
  await expect(text).toBeFocused();
  await text.press(`${modifier}+Shift+z`);
  await expect(text).toHaveText(afterDeletion);
  // The canvas must not start panning when a space is typed in plaintext-only.
  await expect(page.locator('.canvas-viewport-scroll')).not.toHaveAttribute('data-space-pressed', 'true');
  await text.press('Escape');
  await expect.poll(async () => (await textSource(page)).text).toBe(afterDeletion);
  expect((await textSource(page)).bounds).toEqual(before.bounds);
});

test('native text context menu is not replaced by the layer menu', async ({ page }) => {
  const text = await prepareText(page);
  await text.evaluate((element) => {
    element.addEventListener('contextmenu', (event) => {
      queueMicrotask(() => element.setAttribute('data-context-prevented', String(event.defaultPrevented)));
    }, { once: true });
  });
  await text.click({ button: 'right' });
  await expect(text).toHaveAttribute('data-context-prevented', 'false');
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('print rules hide Studio chrome without affecting the screen layout', async ({ page }) => {
  await prepareText(page);
  const header = page.locator('.studio-app-header');
  await expect(header).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(header).toBeHidden();
  await expect(page.locator('[data-testid="shader-lab-live-stage"]')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expect(header).toBeVisible();
});

test('Shift-click extends text selection without selecting or moving layers', async ({ page }) => {
  const text = await prepareText(page);
  const before = await textSource(page);
  const points = await text.evaluate((element) => {
    const node = element.firstChild!;
    return [1, 12].map((offset) => {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      const rect = range.getBoundingClientRect();
      return { x: rect.x + 1, y: rect.y + rect.height / 2 };
    });
  });
  await page.mouse.click(points[0].x, points[0].y);
  await page.keyboard.down('Shift');
  await page.mouse.click(points[1].x, points[1].y);
  await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBeGreaterThan(5);
  expect((await textSource(page)).bounds).toEqual(before.bounds);
  expect((await textSource(page)).count).toBe(before.count);
});

test('resized text exports as matching PNG and JPG pixels', async ({ page }, testInfo) => {
  const text = await prepareText(page);
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(`${modifier}+a`);
  await page.keyboard.insertText('testing');
  await text.press('Escape');
  await dragTextSize(page, 120);
  for (const format of ['png', 'jpg'] as const) {
    const result = await page.evaluate(async (format) => {
      const asset = await window.glyphfield!.studio.invoke('design.export', { format, download: false }) as { blob: Blob };
      if (!(asset.blob instanceof Blob) || !asset.blob.size) throw new Error('Missing export bytes');
      const bitmap = await createImageBitmap(asset.blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const inkBounds = () => {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            if (pixels[offset] < 128 || pixels[offset + 1] < 128 || pixels[offset + 2] < 128) continue;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
        return { width: maxX - minX + 1, height: maxY - minY + 1 };
      };
      const ink = inkBounds();
      const text = document.querySelector<HTMLElement>('[data-testid="shader-lab-live-stage"] [data-canvas-editable]')!;
      const style = getComputedStyle(text);
      const stage = getComputedStyle(text.closest<HTMLElement>('.shader-lab-v2-stage')!);
      const inset = stage.boxSizing === 'border-box'
        ? parseFloat(stage.borderLeftWidth) + parseFloat(stage.borderRightWidth)
          + parseFloat(stage.paddingLeft) + parseFloat(stage.paddingRight) : 0;
      const scale = canvas.width / (parseFloat(stage.width) - inset);
      ctx.font = `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
      ctx.fontKerning = style.fontKerning as CanvasFontKerning;
      const nativeLetterSpacing = typeof ctx.letterSpacing === 'string';
      if (nativeLetterSpacing) ctx.letterSpacing = `${(parseFloat(style.letterSpacing) || 0) * scale}px`;
      const vectorBounds = ctx.measureText(text.textContent!);
      // Compare raster ink to raster ink. TextMetrics includes subpixel outline
      // extents that need not survive the same antialiasing threshold as a PNG.
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text.textContent!, canvas.width / 4, canvas.height / 2);
      return { width: canvas.width, height: canvas.height, mime: asset.blob.type,
        ink, expected: inkBounds(), nativeLetterSpacing, referenceFont: ctx.font,
        vectorBounds: { width: vectorBounds.actualBoundingBoxLeft + vectorBounds.actualBoundingBoxRight,
          height: vectorBounds.actualBoundingBoxAscent + vectorBounds.actualBoundingBoxDescent } };
    }, format);
    await testInfo.attach(`${format}-text-pixels`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.mime).toBe(format === 'png' ? 'image/png' : 'image/jpeg');
    expect(result.width / result.height).toBeCloseTo(16 / 9, 2);
    expect(Math.abs(result.ink.width - result.expected.width)).toBeLessThanOrEqual(4);
    expect(Math.abs(result.ink.height - result.expected.height)).toBeLessThanOrEqual(4);
    await page.locator('header').getByRole('button', { name: 'Close export preview', exact: true }).click();
  }
});

test('canvas layer dragging, resizing, and action undo preserve geometry', async ({ page }) => {
  const text = await prepareText(page);
  const original = await textSource(page);
  const move = page.getByRole('button', { name: 'Move Browser text', exact: true });
  const rect = (await move.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 40, rect.y + rect.height / 2 + 20, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await textSource(page)).bounds.x).not.toBe(original.bounds.x);
  await page.getByRole('button', { name: 'Action history', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).bounds).toEqual(original.bounds);
  await page.getByRole('button', { name: 'Action history', exact: true }).click();
  await text.click();
  const resize = page.getByRole('button', { name: 'Resize Browser text from right', exact: true });
  const handle = (await resize.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 30, handle.y + handle.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await textSource(page)).bounds.width).not.toBe(original.bounds.width);
  const resized = (await textSource(page)).bounds;
  await page.getByRole('button', { name: 'Action history', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).bounds).toEqual(original.bounds);
  const viewport = page.locator('.canvas-viewport-scroll:visible');
  await viewport.focus();
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await viewport.press(`${modifier}+Shift+z`);
  await expect.poll(async () => (await textSource(page)).bounds).toEqual(resized);
  await viewport.press(`${modifier}+z`);
  await expect.poll(async () => (await textSource(page)).bounds).toEqual(original.bounds);
});

test('live shader controls retain the GPU canvas and report input cadence', async ({ page }, testInfo) => {
  await prepareText(page);
  await page.getByRole('button', { name: 'Add shader layer', exact: true }).click();
  await page.evaluate(async () => {
    const source = JSON.parse(window.glyphfield!.studio.readSource());
    const shader = (Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'shader') as FixtureShader;
    shader.data.materialId = 'paper-dithering';
    shader.data.settings.speed = 0.4;
    source.metadata.designLab.timeline.paused = false;
    const snapshot = source.metadata.designLab.workspace.artboards[0].snapshot;
    snapshot.shaderLayers = [shader.data];
    snapshot.timeline = source.metadata.designLab.timeline;
    await window.glyphfield!.studio.applySource(source);
  });
  const surface = page.locator('[data-testid="shader-lab-live-stage"] [data-live-material-surface="paper-dithering"]');
  await expect(surface.locator('canvas')).toBeVisible();
  await expect(surface.locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await surface.click({ position: { x: 25, y: 25 } });
  const canvas = await surface.locator('canvas').elementHandle();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await surface.evaluate((element) => {
    const intervals: number[] = [];
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      intervals.push(now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Owned instrumentation only; no product internals or persisted state writes.
    element.addEventListener('browser-test-finish', () => {
      cancelAnimationFrame(frame);
      element.setAttribute('data-test-cadence', JSON.stringify(intervals));
    }, { once: true });
  });
  const warp = page.getByRole('slider', { name: 'Warp', exact: true });
  const value = await dragRange(page, warp, 0.75);
  await expect.poll(() => page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource());
    return ((Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'shader') as FixtureShader).data.settings.strength;
  })).toBeCloseTo(value, 2);
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(surface.locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await surface.dispatchEvent('browser-test-finish');
  const cadence = JSON.parse((await surface.getAttribute('data-test-cadence'))!) as number[];
  const sorted = cadence.filter((interval) => interval > 0).sort((a, b) => a - b);
  const metrics = { frames: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)], maxMs: sorted.at(-1) };
  await testInfo.attach('interaction-cadence', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
  expect(sorted.length).toBeGreaterThan(5);
  // A broad regression guard, not a claim about GPU FPS on every Mac.
  expect(metrics.p95Ms).toBeLessThan(150);
});

test('editing after slider interaction selects the text again and persists across reload', async ({ page }) => {
  const text = await prepareText(page);
  await dragTextSize(page, 120);
  await text.click();
  await expect(text).toBeFocused();
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(`${modifier}+a`);
  await page.keyboard.insertText('Saved in this browser');
  await text.press('Escape');
  await expect.poll(async () => (await textSource(page)).text).toBe('Saved in this browser');
  await page.getByRole('button', { name: /^Autosaved draft/ }).waitFor();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]').first())
    .toHaveText('Saved in this browser');
});

test('the last typed character survives an immediate artboard switch', async ({ page }, testInfo) => {
  const text = await prepareText(page);
  const add = page.locator('button[title="Add blank artboard"]:visible');
  const originalId = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource())
    .metadata.designLab.workspace.activeArtboardId as string);
  const box = (await add.boundingBox())!;
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(modifier === 'Meta' ? 'Meta+ArrowRight' : 'Control+End');
  await text.evaluate((element) => element.addEventListener('input', () => {
    element.setAttribute('data-last-input-time', String(performance.now()));
  }, { once: true }));
  await add.evaluate((element) => element.addEventListener('click', () => {
    element.setAttribute('data-switch-click-time', String(performance.now()));
  }, { once: true }));
  await page.keyboard.insertText('!');
  const inputTime = await text.getAttribute('data-last-input-time');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource())
    .metadata.designLab.workspace.activeArtboardId as string)).not.toBe(originalId);
  const source = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()));
  const previous = source.metadata.designLab.workspace.artboards.find((board: { id: string }) => board.id === originalId);
  expect(previous.snapshot.textLayers[0].value).toBe('Select this text!');
  const inputToSwitchMs = Number(await add.getAttribute('data-switch-click-time')) - Number(inputTime);
  await testInfo.attach('input-to-artboard-switch', { body: JSON.stringify({ inputToSwitchMs }), contentType: 'application/json' });
});

test('project round trips preserve edits and target the visible canvas controls', async ({ page }) => {
  const text = await prepareText(page);
  const starterText = await text.elementHandle();
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(`${modifier}+a`);
  await page.keyboard.insertText('Starter keeps this edit');
  await page.getByRole('button', { name: 'Open General Translation project', exact: true }).click();
  await expect(page).toHaveURL(/project=gt/);
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  const active = page.locator('.studio-project-workspace-layer[data-active="true"] .studio-workspace-layer[data-active="true"]');
  const gtText = active.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]').first();
  await gtText.click();
  await gtText.press(`${modifier}+a`);
  await page.keyboard.insertText('GT stays separate');
  await gtText.press('Escape');
  await expect.poll(async () => (await textSource(page)).text).toBe('GT stays separate');

  await page.getByRole('button', { name: 'Open Starter project', exact: true }).click();
  await expect(page).toHaveURL(/project=starter/);
  await expect(active.locator('[data-canvas-editable]').first()).toHaveText('Starter keeps this edit');
  expect(await starterText!.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(async () => (await textSource(page)).text).toBe('Starter keeps this edit');
  await active.locator('[data-canvas-editable]').first().click();
  const size = page.getByRole('slider', { name: 'Text size', exact: true });
  const previousSize = Number(await size.inputValue());
  await size.focus();
  await size.press('ArrowRight');
  await expect.poll(async () => (await textSource(page)).fontSize).toBe(previousSize + 1);
  expect((await textSource(page)).scale).toBe(1);
  await page.evaluate(() => window.glyphfield!.studio.set('Text size', 120));
  await expect(size).toHaveValue('120');
  await expect.poll(async () => (await textSource(page)).fontSize).toBe(120);

  await page.getByRole('button', { name: 'Open General Translation project', exact: true }).click();
  await expect(active.locator('[data-canvas-editable]').first()).toHaveText('GT stays separate');
  await expect.poll(async () => (await textSource(page)).text).toBe('GT stays separate');
});

test('tool round trips restore the active editor and its last typed character', async ({ page }) => {
  const text = await prepareText(page);
  const original = await text.elementHandle();
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(modifier === 'Meta' ? 'Meta+ArrowRight' : 'Control+End');
  await page.keyboard.insertText('!');
  await page.getByRole('button', { name: 'Animation', exact: true }).click();
  await expect(page).toHaveURL(/tool=animation/);
  await expect.poll(() => page.evaluate(() => {
    try {
      return window.glyphfield?.studio.activeTool();
    } catch (error) {
      // The newly selected lazy editor has no adapter until it mounts.
      if (error instanceof Error && error.message === 'No active Studio workspace is ready for automation.') return null;
      throw error;
    }
  })).toBe('animation');
  await page.getByRole('button', { name: 'Brand identity', exact: true }).click();
  await expect(page).toHaveURL(/tool=identity/);
  await expect(page.locator('.studio-workspace-layer[data-active="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Design Lab', exact: true }).click();
  await expect(text).toBeVisible();
  await expect(text).toHaveText('Select this text!');
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(async () => (await textSource(page)).text).toBe('Select this text!');
  await text.click();
  await expect(text).toBeFocused();
  await text.press(modifier === 'Meta' ? 'Meta+ArrowRight' : 'Control+End');
  await page.keyboard.insertText('?');
  await text.press('Escape');
  await expect.poll(async () => (await textSource(page)).text).toBe('Select this text!?');
});
