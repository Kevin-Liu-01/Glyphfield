import { expect, test, type Page } from '@playwright/test';

type TextLayer = {
  id: string;
  name: string;
  value: string;
  fontSize?: number;
  fontStyle?: 'normal' | 'italic';
  transform: { x: number; y: number; scale: number; widthScale: number; heightScale: number };
};

async function typographySource(page: Page) {
  return page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource() as string);
    const text = (Object.values(source.elements) as Array<{ kind: string; data: TextLayer }>)
      .filter((element) => element.kind === 'text').map((element) => element.data);
    return { text, page: source.pages[source.pageIds[0]] as { width: number; height: number },
      workspace: source.metadata.designLab.workspace as {
        activeArtboardId: string;
        artboards: Array<{ id: string; name: string; snapshot: { textLayers: TextLayer[] } }>;
      } };
  });
}

// Start from the app's real document and apply the fixture through its validator.
// No storage or internal React state is seeded by these tests.
async function prepareTypography(page: Page, legacy = false) {
  await page.goto('/studio?tool=material&project=starter');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await expect.poll(async () => (await typographySource(page)).text.at(-1)?.fontSize).toBe(48);
  await page.evaluate(async (legacy) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const text = (Object.values(source.elements) as Array<{
      id: string; kind: string; name: string; content: string; hidden: boolean;
      data: Record<string, unknown>; bounds: Record<string, number>;
    }>).find((element) => element.kind === 'text')!;
    const transform = { x: 72, y: -36, scale: 0.6, widthScale: 0.61, heightScale: 0.43 };
    Object.assign(text, { content: 'Pixel typography', name: 'Typography sample', hidden: false,
      bounds: { ...text.bounds, x: transform.x, y: transform.y, width: transform.widthScale, height: transform.heightScale } });
    Object.assign(text.data, { name: text.name, value: text.content, color: '#FFFFFF', fontRole: 'Body',
      fontSize: 48, fontStyle: 'normal', weight: 500, lineHeight: 1.2, tracking: 0,
      align: 'left', wrap: 'nowrap', outlineEnabled: false, shadowEnabled: false,
      textEffect: { kind: 'solid' }, transform, visible: true });
    if (legacy) {
      delete text.data.fontSize;
      delete text.data.fontStyle;
    }
    Object.assign(source.pages[source.pageIds[0]], {
      width: 1600, height: 900, background: '#101010', elementIds: [text.id],
    });
    source.elements = { [text.id]: text };
    source.assets = {};
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    board.name = 'Typography board';
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide',
      backgroundColor: '#101010', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [],
      logos: [], assets: [], effectLayers: [], groups: [], layerShaders: {},
      timeline: design.timeline, shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
    await document.fonts.ready;
  }, legacy);
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]'))
    .toHaveText('Pixel typography');
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
  await page.locator('button[title="Select Typography sample"]:visible').click();
  await expect(page.getByRole('spinbutton', { name: 'Text size in pixels', exact: true })).toBeVisible();
}

async function previewTypography(page: Page) {
  return page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource() as string);
    const stage = document.querySelector<HTMLElement>('[data-testid="shader-lab-live-stage"]')!;
    const text = stage.querySelector<HTMLElement>('[data-canvas-editable]')!;
    const style = getComputedStyle(text);
    const stageStyle = getComputedStyle(stage);
    const inset = stageStyle.boxSizing === 'border-box'
      ? parseFloat(stageStyle.borderLeftWidth) + parseFloat(stageStyle.borderRightWidth)
        + parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight) : 0;
    const contentWidth = parseFloat(stageStyle.width) - inset;
    return { pixels: parseFloat(style.fontSize) * source.pages[source.pageIds[0]].width / contentWidth,
      style: style.fontStyle };
  });
}

async function setTwelvePixelItalic(page: Page) {
  const input = page.getByRole('spinbutton', { name: 'Text size in pixels', exact: true });
  const italic = page.getByRole('button', { name: 'Italic text', exact: true });
  await expect(input).toHaveAttribute('min', '1');
  await expect(input).toHaveAttribute('max', '2048');
  await expect(italic).toHaveAttribute('aria-pressed', 'false');
  await input.fill('12');
  // The first italic click must also commit the preceding numeric edit on blur.
  await italic.click();
  await expect(italic).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await typographySource(page)).text[0]).toMatchObject({ fontSize: 12, fontStyle: 'italic' });
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(12, 2);
  expect((await previewTypography(page)).style).toBe('italic');
}

