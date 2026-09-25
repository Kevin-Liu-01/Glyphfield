import { waitForStudioSource } from './studio-ui-helpers';
import { expect, test, type Page } from '@playwright/test';

async function workspace(page: Page) {
  return page.evaluate(async () => await window.glyphfield!.studio.invoke('design.workspace.describe') as {
    activeSurface: string; canvas: { layerIds: string[] }; artboards: Array<{ id: string; layerIds: string[] }>;
  });
}

async function prepare(page: Page) {
  await page.goto('/studio?tool=material');
  await waitForStudioSource(page);
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
  await waitForStudioSource(page);
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
  await waitForStudioSource(page);
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
  await waitForStudioSource(page);
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  expect((await workspace(page)).artboards).toEqual([]);
  await expect(page.locator('[data-canvas-surface="canvas"] [data-canvas-layer-id]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-surface="canvas"]')).toHaveAttribute('data-testid', 'shader-lab-live-stage');
});

async function dragLayerTo(page: Page, id: string, center: { x: number; y: number }) {
  const layer = page.locator(`[data-canvas-layer-id="${id}"]`);
  const before = (await layer.boundingBox())!;
  const edge = page.getByRole('button', { name: 'Move Canvas idea from top edge', exact: true });
  const handle = (await edge.boundingBox())!;
  const start = { x: handle.x + handle.width / 4, y: handle.y + handle.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + center.x - before.x - before.width / 2,
    start.y + center.y - before.y - before.height / 2, { steps: 18 });
  const preview = (await layer.boundingBox())!;
  await page.mouse.up();
  await expect(layer).not.toHaveAttribute('data-interaction-preview');
  await expect(page.locator('.editable-canvas-layer-selection')).toBeVisible();
  await expect.poll(async () => {
    const committed = (await layer.boundingBox())!;
    return Math.max(...(['x', 'y', 'width', 'height'] as const).map((key) => Math.abs(committed[key] - preview[key])));
  }, { message: 'Dropping a layer must preserve its visible preview geometry' }).toBeLessThan(1);
  return preview;
}

test('repeated real drags move out, around the canvas, back in, and between differently sized artboards', async ({ page }) => {
  const id = await prepare(page);
  const firstId = (await workspace(page)).artboards[0].id;
  await page.getByRole('button', { name: 'Add blank artboard', exact: true }).click();
  const secondId = await page.evaluate(async (firstId) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const boards = source.metadata.designLab.workspace.artboards;
    const second = boards.find((board: { id: string }) => board.id !== firstId);
    second.x = boards[0].x + 900;
    second.y = boards[0].y;
    second.displayScale = .35;
    second.snapshot.dimensions = { width: 800, height: 1200 };
    second.snapshot.ratio = 'custom';
    // Active dimensions are also represented by the portable page.
    source.pages[source.pageIds[0]].width = 800;
    source.pages[source.pageIds[0]].height = 1200;
    source.metadata.designLab.ratio = 'custom';
    await studio.applySource(source);
    await studio.invoke('design.workspace.activate', { target: firstId });
    return second.id;
  }, firstId);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.getByRole('region', { name: 'Canvas layer stack' }).getByRole('button', { name: /^Canvas idea 01/ }).click();
  const first = (await page.locator(`[data-artboard-id="${firstId}"]`).boundingBox())!;
  const second = (await page.locator(`[data-artboard-id="${secondId}"]`).boundingBox())!;
  const viewport = (await page.getByRole('region', { name: 'Canvas viewport', exact: true }).boundingBox())!;
  const insideFirst = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
  const outside = { x: insideFirst.x, y: first.y - 65 };
  expect(outside.y).toBeGreaterThan(viewport.y + 40);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await dragLayerTo(page, id, { x: insideFirst.x + 20, y: insideFirst.y + 15 });
    await expect.poll(async () => (await workspace(page)).activeSurface).toBe(firstId);
    await dragLayerTo(page, id, outside);
    await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
    await dragLayerTo(page, id, { x: outside.x + 45, y: outside.y - 10 });
    await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
    await dragLayerTo(page, id, insideFirst);
    await expect.poll(async () => (await workspace(page)).artboards.find((board) => board.id === firstId)!.layerIds).toEqual([id]);
  }
  await dragLayerTo(page, id, { x: second.x + second.width / 2, y: second.y + second.height / 2 });
  await expect.poll(async () => (await workspace(page)).activeSurface).toBe(secondId);
  expect((await workspace(page)).canvas.layerIds).toEqual([]);
  expect((await workspace(page)).artboards.find((board) => board.id === firstId)!.layerIds).toEqual([]);
  const finalSource = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).artboards.find((board) => board.id === firstId)!.layerIds).toEqual([id]);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).artboards.find((board) => board.id === secondId)!.layerIds).toEqual([id]);
  await expect(page.locator('[data-design-version-status]')).toHaveText('Autosaved');
  await page.reload();
  await waitForStudioSource(page);
  await expect.poll(async () => (await workspace(page)).artboards.find((board) => board.id === secondId)!.layerIds).toEqual([id]);
  const restored = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()));
  expect(restored.metadata.designLab.workspace.artboards).toEqual(finalSource.metadata.designLab.workspace.artboards);
});

