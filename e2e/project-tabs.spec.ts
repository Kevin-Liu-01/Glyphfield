import { expect, test } from '@playwright/test';

test('the whole tab surface activates the project, not only its label', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  const gt = page.locator('.project-tab[data-project-id="gt"]');
  await expect(gt).toBeVisible();
  await gt.click({ position: { x: 3, y: 19 } });
  await expect(gt).toHaveAttribute('data-selected', 'true');
  await expect(page).toHaveURL(/project=gt/);
  const starter = page.locator('.project-tab[data-project-id="starter"]');
  await starter.click({ position: { x: 35, y: 3 } });
  await expect(starter).toHaveAttribute('data-selected', 'true');
  await expect(page).toHaveURL(/project=starter/);
});

test('tab release outside the bar does not turn a later hover into a drag', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/studio?tool=identity&project=starter');
  const gt = page.locator('.project-tab[data-project-id="gt"]');
  await expect(gt).toBeVisible();
  const box = (await gt.boundingBox())!;
  // Leave the tab in a single pointer move before any in-tab drag frame occurs.
  await page.mouse.move(box.x + 20, box.y + 19);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + box.height + 30);
  await page.mouse.up();
  await page.mouse.move(box.x + 80, box.y + 19);
  await page.getByRole('button', { name: 'Open General Translation project', exact: true }).click();
  await expect(gt).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.project-tab[data-dragging="true"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reordering tabs preserves selection and close icons close without activating', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  const starter = page.locator('.project-tab[data-project-id="starter"]');
  const gt = page.locator('.project-tab[data-project-id="gt"]');
  await expect(gt).toBeVisible();
  const from = (await starter.boundingBox())!;
  const to = (await gt.boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + 19);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 15, to.y + 19, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.project-tab').first()).toHaveAttribute('data-project-id', 'gt');
  await expect(starter).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.project-tab[data-dragging="true"]')).toHaveCount(0);
  const gtButton = page.getByRole('button', { name: 'Open General Translation project', exact: true });
  await gtButton.click();
  await expect(gt).toHaveAttribute('data-selected', 'true');
  await gtButton.press('Alt+ArrowRight');
  await expect(page.locator('.project-tab').last()).toHaveAttribute('data-project-id', 'gt');
  await page.getByRole('button', { name: 'Close Starter tab', exact: true }).locator('svg').click();
  await expect(starter).toHaveCount(0);
  await expect(gt).toHaveAttribute('data-selected', 'true');
  await expect(page).toHaveURL(/project=gt/);
});
