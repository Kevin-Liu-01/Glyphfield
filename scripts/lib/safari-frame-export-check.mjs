import assert from 'node:assert/strict';
import { checkSafariFrameMotion } from './safari-frame-motion-check.mjs';

// Canonical fixture: resolvePaperShaderFrame(paper-gem-smoke default preset,
// timeMs1250, speed.3, preserveGeometry:false) =1438.7717134510608 native ms.
// This explicitly is not1250 animation frames. The E2E counterpart imports the
// installed preset and actual resolver; this dependency-light Node runner keeps
// that fixture expectation visible and fails if the source contract changes.
const paperClockFixture = { timeMs: 1250, frame: 1438.7717134510608, rate: 1.1502173707608487 };

// Runs only inside the native runner's owned Safari session. No permissions,
// security flags, persisted storage, or product internals are modified.
export async function checkSafariFrameExport(harness, mode) {
  const { baseUrl, command, evaluate, evaluateAsync, waitFor, click } = harness;
  await command('POST', '/url', { url: `${baseUrl}/studio?tool=material` });
  await waitFor(() => {
    try {
      return Boolean(window.glyphfield?.studio?.describe().source.read
        && JSON.parse(window.glyphfield.studio.readSource()).elements);
    } catch (error) {
      if (error instanceof Error && error.message === 'Portable composition code is still being prepared.') return false;
      throw error;
    }
  }, 'readable Design Lab source');
  const fixture = await evaluateAsync(async (mode) => {
    const studio = window.glyphfield.studio;
    const source = JSON.parse(studio.readSource());
    const shader = Object.values(source.elements).find((element) => element.kind === 'shader');
    if (!shader) throw new Error('Default Design Lab has no shader to exercise');
    shader.data.materialId = 'paper-gem-smoke';
    shader.data.settings.speed = 0.3;
    if (mode === 'grain-export') {
      shader.data.materialId = 'paper-dithering';
      shader.data.settings.grain = 60;
    }
    delete shader.data.frameState;
    delete shader.data.frameSnapshot;
    source.metadata.designLab.timeline.paused = false;
    source.metadata.designLab.timeline.timeMs = 1250;
    source.metadata.designLab.exportSettings.width = 640;
    if (mode === 'motion-export') Object.assign(source.metadata.designLab.exportSettings, { durationMs: 1200, fps: 12, gifLoop: 'raw' });
    const active = source.metadata.designLab.workspace.artboards.find((board) => board.id === source.metadata.designLab.workspace.activeArtboardId);
    active.snapshot.timeline = source.metadata.designLab.timeline;
    active.snapshot.shaderLayers = [shader.data];
    await studio.applySource(source);
    return { shaderId: shader.id, materialId: shader.data.materialId };
  }, mode);
  await waitFor((id) => {
    const surface = document.querySelector(`[data-shader-instance="canvas-${CSS.escape(id)}"]`);
    return Boolean(surface?.querySelector('[data-live-material-ready="true"]') && surface?.querySelector('canvas')?.width);
  }, 'actual native shader pixels', fixture.shaderId);
  await waitFor(() => !document.querySelector('[data-testid="shader-lab-live-stage"] [data-shader-time-restoring="true"]'), 'restored imported shader time');
  if (mode === 'grain-export') {
    await click('button[aria-label="Add effect layer"]');
    await waitFor(() => Boolean(document.querySelector('[data-testid="shader-lab-live-stage"] canvas[data-effect-kind="bayer"]')?.width), 'grain composition converter');
  }
  const environment = await evaluate(() => ({ origin: location.origin, secureContext: isSecureContext,
    visibility: document.visibilityState, focused: document.hasFocus(), userAgent: navigator.userAgent,
    indexedDB: typeof indexedDB, cryptoSubtle: typeof crypto.subtle, videoEncoder: typeof VideoEncoder }));
  await evaluate(() => {
    const errors = [];
    Object.defineProperty(document, '__shaderBrowserErrors', { value: errors });
    const wrap = (prototype, method, request = false) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
      if (!descriptor || typeof descriptor.value !== 'function') return;
      const original = descriptor.value;
      const record = (error) => errors.push({ operation: method, name: error?.name, message: error?.message, stack: error?.stack });
      Object.defineProperty(prototype, method, { ...descriptor, value: function (...args) {
        try {
          const value = Reflect.apply(original, this, args);
          if (request && value instanceof IDBRequest) value.addEventListener('error', () => record(value.error));
          return value;
        } catch (error) { record(error); throw error; }
      } });
    };
    wrap(HTMLCanvasElement.prototype, 'toBlob');
    wrap(HTMLCanvasElement.prototype, 'toDataURL');
    wrap(CanvasRenderingContext2D.prototype, 'getImageData');
    wrap(IDBFactory.prototype, 'open', true);
    wrap(IDBObjectStore.prototype, 'put', true);
  });
  const operations = [];
  async function invoke(action, request, includeBytes = false) {
    const result = await evaluateAsync(async (action, request, includeBytes) => {
      try {
        const result = await window.glyphfield.studio.invoke(action, request);
        if (typeof result === 'string') return { ok: true, source: result };
        const blob = result?.blob;
        if (!(blob instanceof Blob) || !blob.size) throw new Error('Export did not return nonempty Blob bytes');
        const encodedDataUrl = includeBytes ? await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
        }) : undefined;
        if (request?.format === 'mp4') return { ok: true, mime: blob.type, bytes: blob.size, filename: result.fileName, encodedDataUrl };
        const image = new Image();
        const url = URL.createObjectURL(blob);
        try {
          image.src = url;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let hash = 2166136261;
          for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
          return { ok: true, mime: blob.type, bytes: blob.size, width: canvas.width, height: canvas.height,
            hash: hash >>> 0, filename: result.fileName, encodedDataUrl };
        } finally { URL.revokeObjectURL(url); }
      } catch (error) {
        return { ok: false, error: { name: error.name, message: error.message, stack: error.stack,
          cause: error.cause ? String(error.cause) : null }, nativeErrors: document.__shaderBrowserErrors,
          alerts: Array.from(document.querySelectorAll('[role="alert"]'), (node) => node.textContent) };
      }
    }, action, request, includeBytes);
    operations.push({ action, request, ...result, source: undefined, encodedDataUrl: undefined });
    console.log(JSON.stringify({ nativeShaderOperation: operations.at(-1), fixture, environment }));
    assert(result.ok, `${action} failed: ${JSON.stringify(result.error)}`);
    return result;
  }
  const read = () => evaluateAsync(async (id) => {
    const deadline = performance.now() + 10_000;
    let rawSource;
    for (;;) {
      try { rawSource = window.glyphfield.studio.readSource(); break; }
      catch (error) {
        if (!(error instanceof Error) || error.message !== 'Portable composition code is still being prepared.'
          || performance.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    const source = JSON.parse(rawSource);
    const shader = source.elements[id];
    return { timeline: source.metadata.designLab.timeline,
      motion: await window.glyphfield.studio.invoke('design.motion.describe'), assetIds: Object.keys(source.assets),
      sequence: source.metadata.designLab.shaderSequence,
      snapshot: shader.data.frameSnapshot, frame: shader.data.frameState,
      asset: source.assets[shader.data.frameSnapshot?.assetId]?.source };
  }, fixture.shaderId);
  const assertPaperClock = (captured) => {
    if (fixture.materialId !== 'paper-gem-smoke') return;
    const expectedFrame = paperClockFixture.frame
      + (captured.timeline.timeMs - paperClockFixture.timeMs) * paperClockFixture.rate;
    const timingErrorMs = Math.abs(captured.frame?.frame - expectedFrame) / paperClockFixture.rate;
    const proof = { frame: captured.frame, expectedFrame, timingErrorMs };
    console.log(JSON.stringify({ nativePaperClock: proof }));
    assert.equal(captured.frame?.engine, 'paper');
    assert(captured.frame.frame >= paperClockFixture.frame - 1e-6, `Imported1250ms shader reset to its preset frame: ${JSON.stringify(proof)}`);
    assert(timingErrorMs <= 100, `Imported shader native clock is not at the authored time: ${JSON.stringify(proof)}`);
  };
  if (mode === 'motion-export') {
    const motionProof = await checkSafariFrameMotion({ harness, fixture, read, invoke, assertPaperClock });
    operations.push({ motionProof });
  } else if (mode === 'pause-resume') {
    const pixels = () => evaluate((id) => {
      const native = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"] canvas`);
      if (!native?.width || !native?.height) throw new Error('Pause must retain an actual native shader canvas');
      const canvas = document.createElement('canvas'); canvas.width = native.width; canvas.height = native.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(native, 0, 0);
      let hash = 2166136261;
      for (const byte of context.getImageData(0, 0, canvas.width, canvas.height).data) hash = Math.imul(hash ^ byte, 16777619);
      return { width: canvas.width, height: canvas.height, hash: hash >>> 0 };
    }, fixture.shaderId);
    const initial = await read();
    for (const [pauseLabel, resumeLabel] of [
      ['Pause shader motion', 'Resume native shader motion'],
      ['Freeze current shader frame', 'Resume live shader motion'],
    ]) {
      await click(`button[aria-label="${pauseLabel}"]`);
      const paused = await read();
      const frozenPixels = await pixels();
      assert(paused.motion.paused, `${pauseLabel} did not pause`);
      assertPaperClock(paused);
      assert.deepEqual(paused.assetIds, initial.assetIds, 'Pause created saved frame assets');
      assert.deepEqual(paused.sequence, initial.sequence, 'Pause added shader sequence frames');
      await evaluateAsync(() => new Promise((resolve) => setTimeout(resolve, 450)));
      assert.deepEqual(await pixels(), frozenPixels, `${pauseLabel} did not freeze displayed pixels`);
      assert.deepEqual((await read()).motion, paused.motion, `${pauseLabel} left the shader clock running`);
      await click(`button[aria-label="${resumeLabel}"]`);
      await evaluateAsync(() => new Promise((resolve) => setTimeout(resolve, 350)));
      assert(await evaluate(() => document.hasFocus()), 'Native Safari lost foreground focus during Resume; cadence observation is invalid');
      const resumed = await read();
      const resumedPixels = await pixels();
      assert(!resumed.motion.paused, `${resumeLabel} did not resume`);
      assert(resumed.motion.timeMs > paused.motion.timeMs, `${resumeLabel} did not advance native time`);
      assert.notEqual(resumedPixels.hash, frozenPixels.hash, `${resumeLabel} did not animate native pixels`);
      operations.push({ pauseLabel, resumeLabel, frozenPixels, resumedPixels,
        pausedTimeMs: paused.motion.timeMs, resumedTimeMs: resumed.motion.timeMs });
    }
    await click('button[aria-label="Pause shader motion"]');
    assert((await read()).motion.paused, 'The final real Pause click did not freeze the shader');
  } else if (mode === 'capture') {
    await invoke('design.frame.capture');
    const captured = await read();
    assert(captured.timeline.paused, 'Explicit frame capture must freeze motion');
    assert(captured.asset?.startsWith('data:image/png;base64,'), 'Capture must embed the actual PNG');
    assertPaperClock(captured);
    await click('button[aria-label="Save design"]');
    await waitFor(() => Boolean(document.querySelector('button[aria-label="Design saved"]')), 'named frame save');
    await command('POST', '/refresh', {});
    await waitFor((id) => {
      try {
        return Boolean(window.glyphfield?.studio?.describe().source.read
          && JSON.parse(window.glyphfield.studio.readSource()).elements[id]?.data.frameSnapshot);
      } catch (error) {
        if (error instanceof Error && error.message === 'Portable composition code is still being prepared.') return false;
        throw error;
      }
    }, 'captured source after reload', fixture.shaderId);
    await waitFor((id) => {
      const image = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"] [data-shader-frame-ready="true"] [data-shader-frame-image]`);
      return !document.querySelector('[data-canvas-initializing="true"]') && image?.complete && image.naturalWidth > 0;
    }, 'fully restored frozen shader image', fixture.shaderId);
    const reopened = await read();
    assert.equal(reopened.asset, captured.asset, 'Reload changed the captured PNG');
    assert(reopened.timeline.paused, 'Reload restarted the captured frame');
  } else {
    const savedFrame = mode === 'frozen-export' || mode === 'grain-export';
    if (savedFrame) await invoke('design.frame.capture');
    for (const format of savedFrame ? ['png', 'jpg'] : ['png']) {
      const before = await read();
      const first = await invoke('design.export', { format, download: false });
      assert.equal(first.mime, format === 'jpg' ? 'image/jpeg' : 'image/png');
      assert.equal(first.width, 640);
      const after = await read();
      assert(after.timeline.paused, 'Still export restarted native shader playback');
      assertPaperClock(after);
      if (savedFrame) assert.equal(after.asset, before.asset, 'Export replaced the chosen frame');
      await evaluateAsync(() => new Promise((resolve) => setTimeout(resolve, 400)));
      assert.deepEqual((await read()).timeline, after.timeline, 'Shader time advanced after still export');
      await click('header button[aria-label="Close export preview"]');
      const second = await invoke('design.export', { format, download: false });
      assert.equal(second.hash, first.hash, `${format} export changed pixels without an edit`);
      await click('header button[aria-label="Close export preview"]');
    }
  }
  return { fixture, environment, operations, final: { ...(await read()), asset: undefined } };
}
