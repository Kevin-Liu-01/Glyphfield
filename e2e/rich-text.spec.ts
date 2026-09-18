import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForStudioSource } from './studio-ui-helpers';
import { readFile } from 'node:fs/promises';

const sample = 'First line\nSecond line\nThird line';
const editableSelector = '[data-testid="shader-lab-live-stage"] [data-canvas-editable]';

async function textSource(page: Page) {
  return page.evaluate(() => (Object.values(JSON.parse(window.glyphfield!.studio.readSource()).elements) as Array<{
    kind: string; data: { id: string; value: string; weight: number; fontSize: number; fontStyle?: string; runs?: Array<{ start: number; end: number; style: Record<string, unknown> }> };
  }>).find(({ kind }) => kind === 'text')!.data);
}

async function prepareText(page: Page) {
  const font = `data:font/ttf;base64,${(await readFile('public/fonts/inter-variable.ttf')).toString('base64')}`;
  await page.goto('/studio?tool=material&project=starter');
  await waitForStudioSource(page);
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await expect(page.locator(editableSelector)).toBeVisible();
  await page.evaluate(async ({ value, font }) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const text = (Object.values(source.elements) as Array<{
      id: string; kind: string; content: string; name: string; data: Record<string, unknown>; bounds: Record<string, number>;
    }>).find(({ kind }) => kind === 'text')!;
    Object.assign(text, { content: value, name: 'Rich text' });
    const transform = { x: 0, y: 0, scale: 1, widthScale: 1.1, heightScale: 1.5 };
    Object.assign(text.bounds, { x: 0, y: 0, width: 1.1, height: 1.5 });
    Object.assign(text.data, { value, name: 'Rich text', fontSize: 64, fontRole: 'Body', color: '#111111',
      fontStyle: 'normal', weight: 400, tracking: 0, lineHeight: 1.4, align: 'left', wrap: 'wrap',
      underline: false, strikethrough: false, shadowEnabled: false, outlineEnabled: false,
      textEffect: { kind: 'solid' }, transform, runs: [] });
    source.elements = { [text.id]: text };
    source.assets = {};
    Object.assign(source.pages[source.pageIds[0]], { elementIds: [text.id], background: '#FFFFFF' });
    const design = source.metadata.designLab;
    design.identity = { ...design.identity, id: source.brandId, name: 'Rich text regression',
      fonts: [{ id: 'rich-inter', family: 'Rich Inter', label: 'Rich Inter', fileName: 'Inter.ttf',
        path: font, format: 'truetype', style: 'normal', weight: 400, weightMin: 100, weightMax: 900 }],
      typography: [{ role: 'Body', family: 'Rich Inter', fontId: 'rich-inter', weight: 400, lineHeight: 1.4, letterSpacing: 0, usage: 'Inline text regression' }],
    };
    design.timeline.paused = true;
    design.layerShaders = {};
    design.exportSettings.width = 1600;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board.snapshot, { backgroundColor: '#FFFFFF', layerOrder: [text.id], textLayers: [text.data],
      shaderLayers: [], logos: [], assets: [], effectLayers: [], groups: [], layerShaders: {},
      timeline: design.timeline, shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
    await document.fonts.ready;
  }, { value: sample, font });
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
  await page.locator('button[title="Select Rich text"]:visible').click();
  await expect(page.getByRole('textbox', { name: 'Rich text content', exact: true })).toHaveValue(sample);
}

async function selectRange(locator: Locator, start: number, end: number) {
  await locator.focus();
  await locator.press('ControlOrMeta+a');
  await locator.press('ArrowLeft');
  for (let index = 0; index < start; index++) await locator.press('ArrowRight');
  for (let index = start; index < end; index++) await locator.press('Shift+ArrowRight');
}

