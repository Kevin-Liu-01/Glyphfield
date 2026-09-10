import { expect, test, type Page } from '@playwright/test';

async function openTimeline(page: Page, landing: boolean) {
  await page.goto(landing ? '/' : '/studio?tool=animation&project=starter');
  const studio = page.locator('.animation-studio:visible').first();
  if (!landing) {
    await studio.getByRole('button', { name: 'Edit source code', exact: true }).click();
    await page.getByRole('button', { name: 'Close source editor', exact: true }).waitFor();
    await page.evaluate(async () => {
      const api = window.glyphfield!.studio;
      const state = JSON.parse(api.readSource()).metadata.animation;
      state.includeBrandLogo = false;
      state.mode = 'text';
      state.textFrames = Array.from({ length: 9 }, (_, index) => `SCENE ${index + 1}`).join('\n');
      state.sequenceOrder = Array.from({ length: 9 }, (_, index) => `text-${index}`);
      state.frameSettings = {};
      state.backgroundOverrides = {};
      state.settings = { ...state.settings, width: 320, height: 180, holdMs: 500, transitionMs: 200 };
      state.sequenceBackground = { ...state.sequenceBackground, style: 'solid', colorA: '#111111' };
      delete state.artboards;
      delete state.activeArtboardId;
      await api.applySource(state);
    });
    await page.getByRole('button', { name: 'Close source editor', exact: true }).click();
  }
  const timeline = studio.locator('.animation-timeline-scroll');
  await timeline.scrollIntoViewIfNeeded();
  const pause = studio.getByRole('button', { name: 'Pause preview', exact: true });
  if (await pause.count()) await pause.click();
  await studio.getByRole('button', { name: 'Restart preview', exact: true }).click();
  await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBe(0);
  return { studio, timeline };
}

for (const landing of [true, false]) {
  test(`${landing ? 'landing' : 'full Studio'} timeline follows playback and looping without scrolling the page`, async ({ page }) => {
    const { studio, timeline } = await openTimeline(page, landing);
    const pageY = await page.evaluate(() => scrollY);
    await studio.getByRole('button', { name: 'Play preview', exact: true }).click();
    await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(60);
    const geometry = await timeline.evaluate(element => {
      const viewport = element.getBoundingClientRect();
      const head = element.querySelector('.animation-storyboard-track .animation-timeline-playhead-handle')!.getBoundingClientRect();
      return { head: head.x + head.width / 2, left: viewport.x, right: viewport.right,
        width: element.scrollWidth, contentWidth: element.firstElementChild!.getBoundingClientRect().width };
    });
    expect(geometry.head).toBeGreaterThanOrEqual(geometry.left);
    expect(geometry.head).toBeLessThanOrEqual(geometry.right);
    expect(geometry.width).toBeLessThanOrEqual(geometry.contentWidth + 1);
    expect(await page.evaluate(() => scrollY)).toBe(pageY);

    await studio.getByRole('button', { name: 'Pause preview', exact: true }).click();
    const stoppedLeft = await timeline.evaluate(element => element.scrollLeft);
    await page.waitForTimeout(250);
    expect(await timeline.evaluate(element => element.scrollLeft)).toBe(stoppedLeft);

    // A paused keyboard seek reveals the end; the very next native playback
    // step wraps to the beginning and follows left without changing page scroll.
    const range = studio.getByRole('slider', { name: 'Timeline playhead', exact: true });
    await range.press('End');
    await range.press('ArrowLeft');
    await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(stoppedLeft);
    await studio.getByRole('button', { name: 'Play preview', exact: true }).click();
    await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBeLessThan(4);
    expect(await page.evaluate(() => scrollY)).toBe(pageY);
  });
}

test('manual horizontal scrolling gets a quiet window before playback following resumes', async ({ page }) => {
  const { studio, timeline } = await openTimeline(page, false);
  await studio.getByRole('button', { name: 'Play preview', exact: true }).click();
  await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(180);
  await timeline.hover();
  await page.mouse.wheel(-3000, 0);
  await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBe(0);
  await page.waitForTimeout(350);
  expect(await timeline.evaluate(element => element.scrollLeft)).toBe(0);
  await expect(studio.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible();
  await expect.poll(() => timeline.evaluate(element => element.scrollLeft), { timeout: 4000 }).toBeGreaterThan(40);
});
