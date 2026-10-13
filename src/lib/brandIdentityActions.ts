import type {
  BrandAsset,
  BrandFontAsset,
  BrandIdentity,
  BrandTypography,
} from './brandIdentity';
import { brandFontAssets } from './brandIdentity';
import {
  BRAND_KIT_FILE_NAMES,
  brandKitFiles,
  brandKitSlug,
  brandKitTextFile,
  brandKitZip,
  brandLogoFiles,
  type BrandKitFileLoader,
  type BrandKitFormat,
} from './brandKit';
import {
  applyBrandIdentitySource,
  BRAND_LOGO_SLOTS,
  BrandSourceValidationError,
  validateBrandIdentitySource,
  type BrandLogoSlot,
  type BrandSourceIssue,
  type BrandSourceRemoval,
} from './brandSource';
import { blobToDataUrl } from './download';
import { readEmbeddedImageFile } from './imageAssets';
import { createStoredZip } from './zipStore';

/**
 * Framework-independent implementations of the Brand identity Browser API
 * actions. The Studio component owns state; these functions validate input and
 * return the next identity, so UI uploads and agent calls share one path.
 */

export const MAX_BRAND_FONT_BYTES = 2_500_000;

const ASSET_TYPES: readonly BrandAsset['type'][] = ['background', 'icon', 'image', 'logo', 'motion', 'product', 'proof', 'reference', 'texture'];
const REDISTRIBUTION = ['bundled', 'original', 'research-only', 'url-only'] as const;
const ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

type Input = Record<string, unknown>;

function inputRecord(input: unknown, action: string, example: string): Input {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${action} requires an object such as ${example}.`);
  }
  return input as Input;
}

function optionalString(input: Input, key: string, action: string, maxLength = 600): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new TypeError(`${action} ${key} must be a string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalNumber(input: Input, key: string, action: string, minimum: number, maximum: number): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${action} ${key} must be a number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function optionalEnum<T extends string>(input: Input, key: string, values: readonly T[], action: string): T | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new TypeError(`${action} ${key} must be one of ${values.join(', ')}; received ${JSON.stringify(value)}.`);
  }
  return value as T;
}

function requireFile(input: Input, action: string): File {
  const file = input.file;
  if (typeof File === 'undefined' || !(file instanceof File)) {
    throw new TypeError(`${action} requires file: a File built from the bytes you are authorized to use, such as new File([bytes], 'logo.svg', { type: 'image/svg+xml' }). Filesystem paths and URLs are not accepted.`);
  }
  if (!file.size) throw new TypeError(`${action} received an empty file.`);
  return file;
}

function assertValid(patch: unknown): BrandSourceIssue[] {
  const result = validateBrandIdentitySource(patch, 'patch');
  if (!result.ok) throw new BrandSourceValidationError(result.issues);
  return result.issues;
}

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function replaceById<T extends { id: string }>(items: readonly T[], next: T): T[] {
  const index = items.findIndex(({ id }) => id === next.id);
  return index < 0 ? [...items, next] : items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

export type BrandAssetAddResult = { asset: BrandAsset; identity: BrandIdentity };

function optionalTags(input: Input, action: string): string[] | undefined {
  const tags = input.tags;
  if (tags !== undefined && (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string'))) {
    throw new TypeError(`${action} tags must be an array of strings.`);
  }
  return tags as string[] | undefined;
}

function withoutEmpty<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== '')) as T;
}

function assetFromInput(identity: BrandIdentity, input: Input, path: string, fallbackName: string): BrandAsset {
  const action = 'identity.asset.add';
  const slot = optionalEnum(input, 'slot', BRAND_LOGO_SLOTS.map(({ id }) => id) as BrandLogoSlot[], action);
  const slotRecord = BRAND_LOGO_SLOTS.find(({ id }) => id === slot);
  const type = optionalEnum(input, 'type', ASSET_TYPES, action) ?? (slot ? 'logo' : 'image');
  const label = optionalString(input, 'label', action, 200)
    || (slotRecord ? `${identity.name} ${slotRecord.label.toLocaleLowerCase()}` : fallbackName);
  const usage = optionalString(input, 'usage', action)
    || (slotRecord ? `${slotRecord.label} in every Glyphfield application.` : 'Reusable brand artwork');
  return withoutEmpty({
    alt: optionalString(input, 'alt', action, 400) || label,
    id: optionalString(input, 'id', action, 120) || slot || newId('asset'),
    label,
    license: optionalString(input, 'license', action, 400),
    path,
    redistribution: optionalEnum(input, 'redistribution', REDISTRIBUTION, action) ?? 'original',
    sourceOwner: optionalString(input, 'sourceOwner', action, 200),
    sourceUrl: optionalString(input, 'sourceUrl', action, 2_000),
    surface: optionalEnum(input, 'surface', ['light', 'dark', 'any'] as const, action) ?? slotRecord?.surface ?? 'any',
    tags: optionalTags(input, action) ?? [type],
    type,
    usage,
  });
}