test('selected words and lines use existing typography controls without changing the rest of the box', async ({ page }) => {
  await prepareText(page);
  const editor = page.locator(editableSelector);
  await selectRange(editor, 0, 5);
  await expect(page.getByRole('status').filter({ hasText: 'Selected text' })).toContainText('5 characters');
  await page.getByRole('button', { name: 'Bold text', exact: true }).click();
  await page.getByRole('button', { name: 'Italic text', exact: true }).click();
  await page.getByRole('button', { name: 'Underline text', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Text size in pixels', exact: true }).fill('80');
  await page.getByRole('button', { name: 'Strikethrough text', exact: true }).click();
  await page.getByRole('button', { name: 'Text color', exact: true }).click();
  const hex = page.getByRole('textbox', { name: 'Text color HEX', exact: true });
  await hex.fill('#DD2211');
  await hex.press('Enter');
  await hex.press('Escape');
  await expect.poll(async () => (await textSource(page)).runs).toEqual([
    { start: 0, end: 5, style: { weight: 700, fontStyle: 'italic', underline: true, fontSize: 80, strikethrough: true, color: '#DD2211' } },
  ]);
  expect(await textSource(page)).toMatchObject({ value: sample, weight: 400, fontSize: 64, fontStyle: 'normal' });
  await expect(editor.locator('[data-text-run="0"]')).toHaveCSS('font-weight', '700');
  await expect(editor.locator('[data-text-run="5"]')).toHaveCSS('font-weight', '400');
  await selectRange(page.getByRole('textbox', { name: 'Rich text content', exact: true }), 11, 17);
  await page.getByRole('button', { name: 'Bold text', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).runs?.at(-1)).toEqual({ start: 11, end: 17, style: { weight: 700 } });
  // Formatting shortcuts operate on a native on-canvas selection too.
  await selectRange(editor, 22, 27);
  await editor.press('ControlOrMeta+i');
  await expect.poll(async () => (await textSource(page)).runs?.at(-1)).toEqual({ start: 22, end: 27, style: { fontStyle: 'italic' } });
  await page.getByRole('button', { name: 'Whole text box', exact: true }).click();
  await page.getByRole('button', { name: 'Italic text', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).fontStyle).toBe('italic');
  expect((await textSource(page)).runs?.every(({ style }) => !('fontStyle' in style))).toBe(true);
});

test('rich formatting survives editing, undo, duplication, source reapply, and saved reload', async ({ page }) => {
  await prepareText(page);
  const editor = page.locator(editableSelector);
  // Native plain text has BR nodes; rich text below has newline text nodes.
  // Both must restore the caret to the same character after a debounced commit.
  await selectRange(editor, 13, 13);
  await page.keyboard.insertText('X');
  await expect.poll(async () => (await textSource(page)).value.includes('X')).toBe(true);
  const firstEdit = (await textSource(page)).value;
  // Firefox has an additional native caret stop at BR boundaries. Assert the
  // actual second-line insertion point, then require it to survive the commit.
  expect(firstEdit.replace('X', '')).toBe(sample);
  expect(firstEdit.indexOf('X')).toBeGreaterThan(firstEdit.indexOf('\n'));
  expect(firstEdit.indexOf('X')).toBeLessThan(firstEdit.lastIndexOf('\n'));
  await page.keyboard.insertText('Y');
  await expect.poll(async () => (await textSource(page)).value).toBe(firstEdit.replace('X', 'XY'));
  await editor.press('Backspace');
  await editor.press('Backspace');
  await expect.poll(async () => (await textSource(page)).value).toBe(sample);
  await selectRange(editor, 0, 5);
  await editor.press('ControlOrMeta+b');
  await expect.poll(async () => (await textSource(page)).runs?.[0]?.style.weight).toBe(700);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).runs ?? []).toEqual([]);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await textSource(page)).runs?.[0]?.style.weight).toBe(700);
  await selectRange(editor, 2, 2);
  await page.keyboard.insertText('😀');
  await expect.poll(async () => (await textSource(page)).value).toBe('Fi😀rst line\nSecond line\nThird line');
  await expect.poll(async () => (await textSource(page)).runs?.[0]).toEqual({ start: 0, end: 7, style: { weight: 700 } });
  await selectRange(editor, 2, 3); // ArrowRight advances over the whole emoji.
  await editor.press('Backspace');
  await expect.poll(async () => (await textSource(page)).value).toBe(sample);
  await expect.poll(async () => (await textSource(page)).runs?.[0]?.end).toBe(5);
  await selectRange(editor, 13, 13);
  await page.keyboard.insertText('X');
  await expect.poll(async () => (await textSource(page)).value).toBe(sample.replace('Second', 'SeXcond'));
  await page.keyboard.insertText('Y');
  await expect.poll(async () => (await textSource(page)).value).toBe(sample.replace('Second', 'SeXYcond'));
  await editor.press('Escape');
  const before = await textSource(page);
  await page.evaluate(async () => { const studio = window.glyphfield!.studio; await studio.applySource(studio.readSource()); });
  await expect.poll(() => textSource(page)).toEqual(before);
  const saving = page.getByRole('group', { name: 'Design saving and versions', exact: true });
  await saving.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(saving.getByRole('button', { name: 'Design saved', exact: true })).toBeDisabled();
  await page.reload();
  await waitForStudioSource(page);
  await expect.poll(() => textSource(page)).toEqual(before);
  await page.getByRole('button', { name: 'Duplicate Rich text', exact: true }).click();
  const runs = await page.evaluate(() => (Object.values(JSON.parse(window.glyphfield!.studio.readSource()).elements) as Array<{ kind: string; data: { runs: unknown } }>).filter(({ kind }) => kind === 'text').map(({ data }) => data.runs));
  expect(runs).toEqual([before.runs, before.runs]);
});

