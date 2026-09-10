import { expect, test, type Page } from '@playwright/test';
import { gemSmokePresets } from '@paper-design/shaders-react';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { getPaperLiveMaterialDefinition, liveMaterialMotionRate } from '../src/lib/liveMaterials';
import { resolvePaperShaderFrame } from '../src/lib/paperShaderTime';

type ShaderFixture = { id: string; data: { materialId: string; frameState?: unknown; frameSnapshot?: { assetId: string } } };

// Author a single real default-provider shader through the public source API.
// No mocked canvas, intercepted renderer, persisted-store writes, or React access.
async function prepareShader(page: Page, options: { materialId?: string; timeMs?: number; grain?: number; paused?: boolean } = {}) {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Open export settings', exact: true }).waitFor();
  // The toolbar can be interactive before portable assets finish hydrating.
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  const fixture = await page.evaluate(async ({ materialId, timeMs, grain, paused }) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const shader = (Object.values(source.elements) as ShaderFixture[]).find((element) => source.elements[element.id].kind === 'shader')!;
    if (!shader) throw new Error('Design Lab default shader missing');
    if (materialId) shader.data.materialId = materialId;
    if (grain !== undefined) source.elements[shader.id].data.settings.grain = grain;
    delete shader.data.frameState;
    delete shader.data.frameSnapshot;
    source.elements = { [shader.id]: source.elements[shader.id] };
    const board = source.pages[source.pageIds[0]];
    Object.assign(board, { width: 1600, height: 900, background: '#101010', elementIds: [shader.id] });
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline = { ...design.timeline, paused: paused ?? false, timeMs: timeMs ?? 1250 };
    design.exportSettings = { ...design.exportSettings, width: 640, durationMs: 1600, fps: 12, quality: 'balanced', gifLoop: 'raw' };
    design.layerShaders = {};
    design.groups = [];
    design.shaderSequence.targetLayerId = null;
    const active = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(active.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide', backgroundColor: '#101010',
      layerOrder: [shader.id], shaderLayers: [shader.data], logos: [], textLayers: [], effectLayers: [], assets: [],
      layerShaders: {}, groups: [], timeline: design.timeline, shaderSequence: design.shaderSequence });
    design.workspace.artboards = [active];
    await studio.applySource(source);
    return { shaderId: shader.id, materialId: shader.data.materialId };
  }, options);
  const surface = page.locator(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${fixture.shaderId}"]`);
  await expect(surface.locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await expect(surface.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-shader-time-restoring="true"]')).toHaveCount(0);
  // Dithering is intentionally a two-color raster, not an empty preview.
  await expect.poll(async () => (await pixels(page, fixture.shaderId)).colors).toBeGreaterThan(fixture.materialId === 'paper-dithering' ? 1 : 4);
  return fixture;
}

async function pixels(page: Page, id: string) {
  return page.evaluate((id) => {
    const surface = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"]`)!;
    const image = surface.querySelector<HTMLImageElement>('[data-shader-frame-ready="true"] [data-shader-frame-image]');
    const native = surface.querySelector<HTMLCanvasElement>('canvas');
    const input = image?.complete && image.naturalWidth ? image : native;
    if (!input) throw new Error('No native or captured shader pixels');
    const width = input instanceof HTMLImageElement ? input.naturalWidth : input.width;
    const height = input instanceof HTMLImageElement ? input.naturalHeight : input.height;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(input, 0, 0);
    const bytes = context.getImageData(0, 0, width, height).data;
    let hash = 2166136261;
    const colors = new Set<number>();
    for (let index = 0; index < bytes.length; index += 1) hash = Math.imul(hash ^ bytes[index], 16777619);
    for (let index = 0; index < bytes.length && colors.size < 64; index += 4) {
      colors.add((bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2]);
    }
    return { width, height, hash: hash >>> 0, colors: colors.size, frozenImage: input instanceof HTMLImageElement };
  }, id);
}

async function state(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const studio = window.glyphfield!.studio;
    const deadline = performance.now() + 10_000;
    let rawSource: string;
    for (;;) {
      try { rawSource = studio.readSource(); break; }
      catch (error) {
        if (!(error instanceof Error) || error.message !== 'Portable composition code is still being prepared.'
          || performance.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    const source = JSON.parse(rawSource);
    const shader = source.elements[id];
    const motion = await studio.invoke('design.motion.describe') as { paused: boolean; timeMs: number };
    return { motion, timeline: source.metadata.designLab.timeline, sequence: source.metadata.designLab.shaderSequence,
      exportSettings: source.metadata.designLab.exportSettings,
      shaderSpeed: shader.data.settings.speed as number,
      snapshot: shader.data.frameSnapshot ?? null, frame: shader.data.frameState ?? null,
      asset: source.assets[shader.data.frameSnapshot?.assetId]?.source ?? null,
      assetIds: Object.keys(source.assets), rangeMax: document.querySelector<HTMLInputElement>('[aria-label="Explore shader time"]')?.max };
  }, id);
}

async function exportStill(page: Page, shaderId: string, format: 'png' | 'jpg', includeBytes = false) {
  return page.evaluate(async ({ shaderId, format, includeBytes }) => {
    const studio = window.glyphfield!.studio;
    const artifact = await studio.invoke('design.export', { format, download: false }) as { blob: Blob; fileName: string };
    if (!(artifact.blob instanceof Blob) || !artifact.blob.size) throw new Error('Export returned no image bytes');
    const image = new Image();
    const url = URL.createObjectURL(artifact.blob);
    try {
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      // Match the export compositor's accelerated scaling, not CPU rounding.
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const actual = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (const byte of actual) hash = Math.imul(hash ^ byte, 16777619);
      const source = JSON.parse(studio.readSource());
      const assetId = source.elements[shaderId].data.frameSnapshot?.assetId;
      let meanRgbError: number | null = null;
      if (assetId) {
        const frozen = new Image();
        frozen.src = source.assets[assetId].source;
        await frozen.decode();
        context.fillStyle = source.pages[source.pageIds[0]].background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(frozen, 0, 0, canvas.width, canvas.height);
        const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0;
        for (let index = 0; index < actual.length; index += 4) {
          total += Math.abs(actual[index] - expected[index]) + Math.abs(actual[index + 1] - expected[index + 1])
            + Math.abs(actual[index + 2] - expected[index + 2]);
        }
        meanRgbError = total / (canvas.width * canvas.height * 3);
      }
      const dataUrl = includeBytes ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error); reader.readAsDataURL(artifact.blob);
      }) : null;
      return { mime: artifact.blob.type, fileName: artifact.fileName, bytes: artifact.blob.size, dataUrl,
        width: canvas.width, height: canvas.height, hash: hash >>> 0, meanRgbError };
    } finally { URL.revokeObjectURL(url); }
  }, { shaderId, format, includeBytes });
}

