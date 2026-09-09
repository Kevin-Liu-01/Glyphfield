import { expect, test, type Page } from '@playwright/test';

async function prepareBoards(page: Page) {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const text = Object.values(source.elements).find((entry: any) => entry.kind === 'text') as any;
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 1600, height: 900, background: '#101010', elementIds: [text.id] });
    Object.assign(text, { content: 'First board', name: 'First text', hidden: false });
    Object.assign(text.data, { name: text.name, value: text.content, color: '#FFFFFF',
      transform: { x: 0, y: 0, scale: 0.5, widthScale: 1, heightScale: 1 } });
    source.elements = { [text.id]: text };
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards[0];
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide',
      backgroundColor: '#101010', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [], logos: [],
      effectLayers: [], assets: [], groups: [], layerShaders: {}, timeline: design.timeline,
      shaderSequence: design.shaderSequence });
    design.workspace.artboards = [board];
    await studio.applySource(source);
  });
  await page.locator('button[title="Add blank artboard"]:visible').click();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
}

async function workspace(page: Page) {
  return page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.workspace);
}

test('inactive artboard drags from its surface, then a first content click edits without reframing', async ({ page }) => {
  await prepareBoards(page);
  const before = await workspace(page);
  const board = page.locator('.design-artboard-shell').first();
  const view = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
  const transform = await view.evaluate((element) => element.style.transform);
  const box = (await board.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2 + 70, box.y + box.height * 0.2 + 40, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await workspace(page)).artboards[0].x).toBeGreaterThan(before.artboards[0].x + 50);
  await expect(board).toHaveAttribute('data-active', 'true');
  expect(await view.evaluate((element) => element.style.transform)).toBe(transform);
  await board.locator('[data-canvas-editable]').click();
  await expect(page.getByRole('slider', { name: 'Text size', exact: true })).toBeVisible();
  const after = await workspace(page);
  expect(after.artboards[0].snapshot.textLayers[0].value).toBe('First board');
  expect(after.artboards[0].snapshot.textLayers[0].transform).toEqual(before.artboards[0].snapshot.textLayers[0].transform);
  expect(after.artboards[1].x).toBe(before.artboards[1].x);
});

test('minimap navigation pans the view without moving artboards and centers the active board', async ({ page }) => {
  await prepareBoards(page);
  const before = await workspace(page);
  const map = page.getByRole('region', { name: 'Canvas map', exact: true });
  await expect(map).toBeVisible();
  const surface = page.getByRole('slider', { name: 'Navigate canvas map', exact: true });
  const view = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
  const initial = await view.evaluate((element) => element.style.transform);
  await surface.click({ position: { x: 24, y: 24 } });
  await expect.poll(() => view.evaluate((element) => element.style.transform)).not.toBe(initial);
  const after = await workspace(page);
  expect(after.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y })))
    .toEqual(before.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y })));
  await page.getByRole('button', { name: 'Center selected artboard', exact: true }).click();
  const board = (await page.locator('.design-artboard-shell[data-active="true"]').boundingBox())!;
  const viewport = (await page.getByRole('region', { name: 'Canvas viewport', exact: true }).boundingBox())!;
  expect(Math.abs(board.x + board.width / 2 - viewport.x - viewport.width / 2)).toBeLessThan(3);
  expect(Math.abs(board.y + board.height / 2 - viewport.y - viewport.height / 2)).toBeLessThan(3);
});

async function stableWorkspace(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    try { return Boolean(window.glyphfield!.studio.readSource()); } catch { return false; }
  })).toBe(true);
  return workspace(page);
}

async function canvasZoom(page: Page) {
  return page.locator('.canvas-viewport-stage.design-artboard-viewport-stage')
    .evaluate((element) => new DOMMatrixReadOnly(element.style.transform).a);
}

for (const gesture of ['Space', 'middle'] as const) {
  test(`${gesture} drag over editable content pans without changing layers or artboards`, async ({ page }) => {
    await prepareBoards(page);
    const viewport = page.getByRole('region', { name: 'Canvas viewport', exact: true });
    const stage = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
    const content = page.locator('.design-artboard-shell[data-active="true"] [data-canvas-editable]').first();
    const box = (await content.boundingBox())!;
    const before = await stableWorkspace(page);
    const zoom = await canvasZoom(page);
    const initial = await stage.evaluate((element) => element.style.transform);
    await viewport.focus();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (gesture === 'Space') {
      await page.keyboard.down('Space');
      await expect(viewport).toHaveAttribute('data-space-pressed', 'true');
    }
    const button = gesture === 'middle' ? 'middle' : 'left';
    await page.mouse.down({ button });
    await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 35, { steps: 8 });
    await page.mouse.up({ button });
    if (gesture === 'Space') await page.keyboard.up('Space');
    await expect.poll(() => stage.evaluate((element) => element.style.transform)).not.toBe(initial);
    await expect(viewport).not.toHaveAttribute('data-panning', 'true');
    expect(await canvasZoom(page)).toBe(zoom);
    expect(await stableWorkspace(page)).toEqual(before);
  });
}

