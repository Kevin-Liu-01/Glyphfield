import { expect, test, type Request } from '@playwright/test';

test('brand examples do not prefetch over hero startup and still navigate on click', async ({ page }, testInfo) => {
  const requests: Array<{ path: string; headers: Record<string, string> }> = [];
  const collect = (request: Request) => {
    const url = new URL(request.url());
    const headers = request.headers();
    if (headers.rsc !== '1' && !url.searchParams.has('_rsc')) return;
    // Keep only relevant protocol headers, not cookies or other user data.
    requests.push({ path: `${url.pathname}${url.search}`, headers: Object.fromEntries(
      Object.entries(headers).filter(([name]) => /^(rsc|next-router-.*prefetch|purpose|sec-purpose)$/.test(name))
    ) });
  };
  page.on('request', collect);
  await page.goto('/');
  const hero = page.locator('.marketing-animation-lazy-shell');
  await expect(hero.locator('.animation-studio')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] canvas')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] [data-live-material-ready="false"]')).toHaveCount(0);
  // Include the settled post-mount idle window, when Next starts queued work.
  await page.waitForTimeout(500);
  page.off('request', collect);
  await testInfo.attach('landing-rsc-prefetch', { body: JSON.stringify(requests), contentType: 'application/json' });

  const examplePrefetches = requests.filter(({ path }) => {
    const url = new URL(path, 'http://glyphfield.test');
    // No navigation has occurred yet, so all example-route RSC requests here
    // are speculative, including segment prefetches with no purpose header.
    return url.pathname === '/studio' && (url.searchParams.has('project') || url.searchParams.has('folder'));
  });
  expect(examplePrefetches).toEqual([]);

  const rail = page.locator('.marketing-v5-logo-rail');
  await expect(rail.locator('.marketing-v5-logo-rail-heading')).toHaveAttribute('href', '/studio?folder=examples');
  const brand = rail.getByTestId('brand-launch-gt');
  await expect(brand).toHaveAttribute('href', '/studio?project=gt');
  await expect(brand).toHaveAccessibleName('Open General Translation in the Studio');
  await brand.click();
  await expect(page).toHaveURL(/\/studio\?project=gt(?:&|$)/);
});
