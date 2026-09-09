import { expect, test } from '@playwright/test';

test('the native Design Lab range thumb tracks a real mouse drag', async ({ page }, testInfo) => {
  await page.goto('/studio?tool=material');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await page.locator('[data-testid="shader-lab-live-stage"] [data-canvas-editable]').last().click();
  const range = page.getByRole('slider', { name: 'Text size', exact: true });
  await expect(range).toBeVisible();
  await range.scrollIntoViewIfNeeded();
  const state = await range.evaluate((input: HTMLInputElement) => {
    const events: Array<{ type: string; value: string; captured: boolean }> = [];
    for (const type of ['pointerdown', 'gotpointercapture', 'pointermove', 'input', 'change', 'pointerup', 'lostpointercapture']) {
      input.addEventListener(type, (event) => {
        events.push({ type, value: input.value, captured: event instanceof PointerEvent && input.hasPointerCapture(event.pointerId) });
        input.dataset.rangeEventTrace = JSON.stringify(events);
      });
    }
    return { min: Number(input.min), max: Number(input.max), value: Number(input.value) };
  });
  const box = (await range.boundingBox())!;
  const from = box.x + 7 + (state.value - state.min) / (state.max - state.min) * (box.width - 14);
  const to = box.x + 7 + 0.6 * (box.width - 14);
  const y = box.y + box.height / 2;
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(from + (to - from) * step / 12, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await testInfo.attach('range-events', {
    body: await range.getAttribute('data-range-event-trace') ?? '[]',
    contentType: 'application/json',
  });
  expect(Number(await range.inputValue())).toBeGreaterThan(state.value + 0.1);
});
