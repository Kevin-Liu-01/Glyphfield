import { expect, test, type Page } from '@playwright/test';

async function readSource(page: Page) {
  return page.evaluate(() => {
    try { return JSON.parse(window.glyphfield!.studio.readSource()); }
    catch (error) {
      if (error instanceof Error && /still prepar|still being prepared|source is not available|No active Studio workspace is ready for automation/i.test(error.message)) return null;
      throw error;
    }
  });
}

async function selectTool(page: Page, name: string, tool: string) {
  await page.locator('.studio-nav').getByRole('button', { name, exact: true }).click();
  await expect.poll(async () => (await readSource(page))?.metadata.tool).toBe(tool);
  await expect(page.locator('[data-studio-tool-header]:visible').getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
}

test('duplicating a project carries current Design Lab and Animation work, persists, and stays independent', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/studio?tool=identity&project=starter');
  await page.getByRole('button', { name: 'Add brand project', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Design Lab / }).click();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await expect(page.locator('.project-tab[data-selected="true"]')).not.toHaveAttribute('data-project-id', 'starter');
  const originalId = await page.locator('.project-tab[data-selected="true"]').getAttribute('data-project-id');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  const textId = await page.evaluate(async () => {
    const api = window.glyphfield!.studio;
    const source = JSON.parse(api.readSource());
    const text = Object.values(source.elements).find((item: any) => item.kind === 'text') as any;
    text.content = 'Keep my actual design';
    text.data.value = text.content;
    text.data.color = '#B46DDC';
    await api.applySource(source);
    return text.id as string;
  });
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Design saved', exact: true })).toBeDisabled();
  await selectTool(page, 'Animation', 'animation-studio');
  await page.evaluate(async () => {
    const api = window.glyphfield!.studio;
    const state = JSON.parse(api.readSource()).metadata.animation;
    state.includeBrandLogo = false;
    state.textFrames = 'My motion, not a template';
    state.mode = 'sequence';
    state.sequenceOrder = ['text-0'];
    state.sequenceBackground = { ...state.sequenceBackground, style: 'solid', colorA: '#112233' };
    delete state.artboards;
    delete state.activeArtboardId;
    await api.applySource(state);
  });
  await page.getByRole('button', { name: 'Duplicate active project', exact: true }).click();
  await expect(page.locator('.project-tab[data-selected="true"]')).not.toHaveAttribute('data-project-id', originalId!);
  const copyId = await page.locator('.project-tab[data-selected="true"]').getAttribute('data-project-id');
  await expect.poll(async () => (await readSource(page))?.brandId).toBe(copyId);
  await expect.poll(async () => (await readSource(page))?.metadata.animation.textFrames).toBe('My motion, not a template');
  expect((await readSource(page)).metadata.animation.sequenceBackground.colorA).toBe('#112233');
  await expect(page.locator('[data-design-version-status]:visible')).toHaveText('Autosaved');
  await selectTool(page, 'Design Lab', 'design-lab');
  await expect.poll(async () => (await readSource(page))?.elements[textId]?.content).toBe('Keep my actual design');
  expect((await readSource(page)).elements[textId].data.color).toBe('#B46DDC');
  await page.locator('[data-studio-tool-header]:visible button[title="Open saved designs"]').click();
  await expect(page.getByRole('region', { name: 'Design Lab saved designs', exact: true })).toContainText('Untitled design');
  await page.keyboard.press('Escape');
  await page.evaluate(async (id) => {
    const api = window.glyphfield!.studio;
    const source = JSON.parse(api.readSource());
    source.elements[id].content = 'Edited copy only';
    source.elements[id].data.value = 'Edited copy only';
    await api.applySource(source);
  }, textId);
  await expect(page.locator('[data-design-version-status]:visible')).toContainText('Unsaved changes');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await expect.poll(async () => (await readSource(page))?.elements[textId]?.content).toBe('Edited copy only');
  await page.locator(`.project-tab[data-project-id="${originalId}"]`).getByRole('button').first().click();
  await expect.poll(async () => (await readSource(page))?.brandId).toBe(originalId);
  await expect.poll(async () => (await readSource(page))?.elements[textId]?.content).toBe('Keep my actual design');
});

for (const tool of ['material', 'animation']) {
  test(`${tool} file actions share an export group and errors open accessible details without changing header height`, async ({ page }, info) => {
    await page.goto(`/studio?tool=${tool}&project=gt`);
    const header = page.locator('[data-studio-tool-header]:visible');
    const group = header.getByRole('group', { name: 'Project files, code, and export', exact: true });
    await expect(group.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
    for (const name of ['Open project file', 'Download project file', tool === 'material' ? 'Open export settings' : 'Export MP4']) {
      await expect(group.getByRole('button', { name, exact: true })).toBeVisible();
    }
    const before = (await header.boundingBox())!;
    await group.locator('input[type="file"]').setInputFiles({ name: 'invalid.glyphfield.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
    const error = group.getByRole('button', { name: 'Could not open project: show details', exact: true });
    await expect(error).toBeVisible();
    expect((await header.boundingBox())!.height).toBe(before.height);
    await error.focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('menu', { name: 'Could not open project', exact: true });
    await expect(details).toBeVisible();
    await expect(details.getByRole('menuitem', { name: 'Dismiss error', exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath('file-error-details.png') });
    await page.keyboard.press('Escape');
    await expect(details).toHaveCount(0);
    await expect(error).toBeFocused();
    await error.click();
    await details.getByRole('menuitem', { name: 'Dismiss error', exact: true }).click();
    await expect(error).toHaveCount(0);
  });
}