async function closeExport(page: Page) {
  await page.locator('header').getByRole('button', { name: 'Close export preview', exact: true }).click();
}

test.beforeEach(async ({ browser, page }, testInfo) => {
  testInfo.annotations.push({ type: 'browser-version', description: browser.version() });
  // Passive diagnostics retain original browser failures that the UI may wrap.
  // Every native operation still receives its original arguments and receiver.
  await page.addInitScript(() => {
    const errors: { operation: string; name?: string; message?: string; stack?: string }[] = [];
    Object.defineProperty(document, '__shaderBrowserErrors', { value: errors });
    const record = (operation: string, error: unknown) => {
      const detail = error as { name?: string; message?: string; stack?: string };
      errors.push({ operation, name: detail?.name, message: detail?.message, stack: detail?.stack });
    };
    const wrap = (prototype: object | undefined, method: string, request = false) => {
      if (!prototype) return;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
      if (!descriptor || typeof descriptor.value !== 'function') return;
      const original = descriptor.value;
      Object.defineProperty(prototype, method, { ...descriptor, value: function (this: unknown, ...args: unknown[]) {
        try {
          const result = Reflect.apply(original, this, args);
          if (request && result instanceof IDBRequest) result.addEventListener('error', () => record(method, result.error));
          return result;
        } catch (error) { record(method, error); throw error; }
      } });
    };
    for (const method of ['toBlob', 'toDataURL']) wrap(HTMLCanvasElement.prototype, method);
    for (const method of ['getImageData', 'drawImage', 'createPattern']) wrap(CanvasRenderingContext2D.prototype, method);
    wrap(IDBFactory.prototype, 'open', true);
    wrap(IDBDatabase.prototype, 'transaction');
    wrap(IDBObjectStore.prototype, 'put', true);
    wrap(IDBObjectStore.prototype, 'get', true);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  await page.evaluate(() => (document as Document & { __restoreTransientCaptureTrace?: () => void })
    .__restoreTransientCaptureTrace?.()).catch(() => {});
  const nativeErrors = await page.evaluate(() => ({
    errors: (document as Document & { __shaderBrowserErrors: unknown }).__shaderBrowserErrors,
    environment: { origin: location.origin, secure: isSecureContext, visibility: document.visibilityState,
      focused: document.hasFocus(), userAgent: navigator.userAgent },
    alerts: Array.from(document.querySelectorAll('[role="alert"]'), (node) => node.textContent),
  })).catch(() => null);
  await testInfo.attach('native-shader-browser-errors', { body: JSON.stringify(nativeErrors, null, 2), contentType: 'application/json' });
  if (testInfo.status !== testInfo.expectedStatus) console.log(JSON.stringify({ nativeShaderErrors: nativeErrors }));
});

test('shader pause freezes native pixels without adding saved frames', async ({ page }) => {
  const { shaderId } = await prepareShader(page);
  const before = await state(page, shaderId);
  await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
  await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(true);
  const paused = await state(page, shaderId);
  const first = await pixels(page, shaderId);
  await page.waitForTimeout(450);
  expect(await pixels(page, shaderId)).toEqual(first);
  expect((await state(page, shaderId)).motion).toEqual(paused.motion);
  expect(paused.assetIds).toEqual(before.assetIds);
  expect(paused.sequence).toEqual(before.sequence);
  expect(paused.snapshot).toBeNull();
});

test('live to PNG export freezes the selected look and never resumes behind the preview', async ({ page }, testInfo) => {
  const { shaderId } = await prepareShader(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const encodes: Promise<{ width: number; height: number; kind: string; bytes: number; encodedHash: number }>[] = [];
    Object.defineProperty(document, '__transientCaptureTrace', { value: encodes });
    Object.defineProperty(document, '__restoreTransientCaptureTrace', {
      value: () => { HTMLCanvasElement.prototype.toBlob = original; },
    });
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const native = document.querySelector<HTMLCanvasElement>('[data-testid="shader-lab-live-stage"] canvas');
      const width = this.width; const height = this.height;
      const kind = width === native?.width && height === native?.height ? 'raw-shader-copy' : 'composed-output';
      return original.call(this, (blob) => {
        // Preserve original callback delivery. Byte hashing is a sidecar read;
        // it never substitutes or redraws the actual captured shader buffer.
        callback(blob);
        if (blob?.type === 'image/png') encodes.push(blob.arrayBuffer().then((buffer) => {
          let hash = 2166136261;
          for (const byte of new Uint8Array(buffer)) hash = Math.imul(hash ^ byte, 16777619);
          return { width, height, kind, bytes: blob.size, encodedHash: hash >>> 0 };
        }));
      }, type, quality);
    };
  });
  const rasterLayout = () => page.evaluate((id) => {
    const surface = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"]`)!;
    const canvas = surface.querySelector('canvas');
    const bounds = canvas?.getBoundingClientRect();
    return { width: canvas?.width, height: canvas?.height, bounds: bounds?.toJSON(),
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.clientWidth } };
  }, shaderId);
  const before = await state(page, shaderId);
  const beforeLayout = await rasterLayout();
  const first = await exportStill(page, shaderId, 'png', true);
  const after = await state(page, shaderId);
  const firstNative = await pixels(page, shaderId);
  const firstLayout = await rasterLayout();
  await testInfo.attach('live-still-export', { body: JSON.stringify({ first: { ...first, dataUrl: undefined }, before: before.motion, after: after.motion }), contentType: 'application/json' });
  expect(first.mime).toBe('image/png');
  expect(first.fileName).toMatch(/\.png$/);
  expect(first.width).toBe(640); expect(first.height).toBe(360);
  expect(after.motion.paused).toBe(true);
  await page.waitForTimeout(450);
  const settledNative = await pixels(page, shaderId);
  const settledLayout = await rasterLayout();
  expect((await state(page, shaderId)).motion).toEqual(after.motion);
  expect(after.assetIds).toEqual(before.assetIds);
  expect(after.sequence).toEqual(before.sequence);
  await closeExport(page);
  const beforeSecond = await state(page, shaderId);
  const closedLayout = await rasterLayout();
  const closedNative = await pixels(page, shaderId);
  const second = await exportStill(page, shaderId, 'png', true);
  const difference = await page.evaluate(async ([firstUrl, secondUrl]) => {
    const images = await Promise.all([firstUrl, secondUrl].map(async (url) => {
      const image = new Image(); image.src = url!; await image.decode(); return image;
    }));
    const canvas = document.createElement('canvas'); canvas.width = images[0].naturalWidth; canvas.height = images[0].naturalHeight;
    const context = canvas.getContext('2d')!;
    const buffers = images.map((image) => { context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
    let total = 0; let mismatchPixels = 0;
    for (let index = 0; index < buffers[0].length; index += 4) {
      const error = Math.abs(buffers[0][index] - buffers[1][index]) + Math.abs(buffers[0][index + 1] - buffers[1][index + 1])
        + Math.abs(buffers[0][index + 2] - buffers[1][index + 2]);
      total += error; if (error) mismatchPixels += 1;
    }
    return { meanRgbError: total / (canvas.width * canvas.height * 3), mismatchPixels };
  }, [first.dataUrl, second.dataUrl]);
  for (const [name, output] of [['first-live.png', first], ['second-paused.png', second]] as const) {
    await writeFile(testInfo.outputPath(name), Buffer.from(output.dataUrl!.split(',')[1], 'base64'));
  }
  await testInfo.attach('live-still-repeat', { body: JSON.stringify({
    first: { ...first, dataUrl: undefined }, second: { ...second, dataUrl: undefined }, difference,
    firstNative, settledNative, closedNative, after, beforeSecond,
    beforeLayout, firstLayout, settledLayout, closedLayout, secondLayout: await rasterLayout(),
    secondNative: await pixels(page, shaderId), afterSecond: await state(page, shaderId),
  }), contentType: 'application/json' });
  await testInfo.attach('raw-and-composed-png-encodes', { body: JSON.stringify(await page.evaluate(() =>
    Promise.all((document as Document & { __transientCaptureTrace: Promise<unknown>[] }).__transientCaptureTrace))), contentType: 'application/json' });
  expect(second.hash).toBe(first.hash);
});

test('Review export encodes a live PNG once and refreshes only when export settings change', async ({ page }, testInfo) => {
  const { shaderId } = await prepareShader(page);
  await page.evaluate(() => {
    const prototype = HTMLCanvasElement.prototype;
    const original = prototype.toBlob;
    const events: { width: number; height: number; type: string; completed: boolean }[] = [];
    Object.defineProperty(document, '__outputEncodes', { value: events });
    Object.defineProperty(document, '__restoreOutputEncodes', { value: () => { prototype.toBlob = original; } });
    prototype.toBlob = function (callback, type, quality) {
      const event = { width: this.width, height: this.height, type: type ?? 'image/png', completed: false };
      events.push(event);
      return original.call(this, (blob) => { event.completed = true; callback(blob); }, type, quality);
    };
  });
  const outputEncodes = () => page.evaluate(() =>
    (document as Document & { __outputEncodes: { width: number; height: number; completed: boolean }[] })
      .__outputEncodes.filter(({ width, height }) => (width === 640 && height === 360) || (width === 800 && height === 450)));
  try {
    await page.getByRole('button', { name: 'Open export settings', exact: true }).click();
    const preview = page.getByRole('img', { name: 'PNG export preview', exact: true });
    await expect(preview).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
    const firstUrl = await preview.getAttribute('src');
    // The shared Review dialog's settings-refresh debounce is400ms. Observe
    // beyond it so a hidden second encode cannot pass as the first request.
    await page.waitForTimeout(900);
    expect(await outputEncodes()).toEqual([{ width: 640, height: 360, type: 'image/png', completed: true }]);
    expect(await preview.getAttribute('src')).toBe(firstUrl);
    expect((await state(page, shaderId)).motion.paused).toBe(true);

    await page.getByRole('spinbutton', { name: 'Export width in pixels', exact: true }).fill('800');
    await expect.poll(async () => preview.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(800);
    await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
    await page.waitForTimeout(900);
    expect(await outputEncodes()).toEqual([
      { width: 640, height: 360, type: 'image/png', completed: true },
      { width: 800, height: 450, type: 'image/png', completed: true },
    ]);
    expect(await preview.getAttribute('src')).not.toBe(firstUrl);
  } finally {
    await testInfo.attach('review-output-encodes', { body: JSON.stringify(await outputEncodes()), contentType: 'application/json' });
    await page.evaluate(() => (document as Document & { __restoreOutputEncodes: () => void }).__restoreOutputEncodes());
  }
});

test('explicit shader capture survives named save and reload with identical PNG pixels', async ({ page }) => {
  const { shaderId } = await prepareShader(page);
  await page.getByRole('button', { name: 'Capture shader frame', exact: true }).click();
  await expect.poll(async () => (await state(page, shaderId)).asset).toMatch(/^data:image\/png;base64,/);
  await expect.poll(async () => (await pixels(page, shaderId)).frozenImage).toBe(true);
  const captured = await state(page, shaderId);
  const first = await pixels(page, shaderId);
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Design saved', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Explore shader time', exact: true })).toBeVisible();
  await expect(page.locator(`[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`)).toBeVisible();
  await expect.poll(async () => (await pixels(page, shaderId)).frozenImage).toBe(true);
  const restored = await state(page, shaderId);
  expect(restored.asset).toBe(captured.asset);
  expect(restored.snapshot).toEqual(captured.snapshot);
  expect(restored.motion).toEqual(captured.motion);
  expect(await pixels(page, shaderId)).toEqual(first);
});

