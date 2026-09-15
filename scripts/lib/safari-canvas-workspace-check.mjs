import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeDrag } from './safari-artboard-export-check.mjs';

const liveStage = '[data-testid="shader-lab-live-stage"]';
const canvasStage = '[data-canvas-surface="canvas"][data-testid="shader-lab-live-stage"]';
const closeExport = 'header button[aria-label="Close export preview"]';

const source = (harness) => harness.evaluate(() => JSON.parse(window.glyphfield.studio.readSource()));
const invoke = (harness, action, input) => harness.evaluateAsync(async (action, input) => {
  await window.glyphfield.studio.invoke(action, input);
  await new Promise((resolve) => requestAnimationFrame(resolve));
}, action, input);

function sameBox(before, after) {
  for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(before[key] - after[key]) < 1,
    `Surface transfer changed ${key}: ${JSON.stringify({ before, after })}`);
}

export async function checkSafariCanvasWorkspace(harness) {
  const { click, rect, waitFor, evaluateAsync, evaluate, command } = harness;
  const initial = await source(harness);
  const id = Object.values(initial.elements).find((layer) => layer.kind === 'text').id;
  const layerSelector = `[data-canvas-layer-id="${id}"]`;
  const viewport = await rect('[aria-label="Canvas viewport"]');
  const edgeSelector = 'button[aria-label="Move Browser text from top edge"]';
  const edge = await rect(edgeSelector);
  const drag = await nativeDrag(harness, edgeSelector, { x: .25, y: .5 }, {
    x: viewport.x + 45 - edge.x - edge.width * .25,
    y: viewport.y + 60 - edge.y - edge.height * .5,
  });
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'editable loose canvas after native drag', canvasStage);
  assert.deepEqual((await source(harness)).metadata.designLab.workspace.canvas.snapshot.layerOrder, [id]);
  await click('button[aria-label="Undo"]');
  await waitFor((id) => {
    const workspace = JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace;
    return !workspace.canvas.snapshot.layerOrder.includes(id) && workspace.artboards.some((board) => board.snapshot.layerOrder.includes(id));
  }, 'undo restores artboard ownership without moving the viewport', id);
  await invoke(harness, 'design.workspace.activate', { target: initial.metadata.designLab.workspace.activeArtboardId });
  const before = await rect(layerSelector);
  await invoke(harness, 'design.workspace.move', { target: 'canvas', layerIds: [id] });
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'live canvas editor', canvasStage);
  sameBox(before, await rect(layerSelector));
  const exportError = await evaluateAsync(async () => {
    try { await window.glyphfield.studio.invoke('design.export', { format: 'png', download: false }); return null; }
    catch (error) { return String(error); }
  });
  assert(exportError?.includes('Select an artboard'), 'Loose canvas must not silently export');
  await click('button[aria-label="Create artboard from selection"]');
  await waitFor(() => JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace.artboards.length === 2, 'framed selection');
  sameBox(before, await rect(layerSelector));
  const framed = (await source(harness)).metadata.designLab.workspace.activeArtboardId;
  const portable = await evaluateAsync(async () => {
    const studio = window.glyphfield.studio;
    const artifact = await studio.invoke('design.export.project');
    if (artifact.blob.type !== 'application/json' || !artifact.blob.size) throw new Error('Invalid portable project');
    const project = JSON.parse(await artifact.blob.text());
    await studio.applySource(project);
    return { bytes: artifact.blob.size, artboards: project.metadata.designLab.workspace.artboards.length };
  });
  await waitFor(() => document.querySelector('[data-design-version-status]')?.textContent === 'Autosaved', 'saved workspace');
  await command('POST', '/refresh', {});
  await waitFor((framed, id) => {
    if (!window.glyphfield?.studio || !document.querySelector('[aria-label="Edit source code"]:not(:disabled)')) return false;
    const source = JSON.parse(window.glyphfield.studio.readSource());
    return source.metadata.designLab.workspace.activeArtboardId === framed && Boolean(source.elements[id]);
  }, 'reloaded framed layer', framed, id);
  await evaluateAsync(async (framed) => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const inactive = source.metadata.designLab.workspace.artboards.find((board) => board.id !== framed);
    inactive.x = -20000; inactive.y = -15000;
    await studio.applySource(source);
  }, framed);
  await waitFor((framed) => [...document.querySelectorAll('[data-artboard-id]')].some((board) =>
    board.dataset.artboardId !== framed && board.querySelector('[data-rendering="false"]')), 'offscreen artboard renderer released', framed);
  const workspaceWidth = await evaluate(() => document.querySelector('.design-artboard-workspace').offsetWidth);
  assert.equal(workspaceWidth, 1, 'Infinite canvas allocated a giant backing surface');
  return { drag, portable, framed, savedAndReloaded: true, offscreenCulling: true };
}

