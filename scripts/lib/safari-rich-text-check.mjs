import assert from 'node:assert/strict';

// The shared runner supplies an isolated text-only project. All editing and
// formatting use real Safari input; the public API verifies the resulting data.
export async function checkSafariRichText(harness) {
  const { click, press, keys, evaluate, evaluateAsync, waitFor, captureScreenshot } = harness;
  const selector = '[data-testid="shader-lab-live-stage"] [data-canvas-editable]';
  await click(selector);
  await press(keys.meta, 'a');
  await press('\uE012'); // Left collapses to the beginning.
  for (let index = 0; index < 6; index++) await press(keys.shift, keys.right);
  assert.equal(await evaluate(() => window.getSelection().toString()), 'Select');
  await click('button[aria-label="Italic text"]');
  await click('button[aria-label="Underline text"]');
  await waitFor(() => {
    const text = Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements).find((entry) => entry.kind === 'text');
    return text.data.runs?.[0]?.style.underline === true;
  }, 'selected range formatting');
  const formatted = await evaluate((selector) => {
    const data = Object.values(JSON.parse(window.glyphfield.studio.readSource()).elements).find((entry) => entry.kind === 'text').data;
    const root = document.querySelector(selector);
    return { data, selected: getComputedStyle(root.querySelector('[data-text-run="0"]')).fontStyle,
      remaining: getComputedStyle(root.querySelector('[data-text-run="6"]')).fontStyle };
  }, selector);
  assert.deepEqual(formatted.data.runs, [{ start: 0, end: 6, style: { fontStyle: 'italic', underline: true } }]);
  assert.equal(formatted.selected, 'italic');
  assert.equal(formatted.remaining, 'normal');
  const exported = await evaluateAsync(async () => {
    const studio = window.glyphfield.studio;
    const source = studio.readSource();
    await studio.applySource(source);
    const artifact = await studio.invoke('design.export', { format: 'png' });
    const url = URL.createObjectURL(artifact.blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 200 && pixels[index + 1] > 200 && pixels[index + 2] > 200) ink++;
      return { mime: artifact.blob.type, bytes: artifact.blob.size, width: image.naturalWidth, height: image.naturalHeight, ink,
        runs: Object.values(JSON.parse(studio.readSource()).elements).find((entry) => entry.kind === 'text').data.runs };
    } finally { URL.revokeObjectURL(url); }
  });
  assert.equal(exported.mime, 'image/png');
  assert(exported.width > 0 && exported.height > 0 && exported.bytes > 1000 && exported.ink > 100);
  assert.deepEqual(exported.runs, formatted.data.runs);
  return { ...exported, screenshot: await captureScreenshot('native-rich-text-export') };
}
