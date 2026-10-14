import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypeScale,
  type BrandTypography,
} from './brandIdentity';
import {
  BRAND_ROLE_TYPE_STEP,
  BRAND_TYPE_STEPS,
  brandRoleTypeStep,
  brandTypeScale,
  DEFAULT_BRAND_TYPE_SCALE,
  type BrandTypeScaleStep,
} from './brandTokens';
import { parseSourceObject, sourceNumber, sourceObject, sourceObjectArray, sourceString } from './sourceCode';

/**
 * The type system behind one identity, without React or DOM: named modular
 * ratios, role sizes on the scale, leading/tracking/measure guidance, and the
 * Typography tool's source format (version 2, still reading version 1).
 */

export const TYPE_ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

export const TYPE_SCALE_RATIOS = [
  { label: 'Minor second', value: 1.067 },
  { label: 'Major second', value: 1.125 },
  { label: 'Minor third', value: 1.2 },
  { label: 'Major third', value: 1.25 },
  { label: 'Perfect fourth', value: 1.333 },
  { label: 'Augmented fourth', value: 1.414 },
  { label: 'Perfect fifth', value: 1.5 },
  { label: 'Golden ratio', value: 1.618 },
] as const;

export const TYPE_SCALE_LIMITS = { basePx: { max: 24, min: 10 }, ratio: { max: 1.8, min: 1.067 } } as const;

export function typeScaleRatioName(ratio: number): string | null {
  return TYPE_SCALE_RATIOS.find(({ value }) => Math.abs(value - ratio) < 0.0015)?.label ?? null;
}

export function resolvedTypeScale(identity: Pick<BrandIdentity, 'typeScale'>): BrandTypeScale {
  return identity.typeScale ?? { ...DEFAULT_BRAND_TYPE_SCALE };
}

export function clampTypeScale(scale: BrandTypeScale): BrandTypeScale {
  const basePx = Math.round(Math.min(TYPE_SCALE_LIMITS.basePx.max, Math.max(TYPE_SCALE_LIMITS.basePx.min, scale.basePx)) * 100) / 100;
  const ratio = Math.round(Math.min(TYPE_SCALE_LIMITS.ratio.max, Math.max(TYPE_SCALE_LIMITS.ratio.min, scale.ratio)) * 1000) / 1000;
  const roleSteps = Object.fromEntries(Object.entries(scale.roleSteps ?? {}).filter(([role, step]) => (
    TYPE_ROLES.includes(role as BrandTypography['role'])
      && BRAND_TYPE_STEPS.some(({ name }) => name === step)
      && step !== BRAND_ROLE_TYPE_STEP[role as BrandTypography['role']]
  )));
  return { basePx, ratio, ...(Object.keys(roleSteps).length ? { roleSteps } : {}) };
}

/** The scale step a role is set at, with its size. */
export function roleTypeStep(identity: Pick<BrandIdentity, 'typeScale'>, role: BrandTypography['role']): BrandTypeScaleStep {
  const name = brandRoleTypeStep(identity, role);
  const scale = brandTypeScale(identity);
  return scale.find((step) => step.name === name) ?? scale.find((step) => step.name === 'body')!;
}

// ── Guidance ────────────────────────────────────────────────────────────────

export type TypeGuidance = {
  id: string;
  message: string;
  role?: BrandTypography['role'];
  severity: 'info' | 'warning';
};

export const MEASURE_LIMITS = { ideal: [45, 75], max: 90, min: 30 } as const;

/** Tracking in em for a role at its scale size. */
export function trackingEm(letterSpacingPx: number, sizePx: number): number {
  return sizePx > 0 ? letterSpacingPx / sizePx : 0;
}

/** Kevin's type spacing rule: about −0.01 to −0.025em on large display sizes, 0 for text. */
export const DISPLAY_TRACKING_EM = { loosest: -0.005, recommended: -0.02, tightest: -0.035 } as const;
export const TEXT_TRACKING_TOLERANCE_EM = 0.01;
export const DISPLAY_SIZE_PX = 28;

