import { expect, test } from '@playwright/test';

import { waitForStudioSource } from './studio-ui-helpers';

test('brand elements export real PNG and HTML artifacts through the Browser API', async ({ page }) => {
  await page.goto('/studio?tool=brand-elements&project=stripe');
  await waitForStudioSource(page);

  const png = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('brand-element.export.png', { elementId: 'opengraph' }) as { blob: Blob; fileName: string };
    const bitmap = await createImageBitmap(artifact.blob);
    const head = [...new Uint8Array(await artifact.blob.slice(0, 4).arrayBuffer())];
    return { fileName: artifact.fileName, head, height: bitmap.height, type: artifact.blob.type, width: bitmap.width };
  });
  expect(png).toEqual({ fileName: 'stripe-opengraph.png', head: [0x89, 0x50, 0x4e, 0x47], height: 630, type: 'image/png', width: 1200 });

  const retina = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('brand-element.export.png', { elementId: 'business-card', scale: 2 }) as { blob: Blob; fileName: string };
    const bitmap = await createImageBitmap(artifact.blob);
    return { fileName: artifact.fileName, height: bitmap.height, width: bitmap.width };
  });
  expect(retina).toEqual({ fileName: 'stripe-business-card@2x.png', height: 1800, width: 2800 });
  expect(JSON.parse(await page.evaluate(() => window.glyphfield!.studio.readSource())).elementId).toBe('business-card');

  const html = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('brand-element.export.html', { assetOrigin: 'https://brand.example.com', elementId: 'welcome-email' }) as { blob: Blob; fileName: string };
    return { fileName: artifact.fileName, text: await artifact.blob.text(), type: artifact.blob.type };
  });
  expect(html.fileName).toBe('stripe-welcome-email.html');
  expect(html.type).toContain('text/html');
  expect(html.text).toContain('<table role="presentation"');
  expect(html.text).toContain('https://brand.example.com/brands/stripe/logos/');
  expect(html.text).not.toMatch(/<style|class=/);

  await expect(page.evaluate(() => window.glyphfield!.studio.invoke('brand-element.export.html', { elementId: 'opengraph' })))
    .rejects.toThrow(/not an email/);
});

test('the welcome email PNG paints every card image', async ({ page }) => {
  await page.goto('/studio?tool=brand-elements&project=gt');
  await waitForStudioSource(page);
  // WebKit used to leave large images out of the rasterized SVG, leaving flat panels.
  const cardColors = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('brand-element.export.png', { elementId: 'welcome-email' }) as { blob: Blob };
    const surface = document.querySelector<HTMLElement>('.brand-element-artboard-surface')!;
    const box = surface.getBoundingClientRect();
    const bitmap = await createImageBitmap(artifact.blob);
    const scale = bitmap.width / box.width;
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return [...surface.querySelectorAll<HTMLImageElement>('img[src*="email-lifecycle"]')].map((image) => {
      const rect = image.getBoundingClientRect();
      const { data } = context.getImageData(Math.round((rect.left - box.left) * scale), Math.round((rect.top - box.top) * scale),
        Math.max(1, Math.round(rect.width * scale)), Math.max(1, Math.round(rect.height * scale)));
      const colors = new Set<number>();
      for (let index = 0; index < data.length; index += 4) colors.add(((data[index] >> 4) << 8) | ((data[index + 1] >> 4) << 4) | (data[index + 2] >> 4));
      return colors.size;
    });
  });
  expect(cardColors.length).toBeGreaterThan(0);
  for (const colors of cardColors) expect(colors).toBeGreaterThan(6);
});
