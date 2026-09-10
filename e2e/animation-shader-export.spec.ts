import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const animation = (page: Page) => page.locator('.animation-studio:visible');
const shader = (page: Page) => animation(page).locator('[data-animation-shader-layer]');

// Public source application only: preserve the current settings, then author a
// single blank text hold so the real shader is the entire exported composition.
async function prepareAnimation(page: Page, materialId = 'paper-dithering', override = false) {
  await page.goto('/studio?tool=animation');
  const sourceButton = animation(page).getByRole('button', { name: 'Edit source code', exact: true });
  await expect(sourceButton).toBeEnabled();
  await sourceButton.click();
  await page.getByRole('button', { name: 'Close source editor', exact: true }).waitFor();
  await page.evaluate(async ({ materialId, override }) => {
    const studio = window.glyphfield!.studio;
    const document = JSON.parse(studio.readSource());
    const state = structuredClone(document.metadata.animation);
    state.includeBrandLogo = false;
    state.mode = 'text';
    state.textFrames = ' ';
    state.sequenceOrder = ['text-0'];
    state.backgroundOverrides = {};
    state.frameSettings = {};
    const materialSettings = { ...state.settings.shaderSettings, grain: 60, brightness: 1.35,
      speed: 0.65, colorA: '#292135', colorB: '#DC8967', colorC: '#83C1D6' };
    state.settings = { ...state.settings, width: 320, height: 180, holdMs: 1000,
      transitionMs: 0, fps: 10, colors: 256, loop: true, packageId: 'crossfade', shaderSettings: materialSettings };
    state.sequenceBackground = { ...state.sequenceBackground, style: 'shader', materialId, opacity: 1,
      colorA: materialSettings.colorA, colorB: materialSettings.colorB, colorC: materialSettings.colorC,
      materialSettings };
    if (override) {
      state.backgroundOverrides = { 'text-0': true };
      state.frameSettings = { 'text-0': { background: { ...state.sequenceBackground } } };
    }
    delete state.artboards;
    delete state.activeArtboardId;
    await studio.applySource(state);
  }, { materialId, override });
  await expect(sourceButton).toBeEnabled();
  await page.getByRole('button', { name: 'Close source editor', exact: true }).click();
  await expect(shader(page).locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await expect(shader(page).locator('canvas')).toBeVisible();
  if (materialId !== 'pavel-fluid-energy') {
    await expect.poll(async () => (await pose(page)).colors).toBeGreaterThan(1);
  }
  return animation(page);
}

async function pose(page: Page) {
  return shader(page).evaluate((root) => {
    const input = root.querySelector('canvas')!;
    const scratch = document.createElement('canvas');
    scratch.width = input.width; scratch.height = input.height;
    const context = scratch.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(input, 0, 0);
    const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
    let hash = 2166136261;
    const colors = new Set<number>();
    for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
    for (let index = 0; index < pixels.length && colors.size < 64; index += 4) {
      colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
    }
    return { hash: hash >>> 0, colors: colors.size, width: input.width, height: input.height };
  });
}

function decodedFrames(path: string, oneFrame = false) {
  return execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', 'scale=64:36',
    ...(oneFrame ? ['-frames:v', '1'] : []), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 16 * 1024 * 1024 });
}

function meanError(actual: Uint8Array, expected: Uint8Array) {
  expect(actual.length).toBe(expected.length);
  let error = 0;
  for (let index = 0; index < actual.length; index += 1) error += Math.abs(actual[index] - expected[index]);
  return error / actual.length;
}

