import { expect, test, type Page } from '@playwright/test';

const heroSelector = '.marketing-animation-lazy-shell';

async function expectFullEditorLayout(page: Page) {
  const layout = await page.locator(`${heroSelector} .animation-studio`).evaluate(editor => ({
    editorHeight: editor.getBoundingClientRect().height,
    bodyHeight: editor.querySelector('.animation-body')!.getBoundingClientRect().height,
  }));
  // Presentation omits the file header: the body must not land in its old
  // 54px grid track while a visible-but-clipped canvas passes toBeVisible().
  expect(layout.bodyHeight).toBeGreaterThan(layout.editorHeight * 0.9);
}

test('hero ships real editor controls in the initial page without waiting for JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    await page.goto(test.info().project.use.baseURL ?? 'http://localhost:3019');
    const hero = page.locator(heroSelector);
    await expect(hero.locator('.animation-studio')).toBeVisible();
    await expect(hero.getByRole('region', { name: 'Animation artboards', exact: true })).toBeVisible();
    await expect(hero.getByRole('slider', { name: 'Storyboard playhead', exact: true })).toBeVisible();
    await expect(hero.locator('.marketing-animation-placeholder')).toHaveCount(0);
    await expectFullEditorLayout(page);
  } finally {
    await context.close();
  }
});

