import { expect, test } from '@playwright/test';

for (const tool of ['animation', 'material']) {
  test(`${tool} keeps shared artboard controls on one row with one type scale`, async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 960 });
    await page.goto(`/studio?tool=${tool}&project=gt`);
    const bar = page.locator('.studio-artboard-bar:visible');
    await expect(bar).toBeVisible();
    for (const width of [1536, 1280, 1024]) {
      await page.setViewportSize({ width, height: 960 });
      await expect.poll(() => bar.evaluate((element) => {
        const buttons = Array.from(element.querySelectorAll('button')).filter((button) => button.getBoundingClientRect().width);
        const rows = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
        const sizes = buttons.map((button) => parseFloat(getComputedStyle(button).fontSize));
        return {
          height: element.getBoundingClientRect().height,
          rowSpread: Math.max(...rows) - Math.min(...rows),
          typeSpread: Math.max(...sizes) - Math.min(...sizes),
        };
      })).toEqual({ height: 46, rowSpread: 0, typeSpread: 0 });
    }
    if (tool === 'material') {
      // Duplication captures shader pixels: do not treat a not-yet-rendered
      // material as a toolbar hit-target failure.
      const stage = page.locator('[data-testid="shader-lab-live-stage"]');
      await expect(stage.locator('[data-live-material-ready="true"]')).toHaveCount(1);
      await expect(stage.locator('[data-shader-time-restoring="true"]')).toHaveCount(0);
    }
    await bar.getByRole('button', { name: /Duplicate (animation|active) artboard/ }).click();
    await expect(bar.getByRole('combobox')).toContainText('copy');
  });
}

test('Design Lab groups project files and source before autosave and export presets', async ({ page }) => {
  await page.goto('/studio?tool=material&project=gt');
  const header = page.locator('.shader-lab-v2 [data-studio-tool-header]:visible');
  const actions = header.locator('[data-slot="actions"]');
  await expect(actions.getByRole('group', { name: 'Project files and source' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Open project file', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Download project file', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Edit source code' })).toBeVisible();
  await expect(header.getByRole('group', { name: 'Shader playback' })).toHaveCount(0);
  const preset = actions.getByRole('combobox', { name: 'Export size preset' });
  await preset.click();
  await page.getByRole('option', { name: 'Large · 1280px', exact: true }).click();
  await expect(preset).toContainText('Large');
  await expect.poll(() => page.evaluate(() => {
    const source = window.glyphfield?.studio.readSource();
    return typeof source === 'string' ? JSON.parse(source).metadata.designLab.exportSettings.width : null;
  })).toBe(1280);
});

test('shared tooltips appear on hover and keyboard focus without blocking the first click', async ({ page, browserName }) => {
  await page.goto('/studio?tool=material&project=gt');
  const header = page.locator('.shader-lab-v2 [data-studio-tool-header]:visible');
  const code = header.getByRole('button', { name: 'Edit source code' });
  await code.hover();
  await expect(page.getByRole('tooltip')).toContainText('source');
  await code.click();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Editable source code' })).toBeVisible();
  await page.getByRole('button', { name: 'Close source editor' }).click();
  // Mac WebKit follows Safari's Option-Tab navigation for all controls.
  // https://support.apple.com/guide/safari/cpsh003/mac
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  const backTab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Shift+Tab' : 'Shift+Tab';
  // Move away and back through real keyboard navigation, not synthetic focus.
  await code.focus();
  await page.keyboard.press(tab);
  await page.keyboard.press(backTab);
  await expect(code).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('source');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(code).toBeFocused();
});