test('captured shader PNG and JPG downloads preserve the same selected frame', async ({ page }, testInfo) => {
  const { shaderId } = await prepareShader(page, { materialId: 'holo-cloth-silk' });
  await page.getByRole('button', { name: 'Capture shader frame', exact: true }).click();
  await expect.poll(async () => (await state(page, shaderId)).asset).toMatch(/^data:image\/png;base64,/);
  const captured = await state(page, shaderId);
  for (const format of ['png', 'jpg'] as const) {
    const first = await exportStill(page, shaderId, format);
    expect(first.mime).toBe(format === 'png' ? 'image/png' : 'image/jpeg');
    expect(first.fileName).toMatch(new RegExp(`\\.${format}$`));
    expect(first.width).toBe(640); expect(first.height).toBe(360);
    expect(first.meanRgbError).not.toBeNull();
    if (format === 'png') expect(first.meanRgbError).toBe(0);
    else expect(first.meanRgbError!).toBeLessThan(4);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format.toUpperCase()}`, exact: true }).click();
    const download = await downloadEvent;
    const downloadedPath = testInfo.outputPath(`selected-frame.${format}`);
    await download.saveAs(downloadedPath);
    const downloaded = await readFile(downloadedPath);
    expect(downloaded.length).toBe(first.bytes);
    expect(downloaded.subarray(0, format === 'png' ? 8 : 2).toString('hex'))
      .toBe(format === 'png' ? '89504e470d0a1a0a' : 'ffd8');
    // Completing the actual download dismisses the review dialog itself.
    await expect(page.locator('header').getByRole('button', { name: 'Close export preview', exact: true })).toHaveCount(0);
    await page.waitForTimeout(250);
    const second = await exportStill(page, shaderId, format);
    expect(second.hash).toBe(first.hash);
    expect(await state(page, shaderId)).toEqual(captured);
    await testInfo.attach(`${format}-shader-pixels`, { body: JSON.stringify(first), contentType: 'application/json' });
    await closeExport(page);
  }
});

test('shader time seeking is deterministic and playback does not grow the exploration window', async ({ page }) => {
  const { shaderId } = await prepareShader(page, { materialId: 'paper-dithering', timeMs: 29_900 });
  const initial = await state(page, shaderId);
  await page.waitForTimeout(450);
  const played = await state(page, shaderId);
  expect(played.motion.timeMs).toBeGreaterThan(30_000);
  expect(played.rangeMax).toBe(initial.rangeMax);
  expect(played.assetIds).toEqual(initial.assetIds);
  expect(played.sequence).toEqual(initial.sequence);
  const time = page.getByRole('slider', { name: 'Explore shader time', exact: true });
  await time.press('Home');
  await time.press('ArrowRight');
  await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(true);
  const selected = await state(page, shaderId);
  const first = await pixels(page, shaderId);
  await time.press('ArrowRight');
  await time.press('ArrowLeft');
  expect((await state(page, shaderId)).motion.timeMs).toBeCloseTo(selected.motion.timeMs, 4);
  expect(await pixels(page, shaderId)).toEqual(first);
  await page.waitForTimeout(250);
  expect(await pixels(page, shaderId)).toEqual(first);
  expect((await state(page, shaderId)).assetIds).toEqual(initial.assetIds);
});

test('nonzero time-only live source import and same-ID reapply restore the authored pose', async ({ page }, testInfo) => {
  const { shaderId } = await prepareShader(page, { materialId: 'holo-cloth-silk', timeMs: 1250, paused: true });
  const initial = await pixels(page, shaderId);
  const initialState = await state(page, shaderId);
  expect(initialState.motion.paused).toBe(true);
  expect(initialState.motion.timeMs).toBe(1250);
  expect(initialState.snapshot).toBeNull();
  const applyTimeOnly = async (timeMs: number, paused = true) => {
    await page.evaluate(async ({ id, timeMs, paused }) => {
      const studio = window.glyphfield!.studio;
      const source = JSON.parse(studio.readSource());
      const shader = source.elements[id];
      delete shader.data.frameState; delete shader.data.frameSnapshot;
      source.metadata.designLab.timeline = { ...source.metadata.designLab.timeline, timeMs, paused };
      const active = source.metadata.designLab.workspace.artboards.find((board: { id: string }) => board.id === source.metadata.designLab.workspace.activeArtboardId);
      active.snapshot.timeline = source.metadata.designLab.timeline;
      active.snapshot.shaderLayers = [shader.data];
      await studio.applySource(source);
    }, { id: shaderId, timeMs, paused });
    await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-shader-time-restoring="true"]')).toHaveCount(0);
    await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(paused);
    if (paused) await expect.poll(async () => (await state(page, shaderId)).motion.timeMs).toBe(timeMs);
    // Observe the new native render, not the old canvas's already-ready flag.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await applyTimeOnly(2500);
  await expect.poll(async () => (await pixels(page, shaderId)).hash).not.toBe(initial.hash);
  await applyTimeOnly(1250);
  await expect.poll(() => pixels(page, shaderId)).toEqual(initial);
  await page.waitForTimeout(250);
  expect(await pixels(page, shaderId)).toEqual(initial);
  // Reset the mounted provider to zero first. Without source restoration, a
  // subsequent live 1250ms import resumes that stale zero-time GPU state while
  // its UI incorrectly reports 1250ms. Paused-only imports cannot expose this.
  await applyTimeOnly(0);
  await expect.poll(async () => (await pixels(page, shaderId)).hash).not.toBe(initial.hash);
  await applyTimeOnly(1250, false);
  await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
  const liveAnchor = await state(page, shaderId);
  expect(liveAnchor.motion.paused).toBe(true);
  const nativeTimeMs = liveAnchor.frame.frame / liveMaterialMotionRate(liveAnchor.shaderSpeed);
  const timingErrorMs = Math.abs(nativeTimeMs - liveAnchor.motion.timeMs);
  await testInfo.attach('live-source-native-anchor', { body: JSON.stringify({ motion: liveAnchor.motion,
    frameState: liveAnchor.frame, nativeTimeMs, timingErrorMs }), contentType: 'application/json' });
  expect(nativeTimeMs).toBeGreaterThanOrEqual(1250);
  // Permit at most three display ticks even on a 30Hz Low Power Safari. A
  // preset-zero or stale 1250ms offset is orders of magnitude outside this bound.
  expect(timingErrorMs).toBeLessThanOrEqual(100);
});

test('Paper initial live import captures the authored native frame instead of its late initialization default', async ({ page }, testInfo) => {
  const materialId = 'paper-gem-smoke';
  const { shaderId } = await prepareShader(page, { materialId, timeMs: 1250 });
  // Capture immediately after authentic readiness, without a further edit or
  // seek that could mask the vendor mount's delayed initialization overwrite.
  await page.evaluate(async () => { await window.glyphfield!.studio.invoke('design.frame.capture'); });
  const captured = await state(page, shaderId);
  const preset = gemSmokePresets[getPaperLiveMaterialDefinition(materialId).presetIndex].params;
  const expectedFrame = resolvePaperShaderFrame({ materialId, timeMs: captured.motion.timeMs,
    speed: captured.shaderSpeed, preserveGeometry: false, preset });
  const nativeRate = liveMaterialMotionRate(captured.shaderSpeed) * preset.speed;
  const timingErrorMs = Math.abs(captured.frame.frame - expectedFrame) / nativeRate;
  await testInfo.attach('initial-paper-source-native-anchor', { body: JSON.stringify({
    frame: captured.frame, motion: captured.motion, expectedFrame, nativeRate, timingErrorMs,
  }), contentType: 'application/json' });
  expect(captured.frame.engine).toBe('paper');
  expect(captured.motion.paused).toBe(true);
  expect(captured.motion.timeMs).toBeGreaterThanOrEqual(1250);
  expect(captured.frame.frame).toBeGreaterThanOrEqual(resolvePaperShaderFrame({
    materialId, timeMs: 1250, speed: captured.shaderSpeed, preserveGeometry: false, preset,
  }) - 1e-6);
  expect(timingErrorMs).toBeLessThanOrEqual(100);
});

test('Paper grain and composition effects remain origin-clean during capture and export', async ({ page }, testInfo) => {
  const { shaderId } = await prepareShader(page, { materialId: 'paper-dithering', grain: 60 });
  // Isolate the exact authored CSS grain source before IndexedDB/save touches it.
  // This distinguishes SVG/canvas origin-clean failures from Blob storage errors.
  const grain = await page.evaluate(async (id) => {
    const node = document.querySelector(`[data-shader-instance="canvas-${CSS.escape(id)}"] .paper-material-grain`);
    if (!node) throw new Error('Nonzero Paper grain fixture was not actually rendered');
    const style = getComputedStyle(node);
    const url = style.backgroundImage.slice(5, -2);
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = context.createPattern(image, 'repeat')!;
    context.fillRect(0, 0, 160, 160);
    return { imageMime: url.slice(0, 30), opacity: style.opacity,
      bytes: context.getImageData(0, 0, 160, 160).data.length, png: canvas.toDataURL().slice(0, 22) };
  }, shaderId);
  await testInfo.attach('actual-grain-canvas', { body: JSON.stringify(grain), contentType: 'application/json' });
  expect(Number(grain.opacity)).toBeGreaterThan(0);
  expect(grain.png).toBe('data:image/png;base64,');
  await page.getByRole('button', { name: 'Add brand mark', exact: true }).click();
  await page.getByRole('button', { name: 'Add effect layer', exact: true }).click();
  await expect(page.locator('[data-testid="shader-lab-live-stage"] canvas[data-effect-kind="bayer"]')).toBeVisible();
  await page.evaluate(async () => { await window.glyphfield!.studio.invoke('design.frame.capture'); });
  const captured = await state(page, shaderId);
  expect(captured.asset).toMatch(/^data:image\/png;base64,/);
  for (const format of ['png', 'jpg'] as const) {
    const output = await exportStill(page, shaderId, format);
    expect(output.bytes).toBeGreaterThan(1000);
    expect(output.width).toBe(640);
    expect((await state(page, shaderId)).motion).toEqual(captured.motion);
    await testInfo.attach(`${format}-grain-and-converter`, { body: JSON.stringify(output), contentType: 'application/json' });
    await closeExport(page);
  }
});

for (const format of ['gif', 'mp4'] as const) {
  for (const start of ['paused-native', 'captured-frame'] as const) {
  test(`${format.toUpperCase()} animates from the chosen frame then restores the paused editor (${start})`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    try {
      execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
      execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    } catch { test.skip(true, 'Motion verification requires local ffmpeg and ffprobe to decode actual export bytes.'); }
    const { shaderId } = await prepareShader(page, { materialId: 'holo-cloth-silk', timeMs: 4200 });
    await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
    await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(true);
    if (start === 'captured-frame') {
      await page.getByRole('button', { name: 'Capture shader frame', exact: true }).click();
      await expect(page.locator(`[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`)).toBeVisible();
      expect((await state(page, shaderId)).asset).toMatch(/^data:image\/png;base64,/);
    }
    const before = await state(page, shaderId);
    const beforePixels = await pixels(page, shaderId);
    const anchorPixels = await page.evaluate((id) => {
      const surface = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"]`)!;
      const input = surface.querySelector<HTMLImageElement>('[data-shader-frame-ready="true"] [data-shader-frame-image]')
        ?? surface.querySelector<HTMLCanvasElement>('canvas')!;
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 36;
      const context = canvas.getContext('2d')!;
      context.drawImage(input, 0, 0, 64, 36);
      const rgba = context.getImageData(0, 0, 64, 36).data;
      return Array.from(rgba).filter((_, index) => index % 4 !== 3);
    }, shaderId);
    const anchorPng = await exportStill(page, shaderId, 'png', true);
    const anchorFile = testInfo.outputPath('selected-anchor.png');
    await writeFile(anchorFile, Buffer.from(anchorPng.dataUrl!.split(',')[1], 'base64'));
    await closeExport(page);
    expect((await state(page, shaderId)).motion).toEqual(before.motion);
    expect(await pixels(page, shaderId)).toEqual(beforePixels);
    const result = await page.evaluate(async (format) => {
      try {
        const artifact = await window.glyphfield!.studio.invoke('design.export', { format, download: false }) as { blob: Blob; fileName: string };
        if (!(artifact.blob instanceof Blob) || !artifact.blob.size) throw new Error('Motion export returned no bytes');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(artifact.blob);
        });
        return { ok: true as const, mime: artifact.blob.type, fileName: artifact.fileName, dataUrl };
      } catch (error) {
        return { ok: false as const, error: String(error),
          alerts: Array.from(document.querySelectorAll('[role="alert"]'), (node) => node.textContent),
          hasVideoEncoder: typeof VideoEncoder !== 'undefined' };
      }
    }, format);
    // Success and unsupported-codec failure both leave the user's anchor intact.
    expect((await state(page, shaderId)).motion).toEqual(before.motion);
    expect(await pixels(page, shaderId)).toEqual(beforePixels);
    if (!result.ok) {
      await testInfo.attach('motion-capability-error', { body: JSON.stringify(result), contentType: 'application/json' });
      const codecUnavailable = format === 'mp4' && (!result.hasVideoEncoder
        || /(?:not supported|unsupported|unavailable|no available).*(?:encod|codec)|(?:encod|codec).*(?:not supported|unsupported|unavailable)/i.test(`${result.error} ${result.alerts}`));
      test.skip(codecUnavailable, 'This engine reports no supported MP4 encoder; source restoration was verified, no substitute format generated.');
      throw new Error(`Motion export failed: ${JSON.stringify(result)}`);
    }
    expect(result.mime).toBe(format === 'gif' ? 'image/gif' : 'video/mp4');
    expect(result.fileName).toMatch(new RegExp(`\\.${format}$`));
    const file = testInfo.outputPath(`actual-motion.${format}`);
    await writeFile(file, Buffer.from(result.dataUrl.split(',')[1], 'base64'));
    const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
    const video = metadata.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video');
    expect(video.width).toBe(640); expect(video.height).toBe(360);
    const expectedFrames = Math.round(before.exportSettings.durationMs * before.exportSettings.fps / 1000);
    const frameSeconds = format === 'gif' ? Math.round(100 / before.exportSettings.fps) / 100 : 1 / before.exportSettings.fps;
    expect(Number(video.nb_read_frames)).toBe(expectedFrames);
    // GIF delays are whole centiseconds; MP4 uses the requested frame period.
    expect(Number(metadata.format.duration)).toBeCloseTo(expectedFrames * frameSeconds, 2);
    const decoded = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=64:36', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 16 * 1024 * 1024 });
    const frameBytes = 64 * 36 * 3;
    const frameCount = decoded.length / frameBytes;
    expect(Number.isInteger(frameCount)).toBe(true);
    const first = decoded.subarray(0, frameBytes);
    const middle = decoded.subarray(Math.floor(frameCount / 2) * frameBytes, (Math.floor(frameCount / 2) + 1) * frameBytes);
    const last = decoded.subarray((frameCount - 1) * frameBytes);
    expect(first.equals(middle) && first.equals(last)).toBe(false);
    const reference = execFileSync('ffmpeg', ['-v', 'error', '-i', anchorFile, '-vf', 'scale=64:36', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const meanError = (left: Uint8Array, right: Uint8Array | number[]) => Array.from(left)
      .reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) / left.length;
    const anchorMeanError = meanError(first, reference);
    const rawNativeMeanError = meanError(first, anchorPixels);
    const stillNativeMeanError = meanError(reference, anchorPixels);
    // Tolerate codec quantization and different downsampling implementations,
    // while rejecting a movie that starts at an unrelated zero-time pose.
    await testInfo.attach('decoded-motion', { body: JSON.stringify({ format, frames: frameCount, video, duration: metadata.format.duration,
      anchor: before.motion, anchorMeanError, rawNativeMeanError, stillNativeMeanError,
      firstEqualsMiddle: first.equals(middle), firstEqualsLast: first.equals(last) }), contentType: 'application/json' });
    console.log(JSON.stringify({ motionAnchor: { format, anchor: before.motion, anchorMeanError, rawNativeMeanError, stillNativeMeanError } }));
    expect(anchorMeanError).toBeLessThan(8);
    await closeExport(page);
    await page.waitForTimeout(250);
    const restored = await state(page, shaderId);
    expect(restored.motion).toEqual(before.motion);
    expect(restored.snapshot).toEqual(before.snapshot);
    expect(restored.asset).toEqual(before.asset);
    expect(await pixels(page, shaderId)).toEqual(beforePixels);
  });
  }
}

