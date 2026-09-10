import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function prepareAnimation(page: Page) {
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto('/studio?tool=animation&project=gt');
  const studio = page.locator('.animation-studio:visible');
  await studio.getByRole('button', { name: 'Edit source code', exact: true }).click();
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
    state.playbackRate = 0.75;
    state.settings = { ...state.settings, width: 320, height: 180, holdMs: 1200,
      transitionMs: 350, fps: 24, fontSize: 48, fontWeight: 500, foreground: '#F3F3F3' };
    state.sequenceBackground = { ...state.sequenceBackground, style: 'solid', colorA: '#111111' };
    delete state.artboards;
    delete state.activeArtboardId;
    await api.applySource(state);
  });
  await page.getByRole('button', { name: 'Close source editor', exact: true }).click();
  await studio.getByRole('button', { name: 'Edit frame 1: ALPHA', exact: true }).click();
  await expect(studio.getByRole('textbox', { name: 'Selected layer text', exact: true })).toHaveValue('ALPHA');
  return studio;
}

async function readDocument(page: Page) {
  let serialized = '';
  await expect.poll(async () => {
    const result = await page.evaluate(() => {
      try {
        const source = window.glyphfield!.studio.readSource();
        return JSON.parse(source).metadata.animation ? { source } : { error: 'The active source is not Animation.' };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    });
    if (typeof result.source !== 'string') return result.error;
    serialized = result.source;
    return true;
  }, { message: 'The closed-drawer Animation workspace must expose its current public source.' }).toBe(true);
  return JSON.parse(serialized);
}

async function readState(page: Page) {
  return (await readDocument(page)).metadata.animation;
}

async function semanticSource(page: Page) {
  const source = await readDocument(page);
  const state = source.metadata.animation;
  return {
    textFrames: state.textFrames, sequenceOrder: state.sequenceOrder,
    frameSettings: state.frameSettings, backgroundOverrides: state.backgroundOverrides,
    sequenceBackground: state.sequenceBackground, playbackRate: state.playbackRate,
    mode: state.mode, includeBrandLogo: state.includeBrandLogo,
    settings: Object.fromEntries(['width', 'height', 'holdMs', 'transitionMs', 'fps', 'fontSize', 'fontWeight', 'foreground']
      .map((key) => [key, state.settings[key]])),
    pages: source.pageIds.map((id: string) => {
      const board = source.pages[id];
      return { width: board.width, height: board.height, elementIds: board.elementIds };
    }),
  };
}

async function pixels(studio: Locator) {
  return studio.locator('canvas[aria-label="Animation preview canvas"]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Animation preview has no 2D context');
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let ink = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index] > 100 && rgba[index + 3] > 0) ink += 1;
      for (let channel = 0; channel < 4; channel += 1) hash = Math.imul(hash ^ rgba[index + channel], 16777619);
    }
    return { width: canvas.width, height: canvas.height, hash: hash >>> 0, ink };
  });
}

async function selectFrame(page: Page, studio: Locator, index: number, text: string) {
  await studio.getByRole('button', { name: `Edit frame ${index}: ${text}`, exact: true }).click();
  await expect(studio.getByRole('textbox', { name: 'Selected layer text', exact: true })).toHaveValue(text);
  // Resolve fonts and the resulting paused redraw, not an arbitrary sleep or a live shader tick.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect.poll(async () => (await pixels(studio)).ink).toBeGreaterThan(100);
  const result = await pixels(studio);
  expect(result).toMatchObject({ width: 320, height: 180 });
  return result;
}

