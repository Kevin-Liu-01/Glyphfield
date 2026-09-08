#!/usr/bin/env node
// Run serially with other GPU/browser checks. Only supported Studio APIs mutate the app.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://localhost:3014';
const executable = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const outputDirectory = process.env.GLYPHFIELD_SHADER_JOURNEY_OUTPUT ?? mkdtempSync(join(tmpdir(), 'glyphfield-frame-journey-'));
const sessions = ['author', 'import', 'clipboard'].map((name) => `glyphfield-frame-${name}-${process.pid}`);
const menuInput = process.env.GLYPHFIELD_SHADER_JOURNEY_MENU_INPUT ?? 'pointer';
const report = { baseUrl, outputDirectory, menuInput, checks: [], failures: [] };
let session = sessions[0];

function browser(args, input) {
  let output;
  try {
    output = execFileSync(executable, ['--session', session, '--json', ...args], {
      encoding: 'utf8', input, timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(`${args.join(' ').slice(0, 700)}: ${String(error.stderr || error.stdout || error.message).slice(0, 3000)}`);
  }
  const result = JSON.parse(output);
  const entries = Array.isArray(result) ? result : [result];
  const failed = entries.find((entry) => !entry.success);
  if (failed) throw new Error(JSON.stringify(failed.error ?? failed));
  return Array.isArray(result) ? result : result.data?.result ?? result.data;
}

function evaluate(operation, ...args) {
  return browser(['eval', '--stdin'], `(${operation.toString()})(...${JSON.stringify(args)})`);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
  report.checks.push(message);
  console.log(`PASS ${message}`);
}

function openStudio(clipboard = false) {
  if (clipboard) {
    // Grant only this origin's clipboard permission through Chrome's real UI.
    // The isolated test profile disappears on close; no user profile is edited.
    browser(['open', `chrome://settings/content/siteDetails?site=${encodeURIComponent(new URL(baseUrl).origin)}`]);
    let control;
    for (let attempt = 0; attempt < 20 && !control; attempt += 1) {
      const snapshot = browser(['snapshot', '-i']);
      control = Object.entries(snapshot.refs ?? {}).find(([, item]) => item.role === 'combobox' && item.name === 'Clipboard');
      if (!control) browser(['wait', '250']);
    }
    if (!control) throw new Error('Chrome site settings did not expose the Clipboard permission control.');
    browser(['select', `@${control[0]}`, 'allow']);
  }
  browser(['batch', '--bail', 'set viewport 1440 1000 1', `open ${baseUrl}/studio?tool=material`]);
  browser(['wait', '--fn', `(() => { try {
    return window.glyphfield?.studio.activeTool() === 'material' && Boolean(window.glyphfield.studio.readSource());
  } catch { return false; } })()`]);
  return evaluate(() => ({ descriptor: window.glyphfield.studio.describe(), controls: window.glyphfield.studio.controls(),
    dpr: devicePixelRatio, width: innerWidth, height: innerHeight, visibility: document.visibilityState }));
}

// Functions below execute inside the page. Local canvas reads are diagnostics,
// never writes to React, localStorage, IndexedDB, or the application's canvases.
async function configureComposition() {
  const studio = window.glyphfield.studio;
  const source = JSON.parse(studio.readSource());
  const shader = Object.values(source.elements).find((element) => element.kind === 'shader');
  const logo = Object.values(source.elements).find((element) => element.kind === 'logo');
  if (!shader || !logo) throw new Error('The fresh Design Lab must expose its shader and brand mark.');
  shader.data.materialId = 'holo-cloth-silk';
  delete shader.data.frameState;
  delete shader.data.frameSnapshot;
  logo.bounds = { ...logo.bounds, x: 137, y: -83, width: 0.62, height: 0.62 };
  logo.data.transform = { ...logo.data.transform, x: 137, y: -83, scale: 0.62 };
  for (const element of Object.values(source.elements)) element.hidden = element.id !== shader.id && element.id !== logo.id;
  source.metadata.designLab.timeline = { ...source.metadata.designLab.timeline, paused: false, timeMs: 0 };
  await studio.applySource(source);
  return { shaderId: shader.id, logoId: logo.id, materialId: shader.data.materialId };
}

async function captureNativeFrame(shaderId) {
  const studio = window.glyphfield.studio;
  const host = document.querySelector(`[data-shader-instance="canvas-${CSS.escape(shaderId)}"]`);
  const native = host?.querySelector('canvas');
  if (!native?.width || !native.height) throw new Error('The authentic native shader canvas is unavailable.');
  const scratch = document.createElement('canvas');
  scratch.width = native.width;
  scratch.height = native.height;
  const context = scratch.getContext('2d', { willReadFrequently: true });
  context.drawImage(native, 0, 0);
  const before = context.getImageData(0, 0, scratch.width, scratch.height).data;
  // No await between the native read and action: capture freezes this same draw.
  const source = await studio.invoke('design.frame.capture');
  const documentSource = JSON.parse(source);
  const snapshot = documentSource.elements[shaderId].data.frameSnapshot;
  const asset = documentSource.assets[snapshot?.assetId];
  if (!asset?.source.startsWith('data:image/png;base64,')) throw new Error('Capture did not embed lossless PNG bytes.');
  const image = new Image();
  image.src = asset.source;
  await image.decode();
  if (image.naturalWidth !== scratch.width || image.naturalHeight !== scratch.height) throw new Error('Captured PNG dimensions changed.');
  context.clearRect(0, 0, scratch.width, scratch.height);
  context.drawImage(image, 0, 0);
  const after = context.getImageData(0, 0, scratch.width, scratch.height).data;
  let changedBytes = 0;
  for (let index = 0; index < before.length; index += 1) if (before[index] !== after[index]) changedBytes += 1;
  return { source, changedBytes, width: scratch.width, height: scratch.height, assetId: snapshot.assetId };
}

async function verifyFrozenSource(expected, shaderId, logoId) {
  const source = JSON.parse(window.glyphfield.studio.readSource());
  const expectedSource = JSON.parse(expected);
  const snapshot = source.elements[shaderId]?.data.frameSnapshot;
  const previousSnapshot = expectedSource.elements[shaderId].data.frameSnapshot;
  const asset = source.assets[snapshot?.assetId];
  const frozen = document.querySelector(`[data-shader-instance="canvas-${CSS.escape(shaderId)}"] [data-shader-frame-image]`);
  if (!frozen?.complete || !frozen.naturalWidth || frozen.closest('[data-shader-frame-ready]')?.dataset.shaderFrameReady !== 'true') {
    throw new Error('The saved image has not finished decoding.');
  }
  const embedded = new Image();
  embedded.src = asset.source;
  await embedded.decode();
  const canvas = document.createElement('canvas');
  canvas.width = embedded.naturalWidth;
  canvas.height = embedded.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(embedded, 0, 0);
  const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(frozen, 0, 0);
  const displayedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let changedBytes = 0;
  for (let index = 0; index < expectedPixels.length; index += 1) if (expectedPixels[index] !== displayedPixels[index]) changedBytes += 1;
  return {
    changedBytes, assetId: snapshot.assetId, sameAsset: snapshot.assetId === previousSnapshot.assetId,
    sameBytes: asset.source === expectedSource.assets[previousSnapshot.assetId].source,
    sameLogoTransform: JSON.stringify(source.elements[logoId].bounds) === JSON.stringify(expectedSource.elements[logoId].bounds),
    paused: source.metadata.designLab.timeline.paused,
  };
}

function waitForFrozen(shaderId) {
  const selector = `[data-shader-instance="canvas-${shaderId}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`;
  browser(['wait', '--fn', `Boolean(document.querySelector(${JSON.stringify(selector)})?.naturalWidth)`]);
}

async function duplicateAndHistory(assetId, logoId) {
  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const read = () => JSON.parse(window.glyphfield.studio.readSource());
  const waitFor = async (predicate, label) => {
    const deadline = performance.now() + 12_000;
    while (performance.now() < deadline) {
      try { if (predicate(read())) { await pause(350); return read(); } } catch { /* Assets may still be embedding. */ }
      await pause(50);
    }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const activate = (label) => {
    if (!window.glyphfield.studio.controls().some((control) => control.label === label)) throw new Error(`Missing public control: ${label}`);
    window.glyphfield.studio.activate(label);
  };
  const shaders = (source) => Object.values(source.elements).filter((element) => element.kind === 'shader');
  const artboards = (source) => source.metadata.designLab.workspace.artboards;
  // The public history coalesces edits for 220ms. Start a distinct duplicate action.
  await pause(350);
  const before = read();
  const shader = shaders(before).find((element) => element.data.frameSnapshot?.assetId === assetId);
  activate(`Duplicate ${shader.name}`);
  const duplicated = await waitFor((source) => shaders(source).length === shaders(before).length + 1, 'layer duplicate');
  const duplicateAssets = shaders(duplicated).map((element) => element.data.frameSnapshot?.assetId);
  activate('Action history');
  await pause(100);
  activate('Undo');
  const layerUndo = await waitFor((source) => shaders(source).length === shaders(before).length, 'layer undo');
  activate('Redo');
  const layerRedo = await waitFor((source) => shaders(source).length === shaders(duplicated).length, 'layer redo');
  activate('Duplicate active artboard');
  const copied = await waitFor((source) => artboards(source).length === artboards(before).length + 1, 'artboard duplicate');
  const copiedAssets = artboards(copied).flatMap((artboard) => artboard.snapshot.shaderLayers.map((layer) => layer.frameSnapshot?.assetId));
  activate('Undo');
  const artboardUndo = await waitFor((source) => artboards(source).length === artboards(before).length, 'artboard undo');
  activate('Redo');
  const redone = await waitFor((source) => artboards(source).length === artboards(copied).length, 'artboard redo');
  const active = artboards(redone).find((artboard) => artboard.id === redone.metadata.designLab.workspace.activeArtboardId);
  const logo = active.snapshot.logos.find((layer) => layer.id === logoId) ?? active.snapshot.logos[0];
  const historyAssets = [layerUndo, layerRedo, artboardUndo, redone].flatMap((source) => shaders(source).map((element) => element.data.frameSnapshot?.assetId));
  return { duplicateAssets, copiedAssets, historyAssets, artboardCount: artboards(redone).length, logoTransform: logo.transform };
}

async function exportFrozenStill(shaderId, logoId) {
  const studio = window.glyphfield.studio;
  const source = JSON.parse(studio.readSource());
  const page = Object.values(source.pages)[0];
  const shader = source.elements[shaderId];
  const logo = source.elements[logoId];
  if (!source.metadata.designLab.timeline.paused) throw new Error('Still fixture must be frozen.');
  if (!studio.describe().actions.includes('design.export')) throw new Error('Public still export is unavailable.');
  const artifact = await studio.invoke('design.export', { format: 'png', download: false });
  if (!(artifact?.blob instanceof Blob) || !artifact.blob.size || artifact.blob.type !== 'image/png' || !artifact.fileName.endsWith('.png')) {
    throw new Error('Still export did not return a nonempty PNG artifact.');
  }
  const image = await createImageBitmap(artifact.blob);
  const width = source.metadata.designLab.exportSettings.width;
  const height = Math.round(width * page.height / page.width);
  if (image.width !== width || image.height !== height) throw new Error('Decoded export dimensions differ from source settings.');
  const native = new Image();
  native.src = source.assets[shader.data.frameSnapshot.assetId].source;
  await native.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Export uses the default accelerated 2D resize path. willReadFrequently
  // forces CPU bilinear rounding, which differs even for identical input PNGs.
  const context = canvas.getContext('2d');
  context.fillStyle = page.background;
  context.fillRect(0, 0, width, height);
  context.drawImage(native, 0, 0, width, height);
  const background = context.getImageData(0, 0, width, height).data;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  // The public Design Lab logo geometry is 42% × 32% of the artboard, centered
  // before its authored transform. Compare the entire non-logo composition.
  const centerX = (page.width / 2 + logo.bounds.x) * width / page.width;
  const centerY = (page.height / 2 + logo.bounds.y) * height / page.height;
  const halfWidth = width * 0.42 * logo.bounds.width / 2 + 2;
  const halfHeight = height * 0.32 * logo.bounds.height / 2 + 2;
  let outsideChanged = 0;
  let logoPixels = 0;
  let opaquePixels = 0;
  const logoBox = { left: width, top: height, right: -1, bottom: -1 };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    if (pixels[index + 3] === 255) opaquePixels += 1;
    const changed = [0, 1, 2, 3].some((channel) => pixels[index + channel] !== background[index + channel]);
    if (!changed) continue;
    if (Math.abs(x - centerX) > halfWidth || Math.abs(y - centerY) > halfHeight) outsideChanged += 1;
    if (pixels[index] > 250 && pixels[index + 1] > 250 && pixels[index + 2] > 250) {
      logoPixels += 1;
      logoBox.left = Math.min(logoBox.left, x);
      logoBox.top = Math.min(logoBox.top, y);
      logoBox.right = Math.max(logoBox.right, x);
      logoBox.bottom = Math.max(logoBox.bottom, y);
    }
  }
  image.close();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(artifact.blob);
  });
  const after = JSON.parse(studio.readSource());
  return { width, height, size: artifact.blob.size, fileName: artifact.fileName, dataUrl,
    outsideChanged, logoPixels, opaquePixels, logoBox, centerX, centerY,
    samePose: after.elements[shaderId].data.frameSnapshot.assetId === shader.data.frameSnapshot.assetId,
  };
}