/** Add or replace an image asset from a File. A logo `slot` replaces that slot in place. */
export async function addBrandAssetFromFile(identity: BrandIdentity, rawInput: unknown): Promise<BrandAssetAddResult> {
  const action = 'identity.asset.add';
  const input = inputRecord(rawInput, action, "{ file, slot: 'mark-dark' }");
  const file = requireFile(input, action);
  // Validate every option before decoding the file so bad input fails fast.
  assetFromInput(identity, input, '/', file.name);
  const image = await readEmbeddedImageFile(file);
  const asset = assetFromInput(identity, input, image.source, image.name);
  const collection = asset.type === 'proof' ? 'proofAssets' : 'assets';
  assertValid({ [collection]: [asset] });
  const other = collection === 'assets' ? identity.proofAssets : identity.assets;
  if (other.some(({ id }) => id === asset.id)) {
    throw new TypeError(`${action} id "${asset.id}" is already used in ${collection === 'assets' ? 'proofAssets' : 'assets'}; choose another id.`);
  }
  return { asset, identity: { ...identity, [collection]: replaceById(identity[collection], asset) } };
}

/** Detect a font container from its first bytes rather than trusting the file name. */
export function detectFontFormat(bytes: Uint8Array): BrandFontAsset['format'] | null {
  const signature = String.fromCharCode(...bytes.slice(0, 4));
  if (signature === 'wOF2') return 'woff2';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'OTTO') return 'opentype';
  if (signature === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'truetype';
  return null;
}

const WEIGHT_WORDS: readonly [RegExp, number][] = [
  [/extra[-_ ]?light|ultra[-_ ]?light/i, 200],
  [/semi[-_ ]?bold|demi[-_ ]?bold/i, 600],
  [/extra[-_ ]?bold|ultra[-_ ]?bold/i, 800],
  [/thin|hairline/i, 100],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/black|heavy/i, 900],
  [/book/i, 350],
];

