import {
  asCanvasJsonObject,
  createEmbeddedCanvasAsset,
  parseCanvasDocument,
  preparePortableCanvasDocument,
  serializeCanvasDocument,
  toCanvasJsonObject,
  type CanvasDocument,
  type CanvasJsonObject,
} from './canvasDocument';
import { designLabSourceFromCanvasDocument } from './designLabDocument';
import { imageUrlToDataUrl } from './download';
import { isShaderFrameAssetSource, resolveShaderFrameAssetSource } from './shaderFrameAssets';
import type { PortableAssetLoader } from './portableCanvasAssets';
import { brandFontAssets, type BrandFontAsset, type BrandIdentity, type BrandTypography } from './brandIdentity';

import { STUDIO_PROJECT_FILE_MAX_BYTES as DESIGN_LAB_PROJECT_FILE_MAX_BYTES, type StudioProjectFile } from './projectFile';
export { STUDIO_PROJECT_FILE_ACCEPT as DESIGN_LAB_PROJECT_FILE_ACCEPT, STUDIO_PROJECT_FILE_MAX_BYTES as DESIGN_LAB_PROJECT_FILE_MAX_BYTES } from './projectFile';
const PROJECT_FONT_FORMATS = new Set<unknown>(['opentype', 'truetype', 'woff', 'woff2']);
const PROJECT_FONT_STYLES = new Set<unknown>(['normal', 'italic']);

export type DesignLabProjectFile = StudioProjectFile;

export type DesignLabProjectIdentity = {
  id: string;
  name: string;
  fonts: BrandFontAsset[];
  typography: BrandTypography[];
};

