import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

type Theme = 'dark' | 'light';
type ThemePaint = { background: string; color: string; rootDark: boolean; rootLight: boolean };
type ThemeContentPaint = {
  theme: Theme; background: string; heroColor: string; headerBackground: string;
  navigationColor: string; primaryColor: string; primaryBackground: string;
};
const palette = {
  dark: { background: 'rgb(17, 17, 17)', color: 'rgb(240, 240, 237)', browserColor: '#121212' },
  light: { background: 'rgb(251, 251, 249)', color: 'rgb(24, 24, 24)', browserColor: '#f8f8f5' },
};

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const browserDiagnostics = new WeakMap<BrowserContext, { kind: string; message: string }[]>();
const hydrationError = /hydrat(?:ion|ing|ed)|minified react error #(?:418|419|421|422|423|425)/i;

test.beforeEach(({ context }) => {
  const messages: { kind: string; message: string }[] = [];
  browserDiagnostics.set(context, messages);
  const observe = (page: Page) => {
    page.on('pageerror', (error) => messages.push({ kind: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        messages.push({ kind: message.type(), message: message.text() });
      }
    });
  };
  context.pages().forEach(observe);
  context.on('page', observe);
});

test.afterEach(async ({ context }, testInfo) => {
  const messages = browserDiagnostics.get(context) ?? [];
  await testInfo.attach('browser-diagnostics', { body: JSON.stringify(messages, null, 2), contentType: 'application/json' });
  expect(messages.filter(({ message }) => hydrationError.test(message)), 'No hydration errors or mismatched attributes').toEqual([]);
});

async function themeSnapshot(page: Page) {
  return page.evaluate(() => {
    const landing = document.querySelector('.marketing-page-v5');
    const header = document.querySelector('.marketing-v5-header');
    if (!landing || !header) throw new Error('Landing theme surfaces are missing');
    return {
      rootClass: document.documentElement.className,
      rootMarketingTheme: document.documentElement.getAttribute('data-marketing-theme'),
      landingTheme: landing.getAttribute('data-marketing-theme'),
      landingBackground: getComputedStyle(landing).backgroundColor,
      landingColor: getComputedStyle(landing).color,
      headerBackground: getComputedStyle(header).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      themeColors: Array.from(document.querySelectorAll('meta[name="theme-color"]'), (meta) => meta.getAttribute('content')),
      nativeDark: matchMedia('(prefers-color-scheme: dark)').matches,
      readyState: document.readyState,
    };
  });
}

async function startThemePaintProbe(page: Page) {
  await page.evaluate(() => {
    const frames: ThemePaint[] = [];
    let frame = 0;
    const sample = () => {
      const landing = document.querySelector('.marketing-page-v5');
      if (landing) frames.push({ background: getComputedStyle(landing).backgroundColor, color: getComputedStyle(landing).color,
        rootDark: document.documentElement.classList.contains('dark'), rootLight: document.documentElement.classList.contains('light') });
      frame = requestAnimationFrame(sample);
    };
    Reflect.set(window, '__glyphfieldThemePaintProbe', { frames, stop: () => cancelAnimationFrame(frame) });
    sample();
  });
}

async function stopThemePaintProbe(page: Page): Promise<ThemePaint[]> {
  return page.evaluate(() => {
    const probe = Reflect.get(window, '__glyphfieldThemePaintProbe') as { frames: ThemePaint[]; stop: () => void } | undefined;
    probe?.stop();
    Reflect.deleteProperty(window, '__glyphfieldThemePaintProbe');
    return probe?.frames ?? [];
  });
}

