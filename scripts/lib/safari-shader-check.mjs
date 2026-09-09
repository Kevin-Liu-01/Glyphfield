import assert from 'node:assert/strict';

const surfaceSelector = '[data-testid="shader-lab-live-stage"] [data-live-material-surface="paper-dithering"]';
const probeKey = 'glyphfield-safari-owned-shader-cadence';

export async function checkSafariDisplayBaseline({ command, evaluateAsync, rect, actions, mouse, pointerMove, pointerDown, pointerUp }) {
  await command('POST', '/url', { url: `data:text/html;charset=utf-8,${encodeURIComponent(
    '<title>Safari foreground scheduling baseline</title><button id="foreground">Native Safari baseline — no Glyphfield or shader</button>'
  )}` });
  const box = await rect('#foreground');
  await actions(mouse([pointerMove(box.x + box.width / 2, box.y + box.height / 2), pointerDown, pointerUp]));
  const baseline = await evaluateAsync(() => new Promise((resolve, reject) => {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) {
      reject(new Error('Bare Safari baseline must be foreground and focused'));
      return;
    }
    const frames = [];
    const start = performance.now();
    let hidden = false;
    let unfocused = false;
    let frame = 0;
    let timer = 0;
    const observeForeground = () => {
      hidden ||= document.visibilityState !== 'visible';
      unfocused ||= !document.hasFocus();
    };
    const finish = (timedOut = false) => {
      observeForeground();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', observeForeground);
      window.removeEventListener('blur', observeForeground);
      const end = performance.now();
      const gaps = [start, ...frames, end].slice(1).map((time, index) => time - [start, ...frames, end][index]);
      const sorted = gaps.toSorted((a, b) => a - b);
      const round = (value) => Number(value.toFixed(2));
      resolve({ displayCallbacks: frames.length, displayCallbackFps: round(frames.length * 1000 / (end - start)),
        durationMs: round(end - start), p95DisplayGapMs: round(sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0),
        maxDisplayGapMs: round(Math.max(0, ...gaps)), hiddenDuringProbe: hidden, unfocusedDuringProbe: unfocused, timedOut });
    };
    const tick = () => {
      const time = performance.now();
      frames.push(time);
      observeForeground();
      if (time - start >= 4000) finish();
      else frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', observeForeground);
    window.addEventListener('blur', observeForeground);
    frame = requestAnimationFrame(tick);
    timer = setTimeout(() => finish(true), 6000);
  }));
  assert(!baseline.hiddenDuringProbe && !baseline.unfocusedDuringProbe && !baseline.timedOut,
    `Foreground baseline invalid: ${JSON.stringify(baseline)}`);
  assert(baseline.displayCallbacks > 5, `Bare Safari stopped scheduling: ${JSON.stringify(baseline)}`);
  return { baseline, measurement: 'Fresh native Safari data page with no Glyphfield code or shader; foreground rAF scheduling only.' };
}

// Observe draw submissions for this one authentic canvas, counting multi-pass
// draws once per display opportunity. This is not GPU completion/presentation.
function beginProbe(selector, key) {
  const surface = document.querySelector(selector);
  const canvas = surface?.querySelector('canvas');
  if (!canvas) throw new Error('No authentic shader canvas');
  if (document.visibilityState !== 'visible' || !document.hasFocus()) {
    throw new Error('Native Safari must be foreground and focused before measuring shader cadence');
  }
  const restores = [];
  const draws = [];
  const frames = [];
  let drew = false;
  let drawCalls = 0;
  let hidden = false;
  let unfocused = false;
  let frame = 0;
  let timeout = 0;
  let finished = false;
  const start = performance.now();
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  const observeForeground = () => {
    hidden ||= document.visibilityState !== 'visible';
    unfocused ||= !document.hasFocus();
  };
  const round = (value) => Number(value.toFixed(2));
  const gaps = (values) => values.slice(1).map((value, index) => value - values[index]);
  const percentile = (values, quantile) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * quantile)] ?? 0;
  const finish = (timedOut = false) => {
    if (finished) return;
    finished = true;
    observeForeground();
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
    restores.reverse().forEach((restore) => restore());
    document.removeEventListener('visibilitychange', observeForeground);
    window.removeEventListener('blur', observeForeground);
    const end = performance.now();
    const seconds = (end - start) / 1000;
    const drawGaps = gaps([start, ...draws, end]);
    const displayGaps = gaps([start, ...frames, end]);
    resolve({ actualDrawFrames: draws.length, actualDrawFps: round(draws.length / seconds),
      displayCallbacks: frames.length, displayCallbackFps: round(frames.length / seconds), drawCalls,
      durationMs: round(end - start), timedOut, hiddenDuringProbe: hidden, unfocusedDuringProbe: unfocused,
      p95DrawGapMs: round(percentile(drawGaps, 0.95)), maxDrawGapMs: round(Math.max(0, ...drawGaps)),
      p95DisplayGapMs: round(percentile(displayGaps, 0.95)), maxDisplayGapMs: round(Math.max(0, ...displayGaps)),
      width: canvas.width, height: canvas.height, devicePixelRatio,
      retainedCanvas: canvas.isConnected && surface.querySelector('canvas') === canvas,
      ready: Boolean(surface.querySelector('[data-live-material-ready="true"]')),
      paperMotion: surface.querySelector('[data-paper-motion]')?.getAttribute('data-paper-motion'),
      userAgent: navigator.userAgent });
  };
  // Keep only diagnostic state on the document so cleanup still reaches the
  // original prototypes if a regression replaces the surface during input.
  document[Symbol.for(key)] = { promise, finish };
  try {
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        if (!prototype || !Object.hasOwn(prototype, method)) continue;
        const original = prototype[method];
        prototype[method] = function (...args) {
          const result = Reflect.apply(original, this, args);
          if (this.canvas === canvas) { drew = true; drawCalls += 1; }
          return result;
        };
        restores.push(() => { prototype[method] = original; });
      }
    }
    document.addEventListener('visibilitychange', observeForeground);
    window.addEventListener('blur', observeForeground);
    const tick = () => {
      const time = performance.now();
      observeForeground();
      frames.push(time);
      if (drew) draws.push(time);
      drew = false;
      if (time - start >= 4000) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Hidden Safari can stop rAF completely; bound the diagnostic and report it.
    timeout = setTimeout(() => finish(true), 6000);
  } catch (error) {
    finish(true);
    throw error;
  }
}

