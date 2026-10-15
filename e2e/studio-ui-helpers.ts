import { expect, test, type Page } from '@playwright/test';

export async function waitForStudioSource(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    try {
      const studio = window.glyphfield?.studio;
      return studio?.describe().source.read ? Boolean(studio.readSource()) : false;
    }
    catch (error) {
      if (error instanceof Error && /prepar|not available|No active Studio workspace/i.test(error.message)) return false;
      throw error;
    }
  })).toBe(true);
}

/** After Add text layer: waits until the source is readable and has the new text element. */
export async function waitForTextLayer(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    try {
      return Object.values(JSON.parse(window.glyphfield!.studio.readSource()).elements)
        .some((element) => (element as { kind: string }).kind === 'text');
    } catch (error) {
      // The portable source is regenerated after an edit; it is briefly unreadable.
      if (error instanceof Error && /prepar/i.test(error.message)) return false;
      throw error;
    }
  })).toBe(true);
}

export async function openSourceEditor(page: Page) {
  await waitForStudioSource(page);
  await page.locator('[data-studio-tool-header]:visible').getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Edit source code/ }).click();
  await expect(page.getByRole('textbox', { name: 'Editable source code', exact: true })).toBeVisible();
}

/**
 * Skips a test that needs hardware WebGL in a browser that renders WebGL in software.
 * The default Chromium project does (SwiftShader); GLYPHFIELD_BROWSER_NATIVE_GPU=1 uses the GPU.
 */
export async function skipWithoutHardwareWebGl(page: Page, reason: string) {
  const renderer = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!context) return 'no WebGL';
    const info = context.getExtension('WEBGL_debug_renderer_info');
    return String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER));
  });
  test.skip(/swiftshader|llvmpipe|software|no WebGL/i.test(renderer),
    `${reason} WebGL here renders in software (${renderer}); run with GLYPHFIELD_BROWSER_NATIVE_GPU=1.`);
}
