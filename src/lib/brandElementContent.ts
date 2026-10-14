/**
 * Sample content for brand element templates, drawn from the identity itself:
 * its products and their one-liners, proof, customers, messaging and samples.
 * Templates never fall back to Glyphfield's own product or to the identity's
 * internal description; when a brand has no data for a slot, the fallback is
 * neutral and built from what the identity does have.
 */
import {
  brandCustomers,
  brandMessaging,
  brandProducts,
  brandProofStatements,
  brandSampleEvent,
  brandSamplePerson,
  type BrandSampleEvent,
  type BrandSamplePerson,
} from './brandContent';
import type { BrandIdentity, BrandProductDetail } from './brandIdentity';

export type BrandElementPlan = { features: string[]; name: string; price: string };

export type BrandElementContent = {
  actions: string[];
  code: { label: string; snippet: string };
  customers: string[];
  event: BrandSampleEvent;
  /** The install command, or the first line of the code sample. */
  install: string;
  metric: { change: string; label: string; value: string };
  /** The package or command name the install line installs. */
  packageName: string;
  person: BrandSamplePerson;
  phrases: string[];
  plans: BrandElementPlan[];
  products: BrandProductDetail[];
  promise: string;
  proof: string[];
  release: { items: string[]; title: string };
  /** A proof statement that names a customer, with that customer. */
  story: { customer: string; statement: string } | null;
  tagline: string;
};

function capitalize(value: string): string {
  return value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;
}

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';
}

/** `npm install stripe` → `stripe`; `curl … | bash` → the brand slug. */
export function installPackageName(install: string, fallback: string): string {
  const match = install.match(/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|i)\s+(?:-g\s+)?((?:@[\w.-]+\/)?[\w.-]+)/);
  return match?.[1] ?? fallback;
}

function customerStory(customers: readonly string[], proof: readonly string[]): BrandElementContent['story'] {
  for (const statement of proof) {
    const customer = customers.find((name) => statement.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
    if (customer) return { customer, statement };
  }
  return null;
}

function codeSample(identity: BrandIdentity, fallback: string): BrandElementContent['code'] {
  const code = identity.samples?.code;
  if (code?.snippet?.trim()) return { label: code.label.trim() || `${identity.name} quickstart`, snippet: code.snippet };
  return { label: `${identity.name} quickstart`, snippet: fallback };
}

function metricSample(identity: BrandIdentity, products: readonly BrandProductDetail[], proof: readonly string[]): BrandElementContent['metric'] {
  const metric = identity.samples?.metric;
  if (metric?.value?.trim()) return { change: metric.change ?? '', label: metric.label || identity.name, value: metric.value };
  return { change: proof[0] ?? '', label: products[0]?.name ?? identity.name, value: String(products.length || 1) };
}

function planSamples(identity: BrandIdentity, products: readonly BrandProductDetail[]): BrandElementPlan[] {
  const plans = (identity.samples?.plans ?? []).filter((plan) => plan.name?.trim() && plan.price?.trim());
  if (plans.length) return plans.map((plan) => ({ features: plan.features.filter(Boolean), name: plan.name.trim(), price: plan.price.trim() }));
  return products.slice(0, 3).map((product) => ({ features: product.summary ? [product.summary] : [], name: product.name, price: 'Contact us' }));
}

function releaseSample(identity: BrandIdentity, products: readonly BrandProductDetail[], fallbackTitle: string): BrandElementContent['release'] {
  const release = identity.samples?.release;
  if (release?.title?.trim()) return { items: release.items.filter(Boolean), title: release.title };
  return { items: products.slice(0, 3).map(({ name, summary }) => (summary ? `${name}: ${summary}` : name)), title: fallbackTitle };
}

function actionSamples(identity: BrandIdentity, products: readonly BrandProductDetail[]): string[] {
  const actions = (identity.samples?.actions ?? []).map((action) => action.trim()).filter(Boolean);
  if (actions.length) return actions;
  const fallback = products.slice(0, 4).map(({ name }) => `Open ${name}`);
  return fallback.length ? fallback : [`Open ${identity.name}`];
}

export function brandElementContent(identity: BrandIdentity): BrandElementContent {
  const products = brandProducts(identity);
  const messaging = brandMessaging(identity);
  const proof = brandProofStatements(identity);
  const customers = brandCustomers(identity);
  const install = identity.samples?.install?.trim() ?? '';
  const code = codeSample(identity, install || `# ${messaging.tagline || identity.name}`);
  const shortName = identity.shortName.length > 1 ? identity.shortName : identity.name;
  return {
    actions: actionSamples(identity, products),
    code,
    customers,
    event: brandSampleEvent(identity),
    install: install || (code.snippet.split('\n')[0] ?? ''),
    metric: metricSample(identity, products, proof),
    packageName: installPackageName(install, slug(shortName)),
    person: brandSamplePerson(identity),
    phrases: messaging.phrases,
    plans: planSamples(identity, products),
    products,
    promise: messaging.promise,
    proof,
    release: releaseSample(identity, products, messaging.phrases[0] ?? messaging.tagline),
    story: customerStory(customers, proof),
    tagline: messaging.tagline,
  };
}

/** "Refund a payment" → "Refund". Used for confirm buttons. */
export function actionVerb(action: string): string {
  return capitalize(action.split(/\s+/)[0] ?? action);
}

/** The plan a pricing table features: the middle one of three, otherwise the first. */
export function featuredPlanIndex(plans: readonly BrandElementPlan[]): number {
  return plans.length >= 3 ? 1 : 0;
}