export async function checkSafariTextPreview(harness) {
  const { evaluateAsync, evaluate, waitFor, click, captureScreenshot } = harness;
  // Finish native editing before replacing same-ID source; focused editors
  // intentionally retain their pending text until blur.
  await click('button[aria-label="Fit canvas"]');
  const font = `data:font/ttf;base64,${(await readFile(new URL('../../public/fonts/inter-variable.ttf', import.meta.url))).toString('base64')}`;
  await evaluateAsync(async (font) => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const text = Object.values(source.elements).find((layer) => layer.kind === 'text');
    text.content = '“The package is a kind of black box for most developers, unless they track the source code,” said Fuma. “Of course, you can still modify the code by patching it.”\n\nThe alternative approach, the shadcn/ui model of copying components directly into your codebase, avoids the black box problem. But it comes with its own drawbacks.\n';
    text.bounds = { ...text.bounds, x: 0, y: 0, width: 1.1, height: 2.6 };
    Object.assign(text.data, { value: text.content, fontSize: 49, fontRole: 'Body', color: '#110F0E', weight: 400,
      lineHeight: 1, tracking: -.05, wrap: 'wrap', align: 'left',
      transform: { x: 0, y: 0, scale: 1, widthScale: 1.1, heightScale: 2.6 } });
    Object.assign(source.pages[source.pageIds[0]], { width: 1080, height: 1440, background: '#FFFFFF' });
    const design = source.metadata.designLab;
    design.ratio = 'portrait-3-4';
    design.exportSettings.width = 960;
    design.identity = { ...design.identity, id: source.brandId, name: 'Native text parity',
      fonts: [{ id: 'native-inter', family: 'Native Inter', label: 'Native Inter', fileName: 'Inter.ttf', path: font,
        format: 'truetype', style: 'normal', weight: 400, weightMin: 100, weightMax: 900 }],
      typography: [{ role: 'Body', family: 'Native Inter', fontId: 'native-inter', weight: 400, lineHeight: 1, letterSpacing: 0, usage: 'Native regression' }] };
    await studio.applySource(source);
    await document.fonts.ready;
  }, font);
  await waitFor(() => document.querySelector('[data-testid="shader-lab-live-stage"] [data-canvas-editable]')?.innerText.startsWith('“The package'), 'imported quote, not the earlier focused text');
  await click('button[aria-label="Fit canvas"]');
  const themes = [];
  for (const theme of ['light', 'dark']) {
    const toggle = `button[aria-label="Switch to ${theme} mode"]`;
    if (await evaluate((selector) => Boolean(document.querySelector(selector)), toggle)) await click(toggle);
    const canvasScreenshot = await captureScreenshot(`native-${theme}-quote-canvas`);
    const result = await evaluateAsync(async (theme) => {
      const text = document.querySelector('[data-testid="shader-lab-live-stage"] [data-canvas-editable]');
      const lines = new Map();
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const splitRects = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) for (let i = 0; i < node.textContent.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = [...range.getClientRects()].find((rect) => rect.width > 0 && rect.height > 0) ?? range.getBoundingClientRect();
        if (range.getClientRects().length > 1) splitRects.push({ value: node.textContent[i], rects: [...range.getClientRects()].map((rect) => rect.toJSON()) });
        if (rect.height) lines.set(rect.top, (lines.get(rect.top) ?? '') + node.textContent[i]);
      }
      const painted = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) { painted.push(args[0]); return fillText.apply(this, args); };
      let artifact;
      try { artifact = await window.glyphfield.studio.invoke('design.export', { format: 'png', download: false }); }
      finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
      const url = URL.createObjectURL(artifact.blob);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const corner = [...context.getImageData(24, 24, 1, 1).data];
        return { theme, lines: [...lines.values()], painted, splitRects, corner, width: canvas.width, height: canvas.height,
          mime: artifact.blob.type, bytes: artifact.blob.size };
      } finally { URL.revokeObjectURL(url); }
    }, theme);
    assert(result.lines.length > 5 && result.lines[0].includes('The package'), 'Native quote fixture was not applied');
    assert.deepEqual(result.painted, result.lines, 'Safari export rewrapped native text');
    assert.deepEqual(result.corner, [255, 255, 255, 255]);
    assert.equal(result.width, 960); assert.equal(result.height, 1280);
    assert.equal(result.mime, 'image/png'); assert(result.bytes > 1000);
    await waitFor(() => document.querySelector('.shader-export-media')?.complete, 'decoded preview');
    const preview = await evaluate(() => {
      const image = document.querySelector('.shader-export-media');
      const rect = image.getBoundingClientRect(), parent = image.parentElement.getBoundingClientRect();
      const style = getComputedStyle(image.parentElement);
      return { ratio: rect.width / rect.height, natural: image.naturalWidth / image.naturalHeight,
        background: style.backgroundColor, pattern: style.backgroundImage, patternSize: style.backgroundSize,
        shadow: getComputedStyle(image).boxShadow,
        inset: rect.left > parent.left && rect.right < parent.right };
    });
    assert(Math.abs(preview.ratio - preview.natural) < .01 && preview.inset, 'Preview stretched or filled an extra container');
    assert.equal(preview.background, theme === 'light' ? 'rgb(242, 242, 242)' : 'rgb(33, 33, 33)');
    assert(preview.pattern.includes('radial-gradient'));
    assert.equal(preview.patternSize, '16px 16px');
    assert.notEqual(preview.shadow, 'none');
    themes.push({ ...result, preview, canvasScreenshot, screenshot: await captureScreenshot(`native-${theme}-export-preview`) });
    await click(closeExport);
  }
  return { themes };
}

