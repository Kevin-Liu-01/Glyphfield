import { expect, test } from '@playwright/test';
import type { ExportPreviewAsset } from '../src/components/ExportPreview';

test('typography-only source application is a complete undoable and redoable canvas action', async ({ page }) => {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const design = source.metadata.designLab;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    const text = board.snapshot.textLayers[0];
    source.pages[source.pageIds[0]].elementIds = [text.id];
    source.elements = { [text.id]: source.elements[text.id] };
    Object.assign(board.snapshot, { layerOrder: [text.id], shaderLayers: [], effectLayers: [], logos: [], assets: [], groups: [], layerShaders: {} });
    Object.assign(design.timeline, { paused: true, timeMs: 0, frame: 0 });
    design.shaderSequence.targetLayerId = null;
    design.layerShaders = {};
    board.snapshot.timeline = design.timeline;
    board.snapshot.shaderSequence = design.shaderSequence;
    design.workspace.artboards = [board];
    await studio.applySource(source);
  });
  const text = page.locator('.design-artboard-shell[data-active="true"] [data-canvas-editable]').first();
  const originalFamily = await text.evaluate((element) => getComputedStyle(element).fontFamily);
  const originalArtboards = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.workspace.artboards);
  await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    // Same editable canvas, now including embedded project-local typography.
    const artifact = await studio.invoke('design.export.project') as ExportPreviewAsset;
    if (!(artifact.blob instanceof Blob)) throw new Error('Project export has no font payload');
    await studio.applySource(await artifact.blob.text());
  });
  await expect.poll(() => text.evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Glyphfield Project');
  const imported = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.identity);
  expect(await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.workspace.artboards)).toEqual(originalArtboards);
  await page.getByRole('button', { name: 'Action history', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Action history', exact: true });
  await history.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => text.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(originalFamily);
  expect(await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.identity)).toBeUndefined();
  await history.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.identity)).toEqual(imported);
  await expect.poll(() => text.evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Glyphfield Project');
});
