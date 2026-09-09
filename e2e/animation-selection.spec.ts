import { expect, test, type Page } from '@playwright/test';

test('landing Animation autoplay does not retain the initial scene selection box', async ({ page }) => {
  await page.goto('/');
  const studio = page.locator('.animation-studio').first();
  await expect(studio.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Number(await studio.getByRole('slider', { name: 'Timeline playhead', exact: true }).inputValue())).toBeGreaterThan(1600);
  await expect(studio.locator('.editable-canvas-layer-selection')).toHaveCount(0);
});

async function prepareSelection(page: Page) {
  await page.goto('/studio?tool=animation&project=starter');
  const studio = page.locator('.animation-studio:visible');
  const sourceButton = studio.getByRole('button', { name: 'Edit source code', exact: true });
  await expect(sourceButton).toBeEnabled();
  await sourceButton.click();
  await page.getByRole('button', { name: 'Close source editor', exact: true }).waitFor();
  await page.evaluate(async () => {
    const api = window.glyphfield!.studio;
    const state = JSON.parse(api.readSource()).metadata.animation;
    state.includeBrandLogo = false;
    state.mode = 'text';
    state.textFrames = 'ALPHA\nBETA';
    state.sequenceOrder = ['text-0', 'text-1'];
    state.frameSettings = {};
    state.backgroundOverrides = {};
    state.settings = { ...state.settings, width: 320, height: 180, holdMs: 1000, transitionMs: 500, fps: 10 };
    state.sequenceBackground = { ...state.sequenceBackground, style: 'solid', colorA: '#111111' };
    delete state.artboards;
    delete state.activeArtboardId;
    await api.applySource(state);
  });
  await page.getByRole('button', { name: 'Close source editor', exact: true }).click();
  await studio.getByRole('button', { name: 'Edit frame 1: ALPHA', exact: true }).click();
  const selection = studio.locator('.editable-canvas-layer-selection');
  await expect(selection).toContainText('ALPHA');
  return { selection, studio };
}

test('paused Animation selection follows its displayed hold and stays out of transitions and other scenes', async ({ page }) => {
  const { selection, studio } = await prepareSelection(page);
  const playhead = studio.getByRole('slider', { name: 'Storyboard playhead', exact: true });
  await playhead.press('Home');
  await playhead.press('Shift+ArrowRight');
  await expect(selection).toHaveCount(0);
  for (let index = 0; index < 5; index += 1) await playhead.press('ArrowRight');
  await expect(studio.getByRole('slider', { name: 'Timeline playhead', exact: true })).toHaveValue('1500');
  await expect(selection).toHaveCount(0);
  await playhead.press('Home');
  await expect(selection).toContainText('ALPHA');
  await studio.getByRole('button', { name: 'Edit frame 2: BETA', exact: true }).click();
  await expect(selection).toContainText('BETA');
  await studio.getByRole('button', { name: 'Play preview', exact: true }).click();
  await expect(selection).toHaveCount(0);
});

test('Animation selection controls leave retained workspaces during keyboard tool and project navigation', async ({ page }) => {
  const { studio } = await prepareSelection(page);
  const retained = (await studio.elementHandle())!;
  const selectionCount = () => retained.evaluate((element) => element.querySelectorAll('.editable-canvas-layer-selection').length);
  // Keyboard navigation bypasses outside-pointer dismissal: visibility must
  // follow the workspace, without relying on the click path to clear selection.
  await page.locator('.studio-nav').getByRole('button', { name: 'Brand identity', exact: true }).press('Enter');
  await expect(page).toHaveURL(/tool=identity/);
  await expect.poll(selectionCount).toBe(0);
  expect(await retained.evaluate((element) => element.isConnected)).toBe(true);
  await page.locator('.studio-nav').getByRole('button', { name: 'Animation', exact: true }).press('Enter');
  await expect.poll(selectionCount).toBe(1);
  await page.getByRole('button', { name: 'Open General Translation project', exact: true }).press('Enter');
  await expect(page).toHaveURL(/project=gt/);
  await expect.poll(selectionCount).toBe(0);
  expect(await retained.evaluate((element) => element.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Open Starter project', exact: true }).press('Enter');
  await expect(page).toHaveURL(/project=starter/);
  await expect.poll(selectionCount).toBe(1);
});
