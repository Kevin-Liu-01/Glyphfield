import { expect, test, type Page } from '@playwright/test';
import { STUDIO_TOOLS } from '../src/lib/studioCatalog';
import { waitForStudioSource } from './studio-ui-helpers';

const cases = [
  { tool: 'identity', label: 'Brand name', path: ['name'], value: 'Audit brand', action: 'identity.export.json' },
  { tool: 'brand-elements', label: 'Headline', path: ['headline'], value: 'Audit element', action: 'brand-element.export.brief' },
  { tool: 'opengraph', label: 'Headline', path: ['title'], value: 'Audit social card', action: 'opengraph.export.png' },
  { tool: 'terminal', label: 'Terminal source code', path: ['code'], value: 'const audit = "saved";', action: 'terminal.export.png' },
  { tool: 'blog', label: 'Title', path: ['title'], value: 'Audit editorial', action: 'blog.export.png' },
  { tool: 'slides', label: 'Title', path: ['title'], value: 'Audit presentation', action: 'slides.export.png' },
  { tool: 'partnership', label: 'Title', path: ['title'], value: 'Audit partnership', action: 'partnership.export.png' },
  { tool: 'buttons', label: 'Label', path: ['label'], value: 'Audit component' },
  { tool: 'colors', path: ['colors', '0', 'hex'], value: '#B85544' },
  { tool: 'typography', path: ['typography', '0', 'letterSpacing'], value: 0.04 },
  { tool: 'design-board', path: ['composition'], value: 'system', action: 'moodboard.export.png' },
  { tool: 'lottie', path: ['playback', 'speed'], value: 1.7, action: 'lottie.export.frame.png' },
];

async function readValue(page: Page, path: string[]) {
  return page.evaluate((path) => {
    const document = JSON.parse(window.glyphfield!.studio.readSource());
    const state = document.metadata?.studio?.state ?? document;
    return path.reduce((value, key) => value?.[key], state);
  }, path);
}