test('group drags preserve both layers and their spacing across the artboard boundary', async ({ page }) => {
  const id = await prepare(page);
  const ids = await page.evaluate(async (id) => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource());
    const copy = structuredClone(source.elements[id]);
    copy.id = 'text-drag-partner';
    copy.name = 'Drag partner';
    copy.data.id = copy.id;
    copy.data.name = copy.name;
    copy.data.transform.x += 100;
    copy.data.transform.y += 140;
    copy.bounds.x += 100;
    copy.bounds.y += 140;
    source.elements[copy.id] = copy;
    source.pages[source.pageIds[0]].elementIds.push(copy.id);
    source.metadata.designLab.groups = [{ id: 'group-drag-pair', name: 'Drag pair', layerIds: [id, copy.id] }];
    await studio.applySource(source);
    return [id, copy.id];
  }, id);
  const firstId = (await workspace(page)).artboards[0].id;
  await page.getByRole('region', { name: 'Canvas layer stack' }).getByRole('button', { name: /^Canvas idea/ }).click();
  await expect(page.locator('.canvas-selection-assembly')).toBeVisible();
  const rects = () => Promise.all(ids.map((id) => page.locator(`[data-canvas-layer-id="${id}"]`).boundingBox()));
  const initial = await rects();
  const board = (await page.locator(`[data-artboard-id="${firstId}"]`).boundingBox())!;
  for (const target of [{ x: board.x + board.width / 2, y: board.y - 55 },
    { x: board.x + board.width / 2, y: board.y + board.height / 2 }]) {
    const before = (await rects())[0]!;
    const start = { x: before.x + 12, y: before.y + 10 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + target.x - before.x - before.width / 2,
      start.y + target.y - before.y - before.height / 2, { steps: 18 });
    const preview = await rects();
    await page.mouse.up();
    const owner = target.y < board.y ? 'canvas' : firstId;
    await expect.poll(async () => (await workspace(page)).activeSurface).toBe(owner);
    const after = await rects();
    for (let i = 0; i < ids.length; i += 1) {
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[i]![key] - preview[i]![key])).toBeLessThan(1);
      expect(after[i]!.width).toBeCloseTo(initial[i]!.width, 0);
      expect(after[i]!.height).toBeCloseTo(initial[i]!.height, 0);
    }
    expect(after[1]!.x - after[0]!.x).toBeCloseTo(initial[1]!.x - initial[0]!.x, 0);
    expect(after[1]!.y - after[0]!.y).toBeCloseTo(initial[1]!.y - initial[0]!.y, 0);
    await expect(page.locator('[data-interaction-preview]')).toHaveCount(0);
    await expect(page.locator('.canvas-selection-assembly')).toBeVisible();
  }
});

test('releasing outside the canvas ends the drag and subsequent hover cannot keep moving the layer', async ({ page }) => {
  const id = await prepare(page);
  await page.getByRole('region', { name: 'Canvas layer stack' }).getByRole('button', { name: /^Canvas idea/ }).click();
  const edge = (await page.getByRole('button', { name: 'Move Canvas idea from top edge', exact: true }).boundingBox())!;
  const viewport = (await page.getByRole('region', { name: 'Canvas viewport', exact: true }).boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 4, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x - 90, viewport.y + 80, { steps: 18 });
  await page.mouse.up();
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([id]);
  await expect(page.locator('[data-interaction-preview]')).toHaveCount(0);
  const dropped = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()).metadata.designLab.workspace.canvas.snapshot);
  await page.mouse.move(viewport.x + 180, viewport.y + 200, { steps: 18 });
  await page.mouse.move(viewport.x + 250, viewport.y + 260, { steps: 18 });
  const afterHover = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()).metadata.designLab.workspace.canvas.snapshot);
  expect(afterHover).toEqual(dropped);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).canvas.layerIds).toEqual([]);
  expect((await workspace(page)).artboards[0].layerIds).toContain(id);
});
