import { expect, test, type Page } from '@playwright/test';

async function theme(page: Page, mode: 'light' | 'dark') {
  const toggle = page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${mode}\\b`));
}

async function contentColors(page: Page) {
  let serialized = '';
  await expect.poll(async () => {
    serialized = await page.evaluate(() => {
      try { return window.glyphfield!.studio.readSource(); }
      catch (error) {
        if (error instanceof Error && error.message === 'The portable animation source is still preparing.') return '';
        throw error;
      }
    });
    return Boolean(serialized);
  }).toBe(true);
  const source = JSON.parse(serialized);
  return Object.fromEntries(Object.entries(source.elements).map(([id, value]) => {
    const layer = value as { data: { color?: string; foreground?: string; outlineColor?: string } };
    return [id, { color: layer.data.color ?? layer.data.foreground, outline: layer.data.outlineColor }];
  })) as Record<string, { color?: string; outline?: string }>;
}

async function designInsertions(page: Page, color: string, outline: string) {
  const before = await contentColors(page);
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.getByRole('button', { name: 'Add brand mark', exact: true }).click();
  await page.getByRole('button', { name: 'Add sticker layer', exact: true }).click();
  await page.getByRole('button', { name: /^Create text sticker/ }).click();
  const after = await contentColors(page);
  const added = Object.entries(after).filter(([id]) => !(id in before));
  expect(added).toHaveLength(3);
  for (const [id, appearance] of added) {
    expect(appearance.color).toBe(color);
    if (id.startsWith('text-')) {
      expect(appearance.outline).toBe(outline);
      await expect(page.locator(`[data-canvas-layer-id="${id}"] [data-canvas-editable]`))
        .toHaveCSS('color', color === '#000000' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
    }
  }
  for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id]);
  return after;
}

test('Design Lab samples new text, sticker and mark colors without recoloring placed or restored layers', async ({ page }) => {
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-live-material-ready="true"]').first()).toBeAttached();
  await page.evaluate(() => window.glyphfield!.studio.invoke('design.frame.pause'));
  await theme(page, 'light');
  const light = await designInsertions(page, '#000000', '#FFFFFF');
  await theme(page, 'dark');
  expect(await contentColors(page)).toEqual(light);
  const combined = await designInsertions(page, '#FFFFFF', '#000000');
  await theme(page, 'light');
  expect(await contentColors(page)).toEqual(combined);
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    await studio.applySource(JSON.parse(studio.readSource()));
  });
  expect(await contentColors(page)).toEqual(combined);
  await expect(page.locator('[data-design-version-status]')).toHaveText('Autosaved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  expect(await contentColors(page)).toEqual(combined);
});

test('Animation stores per-frame insertion colors and preserves authored colors through theme changes', async ({ page }) => {
  await page.goto('/studio?tool=animation');
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const state = JSON.parse(studio.readSource()).metadata.animation;
    state.includeBrandLogo = false;
    state.mode = 'sequence';
    state.textFrames = 'Authored color';
    state.sequenceOrder = ['text-0'];
    state.frameSettings = {};
    state.settings.foreground = '#B46DDC';
    delete state.artboards;
    delete state.activeArtboardId;
    await studio.applySource(state);
  });
  const authored = await contentColors(page);
  expect(authored['text-0'].color).toBe('#B46DDC');
  await theme(page, 'light');
  const addText = page.getByRole('group', { name: 'Add animation layer', exact: true }).getByRole('button', { name: 'Text', exact: true });
  await addText.click();
  await expect.poll(async () => (await contentColors(page))['text-1']?.color).toBe('#000000');
  await theme(page, 'dark');
  await addText.click();
  await expect.poll(async () => (await contentColors(page))['text-2']?.color).toBe('#FFFFFF');
  const combined = await contentColors(page);
  expect(combined['text-0']).toEqual(authored['text-0']);
  expect(combined['text-1'].color).toBe('#000000');
  await theme(page, 'light');
  expect(await contentColors(page)).toEqual(combined);
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    await studio.applySource(JSON.parse(studio.readSource()));
  });
  expect(await contentColors(page)).toEqual(combined);
  await expect(page.locator('.animation-studio:visible [data-design-version-status]')).toHaveText('Autosaved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  expect(await contentColors(page)).toEqual(combined);
});
