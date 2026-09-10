import { expect, test, type Page } from '@playwright/test';

test('first-load artboard fit waits for the toolbar and canvas layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/studio?tool=material&project=starter');
  await expect(page.getByRole('region', { name: 'Artboard workspace controls', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.shader-lab-v2-composer-viewport .canvas-viewport-scroll');
    const artboard = document.querySelector<HTMLElement>('[data-canvas-focus-target="true"]');
    const zoom = document.querySelector('.shader-lab-v2-composer-viewport .canvas-zoom-value')?.textContent;
    if (!viewport || !artboard || !zoom) return false;
    const expected = Math.min(100, (viewport.clientWidth - 96) / artboard.offsetWidth * 100,
      (viewport.clientHeight - 96) / artboard.offsetHeight * 100);
    return Math.abs(parseFloat(zoom) - Math.max(10, Math.round(expected / 5) * 5)) <= 5;
  })).toBe(true);
});

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

async function openCanvasMap(page: Page) {
  const map = page.getByRole('region', { name: 'Canvas map', exact: true });
  await expect(map).toBeVisible();
  if (await map.getAttribute('data-collapsed') === 'true') {
    await map.getByRole('button', { name: 'Show artboard map', exact: true }).click();
  }
  await expect(map.getByRole('group', { name: 'Artboard map actions', exact: true })).toBeVisible();
  return map;
}

async function expectArtboardsInView(page: Page) {
  await expect.poll(() => page.getByRole('region', { name: 'Canvas viewport', exact: true }).evaluate((viewport) => {
    const view = viewport.getBoundingClientRect();
    const boards = Array.from(viewport.querySelectorAll('.design-artboard-shell'));
    return boards.length > 0 && boards.every((board) => {
      const bounds = board.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0
        && bounds.left >= view.left - 1 && bounds.right <= view.right + 1
        && bounds.top >= view.top - 1 && bounds.bottom <= view.bottom + 1;
    });
  })).toBe(true);
}

