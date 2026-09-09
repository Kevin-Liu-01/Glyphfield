import { expect, test, type Page } from '@playwright/test';
import type { CanvasElement } from '../src/lib/canvasDocument';
import type { ExportPreviewAsset } from '../src/components/ExportPreview';

async function prepareProject(page: Page) {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  return page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    const text = (Object.values(source.elements) as CanvasElement[]).find((element) => element.kind === 'text')!;
    Object.assign(text, { content: 'Shared editable text', name: 'Shared headline', hidden: false });
    Object.assign(text.data, { value: text.content, name: text.name, color: '#FFFFFF' });
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 960, height: 540, background: '#101010', elementIds: [text.id] });
    source.elements = { [text.id]: text };
    source.assets = {};
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry: { id: string }) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board, { name: 'Shared first', x: 80, y: 96 });
    Object.assign(board.snapshot, { dimensions: { width: 960, height: 540 }, ratio: 'wide',
      backgroundColor: '#101010', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [], logos: [],
      effectLayers: [], assets: [], groups: [], layerShaders: {}, timeline: design.timeline,
      shaderSequence: design.shaderSequence });
    const localImage = URL.createObjectURL(new Blob([
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path fill="#44dd88" d="M0 0h32v16H0z"/></svg>',
    ], { type: 'image/svg+xml' }));
    const image = { id: 'asset-project-file', name: 'Inactive local image', url: localImage,
      visible: true, opacity: 1, transform: { x: 0, y: 0, scale: 1 } };
    design.workspace.artboards = [board, { ...structuredClone(board), id: 'artboard-shared-second', name: 'Shared second', x: 1100, y: 220,
      snapshot: { ...structuredClone(board.snapshot), layerOrder: [image.id], textLayers: [], assets: [image] } }];
    await studio.applySource(source);
    await document.fonts.ready;
    return { brandId: source.brandId, textId: text.id, localImage };
  });
}

test('project download and real file chooser preserve editable artboards, embedded images, and isolated fonts', async ({ page }) => {
  const original = await prepareProject(page);
  const downloaded = page.waitForEvent('download');
  const project = await page.evaluate(async () => {
    const studio = window.glyphfield!.studio;
    const artifact = await studio.invoke('design.export.project') as ExportPreviewAsset;
    if (!(artifact.blob instanceof Blob) || artifact.blob.size === 0) throw new Error('Project export has no bytes');
    const source = await artifact.blob.text();
    await studio.download(artifact);
    return { source, fileName: artifact.fileName, mimeType: artifact.blob.type, format: artifact.format, previewKind: artifact.previewKind };
  });
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe(project.fileName);
  expect(project).toMatchObject({ mimeType: 'application/json', format: 'JSON', previewKind: 'file' });
  expect(project.fileName).toMatch(/\.glyphfield\.json$/);
  expect(project.source).not.toContain('blob:');
  const portable = JSON.parse(project.source);
  expect(portable.schemaVersion).toBe(2);
  expect(portable.metadata.designLab.workspace.artboards).toHaveLength(2);
  expect(portable.metadata.designLab.workspace.artboards[1].snapshot.assets[0].url).toMatch(/^data:image\/svg\+xml/);
  expect(portable.metadata.designLab.identity.fonts.length).toBeGreaterThan(0);
  expect(portable.metadata.designLab.identity.fonts.every((font: { path: string }) => font.path.startsWith('data:'))).toBe(true);

  // Remove the original browser-local asset and change visible source before opening the saved bytes.
  await page.evaluate(async ({ textId, localImage }) => {
    URL.revokeObjectURL(localImage);
    const studio = window.glyphfield!.studio;
    const source = JSON.parse(studio.readSource() as string);
    source.elements[textId].content = 'Changed after export';
    source.elements[textId].data.value = 'Changed after export';
    source.metadata.designLab.workspace.artboards = source.metadata.designLab.workspace.artboards.slice(0, 1);
    await studio.applySource(source);
  }, original);
  await expect(page.locator('.design-artboard-shell')).toHaveCount(1);
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open project file', exact: true }).click();
  await (await choosing).setFiles({ name: project.fileName, mimeType: project.mimeType, buffer: Buffer.from(project.source) });
  await expect(page.getByRole('status').filter({ hasText: `Opened ${project.fileName}.` })).toHaveCount(1);
  await expect(page.locator('.design-artboard-shell')).toHaveCount(2);
  const restored = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string));
  expect(restored.brandId).toBe(original.brandId);
  expect(restored.elements[original.textId].content).toBe('Shared editable text');
  expect(restored.metadata.designLab.workspace.artboards[1]).toMatchObject({ id: 'artboard-shared-second', name: 'Shared second', x: 1100, y: 220 });
  expect(restored.metadata.designLab.identity.fonts[0].family).toMatch(/^Glyphfield Project /);
  expect(restored.metadata.designLab.identity.fonts[0].path).toBe(portable.metadata.designLab.identity.fonts[0].path);
  await expect(page.locator('.design-artboard-shell[data-active="true"] [data-canvas-editable]')).toHaveText('Shared editable text');
  await page.getByRole('button', { name: /^Autosaved draft/ }).waitFor();
  await page.reload();
  await expect(page.locator('.design-artboard-shell')).toHaveCount(2);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource() as string).metadata.designLab.identity?.fonts[0]?.family))
    .toBe(restored.metadata.designLab.identity.fonts[0].family);
  const editable = page.locator('.design-artboard-shell[data-active="true"] [data-canvas-editable]');
  await editable.click();
  await expect(page.getByRole('combobox', { name: 'Text font role', exact: true })).not.toContainText('Glyphfield Project');
  await page.keyboard.insertText('!');
  await expect.poll(() => page.evaluate((id) => JSON.parse(window.glyphfield!.studio.readSource() as string).elements[id].content, original.textId)).toContain('!');
});

test('a malformed project selected through the real chooser leaves the current editable workspace intact', async ({ page }) => {
  const original = await prepareProject(page);
  const before = await page.evaluate(() => window.glyphfield!.studio.readSource());
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open project file', exact: true }).click();
  await (await choosing).setFiles({ name: 'broken.glyphfield.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(page.getByRole('alert').filter({ hasText: 'Canvas schema version 99 is unsupported.' })).toBeVisible();
  const after = await page.evaluate(() => window.glyphfield!.studio.readSource());
  expect(after).toBe(before);
  await expect(page.locator('.design-artboard-shell[data-active="true"] [data-canvas-editable]')).toHaveText('Shared editable text');
  await page.evaluate((url) => URL.revokeObjectURL(url), original.localImage);
});
