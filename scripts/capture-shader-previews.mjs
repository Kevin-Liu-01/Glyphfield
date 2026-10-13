#!/usr/bin/env node
/**
 * Recapture authentic library thumbnails from /shader-preview, one material at a time.
 * Usage: node scripts/capture-shader-previews.mjs --materials=id,id [--base=http://localhost:3012]
 */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? process.env.GLYPHFIELD_SHADER_BASE_URL ?? 'http://localhost:3012';
const ids = process.argv.find((arg) => arg.startsWith('--materials='))?.slice(12).split(',').filter(Boolean) ?? [];
if (!ids.length) throw new Error('Pass --materials=id,id');

const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=metal', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { height: 400, width: 640 } });
let failures = 0;
try {
  for (const id of ids) {
    try {
      await page.goto(`${base}/shader-preview?diagnostics=1&materialId=${encodeURIComponent(id)}`);
      await page.waitForFunction(() => Boolean(window.glyphfieldShaderPreview), null, { timeout: 30_000 });
      const image = await page.evaluate(async () => {
        await window.glyphfieldShaderPreview.ready(25_000);
        const canvas = document.querySelector('canvas[data-live-material-runtime-ready]') ?? document.querySelector('canvas[data-live-material-ready="true"]');
        if (!canvas) throw new Error('No ready canvas');
        return canvas.toDataURL('image/webp', 0.86);
      });
      writeFileSync(`public/shader-previews/${id}.webp`, Buffer.from(image.split(',')[1], 'base64'));
      console.log(`captured ${id}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