async function openLoadedHero(page: Page) {
  await page.goto('/');
  const hero = page.locator(heroSelector);
  await expect(hero.locator('.animation-studio')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] canvas')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] [data-live-material-ready="false"]')).toHaveCount(0);
  await expectFullEditorLayout(page);
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
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const profiler = process.env.GLYPHFIELD_STARTUP_PROFILE && testInfo.project.name === 'chromium'
    ? await page.context().newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
    await profiler.send('Tracing.start', {
      categories: 'devtools.timeline,v8,blink.user_timing,gpu,cc,viz,toplevel,disabled-by-default-gpu.service',
      transferMode: 'ReturnAsStream',
    });
  }
  await page.addInitScript((recordGpu: boolean) => {
    if (recordGpu) {
      const traceCall = (prototype: object, key: string) => {
        const original = Reflect.get(prototype, key) as (...args: unknown[]) => unknown;
        Reflect.set(prototype, key, function(this: unknown, ...args: unknown[]) {
          const start = performance.now();
          try { return Reflect.apply(original, this, args); }
          finally {
            performance.measure(`gpu-startup-${key}`, { start, end: performance.now() });
          }
        });
      };
      traceCall(HTMLCanvasElement.prototype, 'getContext');
      traceCall(CanvasRenderingContext2D.prototype, 'drawImage');
      if (typeof WebGL2RenderingContext !== 'undefined') {
        for (const key of ['compileShader', 'linkProgram', 'getShaderParameter', 'getProgramParameter', 'getUniformLocation', 'drawArrays']) {
          traceCall(WebGL2RenderingContext.prototype, key);
        }
      }
    }
    const markOnce = (name: string) => {
      if (!performance.getEntriesByName(name).length) performance.mark(name);
    };
    const markPaintedShader = (name: string, selector: string) => {
      const surface = document.querySelector(selector);
      if (!surface || surface.closest('[hidden]') || !surface.querySelector('canvas')
        || !surface.querySelector('[data-live-material-ready="true"]')
        || surface.querySelector('[data-live-material-ready="false"], [data-live-material-ready="error"]')) return;
      markOnce(name);
    };
    const observer = new MutationObserver(() => {
      markPaintedShader('hero-mark-ready', '.marketing-v5-hero-mark');
      markPaintedShader('hero-background-ready', '.marketing-v5-hero-grain-gradient');
      const editor = document.querySelector('.marketing-animation-lazy-shell .animation-studio');
      if (!editor || editor.closest('[hidden]')) return;
      markOnce('hero-editor-mounted');
      if (document.querySelector('.marketing-animation-lazy-shell[data-studio-interactive="true"]')) markOnce('hero-interactive');
      markPaintedShader('hero-shader-ready', '.marketing-animation-lazy-shell [data-animation-shader-layer="sequence"]');
      if (['hero-interactive', 'hero-mark-ready', 'hero-background-ready', 'hero-shader-ready']
        .every(name => performance.getEntriesByName(name).length)) observer.disconnect();
    });
    observer.observe(document, { attributes: true, attributeFilter: ['data-live-material-ready', 'data-studio-interactive', 'hidden'], childList: true, subtree: true });
    document.addEventListener('pointerdown', event => {
      if (!(event.target instanceof Element)
        || !event.target.closest('.marketing-animation-lazy-shell button[aria-label="Pause preview"]')) return;
      performance.mark('hero-control-pointerdown');
      const acknowledgement = new MutationObserver(() => {
        if (!document.querySelector('.marketing-animation-lazy-shell button[aria-label="Play preview"]')) return;
        performance.mark('hero-control-acknowledged');
        acknowledgement.disconnect();
      });
      acknowledgement.observe(document, { attributes: true, attributeFilter: ['aria-label'], subtree: true });
    }, { once: true, capture: true });
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) performance.mark('startup-long-task', { detail: { duration: entry.duration, startTime: entry.startTime } });
      }).observe({ entryTypes: ['longtask'] });
    }
  }, Boolean(process.env.GLYPHFIELD_STARTUP_PROFILE));
  await page.goto('/', { waitUntil: 'commit' });
  const hero = page.locator(heroSelector);
  await expect(hero.locator('.animation-studio')).toBeVisible();
  // Do not run an accessibility-tree query or input during the cold-start
  // measurement: that work can compete with the very hydration being timed.
  await page.waitForFunction(() => ['hero-mark-ready', 'hero-background-ready', 'hero-shader-ready']
    .every(name => performance.getEntriesByName(name).length > 0));
  await expect(hero.locator('[data-animation-shader-layer="sequence"] canvas')).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] [data-live-material-ready="false"]')).toHaveCount(0);
  if (profiler) {
    const gpu = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.marketing-animation-lazy-shell [data-paper-shader] canvas');
      const context = canvas?.getContext('webgl2');
      const info = context?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: context?.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER),
        vendor: context?.getParameter(info?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR),
        width: canvas?.width,
        height: canvas?.height,
        devicePixelRatio: window.devicePixelRatio,
      };
    });
    await testInfo.attach('startup-gpu-environment', { body: JSON.stringify(gpu), contentType: 'application/json' });
    const { profile } = await profiler.send('Profiler.stop');
    await testInfo.attach('startup-cpu-profile', { body: JSON.stringify(profile), contentType: 'application/json' });
    const streamReady = new Promise<string>((resolve, reject) => profiler.once('Tracing.tracingComplete', event => {
      if (event.stream) resolve(event.stream);
      else reject(new Error('The browser did not return the startup trace stream.'));
    }));
    await profiler.send('Tracing.end');
    const handle = await streamReady;
    const chunks: string[] = [];
    let eof = false;
    while (!eof) {
      const result = await profiler.send('IO.read', { handle });
      chunks.push(result.data);
      eof = result.eof;
    }
    await profiler.send('IO.close', { handle });
    await testInfo.attach('startup-timeline-trace', { body: chunks.join(''), contentType: 'application/json' });
    await profiler.detach();
  }
  await page.evaluate(() => performance.mark('hero-first-control-input'));
  await hero.getByRole('button', { name: 'Pause preview', exact: true }).click();
  await expect(hero.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
  await page.evaluate(() => performance.mark('hero-first-control-response'));
  const timing = await page.evaluate(() => ({
    editorMountedMs: performance.getEntriesByName('hero-editor-mounted')[0]?.startTime,
    firstControlResponseMs: performance.getEntriesByName('hero-first-control-response')[0]?.startTime,
    shaderReadyMs: performance.getEntriesByName('hero-shader-ready')[0]?.startTime,
    markShaderReadyMs: performance.getEntriesByName('hero-mark-ready')[0]?.startTime,
    backgroundShaderReadyMs: performance.getEntriesByName('hero-background-ready')[0]?.startTime,
    interactiveMs: performance.getEntriesByName('hero-interactive')[0]?.startTime,
    controlRoundTripMs: performance.getEntriesByName('hero-first-control-response')[0]!.startTime
      - performance.getEntriesByName('hero-first-control-input')[0]!.startTime,
    controlResponseMs: performance.getEntriesByName('hero-control-acknowledged')[0]!.startTime
      - performance.getEntriesByName('hero-control-pointerdown')[0]!.startTime,
    responseEndMs: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).responseEnd,
    longTasks: performance.getEntriesByName('startup-long-task').map(entry => (entry as PerformanceMark).detail),
    gpuCalls: performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('gpu-startup-'))
      .map(entry => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration })),
    scriptResources: performance.getEntriesByType('resource').filter(entry =>
      (entry as PerformanceResourceTiming).initiatorType === 'script').map(entry => ({ name: new URL(entry.name).pathname,
      startTime: entry.startTime, duration: entry.duration, size: (entry as PerformanceResourceTiming).encodedBodySize })),
    scripts: performance.getEntriesByType('resource').filter(entry =>
      (entry as PerformanceResourceTiming).initiatorType === 'script').length,
  }));
  await testInfo.attach('landing-readiness', { body: JSON.stringify(timing), contentType: 'application/json' });
  // Real SSR chrome must not wait for an idle timer; readiness still requires
  // the authentic shader and a working control, not just placeholder markup.
  const startupBudgetMs = Number(process.env.GLYPHFIELD_STARTUP_BUDGET_MS ?? 2800);
  expect(timing.editorMountedMs).toBeLessThan(Math.min(1000, startupBudgetMs));
  expect(timing.interactiveMs).toBeLessThan(startupBudgetMs);
  expect(timing.shaderReadyMs).toBeLessThan(startupBudgetMs);
  expect(timing.markShaderReadyMs).toBeLessThan(startupBudgetMs);
  expect(timing.backgroundShaderReadyMs).toBeLessThan(startupBudgetMs);
  expect(timing.controlResponseMs).toBeLessThan(250);
  expect(errors).toEqual([]);
});