export function familyFromFontFileName(fileName: string): string {
  return fileName
    .replace(/\.(otf|ttf|woff2?)$/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(variable|vf|regular|book|thin|hairline|extra ?light|ultra ?light|light|medium|semi ?bold|demi ?bold|extra ?bold|ultra ?bold|bold|black|heavy|italic|oblique)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Uploaded font';
}

function weightFromFileName(fileName: string): number {
  return WEIGHT_WORDS.find(([pattern]) => pattern.test(fileName))?.[1] ?? 400;
}

export type BrandFontAddResult = { font: BrandFontAsset; identity: BrandIdentity };

function fontExtension(format: BrandFontAsset['format']): string {
  if (format === 'opentype') return 'otf';
  if (format === 'truetype') return 'ttf';
  return format;
}

function fontWeights(input: Input, fileName: string): Pick<BrandFontAsset, 'weight' | 'weightMax' | 'weightMin'> {
  const action = 'identity.font.add';
  const variable = /variable|\[wght/i.test(fileName);
  const weightMin = optionalNumber(input, 'weightMin', action, 1, 1000) ?? (variable ? 100 : undefined);
  const weightMax = optionalNumber(input, 'weightMax', action, 1, 1000) ?? (variable ? 900 : undefined);
  const weight = optionalNumber(input, 'weight', action, 1, 1000) ?? (variable ? 400 : weightFromFileName(fileName));
  return weightMin !== undefined && weightMax !== undefined ? { weight, weightMax, weightMin } : { weight };
}

function fontRoles(input: Input): Set<BrandTypography['role']> {
  const roles = input.roles;
  if (roles !== undefined && (!Array.isArray(roles) || !roles.every((role) => ROLES.includes(role as BrandTypography['role'])))) {
    throw new TypeError(`identity.font.add roles must be an array of ${ROLES.join(', ')}.`);
  }
  return new Set((roles as BrandTypography['role'][] | undefined) ?? []);
}

function assignFontRoles(identity: BrandIdentity, font: BrandFontAsset, assigned: ReadonlySet<BrandTypography['role']>): BrandTypography[] {
  const typography = ROLES.flatMap((role) => {
    const current = identity.typography.find((candidate) => candidate.role === role);
    if (!assigned.has(role)) return current ? [current] : [];
    return [{ ...(current ?? { role, usage: `${role} typography` }), family: font.family, fontId: font.id }];
  });
  return [...typography, ...identity.typography.filter(({ role }) => !ROLES.includes(role))];
}

/** Store a font file with the identity and optionally assign it to typography roles. */
export async function addBrandFontFromFile(identity: BrandIdentity, rawInput: unknown): Promise<BrandFontAddResult> {
  const action = 'identity.font.add';
  const input = inputRecord(rawInput, action, "{ file, roles: ['Display'] }");
  const file = requireFile(input, action);
  if (file.size > MAX_BRAND_FONT_BYTES) {
    throw new TypeError(`${action}: keep font files under 2.5 MB so the identity stays portable; subset to Latin woff2 first.`);
  }
  const roles = fontRoles(input);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFontFormat(bytes);
  if (!format) throw new TypeError(`${action}: ${file.name || 'this file'} is not a TTF, OTF, WOFF or WOFF2 font.`);
  const family = optionalString(input, 'family', action, 80) || familyFromFontFileName(file.name);
  const font: BrandFontAsset = withoutEmpty({
    family,
    fileName: file.name || `${family}.${fontExtension(format)}`,
    format,
    id: optionalString(input, 'id', action, 120) || newId('font'),
    label: optionalString(input, 'label', action, 120) || family,
    license: optionalString(input, 'license', action, 400),
    path: await blobToDataUrl(new Blob([bytes], { type: `font/${fontExtension(format)}` })),
    sourceUrl: optionalString(input, 'sourceUrl', action, 2_000),
    style: optionalEnum(input, 'style', ['italic', 'normal'] as const, action) ?? (/italic|oblique/i.test(file.name) ? 'italic' : 'normal'),
    ...fontWeights(input, file.name),
  });
  assertValid({ fonts: [font] });
  return {
    font,
    identity: { ...identity, fonts: replaceById(brandFontAssets(identity), font), typography: assignFontRoles(identity, font, roles) },
  };
}

export type BrandApplyInput = {
  identity: unknown;
  mode?: 'merge' | 'replace';
  remove?: BrandSourceRemoval;
  replace?: readonly string[];
  save?: boolean;
};

export function parseBrandApplyInput(rawInput: unknown): BrandApplyInput {
  const input = inputRecord(rawInput, 'identity.apply', "{ identity: { tagline: 'Fast, careful tools.' } }");
  if (input.identity === undefined) {
    throw new TypeError('identity.apply requires { identity: patch }. Wrap the fields you want to change in an identity object.');
  }
  const unknown = Object.keys(input).filter((key) => !['identity', 'mode', 'remove', 'replace', 'save'].includes(key));
  if (unknown.length) throw new TypeError(`identity.apply does not accept ${unknown.join(', ')}; use identity, mode, remove, replace and save.`);
  return {
    identity: input.identity,
    mode: optionalEnum(input, 'mode', ['merge', 'replace'] as const, 'identity.apply'),
    remove: input.remove as BrandSourceRemoval | undefined,
    replace: input.replace as readonly string[] | undefined,
    save: input.save === true,
  };
}

export function applyBrandIdentityInput(current: BrandIdentity, input: BrandApplyInput) {
  return applyBrandIdentitySource(current, input.identity, { mode: input.mode, remove: input.remove, replace: input.replace });
}

export type BrandKitArtifact = {
  blob: Blob;
  fileName: string;
  previewText?: string;
};

/** Fetch a same-origin public file for the kit. */
export const fetchBrandKitFile: BrandKitFileLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not read ${path} for the brand kit (HTTP ${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

function bytesBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

export async function createBrandKitArtifact(
  identity: BrandIdentity,
  format: BrandKitFormat,
  load: BrandKitFileLoader = fetchBrandKitFile
): Promise<BrandKitArtifact> {
  const slug = brandKitSlug(identity);
  if (format === 'zip') {
    const zip = brandKitZip(identity, await brandKitFiles(identity, load));
    return { blob: bytesBlob(zip, 'application/zip'), fileName: `${slug}-brand-kit.zip` };
  }
  if (format === 'logos') {
    const files = await brandLogoFiles(identity, load);
    if (!files.length) throw new RangeError(`${identity.name} has no logo assets to export.`);
    const zip = createStoredZip(files.map((file) => ({ bytes: file.bytes, name: `${slug}-${file.name}` })));
    return { blob: bytesBlob(zip, 'application/zip'), fileName: `${slug}-logos.zip` };
  }
  const file = brandKitTextFile(identity, format);
  const previewText = new TextDecoder().decode(file.bytes);
  const fileName = format === 'markdown'
    ? 'brand.md'
    : `${slug}-${BRAND_KIT_FILE_NAMES[format].split('/').pop()}`;
  return { blob: bytesBlob(file.bytes, file.mimeType), fileName, previewText };
}
