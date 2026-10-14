/**
 * Read-side helpers that every brand output (moodboard, book, elements,
 * identity preview, email) uses to pull real content from an identity: product
 * one-liners, customers kept apart from proof, distinct messaging lines, and
 * sample people and events. Identities saved before these fields existed fall
 * back to what they already hold, so nothing renders empty.
 */
import type { BrandIdentity, BrandProductDetail } from './brandIdentity';

function clean(values: readonly (string | undefined)[] | undefined): string[] {
  return (values ?? []).map((value) => value?.trim() ?? '').filter(Boolean);
}

function sameText(left: string, right: string): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return normalize(left) === normalize(right);
}

/** Every product with its one-line summary; names without a summary keep an empty line. */
export function brandProducts(identity: Pick<BrandIdentity, 'productDetails' | 'products'>): BrandProductDetail[] {
  const details = (identity.productDetails ?? []).filter((detail) => detail?.name?.trim());
  const named = clean(identity.products).map((name) => ({
    name,
    summary: details.find((detail) => sameText(detail.name, name))?.summary.trim() ?? '',
  }));
  const extra = details
    .filter((detail) => !named.some(({ name }) => sameText(name, detail.name)))
    .map((detail) => ({ name: detail.name.trim(), summary: detail.summary.trim() }));
  return [...named, ...extra];
}

/** Customer names. Older identities kept names in `proof`; those stay in proof. */
export function brandCustomers(identity: Pick<BrandIdentity, 'customers'>): string[] {
  return clean(identity.customers);
}

/** Proof statements without any entry that is also a customer name. */
export function brandProofStatements(identity: Pick<BrandIdentity, 'customers' | 'proof'>): string[] {
  const customers = brandCustomers(identity);
  return clean(identity.proof).filter((statement) => !customers.some((name) => sameText(name, statement)));
}

export type BrandMessaging = {
  /** Approved phrases that repeat neither the tagline nor the promise. */
  phrases: string[];
  promise: string;
  tagline: string;
};

/** Tagline, promise and phrases with repeats removed, so layouts never print one line twice. */
export function brandMessaging(identity: Pick<BrandIdentity, 'mission' | 'positioning' | 'strategy' | 'tagline' | 'voice'>): BrandMessaging {
  const tagline = identity.tagline?.trim() ?? '';
  const promise = clean([identity.strategy?.promise, identity.strategy?.concept, identity.mission])
    .find((candidate) => !sameText(candidate, tagline)) ?? '';
  const phrases: string[] = [];
  for (const phrase of clean(identity.voice?.phrases)) {
    if ([tagline, promise, ...phrases].some((used) => used && sameText(used, phrase))) continue;
    phrases.push(phrase);
  }
  return { phrases, promise, tagline };
}

export type BrandSamplePerson = { initials: string; name: string; role: string };
export type BrandSampleEvent = { date: string; location: string; name: string; time: string };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toLocaleUpperCase()).join('') || '··';
}

/** The sample person templates show, with a neutral fallback for identities without samples. */
export function brandSamplePerson(identity: Pick<BrandIdentity, 'name' | 'samples'>): BrandSamplePerson {
  const person = identity.samples?.person;
  const name = person?.name?.trim() || 'Alex Morgan';
  return { initials: initials(name), name, role: person?.role?.trim() || `Design lead, ${identity.name}` };
}

/** The sample event templates show, with a neutral fallback for identities without samples. */
export function brandSampleEvent(identity: Pick<BrandIdentity, 'name' | 'samples'>): BrandSampleEvent {
  const event = identity.samples?.event;
  return {
    date: event?.date?.trim() || 'Thu 14 Nov',
    location: event?.location?.trim() || 'Online',
    name: event?.name?.trim() || `${identity.name} live session`,
    time: event?.time?.trim() || '17:00 UTC',
  };
}