function canvasMenuAction(layerId, action) {
  const selector = evaluate((id) => {
    const element = JSON.parse(window.glyphfield.studio.readSource()).elements[id];
    const candidate = Array.from(document.querySelectorAll('.editable-canvas-layer[aria-keyshortcuts]'))
      .find((layer) => layer.getAttribute('aria-label') === element.name);
    if (!candidate) throw new Error(`No keyboard-accessible canvas layer for ${element.name}.`);
    return `.editable-canvas-layer[aria-keyshortcuts][aria-label=${JSON.stringify(candidate.getAttribute('aria-label'))}]`;
  }, layerId);
  browser(['batch', '--bail', `focus ${JSON.stringify(selector)}`, 'press Shift+F10']);
  const menu = browser(['snapshot', '-i']);
  report.menus ??= [];
  report.menus.push({ layerId, action, items: Object.values(menu.refs ?? {}).filter((item) => item.role === 'menuitem').map((item) => item.name) });
  const control = Object.entries(menu.refs ?? {}).find(([, item]) => item.role === 'menuitem'
    && (item.name === action || item.name.startsWith(`${action} `) || item.name.startsWith(`${action}⌘`)));
  if (!control) throw new Error(`The canvas context menu does not expose ${action}.`);
  if (menuInput === 'keyboard') browser(['batch', '--bail', `focus @${control[0]}`, 'press Enter']);
  else browser(['click', `@${control[0]}`]);
}

