import { expect, test, type Page } from '@playwright/test';

const heroSelector = '.marketing-animation-lazy-shell';

async function openLoadedHero(page: Page) {
  await page.goto('/');
  const hero = page.locator(heroSelector);
  await expect(hero.locator('.animation-studio')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] canvas')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] [data-live-material-ready="false"]')).toHaveCount(0);
  return hero;
}

async function sampleMotion(page: Page, milliseconds = 500) {
  return page.locator(heroSelector).evaluate(async (hero, duration) => {
    const read = () => ({
      time: Number(hero.querySelector<HTMLInputElement>('[aria-label="Timeline playhead"]')?.value),
      shader: (hero.querySelector('[data-animation-shader-layer="sequence"] [data-paper-shader]') as
        HTMLElement & { paperShaderMount?: { getCurrentFrame(): number } } | null)?.paperShaderMount?.getCurrentFrame() ?? null,
    });
    const before = read();
    await new Promise(resolve => setTimeout(resolve, duration));
    return { before, after: read() };
  }, milliseconds);
}

test('hero becomes interactive promptly after navigation instead of a multi-second timer', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.marketing-animation-lazy-shell .animation-studio')) return;
      performance.mark('hero-editor-mounted'); observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await openLoadedHero(page);
  const timing = await page.evaluate(() => ({
    editorMountedMs: performance.getEntriesByName('hero-editor-mounted')[0]?.startTime,
    scripts: performance.getEntriesByType('resource').filter(entry =>
      (entry as PerformanceResourceTiming).initiatorType === 'script').length,
  }));
  await testInfo.attach('landing-readiness', { body: JSON.stringify(timing), contentType: 'application/json' });
  // Local production-server budget, deliberately above normal cold hydration.
  expect(timing.editorMountedMs).toBeLessThan(2800);
});

test('loaded hero pauses offscreen and resumes without replacing its editor', async ({ page }) => {
  const hero = await openLoadedHero(page);
  const editor = await hero.locator('.animation-studio').elementHandle();
  const shader = await hero.locator('[data-animation-shader-layer="sequence"] canvas').elementHandle();
  expect(editor).not.toBeNull();
  await expect(hero.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible();
  const playing = await sampleMotion(page);
  expect(playing.after.time).not.toBe(playing.before.time);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => editor!.evaluate(element => element.isConnected)).toBe(true);
  await page.waitForTimeout(250); // Observer delivery and an in-flight native frame.
  const paused = await sampleMotion(page);
  expect(await shader!.evaluate(canvas => canvas.isConnected)).toBe(true);
  expect(paused.after.time).toBe(paused.before.time);
  expect(paused.after.shader).toBe(paused.before.shader);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(hero.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible();
  await expect.poll(() => editor!.evaluate(element => element.isConnected)).toBe(true);
  expect(await shader!.evaluate(canvas => canvas.isConnected)).toBe(true);
  await expect.poll(async () => { const motion = await sampleMotion(page); return motion.before.time !== motion.after.time; }).toBe(true);
});

test('user pause and selection survive leaving the demo without silently restarting', async ({ page }) => {
  const hero = await openLoadedHero(page);
  await hero.getByRole('button', { name: 'Pause preview', exact: true }).click();
  await hero.getByRole('button', { name: 'Welcome 02 · text', exact: true }).click();
  const editor = await hero.locator('.animation-studio').elementHandle();
  const time = await hero.getByRole('slider', { name: 'Timeline playhead', exact: true }).inputValue();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => editor!.evaluate(element => element.isConnected)).toBe(true);
  await expect(hero.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
  await expect(hero.getByRole('slider', { name: 'Timeline playhead', exact: true })).toHaveValue(time);
});

test('landing shaders paint before entry, retain nearby contexts, and release distant ones', async ({ page }) => {
  await page.goto('/');
  const field = page.locator('.marketing-v5-agent-stats .marketing-v5-arc-field').first();
  await field.evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight - 300));
  await expect(field.locator('canvas')).toHaveCount(1);
  await expect(field.locator('[data-live-material-ready="false"]')).toHaveCount(0);
  await expect(field).toHaveAttribute('data-shader-active', 'false');
  const prepared = await field.locator('canvas').elementHandle();
  expect(await prepared!.evaluate(canvas => (canvas as HTMLCanvasElement).width * (canvas as HTMLCanvasElement).height)).toBeGreaterThan(0);
  await field.evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight * 0.4));
  await expect(field).toHaveAttribute('data-shader-active', 'true');
  expect(await prepared!.evaluate(canvas => canvas.isConnected)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(field.locator('canvas')).toHaveCount(0);
});

test('reduced-motion users get a ready, paused hero', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const hero = await openLoadedHero(page);
  await expect(hero.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
  const motion = await sampleMotion(page);
  expect(motion.after).toEqual(motion.before);
});

test('hero shader advances on native display opportunities instead of a 30fps stepper', async ({ page }, testInfo) => {
  const hero = await openLoadedHero(page);
  await expect(hero.getByRole('button', { name: 'Pause preview', exact: true })).toBeVisible();
  const cadence = await hero.evaluate(async element => {
    const mount = (element.querySelector('[data-animation-shader-layer="sequence"] [data-paper-shader]') as
      HTMLElement & { paperShaderMount?: { getCurrentFrame(): number } } | null)?.paperShaderMount;
    if (!mount) throw new Error('Hero native shader is unavailable');
    let previous = mount.getCurrentFrame();
    let changed = 0;
    let samples = 0;
    let start = 0;
    const gaps: number[] = [];
    let last = 0;
    await new Promise<void>(resolve => {
      const sample = (time: number) => {
        if (!start) start = time;
        if (last) gaps.push(time - last);
        last = time;
        const frame = mount.getCurrentFrame();
        if (frame !== previous) changed++;
        previous = frame; samples++;
        if (time - start < 1000) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    gaps.sort((a, b) => a - b);
    return { changed, samples, p95CallbackGap: gaps[Math.floor(gaps.length * 0.95)],
      nativeUpdatesPerOpportunity: changed / samples };
  });
  await testInfo.attach('hero-native-clock-cadence', { body: JSON.stringify(cadence), contentType: 'application/json' });
  // This checks the engine clock, not GPU completion or monitor presentation FPS.
  expect(cadence.nativeUpdatesPerOpportunity).toBeGreaterThan(0.8);
});
