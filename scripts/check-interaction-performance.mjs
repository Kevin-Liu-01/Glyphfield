#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const baseUrl = process.env.GLYPHFIELD_PERF_BASE_URL ?? 'http://127.0.0.1:3013';
const agentBrowser = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const session = `glyphfield-performance-${process.pid}`;
const landingOnly = process.argv.includes('--landing-only');
const tracePath = process.env.GLYPHFIELD_PERF_TRACE_PATH;
const failures = [];

function browser(args, { json = true } = {}) {
  const output = execFileSync(
    agentBrowser,
    ['--session', session, ...(json ? ['--json'] : []), ...args],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  if (!json) return output;
  const result = JSON.parse(output);
  if (!result.success) throw new Error(result.error?.message ?? `agent-browser ${args[0]} failed`);
  return result.data?.result ?? result.data;
}

function evaluate(expression) {
  return browser(['eval', expression]);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkForegroundSampling(metrics, label) {
  check(
    !metrics.diagnostics.visibility.hiddenDuringProbe,
    `[benchmark environment] ${label} sampled a hidden document; foreground performance attribution is invalid`
  );
}

function checkFramePacing(metrics, label) {
  checkForegroundSampling(metrics, label);
  const p95Limit = Math.max(25, metrics.p50Frame + 10);
  const p99Limit = Math.max(33.4, metrics.p50Frame + 16.7);
  check(metrics.p95Frame <= p95Limit, `${label} p95 frame ${metrics.p95Frame}ms exceeds cadence-normalized ${p95Limit.toFixed(2)}ms`);
  check(metrics.p99Frame <= p99Limit, `${label} p99 frame ${metrics.p99Frame}ms exceeds cadence-normalized ${p99Limit.toFixed(2)}ms`);
  check(metrics.maxFrame <= 50, `${label} produced a ${metrics.maxFrame}ms frame`);
}

const beginProbe = `(() => {
  const previous = window.__glyphfieldPerformanceProbe;
  if (previous) {
    previous.running = false;
    previous.observers.forEach((observer) => observer.disconnect());
    if (previous.onVisibilityChange) document.removeEventListener('visibilitychange', previous.onVisibilityChange);
  }
  const probe = window.__glyphfieldPerformanceProbe = {
    cls: 0,
    events: [],
    excludedPreProbeEntries: [],
    frames: [],
    lastFrame: performance.now(),
    loaf: [],
    longTaskDetails: [],
    longTasks: [],
    observers: [],
    running: true,
    startedAt: performance.now(),
    startedFocused: document.hasFocus(),
    startedVisibilityState: document.visibilityState,
    visibilityChanges: [],
  };
  probe.onVisibilityChange = () => probe.visibilityChanges.push({
    focused: document.hasFocus(),
    relativeTime: performance.now() - probe.startedAt,
    visibilityState: document.visibilityState,
  });
  document.addEventListener('visibilitychange', probe.onVisibilityChange);
  const definitions = [
    ['longtask', (entry) => {
      probe.longTasks.push(entry.duration);
      probe.longTaskDetails.push({
        attribution: Array.from(entry.attribution ?? []).map((task) => ({
          containerName: task.containerName,
          containerSrc: task.containerSrc,
          containerType: task.containerType,
          name: task.name,
        })),
        duration: entry.duration,
        observedOffset: performance.now() - probe.startedAt,
        relativeEndTime: entry.startTime + entry.duration - probe.startedAt,
        relativeStartTime: entry.startTime - probe.startedAt,
        startTime: entry.startTime,
      });
    }],
    ['long-animation-frame', (entry) => probe.loaf.push({
      blockingDuration: entry.blockingDuration ?? 0,
      duration: entry.duration,
      observedOffset: performance.now() - probe.startedAt,
      relativeEndTime: entry.startTime + entry.duration - probe.startedAt,
      relativeStartTime: entry.startTime - probe.startedAt,
      renderStart: entry.renderStart,
      scripts: Array.from(entry.scripts ?? [])
        .sort((first, second) => second.duration - first.duration)
        .slice(0, 5)
        .map((script) => ({
          duration: script.duration,
          executionStart: script.executionStart,
          forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration ?? 0,
          functionName: script.sourceFunctionName ?? '',
          invoker: script.invoker ?? '',
          invokerType: script.invokerType ?? '',
          relativeStartTime: script.startTime - probe.startedAt,
          sourceCharPosition: script.sourceCharPosition,
          sourceURL: script.sourceURL ?? '',
          startTime: script.startTime,
        })),
      startTime: entry.startTime,
      styleAndLayoutStart: entry.styleAndLayoutStart,
    })],
    ['layout-shift', (entry) => {
      if (!entry.hadRecentInput) probe.cls += entry.value;
    }],
    ['event', (entry) => probe.events.push({
      delay: entry.processingStart - entry.startTime,
      duration: entry.duration,
      name: entry.name,
    })],
  ];
  definitions.forEach(([type, consume]) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
        // Delivery can lag the measured interval even with buffered:false.
        // Keep overlapping entries in full; only wholly earlier work is excluded.
        if (entry.startTime + entry.duration < probe.startedAt) {
          probe.excludedPreProbeEntries.push({
            duration: entry.duration,
            observedOffset: performance.now() - probe.startedAt,
            relativeEndTime: entry.startTime + entry.duration - probe.startedAt,
            relativeStartTime: entry.startTime - probe.startedAt,
            startTime: entry.startTime,
            type,
          });
          return;
        }
        consume(entry);
      }));
      observer.observe(type === 'event'
        ? { durationThreshold: 16, type }
        : { buffered: false, type });
      probe.observers.push(observer);
    } catch {}
  });
  requestAnimationFrame(function sampleFrame(time) {
    probe.frames.push(time - probe.lastFrame);
    probe.lastFrame = time;
    if (probe.running) requestAnimationFrame(sampleFrame);
  });
  return true;
})()`;

// Overlapping entries contribute their full duration to the existing budgets.
// Wholly pre-probe intervals remain visible only as diagnostic attribution.
const probeDiagnostics = `(probe) => {
  const longest = (entries) => [...entries]
    .sort((first, second) => second.duration - first.duration)
    .slice(0, 5);
  const overlapsStart = (entry) => entry.relativeStartTime < 0 && entry.relativeEndTime >= 0;
  return {
    duration: performance.now() - probe.startedAt,
    initialOverlappingFrames: longest(probe.loaf.filter(overlapsStart)),
    initialOverlappingLongTasks: longest(probe.longTaskDetails.filter(overlapsStart)),
    longAnimationFrameCount: probe.loaf.length,
    longestFrames: longest(probe.loaf),
    longestTasks: longest(probe.longTaskDetails),
    excludedPreProbeEntries: longest(probe.excludedPreProbeEntries),
    preProbeFrames: longest(probe.excludedPreProbeEntries.filter((entry) => entry.type === 'long-animation-frame')),
    startedAt: probe.startedAt,
    visibility: {
      changes: probe.visibilityChanges,
      endedFocused: document.hasFocus(),
      endedVisibilityState: document.visibilityState,
      hiddenDuringProbe: probe.startedVisibilityState === 'hidden'
        || document.visibilityState === 'hidden'
        || probe.visibilityChanges.some((entry) => entry.visibilityState === 'hidden'),
      startedFocused: probe.startedFocused,
      startedVisibilityState: probe.startedVisibilityState,
    },
  };
}`;

const finishProbe = `(() => {
  const probe = window.__glyphfieldPerformanceProbe;
  probe.running = false;
  probe.observers.forEach((observer) => observer.disconnect());
  document.removeEventListener('visibilitychange', probe.onVisibilityChange);
  const frames = probe.frames.slice(3).sort((a, b) => a - b);
  const percentile = (value) => frames[Math.min(
    Math.max(0, frames.length - 1),
    Math.floor(Math.max(0, frames.length - 1) * value)
  )] ?? 0;
  const dropThreshold = Math.max(25, percentile(0.5) + 10);
  const droppedFrames = frames.filter((duration) => duration > dropThreshold).length;
  const round = (value) => Number(value.toFixed(2));
  return {
    canvases: document.querySelectorAll('canvas').length,
    cls: Number(probe.cls.toFixed(5)),
    diagnostics: (${probeDiagnostics})(probe),
    dropRatio: round(droppedFrames / Math.max(1, frames.length)),
    dropThreshold: round(dropThreshold),
    droppedFrames,
    frameCount: frames.length,
    maxFrame: round(Math.max(0, ...frames)),
    maxInputDelay: round(Math.max(0, ...probe.events.map((entry) => entry.delay))),
    maxInteraction: round(Math.max(0, ...probe.events.map((entry) => entry.duration))),
    maxLoaf: round(Math.max(0, ...probe.loaf.map((entry) => entry.duration))),
    maxLoafBlocking: round(Math.max(0, ...probe.loaf.map((entry) => entry.blockingDuration))),
    maxLongTask: round(Math.max(0, ...probe.longTasks)),
    nodes: document.getElementsByTagName('*').length,
    p50Frame: round(percentile(0.5)),
    p95Frame: round(percentile(0.95)),
    p99Frame: round(percentile(0.99)),
    usedHeap: performance.memory?.usedJSHeapSize ?? null,
  };
})()`;

async function connectToPage() {
  const cdpUrl = browser(['get', 'cdp-url'], { json: false });
  const socket = new WebSocket(cdpUrl);
  const pending = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { reject, resolve });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find((target) => target.type === 'page' && target.url.startsWith(baseUrl));
  if (!page) throw new Error(`Could not find the ${baseUrl} page target`);
  const attached = await send('Target.attachToTarget', { flatten: true, targetId: page.targetId });
  return {
    close: () => socket.close(),
    send: (method, params = {}) => send(method, params, attached.sessionId),
  };
}

async function collectGarbage() {
  const page = await connectToPage();
  try {
    await page.send('HeapProfiler.collectGarbage');
  } finally {
    page.close();
  }
}

async function measureLandingScroll() {
  browser(['open', `${baseUrl}/`]);
  browser(['set', 'viewport', '1440', '900']);
  const page = await connectToPage();
  try {
    await page.send('Page.bringToFront');
  } finally {
    page.close();
  }
  browser(['wait', '1400']);
  const before = evaluate(`(() => {
    window.__glyphfieldLandingNodes = new WeakSet(document.querySelectorAll('*'));
    return {
      canvases: document.querySelectorAll('canvas').length,
      nodes: document.getElementsByTagName('*').length,
      scrollHeight: document.documentElement.scrollHeight,
    };
  })()`);
  if (tracePath) browser(['trace', 'start']);
  evaluate(beginProbe);
  browser(['mouse', 'move', '720', '450']);
  for (let index = 0; index < 24; index += 1) {
    browser(['mouse', 'wheel', '420']);
    await delay(18);
  }
  for (let index = 0; index < 24; index += 1) {
    browser(['mouse', 'wheel', '-420']);
    await delay(18);
  }
  browser(['wait', '650']);
  const metrics = evaluate(finishProbe);
  const after = evaluate(`(() => {
    const initialNodes = window.__glyphfieldLandingNodes;
    const added = Array.from(document.querySelectorAll('*')).filter((node) => !initialNodes.has(node));
    const describe = (node) => ({
      className: node.getAttribute('class'),
      href: node.getAttribute('href'),
      parent: node.parentElement?.tagName,
      parentClass: node.parentElement?.getAttribute('class'),
      src: node.getAttribute('src'),
      tag: node.tagName,
    });
    delete window.__glyphfieldLandingNodes;
    return {
      addedRoots: added.filter((node) => initialNodes.has(node.parentElement)).map(describe),
      canvases: document.querySelectorAll('canvas').length,
      nodes: document.getElementsByTagName('*').length,
      scrollY,
    };
  })()`);
  if (tracePath) browser(['trace', 'stop', tracePath]);

  checkFramePacing(metrics, 'Landing scroll');
  check(metrics.dropRatio <= 0.02, `Landing scroll drop ratio ${metrics.dropRatio} exceeds 0.02`);
  check(metrics.maxLongTask === 0, `Landing scroll produced a ${metrics.maxLongTask}ms long task`);
  check(metrics.maxLoaf <= 60, `Landing scroll produced a ${metrics.maxLoaf}ms long animation frame`);
  check(metrics.maxLoafBlocking <= 10, `Landing scroll blocked ${metrics.maxLoafBlocking}ms inside a long animation frame`);
  check(metrics.cls <= 0.1, `Landing scroll CLS ${metrics.cls} exceeds 0.1`);
  check(after.nodes <= before.nodes, `Landing DOM grew from ${before.nodes} to ${after.nodes} nodes`);
  check(after.canvases <= before.canvases, `Landing canvases grew from ${before.canvases} to ${after.canvases}`);
  check(after.scrollY <= 1, `Landing did not return to the top; scrollY is ${after.scrollY}`);

  return { after, before, metrics };
}

async function measureStudioEntry() {
  const linkBounds = evaluate(`(() => {
    const bounds = document.querySelector('a[href="/studio"]').getBoundingClientRect();
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) };
  })()`);
  browser(['mouse', 'move', String(linkBounds.x), String(linkBounds.y)]);
  browser(['wait', '180']);
  evaluate(beginProbe);
  const result = evaluate(`(async () => {
    const startedAt = performance.now();
    const deadline = startedAt + 5_000;
    const studioLink = document.querySelector('a[href="/studio"]');
    studioLink?.click();
    while (location.pathname !== '/studio' && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    while (!document.querySelector('.studio-app') && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const shellReady = performance.now() - startedAt;
    // Follow the same navigation as a new user, without seeding private draft storage.
    const designLab = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Design Lab');
    designLab?.click();
    const editorIsReady = () => {
      const stage = document.querySelector('[data-testid="shader-lab-live-stage"]')
        ?.closest('.canvas-viewport-stage');
      return Boolean(document.querySelector('.shader-lab-v2-material-card')
        && stage && !stage.hasAttribute('data-canvas-initializing'));
    };
    while (!editorIsReady() && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (!editorIsReady()) {
      throw new Error('Design Lab did not restore and frame its canvas within 5 seconds');
    }
    const editorReady = performance.now() - startedAt;
    await new Promise((resolve) => setTimeout(resolve, 850));
    const probe = window.__glyphfieldPerformanceProbe;
    probe.running = false;
    probe.observers.forEach((observer) => observer.disconnect());
    document.removeEventListener('visibilitychange', probe.onVisibilityChange);
    const frames = probe.frames.slice(3).sort((a, b) => a - b);
    const percentile = (value) => frames[Math.min(frames.length - 1, Math.floor((frames.length - 1) * value))] ?? 0;
    const round = (value) => Number(value.toFixed(2));
    return {
      cards: document.querySelectorAll('.shader-lab-v2-material-card').length,
      cls: Number(probe.cls.toFixed(5)),
      diagnostics: (${probeDiagnostics})(probe),
      maxFrame: round(Math.max(0, ...frames)),
      maxLoaf: round(Math.max(0, ...probe.loaf.map((entry) => entry.duration))),
      maxLoafBlocking: round(Math.max(0, ...probe.loaf.map((entry) => entry.blockingDuration))),
      maxLongTask: round(Math.max(0, ...probe.longTasks)),
      nodes: document.getElementsByTagName('*').length,
      p50Frame: round(percentile(0.5)),
      p95Frame: round(percentile(0.95)),
      editorReady: round(editorReady),
      shellReady: round(shellReady),
    };
  })()`);

  checkForegroundSampling(result, 'Studio entry');
  check(result.shellReady <= 200, `Studio shell took ${result.shellReady}ms to become ready`);
  check(result.editorReady <= 600, `Design Lab took ${result.editorReady}ms to finish its lazy mount`);
  check(result.maxLongTask === 0, `Studio entry produced a ${result.maxLongTask}ms long task`);
  check(result.maxLoaf <= 60, `Studio entry produced a ${result.maxLoaf}ms long animation frame`);
  check(result.maxLoafBlocking <= 10, `Studio entry blocked ${result.maxLoafBlocking}ms inside a long animation frame`);
  check(result.cards <= 24, `Studio eagerly mounted ${result.cards} shader cards`);
  check(result.cls <= 0.1, `Studio entry CLS ${result.cls} exceeds 0.1`);
  return result;
}

async function measureLandingShaderLifecycle() {
  const result = evaluate(`(async () => {
    const field = document.querySelector('.marketing-v5-agent-stats .marketing-v5-arc-field');
    if (!field) throw new Error('Landing shader card is missing');
    const top = field.getBoundingClientRect().top + scrollY;
    const waitUntil = async (predicate, label) => {
      const deadline = performance.now() + 5_000;
      while (performance.now() < deadline) {
        if (field.querySelector('[data-live-material-ready="error"]')) {
          throw new Error('Landing shader reported a renderer error');
        }
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(label);
    };
    const sample = document.createElement('canvas');
    sample.width = 24;
    sample.height = 24;
    const context = sample.getContext('2d', { willReadFrequently: true });
    let paintedColors = 0;
    const hasPaintedShader = () => {
      const canvas = field.querySelector('canvas');
      const mount = field.querySelector('[data-paper-shader]')?.paperShaderMount;
      if (!canvas?.width || !canvas.height || !mount
        || field.querySelector('[data-live-material-ready="false"]')) return false;
      context.clearRect(0, 0, 24, 24);
      context.drawImage(canvas, 0, 0, 24, 24);
      const pixels = context.getImageData(0, 0, 24, 24).data;
      const colors = new Set();
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]) colors.add(pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]);
      }
      paintedColors = colors.size;
      // This known two-color dither is not ready when it is only an allocated,
      // transparent or cleared-black drawing buffer.
      return paintedColors > 1;
    };
    // Stop 300px below the viewport: code and actual pixels must prepare here,
    // not only after the user can already see the card.
    window.scrollTo(0, top - innerHeight - 300);
    const startedAt = performance.now();
    await waitUntil(hasPaintedShader, 'Landing shader did not paint before visibility');
    const prepared = field.querySelector('canvas');
    const prewarmMs = performance.now() - startedAt;
    const preparedOffscreen = field.getBoundingClientRect().top > innerHeight
      && field.dataset.shaderActive === 'false';
    window.scrollTo(0, top - innerHeight * 0.4);
    await waitUntil(() => field.dataset.shaderActive === 'true', 'Landing shader did not activate');
    const retainedOnEntry = field.querySelector('canvas') === prepared;
    window.scrollTo(0, top - innerHeight - 300);
    await waitUntil(() => field.dataset.shaderActive === 'false', 'Landing shader did not pause nearby');
    const retainedNearby = field.querySelector('canvas') === prepared;
    window.scrollTo(0, 0);
    await waitUntil(() => !field.querySelector('canvas'), 'Distant landing shader was not released');
    return { paintedColors, preparedOffscreen, prewarmMs: Math.round(prewarmMs), retainedNearby, retainedOnEntry };
  })()`);
  check(result.preparedOffscreen, 'Landing shader was not prepared offscreen');
  check(result.retainedOnEntry, 'Landing shader recreated its canvas on viewport entry');
  check(result.retainedNearby, 'Landing shader discarded its prepared canvas just outside the viewport');
  return result;
}

async function measureDesignControlDrag() {
  browser(['click', 'button[aria-label="Select Canvas shader 1 preview"]']);
  const before = evaluate(`(async () => {
    const deadline = performance.now() + 5_000;
    let slider;
    let canvas;
    do {
      slider = document.querySelector('input[aria-label="Shader zoom slider"]');
      canvas = document.querySelector('[data-testid="shader-lab-live-stage"] [data-shader-instance^="canvas-"] canvas');
      if (slider && !slider.disabled && canvas?.width > 0 && canvas?.height > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (performance.now() < deadline);
    if (!slider || slider.disabled || !canvas?.width || !canvas?.height) {
      throw new Error('Design Lab shader zoom control and canvas did not become ready within 5 seconds');
    }
    slider.scrollIntoView({ block: 'nearest' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bounds = slider.getBoundingClientRect();
    const values = [];
    const onInput = () => values.push(Number(slider.value));
    slider.addEventListener('input', onInput);
    window.__glyphfieldDesignControlDrag = { canvas, onInput, slider, values };
    return {
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      left: bounds.left + 6,
      max: Number(slider.max),
      min: Number(slider.min),
      right: bounds.right - 6,
      value: Number(slider.value),
      y: bounds.top + bounds.height / 2,
      zoom: document.querySelector('input[aria-label="Shader zoom value"]')?.value ?? null,
    };
  })()`);
  browser(['wait', '350']);
  const page = await connectToPage();
  const initialProgress = (before.value - before.min) / (before.max - before.min);
  const finalProgress = initialProgress >= 0.5 ? 0.25 : 0.75;
  const positions = [initialProgress, 0.8, 0.2, finalProgress];
  const xAt = (progress) => before.left + (before.right - before.left) * progress;
  try {
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: xAt(initialProgress), y: before.y,
    });
    evaluate(beginProbe);
    await page.send('Input.dispatchMouseEvent', {
      button: 'left', buttons: 1, clickCount: 1, type: 'mousePressed', x: xAt(initialProgress), y: before.y,
    });
    for (let segment = 1; segment < positions.length; segment += 1) {
      for (let step = 1; step <= 24; step += 1) {
        const progress = positions[segment - 1] + (positions[segment] - positions[segment - 1]) * step / 24;
        await page.send('Input.dispatchMouseEvent', {
          button: 'left', buttons: 1, type: 'mouseMoved', x: xAt(progress), y: before.y,
        });
        await delay(12);
      }
    }
    await page.send('Input.dispatchMouseEvent', {
      button: 'left', buttons: 0, clickCount: 1, type: 'mouseReleased', x: xAt(finalProgress), y: before.y,
    });
    // Include the final control commit and its debounced autosave in the probe.
    await delay(650);
    const metrics = evaluate(finishProbe);
    const after = evaluate(`(() => {
      const probe = window.__glyphfieldDesignControlDrag;
      const slider = document.querySelector('input[aria-label="Shader zoom slider"]');
      const canvas = document.querySelector('[data-testid="shader-lab-live-stage"] [data-shader-instance^="canvas-"] canvas');
      probe.slider.removeEventListener('input', probe.onInput);
      const result = {
        canvasHeight: canvas?.height ?? 0,
        canvasWidth: canvas?.width ?? 0,
        distinctValues: new Set(probe.values).size,
        inputEvents: probe.values.length,
        sameCanvas: Boolean(canvas && canvas === probe.canvas && canvas.isConnected),
        value: slider ? Number(slider.value) : null,
        zoom: document.querySelector('input[aria-label="Shader zoom value"]')?.value ?? null,
      };
      delete window.__glyphfieldDesignControlDrag;
      return result;
    })()`);

    check(after.value !== null && after.value !== before.value, 'Design Lab shader zoom did not commit a changed slider value');
    check(after.zoom !== null && after.zoom !== before.zoom, 'Design Lab shader zoom display did not reflect the drag');
    check(after.distinctValues >= 12, `Design Lab slider drag produced only ${after.distinctValues} distinct values`);
    check(after.sameCanvas, 'Design Lab slider drag replaced or removed the main shader canvas');
    checkFramePacing(metrics, 'Design Lab control drag');
    check(metrics.dropRatio <= 0.02, `Design Lab control drag drop ratio ${metrics.dropRatio} exceeds 0.02`);
    check(metrics.maxLongTask === 0, `Design Lab control drag produced a ${metrics.maxLongTask}ms long task`);
    check(metrics.maxLoaf <= 60, `Design Lab control drag produced a ${metrics.maxLoaf}ms long animation frame`);
    check(metrics.maxLoafBlocking <= 10, `Design Lab control drag blocked ${metrics.maxLoafBlocking}ms inside a long animation frame`);
    check(metrics.maxInteraction <= 200, `Design Lab control drag interaction took ${metrics.maxInteraction}ms`);
    check(metrics.maxInputDelay <= 200, `Design Lab control drag input was delayed ${metrics.maxInputDelay}ms`);
    check(metrics.cls <= 0.1, `Design Lab control drag CLS ${metrics.cls} exceeds 0.1`);
    return { after, before, metrics };
  } finally {
    page.close();
  }
}

