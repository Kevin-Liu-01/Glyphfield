import { expect, test, type Page } from '@playwright/test';
import type { CanvasElement } from '../src/lib/canvasDocument';

type FixtureKind = 'tiny-height' | 'tiny-width' | 'effect-overflow' | 'image' | 'image-no-viewbox' | 'image-explicit-stretch' | 'logo';

async function prepareOverflowFixture(page: Page, kind: FixtureKind) {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.evaluate(async (kind) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const template = (Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'text')!;
    const text = kind === 'tiny-height' || kind === 'tiny-width' || kind === 'effect-overflow';
    const image = !text && kind !== 'logo';
    const id = text ? template.id : kind === 'logo' ? 'logo-parity' : 'asset-parity';
    const value = kind === 'tiny-width' ? 'MWiiiiii' : 'AB\nCD';
    const transform = text
      ? { x: 0, y: 0, scale: 0.4, widthScale: kind === 'tiny-width' ? 0.01 : 0.035, heightScale: 0.01 }
      : { x: 0, y: 0, scale: 1, widthScale: kind === 'logo' ? 0.13 : 0.27, heightScale: kind === 'logo' ? 0.04 : 0.4 };
    const svgViewport = kind === 'image-no-viewbox' ? '' : ` viewBox="0 0 160 80"${kind === 'image-explicit-stretch' ? ' preserveAspectRatio="none"' : ''}`;
    // Inset absolute artwork exposes changes to SVG user-space coordinates;
    // a full-viewport rectangle could conceal clipping or translation errors.
    const svgPath = kind === 'image-no-viewbox' || kind === 'image-explicit-stretch'
      ? 'M24 12h96v48H24z' : 'M0 0h160v80H0z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"${svgViewport}><path fill="white" d="${svgPath}"/></svg>`;
    const url = `data:image/svg+xml;base64,${btoa(svg)}`;
    const data = text ? {
      ...template.data, id, name: 'Overflow parity', value, color: '#FFFFFF', align: 'center',
      weight: 500, lineHeight: 1.2, tracking: 0, wrap: kind === 'tiny-width' ? 'wrap' : 'nowrap',
      outlineEnabled: false, shadowEnabled: false,
      textEffect: kind === 'effect-overflow' ? { kind: 'gradient', backgroundColor: '#FFFFFF' } : { kind: 'solid' },
      transform, visible: true,
    } : { id, name: 'Intrinsic image parity', layerType: kind === 'logo' ? 'logo' : 'asset', url,
      color: '#FFFFFF', transform, visible: true, opacity: 1 };
    const element = { ...template, id, name: data.name, kind: text ? 'text' : kind === 'logo' ? 'logo' : 'image',
      hidden: false, data, bounds: { ...template.bounds, x: 0, y: 0, width: transform.widthScale, height: transform.heightScale },
      ...(text ? { content: value } : { content: undefined, assetId: `resource:${id}` }) };
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 1600, height: 900, background: '#000000', elementIds: [id] });
    source.elements = { [id]: element };
    source.assets = text ? {} : { [`resource:${id}`]: { id: `resource:${id}`, name: data.name,
      kind: 'image', source: url, mimeType: 'image/svg+xml', byteLength: new TextEncoder().encode(svg).length } };
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.exportSettings.width = 1600;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide',
      backgroundColor: '#000000', layerOrder: [id], textLayers: text ? [data] : [], shaderLayers: [],
      logos: kind === 'logo' ? [data] : [], assets: image ? [data] : [], effectLayers: [], groups: [],
      layerShaders: {}, timeline: design.timeline, shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
    await document.fonts.ready;
  }, kind);
  const stage = page.locator('[data-testid="shader-lab-live-stage"]');
  await expect(stage.locator('.editable-canvas-layer')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
  const hideArtboardMap = page.getByRole('button', { name: 'Hide artboard map', exact: true });
  if (await hideArtboardMap.isVisible()) await hideArtboardMap.click();
  return stage;
}

