#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const baseUrl = process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://127.0.0.1:3013';
const agentBrowser = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const readinessTimeout = Number(process.env.GLYPHFIELD_SHADER_READY_TIMEOUT_MS ?? 15000);
const session = `glyphfield-shader-pixels-${process.pid}`;
const width = 640;
const height = 360;
const failures = [];
const results = [];
const representative = [
  'holo-cloth-silk',
  'glyphfield-glyph-field',
  'glyphfield-dither-gradient',
  'pavel-fluid-energy',
  'paper-gem-smoke',
  'paper-dithering',
  'shadergradient-prismatic-sphere',
];

function browser(args) {
  let output;
  try {
    output = execFileSync(agentBrowser, ['--session', session, '--json', ...args], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.max(60_000, readinessTimeout + 10_000),
    }).trim();
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).slice(0, 3_000);
    throw new Error(`agent-browser ${args[0]} failed (${error.code ?? error.signal ?? error.status}): ${detail}`);
  }
  const result = JSON.parse(output);
  if (Array.isArray(result)) {
    const failed = result.find((entry) => !entry.success);
    if (failed) throw new Error(JSON.stringify(failed.error ?? failed));
    return result.map((entry) => entry.result);
  }
  if (!result.success) throw new Error(result.error?.message ?? String(result.error ?? `agent-browser ${args[0]} failed`));
  return result.data?.result ?? result.data;
}

function check(condition, message) { if (!condition) failures.push(message); }

async function materialsToCheck() {
  const response = await fetch(new URL('/api/materials', baseUrl));
  if (!response.ok) throw new Error(`Material catalog failed: HTTP ${response.status}`);
  const catalog = await response.json();
  const ids = new Set(catalog.materials.map((material) => material.id));
  const argument = process.argv.find((value) => value.startsWith('--materials='));
  const selected = process.argv.includes('--catalog') ? [...ids]
    : argument ? argument.slice('--materials='.length).split(',').filter(Boolean) : representative;
  for (const id of selected) {
    if (!ids.has(id)) throw new Error(`Unknown catalog material: ${id}. Refusing silent normalization to the default.`);
  }
  if (!selected.length) throw new Error('No materials selected.');
  return selected;
}

function pixelFailures(materialId, sample, label) {
  check(sample.materialId === materialId, `${materialId}: ${label} rendered a different material (${sample.materialId})`);
  check(sample.pixels.width === width && sample.pixels.height === height,
    `${materialId}: ${label} canvas ${sample.pixels.width}×${sample.pixels.height}; expected ${width}×${height}`);
  // The sphere is a genuinely transparent 3D canvas, not a full-screen plane.
  const minimumCoverage = materialId === 'shadergradient-prismatic-sphere' ? 0.2 : 0.95;
  check(sample.pixels.visibleFraction > minimumCoverage, `${materialId}: ${label} canvas is blank/mostly transparent`);
  check(sample.pixels.luminanceRange > 5, `${materialId}: ${label} canvas is flat/blank instead of a shader`);
}

function assertPaused(materialId, sample, label) {
  check(sample.comparison?.dimensionsMatch && sample.comparison.changedPixels === 0,
    `${materialId}: ${label} fixed-time pixels changed while paused (${sample.comparison?.changedPixels} pixels)`);
}

function sampleExpression(materialId) {
  return `(async () => {
    const preview = window.glyphfieldShaderPreview;
    const readiness = await preview.ready(${JSON.stringify(readinessTimeout)});
    const environment = {
      devicePixelRatio, innerHeight, innerWidth,
      visibility: document.visibilityState,
      userAgent: navigator.userAgent,
    };
    const first = await preview.read();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const paused = await preview.read();
    await preview.setTime(2300);
    const changedTime = await window.glyphfieldShaderPreview.read();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const changedTimePaused = await window.glyphfieldShaderPreview.read();
    return { materialId: ${JSON.stringify(materialId)}, readiness, environment, first, paused, changedTime, changedTimePaused };
  })()`;
}

try {
  if (!Number.isFinite(readinessTimeout) || readinessTimeout < 1 || readinessTimeout > 60_000) {
    throw new Error('GLYPHFIELD_SHADER_READY_TIMEOUT_MS must be between 1 and 60000.');
  }
  const materials = await materialsToCheck();
  browser(['batch', `set viewport ${width} ${height} 1`, `open ${baseUrl}/shader-preview?diagnostics=1&materialId=${encodeURIComponent(materials[0])}`]);
  for (const [index, materialId] of materials.entries()) {
    try {
      if (index) browser(['open', `${baseUrl}/shader-preview?diagnostics=1&materialId=${encodeURIComponent(materialId)}`]);
      browser(['wait', '--fn', 'Boolean(window.glyphfieldShaderPreview)']);
      const result = browser(['eval', sampleExpression(materialId)]);
      check(result.environment.devicePixelRatio === 1, `${materialId}: uncontrolled DPR ${result.environment.devicePixelRatio}`);
      check(result.environment.visibility === 'visible', `${materialId}: sampled a hidden browser tab`);
      pixelFailures(materialId, result.first, 'initial');
      pixelFailures(materialId, result.changedTime, 'scrubbed');
      assertPaused(materialId, result.paused, 'initial');
      assertPaused(materialId, result.changedTimePaused, 'scrubbed');
      // Stateful fluids are checked for settled pause/scrub stability, not
      // misrepresented as reconstructible from a timestamp across fresh mounts.
      if (materialId === 'pavel-fluid-energy') {
        check(result.first.pixels.sha256 === result.changedTime.pixels.sha256,
          `${materialId}: a timestamp seek mutated state instead of preserving the current simulation`);
      } else if (representative.includes(materialId)) {
        check(result.first.pixels.sha256 !== result.changedTime.pixels.sha256,
          `${materialId}: changing fixed time from 1600ms to 2300ms did not affect actual pixels`);
      }
      results.push(result);
      console.log(`${materialId}: ${result.first.pixels.sha256.slice(0, 12)} · ready ${result.readiness.readinessMs.toFixed(1)}ms · GPU ${result.paused.diagnostics[0]?.timing?.gpu.status ?? 'uninstrumented'}`);
    } catch (error) {
      const message = `${materialId}: ${error instanceof Error ? error.message : String(error)}`;
      failures.push(message);
      results.push({ materialId, error: message });
      console.error(message);
    }
  }
  const report = {
    baseUrl, dimensions: { devicePixelRatio: 1, height, width }, failures,
    notes: [
      'These checks read real renderer RGBA pixels; fallback images do not count.',
      'CPU callback/compilation time is not GPU time. Unsupported GPU queries and uninstrumented native providers are explicit.',
      'Hashes are same-session evidence, not universal goldens across browser/GPU implementations.',
      'Stateful Fluid fixed-time checks do not claim timestamp-only reconstruction after remount.',
    ],
    results,
  };
  if (process.env.GLYPHFIELD_SHADER_REPORT_PATH) {
    writeFileSync(process.env.GLYPHFIELD_SHADER_REPORT_PATH, JSON.stringify(report, null, 2));
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${results.length} shaders checked; ${failures.length} failures.`);
    failures.forEach((failure) => console.error(failure));
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error(failures.at(-1));
} finally {
  try { browser(['close']); } catch { /* Only this diagnostic session is closed. */ }
}

process.exitCode = failures.length ? 1 : 0;
