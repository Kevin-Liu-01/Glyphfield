import {
  brandFontAssets,
  createBrandIdentity,
  type BrandColorPairing,
  type BrandIdentity,
  type BrandTypography,
} from './brandIdentity';
import { colorContrastRatio, hexToOklch, normalizeHex, oklchToHex } from './color';
import { BRAND_LOGO_SLOTS } from './brandSource';

/**
 * Brand health: a completeness score plus concrete findings for one identity.
 * Every finding carries a copyable prompt for the user's coding agent, and the
 * deterministic ones also carry a one-click fix applied by applyBrandHealthFix.
 */
export const BRAND_HEALTH_SCHEMA_VERSION = 1;

export type BrandHealthSectionId =
  | 'essentials'
  | 'strategy'
  | 'voice'
  | 'logos'
  | 'color'
  | 'typography'
  | 'graphic'
  | 'imagery'
  | 'products'
  | 'applications'
  | 'naming';

export type BrandHealthSeverity = 'error' | 'warning' | 'info';

export type BrandHealthFinding = {
  agentPrompt: string;
  detail: string;
  fix?: { id: string; label: string };
  id: string;
  section: BrandHealthSectionId;
  severity: BrandHealthSeverity;
  title: string;
};

export type BrandContrastResult = {
  background: string;
  backgroundHex: string;
  foreground: string;
  foregroundHex: string;
  level: 'AA' | 'AA-large';
  passes: boolean;
  ratio: number;
  required: number;
  usage: string;
};

export type BrandHealthSection = {
  checks: number;
  id: BrandHealthSectionId;
  label: string;
  passed: number;
  score: number;
  summary: string;
};

export type BrandHealthReport = {
  contrast: BrandContrastResult[];
  counts: Record<BrandHealthSeverity, number>;
  findings: BrandHealthFinding[];
  grade: 'Strong' | 'Good' | 'Needs work' | 'Incomplete';
  identityId: string;
  name: string;
  schemaVersion: typeof BRAND_HEALTH_SCHEMA_VERSION;
  score: number;
  sections: BrandHealthSection[];
};

const SECTIONS: readonly { id: BrandHealthSectionId; label: string; weight: number }[] = [
  { id: 'essentials', label: 'Essentials', weight: 10 },
  { id: 'strategy', label: 'Strategy', weight: 12 },
  { id: 'voice', label: 'Voice', weight: 10 },
  { id: 'logos', label: 'Logos', weight: 14 },
  { id: 'color', label: 'Color', weight: 14 },
  { id: 'typography', label: 'Typography', weight: 12 },
  { id: 'graphic', label: 'Graphic device', weight: 8 },
  { id: 'imagery', label: 'Imagery', weight: 6 },
  { id: 'products', label: 'Products & proof', weight: 6 },
  { id: 'applications', label: 'Applications', weight: 4 },
  { id: 'naming', label: 'Naming & data', weight: 4 },
];

const SEVERITY_WEIGHT: Record<BrandHealthSeverity, number> = { error: 3, info: 1, warning: 2 };
const STORAGE_WARNING_CHARACTERS = 3_500_000;
const TYPOGRAPHY_ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

type Check = {
  detail: string;
  fix?: { id: string; label: string };
  hint: string;
  id: string;
  passed: boolean;
  section: BrandHealthSectionId;
  severity: BrandHealthSeverity;
  title: string;
};

let placeholderText: Set<string> | null = null;

/** Guidance strings a new scratch identity starts with; they are not real content. */
function placeholders(): Set<string> {
  if (placeholderText) return placeholderText;
  const scratch = createBrandIdentity('Placeholder', 'placeholder');
  const values = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === 'string') values.add(value.trim());
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit([scratch.tagline, scratch.positioning, scratch.mission, scratch.description, scratch.strategy, scratch.graphicSystem, scratch.dossier]);
  placeholderText = values;
  return values;
}

function filled(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 && !placeholders().has(trimmed);
}

function filledList(values: readonly string[] | undefined): number {
  return (values ?? []).filter((value) => filled(value)).length;
}

function colorHex(identity: BrandIdentity, id: string): string | undefined {
  const hex = identity.colors.find((color) => color.id === id)?.hex;
  try {
    return hex ? normalizeHex(hex) : undefined;
  } catch {
    return undefined;
  }
}