async function measureProjectSwitches() {
  browser(['click', 'button[aria-label="Open General Translation project"]']);
  browser(['wait', '350']);
  browser(['click', 'button[aria-label="Open Starter project"]']);
  browser(['wait', '350']);
  for (let index = 0; index < 8; index += 1) {
    const name = index % 2 === 0 ? 'General Translation' : 'Starter';
    browser(['click', `button[aria-label="Open ${name} project"]`]);
    await delay(85);
  }
  browser(['wait', '300']);
  evaluate('window.__glyphfieldPerformanceProbe = null');
  await collectGarbage();
  const before = evaluate(`({
    canvases: document.querySelectorAll('canvas').length,
    heap: performance.memory?.usedJSHeapSize ?? null,
    nodes: document.getElementsByTagName('*').length,
    workspaces: document.querySelectorAll('.studio-project-workspace-layer').length,
  })`);
  evaluate(beginProbe);
  for (let index = 0; index < 12; index += 1) {
    const name = index % 2 === 0 ? 'General Translation' : 'Starter';
    browser(['click', `button[aria-label="Open ${name} project"]`]);
    await delay(85);
  }
  browser(['wait', '450']);
  const metrics = evaluate(finishProbe);
  evaluate('window.__glyphfieldPerformanceProbe = null');
  await collectGarbage();
  const afterFirst = evaluate(`({
    canvases: document.querySelectorAll('canvas').length,
    heap: performance.memory?.usedJSHeapSize ?? null,
    nodes: document.getElementsByTagName('*').length,
    workspaces: document.querySelectorAll('.studio-project-workspace-layer').length,
  })`);
  for (let index = 0; index < 20; index += 1) {
    const name = index % 2 === 0 ? 'General Translation' : 'Starter';
    browser(['click', `button[aria-label="Open ${name} project"]`]);
    await delay(70);
  }
  browser(['wait', '650']);
  await collectGarbage();
  const after = evaluate(`({
    canvases: document.querySelectorAll('canvas').length,
    heap: performance.memory?.usedJSHeapSize ?? null,
    nodes: document.getElementsByTagName('*').length,
    workspaces: document.querySelectorAll('.studio-project-workspace-layer').length,
  })`);
  const heapGrowth = afterFirst.heap === null || after.heap === null ? null : after.heap - afterFirst.heap;

  checkFramePacing(metrics, 'Project switching');
  check(metrics.dropRatio <= 0.02, `Project switching drop ratio ${metrics.dropRatio} exceeds 0.02`);
  check(metrics.maxLongTask === 0, `Project switching produced a ${metrics.maxLongTask}ms long task`);
  check(metrics.maxLoaf <= 60, `Project switching produced a ${metrics.maxLoaf}ms long animation frame`);
  check(metrics.maxLoafBlocking <= 10, `Project switching blocked ${metrics.maxLoafBlocking}ms inside a long animation frame`);
  check(metrics.maxInteraction <= 200, `Project switching interaction took ${metrics.maxInteraction}ms`);
  check(after.nodes === before.nodes, `Project switching DOM grew from ${before.nodes} to ${after.nodes} nodes`);
  check(after.canvases === before.canvases, `Project switching canvases grew from ${before.canvases} to ${after.canvases}`);
  check(after.workspaces === before.workspaces, `Project workspaces grew from ${before.workspaces} to ${after.workspaces}`);
  if (heapGrowth !== null) {
    check(heapGrowth <= Math.max(2_000_000, before.heap * 0.15), `Project switching retained ${heapGrowth} heap bytes`);
  }

  return { after, afterFirst, before, heapGrowth, metrics };
}

