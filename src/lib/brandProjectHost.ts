/**
 * Brand project creation for the Browser API. The Studio shell registers a host
 * that owns the project list; `identity.project.create` prepares the identity
 * here and asks the host to add and activate it, exactly as the
 * "Add brand project" menu does.
 */
import {
  BUILT_IN_BRAND_IDENTITIES,
  createBrandIdentity,
  duplicateBrandIdentity,
  renameBrandIdentity,
  type BrandIdentity,
} from './brandIdentity';

export type BrandProjectHost = {
  /** Add the identity as a new project tab, make it active and open the Brand identity tool. */
  activate: (identity: BrandIdentity) => void;
  /** Copy a custom project with every workspace, asset and checkpoint. */
  duplicate: (identity: BrandIdentity, existingNames: readonly string[]) => Promise<BrandIdentity>;
  identities: () => readonly BrandIdentity[];
};

let activeHost: BrandProjectHost | null = null;

export function registerBrandProjectHost(host: BrandProjectHost): () => void {
  activeHost = host;
  return () => {
    if (activeHost === host) activeHost = null;
  };
}

export function brandProjectHost(): BrandProjectHost | null {
  return activeHost;
}

export type BrandProjectCreateInput = { from: string; name?: string };

/** Validate `{ from?, name? }`; `from` defaults to the Starter template. */
export function parseBrandProjectCreateInput(input: unknown): BrandProjectCreateInput {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const unknown = Object.keys(record).filter((key) => key !== 'from' && key !== 'name');
  if (unknown.length) throw new TypeError(`identity.project.create does not accept ${unknown.join(', ')}; use from and name.`);
  const { from = 'starter', name } = record;
  if (typeof from !== 'string' || !from.trim()) throw new TypeError("identity.project.create from must be 'starter', 'scratch' or a project id.");
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 80)) {
    throw new TypeError('identity.project.create name must be a non-empty string of at most 80 characters.');
  }
  return { from: from.trim(), ...(typeof name === 'string' ? { name: name.trim() } : {}) };
}

export type PreparedBrandProject =
  | { identity: BrandIdentity; source: 'scratch' | 'template' }
  | { source: 'project'; target: BrandIdentity };

/**
 * Resolve where the new project comes from: an empty scratch identity, a copy
 * of a built-in template (Starter by default), or a full copy of a custom project.
 */
export function prepareBrandProject(input: BrandProjectCreateInput, identities: readonly BrandIdentity[]): PreparedBrandProject {
  const names = identities.map(({ name }) => name);
  if (input.from === 'scratch') return { identity: createBrandIdentity(input.name ?? 'Untitled brand'), source: 'scratch' };
  const target = identities.find(({ id }) => id === input.from)
    ?? BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === input.from);
  if (!target) {
    throw new RangeError(`identity.project.create from "${input.from}" is not a project; use 'starter', 'scratch' or an id from the project list.`);
  }
  if (!target.builtIn) return { source: 'project', target };
  const copy = duplicateBrandIdentity(target, undefined, names);
  return { identity: input.name ? renameBrandIdentity(copy, input.name) : copy, source: 'template' };
}
