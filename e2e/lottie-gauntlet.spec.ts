import { expect, test } from '@playwright/test';
import { LOTTIE_EXAMPLES } from '../src/lib/lottieExamples';
import { skipWithoutHardwareWebGl, waitForStudioSource } from './studio-ui-helpers';

function difference(left: Uint8Array, right: Uint8Array) {
  return left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) / left.length;
}

const pixelBytes = (base64: string) => new Uint8Array(Buffer.from(base64, 'base64'));

for (const [index, example] of LOTTIE_EXAMPLES.entries()) {
  test(`${example.name} preserves its composition through seeking, a full loop, and PNG export`, async ({ page }, info) => {
    await page.goto('/studio?tool=lottie&project=starter');
    await skipWithoutHardwareWebGl(page, 'The Lottie player rebuilds a WebGL scene for every preset.');
    await waitForStudioSource(page);
    // Select a different preset first, so even the default exercises replacement.
    const other = LOTTIE_EXAMPLES[(index + 1) % LOTTIE_EXAMPLES.length];
    // Each preset rebuilds the WebGL player. The default Chromium project renders WebGL in
    // software, where a rebuild takes seconds, so these waits get their own budget.
    const exportFrame = page.getByRole('button', { name: 'Export frame', exact: true });
    await page.getByRole('button', { name: new RegExp(`^0${(index + 1) % LOTTIE_EXAMPLES.length + 1} ${other.name}`) }).click();
    await expect(exportFrame).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: new RegExp(`^0${index + 1} ${example.name}`) }).click();
    // readSource throws while the new preset's portable source is still being prepared.
    await expect.poll(() => page.evaluate(() => {
      try { return JSON.parse(window.glyphfield!.studio.readSource()).metadata.studio.state.source.id; } catch { return null; }
    }), { timeout: 30_000 }).toBe(example.id);
    await expect(exportFrame).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await expect(exportFrame).toBeEnabled({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible();
    const frames: Uint8Array[] = [];
    const statistics: object[] = [];
    for (const frame of [0, 75, 150, 225, 299]) {
      await page.evaluate((frame) => window.glyphfield!.studio.set('Animation frame', frame), frame);
      await expect(page.getByRole('slider', { name: 'Animation frame', exact: true })).toHaveAttribute('value', String(frame));
      const preview = await page.locator('canvas[aria-label="Lottie animation preview"]').screenshot();
      const result = await page.evaluate(async ({ preview }) => {
        const artifact = await window.glyphfield!.studio.invoke('lottie.export.frame.png') as { blob: Blob; fileName: string };
        async function pixels(url: string) {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 288; canvas.height = 180;
          const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 288, 180);
          // Base64, not an array: an array of 207,360 numbers takes seconds to serialize.
          const data = context.getImageData(0, 0, 288, 180).data;
          let binary = '';
          for (let offset = 0; offset < data.length; offset += 0x8000) binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
          return { dimensions: [image.naturalWidth, image.naturalHeight], pixels: btoa(binary) };
        }
        const url = URL.createObjectURL(artifact.blob);
        try {
          return { ...await pixels(url), preview: (await pixels(`data:image/png;base64,${preview}`)).pixels,
            bytes: artifact.blob.size, mime: artifact.blob.type, name: artifact.fileName };
        } finally { URL.revokeObjectURL(url); }
      }, { preview: preview.toString('base64') });
      expect(result.dimensions).toEqual([1200, 750]);
      expect(result.mime).toBe('image/png');
      expect(result.name).toBe(`${example.id}-frame-${frame}.png`);
      expect(result.bytes).toBeGreaterThan(1000);
      const exported = pixelBytes(result.pixels);
      const parity = difference(exported, pixelBytes(result.preview));
      // Allow subpixel text rasterization at different preview/export sizes.
      expect(parity, `${example.id} frame ${frame} preview/export difference`).toBeLessThan(2.5);
      expect(new Set(exported).size).toBeGreaterThan(30);
      frames.push(exported);
      statistics.push({ frame, bytes: result.bytes, parity });
      if (frame === 150) await info.attach(`${example.id}.png`, { body: preview, contentType: 'image/png' });
      const dialog = page.getByRole('dialog', { name: 'PNG export preview', exact: true });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    const seam = difference(frames[0], frames[4]);
    expect(seam, 'the loop returns to the opening composition').toBeLessThan(0.2);
    // Count local changes so a small moving signal is not diluted by empty paper.
    const movingChannels = Math.max(...frames.slice(1, 4).map((frame) => frame.filter((value, index) => Math.abs(value - frames[0][index]) > 8).length));
    expect(movingChannels, 'the scene has actual motion').toBeGreaterThan(24);
    await info.attach('motion-checks.json', { body: JSON.stringify({ statistics, seam, movingChannels }), contentType: 'application/json' });
  });
}

test('Lottie respects reduced motion and keeps the chosen scene visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/studio?tool=lottie&project=starter');
  await skipWithoutHardwareWebGl(page, 'The Lottie player rebuilds a WebGL scene for every preset.');
  await waitForStudioSource(page);
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible();
  // A paused player shows the middle frame once it loads; read the frame after that.
  await expect(page.getByRole('button', { name: 'Export frame', exact: true })).toBeEnabled({ timeout: 30_000 });
  const frame = page.getByRole('slider', { name: 'Animation frame', exact: true });
  const initial = await frame.inputValue();
  await page.waitForTimeout(300);
  await expect(frame).toHaveValue(initial);
  await page.getByRole('button', { name: /^06 Network orbit/ }).click();
  await expect(page.getByRole('button', { name: 'Export frame', exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible();
});