async function verifyClipboardPaste(expected, previousIds) {
  const before = JSON.parse(expected);
  const deadline = performance.now() + 12_000;
  let source;
  let pasted = [];
  do {
    try {
      source = JSON.parse(window.glyphfield.studio.readSource());
      pasted = Object.values(source.elements).filter((element) => !previousIds.includes(element.id));
      if (pasted.some((element) => element.kind === 'shader') && pasted.some((element) => element.kind === 'logo')) break;
    } catch { /* Public source waits for portable asset preparation after paste. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (performance.now() < deadline);
  const shader = pasted.find((element) => element.kind === 'shader');
  const logo = pasted.find((element) => element.kind === 'logo');
  const oldShader = Object.values(before.elements).find((element) => element.kind === 'shader');
  const oldLogo = Object.values(before.elements).find((element) => element.kind === 'logo');
  if (!shader || !logo) throw new Error('Context-menu Paste did not add the copied shader and mark.');
  const assetId = shader.data.frameSnapshot?.assetId;
  const transformed = (current, original) => current.bounds.x === original.bounds.x + 32
    && current.bounds.y === original.bounds.y + 32 && current.bounds.width === original.bounds.width
    && current.bounds.height === original.bounds.height;
  return { shaderId: shader.id, logoId: logo.id, assetId, source: JSON.stringify(source),
    sameBytes: source.assets[assetId]?.source === before.assets[oldShader.data.frameSnapshot.assetId].source,
    positioned: transformed(shader, oldShader) && transformed(logo, oldLogo),
    sameNativeFrame: shader.data.frameState.frame === oldShader.data.frameState.frame,
    paused: source.metadata.designLab.timeline.paused,
  };
}

async function readBayerFrame(shaderId) {
  const selector = '[data-testid="shader-lab-live-stage"] canvas.shader-lab-v2-composition-effect[data-effect-kind="bayer"]';
  const rendered = document.querySelector(selector);
  if (!rendered?.width || !rendered.height) throw new Error('The Bayer converter preview is unavailable.');
  const canvas = document.createElement('canvas');
  canvas.width = rendered.width;
  canvas.height = rendered.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(rendered, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const digest = await crypto.subtle.digest('SHA-256', pixels);
  const source = JSON.parse(window.glyphfield.studio.readSource());
  const assetId = source.elements[shaderId].data.frameSnapshot.assetId;
  const native = new Image();
  native.src = source.assets[assetId].source;
  await native.decode();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(native, 0, 0, canvas.width, canvas.height);
  const raw = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let changedFromNative = 0;
  const colors = new Set();
  for (let index = 0; index < pixels.length; index += 4) {
    colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
    if (pixels[index] !== raw[index] || pixels[index + 1] !== raw[index + 1] || pixels[index + 2] !== raw[index + 2]) changedFromNative += 1;
  }
  return { width: canvas.width, height: canvas.height, assetId, colorCount: colors.size, changedFromNative,
    hash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    source: JSON.stringify(source),
  };
}

async function verifySequenceCaptureGuard(shaderId) {
  const studio = window.glyphfield.studio;
  const before = JSON.parse(studio.readSource());
  let rejection = '';
  await studio.invoke('design.sequence.preview');
  try {
    await studio.invoke('design.frame.capture');
  } catch (error) {
    rejection = error.message;
  } finally {
    // No callback/frame wait: public sequence stop must observe the start even
    // before React commits its rendered sequencePreviewing value.
    await studio.invoke('design.sequence.stop');
  }
  const after = JSON.parse(await studio.invoke('design.frame.capture'));
  const assetId = before.elements[shaderId].data.frameSnapshot.assetId;
  return { rejection, unchanged: after.elements[shaderId].data.frameSnapshot.assetId === assetId
    && after.assets[assetId].source === before.assets[assetId].source };
}

async function duplicateCapturedBayer(previewHash) {
  const studio = window.glyphfield.studio;
  const captured = JSON.parse(await studio.invoke('design.frame.capture'));
  const effect = Object.values(captured.elements).find((element) => element.kind === 'effect' && element.data.settings.kind === 'bayer');
  const frame = effect?.data.frameSnapshot;
  const asset = captured.assets[frame?.assetId];
  if (!frame?.effectCompositionKey || !asset?.source.startsWith('data:image/png;base64,') || effect.data.frameState) {
    throw new Error('Bayer capture must embed a keyed converter PNG without a native frameState.');
  }
  const before = captured.metadata.designLab.workspace;
  const sourceArtboard = before.artboards.find((artboard) => artboard.id === before.activeArtboardId);
  studio.activate('Duplicate active artboard');
  const selector = '.design-artboard-shell[data-active="false"] .shader-lab-v2-composition-effect[data-effect-kind="bayer"] [data-shader-frame-image]';
  const deadline = performance.now() + 12_000;
  let image;
  let source;
  do {
    try {
      source = JSON.parse(studio.readSource());
      image = document.querySelector(selector);
      if (source.metadata.designLab.workspace.artboards.length === before.artboards.length + 1 && image?.complete && image.naturalWidth) break;
    } catch { /* The duplicate's source may still be embedding its images. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (performance.now() < deadline);
  if (!image?.complete || !image.naturalWidth) throw new Error('Inactive artboard did not display its captured Bayer PNG.');
  const expected = new Image();
  expected.src = asset.source;
  await expected.decode();
  if (image.naturalWidth !== expected.naturalWidth || image.naturalHeight !== expected.naturalHeight) throw new Error('Inactive Bayer PNG dimensions changed.');
  const canvas = document.createElement('canvas');
  canvas.width = expected.naturalWidth;
  canvas.height = expected.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(expected, 0, 0);
  const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const digest = await crypto.subtle.digest('SHA-256', expectedPixels);
  const captureHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const actual = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let changedBytes = 0;
  for (let index = 0; index < actual.length; index += 1) if (actual[index] !== expectedPixels[index]) changedBytes += 1;
  const layout = (snapshot) => JSON.stringify(snapshot.layerOrder.map((id) => {
    const kind = ['shaderLayers', 'logos', 'assets', 'effectLayers', 'textLayers'].find((collection) => snapshot[collection].some((layer) => layer.id === id));
    const layer = snapshot[kind].find((candidate) => candidate.id === id);
    return { kind, transform: layer.transform, visible: layer.visible, materialId: layer.materialId, settings: layer.settings };
  }));
  const artboards = source.metadata.designLab.workspace.artboards;
  return { assetId: frame.assetId, width: canvas.width, height: canvas.height, changedBytes, captureMatchesPreview: captureHash === previewHash,
    source: JSON.stringify(captured),
    sameAssets: artboards.every((artboard) => artboard.snapshot.effectLayers.find((layer) => layer.settings.kind === 'bayer')?.frameSnapshot?.assetId === frame.assetId),
    sameLayout: artboards.every((artboard) => layout(artboard.snapshot) === layout(sourceArtboard.snapshot)),
  };
}

try {
  const environment = openStudio();
  check(environment.dpr === 1 && environment.width === 1440 && environment.height === 1000, 'Controlled 1440×1000 DPR1 viewport');
  check(environment.visibility === 'visible', 'Foreground page for native frame capture');
  check(environment.descriptor.actions.includes('design.frame.capture'), 'Public frame capture action discovered');
  const fixture = evaluate(configureComposition);
  browser(['wait', '--fn', `(() => { const host = document.querySelector('[data-shader-instance="canvas-${fixture.shaderId}"]');
    return Boolean(host?.querySelector('canvas')) && !host.querySelector('[data-live-material-ready="false"], [data-live-material-ready="error"]'); })()`]);
  browser(['wait', '400']);
  const capture = evaluate(captureNativeFrame, fixture.shaderId);
  check(capture.changedBytes === 0, 'Captured PNG exactly matches the preceding native RGBA buffer');
  report.capture = { ...capture, source: undefined };
  writeFileSync(join(outputDirectory, 'captured.canvas.json'), capture.source);
  waitForFrozen(fixture.shaderId);
  browser(['wait', '--fn', 'window.glyphfield.studio.controls().some(control => control.label === "Save design")']);
  evaluate(() => window.glyphfield.studio.activate('Save design'));
  browser(['wait', '--fn', 'Array.from(document.querySelectorAll("button")).some(button => button.getAttribute("aria-label") === "Design saved")']);
  check(true, 'Named Save completes after exact PNG capture');
  evaluate(async (logoId) => {
    const studio = window.glyphfield.studio;
    const edited = JSON.parse(studio.readSource());
    edited.elements[logoId].bounds.x = 0;
    edited.elements[logoId].bounds.y = 0;
    await studio.applySource(edited);
    studio.activate('Open saved designs');
  }, fixture.logoId);
  browser(['wait', '--fn', `(() => { try { return JSON.parse(window.glyphfield.studio.readSource()).elements[${JSON.stringify(fixture.logoId)}].bounds.x === 0; } catch { return false; } })()`]);
  browser(['wait', '--fn', 'window.glyphfield.studio.controls().some(control => control.label.startsWith("Untitled design") && control.label.includes("saved ·"))']);
  evaluate(() => {
    const studio = window.glyphfield.studio;
    const saved = studio.controls().find((control) => control.label.startsWith('Untitled design') && control.label.includes('saved ·'));
    studio.activate(saved.label);
  });
  waitForFrozen(fixture.shaderId);
  browser(['wait', '--fn', `(() => { try { return JSON.parse(window.glyphfield.studio.readSource()).elements[${JSON.stringify(fixture.logoId)}].bounds.x === 137; } catch { return false; } })()`]);
  const named = evaluate(verifyFrozenSource, capture.source, fixture.shaderId, fixture.logoId);
  check(named.sameAsset && named.sameBytes && named.sameLogoTransform && named.changedBytes === 0,
    'Opening the named checkpoint restores exact pixels and the edited-away logo position');
  browser(['reload']);
  browser(['wait', '--fn', 'Boolean(window.glyphfield?.studio?.describe().source.read)']);
  waitForFrozen(fixture.shaderId);
  const reopened = evaluate(verifyFrozenSource, capture.source, fixture.shaderId, fixture.logoId);
  check(reopened.sameAsset && reopened.sameBytes && reopened.sameLogoTransform && reopened.paused && reopened.changedBytes === 0,
    'Reload preserves saved PNG bytes, paused state, and off-center logo transform');
  browser(['close']);

  session = sessions[1];
  openStudio(true);
  evaluate(async (source) => window.glyphfield.studio.applySource(source), capture.source);
  waitForFrozen(fixture.shaderId);
  const imported = evaluate(verifyFrozenSource, capture.source, fixture.shaderId, fixture.logoId);
  check(imported.sameAsset && imported.sameBytes && imported.sameLogoTransform && imported.paused && imported.changedBytes === 0,
    'Fresh-session portable import reproduces exact frozen pixels and logo placement');
  const sequence = evaluate(verifySequenceCaptureGuard, fixture.shaderId);
  check(sequence.rejection.includes('Stop the shader sequence preview') && sequence.unchanged,
    'Sequence preview rejects capture; immediate stop permits capture without replacing the saved PNG');
  report.sequence = sequence;
  waitForFrozen(fixture.shaderId);
  const still = evaluate(exportFrozenStill, fixture.shaderId, fixture.logoId);
  report.still = { ...still, dataUrl: undefined };
  writeFileSync(join(outputDirectory, 'frozen-composition.png'), Buffer.from(still.dataUrl.split(',')[1], 'base64'));
  check(still.width > 0 && still.height > 0 && still.size > 0 && still.opaquePixels === still.width * still.height,
    'Still export decodes to a nonempty opaque PNG at the authored output dimensions');
  check(still.outsideChanged === 0 && still.samePose && still.logoPixels > 100
    && Math.abs((still.logoBox.left + still.logoBox.right) / 2 - still.centerX) < 2
    && Math.abs((still.logoBox.top + still.logoBox.bottom) / 2 - still.centerY) < 2,
  'Still PNG preserves the exact frozen background and visibly composites the off-center logo');
  browser(['press', 'Escape']);
  browser(['wait', '--fn', '!Array.from(document.querySelectorAll("button")).some(button => button.getAttribute("aria-label") === "Close export preview")']);
  const history = evaluate(duplicateAndHistory, capture.assetId, fixture.logoId);
  check(history.duplicateAssets.every((id) => id === capture.assetId), 'Layer duplicate and undo/redo retain the captured asset');
  check(history.copiedAssets.every((id) => id === capture.assetId), 'Artboard duplicate and undo/redo retain the captured asset');
  check(history.historyAssets.every((id) => id === capture.assetId), 'Every intermediate undo/redo state retains the exact PNG reference');
  check(history.logoTransform.x === 137 && history.logoTransform.y === -83 && history.logoTransform.scale === 0.62,
    'Artboard duplication preserves the positioned logo');
  report.history = history;
  evaluate(() => window.glyphfield.studio.activate('Action history'));
  browser(['screenshot', join(outputDirectory, 'shader-frame-journey.png')]);

  evaluate(async (source, shaderId, logoId) => {
    const grouped = JSON.parse(source);
    grouped.metadata.designLab.groups = [{ id: 'group-frame-journey', name: 'Captured frame and mark', layerIds: [shaderId, logoId] }];
    await window.glyphfield.studio.applySource(grouped);
  }, capture.source, fixture.shaderId, fixture.logoId);
  waitForFrozen(fixture.shaderId);
  evaluate(() => window.glyphfield.studio.activate('Fit canvas'));
  browser(['wait', '350']);
  browser(['clipboard', 'read']);
  canvasMenuAction(fixture.shaderId, 'Copy');
  browser(['wait', '--fn', 'Array.from(document.querySelectorAll("[aria-live]")).some(node => node.textContent.startsWith("Copied 2 layers"))']);
  const clipboardSource = evaluate(() => navigator.clipboard.readText());
  const clipboard = JSON.parse(clipboardSource);
  check(clipboard.kind === 'layers' && clipboard.layerIds.length === 2
    && clipboard.frameAssets.some((asset) => asset.id === capture.assetId && asset.source === JSON.parse(capture.source).assets[capture.assetId].source),
  'Context-menu Copy embeds the exact captured PNG and both selected layers');
  writeFileSync(join(outputDirectory, 'captured.clipboard.json'), clipboardSource);
  const currentIds = evaluate(() => Object.keys(JSON.parse(window.glyphfield.studio.readSource()).elements));
  canvasMenuAction(fixture.shaderId, 'Paste');
  const pasted = evaluate(verifyClipboardPaste, capture.source, currentIds);
  report.clipboard = { sameDocument: { ...pasted, source: undefined } };
  waitForFrozen(pasted.shaderId);
  const pastedPixels = evaluate(verifyFrozenSource, pasted.source, pasted.shaderId, pasted.logoId);
  check(pasted.assetId === capture.assetId && pasted.sameBytes && pasted.positioned && pasted.sameNativeFrame
    && pasted.paused && pastedPixels.changedBytes === 0,
  'Same-document context-menu Paste preserves decoded PNG pixels and offsets both transforms by 32');
  browser(['close']);

  session = sessions[2];
  openStudio(true);
  const fresh = evaluate(async () => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const logo = Object.values(source.elements).find((element) => element.kind === 'logo');
    const hasFrames = Object.keys(source.assets).some((id) => id.startsWith('shader-frame:'));
    source.elements = { [logo.id]: logo };
    for (const page of Object.values(source.pages)) page.elementIds = [logo.id];
    source.metadata.designLab.timeline.paused = true;
    source.metadata.designLab.groups = [];
    source.metadata.designLab.layerShaders = {};
    delete source.metadata.designLab.shaderSequence.targetLayerId;
    await studio.applySource(source);
    return { logoId: logo.id, hasFrames };
  });
  check(!fresh.hasFrames, 'Clipboard destination starts in a fresh session without captured frame assets');
  browser(['clipboard', 'read']);
  evaluate(async (source) => navigator.clipboard.writeText(source), clipboardSource);
  const freshIds = evaluate(() => Object.keys(JSON.parse(window.glyphfield.studio.readSource()).elements));
  canvasMenuAction(fresh.logoId, 'Paste');
  const freshPaste = evaluate(verifyClipboardPaste, capture.source, freshIds);
  report.clipboard.freshSession = { ...freshPaste, source: undefined };
  waitForFrozen(freshPaste.shaderId);
  const freshPixels = evaluate(verifyFrozenSource, freshPaste.source, freshPaste.shaderId, freshPaste.logoId);
  check(freshPaste.assetId === capture.assetId && freshPaste.sameBytes && freshPaste.positioned && freshPaste.sameNativeFrame
    && freshPaste.paused && freshPixels.changedBytes === 0,
  'Fresh-session context-menu Paste hydrates embedded PNG bytes and retains positioned layer geometry');
  browser(['screenshot', join(outputDirectory, 'shader-frame-clipboard.png')]);
  evaluate(() => window.glyphfield.studio.activate('Add effect layer'));
  browser(['wait', '--fn', `Boolean(document.querySelector('[data-testid="shader-lab-live-stage"] canvas.shader-lab-v2-composition-effect[data-effect-kind="bayer"]')?.width)`]);
  browser(['wait', '350']);
  const bayer = evaluate(readBayerFrame, freshPaste.shaderId);
  report.bayer = { before: { ...bayer, source: undefined } };
  check(bayer.colorCount > 1 && bayer.changedFromNative > bayer.width * bayer.height / 2,
    'Bayer converter visibly transforms the captured PNG composition');
  writeFileSync(join(outputDirectory, 'captured-bayer.canvas.json'), bayer.source);
  evaluate(() => window.glyphfield.studio.activate('Save design'));
  browser(['wait', '--fn', 'Array.from(document.querySelectorAll("button")).some(button => button.getAttribute("aria-label") === "Design saved")']);
  browser(['reload']);
  browser(['wait', '--fn', 'Boolean(window.glyphfield?.studio?.describe().source.read)']);
  waitForFrozen(freshPaste.shaderId);
  browser(['wait', '--fn', `Boolean(document.querySelector('[data-testid="shader-lab-live-stage"] canvas.shader-lab-v2-composition-effect[data-effect-kind="bayer"]')?.width)`]);
  browser(['wait', '350']);
  const reopenedBayer = evaluate(readBayerFrame, freshPaste.shaderId);
  report.bayer.reopened = { ...reopenedBayer, source: undefined };
  check(reopenedBayer.assetId === bayer.assetId && reopenedBayer.width === bayer.width && reopenedBayer.height === bayer.height
    && reopenedBayer.hash === bayer.hash,
  'Paused Bayer composition repaints identical pixels after saved PNG decode on reload');
  browser(['screenshot', join(outputDirectory, 'shader-frame-bayer-reopened.png')]);
  const inactiveBayer = evaluate(duplicateCapturedBayer, reopenedBayer.hash);
  report.bayer.inactive = { ...inactiveBayer, source: undefined };
  writeFileSync(join(outputDirectory, 'captured-bayer.canvas.json'), inactiveBayer.source);
  check(inactiveBayer.changedBytes === 0 && inactiveBayer.sameAssets && inactiveBayer.captureMatchesPreview,
    'Inactive duplicated artboard displays the exact embedded Bayer converter PNG');
  check(inactiveBayer.sameLayout, 'Converter artboard duplicate retains every internal transform and layer ordering');
  browser(['screenshot', join(outputDirectory, 'shader-frame-bayer-artboards.png')]);
} catch (error) {
  report.failures.push(String(error.stderr || error.stdout || error.message).slice(0, 4000));
  try {
    report.failureState = evaluate(() => {
      const source = JSON.parse(window.glyphfield.studio.readSource());
      return { controls: window.glyphfield.studio.controls(),
        elements: Object.values(source.elements).map(({ id, kind, name, bounds, data }) => ({ id, kind, name, bounds, frameSnapshot: data.frameSnapshot })),
        announcements: Array.from(document.querySelectorAll('[aria-live]')).map((node) => node.textContent),
        buttons: Array.from(document.querySelectorAll('button')).map((button) => ({
          label: button.getAttribute('aria-label'), title: button.title, text: button.textContent?.trim(), disabled: button.disabled,
        })).filter((button) => /sav|design/i.test(`${button.label} ${button.title} ${button.text}`)),
      };
    });
  } catch { /* Startup failures may not have an adapter. */ }
  try { browser(['screenshot', join(outputDirectory, 'shader-frame-journey-failure.png')]); } catch { /* Preserve the original failure. */ }
} finally {
  for (const owned of sessions) {
    session = owned;
    try { browser(['close']); } catch { /* Only close the script's isolated sessions. */ }
  }
}

writeFileSync(join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
console.log(`${report.checks.length} journey checks passed; ${report.failures.length} failures. Evidence: ${outputDirectory}`);
report.failures.forEach((failure) => console.error(failure));
process.exitCode = report.failures.length ? 1 : 0;
