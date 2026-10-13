import { createBrandIdentity, type BrandIdentity } from './brandIdentity';
import type { BrandHealthReport } from './brandHealth';

/**
 * The "Set up with your agent" prompt. It is written for a coding agent that has
 * never seen Glyphfield: where the project is, which sources it may use, the
 * exact Browser API calls, and when the job is done.
 */
export type BrandSetupMode = 'new' | 'improve';

const DEFAULT_ORIGIN = 'http://localhost:3012';

/** A project still holding scratch guidance text or the default palette needs a full setup. */
export function brandSetupMode(identity: BrandIdentity): BrandSetupMode {
  if (identity.builtIn) return 'improve';
  const scratch = createBrandIdentity(identity.name, identity.id);
  const untouched = identity.tagline === scratch.tagline
    || identity.positioning === scratch.positioning
    || identity.colors.map(({ hex }) => hex).join() === scratch.colors.map(({ hex }) => hex).join();
  return untouched ? 'new' : 'improve';
}

export function brandProjectUrl(identity: Pick<BrandIdentity, 'id'>, origin = DEFAULT_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/studio?tool=identity&project=${encodeURIComponent(identity.id)}`;
}

export function brandAgentSetupPrompt({
  identity,
  mode = brandSetupMode(identity),
  origin = DEFAULT_ORIGIN,
  report,
}: {
  identity: BrandIdentity;
  mode?: BrandSetupMode;
  origin?: string;
  report?: Pick<BrandHealthReport, 'counts' | 'score'>;
}): string {
  const base = origin.replace(/\/$/, '');
  const name = mode === 'new' && identity.name === 'Untitled brand' ? 'my brand' : `the "${identity.name}" brand`;
  const website = identity.website.trim() ? `my website (${identity.website.trim()})` : 'my website';
  const status = report
    ? ` It currently scores ${report.score}/100 on Glyphfield's brand health audit with ${report.counts.error} errors and ${report.counts.warning} warnings.`
    : '';
  const projectStep = mode === 'new'
    ? `This project is new: fill every section. If the URL does not open it, create the project yourself with await studio.invoke('identity.project.create', { from: 'starter', name: '${identity.name === 'Untitled brand' ? 'Brand name' : identity.name.replaceAll("'", '’')}' }) (from: 'scratch' starts empty), then read window.glyphfield.studio again: the new project owns the API.`
    : 'This project already has content: run identity.read and identity.audit first, keep what is correct, and change only what the sources contradict, what is missing, or what the audit flags.';

  return [
    `Set up ${name} in Glyphfield so every Glyphfield tool (brand elements, moodboard, brand book, motion, Design Lab) uses it.${status}`,
    '',
    `Glyphfield runs in my browser at ${brandProjectUrl(identity, base)}. The brand lives in the Brand identity tool, which you operate through its Browser API, window.glyphfield.studio. The complete workflow is at ${base}/docs/agents/brand-setup.md, and the identity schema is returned by GET ${base}/api/brand/validate.`,
    '',
    `Sources you may use: ${website}, this repository, and any design files or folders I point you to. Use only facts you find there and note where each came from. Never invent customers, metrics, claims or slogans; leave a field out instead.`,
    '',
    '1. Research. Read the homepage, about page, README and docs; CSS custom properties, Tailwind config or design tokens; font files and their licenses; logo files (mark and wordmark, for light and dark surfaces, and a one-color version); and any brand or style guide.',
    '2. Brief. Draft the identity: name, tagline, positioning, mission, description, audiences, products with productDetails [{ name, summary }] (one plain line per product), proof (published metrics only) and customers (names the brand shows) kept apart; samples { person, event, install, code, actions, plans } from the brand\'s docs and pricing so templates show real content; a tagline, promise and phrases that are each different lines; voice principles, approved phrases, words to avoid and at least three voice.examples { context, write, avoid }; strategy challenge, concept, promise, outcome, three to five pillars and personality; colors with ids ink (text), paper (background), muted (quiet surface) and emphasis (accent) plus any others, each with hex, role and proportion (about 60/30/10), and colorPairings for every text pair; Display, Body, Accent and Code typography with weight, lineHeight and letterSpacing, plus typeScale { basePx, ratio }; graphicSystem device, description, rules and imageDirection; dossier.prohibited (do-not rules); applications.',
    `3. Connect. Open the project URL in a browser you control (for example Playwright). Wait for window.glyphfield.studio, call studio.describe(), and check that studio.activeTool() is "identity". ${projectStep}`,
    '4. Validate. Build a merge patch and check it with await studio.invoke(\'identity.validate\', { identity: patch }). Fix every error; each message names the exact path and the expected value.',
    '5. Apply. await studio.invoke(\'identity.apply\', { identity: patch }). Records merge by id (typography by role), string lists are replaced, and unknown fields are kept. When the project started from a template, pass replace: [\'colors\', \'colorPairings\', \'applications\'] so the template\'s records do not linger, and use remove: { assets: [id] } to delete other records.',
    '6. Files. Add logos with await studio.invoke(\'identity.asset.add\', { file, slot }) using the slots mark-dark (for light surfaces), mark-light (for dark surfaces), wordmark, wordmark-light and mark-mono, and fonts with await studio.invoke(\'identity.font.add\', { file, roles, license, sourceUrl }). Build each File from the bytes you read, for example new File([bytes], \'mark.svg\', { type: \'image/svg+xml\' }). Never pass a filesystem path or a remote URL.',
    '7. Audit. await studio.invoke(\'identity.audit\'). Resolve every error and warning: call identity.fix { fixId } when a finding has a fix (prune-fonts removes template fonts no role uses, separate-customers moves names out of proof), otherwise follow its agentPrompt. Repeat until no errors remain.',
    '8. Save and export. await studio.invoke(\'identity.save\'), then await studio.invoke(\'identity.export.kit\', { format: \'zip\' }) and check that the returned blob is a non-empty application/zip. Only write brand.md or the tokens into this repository if I ask.',
    '9. Report what you set, the source of each fact, the final audit score, and anything you could not find.',
  ].join('\n');
}