export async function checkSafariShader({ evaluate, evaluateAsync, click, waitFor, drag, rect, actions, mouse,
  pointerMove, pointerDown, pointerUp }) {
  await click('button[aria-label="Add shader layer"]');
  await waitFor(() => Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
    .some((element) => element.kind === 'shader'), 'new shader layer in public source');
  await evaluateAsync(async () => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const shader = Object.values(source.elements).find((entry) => entry.kind === 'shader');
    shader.data.materialId = 'paper-dithering';
    shader.data.settings.speed = 0.4;
    source.metadata.designLab.timeline.paused = false;
    const snapshot = source.metadata.designLab.workspace.artboards[0].snapshot;
    snapshot.shaderLayers = [shader.data];
    snapshot.timeline = source.metadata.designLab.timeline;
    await studio.applySource(source);
  });
  await waitFor((selector) => {
    const surface = document.querySelector(selector);
    return Boolean(surface?.querySelector('canvas') && surface.querySelector('[data-live-material-ready="true"]'));
  }, 'ready native GPU canvas', surfaceSelector);
  const box = await rect(surfaceSelector);
  await actions(mouse([pointerMove(box.x + 25, box.y + 25), pointerDown, pointerUp]));
  const warpSelector = 'input[aria-label="Warp"]';
  await waitFor((selector) => Boolean(document.querySelector(selector)), 'shader Warp inspector', warpSelector);
  const beforeWarp = await evaluate((selector) => Number(document.querySelector(selector).value), warpSelector);
  // Settle initial shader compilation before the bounded interaction sample.
  await evaluateAsync(() => new Promise((resolve) => setTimeout(resolve, 500)));
  await evaluate(beginProbe, surfaceSelector, probeKey);
  let cadence;
  let value;
  try {
    value = await drag(warpSelector, 0.75);
    assert(Math.abs(value - beforeWarp) > 0.01, `Native Safari Warp thumb did not move: ${beforeWarp} → ${value}`);
    await waitFor((expected) => {
      const source = JSON.parse(window.glyphfield.studio.readSource());
      const shader = Object.values(source.elements).find((entry) => entry.kind === 'shader');
      return Math.abs(shader.data.settings.strength - expected) < 0.001
        && shader.data.materialId === 'paper-dithering' && shader.data.settings.speed === 0.4
        && !source.metadata.designLab.timeline.paused;
    }, 'native Warp source commit', value);
    cadence = await evaluateAsync((key) => {
      const probe = document[Symbol.for(key)];
      if (!probe) throw new Error('Native shader cadence instrumentation disappeared');
      return probe.promise;
    }, probeKey);
  } finally {
    await evaluate((key) => {
      document[Symbol.for(key)]?.finish();
      delete document[Symbol.for(key)];
    }, probeKey);
  }
  const details = JSON.stringify(cadence);
  assert(cadence.retainedCanvas && cadence.ready, `Shader canvas changed or stopped being ready: ${details}`);
  assert.equal(cadence.paperMotion, 'running', `Shader stopped native playback: ${details}`);
  assert(!cadence.hiddenDuringProbe && !cadence.unfocusedDuringProbe && !cadence.timedOut,
    `Foreground scheduling was interrupted; cadence sample invalid: ${details}`);
  assert(cadence.actualDrawFrames > 5 && cadence.displayCallbacks > 5, `Shader stopped drawing: ${details}`);
  // A generous freeze guard, not a universal 60fps promise across Safari/GPU models.
  assert(cadence.p95DrawGapMs < 150, `Native Safari shader stutters during real input: ${details}`);
  return { beforeWarp, warp: value, cadence,
    measurement: 'Four-second foreground sample including native pointer drag. Draw submissions per display opportunity, not GPU completion or presentation.' };
}
