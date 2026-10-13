/**
 * Rasterise a rendered DOM subtree to PNG at its real pixel size. The node is
 * cloned with every computed style inlined (pseudo-elements become real spans),
 * images and fonts are embedded as data URLs, and the result is drawn from an
 * SVG foreignObject. Browser-only.
 */
import { blobToDataUrl, imageUrlToDataUrl, resolveSvgRasterDimensions } from './download';

export type DomRasterOptions = {
  /** @font-face rules with embedded sources, so text never rasterises in a fallback face. */
  fontFaceCss?: string;
  height: number;
  /** Output pixels per CSS pixel. 1 exports at the element's real size. */
  pixelRatio?: number;
  width: number;
};

const SKIPPED_PROPERTIES = /^(?:transition|animation|will-change|cursor|caret-color|user-select|-webkit-user-select|pointer-events)/;

function inlineComputedStyle(source: Element, target: HTMLElement | SVGElement, pseudo?: '::after' | '::before') {
  const computed = window.getComputedStyle(source, pseudo);
  const declarations: string[] = [];
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed[index]!;
    if (SKIPPED_PROPERTIES.test(property)) continue;
    declarations.push(`${property}:${computed.getPropertyValue(property)};`);
  }
  target.setAttribute('style', declarations.join(''));
}

function pseudoElement(source: Element, pseudo: '::after' | '::before'): HTMLElement | null {
  const computed = window.getComputedStyle(source, pseudo);
  const content = computed.getPropertyValue('content');
  if (!content || content === 'none' || content === 'normal') return null;
  const span = document.createElement('span');
  inlineComputedStyle(source, span, pseudo);
  const text = content.replace(/^["']|["']$/g, '');
  if (text) span.textContent = text;
  return span;
}

/** Clone with computed styles inlined. Source and clone are walked together. */
function cloneWithStyles(source: Element): Element {
  const clone = source.cloneNode(false) as Element;
  if (clone instanceof HTMLElement || clone instanceof SVGElement) inlineComputedStyle(source, clone);
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('class');
  const before = source instanceof HTMLElement ? pseudoElement(source, '::before') : null;
  if (before) clone.append(before);
  for (const child of source.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) clone.append(cloneWithStyles(child as Element));
    else if (child.nodeType === Node.TEXT_NODE) clone.append(child.cloneNode());
  }
  const after = source instanceof HTMLElement ? pseudoElement(source, '::after') : null;
  if (after) clone.append(after);
  return clone;
}

async function embedImages(root: Element): Promise<void> {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute('src');
    if (!source || source.startsWith('data:')) return;
    try {
      image.setAttribute('src', await imageUrlToDataUrl(new URL(source, window.location.href).href));
    } catch {
      image.removeAttribute('src');
    }
  }));
  const svgImages = [...root.querySelectorAll('image')];
  await Promise.all(svgImages.map(async (image) => {
    const source = image.getAttribute('href') ?? image.getAttribute('xlink:href');
    if (!source || source.startsWith('data:')) return;
    try {
      image.setAttribute('href', await imageUrlToDataUrl(new URL(source, window.location.href).href));
    } catch {
      image.removeAttribute('href');
    }
  }));
}

/** Embed every font file referenced by url(...) in a @font-face stylesheet. */
export async function embedFontFaceCss(css: string): Promise<string> {
  const urls = [...new Set([...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)].map((match) => match[2]!))].filter((url) => !url.startsWith('data:'));
  let embedded = css;
  for (const url of urls) {
    try {
      const response = await fetch(new URL(url, window.location.href).href);
      if (!response.ok) continue;
      const data = await blobToDataUrl(await response.blob());
      embedded = embedded.split(url).join(data);
    } catch {
      // A missing face falls back like the page itself would.
    }
  }
  return embedded;
}

/** Serialise a styled clone of `node` into a standalone SVG at width × height. */
export async function domToSvg(node: HTMLElement, { fontFaceCss = '', height, width }: DomRasterOptions): Promise<string> {
  const clone = cloneWithStyles(node) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = '0';
  await embedImages(clone);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.setAttribute('style', `width:${width}px;height:${height}px;overflow:hidden;`);
  wrapper.append(clone);
  const markup = new XMLSerializer().serializeToString(wrapper);
  const style = fontFaceCss ? `<style>${fontFaceCss.replaceAll(']]>', '')}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${style}</defs><foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject></svg>`;
}

/**
 * Render `node` to a PNG Blob of width × height × pixelRatio pixels. The SVG is
 * loaded from a data: URL: Chromium keeps a foreignObject image origin-clean
 * only then, so the canvas can be exported (a blob: URL taints it).
 */
export async function domToPngBlob(node: HTMLElement, options: DomRasterOptions): Promise<Blob> {
  await document.fonts?.ready;
  const svg = await domToSvg(node, options);
  const image = new Image();
  image.decoding = 'sync';
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const raster = resolveSvgRasterDimensions(options.width, options.height, options.pixelRatio ?? 1);
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, raster.width, raster.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new DOMException('The PNG could not be encoded.'))), 'image/png');
  });
}
