#!/usr/bin/env node
/** Native WebGPU catalog audit and authentic thumbnail capture, one renderer at a time. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const catalog = JSON.parse(readFileSync(new URL('../src/lib/shaderEffectsCatalog.generated.json', import.meta.url)));
const base = process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://localhost:3015';
const selected = process.argv.find((arg) => arg.startsWith('--materials='))?.split('=')[1]?.split(',');
const entries = catalog.filter((effect) => !effect.infrastructure && (!selected || selected.includes(effect.id)));
const session = `glyphfield-effects-audit-${process.pid}`;
const results = [];
function browser(args) {
  let output;
  try { output = execFileSync('agent-browser', ['--session', session, '--args', '--enable-gpu', '--json', ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 20 * 1024 * 1024 }); } catch (error) { throw new Error(String(error.stdout || error.stderr || error.message)); }
  const result = JSON.parse(output);
  if (Array.isArray(result)) {
    const failure = result.find((entry) => !entry.success);
    if (failure) throw new Error(JSON.stringify(failure));
    return result.map((entry) => entry.result);
  }
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data?.result ?? result.data;
}
mkdirSync('reports', { recursive: true });
try {
  browser(['set', 'viewport', '640', '480', '1']);
  for (const effect of entries) {
    try {
      browser(['open', `${base}/shader-preview?diagnostics=1&materialId=${effect.id}${effect.stateful ? '&live=1' : ''}`]);
      browser(['wait', '--fn', effect.stateful ? 'Boolean(window.glyphfieldShaderFrames)' : 'Boolean(window.glyphfieldShaderPreview)']);
      if (effect.stateful) {
        browser(['eval', 'window.glyphfieldShaderFrames.ready()']);
        const stroke = Array.from({ length: 18 }, (_, index) => [`mouse move ${120 + index * 18} ${200 + Math.round(Math.sin(index / 3) * 75)}`, 'wait 50']).flat();
        browser(['batch', 'mouse move 100 200', 'mouse down', ...stroke, 'mouse up']);
      }
      const sample = browser(['eval', `(async () => {
        const api = window.glyphfieldShaderPreview;
        const frames = window.glyphfieldShaderFrames;
        if (api) await api.ready(25000); else frames.freeze();
        const first = api ? await api.read() : frames.read();
        await new Promise(r => setTimeout(r, 100));
        const second = api ? await api.read() : frames.read();
        const canvas = document.querySelector('canvas[data-live-material-runtime-ready]');
        return { first, stable: second.comparison.changedPixels === 0, image: canvas.toDataURL('image/webp', .85) };
      })()`]);
      const pixels = sample.first.pixels;
      if (pixels.visibleFraction < .001) throw new Error('Transparent output');
      if (!sample.stable) throw new Error('Paused output changed');
      if (process.argv.includes('--thumbnails')) writeFileSync(`public/shader-previews/${effect.id}.webp`, Buffer.from(sample.image.split(',')[1], 'base64'));
      results.push({ id: effect.id, ok: true, pixels });
      console.log(`PASS ${effect.component} (${Math.round(pixels.visibleFraction * 100)}% coverage)`);
    } catch (error) {
      results.push({ id: effect.id, ok: false, error: error.message });
      console.log(`FAIL ${effect.component}: ${error.message.slice(0, 250)}`);
    }
    writeFileSync('reports/shader-effects-audit.json', JSON.stringify(results, null, 2));
  }
} finally { try { browser(['close']); } catch {} }
const failures = results.filter((result) => !result.ok);
console.log(`${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exitCode = 1;