for (const scenario of cases) {
  test(`${scenario.tool} edits survive source reapply, export, tool navigation, and reload`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/studio?tool=${scenario.tool}&project=starter`);
    await waitForStudioSource(page);
    if (scenario.tool === 'lottie') {
      // Native load resolves the real timeline bounds and republishes source.
      await expect(page.getByRole('button', { name: 'Export frame', exact: true })).toBeEnabled();
    }
    if (scenario.label) {
      await page.getByRole('textbox', { name: scenario.label, exact: true }).fill(String(scenario.value));
    } else {
      await page.evaluate(async ({ path, value, tool }) => {
        const studio = window.glyphfield!.studio;
        const document = JSON.parse(studio.readSource());
        const state = document.metadata?.studio?.state ?? document;
        const parent = path.slice(0, -1).reduce((value, key) => value[key], state);
        parent[path.at(-1)!] = value;
        if (tool === 'design-board') state.exportPresetId = 'standard';
        await studio.applySource(document);
      }, scenario);
    }
    await waitForStudioSource(page);
    await expect.poll(() => readValue(page, scenario.path)).toBe(scenario.value);
    await page.evaluate(async () => {
      const studio = window.glyphfield!.studio;
      await studio.applySource(studio.readSource());
    });
    await waitForStudioSource(page);
    await expect.poll(() => readValue(page, scenario.path)).toBe(scenario.value);
    if (scenario.tool === 'identity' || scenario.tool === 'typography') {
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    }
    if (scenario.tool === 'lottie') {
      await expect(page.getByRole('button', { name: 'Export frame', exact: true })).toBeEnabled();
      await expect(page.getByRole('slider', { name: 'Speed', exact: true })).toHaveValue('1.7');
      await page.evaluate(() => window.glyphfield!.studio.set('Animation frame', 120));
      await expect(page.getByRole('slider', { name: 'Animation frame', exact: true })).toHaveValue('120');
    }
    if (scenario.action) {
      const artifact = await page.evaluate(async (action) => {
        const result = await window.glyphfield!.studio.invoke(action) as {
          blob: Blob; fileName: string; width?: number; height?: number;
        };
        const base = { bytes: result.blob.size, mime: result.blob.type, name: result.fileName };
        if (result.blob.type === 'application/json') {
          return { ...base, jsonKeys: Object.keys(JSON.parse(await result.blob.text())).length };
        }
        const url = URL.createObjectURL(result.blob);
        try {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
          const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 64, 64);
          const pixels = context.getImageData(0, 0, 64, 64).data;
          const colors = new Set<string>();
          for (let i = 0; i < pixels.length; i += 4) colors.add(pixels.slice(i, i + 4).join(','));
          return { ...base, dimensions: [image.naturalWidth, image.naturalHeight],
            declared: [result.width, result.height], colors: colors.size };
        } finally { URL.revokeObjectURL(url); }
      }, scenario.action);
      expect(artifact.bytes).toBeGreaterThan(100);
      if ('jsonKeys' in artifact) {
        expect(artifact.jsonKeys).toBeGreaterThan(0);
        expect(artifact.name).toMatch(/\.json$/);
      } else {
        expect(artifact.mime).toBe('image/png');
        expect(artifact.name).toMatch(/\.png$/);
        expect(artifact.dimensions).toEqual(artifact.declared);
        expect(artifact.colors).toBeGreaterThan(1);
      }
      await info.attach('artifact', { contentType: 'application/json', body: JSON.stringify(artifact) });
      const dialog = page.getByRole('dialog', { name: /export preview$/ });
      await expect(dialog).toBeVisible();
      await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      const close = dialog.getByRole('button', { name: 'Close export preview', exact: true }).last();
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: /^Download / })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    } else if (scenario.tool === 'colors') {
      const tokens = await page.evaluate(() => window.glyphfield!.studio.invoke('colors.tokens.read'));
      expect(tokens).toContain('oklch(');
    }
    // Exercise retained workspace ownership, then persisted state on reload.
    await page.locator('.studio-nav').getByRole('button', { name: 'Brand book', exact: true }).click();
    await page.locator('.studio-nav').getByRole('button', { name: STUDIO_TOOLS.find(({ id }) => id === scenario.tool)!.name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.glyphfield!.studio.activeTool())).toBe(scenario.tool);
    await waitForStudioSource(page);
    await expect.poll(() => readValue(page, scenario.path)).toBe(scenario.value);
    await page.reload();
    await waitForStudioSource(page);
    await expect.poll(() => readValue(page, scenario.path)).toBe(scenario.value);
    expect(errors).toEqual([]);
  });
}

test('Browser API values commit to controlled text fields and sliders', async ({ page }) => {
  await page.goto('/studio?tool=terminal&project=starter');
  await waitForStudioSource(page);
  await page.evaluate(() => window.glyphfield!.studio.set('Terminal source code', 'const committed = true;'));
  await expect.poll(() => readValue(page, ['code'])).toBe('const committed = true;');
  await page.locator('.studio-nav').getByRole('button', { name: 'Lottie', exact: true }).click();
  await waitForStudioSource(page);
  for (const speed of [1.5, 2]) {
    await page.evaluate((speed) => window.glyphfield!.studio.set('Speed', speed), speed);
    await expect.poll(() => readValue(page, ['playback', 'speed'])).toBe(speed);
  }
});

test('Lottie exports its initial frame and a nonblank sought frame without waiting for another playback tick', async ({ page }) => {
  await page.goto('/studio?tool=lottie&project=starter');
  await waitForStudioSource(page);
  await expect(page.getByRole('button', { name: 'Export frame', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible();
  for (const frame of [0, 120]) {
    const playhead = page.getByRole('slider', { name: 'Animation frame', exact: true });
    await playhead.press(frame === 0 ? 'Home' : 'End');
    if (frame > 0) await page.evaluate((frame) => window.glyphfield!.studio.set('Animation frame', frame), frame);
    await expect(page.getByRole('slider', { name: 'Animation frame', exact: true })).toHaveValue(String(frame));
    await expect(playhead).toHaveAttribute('value', String(frame));
    const result = await page.evaluate(async () => {
      const asset = await window.glyphfield!.studio.invoke('lottie.export.frame.png') as { blob: Blob; fileName: string };
      const url = URL.createObjectURL(asset.blob);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 40;
        const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 64, 40);
        const pixels = context.getImageData(0, 0, 64, 40).data;
        const colors = new Set<string>();
        for (let index = 0; index < pixels.length; index += 4) colors.add(pixels.slice(index, index + 4).join(','));
        return { bytes: asset.blob.size, mime: asset.blob.type, name: asset.fileName,
          dimensions: [image.naturalWidth, image.naturalHeight], colors: colors.size };
      } finally { URL.revokeObjectURL(url); }
    });
    expect(result.bytes).toBeGreaterThan(100);
    expect(result.mime).toBe('image/png');
    expect(result.name).toContain(`frame-${frame}.png`);
    expect(result.dimensions).toEqual([1200, 750]);
    if (frame > 0) expect(result.colors).toBeGreaterThan(4);
    const dialog = page.getByRole('dialog', { name: 'PNG export preview', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('Brand book reading and print preparation include every page and restore the reader', async ({ page, browserName }, info) => {
  await page.goto('/studio?tool=brand-book&project=starter');
  const overview = page.locator('section[id^="brand-book-starter-"] > button');
  await expect(overview.first()).toBeVisible();
  const pageCount = await overview.count();
  expect(pageCount).toBeGreaterThan(10);
  await overview.first().click();
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeEnabled();
  const preparedPages = await page.evaluate(() => new Promise<number>((resolve) => {
    window.print = () => resolve(document.querySelectorAll('section[id^="brand-book-starter-"] > button').length);
    void window.glyphfield!.studio.invoke('brand-book.print');
  }));
  expect(preparedPages).toBe(pageCount);
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeVisible();
  if (browserName === 'chromium') {
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(overview).toHaveCount(pageCount);
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    await info.attach('brand-book.pdf', { body: pdf, contentType: 'application/pdf' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(pageCount);
  }
});