test('Design Lab keeps saved versions in the header and canvas editing controls local', async ({ page }) => {
  await prepareBoards(page);
  const bar = page.getByRole('region', { name: 'Artboard workspace controls', exact: true });
  const viewControls = page.getByRole('group', { name: 'Canvas zoom', exact: true });
  await expect(bar).toHaveCount(1);
  const header = page.locator('.shader-lab-v2 [data-studio-tool-header]:visible');
  await expect(header).toHaveAttribute('data-layout', 'balanced');
  await expect(header.locator('[data-slot="trailing"]').getByRole('group', { name: 'Project files and source', exact: true })).toBeVisible();
  const versionsGroup = header.locator('[data-slot="trailing"]').getByRole('group', { name: 'Design saving and versions', exact: true });
  await expect(versionsGroup).toBeVisible();
  const status = versionsGroup.locator('[data-design-version-status]');
  const history = versionsGroup.locator('button[title="Open saved designs"]');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('data-compact', 'true');
  await expect(status).toHaveCSS('width', '24px');
  await expect(status).toHaveCSS('height', '32px');
  await expect(status.locator('small')).toHaveClass('sr-only');
  await expect(status).toHaveText('Autosaved');
  await expect(history).toHaveAccessibleDescription('Autosaved draft: Autosaved');
  const compactStatus = await status.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const previous = element.previousElementSibling!;
    const picker = previous.getBoundingClientRect();
    return { followsPicker: previous.getAttribute('aria-describedby') === element.id,
      gap: bounds.left - picker.right, trailingGap: element.parentElement!.getBoundingClientRect().right - bounds.right };
  });
  expect(compactStatus.followsPicker).toBe(true);
  expect(compactStatus.gap).toBeGreaterThanOrEqual(0);
  expect(compactStatus.gap).toBeLessThanOrEqual(8);
  expect(compactStatus.trailingGap).toBeLessThanOrEqual(1);
  const sourceButton = header.getByRole('button', { name: 'Edit source code', exact: true });
  const sourceButtonBeforeEdit = (await sourceButton.boundingBox())!;
  await expect(header.locator('[data-slot="trailing"]').getByRole('group', { name: 'Export design', exact: true })).toBeVisible();
  await expect(bar.locator('[data-slot="artboard-start"]').getByRole('button', { name: 'Save design', exact: true })).toHaveCount(0);
  await expect(bar.getByRole('combobox', { name: 'Active design artboard', exact: true })).toBeVisible();
  await expect(bar.locator('button[title="Open saved designs"]')).toHaveCount(0);
  await expect(viewControls.locator('button[title="Open saved designs"]')).toHaveCount(0);
  await expect(versionsGroup.locator('button[title="Open saved designs"]')).toBeVisible();
  await bar.getByRole('button', { name: /Set artboard size/ }).click();
  const setup = page.getByRole('dialog', { name: 'Artboard setup', exact: true });
  const name = setup.getByRole('textbox', { name: 'Artboard name', exact: true });
  await name.fill('');
  await name.pressSequentially('Toolbar board');
  await expect(name).toHaveValue('Toolbar board');
  await page.keyboard.press('Escape');
  await expect(bar.getByRole('combobox', { name: 'Active design artboard', exact: true })).toContainText('Toolbar board');
  await expect(status).toHaveText('Autosaved');
  const sourceButtonAfterEdit = (await sourceButton.boundingBox())!;
  expect(Math.abs(sourceButtonAfterEdit.x - sourceButtonBeforeEdit.x)).toBeLessThan(1);
  expect(Math.abs(sourceButtonAfterEdit.y - sourceButtonBeforeEdit.y)).toBeLessThan(1);
  await versionsGroup.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(versionsGroup.getByRole('button', { name: 'Design saved', exact: true })).toBeDisabled();
  await versionsGroup.locator('button[title="Open saved designs"]').click();
  const versions = page.getByRole('region', { name: 'Design Lab saved designs', exact: true });
  await expect(versions).toBeVisible();
  await versions.getByRole('textbox', { name: 'Current design name', exact: true }).fill('Toolbar checkpoint');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(versions).toHaveCount(0);
  await expect(versionsGroup.getByRole('button', { name: 'Design saved', exact: true })).toBeDisabled();
  await expect(history).toHaveAccessibleDescription(/Toolbar checkpoint: Saved/);

  await bar.getByRole('button', { name: 'Add blank artboard', exact: true }).click();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(3);
  await viewControls.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(2);
  await viewControls.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(3);
  await bar.getByRole('combobox', { name: 'Active design artboard', exact: true }).click();
  await page.getByRole('option', { name: 'Toolbar board', exact: true }).click();
  await expect.poll(async () => {
    const state = await workspace(page);
    return state.artboards.find((board: { id: string }) => board.id === state.activeArtboardId)?.name;
  }).toBe('Toolbar board');

  await versionsGroup.locator('button[title="Open saved designs"]').click();
  await expect(versions.getByRole('textbox', { name: 'Current design name', exact: true })).toHaveValue('Toolbar checkpoint');
  await page.keyboard.press('Escape');
  for (const width of [1440, 1100, 780]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(bar).toBeVisible();
    await expect(status).toHaveCSS('width', '24px');
    await expect(status).toHaveCSS('height', '32px');
    const bounds = (await bar.boundingBox())!;
    const actions = (await bar.locator('[data-slot="artboard-end"]').boundingBox())!;
    const scrollable = await bar.evaluate((element) => element.scrollWidth > element.clientWidth);
    if (scrollable) {
      await expect(bar).toHaveCSS('overflow-x', 'auto');
      expect(bounds.height).toBeLessThanOrEqual(48);
    } else {
      expect(bounds.x + bounds.width - (actions.x + actions.width)).toBeLessThan(12);
    }
    for (const label of ['Add blank artboard', 'Duplicate active artboard', 'Delete active artboard', 'Artboard tutorial']) {
      const button = bar.getByRole('button', { name: label, exact: true });
      // Phone-width canvases keep one row; every command remains reachable.
      if (scrollable) await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    }
    await expect(bar.getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toHaveCount(0);
    const map = await openCanvasMap(page);
    await expect(map.getByRole('group', { name: 'Artboard map actions', exact: true })
      .getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toBeVisible();
    await expect(map.getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toHaveText('Tidy');
    const mapButtons = await map.getByRole('group', { name: 'Artboard map actions', exact: true })
      .getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
    expect(mapButtons).toHaveLength(3);
    for (const button of mapButtons) {
      expect(Math.abs(button.y - mapButtons[0].y)).toBeLessThan(1);
      expect(Math.abs(button.width - mapButtons[0].width)).toBeLessThan(1);
    }
    await expect(page.getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toHaveCount(1);
    const viewBox = (await viewControls.boundingBox())!;
    expect(viewBox.x).toBeGreaterThanOrEqual(0);
    expect(viewBox.x + viewBox.width).toBeLessThanOrEqual(width);
    const headerBounds = (await header.boundingBox())!;
    const identity = (await header.locator('[data-slot="identity"]').boundingBox())!;
    const trailing = (await header.locator('[data-slot="trailing"]').boundingBox())!;
    expect(identity.x + identity.width).toBeLessThanOrEqual(trailing.x);
    expect(trailing.x + trailing.width).toBeLessThanOrEqual(headerBounds.x + headerBounds.width);
    expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(width + 1);
  }
});

test('Design Lab toolbar menus close when their tool is left or another history is opened', async ({ page }) => {
  await prepareBoards(page);
  const bar = page.getByRole('region', { name: 'Artboard workspace controls', exact: true });
  await bar.press('Shift+F10');
  await expect(page.locator('.studio-context-menu')).toBeVisible();
  await page.locator('.studio-nav').getByRole('button', { name: 'Brand identity', exact: true }).press('Enter');
  await expect(page).toHaveURL(/tool=identity/);
  await expect(page.locator('.studio-context-menu')).toHaveCount(0);
  await page.locator('.studio-nav').getByRole('button', { name: 'Design Lab', exact: true }).press('Enter');
  const viewControls = page.getByRole('group', { name: 'Canvas zoom', exact: true });
  await viewControls.getByRole('button', { name: 'Action history', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Action history', exact: true })).toBeVisible();
  const saving = page.locator('.shader-lab-v2 [data-studio-tool-header]:visible')
    .getByRole('group', { name: 'Design saving and versions', exact: true });
  await saving.locator('button[title="Open saved designs"]').click();
  await expect(page.locator('.canvas-action-history')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Design Lab saved designs', exact: true })).toBeVisible();
  await page.locator('.studio-nav').getByRole('button', { name: 'Brand identity', exact: true }).press('Enter');
  await expect(page.getByRole('region', { name: 'Design Lab saved designs', exact: true })).toHaveCount(0);
  await page.locator('.studio-nav').getByRole('button', { name: 'Design Lab', exact: true }).press('Enter');
  await expect(viewControls.getByRole('button', { name: 'Action history', exact: true })).toHaveAttribute('aria-expanded', 'false');
});

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
  await openCanvasMap(page);
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

test('Canvas map Fit all and Center selected are view-only while Tidy rearranges, fits, and undoes board geometry', async ({ page }) => {
  await prepareBoards(page);
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const boards = source.metadata.designLab.workspace.artboards;
    Object.assign(boards[0], { x: 500, y: 200 });
    Object.assign(boards[1], { x: 1950, y: 1150 });
    await studio.applySource(source);
  });
  const before = await stableWorkspace(page);
  const map = await openCanvasMap(page);
  const actions = map.getByRole('group', { name: 'Artboard map actions', exact: true });
  const viewControls = page.getByRole('group', { name: 'Canvas zoom', exact: true });
  const stage = page.locator('.canvas-viewport-stage.design-artboard-viewport-stage');
  const bar = page.getByRole('region', { name: 'Artboard workspace controls', exact: true });
  await expect(bar.getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tidy and fit artboards', exact: true })).toHaveCount(1);

  // Start zoomed in so Fit all must visibly change the viewport, not just no-op.
  await viewControls.locator('button.canvas-zoom-value').click();
  await expect.poll(() => canvasZoom(page)).toBe(1);
  await actions.getByRole('button', { name: 'Fit all', exact: true }).click();
  await expectArtboardsInView(page);
  expect(await canvasZoom(page)).toBeLessThan(1);
  expect(await stableWorkspace(page)).toEqual(before);

  const fittedZoom = await canvasZoom(page);
  const fittedTransform = await stage.evaluate((element) => element.style.transform);
  await actions.getByRole('button', { name: 'Center selected artboard', exact: true }).click();
  await expect.poll(() => stage.evaluate((element) => element.style.transform)).not.toBe(fittedTransform);
  await expect.poll(async () => {
    const board = (await page.locator('.design-artboard-shell[data-active="true"]').boundingBox())!;
    const view = (await page.getByRole('region', { name: 'Canvas viewport', exact: true }).boundingBox())!;
    return Math.max(Math.abs(board.x + board.width / 2 - view.x - view.width / 2),
      Math.abs(board.y + board.height / 2 - view.y - view.height / 2));
  }).toBeLessThan(3);
  expect(await canvasZoom(page)).toBe(fittedZoom);
  expect(await stableWorkspace(page)).toEqual(before);

  // Tidy is the one document action in this group: it changes board positions,
  // preserves their contents, and fits the newly arranged bounds automatically.
  await viewControls.locator('button.canvas-zoom-value').click();
  await actions.getByRole('button', { name: 'Tidy and fit artboards', exact: true }).click();
  await expect.poll(async () => {
    const state = await stableWorkspace(page);
    return state.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y }));
  }).not.toEqual(before.artboards.map(({ x, y }: { x: number; y: number }) => ({ x, y })));
  const arranged = await stableWorkspace(page);
  expect(arranged.activeArtboardId).toBe(before.activeArtboardId);
  expect(arranged.artboards[0].y).toBe(arranged.artboards[1].y);
  expect(arranged.artboards[1].x).toBeGreaterThan(arranged.artboards[0].x);
  expect(arranged.artboards.map(({ x: _x, y: _y, ...board }: { x: number; y: number }) => board))
    .toEqual(before.artboards.map(({ x: _x, y: _y, ...board }: { x: number; y: number }) => board));
  await expectArtboardsInView(page);
  expect(await canvasZoom(page)).toBeLessThan(1);

  await viewControls.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => stableWorkspace(page)).toEqual(before);
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
  const map = await openCanvasMap(page);
  const surface = page.getByRole('slider', { name: 'Navigate canvas map', exact: true });
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
