import { expect, test, type Page } from '@playwright/test';

async function workspace(page: Page) {
  return page.evaluate(async () => await window.glyphfield!.studio.invoke('design.workspace.describe') as {
    activeSurface: string; canvas: { layerIds: string[] }; artboards: Array<{ id: string; layerIds: string[] }>;
  });
}

async function prepare(page: Page) {
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  const id = await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const text = Object.values(source.elements).find((value) => (value as { kind: string }).kind === 'text') as {
      id: string; name: string; content: string; data: Record<string, unknown>; bounds: Record<string, number>;
    };
    text.content = 'Ideas belong anywhere';
    text.name = 'Canvas idea';
    Object.assign(text.data, { value: text.content, name: 'Canvas idea', color: '#FFFFFF', fontSize: 48,
      transform: { x: 0, y: 0, scale: 1, widthScale: .65, heightScale: .6 } });
    Object.assign(text.bounds, { x: 0, y: 0, width: .65, height: .6 });
    source.elements = { [text.id]: text };
    source.pages[source.pageIds[0]].elementIds = [text.id];
    const design = source.metadata.designLab;
    design.timeline = { frame: 0, timeMs: 0, paused: true };
    design.layerShaders = {};
    design.shaderSequence.targetLayerId = null;
    design.groups = [];
    design.workspace.artboards = design.workspace.artboards.slice(0, 1);
    await studio.applySource(source);
    await document.fonts.ready;
    return text.id;
  });
  await expect.poll(async () => (await workspace(page)).artboards[0].layerIds).toEqual([id]);
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
  return id;
}

test('loose layers keep layout, save/reload, and frame into a real output', async ({ page }) => {
  const id = await prepare(page);
  const layer = page.locator(`[data-canvas-layer-id="${id}"]`);
  const before = await layer.boundingBox();
  await page.evaluate(async (id) => { await window.glyphfield!.studio.invoke('design.workspace.move', { target: 'canvas', layerIds: [id] }); }, id);
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  const after = await layer.boundingBox();
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(after![key]).toBeCloseTo(before![key], 0);
  await expect(layer.locator('[data-canvas-editable]')).toHaveText('Ideas belong anywhere');
  await expect(page.getByRole('button', { name: 'Create artboard from selection' })).toBeVisible();
  const rejected = await page.evaluate(async () => {
    try { await window.glyphfield!.studio.invoke('design.export', { format: 'png', download: false }); return ''; }
    catch (error) { return String(error); }
  });
  expect(rejected).toContain('Select an artboard');
  // Exercise portable project serialization, including the no-output canvas.
  const portable = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('design.export.project') as { blob: Blob };
    return JSON.parse(await artifact.blob.text());
  });
  expect(portable.metadata.designLab.workspace.canvas.snapshot.layerOrder).toEqual([id]);
  await page.evaluate(async (source) => { await window.glyphfield!.studio.applySource(source); }, portable);
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  await expect(page.locator('[data-design-version-status]')).toHaveText('Autosaved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  await page.getByRole('region', { name: 'Canvas layer stack' }).getByRole('button', { name: /^Canvas idea 01/ }).click();
  const beforeFrame = await layer.boundingBox();
  await page.getByRole('button', { name: 'Create artboard from selection', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).artboards.length).toBe(2);
  const framed = await layer.boundingBox();
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(framed![key]).toBeCloseTo(beforeFrame![key], 0);
  expect((await workspace(page)).canvas.layerIds).toEqual([]);
  const exported = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('design.export', { format: 'png', download: false }) as { blob: Blob; width: number; height: number };
    const image = await createImageBitmap(artifact.blob);
    const result = { size: artifact.blob.size, type: artifact.blob.type, width: image.width, height: image.height };
    image.close(); return result;
  });
  expect(exported.size).toBeGreaterThan(1000);
  expect(exported.type).toBe('image/png');
  expect(exported.width).toBeGreaterThan(exported.height);
});