function displayRoleGuidance(role: BrandTypography['role'], size: number, lineHeight: number, tracking: number): TypeGuidance[] {
  const output: TypeGuidance[] = [];
  if (lineHeight > 1.25) output.push({ id: `${role}-leading-loose`, message: `${role} leading ${lineHeight} is loose at ${Math.round(size)}px; 0.95–1.15 keeps wrapped lines together.`, role, severity: 'warning' });
  if (lineHeight < 0.85) output.push({ id: `${role}-leading-tight`, message: `${role} leading ${lineHeight} can make ascenders and descenders collide; stay at 0.88 or above.`, role, severity: 'warning' });
  if (tracking > 0) output.push({ id: `${role}-tracking-positive`, message: `${role} tracking is +${tracking.toFixed(3)}em; large lowercase type is never tracked out. Use −0.01 to −0.025em.`, role, severity: 'warning' });
  else if (tracking > DISPLAY_TRACKING_EM.loosest) output.push({ id: `${role}-tracking-loose`, message: `${role} tracking ${tracking.toFixed(3)}em at ${Math.round(size)}px reads loose; large type tightens slightly, to −0.01 to −0.025em.`, role, severity: 'info' });
  if (tracking < DISPLAY_TRACKING_EM.tightest) output.push({ id: `${role}-tracking-tight`, message: `${role} tracking ${tracking.toFixed(3)}em is tight enough for letters to touch; stay above −0.03em.`, role, severity: 'warning' });
  return output;
}

function textRoleGuidance(role: BrandTypography['role'], size: number, lineHeight: number, tracking: number): TypeGuidance[] {
  const output: TypeGuidance[] = [];
  if (lineHeight < 1.35) output.push({ id: `${role}-leading-tight`, message: `${role} leading ${lineHeight} is tight for ${Math.round(size)}px text; use 1.4–1.7 for paragraphs.`, role, severity: 'warning' });
  if (lineHeight > 1.8) output.push({ id: `${role}-leading-loose`, message: `${role} leading ${lineHeight} separates lines too far; use 1.4–1.7.`, role, severity: 'warning' });
  if (Math.abs(tracking) > TEXT_TRACKING_TOLERANCE_EM) output.push({ id: `${role}-tracking`, message: `${role} tracking ${tracking >= 0 ? '+' : ''}${tracking.toFixed(3)}em changes word shapes at text sizes; text sizes use 0.`, role, severity: 'warning' });
  return output;
}

/** The tracking the spacing rule recommends for a role at its scale size, in px (0.1px steps). */
export function recommendedLetterSpacing(identity: BrandIdentity, role: BrandTypography['role']): number {
  const size = roleTypeStep(identity, role).px;
  if (size < DISPLAY_SIZE_PX || role === 'Code') return 0;
  return Math.round(DISPLAY_TRACKING_EM.recommended * size * 10) / 10;
}

/** Roles whose tracking falls outside the spacing rule. */
export function rolesOffTracking(identity: BrandIdentity): BrandTypography['role'][] {
  return TYPE_ROLES.filter((role) => {
    const size = roleTypeStep(identity, role).px;
    const tracking = trackingEm(brandTypographyRole(identity, role).letterSpacing ?? 0, size);
    if (size < DISPLAY_SIZE_PX || role === 'Code') return Math.abs(tracking) > TEXT_TRACKING_TOLERANCE_EM;
    return tracking > DISPLAY_TRACKING_EM.loosest || tracking < DISPLAY_TRACKING_EM.tightest;
  });
}

function roleGuidance(identity: BrandIdentity, role: BrandTypography['role']): TypeGuidance[] {
  const typography = brandTypographyRole(identity, role);
  const size = roleTypeStep(identity, role).px;
  const lineHeight = typography.lineHeight ?? 1.5;
  const tracking = trackingEm(typography.letterSpacing ?? 0, size);
  const output = size >= DISPLAY_SIZE_PX && role !== 'Code' ? displayRoleGuidance(role, size, lineHeight, tracking) : textRoleGuidance(role, size, lineHeight, tracking);
  if (role === 'Code' && tracking < -0.005) output.push({ id: 'Code-tracking-negative', message: 'Monospaced code should not be tightened; columns stop lining up.', role, severity: 'warning' });
  if (role === 'Body' && (typography.weight ?? 400) < 300) output.push({ id: 'Body-weight-thin', message: `Body weight ${typography.weight} loses contrast at ${Math.round(size)}px; use 350 or more.`, role, severity: 'warning' });
  return output;
}

