#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const baseUrl = process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://127.0.0.1:3013';
const command = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const session = `glyphfield-native-frames-${process.pid}`;
const representative = ['holo-cloth-silk', 'glyphfield-glyph-field', 'glyphfield-dither-gradient', 'pavel-fluid-energy', 'paper-gem-smoke', 'paper-dithering', 'shadergradient-prismatic-sphere'];
const argument = process.argv.find((value) => value.startsWith('--materials='));
const allMaterials = process.argv.includes('--all');
let materials = [];
const failures = [];
const results = [];

function browser(args) {
  const result = JSON.parse(execFileSync(command, ['--session', session, '--json', ...args], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  if (Array.isArray(result)) {
    if (result.some((item) => !item.success)) throw new Error(JSON.stringify(result));
    return result;
  }
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data?.result ?? result.data;
}

async function foreground() {
  const url = execFileSync(command, ['--session', session, 'get', 'cdp-url'], { encoding: 'utf8' }).trim();
  const socket = new WebSocket(url);
  const pending = new Map();
  let sequence = 0;
  const timeout = setTimeout(() => socket.close(), 10_000);
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => pending.forEach(({ reject }) => reject(new Error('Foreground connection closed.'))));
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
      socket.addEventListener('close', () => reject(new Error('Foreground connection failed.')), { once: true });
    });
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find((item) => item.type === 'page' && item.url.startsWith(baseUrl));
    if (!target) throw new Error('Native shader page not found.');
    const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await send('Page.bringToFront', {}, sessionId);
  } finally { clearTimeout(timeout); socket.close(); }
}

const probe = `(async () => {
  const api = window.glyphfieldShaderFrames;
  await document.fonts.ready;
  await api.ready();
  await new Promise(resolve => setTimeout(resolve, 700));
  const captured = api.freeze();
  await new Promise(resolve => setTimeout(resolve, 400));
  const frozen = api.read();
  const png = await api.pngRoundTrip();
  const isFluid = captured.state.engine === 'fluid';
  const restored = isFluid ? null : await api.restore(captured.state, captured.state.timelineTimeMs);
  if (isFluid) api.resume();
  else await api.restore(captured.state, null, false);
  await new Promise(resolve => setTimeout(resolve, 200));
  const resumed = api.read();
  return { captured, frozen, png, restored, resumed, devicePixelRatio, visibility: document.visibilityState };
})()`;

try {
  const response = await fetch(new URL('/api/materials', baseUrl));
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  const definitions = new Map(catalog.materials.map((material) => [material.id, material]));
  if (allMaterials && argument) throw new Error('Choose --all or --materials=..., not both.');
  materials = allMaterials ? [...definitions.keys()]
    : argument ? argument.slice('--materials='.length).split(',').filter(Boolean) : representative;
  if (!materials.length || materials.some((id) => !definitions.has(id))) throw new Error('Select authentic catalog IDs; no fallback normalization.');
  if (new Set(materials).size !== materials.length) throw new Error('Each selected shader must be checked once.');
  if (materials.some((id) => !['static', 'direct-time', 'procedural', 'stateful'].includes(definitions.get(id).motion?.motionModel))) {
    throw new Error('Catalog motion capabilities are required; do not guess playback behavior.');
  }
  console.log(`Checking ${materials.length} native shaders${allMaterials ? ' (complete API catalog)' : ''}.`);
  browser(['batch', 'set viewport 640 360 1', `open ${baseUrl}/shader-preview?diagnostics=1&live=1&materialId=${encodeURIComponent(materials[0])}`]);
  for (const [index, materialId] of materials.entries()) {
    try {
      if (index) browser(['open', `${baseUrl}/shader-preview?diagnostics=1&live=1&materialId=${encodeURIComponent(materialId)}`]);
      await foreground();
      browser(['wait', '--fn', 'Boolean(window.glyphfieldShaderFrames)']);
      if (materialId === 'holo-cloth-silk') browser(['mouse', 'move', '480', '90']);
      const result = browser(['eval', probe]);
      const motion = definitions.get(materialId).motion;
      const isStatic = motion.motionModel === 'static';
      results.push({ materialId, motion, ...result });
      const check = (condition, detail) => { if (!condition) failures.push(`${materialId}: ${detail}`); };
      const isNonblank = (pixels) => pixels.visibleFraction > 0.2 && (isStatic || pixels.luminanceRange > 5);
      check(result.visibility === 'visible' && result.devicePixelRatio === 1, 'not a controlled visible DPR1 page');
      check(result.captured.state.materialId === materialId, 'wrong renderer identity');
      check(result.captured.state.engine === 'canvas2d' || result.captured.drawingBufferPreserved === true, 'native GPU drawing buffer is not preserved for exact readback');
      check(isNonblank(result.captured.pixels), 'blank/flat native pixels');
      check(result.frozen.comparison?.changedPixels === 0, 'pixels changed while frozen');
      check(result.frozen.state.frame === result.captured.state.frame, 'native clock changed while frozen');
      check(result.png.bytes > 0 && result.png.mime === 'image/png' && result.png.comparison.changedPixels === 0, 'lossless PNG round-trip mismatch');
      if (motion.motionModel === 'stateful') check(result.restored === null, 'a stateful renderer was falsely reconstructed from time');
      else check(result.restored?.comparison.changedPixels === 0, 'remounted native anchor changed pixels');
      check(isNonblank(result.resumed.pixels), 'resumed native shader is blank/flat');
      if (isStatic) check(result.resumed.comparison.changedPixels === 0, 'a static shader changed its pixels during playback');
      else {
        check(result.resumed.state.frame > result.captured.state.frame, 'native playback did not continue from its anchor');
        check(result.resumed.comparison.changedPixels > 0, 'resumed native shader did not move');
      }
      console.log(`[${index + 1}/${materials.length}] ${materialId}: frozen ${result.frozen.comparison.changedPixels}px; PNG ${result.png.comparison.changedPixels}px; restored ${result.restored?.comparison.changedPixels ?? 'stateful: bitmap only'}${result.restored ? 'px' : ''}`);
    } catch (error) {
      failures.push(`${materialId}: ${String(error.stderr || error.stdout || error.message).slice(0, 1800)}`);
    }
  }
} catch (error) { failures.push(error.message); }
finally { try { browser(['close']); } catch { /* Own session only. */ } }

const report = { baseUrl, mode: allMaterials ? 'all' : argument ? 'selected' : 'representative', selectedMaterials: materials, failures, results, notes: [
  'Actual native canvas RGBA capture, not screenshots of fallback images.',
  'Raw PNG pixels are checked here; Paper CSS filter/grain presentation is separate metadata with separate compositor tests.',
  'Fluid checks preserve live GPU state in memory and authoritative PNG pixels; timestamps do not reconstruct a fluid simulation.',
  'Remount comparisons are same-browser/device, not a universal cross-GPU pixel identity claim.',
  'Static shader models must keep their output identical during playback; a static preset may intentionally have flat color.',
] };
if (process.env.GLYPHFIELD_SHADER_FRAME_REPORT_PATH) writeFileSync(process.env.GLYPHFIELD_SHADER_FRAME_REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`${results.length}/${materials.length} shaders checked; ${failures.length} failures.`);
failures.forEach((failure) => console.error(failure));
process.exitCode = failures.length ? 1 : 0;
