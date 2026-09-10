import assert from 'node:assert/strict';
import { nativePointerClick } from './safari-native-click.mjs';

const liveStage = '[data-testid="shader-lab-live-stage"]';
const viewportStage = '.canvas-viewport-stage.design-artboard-viewport-stage';

async function nativeDrag(harness, selector, fraction, delta) {
  const { evaluate, rect, actions, mouse, pointerMove, pointerDown, pointerUp } = harness;
  const box = await rect(selector);
  const point = { x: box.x + box.width * fraction.x, y: box.y + box.height * fraction.y };
  const key = 'glyphfield-safari-artboard-drag';
  await evaluate((selector, point, key) => {
    const target = document.querySelector(selector);
    if (!target?.contains(document.elementFromPoint(point.x, point.y))) throw new Error(`Obscured native drag target ${selector}`);
    const events = [];
    const record = (event) => events.push({ type: event.type, trusted: event.isTrusted, withinTarget: target.contains(event.target) });
    ['pointerdown', 'pointerup'].forEach((type) => document.addEventListener(type, record, true));
    document[Symbol.for(key)] = { events, cleanup: () => ['pointerdown', 'pointerup'].forEach((type) => document.removeEventListener(type, record, true)) };
  }, selector, point, key);
  let events;
  try {
    await actions(mouse([pointerMove(point.x, point.y), pointerDown,
      ...Array.from({ length: 12 }, (_, index) => pointerMove(point.x + delta.x * (index + 1) / 12, point.y + delta.y * (index + 1) / 12, 16)), pointerUp]));
  } finally {
    events = await evaluate((key) => {
      const probe = document[Symbol.for(key)];
      probe.cleanup();
      delete document[Symbol.for(key)];
      return probe.events;
    }, key);
  }
  assert(events.some((event) => event.type === 'pointerdown' && event.trusted && event.withinTarget), `Missing trusted drag start: ${JSON.stringify(events)}`);
  assert(events.some((event) => event.type === 'pointerup' && event.trusted), `Missing trusted drag release: ${JSON.stringify(events)}`);
  return events;
}

async function checkNavigation(harness) {
  const { evaluate, waitFor, click, rect } = harness;
  const read = () => evaluate(() => JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace);
  const view = () => evaluate((selector) => document.querySelector(selector).style.transform, viewportStage);
  const original = await read();
  await click('.design-lab-artboard-bar button[aria-label="Add blank artboard"]');
  await waitFor(() => document.querySelectorAll('.design-artboard-shell').length === 2, 'second artboard');
  await click('button[aria-label="Fit canvas"]');
  const before = await read();
  const initialView = await view();
  const boardSelector = `.design-artboard-shell[data-artboard-id="${original.activeArtboardId}"]`;
  const boardInput = await nativeDrag(harness, boardSelector, { x: 0.2, y: 0.2 }, { x: 48, y: 28 });
  await waitFor((id, x) => {
    const workspace = JSON.parse(window.glyphfield.studio.readSource()).metadata.designLab.workspace;
    return workspace.activeArtboardId === id && workspace.artboards.find((board) => board.id === id).x > x + 20;
  }, 'inactive surface drag and selection', original.activeArtboardId, before.artboards[0].x);
  const moved = await read();
  assert.equal(await view(), initialView, 'Selecting and dragging an inactive artboard reframed the canvas');
  assert.deepEqual(moved.artboards[0].snapshot.textLayers, before.artboards[0].snapshot.textLayers, 'Artboard drag moved its content');
  const mapSelector = '[aria-label="Navigate canvas map"]';
  const map = await rect(mapSelector);
  // Clicking the current viewport grabs it without a jump; use the padded
  // background for the separate click-to-center contract.
  const mapPoint = { x: map.x + 8, y: map.y + 8 };
  assert(await evaluate((point) => !document.elementFromPoint(point.x, point.y)?.matches('[data-canvas-map-viewport]'), mapPoint),
    'Native map click fixture must hit outside the current viewport rectangle');
  await nativePointerClick(harness, mapPoint, mapSelector);
  const clickedView = await view();
  assert.notEqual(clickedView, initialView, 'Native minimap click did not pan');
  const mapInput = await nativeDrag(harness, mapSelector, { x: 0.5, y: 0.5 }, { x: 22, y: 12 });
  assert.notEqual(await view(), clickedView, 'Native minimap drag did not pan');
  assert.deepEqual((await read()).artboards.map(({ id, x, y }) => ({ id, x, y })), moved.artboards.map(({ id, x, y }) => ({ id, x, y })), 'Minimap navigation changed authored board coordinates');
  await click('button[aria-label="Center selected artboard"]');
  return { boardInput, mapInput, positions: moved.artboards.map(({ id, x, y }) => ({ id, x, y })) };
}

