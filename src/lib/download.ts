export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const pendingImageDataUrls = new Map<string, Promise<string>>();

/**
 * Embeds an image once even when the live canvas, autosave document, and export
 * renderer request it during the same render. Completed requests leave the
 * cache immediately so removed uploads cannot be retained by this module.
 */
export function imageUrlToDataUrl(source: string): Promise<string> {
  if (/^data:/i.test(source)) return Promise.resolve(source);
  const pending = pendingImageDataUrls.get(source);
  if (pending) return pending;

  const request = fetch(source).then(async (response) => {
    if (!response.ok) throw new Error(`Asset request failed with ${response.status}.`);
    return blobToDataUrl(await response.blob());
  });
  pendingImageDataUrls.set(source, request);
  const clear = () => {
    if (pendingImageDataUrls.get(source) === request) pendingImageDataUrls.delete(source);
  };
  void request.then(clear, clear);
  return request;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new DOMException('The PNG could not be encoded.'));
    }, 'image/png');
  });
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number
): Promise<Blob> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const source = URL.createObjectURL(blob);
  const image = new Image();
  image.src = source;

  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });

    if (!context) {
      throw new Error('Canvas is unavailable.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(source);
  }
}