/** The pairs the identity declares, or ink/paper and accent pairs when none are declared. */
export function brandColorPairings(identity: BrandIdentity): BrandColorPairing[] {
  if (identity.colorPairings?.length) return identity.colorPairings;
  const pairs: BrandColorPairing[] = [];
  const has = (id: string) => Boolean(colorHex(identity, id));
  if (has('ink') && has('paper')) pairs.push({ background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body text' });
  if (has('ink') && has('muted')) pairs.push({ background: 'muted', foreground: 'ink', level: 'AA', usage: 'Text on quiet surfaces' });
  if (has('emphasis') && has('ink') && has('paper')) {
    const accent = colorHex(identity, 'emphasis')!;
    const foreground = colorContrastRatio(accent, colorHex(identity, 'ink')!) >= colorContrastRatio(accent, colorHex(identity, 'paper')!) ? 'ink' : 'paper';
    pairs.push({ background: 'emphasis', foreground, level: 'AA-large', usage: 'Labels on the accent' });
  }
  return pairs;
}

export function brandContrastResults(identity: BrandIdentity): BrandContrastResult[] {
  return brandColorPairings(identity).flatMap((pairing) => {
    const foregroundHex = colorHex(identity, pairing.foreground);
    const backgroundHex = colorHex(identity, pairing.background);
    if (!foregroundHex || !backgroundHex) return [];
    const level = pairing.level ?? 'AA';
    const required = level === 'AA' ? 4.5 : 3;
    const ratio = Math.round(colorContrastRatio(foregroundHex, backgroundHex) * 100) / 100;
    return [{ ...pairing, backgroundHex, foregroundHex, level, passes: ratio >= required, ratio, required }];
  });
}

function essentialsChecks(identity: BrandIdentity): Check[] {
  const field = (id: string, label: string, value: string, severity: BrandHealthSeverity, hint: string): Check => ({
    detail: filled(value) ? `${label} is set.` : `${label} is empty or still holds the starter guidance text.`,
    hint,
    id: `essentials-${id}`,
    passed: filled(value),
    section: 'essentials',
    severity,
    title: `Write the ${label.toLocaleLowerCase()}`,
  });
  return [
    field('name', 'Brand name', identity.name === 'Untitled brand' ? '' : identity.name, 'error', 'Set name to the brand name exactly as the brand writes it.'),
    field('tagline', 'Tagline', identity.tagline, 'warning', 'Set tagline to the line the brand already uses on its homepage or in its README. Do not invent a slogan.'),
    field('positioning', 'Positioning', identity.positioning, 'warning', 'Write positioning as one sentence: what the brand is, for whom, and the difference it makes, using the brand\'s own description.'),
    field('mission', 'Mission', identity.mission, 'warning', 'Write mission from the brand\'s about page or company description.'),
    field('description', 'Description', identity.description, 'info', 'Write a two-sentence description of the identity system itself.'),
    field('website', 'Website', identity.website, 'info', 'Set website to the brand\'s primary domain, such as acme.com.'),
  ];
}

function strategyChecks(identity: BrandIdentity): Check[] {
  const { strategy } = identity;
  const field = (id: keyof typeof strategy, label: string): Check => {
    const value = strategy[id];
    const passed = typeof value === 'string' && filled(value);
    return {
      detail: passed ? `${label} is defined.` : `${label} is empty or placeholder text.`,
      hint: `Write strategy.${id} (${label.toLocaleLowerCase()}) from the brand's own materials in one or two sentences.`,
      id: `strategy-${id}`,
      passed,
      section: 'strategy',
      severity: 'warning',
      title: `Define the ${label.toLocaleLowerCase()}`,
    };
  };
  const pillars = filledList(strategy.pillars);
  const personality = filledList(strategy.personality);
  return [
    field('challenge', 'Challenge'),
    field('concept', 'Central idea'),
    field('promise', 'Promise'),
    field('outcome', 'Outcome'),
    {
      detail: `${pillars} strategic ${pillars === 1 ? 'pillar' : 'pillars'} defined; three to five keep the strategy usable.`,
      hint: 'Set strategy.pillars to three to five short, distinct pillars that the brand\'s products and copy actually demonstrate.',
      id: 'strategy-pillars',
      passed: pillars >= 3,
      section: 'strategy',
      severity: 'warning',
      title: 'Name three or more pillars',
    },
    {
      detail: `${personality} personality ${personality === 1 ? 'trait' : 'traits'} defined.`,
      hint: 'Set strategy.personality to three or four specific traits (one or two words each) that guide writing and design.',
      id: 'strategy-personality',
      passed: personality >= 3,
      section: 'strategy',
      severity: 'info',
      title: 'Describe the personality',
    },
  ];
}

function voiceChecks(identity: BrandIdentity): Check[] {
  const { voice } = identity;
  const examples = (voice.examples ?? []).filter((example) => filled(example.write) && filled(example.context)).length;
  const count = (id: string, label: string, value: number, minimum: number, hint: string, severity: BrandHealthSeverity = 'warning'): Check => ({
    detail: `${value} ${label} defined; aim for at least ${minimum}.`,
    hint,
    id: `voice-${id}`,
    passed: value >= minimum,
    section: 'voice',
    severity,
    title: `Add ${label}`,
  });
  return [
    count('principles', 'voice principles', filledList(voice.principles), 3, 'Set voice.principles to three or four short principles that describe how the brand writes.'),
    count('examples', 'voice examples', examples, 3, 'Add voice.examples: at least three { context, write, avoid } pairs taken from real places the brand writes (homepage hero, error message, release note, onboarding email). "write" is on-brand, "avoid" is the off-brand version.'),
    count('phrases', 'approved phrases', filledList(voice.phrases), 2, 'Set voice.phrases to lines the brand already uses publicly.'),
    count('avoid', 'words or habits to avoid', filledList(voice.avoid), 2, 'Set voice.avoid to the language the brand avoids, such as hype words or jargon it never uses.'),
  ];
}

function logoChecks(identity: BrandIdentity): Check[] {
  return BRAND_LOGO_SLOTS.flatMap((slot): Check[] => {
    const asset = identity.assets.find(({ id }) => id === slot.id);
    const generated = Boolean(asset?.label.startsWith('Generated pixel mark'));
    const checks: Check[] = [{
      detail: !asset
        ? `No ${slot.label.toLocaleLowerCase()} (asset id ${slot.id}).`
        : generated
          ? `${slot.label} is the generated pixel placeholder, not the brand's own mark.`
          : `${slot.label} is ${asset.label}.`,
      hint: `Find the brand's official ${slot.label.toLocaleLowerCase()} (prefer SVG) in its website, repository or design files and add it with identity.asset.add { file, slot: '${slot.id}' }.`,
      id: `logo-${slot.id}`,
      passed: Boolean(asset) && !generated,
      section: 'logos',
      severity: slot.required ? (asset ? 'warning' : 'error') : 'info',
      title: generated ? `Replace the placeholder ${slot.label.toLocaleLowerCase()}` : `Add the ${slot.label.toLocaleLowerCase()}`,
    }];
    if (asset && slot.surface !== 'any' && asset.surface !== slot.surface && asset.surface !== 'any') {
      checks.push({
        detail: `${slot.id} is marked for ${asset.surface} surfaces but this slot is for ${slot.surface} surfaces.`,
        fix: { id: 'logo-surfaces', label: 'Match logo surfaces to their slots' },
        hint: `Set the ${slot.id} asset's surface to "${slot.surface}", or move the file to the slot that matches its colors.`,
        id: `logo-surface-${slot.id}`,
        passed: false,
        section: 'logos',
        severity: 'warning',
        title: `Correct the ${slot.id} surface`,
      });
    }
    return checks;
  });
}

function colorChecks(identity: BrandIdentity, contrast: readonly BrandContrastResult[]): Check[] {
  const checks: Check[] = ['ink', 'paper', 'emphasis'].map((id) => ({
    detail: colorHex(identity, id) ? `The ${id} role is defined.` : `No color has the id "${id}"; Glyphfield tools read it for ${id === 'ink' ? 'text and marks' : id === 'paper' ? 'backgrounds' : 'the accent'}.`,
    hint: `Add a color with id "${id}" (${id === 'ink' ? 'primary text' : id === 'paper' ? 'primary background' : 'the brand accent'}) taken from the brand's CSS or design tokens.`,
    id: `color-role-${id}`,
    passed: Boolean(colorHex(identity, id)),
    section: 'color' as const,
    severity: 'error' as const,
    title: `Define the ${id} color`,
  }));
  for (const pair of contrast) {
    checks.push({
      detail: `${pair.foreground} on ${pair.background} (${pair.usage}) is ${pair.ratio.toFixed(2)}:1; WCAG ${pair.level} needs ${pair.required}:1.`,
      fix: pair.passes ? undefined : { id: `contrast:${pair.foreground}:${pair.background}`, label: `Adjust ${pair.foreground} to ${pair.required}:1` },
      hint: `Adjust ${pair.foreground} (${pair.foregroundHex}) or ${pair.background} (${pair.backgroundHex}) so the pair reaches ${pair.required}:1, keeping the hue the brand uses. If the brand's own palette already has a darker or lighter step, use it.`,
      id: `contrast-${pair.foreground}-${pair.background}`,
      passed: pair.passes,
      section: 'color',
      severity: 'error',
      title: `Fix ${pair.foreground} on ${pair.background} contrast`,
    });
  }
  const shares = identity.colors.filter((color) => typeof color.proportion === 'number');
  const total = shares.reduce((sum, color) => sum + (color.proportion ?? 0), 0);
  const dominant = Math.max(0, ...shares.map((color) => color.proportion ?? 0));
  const accent = identity.colors.find(({ id }) => id === 'emphasis')?.proportion;
  checks.push({
    detail: shares.length === 0
      ? 'No color has a proportion, so layouts cannot tell the dominant field from the accent.'
      : `Proportions add up to ${total}%, the dominant color covers ${dominant}%, and the accent covers ${accent ?? 0}%.`,
    fix: { id: 'proportions', label: 'Apply 60 / 30 / 10' },
    hint: 'Set colors[].proportion (percent of visual space) so they add up to about 100: one dominant field around 60, a secondary around 30, and the accent at 10 or less.',
    id: 'color-proportion',
    passed: shares.length > 0 && total >= 90 && total <= 110 && dominant >= 45 && (accent ?? 0) <= 20,
    section: 'color',
    severity: shares.length === 0 ? 'info' : 'warning',
    title: shares.length === 0 ? 'Set palette proportions' : 'Rebalance palette proportions',
  });
  const defaults = createBrandIdentity('Placeholder', 'placeholder').colors.map(({ hex }) => hex).join();
  checks.push({
    detail: 'The palette is still the neutral default copied into new projects.',
    hint: 'Replace colors with the brand\'s own palette from its CSS custom properties, Tailwind config or design tokens, keeping the ids ink, paper, muted and emphasis for their roles.',
    id: 'color-default-palette',
    passed: identity.colors.map(({ hex }) => hex).join() !== defaults || identity.builtIn,
    section: 'color',
    severity: 'warning',
    title: 'Replace the default palette',
  });
  return checks;
}

function typographyChecks(identity: BrandIdentity): Check[] {
  const fonts = brandFontAssets(identity);
  const fontIds = new Set(fonts.map(({ id }) => id));
  const checks: Check[] = TYPOGRAPHY_ROLES.map((role) => {
    const typography = identity.typography.find((candidate) => candidate.role === role);
    const bound = Boolean(typography?.fontId && fontIds.has(typography.fontId));
    const familyStored = Boolean(typography && fonts.some(({ family }) => family === typography.family));
    return {
      detail: !typography
        ? `No ${role} role; tools fall back to the first role.`
        : bound
          ? `${role} renders with ${typography.family}.`
          : `${role} names ${typography.family} but no stored font file renders it.`,
      fix: typography && !bound && familyStored ? { id: 'font-bindings', label: 'Bind roles to stored fonts' } : undefined,
      hint: `Add the font file that renders the ${role} role with identity.font.add { file, roles: ['${role}'] }; use the brand's licensed files (woff2 preferred) from its repository or design files.`,
      id: `type-role-${role.toLocaleLowerCase()}`,
      passed: bound,
      section: 'typography' as const,
      severity: role === 'Display' || role === 'Body' ? 'error' as const : 'warning' as const,
      title: typography ? `Store a font file for ${role}` : `Define the ${role} role`,
    };
  });
  const usedFontIds = new Set(identity.typography.map(({ fontId }) => fontId));
  for (const font of fonts.filter(({ id }) => usedFontIds.has(id))) {
    if (font.license?.trim()) continue;
    const uploaded = font.path.startsWith('data:');
    checks.push({
      detail: uploaded
        ? `${font.label} was uploaded without license terms; exports and agents cannot tell whether it may be redistributed.`
        : `${font.label} has no license recorded on the identity.`,
      hint: `Record the license for ${font.label} on fonts[id="${font.id}"].license (for example "OFL-1.1" or the foundry license name) and its sourceUrl.`,
      id: `type-license-${font.id}`,
      passed: false,
      section: 'typography',
      severity: uploaded ? 'warning' : 'info',
      title: `Record the ${font.family} license`,
    });
  }
  const scale = identity.typeScale;
  checks.push({
    detail: scale
      ? `Type scale is ${scale.basePx}px × ${scale.ratio}.`
      : 'No modular type scale; sizes drift between layouts.',
    fix: scale ? undefined : { id: 'type-scale', label: 'Use a 1.25 scale' },
    hint: 'Set typeScale { basePx, ratio } from the brand\'s CSS (its body size and the ratio between heading sizes). Use a ratio of at least 1.2.',
    id: 'type-scale',
    passed: Boolean(scale && scale.ratio >= 1.2),
    section: 'typography',
    severity: scale ? 'warning' : 'info',
    title: scale ? 'Increase the type scale ratio' : 'Set a type scale',
  });
  const body = identity.typography.find(({ role }) => role === 'Body');
  checks.push({
    detail: `Body line height is ${body?.lineHeight ?? 'unset'}; reading text needs 1.4 or more.`,
    fix: { id: 'body-leading', label: 'Set body line height to 1.5' },
    hint: 'Set the Body role lineHeight between 1.4 and 1.7.',
    id: 'type-body-leading',
    passed: (body?.lineHeight ?? 1.5) >= 1.35,
    section: 'typography',
    severity: 'warning',
    title: 'Open up body leading',
  });
  return checks;
}

function graphicChecks(identity: BrandIdentity): Check[] {
  const { graphicSystem } = identity;
  return [
    {
      detail: filled(graphicSystem.device) ? `The device is ${graphicSystem.device}.` : 'No recognizable graphic device is named.',
      hint: 'Name graphicSystem.device: the one recognizable visual move the brand repeats (a shape, crop, line, frame or motion), and describe it in graphicSystem.description.',
      id: 'graphic-device',
      passed: filled(graphicSystem.device),
      section: 'graphic',
      severity: 'warning',
      title: 'Name the graphic device',
    },
    {
      detail: filled(graphicSystem.description) ? 'The device has a rationale.' : 'The device has no rationale.',
      hint: 'Write graphicSystem.description: why the device exists and what it says about the brand.',
      id: 'graphic-description',
      passed: filled(graphicSystem.description),
      section: 'graphic',
      severity: 'warning',
      title: 'Explain the graphic device',
    },
    {
      detail: `${filledList(graphicSystem.rules)} system rules defined.`,
      hint: 'Set graphicSystem.rules to three to six rules that keep applications consistent, such as "One accent block per composition".',
      id: 'graphic-rules',
      passed: filledList(graphicSystem.rules) >= 3,
      section: 'graphic',
      severity: 'warning',
      title: 'Write three or more system rules',
    },
  ];
}

function imageryChecks(identity: BrandIdentity): Check[] {
  const visuals = [...identity.assets, ...identity.proofAssets].filter(({ type }) => type !== 'logo' && type !== 'proof');
  const missingAlt = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.alt?.trim());
  return [
    {
      detail: filled(identity.graphicSystem.imageDirection) ? 'Image direction is written.' : 'No image direction.',
      hint: 'Write graphicSystem.imageDirection: subjects, crops, color treatment and what to avoid, based on the imagery the brand already publishes.',
      id: 'imagery-direction',
      passed: filled(identity.graphicSystem.imageDirection),
      section: 'imagery',
      severity: 'warning',
      title: 'Write the image direction',
    },
    {
      detail: `${visuals.length} non-logo visual ${visuals.length === 1 ? 'asset' : 'assets'} in the library.`,
      hint: 'Add two or more of the brand\'s own images, textures or product screenshots with identity.asset.add, each with type, usage, alt and sourceUrl.',
      id: 'imagery-assets',
      passed: visuals.length >= 2,
      section: 'imagery',
      severity: 'info',
      title: 'Add brand imagery',
    },
    {
      detail: missingAlt.length ? `${missingAlt.length} ${missingAlt.length === 1 ? 'asset has' : 'assets have'} no alt text.` : 'Every asset has alt text.',
      fix: missingAlt.length ? { id: 'alt-text', label: 'Use labels as alt text' } : undefined,
      hint: 'Write alt text for every asset that describes what it shows.',
      id: 'imagery-alt-text',
      passed: missingAlt.length === 0,
      section: 'imagery',
      severity: 'warning',
      title: 'Add alt text',
    },
  ];
}

function productChecks(identity: BrandIdentity): Check[] {
  return [
    {
      detail: `${filledList(identity.products)} products listed.`,
      hint: 'Set products to the brand\'s actual product or service names from its website navigation.',
      id: 'products-list',
      passed: filledList(identity.products) >= 1,
      section: 'products',
      severity: 'warning',
      title: 'List the products',
    },
    {
      detail: `${filledList(identity.audiences)} audiences defined.`,
      hint: 'Set audiences to the two to four groups the brand addresses.',
      id: 'products-audiences',
      passed: filledList(identity.audiences) >= 1,
      section: 'products',
      severity: 'warning',
      title: 'Name the audiences',
    },
    {
      detail: `${filledList(identity.proof)} proof points.`,
      hint: 'Set proof to verifiable proof points the brand publishes (customer names, published metrics) with the source in sourceNotes. Never invent numbers.',
      id: 'products-proof',
      passed: filledList(identity.proof) >= 1,
      section: 'products',
      severity: 'info',
      title: 'Add verifiable proof',
    },
  ];
}

function applicationChecks(identity: BrandIdentity): Check[] {
  return [{
    detail: `${identity.applications.length} applications defined.`,
    hint: 'Add applications for the places the brand really appears (website, product UI, docs, social, email, deck, event), each with a format and intent.',
    id: 'applications-range',
    passed: identity.applications.length >= 3,
    section: 'applications',
    severity: 'warning',
    title: 'Define three or more applications',
  }];
}

function namingChecks(identity: BrandIdentity): Check[] {
  const names = identity.colors.map(({ name }) => name.trim().toLocaleLowerCase());
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  const size = JSON.stringify(identity).length;
  return [
    {
      detail: duplicateNames.length ? `Color names repeat: ${[...new Set(duplicateNames)].join(', ')}.` : 'Color names are distinct.',
      hint: 'Give every color a distinct name that says what it is, such as "Signal lime" or "Night".',
      id: 'naming-color-names',
      passed: duplicateNames.length === 0,
      section: 'naming',
      severity: 'warning',
      title: 'Use distinct color names',
    },
    {
      detail: identity.socialHandle && !identity.socialHandle.startsWith('@')
        ? `Social handle "${identity.socialHandle}" does not start with @.`
        : 'Social handle format is consistent.',
      fix: identity.socialHandle && !identity.socialHandle.startsWith('@') ? { id: 'social-handle', label: 'Prefix the handle with @' } : undefined,
      hint: 'Set socialHandle to the brand\'s handle starting with @.',
      id: 'naming-social-handle',
      passed: !identity.socialHandle || identity.socialHandle.startsWith('@'),
      section: 'naming',
      severity: 'warning',
      title: 'Format the social handle',
    },
    {
      detail: identity.shortName.length > 0 && identity.shortName === identity.shortName.toLocaleUpperCase()
        ? `Short name ${identity.shortName} is a clean monogram.`
        : `Short name "${identity.shortName}" should be an uppercase monogram.`,
      fix: identity.shortName && identity.shortName !== identity.shortName.toLocaleUpperCase() ? { id: 'short-name', label: 'Uppercase the short name' } : undefined,
      hint: 'Set shortName to the brand\'s monogram in uppercase, up to five letters.',
      id: 'naming-short-name',
      passed: identity.shortName.length > 0 && identity.shortName === identity.shortName.toLocaleUpperCase(),
      section: 'naming',
      severity: 'info',
      title: 'Uppercase the monogram',
    },
    {
      detail: `The identity takes ${(size / 1_000_000).toFixed(1)} MB of browser storage.`,
      hint: 'Shrink embedded files: subset fonts to Latin woff2, use SVG logos, and keep raster images under 1 MB.',
      id: 'naming-storage-size',
      passed: size < STORAGE_WARNING_CHARACTERS,
      section: 'naming',
      severity: 'warning',
      title: 'Reduce embedded file size',
    },
  ];
}

function agentPrompt(identity: BrandIdentity, check: Check): string {
  return [
    `In Glyphfield, open the Brand identity tool for "${identity.name}" (project ${identity.id}) and fix one brand health finding.`,
    `Finding ${check.id}: ${check.title}. ${check.detail}`,
    `What to do: ${check.hint}`,
    'Use window.glyphfield.studio: read the current identity with identity.read, change only what this finding needs with identity.apply { identity: patch } (merge mode keeps every other field), then run identity.audit and confirm the finding is gone. Finish with identity.save.',
    'Use only facts from the brand\'s own website, repository or design files. Do not invent claims, metrics or customers.',
  ].join('\n');
}

function gradeFor(score: number): BrandHealthReport['grade'] {
  if (score >= 90) return 'Strong';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Incomplete';
}

function sectionSummary(id: BrandHealthSectionId, identity: BrandIdentity, contrast: readonly BrandContrastResult[]): string {
  const passing = contrast.filter(({ passes }) => passes).length;
  const logos = BRAND_LOGO_SLOTS.filter((slot) => identity.assets.some((asset) => asset.id === slot.id)).length;
  switch (id) {
    case 'essentials': return identity.tagline;
    case 'strategy': return identity.strategy.concept;
    case 'voice': return `${identity.voice.principles.length} principles · ${identity.voice.examples?.length ?? 0} examples`;
    case 'logos': return `${logos} of ${BRAND_LOGO_SLOTS.length} logo variants`;
    case 'color': return `${identity.colors.length} colors · ${passing}/${contrast.length} pairs pass`;
    case 'typography': return [...new Set(identity.typography.map(({ family }) => family))].join(' · ');
    case 'graphic': return identity.graphicSystem.device;
    case 'imagery': return `${[...identity.assets, ...identity.proofAssets].filter(({ type }) => type !== 'logo').length} visual assets`;
    case 'products': return `${identity.products.length} products · ${identity.proof.length} proof points`;
    case 'applications': return `${identity.applications.length} applications`;
    case 'naming': return `${identity.shortName} · ${identity.socialHandle || 'no handle'}`;
  }
}

/** Audit one identity: completeness score, section scores and actionable findings. */
export function auditBrandHealth(identity: BrandIdentity): BrandHealthReport {
  const contrast = brandContrastResults(identity);
  const checks = [
    ...essentialsChecks(identity),
    ...strategyChecks(identity),
    ...voiceChecks(identity),
    ...logoChecks(identity),
    ...colorChecks(identity, contrast),
    ...typographyChecks(identity),
    ...graphicChecks(identity),
    ...imageryChecks(identity),
    ...productChecks(identity),
    ...applicationChecks(identity),
    ...namingChecks(identity),
  ];
  const sections = SECTIONS.map(({ id, label }): BrandHealthSection => {
    const sectionChecks = checks.filter((check) => check.section === id);
    const total = sectionChecks.reduce((sum, check) => sum + SEVERITY_WEIGHT[check.severity], 0);
    const earned = sectionChecks.reduce((sum, check) => sum + (check.passed ? SEVERITY_WEIGHT[check.severity] : 0), 0);
    return {
      checks: sectionChecks.length,
      id,
      label,
      passed: sectionChecks.filter(({ passed }) => passed).length,
      score: total ? earned / total : 1,
      summary: sectionSummary(id, identity, contrast),
    };
  });
  const totalWeight = SECTIONS.reduce((sum, { weight }) => sum + weight, 0);
  const score = Math.round(SECTIONS.reduce((sum, { id, weight }) => (
    sum + weight * (sections.find((section) => section.id === id)?.score ?? 0)
  ), 0) / totalWeight * 100);
  const severityOrder: Record<BrandHealthSeverity, number> = { error: 0, info: 2, warning: 1 };
  const findings = checks
    .filter(({ passed }) => !passed)
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
    .map((check): BrandHealthFinding => ({
      agentPrompt: agentPrompt(identity, check),
      detail: check.detail,
      ...(check.fix ? { fix: check.fix } : {}),
      id: check.id,
      section: check.section,
      severity: check.severity,
      title: check.title,
    }));
  return {
    contrast,
    counts: {
      error: findings.filter(({ severity }) => severity === 'error').length,
      info: findings.filter(({ severity }) => severity === 'info').length,
      warning: findings.filter(({ severity }) => severity === 'warning').length,
    },
    findings,
    grade: gradeFor(score),
    identityId: identity.id,
    name: identity.name,
    schemaVersion: BRAND_HEALTH_SCHEMA_VERSION,
    score,
    sections,
  };
}

/** Move a foreground color's OKLCH lightness until it meets the ratio against a fixed background. */
export function adjustForContrast(foreground: string, background: string, minimumRatio: number): string {
  if (colorContrastRatio(foreground, background) >= minimumRatio) return normalizeHex(foreground);
  const color = hexToOklch(foreground);
  const backgroundIsLight = hexToOklch(background).lightness >= 0.6;
  let low = backgroundIsLight ? 0 : color.lightness;
  let high = backgroundIsLight ? color.lightness : 1;
  let best = backgroundIsLight ? '#000000' : '#FFFFFF';
  for (let step = 0; step < 24; step += 1) {
    const lightness = (low + high) / 2;
    const candidate = oklchToHex({ ...color, lightness });
    if (colorContrastRatio(candidate, background) >= minimumRatio + 0.02) {
      best = candidate;
      if (backgroundIsLight) low = lightness;
      else high = lightness;
    } else if (backgroundIsLight) high = lightness;
    else low = lightness;
  }
  return best;
}

const PROPORTION_DEFAULTS: Record<string, number> = { emphasis: 10, ink: 30, paper: 60 };

/** Apply one deterministic fix by its ID. Throws RangeError for an unknown or inapplicable fix. */
export function applyBrandHealthFix(identity: BrandIdentity, fixId: string): BrandIdentity {
  if (fixId.startsWith('contrast:')) {
    const [, foreground, background] = fixId.split(':');
    const pair = brandContrastResults(identity).find((result) => result.foreground === foreground && result.background === background);
    if (!pair) throw new RangeError(`No color pair ${foreground} on ${background} exists in ${identity.name}.`);
    const hex = adjustForContrast(pair.foregroundHex, pair.backgroundHex, pair.required);
    return { ...identity, colors: identity.colors.map((color) => color.id === foreground ? { ...color, hex } : color) };
  }
  switch (fixId) {
    case 'proportions':
      return {
        ...identity,
        colors: identity.colors.map((color) => ({ ...color, proportion: PROPORTION_DEFAULTS[color.id] ?? 0 })),
      };
    case 'type-scale':
      return { ...identity, typeScale: { basePx: 16, ratio: 1.25 } };
    case 'body-leading':
      return { ...identity, typography: identity.typography.map((role) => role.role === 'Body' ? { ...role, lineHeight: 1.5 } : role) };
    case 'alt-text':
      return {
        ...identity,
        assets: identity.assets.map((asset) => asset.alt?.trim() ? asset : { ...asset, alt: asset.label }),
        proofAssets: identity.proofAssets.map((asset) => asset.alt?.trim() ? asset : { ...asset, alt: asset.label }),
      };
    case 'social-handle':
      return { ...identity, socialHandle: identity.socialHandle && !identity.socialHandle.startsWith('@') ? `@${identity.socialHandle}` : identity.socialHandle };
    case 'short-name':
      return { ...identity, shortName: identity.shortName.toLocaleUpperCase() };
    case 'logo-surfaces':
      return {
        ...identity,
        assets: identity.assets.map((asset) => {
          const slot = BRAND_LOGO_SLOTS.find(({ id }) => id === asset.id);
          return slot && slot.surface !== 'any' ? { ...asset, surface: slot.surface } : asset;
        }),
      };
    case 'font-bindings': {
      const fonts = brandFontAssets(identity);
      return {
        ...identity,
        typography: identity.typography.map((role) => {
          if (role.fontId && fonts.some(({ id }) => id === role.fontId)) return role;
          const match = fonts.find(({ family, style }) => family === role.family && style === 'normal')
            ?? fonts.find(({ family }) => family === role.family);
          return match ? { ...role, fontId: match.id } : role;
        }),
      };
    }
    default:
      throw new RangeError(`Unknown brand health fix "${fixId}". Use a fix.id from identity.audit findings.`);
  }
}