async function preparePaint(harness, kind) {
  return harness.evaluateAsync(async (kind) => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const template = Object.values(source.elements).find((entry) => entry.kind === 'text');
    if (!template) throw new Error('Native paint fixture requires the prepared public text layer');
    const isText = kind === 'tiny-text';
    const id = isText ? template.id : 'asset-native-safari-project';
    const transform = { x: 0, y: 0, scale: isText ? 0.4 : 1, widthScale: isText ? 0.035 : 0.27, heightScale: isText ? 0.01 : 0.4 };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80"><path fill="white" d="M0 0h160v80H0z"/></svg>';
    const url = isText ? null : URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const data = isText ? { ...template.data, id, name: 'Native tiny text', value: 'AB\nCD', color: '#FFFFFF',
      align: 'center', weight: 500, lineHeight: 1.2, tracking: 0, wrap: 'nowrap', outlineEnabled: false,
      shadowEnabled: false, textEffect: { kind: 'solid' }, transform, visible: true }
      : { id, name: 'Native SVG image', layerType: 'asset', url, transform, visible: true, opacity: 1 };
    const element = { ...template, id, name: data.name, kind: isText ? 'text' : 'image', hidden: false, data,
      bounds: { ...template.bounds, x: 0, y: 0, width: transform.widthScale, height: transform.heightScale },
      ...(isText ? { content: data.value } : { content: undefined, assetId: `resource:${id}` }) };
    const artboard = source.pages[source.pageIds[0]];
    Object.assign(artboard, { width: 1600, height: 900, background: '#101010', elementIds: [id] });
    source.elements = { [id]: element };
    source.assets = isText ? {} : { [`resource:${id}`]: { id: `resource:${id}`, kind: 'image', name: data.name,
      source: url, mimeType: 'image/svg+xml', byteLength: 0 } };
    const design = source.metadata.designLab;
    design.ratio = 'wide';
    design.timeline.paused = true;
    design.exportSettings.width = 640;
    design.shaderSequence.targetLayerId = null;
    const board = design.workspace.artboards.find((entry) => entry.id === design.workspace.activeArtboardId);
    Object.assign(board.snapshot, { dimensions: { width: 1600, height: 900 }, ratio: 'wide', backgroundColor: '#101010',
      layerOrder: [id], textLayers: isText ? [data] : [], shaderLayers: [], logos: [], effectLayers: [], assets: isText ? [] : [data],
      groups: [], layerShaders: {}, timeline: design.timeline, shaderSequence: design.shaderSequence });
    await studio.applySource(source);
    await document.fonts.ready;
    if (url) { const image = new Image(); image.src = url; await image.decode(); }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { id, kind, localUrl: url };
  }, kind);
}