async function measureTabDrag() {
  const tabs = evaluate(`Array.from(document.querySelectorAll('.project-tab[data-project-id]'))
    .slice(0, 2)
    .map((tab) => {
      const bounds = tab.getBoundingClientRect();
      return { id: tab.dataset.projectId, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    })`);
  if (tabs.length < 2) throw new Error('Tab drag requires at least two open projects');
  evaluate(beginProbe);
  const page = await connectToPage();
  try {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tabs[0].x, y: tabs[0].y });
    await page.send('Input.dispatchMouseEvent', {
      button: 'left', buttons: 1, clickCount: 1, type: 'mousePressed', x: tabs[0].x, y: tabs[0].y,
    });
    const steps = 24;
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await page.send('Input.dispatchMouseEvent', {
        button: 'left',
        buttons: 1,
        type: 'mouseMoved',
        x: tabs[0].x + (tabs[1].x - tabs[0].x) * progress,
        y: tabs[0].y,
      });
      await delay(12);
    }
    await delay(80);
    const midpoint = evaluate(`Array.from(document.querySelectorAll('.project-tab[data-project-id]')).map((tab) => ({
      dragging: tab.dataset.dragging === 'true',
      id: tab.dataset.projectId,
      shifting: tab.dataset.shifting === 'true',
      transform: tab.style.transform,
    }))`);
    await page.send('Input.dispatchMouseEvent', {
      button: 'left', buttons: 0, clickCount: 1, type: 'mouseReleased', x: tabs[1].x, y: tabs[1].y,
    });
    await delay(350);
    browser(['wait', '300']);
    const metrics = evaluate(finishProbe);
    const order = evaluate(`Array.from(document.querySelectorAll('.project-tab[data-project-id]')).map((tab) => tab.dataset.projectId)`);

    check(midpoint.some((tab) => tab.dragging && tab.transform), 'Dragged tab did not follow the pointer');
    check(midpoint.some((tab) => tab.shifting && tab.transform), 'Destination tab did not open a live slot');
    check(order[1] === tabs[0].id, 'Dragged tab did not commit into the destination slot');
    checkFramePacing(metrics, 'Tab drag');
    check(metrics.dropRatio <= 0.02, `Tab drag drop ratio ${metrics.dropRatio} exceeds 0.02`);
    check(metrics.maxLongTask === 0, `Tab drag produced a ${metrics.maxLongTask}ms long task`);
    check(metrics.maxLoaf <= 60, `Tab drag produced a ${metrics.maxLoaf}ms long animation frame`);
    check(metrics.maxLoafBlocking <= 10, `Tab drag blocked ${metrics.maxLoafBlocking}ms inside a long animation frame`);
    check(metrics.maxInteraction <= 200, `Tab drag interaction took ${metrics.maxInteraction}ms`);
    return { metrics, midpoint, order };
  } finally {
    page.close();
  }
}

