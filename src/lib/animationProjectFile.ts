import { animationStateFromCanvasDocument } from './animationDocument';
import { isAnimationArtboardSnapshot } from './animationArtboards';
import { brandFontAssets, type BrandIdentity } from './brandIdentity';
import {
  asCanvasJsonObject, createEmbeddedCanvasAsset, parseCanvasDocument,
  preparePortableCanvasDocument, serializeCanvasDocument, toCanvasJsonObject,
  type CanvasDocument, type CanvasJsonObject,
} from './canvasDocument';
import {
  canvasProjectIdentity, DESIGN_LAB_PROJECT_FILE_MAX_BYTES,
  namespaceDesignLabProjectIdentity, type DesignLabProjectFile,
} from './designLabProjectFile';
import { imageUrlToDataUrl } from './download';
import type { PortableAssetLoader } from './portableCanvasAssets';
import { isShaderFrameAssetSource, resolveShaderFrameAssetSource } from './shaderFrameAssets';

export const animationProjectIdentity = (input: CanvasDocument | string) => canvasProjectIdentity(input, 'animation');
export const namespaceAnimationProjectIdentity = namespaceDesignLabProjectIdentity;

function validateSize(size: number): void {
  if (!size) throw new TypeError('The project file is empty.');
  if (size > DESIGN_LAB_PROJECT_FILE_MAX_BYTES) throw new RangeError('The project file exceeds the 128 MB limit.');
}

function validateSettings(value: unknown, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  const settings = value as Record<string, unknown>;
  for (const key of ['width', 'height']) {
    const number = settings[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
      throw new TypeError(`${label} ${key} must be a positive finite number.`);
    }
  }
  for (const key of ['holdMs', 'transitionMs']) {
    const number = settings[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || (key === 'holdMs' && number === 0)) {
      throw new TypeError(`${label} ${key} must be ${key === 'holdMs' ? 'positive' : 'non-negative'} and finite.`);
    }
  }
}

function validateSnapshot(value: CanvasJsonObject, label: string): void {
  if (!isAnimationArtboardSnapshot(value)) {
    throw new TypeError(`${label} must contain complete animation settings, frame backgrounds and timing curves.`);
  }
  validateSettings(value.settings, `${label} settings`);
  if (new Set(value.sequenceOrder).size !== value.sequenceOrder.length) {
    throw new TypeError(`${label} frame order must contain unique ids.`);
  }
}

function validateArtboards(state: CanvasJsonObject): void {
  if (state.artboards !== undefined) {
    if (!Array.isArray(state.artboards) || !state.artboards.length) throw new TypeError('Animation artboards must be a non-empty array.');
    const ids = new Set<string>();
    for (const value of state.artboards) {
      const board = asCanvasJsonObject(value);
      const snapshot = asCanvasJsonObject(board?.snapshot);
      if (!board || typeof board.id !== 'string' || !board.id.startsWith('animation-artboard-') || ids.has(board.id)
        || typeof board.name !== 'string' || !snapshot) throw new TypeError('Animation artboards require unique ids, names and snapshots.');
      ids.add(board.id);
      validateSnapshot(snapshot, 'Artboard');
    }
    if (typeof state.activeArtboardId !== 'string' || !ids.has(state.activeArtboardId)) {
      throw new TypeError('The active animation artboard is missing.');
    }
  }
}

function validateState(document: CanvasDocument): CanvasJsonObject {
  animationStateFromCanvasDocument(document);
  const state = asCanvasJsonObject(document.metadata.animation)!;
  if (typeof state.mode !== 'string' || !['sequence', 'text', 'images'].includes(state.mode)) throw new TypeError('Invalid animation mode.');
  if (typeof state.playbackRate !== 'number' || !Number.isFinite(state.playbackRate)
    || state.playbackRate <= 0 || state.playbackRate > 4) throw new TypeError('Invalid animation playback rate.');
  if (typeof state.textFrames !== 'string' || typeof state.includeBrandLogo !== 'boolean') {
    throw new TypeError('Animation text and brand-mark settings are missing.');
  }
  validateSnapshot(state, 'Animation');
  validateArtboards(state);
  return state;
}

function assertEmbedded(source: string, kind: 'image' | 'binary', name: string): void {
  const asset = createEmbeddedCanvasAsset({ id: name, name, kind, source });
  if (!asset.byteLength || (kind === 'image' && !asset.mimeType.startsWith('image/'))) {
    throw new TypeError(`${name} must contain embedded ${kind === 'image' ? 'image' : 'asset'} bytes.`);
  }
  const encoded = /^data:[^,]*;base64,([\s\S]*)$/i.exec(source)?.[1];
  if (encoded !== undefined) {
    try { atob(encoded.replace(/\s/g, '')); }
    catch { throw new TypeError(`${name} contains invalid base64 data.`); }
  }
}