test('mixed text export paints the same colors, sizes, weights, and placement as the native canvas', async ({ page }) => {
  test.setTimeout(120_000);
  await prepareText(page);
  const layer = await textSource(page);
  await page.evaluate(async (layerId) => {
    const studio = window.glyphfield!.studio;
    await studio.invoke('design.text.format', { layerId, start: 0, end: 5, style: { color: '#DD2211', fontSize: 90, weight: 700 } });
    await studio.invoke('design.text.format', { layerId, start: 11, end: 22, style: { color: '#2244DD', fontStyle: 'italic', fontRole: 'Code' } });
    await document.fonts.ready;
  }, layer.id);
  const stage = page.locator('[data-testid="shader-lab-live-stage"]');
  const screenshot = await stage.screenshot({ scale: 'css' });
  const result = await page.evaluate(async (screenshotUrl) => {
    const calls: Array<{ text: string; color: string; font: string }> = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      calls.push({ text, color: String(this.fillStyle), font: this.font });
      return fillText.call(this, text, x, y, maxWidth!);
    };
    let artifact: { blob: Blob };
    try { artifact = await window.glyphfield!.studio.invoke('design.export', { format: 'png' }) as typeof artifact; }
    finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
    const screenshot = new Image(); screenshot.src = screenshotUrl; await screenshot.decode();
    const url = URL.createObjectURL(artifact.blob);
    try {
      const output = new Image(); output.src = url; await output.decode();
      const ink = (image: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = screenshot.naturalWidth; canvas.height = screenshot.naturalHeight;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const boxes = { red: [canvas.width, canvas.height, -1, -1], blue: [canvas.width, canvas.height, -1, -1] };
        for (let y = 6; y < canvas.height - 6; y++) for (let x = 6; x < canvas.width - 6; x++) {
          const i = (y * canvas.width + x) * 4;
          const color = Math.abs(pixels[i] - 221) < 30 && Math.abs(pixels[i + 1] - 34) < 30 && Math.abs(pixels[i + 2] - 17) < 30 ? 'red'
            : Math.abs(pixels[i] - 34) < 30 && Math.abs(pixels[i + 1] - 68) < 30 && Math.abs(pixels[i + 2] - 221) < 30 ? 'blue' : null;
          if (!color) continue;
          const box = boxes[color]; box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
        }
        return boxes;
      };
      return { calls, canvas: ink(screenshot), output: ink(output), bytes: artifact.blob.size, type: artifact.blob.type, width: output.naturalWidth };
    } finally { URL.revokeObjectURL(url); }
  }, `data:image/png;base64,${screenshot.toString('base64')}`);
  await test.info().attach('rich-text-export-comparison', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(result.type).toBe('image/png');
  expect(result.width).toBe(1600);
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.calls.some(({ text, color, font }) => text === 'First' && color === '#dd2211' && /700|bold/.test(font) && font.includes('90px'))).toBe(true);
  expect(result.calls.some(({ color, font }) => color === '#2244dd' && font.includes('italic'))).toBe(true);
  for (const color of ['red', 'blue'] as const) {
    expect(result.canvas[color][2]).toBeGreaterThan(result.canvas[color][0]);
    for (let edge = 0; edge < 4; edge++) expect(Math.abs(result.canvas[color][edge] - result.output[color][edge]), `${color} edge ${edge}`).toBeLessThanOrEqual(2);
  }
});