async function checkPaint(harness, fixture) {
  const { evaluate, evaluateAsync, command, click } = harness;
  const { kind } = fixture;
  await click('button[aria-label="Center selected artboard"]');
  const geometry = await evaluate((selector) => {
    const stage = document.querySelector(selector).getBoundingClientRect();
    return { x: stage.x, y: stage.y, width: stage.width, height: stage.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }, liveStage);
  assert(geometry.x >= 0 && geometry.y >= 0 && geometry.x + geometry.width <= geometry.viewportWidth && geometry.y + geometry.height <= geometry.viewportHeight,
    `Native paint screenshot would clip the stage: ${JSON.stringify(geometry)}`);
  const screenshot = await command('GET', '/screenshot');
  const result = await evaluateAsync(async (screenshot, geometry) => {
    const bounds = (context, width, height) => {
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width, top = height, right = -1, bottom = -1, count = 0;
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (pixels[offset] < 200 || pixels[offset + 1] < 200 || pixels[offset + 2] < 200 || pixels[offset + 3] < 200) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); count += 1;
      }
      return { left, top, right, bottom, count };
    };
    const preview = new Image(); preview.src = `data:image/png;base64,${screenshot}`; await preview.decode();
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const sx = preview.naturalWidth / geometry.viewportWidth, sy = preview.naturalHeight / geometry.viewportHeight;
    context.drawImage(preview, geometry.x * sx, geometry.y * sy, geometry.width * sx, geometry.height * sy, 0, 0, canvas.width, canvas.height);
    const expectedPaintBounds = bounds(context, canvas.width, canvas.height);
    const artifact = await window.glyphfield.studio.invoke('design.export', { format: 'png', download: false });
    if (!(artifact.blob instanceof Blob) || !artifact.blob.size || artifact.blob.type !== 'image/png') throw new Error('Native PNG export returned invalid bytes');
    const url = URL.createObjectURL(artifact.blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      return { expectedPaintBounds, actualPaintBounds: bounds(context, canvas.width, canvas.height), originClean: true,
        width: canvas.width, height: canvas.height, mime: artifact.blob.type, bytes: artifact.blob.size, fileName: artifact.fileName };
    } finally { URL.revokeObjectURL(url); }
  }, screenshot, geometry);
  assert.equal(result.width, 640); assert.equal(result.height, 360);
  assert(result.expectedPaintBounds.count > 50 && result.actualPaintBounds.count > 50, `${kind} has no actual painted ink: ${JSON.stringify(result)}`);
  for (const edge of ['left', 'top', 'right', 'bottom']) {
    assert(Math.abs(result.expectedPaintBounds[edge] - result.actualPaintBounds[edge]) <= 5,
      `${kind} export ${edge} does not match native preview: ${JSON.stringify(result)}`);
  }
  if (kind === 'tiny-text') assert(result.actualPaintBounds.bottom - result.actualPaintBounds.top > 30, 'Tiny selection box clipped or auto-fitted the two-line text');
  await click('header button[aria-label="Close export preview"]');
  return { ...fixture, ...result };
}

async function checkProjectRoundTrip(harness, localUrl) {
  return harness.evaluateAsync(async (localUrl) => {
    const studio = window.glyphfield.studio;
    const artifact = await studio.invoke('design.export.project');
    if (!(artifact.blob instanceof Blob) || !artifact.blob.size || artifact.blob.type !== 'application/json'
      || !artifact.fileName.endsWith('.glyphfield.json') || artifact.format !== 'JSON' || artifact.previewKind !== 'file') {
      throw new Error('Native project export did not return a typed nonempty JSON artifact');
    }
    const exported = JSON.parse(await artifact.blob.text());
    if (JSON.stringify(exported).includes('blob:')) throw new Error('Project still depends on a local object URL');
    if (exported.metadata.designLab.workspace.artboards.length !== 2) throw new Error('Project export lost an artboard');
    const identity = exported.metadata.designLab.identity;
    if (!identity?.fonts?.length || !identity.fonts.every((font) => font.path.startsWith('data:'))) throw new Error('Project fonts are not embedded');
    URL.revokeObjectURL(localUrl);
    await studio.applySource(exported);
    const restored = JSON.parse(studio.readSource());
    const positions = (document) => document.metadata.designLab.workspace.artboards.map(({ id, x, y }) => ({ id, x, y }));
    if (JSON.stringify(positions(restored)) !== JSON.stringify(positions(exported))) throw new Error('Project open changed artboard positions or ids');
    for (const element of Object.values(exported.elements)) {
      if (restored.elements[element.id]?.kind !== element.kind) throw new Error('Project open lost an editable layer');
    }
    const font = restored.metadata.designLab.identity.fonts[0];
    if (!font.family.startsWith('Glyphfield Project ') || font.path !== identity.fonts[0].path) throw new Error('Imported typography was not isolated with the same bytes');
    await document.fonts.ready;
    return { mime: artifact.blob.type, bytes: artifact.blob.size, fileName: artifact.fileName,
      artboards: positions(restored), embeddedFontCount: identity.fonts.length, family: font.family, editableLayerCount: Object.keys(restored.elements).length };
  }, localUrl);
}

// The parent runner owns the prepared text fixture and the only Safari session.
export async function checkSafariArtboardExport(harness) {
  const navigation = await checkNavigation(harness);
  const tinyText = await checkPaint(harness, await preparePaint(harness, 'tiny-text'));
  const svgFixture = await preparePaint(harness, 'svg-image');
  try {
    const svgImage = await checkPaint(harness, svgFixture);
    const project = await checkProjectRoundTrip(harness, svgFixture.localUrl);
    return { navigation, tinyText, svgImage: { ...svgImage, localUrl: undefined }, project };
  } finally {
    await harness.evaluate((url) => URL.revokeObjectURL(url), svgFixture.localUrl);
  }
}
