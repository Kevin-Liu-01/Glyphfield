#!/usr/bin/env node
// Real input, public Studio source APIs, and decoded export pixels. No app storage writes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.GLYPHFIELD_TEXT_BASE_URL ?? 'http://localhost:3013';
const output = process.env.GLYPHFIELD_TEXT_OUTPUT ?? mkdtempSync(join(tmpdir(), 'glyphfield-text-export-'));
const session = `glyphfield-text-parity-${process.pid}`;
const report = { baseUrl, output, checks: [] };

function browser(args, input) {
  let raw;
  try {
    raw = execFileSync(process.env.AGENT_BROWSER_BIN ?? 'agent-browser',
      ['--session', session, '--json', ...args], { encoding: 'utf8', input, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) { throw new Error(`${args[0]}: ${error.stdout || error.stderr || error.message}`); }
  const result = JSON.parse(raw);
  if (Array.isArray(result)) return result;
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data?.result ?? result.data;
}
function evaluate(operation, ...args) {
  return browser(['eval', '--stdin'], `(${operation.toString()})(...${JSON.stringify(args)})`);
}
function check(condition, label) {
  report.checks.push({ label, passed: Boolean(condition) });
  if (!condition) throw new Error(label);
  console.log(`PASS ${label}`);
}
async function configure() {
  const studio = window.glyphfield.studio;
  const source = JSON.parse(studio.readSource());
  const text = Object.values(source.elements).find((element) => element.kind === 'text');
  const page = source.pages[source.pageIds[0]];
  Object.assign(page, { width: 1080, height: 1920, background: '#000000' });
  source.elements = { [text.id]: text };
  page.elementIds = [text.id];
  text.hidden = false;
  text.content = 'testing';
  text.bounds = { ...text.bounds, x: 0, y: -220, width: 1, height: 1 };
  Object.assign(text.data, { value: 'testing', color: '#FFFFFF', align: 'center', weight: 500,
    lineHeight: 0.95, tracking: -0.06, wrap: 'wrap', outlineEnabled: false, shadowEnabled: false,
    transform: { x: 0, y: -220, scale: 1, widthScale: 1, heightScale: 1 } });
  source.metadata.designLab.ratio = 'story';
  source.metadata.designLab.timeline.paused = true;
  source.metadata.designLab.exportSettings.width = 960;
  source.metadata.designLab.shaderSequence.targetLayerId = null;
  const workspace = source.metadata.designLab.workspace;
  const artboard = workspace.artboards.find((entry) => entry.id === workspace.activeArtboardId);
  Object.assign(artboard.snapshot, { dimensions: { width: 1080, height: 1920 }, ratio: 'story',
    backgroundColor: '#000000', layerOrder: [text.id], textLayers: [text.data], shaderLayers: [], logos: [],
    effectLayers: [], assets: [], groups: [], layerShaders: {}, timeline: source.metadata.designLab.timeline,
    shaderSequence: source.metadata.designLab.shaderSequence });
  workspace.artboards = [artboard];
  await studio.applySource(source);
}
function textMetrics() {
  const studio = window.glyphfield.studio;
  const source = JSON.parse(studio.readSource());
  const data = Object.values(source.elements).find((element) => element.kind === 'text').data;
  const text = document.querySelector('[data-testid="shader-lab-live-stage"] [data-canvas-editable]');
  const range = document.createRange();
  range.selectNodeContents(text);
  const stage = text.closest('.shader-lab-v2-stage');
  return { scale: data.transform.scale, lines: range.getClientRects().length,
    fontRatio: parseFloat(getComputedStyle(text).fontSize) / parseFloat(getComputedStyle(stage).width),
    text: text.textContent };
}
async function exportPixels(format = 'png') {
  const asset = await window.glyphfield.studio.invoke('design.export', { format, download: false });
  if (!(asset.blob instanceof Blob) || !asset.blob.size) throw new Error('Missing image bytes');
  const bitmap = await createImageBitmap(asset.blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const bands = [];
  let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    let lit = false;
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (pixels[offset] > 32 && pixels[offset + 1] > 32 && pixels[offset + 2] > 32) {
        lit = true;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    if (!lit) continue;
    const last = bands.at(-1);
    if (last && y - last.end <= 2) last.end = y;
    else bands.push({ start: y, end: y });
  }
  // Independent expectation from the actual DOM's resolved font, not source or
  // export constants. This catches size/zoom/resolution drift as well as wrapping.
  const text = document.querySelector('[data-testid="shader-lab-live-stage"] [data-canvas-editable]');
  const style = getComputedStyle(text);
  const scale = canvas.width / text.closest('.shader-lab-v2-stage').clientWidth;
  context.font = `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
  context.letterSpacing = `${parseFloat(style.letterSpacing) * scale}px`;
  const ink = context.measureText(text.textContent);
  const expectedInk = { width: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight,
    height: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent };
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(asset.blob);
  });
  return { width: canvas.width, height: canvas.height, bands, dataUrl, expectedInk,
    ink: { width: maxX - minX + 1, height: maxY - minY + 1 }, mime: asset.blob.type };
}

async function resizeExport(width, artboardWidth = 1080, artboardHeight = 1920, scale = 0.7) {
  const studio = window.glyphfield.studio;
  const source = JSON.parse(studio.readSource());
  const page = source.pages[source.pageIds[0]];
  Object.assign(page, { width: artboardWidth, height: artboardHeight });
  const text = Object.values(source.elements).find((element) => element.kind === 'text');
  text.data.transform.scale = scale;
  text.data.transform.y = -220 / 1920 * artboardHeight;
  text.bounds.y = text.data.transform.y;
  source.metadata.designLab.ratio = artboardWidth === 1000 ? 'banner' : 'story';
  source.metadata.designLab.exportSettings.width = width;
  const snapshot = source.metadata.designLab.workspace.artboards[0].snapshot;
  snapshot.dimensions = { width: artboardWidth, height: artboardHeight };
  snapshot.ratio = source.metadata.designLab.ratio;
  snapshot.textLayers = [text.data];
  await studio.applySource(source);
}

function verifyInk(exported, label) {
  check(Math.abs(exported.ink.width - exported.expectedInk.width) <= 3, `${label}: exported glyph width matches the canvas font`);
  check(Math.abs(exported.ink.height - exported.expectedInk.height) <= 3, `${label}: exported glyph height matches the canvas font`);
}

function checkPointerCommit() {
  browser(['click', '.shader-export-dialog button[aria-label="Close export preview"]']);
  browser(['click', '[data-testid="shader-lab-live-stage"] [data-canvas-editable]']);
  const box = evaluate(() => {
    const input = document.querySelector('input[aria-label="Text size"]');
    const { x, y, width, height } = input.getBoundingClientRect();
    return { x, y, width, height, value: Number(input.value), min: Number(input.min), max: Number(input.max) };
  });
  const xFor = (value) => Math.round(box.x + 7 + (value - box.min) / (box.max - box.min) * (box.width - 14));
  const y = Math.round(box.y + box.height / 2);
  browser(['batch', '--bail', `mouse move ${xFor(box.value)} ${y}`, 'mouse down left', `mouse move ${xFor(0.8)} ${y}`]);
  browser(['wait', '[data-canvas-preview-pending="true"]']);
  const pending = evaluate(async () => {
    try {
      await window.glyphfield.studio.invoke('design.export', { format: 'png', download: false });
      return false;
    } catch { return Boolean(document.querySelector('[data-canvas-preview-pending="true"]')); }
  });
  check(pending, 'export cannot silently capture stale source during a held drag');
  browser(['batch', '--bail', `mouse move ${xFor(0.8)} ${y - 90}`, 'mouse up left']);
  const final = evaluate(() => ({ source: Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements)
    .find((element) => element.kind === 'text').data.transform.scale,
  input: Number(document.querySelector('input[aria-label="Text size"]').value),
  pending: Boolean(document.querySelector('[data-canvas-preview-pending="true"]')) }));
  check(!final.pending && final.source === final.input && final.source !== box.value,
    'releasing the pointer outside the control commits its exact visible value');
  const result = evaluate(exportPixels);
  delete result.dataUrl;
  report.pointer = result;
  check(result.bands.length === 1, 'pointer-edited PNG preserves one-line text');
  verifyInk(result, 'pointer edit');
  browser(['click', '.shader-export-dialog button[aria-label="Close export preview"]']);
  browser(['wait', '--fn', 'window.glyphfield?.studio.activeTool() === "material"']);
  const committed = evaluate(textMetrics);
  evaluate(async () => {
    const studio = window.glyphfield.studio;
    await studio.applySource(studio.readSource());
  });
  browser(['wait', '[data-testid="shader-lab-live-stage"] [data-canvas-editable]']);
  browser(['wait', '--fn', 'window.glyphfield?.studio.activeTool() === "material"']);
  const restored = evaluate(textMetrics);
  check(restored.scale === committed.scale && Math.abs(restored.fontRatio - committed.fontRatio) < 0.001,
    'portable source round trip preserves the committed typography after a drag');
}

try {
  browser(['batch', '--bail', 'set viewport 1440 1000 1', `open ${baseUrl}/studio?tool=material`]);
  browser(['wait', '--fn', 'window.glyphfield?.studio.activeTool() === "material" && Boolean(window.glyphfield.studio.readSource())']);
  evaluate(() => window.glyphfield.studio.activate('Add text layer'));
  browser(['wait', '--fn', 'Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements).some(e => e.kind === "text")']);
  evaluate(configure);
  browser(['wait', '[data-testid="shader-lab-live-stage"] [data-canvas-editable]']);
  browser(['batch', '--bail', `click '[data-testid="shader-lab-live-stage"] [data-canvas-editable]'`,
    `focus 'input[aria-label="Text size"]'`, ...Array.from({ length: 6 }, () => 'press ArrowLeft')]);
  browser(['wait', '--fn', 'parseFloat(getComputedStyle(document.querySelector("[data-testid=shader-lab-live-stage] [data-canvas-editable]")).fontSize) < 70']);
  report.dom = evaluate(textMetrics);
  const exported = evaluate(exportPixels);
  writeFileSync(join(output, 'keyboard-export.png'), Buffer.from(exported.dataUrl.split(',')[1], 'base64'));
  delete exported.dataUrl;
  report.export = exported;
  browser(['screenshot', join(output, 'canvas.png')]);
  check(report.dom.lines === 1, 'the edited canvas shows testing on one line');
  check(exported.bands.length === report.dom.lines, 'decoded PNG preserves the visible line count without blurring the control');
  check(Math.abs(report.dom.scale - 0.7) < 0.001, 'keyboard text size is committed to portable source immediately');
  check(exported.width === 960 && exported.height === 1706, 'PNG has the requested portrait dimensions');
  check(exported.mime === 'image/png', 'PNG bytes have the correct MIME type');
  verifyInk(exported, 'standard PNG');
  checkPointerCommit();
  report.sizes = [];
  for (const width of [640, 1920]) {
    evaluate(resizeExport, width);
    const result = evaluate(exportPixels);
    writeFileSync(join(output, `text-${width}.png`), Buffer.from(result.dataUrl.split(',')[1], 'base64'));
    delete result.dataUrl;
    report.sizes.push(result);
    check(result.bands.length === 1, `${width}px export retains a single line`);
    verifyInk(result, `${width}px PNG`);
  }
  evaluate(resizeExport, 960);
  const jpg = evaluate(exportPixels, 'jpg');
  writeFileSync(join(output, 'text.jpg'), Buffer.from(jpg.dataUrl.split(',')[1], 'base64'));
  delete jpg.dataUrl;
  report.jpg = jpg;
  check(jpg.mime === 'image/jpeg' && jpg.bands.length === 1, 'JPG preserves the same one-line text');
  verifyInk(jpg, 'JPG');
  evaluate(resizeExport, 320, 1000, 300, 0.2);
  const small = evaluate(exportPixels);
  writeFileSync(join(output, 'small-type.png'), Buffer.from(small.dataUrl.split(',')[1], 'base64'));
  delete small.dataUrl;
  report.small = small;
  verifyInk(small, 'small banner type');
} catch (error) {
  report.error = error.message;
  try { report.snapshot = browser(['snapshot', '-i']); browser(['screenshot', join(output, 'failure.png')]); } catch { /* Keep the original diagnostic. */ }
  process.exitCode = 1;
  console.error(error.message);
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  browser(['close']);
  console.log(`Evidence: ${output}`);
}