async function measureHorizontalRail() {
  evaluate(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const names = ['Basement', 'Ramp', 'Mintlify', 'Tailwind CSS', 'Vite+', 'Cloudflare', 'Stripe'];
    for (const name of names) {
      const trigger = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('All projects'));
      if (trigger?.getAttribute('aria-expanded') !== 'true') {
        trigger?.click();
        await wait(40);
      }
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((button) => button.textContent?.startsWith(name));
      item?.click();
      await wait(170);
    }
    return true;
  })()`);
  browser(['set', 'viewport', '640', '800']);
  browser(['wait', '450']);
  const before = evaluate(`(() => {
    const rail = document.querySelector('.project-tabs-scroll');
    return { clientWidth: rail.clientWidth, maxScroll: rail.scrollWidth - rail.clientWidth };
  })()`);
  check(before.maxScroll > 0, 'The compact project rail did not become horizontally scrollable');
  evaluate(beginProbe);
  for (let index = 0; index < 3; index += 1) {
    browser(['click', 'button[aria-label="Scroll project tabs right"]']);
    await delay(300);
    browser(['click', 'button[aria-label="Scroll project tabs left"]']);
    await delay(300);
  }
  browser(['wait', '350']);
  const metrics = evaluate(finishProbe);
  const after = evaluate(`(() => {
    const rail = document.querySelector('.project-tabs-scroll');
    return { maxScroll: rail.scrollWidth - rail.clientWidth, scrollLeft: rail.scrollLeft };
  })()`);

  check(after.scrollLeft <= 1, `Horizontal project rail stopped at ${after.scrollLeft}px instead of the start`);
  checkFramePacing(metrics, 'Horizontal rail');
  check(metrics.dropRatio <= 0.02, `Horizontal rail drop ratio ${metrics.dropRatio} exceeds 0.02`);
  check(metrics.maxLongTask === 0, `Horizontal rail produced a ${metrics.maxLongTask}ms long task`);
  check(metrics.maxLoaf <= 60, `Horizontal rail produced a ${metrics.maxLoaf}ms long animation frame`);
  check(metrics.maxLoafBlocking <= 10, `Horizontal rail blocked ${metrics.maxLoafBlocking}ms inside a long animation frame`);
  check(metrics.maxInteraction <= 200, `Horizontal rail interaction took ${metrics.maxInteraction}ms`);
  return { after, before, metrics };
}

async function main() {
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) throw new Error(`${baseUrl} returned HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`Start a production server first (for example: pnpm start --hostname 127.0.0.1 --port 3013). ${error.message}`);
  }

  try {
    browser(['open', `${baseUrl}/`]);
    const report = {
      designControlDrag: null,
      horizontalRail: null,
      landingScroll: await measureLandingScroll(),
      landingShaderLifecycle: null,
      projectSwitches: null,
      studioEntry: null,
      tabDrag: null,
    };
    if (!landingOnly) {
      report.landingShaderLifecycle = await measureLandingShaderLifecycle();
      report.studioEntry = await measureStudioEntry();
      report.designControlDrag = await measureDesignControlDrag();
      report.projectSwitches = await measureProjectSwitches();
      report.tabDrag = await measureTabDrag();
      report.horizontalRail = await measureHorizontalRail();
    }
    console.log(JSON.stringify({ failures, report }, null, 2));
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    try {
      browser(['close']);
    } catch {}
  }
}

main().catch((error) => {
  console.error(`[interaction-performance] ${error.message}`);
  process.exitCode = 1;
});
