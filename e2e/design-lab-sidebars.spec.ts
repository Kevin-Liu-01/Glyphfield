import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForStudioSource } from './studio-ui-helpers';

const widthOf = (locator: Locator) => locator.evaluate((element) => element.getBoundingClientRect().width);

async function freezePreview(page: Page) {
  const stage = page.locator('[data-testid="shader-lab-live-stage"]');
  await expect(stage.locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await expect(stage.locator('[data-shader-time-restoring="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume live shader motion', exact: true })).toBeVisible();
}

test('Design Lab sidebars collapse independently, preserve edits, and remember their widths', async ({ page }, info) => {
  await page.goto('/studio?tool=material&project=starter');
  await waitForStudioSource(page);
  await freezePreview(page);
  await page.getByRole('button', { name: 'Select Brand mark preview', exact: true }).click();
  const library = page.getByRole('complementary', { name: 'Shader library', exact: true });
  const inspector = page.getByRole('complementary', { name: 'Design Lab controls', exact: true });
  const workspace = page.locator('.shader-lab-v2-workspace');
  const search = library.getByRole('searchbox', { name: 'Search shaders' });

  // Infinite loading must observe the shared sidebar's actual scroll container.
  const cards = library.locator('.shader-lab-v2-material-card');
  const initialCards = await cards.count();
  await cards.first().hover();
  // Firefox limits a single wheel gesture; scroll until the sentinel is reached.
  await expect.poll(async () => {
    await page.mouse.wheel(0, 800);
    return cards.count();
  }).toBeGreaterThan(initialCards);
  await search.fill('Gem');
  await expect(library.getByRole('button', { name: 'Gem Smoke', exact: true })).toBeVisible();
  await expect.poll(() => cards.count()).toBeLessThan(initialCards);
  const source = await page.evaluate(() => window.glyphfield!.studio.readSource());

  const resizeLibrary = library.getByRole('separator', { name: 'Resize Shader library' });
  await resizeLibrary.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(resizeLibrary).toHaveAttribute('aria-valuenow', '324');
  const resizeInspector = inspector.getByRole('separator', { name: 'Resize Design Lab controls' });
  await resizeInspector.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(resizeInspector).toHaveAttribute('aria-valuenow', '324');
  const expandedWidth = await widthOf(workspace);

  await library.getByRole('button', { name: 'Collapse Shader library', exact: true }).click();
  await expect.poll(() => widthOf(library)).toBe(40);
  await expect.poll(() => widthOf(workspace)).toBeCloseTo(expandedWidth + 284, 0);
  await expect(search).toBeHidden();
  expect(await page.evaluate(() => window.glyphfield!.studio.controls().map(({ label }) => label))).not.toContain('Search shaders');
  await expect(inspector.getByRole('heading', { name: 'Brand mark', exact: true })).toBeVisible();
  const collapseInspector = inspector.getByRole('button', { name: 'Collapse Design Lab controls', exact: true });
  await collapseInspector.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => widthOf(inspector)).toBe(40);
  await expect.poll(() => widthOf(workspace)).toBeCloseTo(expandedWidth + 568, 0);
  await expect.poll(() => page.evaluate(() => window.glyphfield!.studio.readSource())).toBe(source);
  await page.screenshot({ path: info.outputPath('both-sidebars-collapsed.png') });

  await library.getByRole('button', { name: 'Expand Shader library', exact: true }).click();
  await expect(search).toHaveValue('Gem');
  await expect.poll(() => widthOf(library)).toBe(324);
  await library.getByRole('button', { name: 'Collapse Shader library', exact: true }).click();
  await page.reload();
  await waitForStudioSource(page);
  await expect(library).toHaveAttribute('data-collapsed', 'true');
  await expect(inspector).toHaveAttribute('data-collapsed', 'true');
  await library.getByRole('button', { name: 'Expand Shader library', exact: true }).click();
  await inspector.getByRole('button', { name: 'Expand Design Lab controls', exact: true }).click();
  await expect.poll(() => widthOf(library)).toBe(324);
  await expect.poll(() => widthOf(inspector)).toBe(324);
});

test('Design Lab keeps sidebars usable at midsize and stacked widths in both themes', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/studio?tool=material&project=starter');
  await waitForStudioSource(page);
  await freezePreview(page);
  await page.getByRole('button', { name: 'Select Canvas shader 1 preview', exact: true }).click();
  const library = page.getByRole('complementary', { name: 'Shader library', exact: true });
  const inspector = page.getByRole('complementary', { name: 'Design Lab controls', exact: true });
  const workspace = page.locator('.shader-lab-v2-workspace');
  await page.setViewportSize({ width: 1024, height: 1000 });
  const expandedWidth = await widthOf(workspace);
  await library.getByRole('button', { name: 'Collapse Shader library', exact: true }).click();
  await inspector.getByRole('button', { name: 'Collapse Design Lab controls', exact: true }).click();
  await expect.poll(() => widthOf(workspace)).toBeGreaterThan(expandedWidth + 350);
  await page.screenshot({ path: info.outputPath('midsize-collapsed.png') });

  await page.setViewportSize({ width: 640, height: 1000 });
  await expect(library.getByRole('searchbox', { name: 'Search shaders' })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Shader base color', exact: true })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Expand Shader library', exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.glyphfield!.studio.controls().map(({ label }) => label))).toContain('Search shaders');
  await expect.poll(() => page.locator('.shader-lab-v2-layout').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('stacked-sidebars.png') });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => widthOf(library)).toBe(40);
  await expect.poll(() => widthOf(inspector)).toBe(40);
  await library.getByRole('button', { name: 'Expand Shader library', exact: true }).click();
  await inspector.getByRole('button', { name: 'Expand Design Lab controls', exact: true }).click();
  await expect(inspector.getByRole('button', { name: 'Shader base color', exact: true })).toBeVisible();
  const lightMode = page.getByRole('button', { name: 'Switch to light mode', exact: true });
  if (await lightMode.isVisible()) await lightMode.click();
  await page.screenshot({ path: info.outputPath('expanded-light.png') });
});
