#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const baseUrl = process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://127.0.0.1:3013';
const session = `glyphfield-shader-cadence-${process.pid}`;
const command = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const representative = ['holo-cloth-silk', 'glyphfield-glyph-field', 'glyphfield-dither-gradient', 'pavel-fluid-energy', 'paper-gem-smoke', 'paper-dithering', 'shadergradient-prismatic-sphere'];
const argument = process.argv.find((value) => value.startsWith('--materials='));
const materials = argument ? argument.slice('--materials='.length).split(',').filter(Boolean) : representative;
const failures = [];
const results = [];

function browser(args) {
  const output = execFileSync(command, ['--session', session, '--json', ...args], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = JSON.parse(output);
  if (Array.isArray(result)) {
    if (result.some((item) => !item.success)) throw new Error(JSON.stringify(result));
    return result;
  }
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data?.result ?? result.data;
}

// Observe native drawing APIs, not React state, shader time, or an rAF-only FPS
// counter. Multiple passes on one canvas count once per display opportunity.
const measure = `(async () => {
  const canvas = document.querySelector('[data-live-material-surface] canvas');
  if (!canvas) throw new Error('No authentic shader canvas');
  const restores = [];
  let drew = false;
  let drawCalls = 0;
  let hidden = document.visibilityState !== 'visible';
  const onVisibility = () => { if (document.visibilityState !== 'visible') hidden = true; };
  document.addEventListener('visibilitychange', onVisibility);
  const wrap = (prototype, key) => {
    if (!prototype || !Object.hasOwn(prototype, key)) return;
    const original = prototype[key];
    prototype[key] = function (...args) {
      const result = Reflect.apply(original, this, args);
      if (this.canvas === canvas) { drew = true; drawCalls += 1; }
      return result;
    };
    restores.push(() => { prototype[key] = original; });
  };
  const draws = [];
  const frames = [];
  let start = 0;
  let end = 0;
  try {
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) wrap(prototype, method);
    }
    for (const method of ['clearRect', 'fillRect', 'fillText', 'drawImage']) wrap(window.CanvasRenderingContext2D?.prototype, method);
    await new Promise((resolve) => requestAnimationFrame((time) => { start = time; drew = false; drawCalls = 0; resolve(); }));
    await new Promise((resolve) => {
      const tick = (time) => {
        frames.push(time);
        if (drew) draws.push(time);
        drew = false;
        end = time;
        if (time - start < 4000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const gaps = (times) => times.slice(1).map((time, index) => time - times[index]);
    const percentile = (values, quantile) => [...values].sort((a,b) => a-b)[Math.floor((values.length - 1) * quantile)] ?? 0;
    const round = (value) => Number(value.toFixed(2));
    const seconds = (end - start) / 1000;
    const drawGaps = gaps([start, ...draws, end]);
    return {
      actualDrawFrames: draws.length, actualDrawFps: round(draws.length / seconds),
      displayCallbacks: frames.length, displayCallbackFps: round(frames.length / seconds),
      drawCalls, durationMs: round(end - start), hiddenDuringProbe: hidden,
      maxDrawGapMs: round(Math.max(0, ...drawGaps)), p95DrawGapMs: round(percentile(drawGaps, 0.95)),
      p95DisplayGapMs: round(percentile(gaps(frames), 0.95)),
      width: canvas.width, height: canvas.height, devicePixelRatio,
      materialId: document.querySelector('[data-material-id]')?.getAttribute('data-material-id'),
      playback: document.querySelector('[data-shader-playback]')?.getAttribute('data-shader-playback'),
      retainedCanvas: canvas.isConnected && document.querySelector('[data-live-material-surface] canvas') === canvas,
      userAgent: navigator.userAgent,
    };
  } finally {
    restores.reverse().forEach((restore) => restore());
    document.removeEventListener('visibilitychange', onVisibility);
  }
})()`;

try {
  const response = await fetch(new URL('/api/materials', baseUrl));
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  const ids = new Set(catalog.materials.map((material) => material.id));
  if (!materials.length || materials.some((id) => !ids.has(id))) throw new Error('Select existing catalog material IDs; no silent fallback.');
  browser(['batch', 'set viewport 640 360 1', `open ${baseUrl}/shader-preview?diagnostics=1&live=1&materialId=${encodeURIComponent(materials[0])}`]);
  for (const [index, materialId] of materials.entries()) {
    try {
      if (index) browser(['open', `${baseUrl}/shader-preview?diagnostics=1&live=1&materialId=${encodeURIComponent(materialId)}`]);
      browser(['wait', '--fn', `Boolean(document.querySelector('[data-live-material-surface] canvas')) && !document.querySelector('[data-live-material-ready="false"], [data-live-material-ready="error"]')`]);
      browser(['wait', '2000']);
      const result = browser(['eval', measure]);
      results.push(result);
      if (result.materialId !== materialId || result.playback !== 'live' || !result.retainedCanvas) failures.push(`${materialId}: wrong, replaced, or non-live renderer`);
      if (result.hiddenDuringProbe) failures.push(`${materialId}: hidden browser invalidates cadence measurement`);
      if (result.displayCallbackFps < 55) failures.push(`${materialId}: browser/display scheduling only ${result.displayCallbackFps}fps; 60fps environment budget unmet`);
      if (result.actualDrawFps < 55) failures.push(`${materialId}: actual draws ${result.actualDrawFps}fps are below the 60fps target tolerance`);
      if (result.p95DrawGapMs > 35) failures.push(`${materialId}: p95 draw gap ${result.p95DrawGapMs}ms exceeds 35ms`);
      if (result.maxDrawGapMs > 50) failures.push(`${materialId}: maximum draw gap ${result.maxDrawGapMs}ms exceeds 50ms`);
      console.log(`${materialId}: ${result.actualDrawFps} draw fps / ${result.displayCallbackFps} display callbacks; p95 gap ${result.p95DrawGapMs}ms`);
    } catch (error) {
      const detail = String(error.stderr || error.stdout || error.message).slice(0, 2000);
      failures.push(`${materialId}: ${detail}`);
    }
  }
} catch (error) {
  failures.push(error.message);
} finally {
  try { browser(['close']); } catch { /* Close only this runner's browser. */ }
}

const report = {
  baseUrl, failures, results,
  notes: ['Native draw submission opportunities are measured, not GPU completion/presentation or universal device FPS.', 'Four-second foreground samples after warmup at640×360 DPR1. GPU timer queries and per-frame readPixels are disabled.', 'Saved capture/export frame rates and authored motion speed are not changed by this check.'],
};
if (process.env.GLYPHFIELD_SHADER_CADENCE_REPORT_PATH) writeFileSync(process.env.GLYPHFIELD_SHADER_CADENCE_REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`${results.length} shaders measured; ${failures.length} failures.`);
failures.forEach((failure) => console.error(failure));
process.exitCode = failures.length ? 1 : 0;