test('dragging a layer past the artboard transfers it without clamping; undo restores ownership', async ({ page }) => {
  const id = await prepare(page);
  await page.getByRole('region', { name: 'Canvas layer stack' }).getByRole('button', { name: /^Canvas idea 01/ }).click();
  const edge = page.getByRole('button', { name: 'Move Canvas idea from top edge', exact: true });
  const box = (await edge.boundingBox())!;
  const viewport = (await page.getByRole('region', { name: 'Canvas viewport', exact: true }).boundingBox())!;
  // The middle of the edge contains the resize handle; grab the line itself.
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 60, viewport.y + 70, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await workspace(page)).activeSurface).toBe('canvas');
  expect((await workspace(page)).canvas.layerIds).toEqual([id]);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([]);
  expect((await workspace(page)).artboards[0].layerIds).toContain(id);
});

test('negative and distant artboards persist, while offscreen rendering is culled', async ({ page }) => {
  await prepare(page);
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const boards = source.metadata.designLab.workspace.artboards;
    boards[0].x = -5000; boards[0].y = -3000;
    boards.push({ ...structuredClone(boards[0]), id: 'artboard-far', name: 'Distant idea', x: 20000, y: 18000 });
    await studio.applySource(source);
    await studio.invoke('design.workspace.activate', { target: boards[0].id });
  });
  const far = page.locator('[data-artboard-id="artboard-far"]');
  await expect(far.locator('.canvas-render-boundary')).toHaveAttribute('data-rendering', 'false');
  await expect(far.locator('[data-canvas-layer-id]')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()).metadata.designLab.workspace.artboards);
  expect(saved[0].x).toBe(-5000); expect(saved[0].y).toBe(-3000);
  expect(await page.locator('.design-artboard-workspace').evaluate((node) => node.getBoundingClientRect().width)).toBeLessThan(10);
  await page.evaluate(async () => { await window.glyphfield!.studio.invoke('design.workspace.activate', { target: 'artboard-far' }); });
  await expect(far.locator('[data-canvas-layer-id]')).toHaveCount(1);
  await expect(page.locator(`[data-artboard-id="${saved[0].id}"] .canvas-render-boundary`)).toHaveAttribute('data-rendering', 'false');
});

test('captured shaders survive moving onto a canvas-only project and reloading', async ({ page }) => {
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  const id = await page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource());
    return source.pages[source.pageIds[0]].elementIds.find((id: string) => id.startsWith('shader-')) as string;
  });
  await expect(page.locator(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${id}"] [data-live-material-ready="true"]`)).toHaveCount(1);
  await expect(page.locator('[data-testid="shader-lab-live-stage"] [data-shader-time-restoring="true"]')).toHaveCount(0);
  await page.evaluate(async (id) => {
    const studio = window.glyphfield!.studio;
    await studio.invoke('design.frame.pause');
    await studio.invoke('design.workspace.move', { target: 'canvas', layerIds: [id], placement: 'beside' });
  }, id);
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  await expect(page.locator('[data-canvas-surface="canvas"]')).toHaveAttribute('data-testid', 'shader-lab-live-stage');
  await expect(page.getByRole('button', { name: 'Move Canvas shader 1 from top edge', exact: true })).toBeVisible();
  const checkpoint = await page.evaluate(async () => JSON.parse(await window.glyphfield!.studio.invoke('design.frame.capture') as string));
  expect(checkpoint.metadata.designLab.workspace.canvas.snapshot.shaderLayers[0].frameSnapshot).toBeTruthy();
  const boardId = (await workspace(page)).artboards[0].id;
  await page.evaluate(async (target) => { await window.glyphfield!.studio.invoke('design.workspace.activate', { target }); }, boardId);
  await page.getByRole('button', { name: 'Delete active artboard', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).artboards.length).toBe(0);
  const portable = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('design.export.project') as { blob: Blob; description: string };
    return { source: JSON.parse(await artifact.blob.text()), description: artifact.description };
  });
  expect(portable.source.metadata.designLab.workspace.artboards).toEqual([]);
  expect(portable.description).toContain('0 artboards');
  expect(portable.source.metadata.designLab.workspace.canvas.snapshot.layerOrder).toEqual([id]);
  await expect(page.locator('[data-design-version-status]')).toHaveText('Autosaved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit source code', exact: true })).toBeEnabled();
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  expect((await workspace(page)).artboards).toEqual([]);
  await expect(page.locator('[data-canvas-surface="canvas"] [data-canvas-layer-id]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-surface="canvas"]')).toHaveAttribute('data-testid', 'shader-lab-live-stage');
});