for (const materialId of ['glyphfield-glyph-field', 'shadergradient-prismatic-sphere']) {
  test(`${materialId} pause, capture and reload preserve native provider pixels`, async ({ page }) => {
    const { shaderId } = await prepareShader(page, { materialId });
    await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
    await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(true);
    const paused = await pixels(page, shaderId);
    await page.waitForTimeout(250);
    expect(await pixels(page, shaderId)).toEqual(paused);
    await page.getByRole('button', { name: 'Capture shader frame', exact: true }).click();
    await expect(page.locator(`[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`)).toBeVisible();
    const captured = await state(page, shaderId);
    const frozen = await pixels(page, shaderId);
    expect(frozen.hash).toBe(paused.hash);
    expect(captured.asset).toMatch(/^data:image\/png;base64,/);
    await page.getByRole('button', { name: 'Save design', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Design saved', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(`[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`)).toBeVisible();
    const reopened = await state(page, shaderId);
    expect(reopened.asset).toBe(captured.asset);
    expect(reopened.motion).toEqual(captured.motion);
    expect(await pixels(page, shaderId)).toEqual(frozen);
  });
}

test('Fluid motion export is rejected without changing the current paused appearance', async ({ page }) => {
  const { shaderId } = await prepareShader(page, { materialId: 'pavel-fluid-energy' });
  await page.getByRole('button', { name: 'Freeze current shader frame', exact: true }).click();
  await expect.poll(async () => (await state(page, shaderId)).motion.paused).toBe(true);
  await expect(page.getByRole('slider', { name: 'Explore shader time', exact: true })).toBeDisabled();
  const before = await state(page, shaderId);
  const beforePixels = await pixels(page, shaderId);
  for (const format of ['gif', 'mp4']) {
    const failure = await page.evaluate(async (format) => {
      try { await window.glyphfield!.studio.invoke('design.export', { format, download: false }); return null; }
      catch (error) { return { error: String(error), alerts: Array.from(document.querySelectorAll('[role="alert"]'), (node) => node.textContent) }; }
    }, format);
    expect(failure).not.toBeNull();
    expect(`${failure!.error} ${failure!.alerts}`).toMatch(/Fluid motion needs a live recording/);
    expect((await state(page, shaderId)).motion).toEqual(before.motion);
    expect(await pixels(page, shaderId)).toEqual(beforePixels);
  }
  await page.getByRole('button', { name: 'Capture shader frame', exact: true }).click();
  await expect(page.locator(`[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`)).toBeVisible();
  expect((await pixels(page, shaderId)).hash).toBe(beforePixels.hash);
  expect((await state(page, shaderId)).asset).toMatch(/^data:image\/png;base64,/);
});