for (const { format, override } of [
  { format: 'gif', override: false }, { format: 'mp4', override: false },
  { format: 'gif', override: true }, { format: 'mp4', override: true },
] as const) {
  test(`Animation ${format.toUpperCase()} ${override ? 'composited override' : 'direct sequence'} exports native motion with Paper presentation and restores the paused entry pose`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    try { execFileSync('ffmpeg', ['-version']); execFileSync('ffprobe', ['-version']); }
    catch { test.skip(true, 'Decoded motion verification requires ffmpeg and ffprobe.'); }
    const workspace = await prepareAnimation(page, 'paper-dithering', override);
    await workspace.getByRole('button', { name: 'Play preview', exact: true }).click();
    const playhead = workspace.getByRole('slider', { name: 'Timeline playhead', exact: true });
    await expect.poll(async () => Number(await playhead.inputValue())).toBeGreaterThan(200);
    await workspace.getByRole('button', { name: 'Pause preview', exact: true }).click();
    const storyboard = workspace.getByRole('slider', { name: 'Storyboard playhead', exact: true });
    await storyboard.press('Home');
    for (let index = 0; index < 5; index += 1) await storyboard.press('ArrowRight');
    await expect(playhead).toHaveValue('500');
    const entry = await pose(page);
    await page.waitForTimeout(150);
    expect(await pose(page)).toEqual(entry);
    // Screenshot is an independent oracle for the visible CSS filter + grain,
    // not a second call to the implementation's Canvas composition helper.
    const expectedPath = testInfo.outputPath('paused-paper-presentation.png');
    const presentation = override ? workspace.locator('canvas[aria-label="Animation preview canvas"]') : shader(page);
    await presentation.screenshot({ path: expectedPath });

    await workspace.getByRole('button', { name: format === 'gif' ? 'GIF' : 'Export MP4', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `${format.toUpperCase()} export preview`, exact: true });
    const error = workspace.getByRole('alert');
    await expect(dialog.or(error)).toBeVisible({ timeout: 60_000 });
    if (await error.isVisible()) {
      const message = await error.innerText();
      // Lack of a browser encoder is explicit capability failure, not a pass.
      if (format === 'mp4' && /(?:WebCodecs|VideoEncoder|H\.264|encoder|codec).*(?:unavailable|unsupported|support)|does not support.*(?:MP4|encoding)/i.test(message)) {
        expect(await pose(page)).toEqual(entry);
        await expect(playhead).toHaveValue('500');
        test.skip(true, `Browser cannot encode MP4: ${message}`);
      }
      throw new Error(`Animation ${format} failed: ${message}`);
    }
    await expect.poll(() => pose(page)).toEqual(entry);
    await expect(playhead).toHaveValue('500');
    await expect(workspace.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
    await page.waitForTimeout(250);
    expect(await pose(page)).toEqual(entry);
    const downloadEvent = page.waitForEvent('download');
    await dialog.getByRole('button', { name: `Download ${format.toUpperCase()}`, exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    const output = testInfo.outputPath(`animation.${format}`);
    await download.saveAs(output);
    const bytes = await readFile(output);
    expect(bytes.length).toBeGreaterThan(1000);
    if (format === 'gif') expect(bytes.subarray(0, 6).toString()).toMatch(/^GIF8[79]a$/);
    else expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams',
      '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const stream = probe.streams.find((candidate: { codec_type: string }) => candidate.codec_type === 'video');
    expect([stream.width, stream.height]).toEqual([320, 180]);
    expect(Number(stream.nb_read_frames)).toBe(10);
    expect(Number(probe.format.duration)).toBeCloseTo(1, 1);
    const decoded = decodedFrames(output);
    const frameBytes = 64 * 36 * 3;
    const first = decoded.subarray(0, frameBytes);
    const middle = decoded.subarray(5 * frameBytes, 6 * frameBytes);
    const last = decoded.subarray(9 * frameBytes, 10 * frameBytes);
    expect(meanError(first, last)).toBeGreaterThan(1);
    const presentationError = meanError(middle, decodedFrames(expectedPath, true));
    await testInfo.attach('decoded-animation-export', { contentType: 'application/json', body: JSON.stringify({
      format, frames: stream.nb_read_frames, dimensions: [stream.width, stream.height],
      duration: probe.format.duration, presentationError, entry, restored: await pose(page),
    }, null, 2) });
    expect(presentationError).toBeLessThan(8);
  });
}

test('a cold optional Paper family renders and preserves a paused native frame after its renderer loads', async ({ page }) => {
  const workspace = await prepareAnimation(page, 'paper-warp-live-ink');
  await workspace.getByRole('button', { name: 'Play preview', exact: true }).click();
  const playhead = workspace.getByRole('slider', { name: 'Timeline playhead', exact: true });
  await expect.poll(async () => Number(await playhead.inputValue())).toBeGreaterThan(200);
  await workspace.getByRole('button', { name: 'Pause preview', exact: true }).click();
  const storyboard = workspace.getByRole('slider', { name: 'Storyboard playhead', exact: true });
  await storyboard.press('Home');
  for (let index = 0; index < 5; index += 1) await storyboard.press('ArrowRight');
  await expect(playhead).toHaveValue('500');
  const entry = await pose(page);
  expect(entry.colors).toBeGreaterThan(1);
  await page.waitForTimeout(200);
  expect(await pose(page)).toEqual(entry);
  await expect(shader(page).locator('[data-live-material-ready="error"]')).toHaveCount(0);
});

test('Animation rejects timestamp-sampled Fluid GIF and MP4 instead of exporting invented motion', async ({ page }) => {
  test.setTimeout(90_000);
  const workspace = await prepareAnimation(page, 'pavel-fluid-energy');
  const entry = await pose(page);
  for (const name of ['GIF', 'Export MP4']) {
    await workspace.getByRole('button', { name, exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Fluid needs a live recording, not timestamp sampling');
    await expect(page.getByRole('dialog', { name: /export preview/ })).toHaveCount(0);
    await expect(workspace.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
    expect(await pose(page)).toEqual(entry);
  }
});