for (const kind of ['tiny-height', 'tiny-width', 'effect-overflow', 'image', 'image-no-viewbox', 'image-explicit-stretch', 'logo'] as const) {
  test(`export preserves live ${kind} ink outside or inside its selection box`, async ({ page }, testInfo) => {
    const stage = await prepareOverflowFixture(page, kind);
    const dom = await stage.evaluate((stage) => {
      const inspect = (element: Element | null) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { rect: element.getBoundingClientRect().toJSON(), clientWidth: element.clientWidth, clientHeight: element.clientHeight,
          style: Object.fromEntries(['width', 'height', 'minWidth', 'minHeight', 'fontSize', 'fontFamily', 'fontWeight',
            'lineHeight', 'display', 'alignItems', 'justifyContent', 'alignContent', 'gridTemplateRows', 'gridTemplateColumns',
            'objectFit', 'whiteSpace', 'overflowWrap', 'letterSpacing'].map((key) => [key, Reflect.get(style, key)])) };
      };
      const text = stage.querySelector('[data-canvas-editable]');
      const characters = [];
      if (text) {
        const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (let index = 0; index < node.textContent!.length; index += 1) {
            const range = document.createRange();
            range.setStart(node, index); range.setEnd(node, index + 1);
            characters.push({ character: node.textContent![index], rects: [...range.getClientRects()].map((rect) => rect.toJSON()) });
          }
        }
      }
      return { stage: inspect(stage), layer: inspect(stage.querySelector('.editable-canvas-layer')),
        content: inspect(stage.querySelector('.editable-canvas-layer-content')), text: inspect(text),
        image: inspect(stage.querySelector('img')), imageParent: inspect(stage.querySelector('img')?.parentElement ?? null), characters };
    });
    await testInfo.attach(`${kind}-dom`, { body: JSON.stringify(dom, null, 2), contentType: 'application/json' });
    const screenshot = await stage.screenshot({ animations: 'disabled' });
    await testInfo.attach(`${kind}-live`, { body: screenshot, contentType: 'image/png' });
    const result = await page.evaluate(async (previewBase64) => {
      const asset = await window.glyphfield!.studio.invoke('design.export', { format: 'png', download: false }) as { blob: Blob };
      if (!(asset.blob instanceof Blob) || asset.blob.size === 0) throw new Error('Missing export bytes');
      async function ink(blob: Blob) {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const offset = (y * canvas.width + x) * 4;
            if (pixels[offset] < 160 || pixels[offset + 1] < 160 || pixels[offset + 2] < 160) continue;
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
        return { left, top, right: right + 1, bottom: bottom + 1, width: canvas.width, height: canvas.height };
      }
      const live = await ink(await (await fetch(`data:image/png;base64,${previewBase64}`)).blob());
      const output = await ink(asset.blob);
      const stage = document.querySelector<HTMLElement>('[data-testid="shader-lab-live-stage"]')!;
      const style = getComputedStyle(stage);
      const borderX = parseFloat(style.borderLeftWidth);
      const borderY = parseFloat(style.borderTopWidth);
      const scaleX = output.width / (live.width - borderX - parseFloat(style.borderRightWidth));
      const scaleY = output.height / (live.height - borderY - parseFloat(style.borderBottomWidth));
      return { live, output, expected: {
        left: (live.left - borderX) * scaleX, right: (live.right - borderX) * scaleX,
        top: (live.top - borderY) * scaleY, bottom: (live.bottom - borderY) * scaleY,
      } };
    }, screenshot.toString('base64'));
    await testInfo.attach(`${kind}-pixel-bounds`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.output.width).toBe(1600);
    expect(result.output.height).toBe(900);
    expect(result.output.right).toBeGreaterThan(result.output.left);
    expect(result.live.right).toBeGreaterThan(result.live.left);
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      expect(Math.abs(result.output[edge] - result.expected[edge]), `${kind} ${edge}`).toBeLessThanOrEqual(5);
    }
  });
}

