import { expect, test, type Page } from '@playwright/test';
import type { CanvasElement } from '../src/lib/canvasDocument';

async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Add brand project', exact: true }).click();
  return page.getByRole('menu', { name: 'New project', exact: true });
}

async function readSource(page: Page) {
  return page.evaluate(() => {
    try { return JSON.parse(window.glyphfield!.studio.readSource() as string); }
    catch { return null; }
  });
}

test('the plus menu supports keyboard dismissal and creates an independent brand template copy', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  const menu = await openMenu(page);
  await expect(menu.getByRole('menuitem')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add brand project', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await menu.getByRole('menuitem', { name: 'Use a template', exact: false }).click();
  await page.getByRole('menu', { name: 'Use a template', exact: true }).getByRole('menuitem', { name: 'Starter', exact: true }).click();
  await expect(page.locator('.project-tab')).toHaveCount(3);
  const selected = page.locator('.project-tab[data-selected="true"]');
  await expect(selected).not.toHaveAttribute('data-project-id', 'starter');
  await expect(page.getByRole('textbox', { name: 'Brand name', exact: true })).toHaveValue('Starter copy 1');
});

test('start from scratch creates an empty Design Lab canvas and an empty Animation timeline that survive reload', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  for (const [label, tool] of [['Design Lab', 'design-lab'], ['Animation', 'animation-studio']]) {
    const menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: new RegExp(`^${label} `) }).click();
    await expect.poll(async () => (await readSource(page))?.metadata?.tool, { timeout: 30_000 }).toBe(tool);
    await expect.poll(async () => Object.keys((await readSource(page))?.elements ?? { loading: true })).toEqual([]);
    await expect(page.locator('[data-design-version-status]').filter({ hasText: 'Autosaved' }).last()).toBeVisible();
    const brandId = (await readSource(page)).brandId;
    await page.reload();
    await expect.poll(async () => (await readSource(page))?.brandId, { timeout: 30_000 }).toBe(brandId);
    expect((await readSource(page)).elements).toEqual({});
  }
});

test('the plus file chooser imports into a new tab and rejects malformed files without replacing work', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  await (await openMenu(page)).getByRole('menuitem', { name: /^Design Lab / }).click();
  await expect(page.locator('[data-design-version-status]').filter({ hasText: 'Autosaved' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await expect.poll(async () => Object.values((await readSource(page))?.elements ?? {}).some((element) => (element as CanvasElement).kind === 'text')).toBe(true);
  const project = await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const text = (Object.values(source.elements) as CanvasElement[]).find((element) => element.kind === 'text')!;
    text.content = 'Import from the plus menu';
    text.data.value = text.content;
    await studio.applySource(source);
    const artifact = await studio.invoke('design.export.project') as { blob: Blob; fileName: string };
    return { source: await artifact.blob.text(), fileName: artifact.fileName, brandId: source.brandId, textId: text.id };
  });
  const menu = await openMenu(page);
  const choosing = page.waitForEvent('filechooser');
  await menu.getByRole('menuitem', { name: /^Import project/ }).click();
  await (await choosing).setFiles({ name: project.fileName, mimeType: 'application/json', buffer: Buffer.from(project.source) });
  await expect(page.locator('.project-tab')).toHaveCount(4);
  await expect.poll(async () => (await readSource(page))?.brandId, { timeout: 30_000 }).not.toBe(project.brandId);
  const importedId = await page.locator('.project-tab[data-selected="true"]').getAttribute('data-project-id');
  await expect.poll(async () => (await readSource(page))?.brandId, { timeout: 30_000 }).toBe(importedId);
  await expect.poll(async () => (await readSource(page))?.elements?.[project.textId]?.content, { timeout: 30_000 }).toBe('Import from the plus menu');
  const imported = await readSource(page);
  expect(imported.brandId).not.toBe(project.brandId);
  await expect(page.locator('[data-design-version-status]').filter({ hasText: 'Autosaved' }).last()).toBeVisible();
  await page.reload();
  await expect.poll(async () => (await readSource(page))?.elements?.[project.textId]?.content, { timeout: 30_000 }).toBe('Import from the plus menu');
  const before = await readSource(page);
  await openMenu(page);
  const invalidChoice = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /^Import project/ }).click();
  await (await invalidChoice).setFiles({ name: 'bad.glyphfield.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(page.getByRole('alert').filter({ hasText: 'Could not open project' })).toBeVisible();
  await expect(page.locator('.project-tab')).toHaveCount(4);
  expect(await readSource(page)).toEqual(before);
});

test('import detects Animation files and preserves editable frames and embedded fonts in a separate project', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  await (await openMenu(page)).getByRole('menuitem', { name: /^Animation / }).click();
  await expect.poll(async () => (await readSource(page))?.metadata?.tool, { timeout: 30_000 }).toBe('animation-studio');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Selected layer text', exact: true }).fill('Imported animation frame');
  await expect.poll(async () => (await readSource(page))?.metadata?.animation?.textFrames).toBe('Imported animation frame');
  const project = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('animation.export.project') as { blob: Blob; fileName: string };
    return { source: await artifact.blob.text(), fileName: artifact.fileName };
  });
  const originalId = (await readSource(page)).brandId;
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Brand identity', exact: true }).click();
  const menu = await openMenu(page);
  const choosing = page.waitForEvent('filechooser');
  await menu.getByRole('menuitem', { name: /^Import project/ }).click();
  await (await choosing).setFiles({ name: project.fileName, mimeType: 'application/json', buffer: Buffer.from(project.source) });
  await expect(page.locator('.project-tab')).toHaveCount(4);
  await expect.poll(async () => (await readSource(page))?.brandId, { timeout: 30_000 }).not.toBe(originalId);
  const importedId = await page.locator('.project-tab[data-selected="true"]').getAttribute('data-project-id');
  await expect.poll(async () => (await readSource(page))?.brandId, { timeout: 30_000 }).toBe(importedId);
  await expect.poll(async () => (await readSource(page))?.metadata?.animation?.textFrames, { timeout: 30_000 }).toBe('Imported animation frame');
  const imported = await readSource(page);
  expect(imported.brandId).not.toBe(originalId);
  expect(imported.metadata.animation.identity.fonts[0].family).toMatch(/^Glyphfield Project /);
  await expect(page.locator('[data-design-version-status]').filter({ hasText: 'Autosaved' }).last()).toBeVisible();
  await page.reload();
  await expect.poll(async () => (await readSource(page))?.metadata?.animation?.textFrames, { timeout: 30_000 }).toBe('Imported animation frame');
});