test('the first pause click during startup is not lost to hydration', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  const hero = page.locator(heroSelector);
  await hero.getByRole('button', { name: 'Pause preview', exact: true }).click();
  await expect(hero.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
  await expect(hero.locator('[data-animation-shader-layer="sequence"] canvas')).toBeVisible();
  const motion = await sampleMotion(page);
  expect(motion.after).toEqual(motion.before);
});

test('cold section links and reloads reveal usable controls without a blank contained section', async ({ page }) => {
  await page.goto('/#open-source');
  const section = page.locator('#open-source');
  const heading = section.getByRole('heading', { name: 'Free, open source, and built to extend.' });
  await expect(heading).toBeInViewport();
  await section.getByRole('button', { name: 'Light', exact: true }).click();
  const color = section.getByRole('textbox', { name: 'Light shader color', exact: true });
  await color.focus();
  await expect(color).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(section.getByRole('slider', { name: 'Light saturation and brightness', exact: true })).toBeFocused();
  await page.reload();
  await expect(heading).toBeInViewport();
  await expect(section.locator('.marketing-v14-open-source-workbench')).toBeVisible();
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
    const shaderRoot = element.querySelector('[data-animation-shader-layer="sequence"]');
    type NativeElement = HTMLElement & { paperShaderMount?: {
      getCurrentFrame(): number; speed?: number; currentSpeed?: number;
      isInViewport?: boolean; rafId?: number; hasBeenDisposed?: boolean;
    } };
    const native = shaderRoot?.querySelector<NativeElement>('[data-paper-shader]');
    const mount = native?.paperShaderMount;
    if (!mount) throw new Error('Hero native shader is unavailable');
    const state = () => ({
      connected: native.isConnected,
      sameMount: shaderRoot?.querySelector<NativeElement>('[data-paper-shader]')?.paperShaderMount === mount,
      shaderActive: shaderRoot?.getAttribute('data-animation-shader-active'),
      frame: mount.getCurrentFrame(),
      speed: mount.speed,
      currentSpeed: mount.currentSpeed,
      isInViewport: mount.isInViewport,
      rafId: mount.rafId,
      disposed: mount.hasBeenDisposed,
      time: element.querySelector<HTMLInputElement>('[aria-label="Timeline playhead"]')?.value,
      visibility: document.visibilityState,
      rect: element.getBoundingClientRect().toJSON(),
    });
    const before = state();
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
    return { before, after: state(), changed, samples, p95CallbackGap: gaps[Math.floor(gaps.length * 0.95)],
      nativeUpdatesPerOpportunity: changed / samples };
  });
  await testInfo.attach('hero-native-clock-cadence', { body: JSON.stringify(cadence), contentType: 'application/json' });
  // This checks the engine clock, not GPU completion or monitor presentation FPS.
  expect(cadence.nativeUpdatesPerOpportunity).toBeGreaterThan(0.8);
});