/** Audio may live in an inactive artboard as well as the central asset registry. */
function inlineAudioAssets(state: CanvasJsonObject): CanvasJsonObject[] {
  const snapshots = Array.isArray(state.artboards)
    ? state.artboards.map((board) => asCanvasJsonObject(asCanvasJsonObject(board)?.snapshot)) : [];
  return [state, ...snapshots].flatMap((owner) => {
    const audio = asCanvasJsonObject(owner?.audio);
    if (!audio) return [];
    if (!Array.isArray(audio.assets)) throw new TypeError('Animation audio assets must be an array.');
    return audio.assets.map((entry) => {
      const asset = asCanvasJsonObject(entry);
      if (!asset) throw new TypeError('Animation audio asset must be an object.');
      return asset;
    });
  });
}

function assertPortable(document: CanvasDocument): void {
  const state = validateState(document);
  animationProjectIdentity(document);
  for (const asset of Object.values(document.assets)) assertEmbedded(asset.source, asset.kind === 'image' ? 'image' : 'binary', asset.name);
  for (const asset of inlineAudioAssets(state)) {
    const registered = typeof asset.assetId === 'string' ? document.assets[asset.assetId] : undefined;
    const source = registered?.source ?? asset.source;
    if (typeof source !== 'string') throw new TypeError('Animation audio is missing its embedded source.');
    assertEmbedded(source, 'binary', String(asset.name ?? 'Audio'));
  }
  serializeCanvasDocument(document);
}

/** Validates the model before the host decodes images or changes workspace state. */
export function validateAnimationProjectDocument(document: CanvasDocument): void {
  validateState(document);
  animationProjectIdentity(document);
}

/** Same CanvasDocument schema as source/versions; no second project-file format. */
export async function prepareAnimationProjectFile(
  document: CanvasDocument,
  fileName = document.title,
  resolveAsset: PortableAssetLoader = (source) => isShaderFrameAssetSource(source)
    ? resolveShaderFrameAssetSource(source) : imageUrlToDataUrl(source),
  identity?: BrandIdentity,
): Promise<DesignLabProjectFile> {
  const input = parseCanvasDocument(JSON.stringify(document));
  const state = validateState(input);
  const pending = new Map<string, Promise<string>>();
  const resolve: PortableAssetLoader = (source) => {
    if (/^data:/i.test(source)) return Promise.resolve(source);
    const cached = pending.get(source);
    if (cached) return cached;
    const promise = resolveAsset(source);
    pending.set(source, promise);
    return promise;
  };
  if (identity) {
    if (identity.id !== input.brandId) throw new TypeError('Project identity does not match the document brand.');
    const fonts = await Promise.all(brandFontAssets(identity).map(async (font) => ({ ...font, path: await resolve(font.path) })));
    state.identity = toCanvasJsonObject({ id: identity.id, name: identity.name, fonts, typography: identity.typography });
  }
  await Promise.all(inlineAudioAssets(state).map(async (asset) => {
    if (typeof asset.source === 'string') asset.source = await resolve(asset.source);
  }));
  const portable = await preparePortableCanvasDocument(input, resolve);
  assertPortable(portable);
  const blob = new Blob([serializeCanvasDocument(portable)], { type: 'application/json' });
  validateSize(blob.size);
  const printable = Array.from(fileName, (character) => {
    const code = character.codePointAt(0)!;
    return code < 32 || code === 127 ? '-' : character;
  }).join('');
  const base = printable.replace(/\.glyphfield\.json$|\.json$/i, '')
    .replace(/[<>:"/\\|?*]/g, '-').replace(/[.\s]+$/g, '').trim() || 'animation';
  return {
    blob, fileName: `${base}.glyphfield.json`, format: 'JSON', previewKind: 'file',
    description: 'Editable Animation Studio project with artboards, timing, embedded images, audio and brand fonts.',
  };
}

/** Opening validates embedded bytes only; it never fetches URLs supplied by a file. */
export async function readAnimationProjectFile(file: Pick<Blob, 'size' | 'text'>): Promise<string> {
  validateSize(file.size);
  const source = await file.text();
  validateSize(new Blob([source]).size);
  const document = parseCanvasDocument(source);
  assertPortable(document);
  return serializeCanvasDocument(document);
}