test('Animation keeps saving and versions together in the header, with canvas edit history in the dock', async ({ page }) => {
  const studio = await prepareAnimation(page);
  const header = studio.locator('[data-studio-tool-header]');
  const actions = header.locator('[data-slot="actions"]');
  const files = actions.getByRole('group', { name: 'Project files and source', exact: true });
  for (const name of ['Open project file', 'Download project file', 'Edit source code']) {
    await expect(files.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const versionsGroup = actions.getByRole('group', { name: 'Animation saving and versions', exact: true });
  const status = versionsGroup.locator('[data-design-version-status]');
  await expect(status).toContainText('Autosaved');
  const history = versionsGroup.locator('button[title="Open saved animations"]');
  await expect(history).toContainText('Autosaved animation');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('data-compact', 'true');
  await expect(status).toHaveCSS('width', '24px');
  await expect(status).toHaveCSS('height', '32px');
  await expect(status.locator('small')).toHaveClass('sr-only');
  await expect(history).toHaveAccessibleDescription('Autosaved animation: Autosaved');
  const compactStatus = await status.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const previous = element.previousElementSibling!;
    const picker = previous.getBoundingClientRect();
    return { followsPicker: previous.getAttribute('aria-describedby') === element.id,
      gap: bounds.left - picker.right, trailingGap: element.parentElement!.getBoundingClientRect().right - bounds.right };
  });
  expect(compactStatus.followsPicker).toBe(true);
  expect(compactStatus.gap).toBeGreaterThanOrEqual(0);
  expect(compactStatus.gap).toBeLessThanOrEqual(8);
  expect(compactStatus.trailingGap).toBeLessThanOrEqual(1);
  for (const name of ['Save animation', 'Fork animation', 'Clone animation']) {
    await expect(versionsGroup.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const output = actions.getByRole('group', { name: 'Export animation', exact: true });
  const statusBox = (await status.boundingBox())!;
  const exportBox = (await output.boundingBox())!;
  expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(exportBox.x + 1);

  const dock = studio.locator('.canvas-viewport-toolbar');
  await expect(dock.locator('button[title="Open saved animations"]')).toHaveCount(0);
  const original = await selectFrame(page, studio, 1, 'ALPHA');
  const sourceButton = files.getByRole('button', { name: 'Edit source code', exact: true });
  const sourceButtonBeforeEdit = (await sourceButton.boundingBox())!;
  const text = studio.getByRole('textbox', { name: 'Selected layer text', exact: true });
  await text.fill('OMEGA');
  await text.press('Tab');
  await expect.poll(async () => (await readState(page)).textFrames).toBe('OMEGA\nBETA');
  await expect.poll(async () => (await pixels(studio)).hash).not.toBe(original.hash);
  await expect(status).toHaveText('Autosaved');
  const sourceButtonAfterEdit = (await sourceButton.boundingBox())!;
  expect(Math.abs(sourceButtonAfterEdit.x - sourceButtonBeforeEdit.x)).toBeLessThan(1);
  expect(Math.abs(sourceButtonAfterEdit.y - sourceButtonBeforeEdit.y)).toBeLessThan(1);
  const edited = await pixels(studio);
  await dock.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await readState(page)).textFrames).toBe('ALPHA\nBETA');
  await expect.poll(() => pixels(studio)).toEqual(original);
  await dock.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await readState(page)).textFrames).toBe('OMEGA\nBETA');
  await expect.poll(() => pixels(studio)).toEqual(edited);

  const artboards = studio.getByRole('region', { name: 'Animation artboards', exact: true });
  await expect(artboards.getByRole('button', { name: 'Save animation', exact: true })).toHaveCount(0);
  await versionsGroup.getByRole('button', { name: 'Save animation', exact: true }).click();
  await expect(versionsGroup.getByRole('button', { name: 'Animation saved', exact: true })).toBeDisabled();
  await dock.getByRole('button', { name: 'Action history', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Action history', exact: true })).toBeVisible();
  await history.click();
  await expect(page.getByRole('dialog', { name: 'Action history', exact: true })).toHaveCount(0);
  const versions = page.getByRole('region', { name: 'Animation Studio saved animations', exact: true });
  await expect(versions).toBeVisible();
  const currentAnimation = versions.locator('[data-active="true"]');
  await expect(currentAnimation).toHaveCount(1);
  await expect(currentAnimation.getByText('Current', { exact: true })).toBeVisible();
  await expect(currentAnimation.getByRole('button').first()).toHaveAttribute('aria-current', 'true');
  await expect(currentAnimation.getByRole('button').first()).toBeFocused();
  const name = versions.getByRole('textbox', { name: 'Current animation name', exact: true });
  await expect(name).toHaveCount(0);
  const beforeRename = await semanticSource(page);
  await currentAnimation.getByRole('button', { name: 'Rename Untitled animation', exact: true }).click();
  await expect(name).toBeFocused();
  await name.fill('Motion checkpoint');
  await name.press('Enter');
  await expect(name).toHaveCount(0);
  await expect(currentAnimation.getByRole('button').first()).toContainText('Motion checkpoint');
  expect(await semanticSource(page)).toEqual(beforeRename);
  await currentAnimation.getByRole('button', { name: 'Rename Motion checkpoint', exact: true }).click();
  await name.fill('Discard this rename');
  await currentAnimation.getByRole('button', { name: 'Cancel rename', exact: true }).click();
  await expect(name).toHaveCount(0);
  await expect(currentAnimation.getByRole('button').first()).toContainText('Motion checkpoint');
  await currentAnimation.getByRole('button', { name: 'Delete Motion checkpoint', exact: true }).click();
  await expect(currentAnimation.getByRole('button', { name: 'Confirm delete Motion checkpoint', exact: true })).toBeVisible();
  await currentAnimation.getByRole('button', { name: 'Cancel deletion', exact: true }).click();
  await expect(currentAnimation.getByRole('button', { name: 'Confirm delete Motion checkpoint', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(versions).toHaveCount(0);
  await expect(status).toContainText('Saved');
  await expect(history).toContainText('Motion checkpoint');
  await expect(history).toHaveAccessibleDescription(/Motion checkpoint: Saved/);
  await expect(status).toHaveCSS('width', '24px');

  await selectFrame(page, studio, 1, 'OMEGA');
  await text.fill('LATEST');
  await text.press('Tab');
  await expect.poll(async () => (await readState(page)).textFrames).toBe('LATEST\nBETA');
  const editedSource = await semanticSource(page);
  await page.setViewportSize({ width: 600, height: 960 });
  await history.click();
  await expect(currentAnimation.getByRole('button').first()).toBeFocused();
  await expect(currentAnimation.getByRole('button').first()).toContainText('Motion checkpoint');
  await expect(name).toHaveCount(0);
  const compactPicker = await versions.evaluate((element) => ({
    bounds: element.getBoundingClientRect().toJSON(),
    overflow: element.scrollWidth - element.clientWidth,
  }));
  expect(compactPicker.overflow).toBeLessThanOrEqual(1);
  expect(compactPicker.bounds.left).toBeGreaterThanOrEqual(0);
  expect(compactPicker.bounds.right).toBeLessThanOrEqual(600);
  await currentAnimation.getByRole('button').first().click();
  await expect(versions).toHaveCount(0);
  // The saved checkpoint contains OMEGA; selecting Current retains the live edit.
  expect(await semanticSource(page)).toEqual(editedSource);
  await expect(status).toContainText('Unsaved changes');
});

test('Animation downloads and reopens a real portable project with identical frame pixels, timing and private fonts in another project', async ({ page }) => {
  let studio = await prepareAnimation(page);
  const alpha = await selectFrame(page, studio, 1, 'ALPHA');
  const beta = await selectFrame(page, studio, 2, 'BETA');
  expect(beta.hash).not.toBe(alpha.hash);
  const original = await semanticSource(page);
  const downloading = page.waitForEvent('download');
  await studio.getByRole('button', { name: 'Download project file', exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.glyphfield\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.byteLength).toBeGreaterThan(1000);
  const portable = JSON.parse(bytes.toString('utf8'));
  expect(portable.schemaVersion).toBe(2);
  expect(portable.metadata.animation.identity.typography.find((role: { role: string }) => role.role === 'Display').family).toBe('Rasmus Inter');
  const fonts = portable.metadata.animation.identity.fonts;
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((font: { path: string }) => font.path.startsWith('data:'))).toBe(true);
  expect(portable.metadata.animation.settings).toMatchObject(original.settings);

  // Starter is not necessarily open in the GT folder's tab rail. Its public URL
  // opens a different real project without depending on seeded app storage.
  await page.goto('/studio?tool=animation&project=starter');
  await expect(page).toHaveURL(/project=starter/);
  studio = page.locator('.animation-studio:visible');
  const choosing = page.waitForEvent('filechooser');
  await studio.getByRole('button', { name: 'Open project file', exact: true }).click();
  await (await choosing).setFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: bytes });
  await expect(studio.getByRole('status').filter({ hasText: `Opened ${download.suggestedFilename()}.` })).toHaveCount(1);
  await expect.poll(() => semanticSource(page)).toEqual(original);
  const restored = await readState(page);
  expect(restored.identity.fonts.every((font: { family: string }) => font.family.startsWith('Glyphfield Project '))).toBe(true);
  expect(restored.identity.fonts.map((font: { path: string }) => font.path)).toEqual(fonts.map((font: { path: string }) => font.path));
  await selectFrame(page, studio, 1, 'ALPHA');
  await expect.poll(() => pixels(studio)).toEqual(alpha);
  await selectFrame(page, studio, 2, 'BETA');
  await expect.poll(() => pixels(studio)).toEqual(beta);

  // A rejected file cannot partially clear the current sequence or change its painted frame.
  const invalid = page.waitForEvent('filechooser');
  await studio.getByRole('button', { name: 'Open project file', exact: true }).click();
  await (await invalid).setFiles({ name: 'invalid.glyphfield.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(studio.getByRole('alert')).toBeVisible();
  expect(await semanticSource(page)).toEqual(original);
  expect(await pixels(studio)).toEqual(beta);
});