test('direct export commits the final focused text before its debounce fires', async ({ page }, testInfo) => {
  const stage = await prepareOverflowFixture(page, 'tiny-height');
  const text = stage.locator('[data-canvas-editable]');
  await text.click();
  const modifier = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
  await text.press(`${modifier}+a`);
  await text.evaluate((element) => {
    const pending = new Promise((resolve, reject) => {
      element.addEventListener('input', (event) => {
        const inputAt = performance.now();
        // Run after React's real input handler, in the same task: no elapsed
        // timer or screenshot can accidentally let the 140ms debounce commit.
        queueMicrotask(() => {
          void (async () => {
            const studio = window.glyphfield!.studio;
            const readText = () => {
              const source = JSON.parse(studio.readSource() as string);
              return (Object.values(source.elements) as CanvasElement[]).find((entry) => entry.kind === 'text')!.content;
            };
            const sourceBefore = readText();
            const focusedBefore = document.activeElement === element;
            const inputText = (element as HTMLElement).innerText;
            const elapsedBeforeInvoke = performance.now() - inputAt;
            const immediateExport = studio.invoke('design.export', { format: 'png', download: false });
            const sourceImmediatelyAfter = readText();
            const focusedAfter = document.activeElement === element;
            const immediateAsset = await immediateExport as { blob: Blob };
            async function decodedPixels(asset: { blob: Blob }) {
              if (!(asset.blob instanceof Blob) || !asset.blob.size) throw new Error('Missing export bytes');
              const bitmap = await createImageBitmap(asset.blob);
              const canvas = document.createElement('canvas');
              canvas.width = bitmap.width; canvas.height = bitmap.height;
              const context = canvas.getContext('2d', { willReadFrequently: true })!;
              context.drawImage(bitmap, 0, 0);
              bitmap.close();
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
              let left = canvas.width, right = -1;
              for (let offset = 0; offset < pixels.length; offset += 4) {
                if (pixels[offset] < 160 || pixels[offset + 1] < 160 || pixels[offset + 2] < 160) continue;
                const x = offset / 4 % canvas.width;
                left = Math.min(left, x); right = Math.max(right, x);
              }
              const digest = await crypto.subtle.digest('SHA-256', pixels);
              return { width: canvas.width, height: canvas.height, inkWidth: right - left + 1,
                hash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') };
            }
            const immediate = await decodedPixels(immediateAsset);
            const committed = await decodedPixels(await studio.invoke('design.export', { format: 'png', download: false }) as { blob: Blob });
            return { sourceBefore, sourceImmediatelyAfter, focusedBefore, focusedAfter, inputText,
              elapsedBeforeInvoke, trustedInput: event.isTrusted, immediate, committed };
          })().then(resolve, reject);
        });
      }, { once: true });
    });
    // Test-owned result only; product source still changes exclusively through
    // native text input and the public export action.
    Reflect.set(window, '__glyphfieldImmediateTextExport', pending);
    void pending.catch(() => undefined);
  });
  await page.keyboard.insertText('MMMMMMMM');
  const result = await page.evaluate(async () => await Reflect.get(window, '__glyphfieldImmediateTextExport'));
  await testInfo.attach('immediate-focused-text-export', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.trustedInput).toBe(true);
  expect(result.focusedBefore).toBe(true);
  expect(result.inputText).toBe('MMMMMMMM');
  expect(result.sourceBefore).toBe('AB\nCD');
  expect(result.elapsedBeforeInvoke).toBeLessThan(140);
  expect(result.sourceImmediatelyAfter).toBe('MMMMMMMM');
  expect(result.focusedAfter).toBe(false);
  expect(result.immediate.width).toBe(1600);
  expect(result.immediate.height).toBe(900);
  // The stale two-line AB/CD fixture is only ~80px wide; the final eight Ms
  // overflow this tiny selection by hundreds of pixels.
  expect(result.immediate.inkWidth).toBeGreaterThan(300);
  expect(result.immediate).toEqual(result.committed);
});
