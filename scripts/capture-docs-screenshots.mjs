#!/usr/bin/env node
/**
 * Recaptures the Studio screenshots in public/screenshots that the docs and README use.
 *
 *   pnpm build && pnpm start -p 3071
 *   node scripts/capture-docs-screenshots.mjs --base=http://localhost:3071 [--only=studio-gt-lottie-dark-2026]
 *
 * Each view opens in a fresh browser context at 1600 × 900, so saved drafts never carry
 * between shots. A view is written in every format that already exists for its name
 * (.png, .webp or both), so docs links keep working. WebP is encoded by Chromium itself.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const base = (args.base ?? 'http://localhost:3071').replace(/\/$/, '');
const outDir = args.out ?? join(process.cwd(), 'public/screenshots');
const only = args.only ? new Set(args.only.split(',')) : null;
const VIEWPORT = { height: 900, width: 1600 };
const WEBP_QUALITY = 0.86;

/** Pauses Animation in the middle of the hold of the first scene whose label contains `text`. */
const pauseOnScene = (text) => async (page) => {
  await page.evaluate(async (label) => {
    const studio = window.glyphfield.studio;
    const { scenes } = await studio.invoke('animation.describe');
    const scene = scenes.find((candidate) => String(candidate.label).includes(label)) ?? scenes[0];
    await studio.invoke('animation.seek', { timeMs: scene.startMs + scene.holdMs / 2 });
  }, text);
};

/** Adds a Shaders.com image effect above the Design Lab artboard. */
const addImageEffect = (effectId) => async (page) => {
  await page.evaluate((id) => window.glyphfield.studio.invoke('design.effects.add', { effectId: id }), effectId);
};

const view = (name, tool, project, theme, setup) => ({ name, project, setup, theme, tool });

const VIEWS = [
  view('studio-gt-animation-dark-2026', 'animation', 'gt', 'dark', pauseOnScene('환영합니다')),
  view('studio-gt-animation-light-2026', 'animation', 'gt', 'light', pauseOnScene('환영합니다')),
  view('studio-gt-blog-dark-2026', 'blog', 'gt', 'dark'),
  view('studio-gt-brand-book-dark-2026', 'brand-book', 'gt', 'dark'),
  view('studio-gt-brand-book-light-2026', 'brand-book', 'gt', 'light'),
  view('studio-gt-brand-elements-dark-2026', 'brand-elements', 'gt', 'dark'),
  view('studio-gt-colors-light-2026', 'colors', 'gt', 'light'),
  view('studio-gt-components-dark-2026', 'buttons', 'gt', 'dark'),
  view('studio-gt-components-light-2026', 'buttons', 'gt', 'light'),
  view('studio-gt-design-lab-dark-2026', 'material', 'gt', 'dark'),
  view('studio-gt-design-lab-light-2026', 'material', 'gt', 'light'),
  view('studio-gt-design-lab-effects-dark-2026', 'material', 'gt', 'dark', addImageEffect('shader-effects-halftone')),
  view('studio-gt-identity-dark-2026', 'identity', 'gt', 'dark'),
  view('studio-gt-identity-light-2026', 'identity', 'gt', 'light'),
  view('studio-gt-lottie-dark-2026', 'lottie', 'gt', 'dark'),
  view('studio-gt-moodboard-dark-2026', 'design-board', 'gt', 'dark'),
  view('studio-gt-moodboard-light-2026', 'design-board', 'gt', 'light'),
  view('studio-gt-opengraph-dark-2026', 'opengraph', 'gt', 'dark'),
  view('studio-gt-opengraph-light-2026', 'opengraph', 'gt', 'light'),
  view('studio-gt-partnership-dark-2026', 'partnership', 'gt', 'dark'),
  view('studio-gt-slides-dark-2026', 'slides', 'gt', 'dark'),
  view('studio-gt-terminal-dark-2026', 'terminal', 'gt', 'dark'),
  view('studio-gt-typography-light-2026', 'typography', 'gt', 'light'),
  view('studio-ramp-blog-light-2026', 'blog', 'ramp', 'light'),
  view('studio-stripe-slides-light-2026', 'slides', 'stripe', 'light'),
  view('studio-stripe-terminal-light-2026', 'terminal', 'stripe', 'light'),
];

/** Waits for the tool's Browser API, fonts, and every live shader to report ready. */
async function waitForStudio(page, tool) {
  await page.waitForFunction((id) => {
    try { return window.glyphfield?.studio?.activeTool?.() === id; } catch { return false; }
  }, tool, { timeout: 180_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelectorAll('[data-live-material-ready="false"]').length === 0, null, { timeout: 60_000 })
    .catch(() => console.warn('  a shader did not report ready within 60 s'));
}

async function encodeWebp(page, png) {
  const base64 = await page.evaluate(async ({ data, quality }) => {
    const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ quality, type: 'image/webp' });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < buffer.length; index += 0x8000) binary += String.fromCharCode(...buffer.subarray(index, index + 0x8000));
    return btoa(binary);
  }, { data: png.toString('base64'), quality: WEBP_QUALITY });
  return Buffer.from(base64, 'base64');
}

const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=metal', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
let failures = 0;
for (const { name, project, setup, theme, tool } of VIEWS) {
  if (only && !only.has(name)) continue;
  const formats = ['png', 'webp'].filter((format) => existsSync(join(outDir, `${name}.${format}`)));
  if (formats.length === 0) formats.push('webp');
  const context = await browser.newContext({ colorScheme: theme, deviceScaleFactor: 1, viewport: VIEWPORT });
  await context.addInitScript((preference) => {
    try { localStorage.setItem('glyphfield-theme-v1', preference); } catch { /* storage can be unavailable */ }
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  try {
    await page.goto(`${base}/studio?tool=${tool}&project=${project}`, { timeout: 180_000, waitUntil: 'load' });
    await waitForStudio(page, tool);
    if (setup) await setup(page);
    await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);
    await page.waitForTimeout(2_500);
    await waitForStudio(page, tool);
    const png = await page.screenshot({ type: 'png' });
    for (const format of formats) {
      writeFileSync(join(outDir, `${name}.${format}`), format === 'png' ? png : await encodeWebp(page, png));
    }
    console.log(`${name}: ${formats.join(', ')}${errors.length ? ` (page errors: ${errors.slice(0, 2).join(' | ')})` : ''}`);
  } catch (error) {
    failures += 1;
    console.error(`${name}: failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  } finally {
    await context.close();
  }
}
await browser.close();
process.exitCode = failures ? 1 : 0;