function scaleGuidance(identity: BrandIdentity, measureCh: number | undefined): TypeGuidance[] {
  const output: TypeGuidance[] = [];
  const scale = resolvedTypeScale(identity);
  if (scale.basePx < 14) output.push({ id: 'base-small', message: `A ${scale.basePx}px base is small for screen reading; 16px is the common default.`, severity: 'warning' });
  if (scale.ratio < 1.125) output.push({ id: 'ratio-flat', message: `Ratio ${scale.ratio} gives a flat hierarchy; 1.2–1.333 separates headings clearly.`, severity: 'info' });
  if (scale.ratio > 1.5) output.push({ id: 'ratio-steep', message: `Ratio ${scale.ratio} makes the top steps very large; check display sizes on narrow screens.`, severity: 'info' });
  if (roleTypeStep(identity, 'Display').px < roleTypeStep(identity, 'Body').px * 1.5) output.push({ id: 'display-small', message: 'Display is less than 1.5× the body size, so headlines will not lead the page.', role: 'Display', severity: 'warning' });
  if (typeof measureCh !== 'number') return output;
  const [low, high] = MEASURE_LIMITS.ideal;
  if (measureCh < low) output.push({ id: 'measure-short', message: `${Math.round(measureCh)} characters per line is short; 45–75 reads comfortably.`, role: 'Body', severity: 'warning' });
  if (measureCh > high) output.push({ id: 'measure-long', message: `${Math.round(measureCh)} characters per line is long; eyes lose the next line past 75.`, role: 'Body', severity: 'warning' });
  return output;
}

/**
 * Leading, tracking, measure, size and weight checks for every role at its scale size.
 * `measureCh` is the body measure in characters per line when known.
 */
export function typographyGuidance(identity: BrandIdentity, options: { measureCh?: number } = {}): TypeGuidance[] {
  return [...TYPE_ROLES.flatMap((role) => roleGuidance(identity, role)), ...scaleGuidance(identity, options.measureCh)];
}

// ── Fonts ───────────────────────────────────────────────────────────────────

export type RoleFont = {
  asset: BrandFontAsset | undefined;
  family: string;
  /** Font files of the role's family, normal style first. */
  files: BrandFontAsset[];
  role: BrandTypography['role'];
};

export function roleFonts(identity: BrandIdentity): RoleFont[] {
  const fonts = brandFontAssets(identity);
  return TYPE_ROLES.map((role) => {
    const typography = brandTypographyRole(identity, role);
    const family = brandTypographyFamily(identity, role);
    const files = fonts.filter((font) => font.family === family).sort((first, second) => (first.style === second.style ? first.weight - second.weight : first.style === 'normal' ? -1 : 1));
    return { asset: fonts.find((font) => font.id === typography.fontId) ?? files[0], family, files, role };
  });
}

/** Unique font files used by any role, in role order. */
export function usedFontFiles(identity: BrandIdentity): BrandFontAsset[] {
  const seen = new Set<string>();
  return roleFonts(identity).flatMap(({ files }) => files).filter((font) => (seen.has(font.id) ? false : (seen.add(font.id), true)));
}


// ── Source ──────────────────────────────────────────────────────────────────

export const TYPOGRAPHY_SOURCE_VERSION = 2;

export type TypographySpecimenSettings = {
  align: 'left' | 'center';
  measure: number;
  previewSizes: Record<BrandTypography['role'], number>;
  sampleText: string;
};

export function typographySource(identity: BrandIdentity, specimen: TypographySpecimenSettings): Record<string, unknown> {
  return {
    version: TYPOGRAPHY_SOURCE_VERSION,
    typography: identity.typography,
    typeScale: resolvedTypeScale(identity),
    specimen,
  };
}

function optionalNumber(value: Record<string, unknown>, key: string, minimum: number, maximum: number, path: string): number | undefined | null {
  if (!(key in value) || value[key] === null) return value[key] === null ? null : undefined;
  const number = value[key];
  if (typeof number !== 'number' || !Number.isFinite(number)) throw new TypeError(`${path}.${key} must be a number.`);
  if (number < minimum || number > maximum) throw new RangeError(`${path}.${key} must be between ${minimum} and ${maximum}.`);
  return number;
}

/**
 * Apply Typography source. Version 1 (`{ typography }`) and version 2 (`typography`,
 * `typeScale`, `specimen`) both merge roles by `role`; unknown role fields are kept.
 * `opticalSize: null` or `slant: null` clears an axis.
 */