test('pixel size and italic commit on the first click without moving or resizing the text box', async ({ page }) => {
  await prepareTypography(page);
  const before = (await typographySource(page)).text[0]!;
  await setTwelvePixelItalic(page);
  expect((await typographySource(page)).text[0]!.transform).toEqual({ ...before.transform, scale: 1 });
  const slider = page.getByRole('slider', { name: 'Text size', exact: true });
  await expect(slider).toHaveValue('12');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect.poll(async () => (await typographySource(page)).text[0]!.fontSize).toBe(13);
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(13, 2);
  await slider.press('ArrowLeft');
  await expect.poll(async () => (await typographySource(page)).text[0]!.fontSize).toBe(12);
  for (const pixels of [96, 12]) {
    await page.evaluate((value) => window.glyphfield!.studio.set('Text size in pixels', value), pixels);
    await expect.poll(async () => (await typographySource(page)).text[0]!.fontSize).toBe(pixels);
    await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(pixels, 2);
  }
  await page.getByRole('button', { name: 'Duplicate Typography sample', exact: true }).click();
  await expect.poll(async () => (await typographySource(page)).text.length).toBe(2);
  for (const layer of (await typographySource(page)).text) {
    expect(layer).toMatchObject({ fontSize: 12, fontStyle: 'italic', transform: { scale: 1,
      widthScale: before.transform.widthScale, heightScale: before.transform.heightScale } });
  }
});

test('saved pixel typography survives reload, artboard duplication, ratio changes, and switching back', async ({ page }) => {
  await prepareTypography(page);
  await setTwelvePixelItalic(page);
  const before = (await typographySource(page)).text[0]!;
  const bar = page.getByRole('region', { name: 'Artboard workspace controls', exact: true });
  await bar.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Design saved', exact: true })).toBeDisabled();
  await expect(bar.locator('[aria-live="polite"]')).toContainText('autosaved');
  await page.reload();
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]'))
    .toHaveText('Pixel typography');
  // Restored text paints before portable asset/source preparation finishes in
  // WebKit. Wait for that documented readiness state, not an arbitrary delay.
  await page.waitForFunction(() => {
    try { return Boolean(window.glyphfield!.studio.readSource()); }
    catch (error) {
      if (error instanceof Error && error.message === 'Portable composition code is still being prepared.') return false;
      throw error;
    }
  });
  await expect.poll(async () => (await typographySource(page)).text[0]).toEqual(before);
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(12, 2);
  expect((await previewTypography(page)).style).toBe('italic');
  await bar.getByRole('button', { name: 'Duplicate active artboard', exact: true }).click();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(2);
  await expect.poll(async () => (await typographySource(page)).text[0]).toMatchObject({
    fontSize: 12, fontStyle: 'italic', transform: before.transform,
  });
  await bar.getByRole('button', { name: /^Set artboard size\./ }).click();
  await page.getByRole('dialog', { name: 'Artboard setup', exact: true })
    .getByRole('button', { name: /^3:4/ }).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await typographySource(page)).page).toMatchObject({ width: 1080, height: 1440 });
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(12, 2);
  expect((await previewTypography(page)).style).toBe('italic');
  const copied = await typographySource(page);
  for (const board of copied.workspace.artboards) {
    expect(board.snapshot.textLayers[0]).toMatchObject({ fontSize: 12, fontStyle: 'italic' });
  }
  await bar.getByRole('combobox', { name: 'Active design artboard', exact: true }).click();
  await page.getByRole('option', { name: 'Typography board', exact: true }).click();
  await expect.poll(async () => (await typographySource(page)).page).toMatchObject({ width: 1600, height: 900 });
  await expect.poll(async () => (await typographySource(page)).text[0]).toEqual(before);
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(12, 2);
  expect((await previewTypography(page)).style).toBe('italic');
});

test('legacy text without explicit typography retains its height-relative look through source reapply', async ({ page }) => {
  await prepareTypography(page, true);
  const expectedPixels = 900 * 0.17 * 0.6;
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(expectedPixels, 2);
  expect((await previewTypography(page)).style).toBe('normal');
  expect((await typographySource(page)).text[0]).not.toHaveProperty('fontSize');
  expect((await typographySource(page)).text[0]).not.toHaveProperty('fontStyle');
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    await studio.applySource(studio.readSource());
  });
  await expect.poll(async () => (await previewTypography(page)).pixels).toBeCloseTo(expectedPixels, 2);
  expect((await typographySource(page)).text[0]).not.toHaveProperty('fontSize');
  expect((await typographySource(page)).text[0]!.transform.scale).toBe(0.6);
});