async function waitForLandingHydration(page: Page) {
  await page.waitForFunction(() => Boolean(document.querySelector('[data-motion-state="visible"]')));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inspectLandingBoot(page: Page, testInfo: TestInfo, label: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let blockedChunks = 0;
  const chunks = /\/_next\/static\/.*\.js(?:\?.*)?$/;
  const handler = async (route: import('@playwright/test').Route) => {
    blockedChunks += 1;
    await gate;
    await route.continue();
  };
  await page.route(chunks, handler);
  try {
    // Holding async chunks can postpone DOMContentLoaded. Inline bootstrap,
    // streamed server HTML, stylesheets, and native media queries remain real.
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('.marketing-page-v5').waitFor({ state: 'attached' });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.marketing-page-v5')!).getPropertyValue('--marketing-v5-paper').trim())).not.toBe('');
    await expect.poll(() => blockedChunks).toBeGreaterThan(0);
    const beforeHydration = await themeSnapshot(page);
    await testInfo.attach(`${label}-before-hydration`, { body: JSON.stringify({ blockedChunks, ...beforeHydration }, null, 2), contentType: 'application/json' });
    console.log(JSON.stringify({ themeFirstPaint: label, blockedChunks, beforeHydration }));
    await startThemePaintProbe(page);
    release();
    await page.waitForLoadState('domcontentloaded');
    await waitForLandingHydration(page);
    const hydrationPaints = await stopThemePaintProbe(page);
    const afterHydration = await themeSnapshot(page);
    await testInfo.attach(`${label}-after-hydration`, { body: JSON.stringify(afterHydration, null, 2), contentType: 'application/json' });
    console.log(JSON.stringify({ themeFirstPaint: label, afterHydration }));
    await testInfo.attach(`${label}-hydration-paints`, { body: JSON.stringify(hydrationPaints, null, 2), contentType: 'application/json' });
    return { beforeHydration, afterHydration, hydrationPaints };
  } finally {
    release();
    await stopThemePaintProbe(page);
    await page.unroute(chunks, handler);
  }
}

function expectTheme(snapshot: Awaited<ReturnType<typeof themeSnapshot>>, theme: Theme) {
  expect.soft(snapshot.rootClass.split(/\s+/)).toContain(theme);
  expect.soft(snapshot.landingBackground).toBe(palette[theme].background);
  expect.soft(snapshot.headerBackground).toBe(palette[theme].background);
  expect.soft(snapshot.landingColor).toBe(palette[theme].color);
  expect.soft(snapshot.themeColors, 'Exactly one browser theme color matches the resolved theme').toEqual([palette[theme].browserColor]);
}

function expectStableBoot(snapshots: Awaited<ReturnType<typeof inspectLandingBoot>>, theme: Theme) {
  expectTheme(snapshots.beforeHydration, theme);
  expectTheme(snapshots.afterHydration, theme);
  expect.soft(snapshots.hydrationPaints.length).toBeGreaterThan(0);
  expect.soft(snapshots.hydrationPaints.filter((paint) => paint.background !== palette[theme].background
    || paint.color !== palette[theme].color || !paint[theme === 'dark' ? 'rootDark' : 'rootLight']),
  'No frame may paint the opposite theme during hydration').toEqual([]);
}

async function expectLandingTheme(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:\\s|$)`));
  await expect(page.locator('.marketing-page-v5')).toHaveCSS('background-color', palette[theme].background);
  await expect(page.locator('.marketing-page-v5')).toHaveCSS('color', palette[theme].color);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', palette[theme].browserColor);
}

for (const theme of ['dark', 'light'] as const) {
  test(`fresh native ${theme} landing paints correctly before and after hydration`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    const snapshots = await inspectLandingBoot(page, testInfo, theme);
    expectStableBoot(snapshots, theme);
  });
}

test('a fresh landing follows native system preference changes without an override', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await waitForLandingHydration(page);
  await expectLandingTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectLandingTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLandingTheme(page, 'dark');
});

test('a real landing override survives system changes, docs, Studio, and reload first paint', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await waitForLandingHydration(page);
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await expectLandingTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLandingTheme(page, 'light');
  expectStableBoot(await inspectLandingBoot(page, testInfo, 'saved-light'), 'light');
  await page.getByRole('link', { name: 'Open documentation', exact: true }).click();
  await expect(page).toHaveURL(/\/docs(?:\/|$)/);
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await page.goto('/studio?tool=identity');
  await expect(page.getByRole('button', { name: 'Visual customization', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await page.goto('/');
  await waitForLandingHydration(page);
  await expectLandingTheme(page, 'light');
});

test('Studio theme controls share the preference and Auto restores native following across routes', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/studio?tool=identity');
  await page.getByRole('button', { name: 'Visual customization', exact: true }).click();
  const appearance = page.getByRole('region', { name: 'Visual customization', exact: true });
  await appearance.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(appearance.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  expectStableBoot(await inspectLandingBoot(page, testInfo, 'studio-dark'), 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectLandingTheme(page, 'dark');
  await page.goto('/studio?tool=identity');
  await page.getByRole('button', { name: 'Visual customization', exact: true }).click();
  await appearance.getByRole('button', { name: 'Auto', exact: true }).click();
  await expect(appearance.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  expectStableBoot(await inspectLandingBoot(page, testInfo, 'reset-system-dark'), 'dark');
});

test('blocked local storage still paints the native theme and permits an in-memory UI override', async ({ page }, testInfo) => {
  // Model a browser privacy restriction; do not populate or alter app state.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() {
      throw new DOMException('Storage is unavailable in this browser context', 'SecurityError');
    } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  expectStableBoot(await inspectLandingBoot(page, testInfo, 'blocked-storage-dark'), 'dark');
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await expectLandingTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectLandingTheme(page, 'light');
  // With storage blocked, only this document's explicit choice can persist.
  expectStableBoot(await inspectLandingBoot(page, testInfo, 'blocked-storage-reload'), 'dark');
});

test('theme choices made through real controls synchronize between open landing and docs pages', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await waitForLandingHydration(page);
  const docs = await context.newPage();
  try {
    await docs.emulateMedia({ colorScheme: 'dark' });
    await docs.goto('/docs');
    const docsToggle = docs.getByRole('navigation', { name: 'Documentation controls', exact: true })
      .getByRole('button', { name: 'Toggle color theme', exact: true });
    await expect(docsToggle).toBeVisible();
    await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
    await expectLandingTheme(page, 'light');
    await expect(docs.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
    await docsToggle.click();
    await expect(docs.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
    await expectLandingTheme(page, 'dark');
  } finally {
    await docs.close();
  }
});

test('mobile docs navigation exposes a working shared theme toggle without an inert vendor control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/docs');
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  await page.getByRole('button', { name: 'Open documentation navigation', exact: true }).click();
  const navigation = page.locator('#nd-sidebar-mobile');
  await expect(navigation).toBeVisible();
  await expect(page.locator('[data-theme-toggle]')).toHaveCount(0);
  const themeToggle = navigation.locator('.glyphfield-docs-sidebar-footer')
    .getByRole('button', { name: 'Toggle color theme', exact: true });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', palette.light.browserColor);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await navigation.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await waitForLandingHydration(page);
  await expectLandingTheme(page, 'light');
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await expectLandingTheme(page, 'dark');
  await page.goto('/docs');
  await page.getByRole('button', { name: 'Open documentation navigation', exact: true }).click();
  await expect(themeToggle).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  await themeToggle.click();
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)light(?:\s|$)/);
});

test('real theme clicks update hero, header, and primary-link colors atomically in both directions', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.goto('/');
  await waitForLandingHydration(page);
  await expectLandingTheme(page, 'dark');
  const transitions: ThemeContentPaint[][] = [];
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(() => {
      const landing = document.querySelector('.marketing-page-v5')!;
      const hero = document.querySelector('.marketing-v5-hero h1')!;
      const header = document.querySelector('.marketing-v5-header')!;
      const navigation = document.querySelector('.marketing-v5-nav a')!;
      const primary = document.querySelector('.marketing-v5-header .marketing-v5-primary-link')!;
      const frames: ThemeContentPaint[] = [];
      let frame = 0;
      const sample = () => {
        frames.push({
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          background: getComputedStyle(landing).backgroundColor,
          heroColor: getComputedStyle(hero).color,
          headerBackground: getComputedStyle(header).backgroundColor,
          navigationColor: getComputedStyle(navigation).color,
          primaryColor: getComputedStyle(primary).color,
          primaryBackground: getComputedStyle(primary).backgroundColor,
        });
        frame = requestAnimationFrame(sample);
      };
      Reflect.set(window, '__glyphfieldThemeContentProbe', { frames, stop: () => cancelAnimationFrame(frame) });
      sample();
    });
    await page.getByRole('button', { name: `Use ${theme} theme`, exact: true }).click();
    // Sample the entire 150ms color transition plus settled frames. This is a
    // diagnostic rAF observer, not a mutation of the application's state.
    const frames = await page.evaluate(async () => {
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const settle = () => performance.now() - start >= 350 ? resolve() : requestAnimationFrame(settle);
        requestAnimationFrame(settle);
      });
      const probe = Reflect.get(window, '__glyphfieldThemeContentProbe') as { frames: ThemeContentPaint[]; stop: () => void };
      probe.stop();
      Reflect.deleteProperty(window, '__glyphfieldThemeContentProbe');
      return probe.frames;
    });
    transitions.push(frames);
    await testInfo.attach(`real-click-to-${theme}-paints`, { body: JSON.stringify(frames, null, 2), contentType: 'application/json' });
    await expectLandingTheme(page, theme);
  }
  const settled = {
    light: transitions[0].at(-1)!,
    dark: transitions[1].at(-1)!,
  };
  for (const theme of ['dark', 'light'] as const) {
    expect.soft(settled[theme].heroColor).toBe(palette[theme].color);
    expect.soft(settled[theme].background).toBe(palette[theme].background);
  }
  const mismatches = transitions.flat().filter((paint) => JSON.stringify(paint) !== JSON.stringify(settled[paint.theme]));
  console.log(JSON.stringify({ themeClickPaintMismatches: mismatches }));
  expect(mismatches, 'Every painted frame must use one complete theme, including actual text and button colors').toEqual([]);
});