function identityString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Project identity ${label} must be a non-empty string.`);
  return value;
}

function validateBase64Data(source: string, name: string): void {
  const encoded = /^data:[^,]*;base64,([\s\S]*)$/i.exec(source)?.[1];
  if (encoded !== undefined) {
    try { atob(encoded.replace(/\s/g, '')); }
    catch { throw new TypeError(`${name} contains invalid base64 data.`); }
  }
}

function validateProjectFont(value: unknown): asserts value is BrandFontAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Project font must be an object.');
  const font = value as Record<string, unknown>;
  for (const key of ['id', 'family', 'fileName', 'label', 'path']) identityString(font[key], `font ${key}`);
  if (!PROJECT_FONT_FORMATS.has(font.format) || !PROJECT_FONT_STYLES.has(font.style)) throw new TypeError('Project font format or style is invalid.');
  for (const key of ['weight', 'weightMin', 'weightMax']) {
    if (font[key] === undefined && key !== 'weight') continue;
    if (typeof font[key] !== 'number' || !Number.isFinite(font[key]) || font[key] < 1 || font[key] > 1000) {
      throw new TypeError('Project font weights must be finite numbers from 1 to 1000.');
    }
  }
  if ((font.weightMin === undefined) !== (font.weightMax === undefined)
    || Number(font.weightMin ?? 1) > Number(font.weightMax ?? 1000)) throw new TypeError('Project font weight range is invalid.');
  const asset = createEmbeddedCanvasAsset({ id: String(font.id), kind: 'font', name: String(font.label), source: String(font.path) });
  if (asset.byteLength === 0 || !/^(font\/|application\/(?:octet-stream|(?:x-)?font-|vnd\.ms-fontobject))/i.test(asset.mimeType)) {
    throw new TypeError(`Project font ${font.label} must contain embedded font bytes.`);
  }
  validateBase64Data(asset.source, `Project font ${font.label}`);
}

function validateProjectTypography(value: unknown, fonts: readonly BrandFontAsset[]): asserts value is BrandTypography {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Project typography must be an object.');
  const typography = value as Record<string, unknown>;
  identityString(typography.family, 'typography family');
  if (typeof typography.usage !== 'string' || typeof typography.role !== 'string'
    || !['Display', 'Body', 'Accent', 'Code'].includes(typography.role)) {
    throw new TypeError('Project typography usage or role is invalid.');
  }
  if (typography.fontId !== undefined) identityString(typography.fontId, 'typography fontId');
  for (const key of ['weight', 'lineHeight', 'letterSpacing']) {
    if (typography[key] !== undefined && (typeof typography[key] !== 'number' || !Number.isFinite(typography[key]))) {
      throw new TypeError(`Project typography ${key} must be finite.`);
    }
  }
  if (!fonts.some((font) => typography.fontId ? font.id === typography.fontId : font.family === typography.family)) {
    throw new TypeError(`The ${typography.role} font is not embedded. Add its font file before sharing this project.`);
  }
}

/** Rendering-only identity snapshot; importing it must not overwrite another brand. */
export function designLabProjectIdentity(input: CanvasDocument | string): DesignLabProjectIdentity | null {
  return canvasProjectIdentity(input, 'designLab');
}

/** Shared rendering-identity validator for portable Studio project files. */
export function canvasProjectIdentity(input: CanvasDocument | string, metadataKey: string): DesignLabProjectIdentity | null {
  const document = typeof input === 'string' ? parseCanvasDocument(input) : input;
  const value = asCanvasJsonObject(document.metadata[metadataKey])?.identity;
  if (value === undefined) return null;
  const identity = asCanvasJsonObject(value);
  if (!identity) throw new TypeError('Project identity must be an object.');
  const id = identityString(identity.id, 'id');
  const name = identityString(identity.name, 'name');
  if (id !== document.brandId) throw new TypeError('Project identity does not match the document brand.');
  if (!Array.isArray(identity.fonts) || identity.fonts.length === 0 || !Array.isArray(identity.typography) || identity.typography.length === 0) {
    throw new TypeError('Project identity requires fonts and typography.');
  }
  const fonts = identity.fonts as unknown[];
  fonts.forEach(validateProjectFont);
  const validFonts = fonts as BrandFontAsset[];
  if (new Set(validFonts.map(({ id }) => id)).size !== fonts.length) throw new TypeError('Project font ids must be unique.');
  const typography = identity.typography as unknown[];
  typography.forEach((entry) => validateProjectTypography(entry, validFonts));
  return structuredClone({ id, name, fonts: validFonts, typography: typography as BrandTypography[] });
}

/** Private CSS families prevent imported font faces from changing other open tools. */
export function namespaceDesignLabProjectIdentity(
  identity: DesignLabProjectIdentity,
  workspaceId: string
): DesignLabProjectIdentity {
  identityString(workspaceId, 'workspace id');
  const namespace = Array.from(workspaceId, (character) => character.codePointAt(0)!.toString(16)).join('-');
  const family = (value: string) => `Glyphfield Project ${namespace}:: ${value.replace(/^Glyphfield Project [\da-f]+(?:-[\da-f]+)*:: /, '')}`;
  return {
    ...structuredClone(identity),
    id: workspaceId,
    fonts: identity.fonts.map((font) => ({ ...font, family: family(font.family) })),
    typography: identity.typography.map((typography) => ({
      ...typography,
      family: family(identity.fonts.find((font) => font.id === typography.fontId)?.family ?? typography.family),
    })),
  };
}

function projectArtboards(document: CanvasDocument): CanvasJsonObject[] {
  designLabSourceFromCanvasDocument(document);
  const metadata = asCanvasJsonObject(document.metadata.designLab)!;
  const workspace = asCanvasJsonObject(metadata.workspace);
  if (workspace?.artboards === undefined) return [];
  if (!Array.isArray(workspace.artboards) || workspace.artboards.length === 0) {
    throw new TypeError('The project artboards must be a non-empty array.');
  }
  const ids = new Set<string>();
  const artboards = workspace.artboards.map((value) => {
    const artboard = asCanvasJsonObject(value);
    if (!artboard || typeof artboard.id !== 'string' || !artboard.id || ids.has(artboard.id)
      || !asCanvasJsonObject(artboard.snapshot)) {
      throw new TypeError('Each project artboard needs a unique id and a snapshot.');
    }
    ids.add(artboard.id);
    return artboard;
  });
  if (typeof workspace.activeArtboardId !== 'string' || !ids.has(workspace.activeArtboardId)) {
    throw new TypeError('The active project artboard is missing.');
  }
  return artboards;
}

function projectImageLayers(artboards: readonly CanvasJsonObject[]): CanvasJsonObject[] {
  return artboards.flatMap((artboard) => {
    const snapshot = asCanvasJsonObject(artboard.snapshot)!;
    return ['assets', 'logos'].flatMap((key) => {
      const layers = snapshot[key];
      if (layers === undefined) return [];
      if (!Array.isArray(layers)) throw new TypeError(`Artboard ${artboard.id} ${key} must be an array.`);
      return layers.map((value) => {
        const layer = asCanvasJsonObject(value);
        if (!layer || typeof layer.url !== 'string' || !layer.url) {
          throw new TypeError(`Artboard ${artboard.id} contains an image without a source.`);
        }
        return layer;
      });
    });
  });
}

function assertEmbeddedImage(source: string, name: string): void {
  const asset = createEmbeddedCanvasAsset({ id: name, kind: 'image', name, source });
  if (!asset.mimeType.startsWith('image/') || asset.byteLength === 0) {
    throw new TypeError(`${name} must contain a non-empty embedded image.`);
  }
  validateBase64Data(source, name);
}

function assertProjectImages(document: CanvasDocument, layers: readonly CanvasJsonObject[]): void {
  for (const asset of Object.values(document.assets)) {
    if (asset.kind === 'image') assertEmbeddedImage(asset.source, asset.name || asset.id);
  }
  for (const layer of layers) assertEmbeddedImage(layer.url as string, String(layer.name ?? layer.id ?? 'Artboard image'));
  // Validate the adapter's resolved sources, not only registered assets. A
  // layer can omit assetId, and data.layerType controls Design Lab dispatch.
  const composition = asCanvasJsonObject(designLabSourceFromCanvasDocument(document).composition)!;
  for (const key of ['assets', 'logos']) {
    const activeLayers = composition[key];
    if (!Array.isArray(activeLayers)) throw new TypeError(`Active artboard ${key} must be an array.`);
    for (const value of activeLayers) {
      const layer = asCanvasJsonObject(value);
      if (!layer || typeof layer.url !== 'string') throw new TypeError('Active artboard contains an image without a source.');
      assertEmbeddedImage(layer.url, String(layer.name ?? layer.id ?? 'Active artboard image'));
    }
  }
}

function synchronizeImageSources(document: CanvasDocument): void {
  for (const element of Object.values(document.elements)) {
    if ((element.kind === 'image' || element.kind === 'logo') && element.assetId && document.assets[element.assetId]) {
      element.data.url = document.assets[element.assetId]!.source;
    }
  }
}

function validateProjectSize(size: number): void {
  if (size === 0) throw new TypeError('The project file is empty.');
  if (size > DESIGN_LAB_PROJECT_FILE_MAX_BYTES) throw new RangeError('The project file exceeds the 128 MB limit.');
}

function projectFileName(name: string): string {
  const printable = Array.from(name).filter((character) => {
    const code = character.codePointAt(0)!;
    return code >= 32 && code !== 127;
  }).join('');
  const base = printable.replace(/\.glyphfield\.json$|\.json$/i, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[.\s]+$/g, '').trim();
  return `${base || 'design-lab'}.glyphfield.json`;
}

/**
 * Packages the existing CanvasDocument, not a second project-file schema.
 * The host captures current shader frames before calling this boundary.
 */
export async function prepareDesignLabProjectFile(
  document: CanvasDocument,
  fileName = document.title,
  resolveAsset: PortableAssetLoader = (source) => isShaderFrameAssetSource(source)
    ? resolveShaderFrameAssetSource(source)
    : imageUrlToDataUrl(source),
  identity?: BrandIdentity
): Promise<DesignLabProjectFile> {
  const input = parseCanvasDocument(JSON.stringify(document));
  const artboards = projectArtboards(input);
  const imageLayers = projectImageLayers(artboards);
  const pending = new Map<string, Promise<string>>();
  const resolve: PortableAssetLoader = (source) => {
    if (/^data:/i.test(source)) return Promise.resolve(source);
    const current = pending.get(source);
    if (current) return current;
    const next = resolveAsset(source);
    pending.set(source, next);
    return next;
  };
  if (identity) {
    if (identity.id !== input.brandId) throw new TypeError('Project identity does not match the document brand.');
    const fonts = await Promise.all(brandFontAssets(identity).map(async (font) => ({ ...font, path: await resolve(font.path) })));
    const metadata = asCanvasJsonObject(input.metadata.designLab)!;
    metadata.identity = toCanvasJsonObject({ id: identity.id, name: identity.name, fonts, typography: identity.typography });
  }
  designLabProjectIdentity(input);
  // Inactive artboards retain their editable layers in metadata, so their
  // local image URLs are not necessarily registered in document.assets.
  await Promise.all(imageLayers.map(async (layer) => {
    const source = await resolve(layer.url as string);
    assertEmbeddedImage(source, String(layer.name ?? layer.id ?? 'Artboard image'));
    layer.url = source;
  }));
  const portable = await preparePortableCanvasDocument(input, resolve);
  assertProjectImages(portable, imageLayers);
  synchronizeImageSources(portable);
  const source = serializeCanvasDocument(portable);
  const blob = new Blob([source], { type: 'application/json' });
  validateProjectSize(blob.size);
  const count = artboards.length || 1;
  return {
    blob,
    description: `Editable Design Lab project with ${count} artboard${count === 1 ? '' : 's'}, embedded assets, saved shader frames${identity ? ', and brand fonts' : ''}. Reopen it with Open project file in Design Lab.`,
    fileName: projectFileName(fileName),
    format: 'JSON',
    previewKind: 'file',
  };
}

/** Validates bytes locally; opening a project never fetches URLs from its JSON. */
export async function readDesignLabProjectFile(file: Pick<Blob, 'size' | 'text'>): Promise<string> {
  validateProjectSize(file.size);
  const source = await file.text();
  validateProjectSize(new Blob([source]).size);
  const document = parseCanvasDocument(source);
  designLabProjectIdentity(document);
  const imageLayers = projectImageLayers(projectArtboards(document));
  assertProjectImages(document, imageLayers);
  synchronizeImageSources(document);
  return serializeCanvasDocument(document);
}
