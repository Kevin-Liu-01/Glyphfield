import { expect, test, type Page } from '@playwright/test';

type NativeHarness = {
  ready: () => Promise<unknown>;
  freeze: () => { state: { engine: string }; pixels: { visibleFraction: number } };
  read: () => { comparison: { changedPixels: number } };
  pngRoundTrip: () => Promise<{ mime: string; bytes: number; comparison: { changedPixels: number } }>;
};
async function nativeReady(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { glyphfieldShaderFrames: NativeHarness }).glyphfieldShaderFrames));
  await page.evaluate(() => (window as unknown as { glyphfieldShaderFrames: NativeHarness }).glyphfieldShaderFrames.ready());
}

test.describe('native Shaders.com WebGPU materials', () => {
  test.use({ viewport: { width: 640, height: 480 } });
  test.skip(({ browserName }) => browserName !== 'chromium', 'Native GPU verification runs in Chromium; compatibility is checked separately.');

  for (const id of ['aurora', 'chrome', 'blur', 'chroma-flow']) {
    test(`${id} freezes authentic pixels and exports a lossless PNG`, async ({ page }) => {
      await page.goto(`/shader-preview?diagnostics=1&live=1&materialId=shader-effects-${id}`);
      await nativeReady(page);
      await page.mouse.move(100, 100);
      await page.mouse.down();
      await page.mouse.move(500, 360, { steps: 20 });
      await page.mouse.move(150, 260, { steps: 20 });
      await page.mouse.up();
      const frozen = await page.evaluate(() => (window as unknown as { glyphfieldShaderFrames: NativeHarness }).glyphfieldShaderFrames.freeze());
      expect(frozen.state.engine).toBe('webgpu');
      expect(frozen.pixels.visibleFraction).toBeGreaterThan(0.001);
      await page.waitForTimeout(250);
      const encoded = await page.evaluate(async () => {
        const api = (window as unknown as { glyphfieldShaderFrames: NativeHarness }).glyphfieldShaderFrames;
        return { current: api.read(), png: await api.pngRoundTrip() };
      });
      expect(encoded.current.comparison.changedPixels).toBe(0);
      expect(encoded.png).toMatchObject({ mime: 'image/png', comparison: { changedPixels: 0 } });
      expect(encoded.png.bytes).toBeGreaterThan(100);
    });
  }

  test('procedural time can seek forward and back without drifting', async ({ page }) => {
    await page.goto('/shader-preview?diagnostics=1&materialId=shader-effects-aurora');
    const result = await page.evaluate(async () => {
      type Preview = { ready: () => Promise<void>; read: () => Promise<{ pixels: { sha256: string } }>; setTime: (time: number) => Promise<void> };
      while (!(window as unknown as { glyphfieldShaderPreview?: Preview }).glyphfieldShaderPreview) await new Promise((resolve) => setTimeout(resolve, 50));
      const api = (window as unknown as { glyphfieldShaderPreview: Preview }).glyphfieldShaderPreview;
      await api.ready();
      const initial = await api.read();
      await api.setTime(3200);
      const forward = await api.read();
      await api.setTime(1600);
      return { initial, forward, restored: await api.read() };
    });
    expect(result.forward.pixels.sha256).not.toBe(result.initial.pixels.sha256);
    expect(result.restored.pixels.sha256).toBe(result.initial.pixels.sha256);
  });

  test('unsupported WebGPU is an explicit error rather than an exportable fallback', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.goto('/shader-preview?diagnostics=1&materialId=shader-effects-aurora');
    await expect(page.locator('[data-shader-effects]')).toHaveAttribute('data-live-material-ready', 'error');
    await expect(page.getByRole('status')).toContainText(/WebGPU/);
    await expect(page.locator('[data-live-material-runtime-ready]')).toHaveCount(0);
  });

  for (const id of ['liquid-metal', 'chrome', 'holographic', 'carbon-fiber']) {
    test(`${id} fills landscape and portrait canvases through resize`, async ({ page }) => {
      await page.goto(`/shader-preview?diagnostics=1&materialId=shader-effects-${id}`);
      for (const viewport of [{ width: 960, height: 320 }, { width: 320, height: 960 }]) {
        await page.setViewportSize(viewport);
        await expect.poll(async () => page.evaluate(async () => {
          const api = (window as unknown as { glyphfieldShaderPreview?: { ready: () => Promise<void> } }).glyphfieldShaderPreview;
          if (!api) return 0;
          await api.ready();
          const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-live-material-runtime-ready]');
          if (!canvas || Math.abs(canvas.width / canvas.height - innerWidth / innerHeight) > 0.01) return 0;
          const context = canvas.getContext('2d')!;
          // A demo sphere could pass a nonempty-render test. All four corners
          // and the center must contain the actual material after each resize.
          return [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98], [0.5, 0.5]]
            .filter(([x, y]) => context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data[3] > 245).length;
        })).toBe(5);
      }
    });
  }
});
