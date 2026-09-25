import { expect, type Page } from '@playwright/test';

export async function waitForStudioSource(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    try {
      const studio = window.glyphfield?.studio;
      return studio?.describe().source.read ? Boolean(studio.readSource()) : false;
    }
    catch (error) {
      if (error instanceof Error && /prepar|not available|No active Studio workspace/i.test(error.message)) return false;
      throw error;
    }
  })).toBe(true);
}

export async function openSourceEditor(page: Page) {
  await waitForStudioSource(page);
  await page.locator('[data-studio-tool-header]:visible').getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Edit source code/ }).click();
  await expect(page.getByRole('textbox', { name: 'Editable source code', exact: true })).toBeVisible();
}