test('cancelling an artboard surface drag rolls back transient geometry and selection', async ({ page }) => {
  await prepareBoards(page);
  const before = await stableWorkspace(page);
  const board = page.locator('.design-artboard-shell').first();
  const box = (await board.boundingBox())!;
  const originalTransform = await board.evaluate((element) => element.style.transform);
  await page.evaluate(() => {
    window.addEventListener('pointerdown', (event) => {
      document.documentElement.dataset.navigationTestPointerId = String(event.pointerId);
    }, { once: true, capture: true });
  });
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2 + 55, box.y + box.height * 0.2 + 30, { steps: 8 });
  await expect(board).toHaveAttribute('data-moving', 'true');
  // Exercise the actual captured pointer's interrupted lifecycle, not a guessed ID.
  await page.evaluate(() => {
    const pointerId = Number(document.documentElement.dataset.navigationTestPointerId);
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId }));
    delete document.documentElement.dataset.navigationTestPointerId;
  });
  await page.mouse.up();
  await expect(board).not.toHaveAttribute('data-moving', 'true');
  await expect(board).not.toHaveAttribute('data-selecting', 'true');
  expect(await board.evaluate((element) => element.style.transform)).toBe(originalTransform);
  expect(await stableWorkspace(page)).toEqual(before);
});

test('double-clicking inactive artboard content activates and selects that text without reframing', async ({ page }) => {
  await prepareBoards(page);
  const before = await stableWorkspace(page);
  const board = page.locator('.design-artboard-shell').first();
  const text = board.locator('[data-canvas-layer-id]').first();
  const box = (await text.boundingBox())!;
  const stage = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
  const initial = await stage.evaluate((element) => element.style.transform);
  // Real click ordering covers activation between the first and second click.
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 90 });
  await expect(board).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('slider', { name: 'Text size', exact: true })).toBeVisible();
  expect(await stage.evaluate((element) => element.style.transform)).toBe(initial);
  const after = await stableWorkspace(page);
  expect(after.artboards[0].snapshot.textLayers).toEqual(before.artboards[0].snapshot.textLayers);
});

test('minimap dragging keeps fixed map bounds and does not mutate zoom or source', async ({ page }) => {
  await prepareBoards(page);
  const before = await stableWorkspace(page);
  const surface = page.getByRole('slider', { name: 'Navigate canvas map', exact: true });
  const map = page.getByRole('region', { name: 'Canvas map', exact: true });
  const stage = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
  const initial = await stage.evaluate((element) => element.style.transform);
  const zoom = await canvasZoom(page);
  const bounds = await surface.getAttribute('viewBox');
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.65, { steps: 12 });
  await expect(surface).toHaveAttribute('data-dragging', 'true');
  await expect(surface).toHaveAttribute('viewBox', bounds!);
  await expect.poll(() => stage.evaluate((element) => element.style.transform)).not.toBe(initial);
  await page.mouse.up();
  await expect(surface).not.toHaveAttribute('data-dragging', 'true');
  expect(await canvasZoom(page)).toBe(zoom);
  expect(await stableWorkspace(page)).toEqual(before);
  await expect(map.locator('canvas, img, video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide artboard map', exact: true }).click();
  await expect(surface).toHaveCount(0);
  await page.getByRole('button', { name: 'Show artboard map', exact: true }).click();
  await expect(surface).toBeVisible();
});

test('switching artboards flushes the current canvas text edit and retains it on return', async ({ page }) => {
  await prepareBoards(page);
  const boards = page.locator('.design-artboard-shell');
  const active = boards.nth(1);
  const text = active.locator('[data-canvas-editable]').first();
  const before = await stableWorkspace(page);
  await text.fill('Retained while switching boards');
  // Pointer down on the other board must flush the editor before unmounting it.
  const firstBox = (await boards.first().boundingBox())!;
  await page.mouse.click(firstBox.x + firstBox.width * 0.2, firstBox.y + firstBox.height * 0.2);
  await expect(boards.first()).toHaveAttribute('data-active', 'true');
  await expect.poll(async () => (await stableWorkspace(page)).artboards[1].snapshot.textLayers[0].value)
    .toBe('Retained while switching boards');
  const secondBox = (await active.boundingBox())!;
  await page.mouse.click(secondBox.x + secondBox.width * 0.2, secondBox.y + secondBox.height * 0.2);
  await expect(active).toHaveAttribute('data-active', 'true');
  await expect(active.locator('[data-canvas-editable]').first()).toHaveText('Retained while switching boards');
  const after = await stableWorkspace(page);
  expect(after.artboards[1].snapshot.textLayers[0].transform).toEqual(before.artboards[1].snapshot.textLayers[0].transform);
  expect(after.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y })))
    .toEqual(before.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y })));
});

async function viewportWorldCenter(page: Page) {
  return page.locator('.canvas-viewport-stage.design-artboard-viewport-stage').evaluate((stage) => {
    const viewport = stage.closest('.canvas-viewport-scroll') as HTMLElement;
    const matrix = new DOMMatrixReadOnly(stage.style.transform);
    return {
      x: (viewport.clientWidth / 2 - matrix.e) / matrix.a,
      y: (viewport.clientHeight / 2 - matrix.f) / matrix.d,
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };
  });
}

test('resizing the workspace retains its world center and zoom', async ({ page }) => {
  await prepareBoards(page);
  await page.getByRole('button', { name: 'Center selected artboard', exact: true }).click();
  const before = await viewportWorldCenter(page);
  const zoom = await canvasZoom(page);
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect.poll(async () => {
    const after = await viewportWorldCenter(page);
    return after.width !== before.width || after.height !== before.height;
  }).toBe(true);
  await expect.poll(async () => {
    const after = await viewportWorldCenter(page);
    return Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y));
  }).toBeLessThan(2);
  expect(await canvasZoom(page)).toBe(zoom);
});
