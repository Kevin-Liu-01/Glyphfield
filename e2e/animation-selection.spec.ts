import { expect, test, type Page } from '@playwright/test';

test('landing Animation autoplay keeps the inspector and scene highlights on the displayed scene without a selection box', async ({ page }) => {
  await page.goto('/');
  const studio = page.locator('.animation-studio').first();
  await expect(studio.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Number(await studio.getByRole('slider', { name: 'Timeline playhead', exact: true }).inputValue())).toBeGreaterThan(1600);
  await expect(studio.locator('.editable-canvas-layer-selection')).toHaveCount(0);
  await expect.poll(() => studio.evaluate((element) => {
    const playhead = element.querySelector<HTMLInputElement>('input[aria-label="Timeline playhead"]');
    const frames = [...element.querySelectorAll<HTMLButtonElement>('.animation-storyboard-frame')];
    if (!playhead || frames.length < 2) return false;
    // The runtime cycle uses one shared hold + transition duration per scene.
    const segmentMs = Number(playhead.max) / frames.length;
    const displayedIndex = Math.floor(Number(playhead.value) / segmentMs) % frames.length;
    if (displayedIndex === 0) return false;
    const displayedLabel = frames[displayedIndex].querySelector('.animation-storyboard-caption strong')?.textContent?.trim();
    const selectedScene = element.querySelector('.animation-sequence-scene[data-content-selected="true"] .animation-sequence-layer-copy strong')?.textContent?.trim();
    const inspectorPreview = element.querySelector('.studio-inspector-right [role="img"][aria-label]')?.getAttribute('aria-label');
    return frames[displayedIndex].dataset.selected === 'true'
      && Boolean(displayedLabel && selectedScene === displayedLabel && inspectorPreview === `Preview of ${displayedLabel}`);
  })).toBe(true);
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

test('Animation groups document controls on the left, artboard actions on the right, and history with canvas controls', async ({ page }) => {
  const { studio } = await prepareSelection(page);
  const bar = studio.getByRole('region', { name: 'Animation artboards', exact: true });
  const header = studio.locator('[data-studio-tool-header]');
  await expect(header).toHaveAttribute('data-layout', 'balanced');
  await expect(header.locator('[data-slot="context"]').getByRole('group', { name: 'Animation document', exact: true })).toBeVisible();
  await expect(header.locator('[data-slot="trailing"]').getByRole('group', { name: 'Export animation', exact: true })).toBeVisible();
  await expect(bar.locator('[data-slot="artboard-start"]').getByRole('button', { name: 'Save animation', exact: true })).toBeVisible();
  await expect(bar.locator('[data-slot="artboard-start"]').getByRole('combobox', { name: 'Active animation artboard', exact: true })).toBeVisible();
  await expect(bar.locator('button[title="Open saved animations"]')).toHaveCount(0);
  const viewControls = studio.getByRole('group', { name: 'Canvas zoom', exact: true });
  await viewControls.locator('button[title="Open saved animations"]').click();
  await expect(page.getByRole('region', { name: 'Animation Studio saved animations', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  for (const width of [1440, 1100, 780]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = (await bar.boundingBox())!;
    const actions = (await bar.locator('[data-slot="artboard-end"]').boundingBox())!;
    expect(bounds.x + bounds.width - (actions.x + actions.width)).toBeLessThan(12);
    for (const label of ['Add animation artboard', 'Duplicate animation artboard', 'Delete animation artboard']) {
      const box = (await bar.getByRole('button', { name: label, exact: true }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    }
    const headerBounds = (await header.boundingBox())!;
    const context = (await header.locator('[data-slot="context"]').boundingBox())!;
    const trailing = (await header.locator('[data-slot="trailing"]').boundingBox())!;
    expect(context.x + context.width).toBeLessThanOrEqual(trailing.x);
    expect(trailing.x + trailing.width).toBeLessThanOrEqual(headerBounds.x + headerBounds.width);
    expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(width + 1);
  }
});

test('paused Animation scrubbing selects the displayed scene and inspects transitions without a stale box', async ({ page }) => {
  const { selection, studio } = await prepareSelection(page);
  const playhead = studio.getByRole('slider', { name: 'Storyboard playhead', exact: true });
  await playhead.press('Home');
  await playhead.press('Shift+ArrowRight');
  await expect(selection).toHaveCount(0);
  await expect(studio.locator('.studio-inspector-right .lab-panel-heading')).toContainText('Transition 01');
  for (let index = 0; index < 5; index += 1) await playhead.press('ArrowRight');
  await expect(studio.getByRole('slider', { name: 'Timeline playhead', exact: true })).toHaveValue('1500');
  await expect(selection).toContainText('BETA');
  const inspector = studio.locator('.studio-inspector-right');
  await expect(inspector.getByRole('heading', { name: 'BETA', exact: true })).toBeVisible();
  await expect(inspector.getByRole('img', { name: 'Preview of BETA', exact: true })).toBeVisible();
  await expect(inspector.getByRole('textbox', { name: 'Selected layer text', exact: true })).toHaveValue('BETA');
  await expect(studio.getByRole('button', { name: 'Edit frame 2: BETA', exact: true })).toHaveAttribute('data-selected', 'true');
  await expect(studio.locator('.animation-sequence-scene[data-content-selected="true"]')).toContainText('BETA');
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
