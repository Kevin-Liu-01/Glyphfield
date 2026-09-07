export interface ShaderPixels {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

/** Read the renderer, never its fallback image or a screenshot of loading UI. */
export function readShaderPixels(root: HTMLElement): ShaderPixels {
  if (root.querySelector('[data-live-material-ready="error"]')) throw new Error('Shader renderer failed.');
  if (root.querySelector('[data-live-material-ready="false"]')) throw new Error('Shader renderer is not ready.');
  const canvases = Array.from(root.querySelectorAll('canvas'));
  if (canvases.length !== 1) throw new Error(`Expected one authentic shader canvas; found ${canvases.length}.`);
  const canvas = canvases[0]!;
  for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      throw new Error('Shader canvas is hidden behind its loading preview.');
    }
    if (element === root) break;
  }
  if (!canvas.width || !canvas.height) throw new Error('Shader canvas has no drawable pixels.');
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas pixel readback is unavailable.');
  context.drawImage(canvas, 0, 0);
  const data = context.getImageData(0, 0, copy.width, copy.height).data;
  return { data, height: copy.height, width: copy.width };
}

export function summarizeShaderPixels({ data, height, width }: ShaderPixels) {
  let visiblePixels = 0;
  let minimum = 255;
  let maximum = 0;
  let total = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3]! === 0) continue;
    visiblePixels += 1;
    const luminance = (data[offset]! + data[offset + 1]! + data[offset + 2]!) / 3;
    minimum = Math.min(minimum, luminance);
    maximum = Math.max(maximum, luminance);
    total += luminance;
  }
  return {
    height,
    luminanceRange: visiblePixels ? maximum - minimum : 0,
    meanLuminance: visiblePixels ? total / visiblePixels : 0,
    visibleFraction: visiblePixels / Math.max(1, width * height),
    width,
  };
}

export function compareShaderPixels(previous: ShaderPixels, next: ShaderPixels) {
  if (previous.width !== next.width || previous.height !== next.height) {
    return { changedPixels: null, dimensionsMatch: false, maxChannelDelta: null, meanChannelDelta: null };
  }
  let changedPixels = 0;
  let maxChannelDelta = 0;
  let totalDelta = 0;
  for (let offset = 0; offset < previous.data.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(previous.data[offset + channel]! - next.data[offset + channel]!);
      changed ||= delta !== 0;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      totalDelta += delta;
    }
    if (changed) changedPixels += 1;
  }
  return {
    changedPixels,
    dimensionsMatch: true,
    maxChannelDelta,
    meanChannelDelta: totalDelta / Math.max(1, previous.data.length),
  };
}
