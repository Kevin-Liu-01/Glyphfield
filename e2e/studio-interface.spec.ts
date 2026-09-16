import { expect, test } from '@playwright/test';
import { STUDIO_TOOLS } from '../src/lib/studioCatalog';
import { waitForStudioSource } from './studio-ui-helpers';

test('every public tool keeps its header and File menu usable at desktop and midsize widths', async ({ page }, info) => {
  test.setTimeout(240_000);
  for (const tool of STUDIO_TOOLS) {
    await page.goto(`/studio?tool=${tool.id}&project=starter`);
    const header = page.locator('[data-studio-tool-header]:visible').first();
    await expect(header.getByRole('heading', { name: tool.name, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeEnabled();
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => header.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const controls = [...element.querySelectorAll('button, [role="combobox"]')]
          .filter((control) => control.getBoundingClientRect().width > 0);
        return controls.every((control) => {
          const rect = control.getBoundingClientRect();
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
        });
      }), { message: `${tool.name} header at ${width}px` }).toBe(true);
      if (tool.id === 'material') {
        await expect.poll(() => page.locator('.design-motion-strip').evaluate((strip) => {
          const controls = [...strip.querySelectorAll('button, a, input[type="range"]')]
            .map((control) => control.getBoundingClientRect()).filter((rect) => rect.width > 0);
          const bounds = strip.getBoundingClientRect();
          return controls.every((rect, index) => rect.left >= bounds.left && rect.right <= bounds.right + 1
            && (index === 0 || rect.left >= controls[index - 1].right - 1));
        }), { message: `Design Lab playback controls do not overlap at ${width}px` }).toBe(true);
      }
    }
    if (tool.id !== 'brand-book') {
      await waitForStudioSource(page);
      const file = header.getByRole('button', { name: 'File', exact: true });
      await file.focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu', { name: 'File', exact: true });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: /^Edit source code/ })).toBeEnabled();
      expect(await page.evaluate(() => window.glyphfield!.studio.controls().some(({ label }) => label.startsWith('Edit source code')))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(file).toBeFocused();
    }
    await page.screenshot({ path: info.outputPath(`${tool.id}-1024.png`) });
  }
});

test('compact color and collapsible sections preserve edits and provide keyboard access', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/studio?tool=material&project=starter');
  await waitForStudioSource(page);
  await page.getByRole('button', { name: 'Select Canvas shader 1 preview', exact: true }).click();
  const color = page.getByRole('button', { name: 'Shader base color', exact: true });
  await expect(color).toBeVisible();
  await color.click();
  const picker = page.getByRole('dialog', { name: 'Shader base color color picker', exact: true });
  await expect(picker).toBeVisible();
  const hex = picker.getByRole('textbox', { name: 'Shader base color HEX', exact: true });
  await hex.fill('#CC5533');
  await hex.press('Enter');
  await page.keyboard.press('Escape');
  await expect(color).toContainText('#CC5533');
  const section = page.getByRole('button', { name: 'Shader color', exact: true });
  await section.focus();
  await page.keyboard.press('Enter');
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await expect(color).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(color).toBeVisible();
  await expect(color).toContainText('#CC5533');
  const switchToDark = page.getByRole('button', { name: 'Switch to dark mode', exact: true });
  if (await switchToDark.isVisible()) await switchToDark.click();
  await expect(color).toContainText('#CC5533');
  await page.screenshot({ path: info.outputPath('compact-inspector-dark.png') });
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(color).toContainText('#CC5533');
  await page.screenshot({ path: info.outputPath('compact-inspector-light.png') });
});

test('menus close on a second trigger click and never leak into another tool', async ({ page }) => {
  await page.goto('/studio?tool=material&project=starter');
  await waitForStudioSource(page);
  const file = page.locator('[data-studio-tool-header]:visible').getByRole('button', { name: 'File', exact: true });
  await file.click();
  await file.click();
  await expect(page.getByRole('menu', { name: 'File', exact: true })).toHaveCount(0);
  await file.click();
  await page.locator('.studio-nav').getByRole('button', { name: 'Typography', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'File', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-studio-tool-header]:visible').getByRole('heading', { name: 'Typography', exact: true })).toBeVisible();
});