export function applyTypographySource(
  identity: BrandIdentity,
  specimen: TypographySpecimenSettings,
  source: string | Record<string, unknown>
): { identity: BrandIdentity; specimen: TypographySpecimenSettings } {
  const value = typeof source === 'string' ? parseSourceObject(source) : source;
  const roles = sourceObjectArray(value, 'typography');
  if (!roles) throw new TypeError('typography must be an array of typography roles.');
  const typography = identity.typography.map((current) => {
    const next = roles.find((item) => sourceString(item, 'role', '') === current.role);
    if (!next) return current;
    const path = `typography[${current.role}]`;
    const opticalSize = optionalNumber(next, 'opticalSize', 6, 144, path);
    const slant = optionalNumber(next, 'slant', -20, 20, path);
    const merged: BrandTypography = {
      ...current,
      family: sourceString(next, 'family', current.family),
      fontId: sourceString(next, 'fontId', current.fontId ?? '') || undefined,
      letterSpacing: sourceNumber(next, 'letterSpacing', current.letterSpacing ?? 0),
      lineHeight: sourceNumber(next, 'lineHeight', current.lineHeight ?? 1.2),
      usage: sourceString(next, 'usage', current.usage),
      weight: sourceNumber(next, 'weight', current.weight ?? 400),
    };
    if (opticalSize === null) delete merged.opticalSize;
    else if (opticalSize !== undefined) merged.opticalSize = opticalSize;
    if (slant === null) delete merged.slant;
    else if (slant !== undefined) merged.slant = slant;
    return merged;
  });
  let nextIdentity: BrandIdentity = { ...identity, typography };
  const scaleSource = sourceObject(value, 'typeScale');
  if (scaleSource) {
    const current = resolvedTypeScale(identity);
    const roleSteps = sourceObject(scaleSource, 'roleSteps');
    for (const [role, step] of Object.entries(roleSteps ?? {})) {
      if (!TYPE_ROLES.includes(role as BrandTypography['role'])) throw new RangeError(`typeScale.roleSteps.${role} is not a typography role.`);
      if (typeof step !== 'string' || !BRAND_TYPE_STEPS.some(({ name }) => name === step)) {
        throw new RangeError(`typeScale.roleSteps.${role} must be one of ${BRAND_TYPE_STEPS.map(({ name }) => name).join(', ')}.`);
      }
    }
    const basePx = sourceNumber(scaleSource, 'basePx', current.basePx);
    const ratio = sourceNumber(scaleSource, 'ratio', current.ratio);
    if (basePx < TYPE_SCALE_LIMITS.basePx.min || basePx > TYPE_SCALE_LIMITS.basePx.max) throw new RangeError(`typeScale.basePx must be between ${TYPE_SCALE_LIMITS.basePx.min} and ${TYPE_SCALE_LIMITS.basePx.max}.`);
    if (ratio < TYPE_SCALE_LIMITS.ratio.min || ratio > TYPE_SCALE_LIMITS.ratio.max) throw new RangeError(`typeScale.ratio must be between ${TYPE_SCALE_LIMITS.ratio.min} and ${TYPE_SCALE_LIMITS.ratio.max}.`);
    nextIdentity = { ...nextIdentity, typeScale: clampTypeScale({ basePx, ratio, roleSteps: (roleSteps ?? current.roleSteps) as BrandTypeScale['roleSteps'] }) };
  }
  const specimenSource = sourceObject(value, 'specimen');
  let nextSpecimen = specimen;
  if (specimenSource) {
    const sizes = sourceObject(specimenSource, 'previewSizes') ?? {};
    const align = sourceString(specimenSource, 'align', specimen.align);
    if (align !== 'left' && align !== 'center') throw new RangeError('specimen.align must be left or center.');
    nextSpecimen = {
      align,
      measure: Math.round(Math.min(MEASURE_LIMITS.max, Math.max(MEASURE_LIMITS.min, sourceNumber(specimenSource, 'measure', specimen.measure)))),
      previewSizes: Object.fromEntries(TYPE_ROLES.map((role) => [role, sourceNumber(sizes, role, specimen.previewSizes[role])])) as TypographySpecimenSettings['previewSizes'],
      sampleText: sourceString(specimenSource, 'sampleText', specimen.sampleText),
    };
  }
  return { identity: nextIdentity, specimen: nextSpecimen };
}
