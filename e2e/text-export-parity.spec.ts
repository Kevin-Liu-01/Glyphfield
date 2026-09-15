import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The reported portrait composition: tight variable-font tracking, hyphenated
// words, blank paragraphs and a trailing newline. No storage/React mutations.
const quote = `“It’s kind of crazy. I learned to code from files. Like I would see a huge pile of JavaScript and read that,” he said. “I didn’t look at any kind of documentation, just the code itself.”

By going directly to “the primary source," Fuma came to understand the bare bones cognitive principles at a deep level. He picked up the mental concepts behind a framework, rather than labels attached to behaviors. When asked about his favorite aspect of software architecture, Fuma still points to old-school OOP (object-oriented programming) in Java, a choice that is almost radically simple.

“The idea of the object is very elegant. I think in terms of extending classes,” he said. “It’s a universal model which works the same between Java, JavaScript, and many other languages you touch.”
`;

async function prepareQuote(page: Page) {
  const font = `data:font/ttf;base64,${(await readFile('public/fonts/inter-variable.ttf')).toString('base64')}`;
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(window.glyphfield!.studio.readSource()).elements)
    .some((element) => (element as { kind: string }).kind === 'text'))).toBe(true);
  await page.evaluate(async ({ font, quote }) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const text = Object.values(source.elements).find((element) => (element as { kind: string }).kind === 'text') as {
      id: string; content: string; hidden: boolean; bounds: Record<string, number>; data: Record<string, unknown>;
    };
    const board = source.pages[source.pageIds[0]];
    Object.assign(board, { width: 1080, height: 1440, background: '#FFFFFF', elementIds: [text.id] });
    text.hidden = false;
    text.content = quote;
    Object.assign(text.bounds, { x: 0, y: -83.94231527134966, width: 1.2285932360062817, height: 2.6623779703740595 });
    Object.assign(text.data, { name: 'Export parity quote', value: quote, fontRole: 'Body', fontSize: 49,
      color: '#110F0E', align: 'left', opacity: 1, visible: true, weight: 400, tracking: -0.05,
      lineHeight: 1, wrap: 'wrap', shadowEnabled: false, outlineEnabled: false,
      textEffect: { kind: 'solid' },
      transform: { x: 0, y: -83.94231527134966, scale: 1, widthScale: 1.2285932360062817, heightScale: 2.6623779703740595 },
    });
    source.elements = { [text.id]: text };
    const design = source.metadata.designLab;
    design.identity = {
      ...design.identity,
      id: source.brandId,
      name: 'Text export parity',
      fonts: [{ id: 'parity-inter', family: 'Parity Inter', label: 'Parity Inter', fileName: 'Inter.ttf',
        path: font, format: 'truetype', style: 'normal', weight: 400, weightMin: 100, weightMax: 900 }],
      typography: [{ role: 'Body', family: 'Parity Inter', fontId: 'parity-inter', weight: 400,
        lineHeight: 1, letterSpacing: 0, usage: 'Text export regression' }],
    };
    design.ratio = 'portrait-3-4';
    design.timeline = { ...design.timeline, paused: true };
    design.exportSettings = { ...design.exportSettings, width: 960, quality: 'balanced' };
    design.layerShaders = {};
    design.groups = [];
    design.shaderSequence.targetLayerId = null;
    const active = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(active.snapshot, { dimensions: { width: 1080, height: 1440 }, ratio: 'portrait-3-4',
      backgroundColor: '#FFFFFF', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [],
      logos: [], effectLayers: [], assets: [], groups: [], layerShaders: {},
      timeline: design.timeline, shaderSequence: design.shaderSequence });
    design.workspace.artboards = [active];
    await studio.applySource(source);
    await document.fonts.ready;
  }, { font, quote });
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]')).toHaveText(quote.trim(), { useInnerText: true });
}

