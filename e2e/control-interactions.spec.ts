import { expect, test, type Locator, type Page } from '@playwright/test';

async function readyShader(page: Page) {
  const stage = page.locator('[data-testid="shader-lab-live-stage"]');
  await expect(stage.locator('[data-live-material-ready="true"]')).toHaveCount(1);
  await expect(stage.locator('[data-shader-time-restoring="true"]')).toHaveCount(0);
}

async function prepare(page: Page, text = false) {
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Pause shader motion', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shader base color', exact: true })).toBeVisible();
  await readyShader(page);
  // Freeze through the public API, keeping input tests independent of transport.
  await page.evaluate(() => window.glyphfield!.studio.invoke('design.frame.pause'));
  if (text) await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
}

async function readValues(page: Page) {
  return page.evaluate(() => {
    const source = JSON.parse(window.glyphfield!.studio.readSource() as string);
    const elements = Object.values(source.elements) as Array<{
      kind: string; data: { color: string; fontRole: string; transform: { scale: number }; shaderSize: number };
    }>;
    return {
      text: elements.find((entry) => entry.kind === 'text')?.data,
      shader: elements.find((entry) => entry.kind === 'shader')?.data,
      page: source.pages[source.pageIds[0]],
    };
  });
}

async function clickFraction(page: Page, element: Locator, x: number, y = 0.5) {
  await element.scrollIntoViewIfNeeded();
  const bounds = (await element.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
}

for (const neutral of ['#FFFFFF', '#000000']) {
  test(`color picker remembers a chosen hue starting from ${neutral} on the first gesture`, async ({ page }) => {
    await prepare(page, true);
    const hex = page.getByRole('textbox', { name: 'Text color HEX', exact: true });
    await hex.fill(neutral);
    await hex.press('Enter');
    await page.getByRole('button', { name: 'Text color', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Text color color picker', exact: true });
    await expect(picker).toBeVisible();
    const hue = picker.getByRole('slider', { name: 'Text color hue', exact: true });
    await clickFraction(page, hue, 2 / 3);
    await expect.poll(async () => Number(await hue.inputValue())).toBeGreaterThan(220);
    await expect.poll(async () => Number(await hue.inputValue())).toBeLessThan(260);
    await clickFraction(page, picker.getByRole('slider', { name: 'Text color saturation and brightness', exact: true }), 0.8, 0.25);
    await expect.poll(async () => {
      const color = (await readValues(page)).text!.color;
      return Number.parseInt(color.slice(5, 7), 16) - Number.parseInt(color.slice(1, 3), 16);
    }).toBeGreaterThan(90);
    await expect(hex).toHaveValue((await readValues(page)).text!.color);
  });
}

test('HEX blur keeps the first picker click, and the next dropdown and choice work once', async ({ page }) => {
  await prepare(page, true);
  const hex = page.getByRole('textbox', { name: 'Text color HEX', exact: true });
  await hex.fill('#22cc88');
  await page.getByRole('button', { name: 'Text color', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Text color color picker', exact: true })).toBeVisible();
  await expect.poll(async () => (await readValues(page)).text!.color).toBe('#22CC88');
  await page.keyboard.press('Escape');
  const font = page.getByRole('combobox', { name: 'Text font role', exact: true });
  await font.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: /^Code ·/ }).click();
  await expect.poll(async () => (await readValues(page)).text!.fontRole).toBe('Code');
  await expect(font).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('text size first click, continuous drag, and keyboard commit agree with the canvas source', async ({ page }) => {
  await prepare(page, true);
  const size = page.getByRole('slider', { name: 'Text size', exact: true });
  await clickFraction(page, size, 0.55);
  const clicked = Number(await size.inputValue());
  await expect.poll(async () => (await readValues(page)).text!.transform.scale).toBeCloseTo(clicked, 2);
  const bounds = (await size.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height / 2, { steps: 12 });
  await page.mouse.up();
  const dragged = Number(await size.inputValue());
  expect(dragged).toBeGreaterThan(clicked);
  await expect.poll(async () => (await readValues(page)).text!.transform.scale).toBeCloseTo(dragged, 2);
  await expect(size).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await readValues(page)).text!.transform.scale).toBeCloseTo(dragged - 0.05, 2);
});

test('Pause preserves the selected layer and its inspector on the first click', async ({ page }) => {
  await page.goto('/studio?tool=material');
  await expect(page.getByRole('button', { name: 'Shader base color', exact: true })).toBeVisible();
  await readyShader(page);
  await page.getByRole('button', { name: 'Pause shader motion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume native shader motion', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shader base color', exact: true })).toBeVisible();
});

test('Escape cancels numeric shader zoom and keyboard slider changes commit without blur', async ({ page }) => {
  await prepare(page);
  const initial = (await readValues(page)).shader!.shaderSize;
  const input = page.getByRole('spinbutton', { name: 'Shader zoom value', exact: true });
  await input.fill('4');
  await input.press('Escape');
  await expect(input).toHaveValue(String(initial));
  expect((await readValues(page)).shader!.shaderSize).toBe(initial);
  const slider = page.getByRole('slider', { name: 'Shader zoom slider', exact: true });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect.poll(async () => (await readValues(page)).shader!.shaderSize).toBeGreaterThan(initial);
  await expect(slider).toBeFocused();
});

test('checkboxes toggle on the first click and Space while keeping the text selected', async ({ page }) => {
  await prepare(page, true);
  const outline = page.getByRole('checkbox', { name: 'Text outline', exact: true });
  await outline.click();
  await expect(outline).toBeChecked();
  await outline.press('Space');
  await expect(outline).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Text color', exact: true })).toBeVisible();
});

test('leaving a typed artboard size commits it and the next action runs on that first click', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: /^Set artboard size\./ }).click();
  const panel = page.locator('.artboard-size-popover');
  await expect(panel).toBeVisible();
  await panel.getByRole('spinbutton', { name: 'Width', exact: true }).fill('1440');
  await page.getByRole('button', { name: 'Add text layer', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(async () => (await readValues(page)).page.width).toBe(1440);
  await expect(page.getByRole('button', { name: 'Text color', exact: true })).toBeVisible();
});