export async function checkSafariLooseShader(harness) {
  const { baseUrl, command, waitFor, evaluateAsync, click } = harness;
  await command('POST', '/url', { url: `${baseUrl}/studio?tool=material` });
  await waitFor(() => Boolean(document.querySelector('[data-testid="shader-lab-live-stage"] [data-live-material-ready="true"]'))
    && !document.querySelector('[data-testid="shader-lab-live-stage"] [data-shader-time-restoring="true"]'), 'ready native shader');
  const initial = await source(harness);
  const id = Object.values(initial.elements).find((layer) => layer.kind === 'shader').id;
  await invoke(harness, 'design.frame.pause');
  await invoke(harness, 'design.workspace.move', { target: 'canvas', layerIds: [id], placement: 'beside' });
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'editable loose shader', canvasStage);
  await click('button[aria-label="Fit canvas"]');
  await waitFor(() => Boolean(document.querySelector('button[aria-label="Move Canvas shader 1 from top edge"]')), 'native shader editing handles');
  const captured = await evaluateAsync(async () => JSON.parse(await window.glyphfield.studio.invoke('design.frame.capture')));
  assert(captured.metadata.designLab.workspace.canvas.snapshot.shaderLayers[0].frameSnapshot, 'Native loose shader lost its pixels');
  await click('button[aria-label="Create artboard from selection"]');
  await waitFor((id) => Boolean(document.querySelector(`[data-testid="shader-lab-live-stage"] [data-canvas-layer-id="${id}"]`)), 'framed native shader', id);
  const exported = await evaluateAsync(async () => {
    const artifact = await window.glyphfield.studio.invoke('design.export', { format: 'png', download: false });
    const bitmap = await createImageBitmap(artifact.blob);
    const result = { width: bitmap.width, height: bitmap.height, bytes: artifact.blob.size, mime: artifact.blob.type };
    bitmap.close(); return result;
  });
  assert.equal(exported.mime, 'image/png'); assert(exported.bytes > 1000 && exported.width > 0 && exported.height > 0);
  return { captured: true, editableAfterMove: true, exported };
}