async function exportAndCompare(page: Page, screenshot: Buffer) {
  return page.evaluate(async (screenshotUrl) => {
    const stage = document.querySelector<HTMLElement>('[data-testid="shader-lab-live-stage"]')!;
    const text = stage.querySelector<HTMLElement>('[data-canvas-editable]')!;
    const domLines = new Map<number, string>();
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let index = 0; index < node.textContent!.length; index += 1) {
        range.setStart(node, index); range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.height) {
          domLines.set(rect.top, (domLines.get(rect.top) ?? '') + node.textContent![index]);
        }
      }
    }
    // Observe the real painter without replacing its pixels or return value.
    const painted: string[] = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      painted.push(value);
      return fillText.call(this, value, x, y, maxWidth!);
    };
    let artifact: { blob: Blob; width: number; height: number };
    try {
      artifact = await window.glyphfield!.studio.invoke('design.export', { format: 'png', download: false }) as typeof artifact;
    } finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
    const screenshot = new Image(); screenshot.src = screenshotUrl; await screenshot.decode();
    const url = URL.createObjectURL(artifact.blob);
    try {
      const output = new Image(); output.src = url; await output.decode();
      const raster = (image: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = screenshot.naturalWidth; canvas.height = screenshot.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const ink = { top: canvas.height, bottom: -1, left: canvas.width, right: -1 };
        for (let y = 8; y < canvas.height - 8; y += 1) {
          for (let x = 8; x < canvas.width - 8; x += 1) {
            const index = (y * canvas.width + x) * 4;
            if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100 && pixels[index + 3] > 200) {
              ink.left = Math.min(ink.left, x); ink.right = Math.max(ink.right, x);
              ink.top = Math.min(ink.top, y); ink.bottom = y;
            }
          }
        }
        // Blank artboard corners must be pure white, not an editor vignette.
        const sample = (24 * canvas.width + 24) * 4;
        return { ink, corner: [...pixels.slice(sample, sample + 4)] };
      };
      return { domLines: [...domLines.values()], painted, canvas: raster(screenshot), exported: raster(output),
        width: output.naturalWidth, height: output.naturalHeight, mime: artifact.blob.type, bytes: artifact.blob.size };
    } finally { URL.revokeObjectURL(url); }
  }, `data:image/png;base64,${screenshot.toString('base64')}`);
}

test('portrait quote preserves native text layout, clean canvas, and artifact-sized export preview', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1800, height: 1400 });
  await prepareQuote(page);
  const stage = page.locator('[data-testid="shader-lab-live-stage"]');
  for (const width of [960, 1920, 640]) {
    await page.evaluate(async (width) => {
      const studio = window.glyphfield!.studio;
      const source = JSON.parse(studio.readSource());
      source.metadata.designLab.exportSettings.width = width;
      await studio.applySource(source);
    }, width);
    await expect(stage.locator('[data-canvas-editable]')).toBeVisible();
    await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
    const result = await exportAndCompare(page, await stage.screenshot({ scale: 'css' }));
    await test.info().attach(`pixel-comparison-${width}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.mime).toBe('image/png');
    expect(result.bytes).toBeGreaterThan(1_000);
    expect(result.width).toBe(width);
    expect(Math.abs(result.height - width * 4 / 3)).toBeLessThanOrEqual(1);
    expect(result.painted).toEqual(result.domLines);
    expect(result.canvas.corner).toEqual([255, 255, 255, 255]);
    expect(result.exported.corner).toEqual(result.canvas.corner);
    // Native line contents above enforce every wrap. Independently verify the
    // actual raster's position and extent; scaled antialiasing may touch an
    // adjacent screen pixel (PNG pixels at different sizes are not identical).
    expect(result.canvas.ink.right).toBeGreaterThan(result.canvas.ink.left);
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      expect(Math.abs(result.exported.ink[edge] - result.canvas.ink[edge]), `ink ${edge}`).toBeLessThanOrEqual(2);
    }
    const preview = page.getByRole('img', { name: 'PNG export preview', exact: true });
    await expect(preview).toBeVisible();
    const geometry = await preview.evaluate((image: HTMLImageElement) => {
      const rect = image.getBoundingClientRect();
      const stage = image.parentElement!;
      return { ratio: rect.width / rect.height, natural: image.naturalWidth / image.naturalHeight,
        surround: getComputedStyle(stage).backgroundColor, stage: stage.getBoundingClientRect().toJSON(), rect: rect.toJSON() };
    });
    expect(geometry.ratio).toBeCloseTo(geometry.natural, 2);
    expect(geometry.surround).toBe('rgb(119, 119, 119)');
    expect(geometry.rect.left).toBeGreaterThan(geometry.stage.left);
    expect(geometry.rect.right).toBeLessThan(geometry.stage.right);
    await page.locator('.shader-export-dialog').getByRole('button', { name: 'Close export preview', exact: true }).click();
  }
  await page.evaluate(() => window.glyphfield!.studio.invoke('design.export', { format: 'png', download: false }).then(() => undefined));
  for (const viewport of [{ width: 1000, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const image = page.getByRole('img', { name: 'PNG export preview', exact: true });
    await expect(image).toBeVisible();
    const bounds = await image.evaluate((image: HTMLImageElement) => ({
      displayed: image.clientWidth / image.clientHeight,
      intrinsic: image.naturalWidth / image.naturalHeight,
      width: image.clientWidth,
    }));
    expect(bounds.displayed).toBeCloseTo(bounds.intrinsic, 2);
    expect(bounds.width).toBeLessThan(viewport.width);
  }
});
