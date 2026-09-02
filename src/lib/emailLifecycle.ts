import type { BrandIdentity } from '@/lib/brandIdentity';

const EMAIL_ARTWORK_ROOT = '/examples/email-lifecycle';
const EMAIL_CARD_ROOT = `${EMAIL_ARTWORK_ROOT}/cards`;

const EMAIL_SUPPORTING_CARD_LIBRARY = {
  context: {
    body: 'Group related copy so translators can preserve meaning across every surface.',
    imageBackgroundColor: '#F5F1FB',
    imagePath: `${EMAIL_CARD_ROOT}/context-groups-language-panel.png`,
    title: 'Add translation context',
  },
  dashboard: {
    body: 'Review locales, activity, and translation quality from one workspace.',
    imageBackgroundColor: '#EEF4FA',
    imagePath: `${EMAIL_CARD_ROOT}/dashboard-language-panel.png`,
    title: 'Open the dashboard',
  },
  discord: {
    body: 'Meet other teams shipping multilingual products and get help from the community.',
    imageBackgroundColor: '#F0F1FB',
    imagePath: `${EMAIL_CARD_ROOT}/discord-language-panel.png`,
    title: 'Join the community',
  },
  github: {
    body: 'Follow the Quickstart or hand the same setup instructions to your coding agent.',
    imageBackgroundColor: '#F3F3EF',
    imagePath: `${EMAIL_CARD_ROOT}/github-language-panel.png`,
    title: 'Add GT to your stack',
  },
  locadex: {
    body: 'Let Locadex open localization pull requests and keep translations moving with code.',
    imageBackgroundColor: '#EFF5F2',
    imagePath: `${EMAIL_CARD_ROOT}/locadex-language-panel.png`,
    title: 'Let Locadex open the PR',
  },
} as const;

export type EmailLifecycleSupportingCard =
  (typeof EMAIL_SUPPORTING_CARD_LIBRARY)[keyof typeof EMAIL_SUPPORTING_CARD_LIBRARY];

const SUPPORTING_CARDS_BY_TEMPLATE: Readonly<
  Partial<Record<string, readonly EmailLifecycleSupportingCard[]>>
> = {
  'onboarding-day3-api-key-email': [EMAIL_SUPPORTING_CARD_LIBRARY.github],
  'onboarding-day3-live-email': [
    EMAIL_SUPPORTING_CARD_LIBRARY.context,
    EMAIL_SUPPORTING_CARD_LIBRARY.locadex,
    EMAIL_SUPPORTING_CARD_LIBRARY.dashboard,
  ],
  'onboarding-day6-api-key-email': [EMAIL_SUPPORTING_CARD_LIBRARY.github],
  'onboarding-day6-live-email': [
    EMAIL_SUPPORTING_CARD_LIBRARY.locadex,
    EMAIL_SUPPORTING_CARD_LIBRARY.context,
    EMAIL_SUPPORTING_CARD_LIBRARY.dashboard,
  ],
  'welcome-email': [
    EMAIL_SUPPORTING_CARD_LIBRARY.github,
    EMAIL_SUPPORTING_CARD_LIBRARY.discord,
    EMAIL_SUPPORTING_CARD_LIBRARY.locadex,
  ],
};

const EMAIL_LIFECYCLE_TEMPLATE_DEFINITIONS = [
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-welcome.gif`,
    body: "You're in. Choose a starting point below, or open your dashboard to create your first project.",
    cta: 'Open Dashboard',
    description: 'The account-creation welcome with a multilingual morph and three clear setup paths.',
    group: 'Welcome',
    id: 'welcome-email',
    keywords: ['welcome', 'signup', 'onboarding', 'dashboard', 'gif'],
    name: 'Welcome email',
    subject: 'Welcome to General Translation',
    symbol: '01',
    timing: 'Immediately after signup',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-start.gif`,
    body: 'Your first translation is about five minutes away. Complete setup in the dashboard, then run the Quickstart.',
    cta: 'Open Dashboard',
    description: 'Onboarding for a workspace that has not created an API key yet.',
    group: 'Onboarding',
    id: 'onboarding-day3-no-api-key-email',
    keywords: ['onboarding', 'no api key', 'quickstart', 'start'],
    name: 'Start setup',
    subject: 'Your first translation is 5 minutes away',
    symbol: '↗',
    timing: 'No API key',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-translate.gif`,
    body: 'Your API key is ready. Choose a path below to translate your first string.',
    cta: 'Run the Quickstart',
    description: 'Onboarding for a workspace with an API key but no translation.',
    group: 'Onboarding',
    id: 'onboarding-day3-api-key-email',
    keywords: ['onboarding', 'api key', 'translation', 'quickstart'],
    name: 'Translate',
    subject: "You're one step from your first translation",
    symbol: '文',
    timing: 'API key ready',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-live.gif`,
    body: 'Your first translation is live. Here are three ways to keep quality high and updates moving.',
    cta: 'Open Dashboard',
    description: 'Guidance for a workspace with a live translation or Locadex run.',
    group: 'Onboarding',
    id: 'onboarding-day3-live-email',
    keywords: ['onboarding', 'activated', 'live', 'translation'],
    name: 'Translation live',
    subject: 'Your first translation is live',
    symbol: '✓',
    timing: 'Activated',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-start.gif`,
    body: 'Still want to try it? Complete setup in the dashboard, then run the Quickstart.',
    cta: 'Continue setup',
    description: 'A lightweight reminder when setup has not started.',
    group: 'Onboarding',
    id: 'onboarding-day5-no-api-key-email',
    keywords: ['onboarding', 'reminder', 'no api key', 'start'],
    name: 'Setup reminder',
    subject: 'Still here if you want a hand',
    symbol: '↗',
    timing: 'Setup incomplete',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-translate.gif`,
    body: "Your API key is ready, but you haven't run a translation yet. Choose a path below and you'll be live in minutes.",
    cta: 'Translate your app',
    description: 'Activation guidance for a configured workspace without a translation.',
    group: 'Onboarding',
    id: 'onboarding-day6-api-key-email',
    keywords: ['onboarding', 'api key', 'translation', 'activate'],
    name: 'First translation',
    subject: 'Translate your app in 5 minutes',
    symbol: 'A',
    timing: 'Translation pending',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-live.gif`,
    body: "You're up and running. These three settings make localization easier to scale.",
    cta: 'Explore your workspace',
    description: 'Product guidance for an activated team ready to scale localization.',
    group: 'Onboarding',
    id: 'onboarding-day6-live-email',
    keywords: ['onboarding', 'activated', 'scale', 'locadex'],
    name: 'Activated guidance',
    subject: 'Getting the most out of General Translation',
    symbol: '✓',
    timing: 'Localization active',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-credits.gif`,
    body: "Thanks for finishing setup. Your translation credits are ready, and you won't be charged until you choose to buy more.",
    cta: 'Start translating',
    description: 'A confirmation that rewards completed billing setup with translation credits.',
    group: 'Onboarding',
    id: 'onboarding-payment-confirmation-email',
    keywords: ['onboarding', 'payment', 'confirmation', 'credits', 'billing'],
    name: 'Payment confirmation',
    subject: '$10 in translation credits is ready.',
    symbol: '$',
    timing: 'After payment setup',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-auth.gif`,
    body: 'Use the secure link below to sign in to General Translation. The link expires in 24 hours.',
    cta: 'Sign in',
    description: 'A restrained authentication email for a time-limited sign-in link.',
    group: 'Authentication',
    id: 'auth-magic-link-email',
    keywords: ['auth', 'magic link', 'sign in', 'transactional', '24 hours'],
    name: 'Magic link',
    subject: 'Your sign-in link for General Translation',
    symbol: '↗',
    timing: 'On sign-in request',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-auth.gif`,
    body: 'Taylor invited you to join the Acme organization on General Translation. This invitation expires in 7 days.',
    cta: 'Accept invitation',
    description: 'A recognizable membership invitation with a direct acceptance action.',
    group: 'Authentication',
    id: 'membership-invitation-email',
    keywords: ['invitation', 'membership', 'organization', 'transactional', '7 days'],
    name: 'Organization invitation',
    subject: "You've been invited to join Acme on General Translation",
    symbol: '+',
    timing: 'On invite or resend',
  },
  {
    artworkPath: null,
    body: "I'd love to help your team translate your product. General Translation is the full-stack localization platform for shipping in over 120 languages.",
    cta: '',
    description: 'A natural plain-text introduction from Archie for a qualified enterprise lead.',
    group: 'Enterprise',
    id: 'enterprise-intro-email',
    keywords: ['enterprise', 'sales', 'intro', 'plain text', 'archie'],
    name: 'Enterprise introduction',
    subject: 'General Translation Intro',
    symbol: 'E',
    timing: 'Qualified lead',
  },
  {
    artworkPath: null,
    body: 'Following up on my note about helping your team translate your app into any language. Happy to walk you through your localization stack.',
    cta: '',
    description: 'The first plain-text reply in the enterprise introduction thread.',
    group: 'Enterprise',
    id: 'enterprise-day3-follow-up-email',
    keywords: ['enterprise', 'sales', 'follow up', 'plain text', 'thread'],
    name: 'Enterprise follow-up',
    subject: 'General Translation Intro',
    symbol: '↗',
    timing: 'Follow-up',
  },
  {
    artworkPath: null,
    body: "Last email from me for now. If you'd like to talk through localization at any point, feel free to reach out whenever it's helpful.",
    cta: '',
    description: 'The final plain-text reply in the enterprise introduction thread.',
    group: 'Enterprise',
    id: 'enterprise-day7-follow-up-email',
    keywords: ['enterprise', 'sales', 'follow up', 'plain text', 'thread'],
    name: 'Enterprise final follow-up',
    subject: 'General Translation Intro',
    symbol: '✓',
    timing: 'Final follow-up',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing.gif`,
    body: 'Auto-reload is off. Add credits now, or turn it on to keep translations running without interruption.',
    cta: 'Add credits',
    description: 'A soft warning when the account has used most of its credit balance.',
    group: 'Billing',
    id: 'balance-soft-limit-email',
    keywords: ['billing', 'balance', 'soft limit', 'credits', 'warning'],
    name: 'Credit balance warning',
    subject: 'Your credit balance is running low.',
    symbol: '80',
    timing: '80% of balance used',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing-alert.gif`,
    body: 'Your credit balance is depleted. Add credits to resume translations now, or turn on auto-reload to avoid another interruption.',
    cta: 'Add credits',
    description: 'A hard-stop alert when a depleted credit balance pauses translations.',
    group: 'Billing',
    id: 'balance-hard-limit-email',
    keywords: ['billing', 'balance', 'hard limit', 'credits', 'paused'],
    name: 'Credit balance depleted',
    subject: 'Translations are paused.',
    symbol: '!',
    timing: 'Balance reaches zero',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing.gif`,
    body: "When you reach 100%, new translations will pause. Add a card to switch to usage-based billing with no monthly fee.",
    cta: 'Add payment method',
    description: 'A soft warning when a new workspace has nearly exhausted its free credits.',
    group: 'Billing',
    id: 'free-credit-soft-limit-email',
    keywords: ['billing', 'free credits', 'soft limit', 'payment method'],
    name: 'Free credit warning',
    subject: "You've used 80% of your free credits.",
    symbol: '80',
    timing: '80% of free credits used',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing-alert.gif`,
    body: "Your free credits are exhausted. Add a card to resume immediately with usage-based billing; there's no monthly fee.",
    cta: 'Add payment method',
    description: 'A hard-stop alert when free credits are exhausted and translations pause.',
    group: 'Billing',
    id: 'free-credit-hard-limit-email',
    keywords: ['billing', 'free credits', 'hard limit', 'paused'],
    name: 'Free credits exhausted',
    subject: 'Your translations are paused.',
    symbol: '!',
    timing: 'Free credits exhausted',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-usage.gif`,
    body: 'At 100%, new translations will pause until the limit resets or you raise it. Review the cap now to avoid interruption.',
    cta: 'Review usage limit',
    description: 'A soft warning when usage approaches the account cap.',
    group: 'Billing',
    id: 'usage-soft-limit-email',
    keywords: ['billing', 'usage', 'soft limit', 'cap', 'warning'],
    name: 'Usage limit warning',
    subject: "You're nearing your usage limit.",
    symbol: '80',
    timing: '80% of usage cap',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-usage.gif`,
    body: 'Your usage limit has been reached. Raise or remove your cap to resume now, or wait for the reset.',
    cta: 'Update usage limit',
    description: 'A hard-stop alert when the account reaches its usage cap.',
    group: 'Billing',
    id: 'usage-hard-limit-email',
    keywords: ['billing', 'usage', 'hard limit', 'cap', 'paused'],
    name: 'Usage limit reached',
    subject: 'Translations are paused.',
    symbol: '!',
    timing: 'Usage cap reached',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing-alert.gif`,
    body: "We couldn't charge the card on file for your recent usage. Update your payment method to keep translations running.",
    cta: 'Update payment method',
    description: 'An operational alert after a failed usage payment.',
    group: 'Billing',
    id: 'billing-payment-failed-email',
    keywords: ['billing', 'payment failed', 'card', 'alert'],
    name: 'Payment failed',
    subject: "Your payment didn't go through.",
    symbol: '!',
    timing: 'After failed payment',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-billing-alert.gif`,
    body: "We couldn't collect a recent usage charge, so your account moved back to the free plan. Your projects and translations are safe.",
    cta: 'Fix billing',
    description: 'A plan-state alert after billing is canceled or cannot be collected.',
    group: 'Billing',
    id: 'billing-plan-canceled-email',
    keywords: ['billing', 'plan canceled', 'free plan', 'alert'],
    name: 'Plan canceled',
    subject: 'Your account moved to the free plan.',
    symbol: '!',
    timing: 'After plan cancellation',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-credits.gif`,
    body: 'Your payment method is saved and usage-based billing is on. Choose your framework in the docs to start translating.',
    cta: 'Go to Docs',
    description: 'A confirmation that a paid plan and usage-based billing are active.',
    group: 'Billing',
    id: 'upgrade-confirmation-email',
    keywords: ['billing', 'upgrade', 'plan active', 'credits', 'confirmation'],
    name: 'Plan activated',
    subject: 'Your Starter plan is active.',
    symbol: '✓',
    timing: 'After plan activation',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-locadex.gif`,
    body: 'Locadex finished setting up your project for automated localization. Review and merge the setup PR to turn it on.',
    cta: 'Review the PR',
    description: 'A product email confirming that the Locadex setup pull request is ready.',
    group: 'Locadex',
    id: 'locadex-setup-complete-email',
    keywords: ['locadex', 'setup', 'pull request', 'github', 'automation'],
    name: 'Locadex setup complete',
    subject: 'Your Locadex setup PR is ready.',
    symbol: 'PR',
    timing: 'After setup PR opens',
  },
  {
    artworkPath: `${EMAIL_ARTWORK_ROOT}/email-header-locadex.gif`,
    body: 'Locadex opened a pull request with the latest translations. Review and merge it to keep your app fully translated.',
    cta: 'Review the PR',
    description: 'A reminder that an open Locadex translation pull request is waiting for review.',
    group: 'Locadex',
    id: 'locadex-pr-reminder-email',
    keywords: ['locadex', 'reminder', 'pull request', 'github', 'translations'],
    name: 'Locadex PR reminder',
    subject: 'Your latest translations are ready.',
    symbol: 'PR',
    timing: '24 hours after PR opens',
  },
] as const;

const BRAND_EMAIL_PROGRAMS = {
  basement: {
    activatedBody: 'The project space is live. Add the team, collect the source material, and move the strongest direction forward.',
    activatedSubject: 'Your first Basement project is open',
    firstAction: 'open a project and frame the first creative decision',
    noun: 'project',
    outcome: 'cool work that performs',
    startSubject: 'Open your first Basement project',
  },
  cloudflare: {
    activatedBody: 'Your first connection is live. Review traffic, security posture, and performance from one control plane.',
    activatedSubject: 'Your first Cloudflare connection is live',
    firstAction: 'connect an application or network to the edge',
    noun: 'connection',
    outcome: 'a faster, safer Internet',
    startSubject: 'Connect your first application to Cloudflare',
  },
  mintlify: {
    activatedBody: 'Your documentation is live. Invite collaborators, add navigation, and keep every page current.',
    activatedSubject: 'Your first Mintlify page is live',
    firstAction: 'publish your first documentation page',
    noun: 'documentation space',
    outcome: 'documentation people want to use',
    startSubject: 'Publish your first Mintlify page',
  },
  ramp: {
    activatedBody: 'Your finance workspace is ready. Connect spend, policy, and reporting so the team can move with control.',
    activatedSubject: 'Your Ramp finance workspace is ready',
    firstAction: 'connect your first finance workflow',
    noun: 'finance workspace',
    outcome: 'more time and control',
    startSubject: 'Put your Ramp finance workspace to work',
  },
  starter: {
    activatedBody: 'Your identity direction is saved. Add evidence, refine the system, and turn it into reusable applications.',
    activatedSubject: 'Your first identity direction is ready',
    firstAction: 'shape your first identity direction',
    noun: 'identity system',
    outcome: 'a clear, repeatable brand',
    startSubject: 'Shape your first brand system',
  },
  stripe: {
    activatedBody: 'Your payment flow is ready. Run a test transaction, inspect the event, and prepare the integration for launch.',
    activatedSubject: 'Your first Stripe payment flow is ready',
    firstAction: 'create and test your first payment flow',
    noun: 'payment flow',
    outcome: 'programmable economic infrastructure',
    startSubject: 'Run your first Stripe payment',
  },
  tailwind: {
    activatedBody: 'Your first interface is composed. Extract the repeated patterns and keep building directly in your markup.',
    activatedSubject: 'Your first Tailwind interface is composed',
    firstAction: 'compose your first interface from utilities',
    noun: 'interface system',
    outcome: 'custom interfaces at utility speed',
    startSubject: 'Compose your first Tailwind interface',
  },
  template: {
    activatedBody: 'Your identity direction is saved. Add evidence, refine the system, and turn it into reusable applications.',
    activatedSubject: 'Your first identity direction is ready',
    firstAction: 'shape your first identity direction',
    noun: 'identity system',
    outcome: 'a clear, repeatable brand',
    startSubject: 'Shape your first template identity',
  },
  viteplus: {
    activatedBody: 'Your unified toolchain is running. Use one command model to develop, check, test, and build.',
    activatedSubject: 'Your Vite+ toolchain is running',
    firstAction: 'run your first unified toolchain command',
    noun: 'toolchain',
    outcome: 'one fast flow from setup to build',
    startSubject: 'Run your first Vite+ command',
  },
} as const;

function capitalize(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}`;
}

type BrandEmailProgram = {
  activatedBody: string;
  activatedSubject: string;
  firstAction: string;
  noun: string;
  outcome: string;
  startSubject: string;
};

function resolveBrandEmailProgram(identity: BrandIdentity): BrandEmailProgram {
  return BRAND_EMAIL_PROGRAMS[identity.id as keyof typeof BRAND_EMAIL_PROGRAMS] ?? {
    activatedBody: `Your ${identity.name} workspace is ready. Invite the team, review the system, and keep the next decision moving.`,
    activatedSubject: `Your ${identity.name} workspace is ready`,
    firstAction: `set up your first ${identity.products[0]?.toLocaleLowerCase() ?? 'workspace'} workflow`,
    noun: identity.products[0]?.toLocaleLowerCase() ?? 'workspace',
    outcome: identity.tagline,
    startSubject: `Start building with ${identity.name}`,
  };
}

function createIdentityEmailTemplate(
  template: (typeof EMAIL_LIFECYCLE_TEMPLATES)[number],
  identity: BrandIdentity
) {
  const program = resolveBrandEmailProgram(identity);
  const noun = program.noun;
  const name = identity.name;
  const common = {
    ...template,
    supportingCards: [] as const,
  };

  switch (template.id) {
    case 'welcome-email':
      return {
        ...common,
        body: `Your ${name} workspace is ready. Choose a starting point, invite your team, or open the studio and begin.`,
        cta: 'Open workspace',
        description: `The account welcome for ${name}, with a direct path into the brand's first meaningful action.`,
        keywords: ['welcome', 'signup', 'onboarding', name.toLocaleLowerCase()],
        subject: `Welcome to ${name}`,
      };
    case 'onboarding-day3-no-api-key-email':
      return {
        ...common,
        body: `You are a few minutes from a useful ${noun}. Open the workspace to ${program.firstAction}.`,
        cta: `Start ${noun}`,
        description: `The first-action prompt for a new ${name} workspace.`,
        keywords: ['onboarding', 'setup', noun],
        name: 'Start setup',
        subject: program.startSubject,
        timing: 'Setup not started',
      };
    case 'onboarding-day3-api-key-email':
      return {
        ...common,
        body: `The foundation is connected. Finish the first ${noun} and see the full ${name} workflow in context.`,
        cta: `Create ${noun}`,
        description: `Activation guidance after the ${name} foundation is connected.`,
        keywords: ['onboarding', 'connected', noun],
        name: `First ${noun}`,
        subject: `Your first ${noun} is one step away`,
        symbol: '01',
        timing: 'Foundation connected',
      };
    case 'onboarding-day3-live-email':
      return {
        ...common,
        body: program.activatedBody,
        cta: 'Open workspace',
        description: `Guidance for an activated ${name} workspace.`,
        keywords: ['onboarding', 'activated', noun],
        name: `${capitalize(noun)} live`,
        subject: program.activatedSubject,
        timing: 'First outcome complete',
      };
    case 'onboarding-day5-no-api-key-email':
      return {
        ...common,
        body: `Your workspace is waiting. Return when you are ready to ${program.firstAction}.`,
        cta: 'Continue setup',
        description: `A restrained setup reminder for ${name}.`,
        keywords: ['onboarding', 'reminder', 'setup'],
        name: 'Setup reminder',
        subject: `${name} is ready when you are`,
        timing: 'Setup incomplete',
      };
    case 'onboarding-day6-api-key-email':
      return {
        ...common,
        body: `Everything is connected. Create the first ${noun} and put ${name} into a real workflow.`,
        cta: `Build ${noun}`,
        description: `The final activation prompt before the first ${name} outcome.`,
        keywords: ['onboarding', 'activation', noun],
        name: `${capitalize(noun)} launch`,
        subject: `Put ${name} to work`,
        symbol: '01',
        timing: 'First outcome pending',
      };
    case 'onboarding-day6-live-email':
      return {
        ...common,
        body: `${program.activatedBody} The next step is turning that first result into ${program.outcome}.`,
        cta: 'Explore workspace',
        description: `Next-step guidance for an active ${name} team.`,
        keywords: ['onboarding', 'guidance', 'active'],
        name: 'Activated guidance',
        subject: `Get more from ${name}`,
        timing: 'Workspace active',
      };
    case 'onboarding-payment-confirmation-email':
      return {
        ...common,
        body: `Billing is set up and your ${name} workspace is ready for the team.`,
        cta: 'Open workspace',
        description: `The ${name} billing-setup confirmation.`,
        keywords: ['onboarding', 'billing', 'confirmation'],
        name: 'Workspace ready',
        subject: `Your ${name} workspace is ready`,
        timing: 'After billing setup',
      };
    case 'auth-magic-link-email':
      return {
        ...common,
        body: `Use the secure link below to sign in to ${name}. The link expires in 24 hours.`,
        description: `A time-limited sign-in email for ${name}.`,
        subject: `Your sign-in link for ${name}`,
      };
    case 'membership-invitation-email':
      return {
        ...common,
        body: `Taylor invited you to join the Acme workspace on ${name}. This invitation expires in 7 days.`,
        description: `A recognizable ${name} workspace invitation.`,
        subject: `You've been invited to join Acme on ${name}`,
      };
    default:
      return createIdentityOperationalEmailTemplate(template, identity, program);
  }
}

function createIdentityOperationalEmailTemplate(
  template: (typeof EMAIL_LIFECYCLE_TEMPLATES)[number],
  identity: BrandIdentity,
  program: BrandEmailProgram
) {
  const name = identity.name;
  const common = {
    ...template,
    supportingCards: [] as const,
  };

  switch (template.id) {
    case 'enterprise-intro-email':
      return {
        ...common,
        body: `I'd love to show how ${name} helps teams build ${program.outcome}. Happy to walk through the system with you.`,
        description: `A natural plain-text introduction for a qualified ${name} lead.`,
        keywords: ['enterprise', 'sales', 'intro', 'plain text'],
        subject: `${name} intro`,
      };
    case 'enterprise-day3-follow-up-email':
      return {
        ...common,
        body: `Following up on my note about ${name}. Happy to walk through how the workflow could fit your team.`,
        description: `The first plain-text follow-up in the ${name} introduction thread.`,
        keywords: ['enterprise', 'sales', 'follow up', 'plain text'],
        subject: `${name} intro`,
      };
    case 'enterprise-day7-follow-up-email':
      return {
        ...common,
        body: `Last note from me for now. If you would like to revisit ${name}, reply whenever it is useful.`,
        description: `The final plain-text follow-up in the ${name} introduction thread.`,
        keywords: ['enterprise', 'sales', 'follow up', 'plain text'],
        subject: `${name} intro`,
      };
    case 'balance-soft-limit-email':
      return {
        ...common,
        body: `Your ${name} balance is running low. Add funds or enable automatic reload to keep the workspace running.`,
        cta: 'Review balance',
        description: `A soft account-balance warning for ${name}.`,
        keywords: ['billing', 'balance', 'warning'],
        name: 'Balance warning',
        subject: 'Your balance is running low',
        timing: '80% of balance used',
      };
    case 'balance-hard-limit-email':
      return {
        ...common,
        body: `Your ${name} balance is depleted. Add funds to resume the workspace.`,
        cta: 'Add funds',
        description: `A hard-stop account-balance alert for ${name}.`,
        keywords: ['billing', 'balance', 'paused'],
        name: 'Balance depleted',
        subject: 'Your workspace is paused',
        timing: 'Balance reaches zero',
      };
    case 'free-credit-soft-limit-email':
      return {
        ...common,
        body: `You have used most of the included ${name} allowance. Add a payment method to continue without interruption.`,
        cta: 'Add payment method',
        description: `A soft included-allowance warning for ${name}.`,
        keywords: ['billing', 'allowance', 'warning'],
        name: 'Allowance warning',
        subject: 'You have used 80% of your included allowance',
        timing: '80% of allowance used',
      };
    case 'free-credit-hard-limit-email':
      return {
        ...common,
        body: `Your included ${name} allowance is exhausted. Add a payment method to resume immediately.`,
        cta: 'Add payment method',
        description: `A hard-stop included-allowance alert for ${name}.`,
        keywords: ['billing', 'allowance', 'paused'],
        name: 'Allowance exhausted',
        subject: 'Your included allowance is exhausted',
        timing: 'Allowance exhausted',
      };
    case 'usage-soft-limit-email':
      return {
        ...common,
        body: `Your ${name} workspace is approaching its usage cap. Review the limit now to avoid interruption.`,
        description: `A soft usage-cap warning for ${name}.`,
        subject: 'You are nearing your usage limit',
      };
    case 'usage-hard-limit-email':
      return {
        ...common,
        body: `Your ${name} usage limit has been reached. Raise the cap or wait for the reset to resume.`,
        description: `A hard-stop usage-cap alert for ${name}.`,
        subject: 'Your workspace is paused',
      };
    case 'billing-payment-failed-email':
      return {
        ...common,
        body: `We could not charge the card on file for ${name}. Update the payment method to keep the workspace running.`,
        description: `A failed-payment alert for ${name}.`,
      };
    case 'billing-plan-canceled-email':
      return {
        ...common,
        body: `We could not collect a recent charge, so your ${name} workspace moved to the free plan. Your work is safe.`,
        description: `A plan-state alert for ${name}.`,
      };
    case 'upgrade-confirmation-email':
      return {
        ...common,
        body: `Your payment method is saved and the ${name} plan is active.`,
        cta: 'Open workspace',
        description: `A paid-plan activation confirmation for ${name}.`,
        subject: `Your ${name} plan is active`,
      };
    case 'locadex-setup-complete-email':
      return {
        ...common,
        body: `The first ${name} automation is configured and ready for review.`,
        cta: 'Review automation',
        description: `An automation-ready confirmation for ${name}.`,
        group: 'Automation',
        keywords: ['automation', 'setup', 'review'],
        name: 'Automation ready',
        subject: `Your ${name} automation is ready`,
        symbol: '↗',
        timing: 'After automation setup',
      };
    case 'locadex-pr-reminder-email':
      return {
        ...common,
        body: `A ${name} automation is waiting for review. Open it to keep the workflow moving.`,
        cta: 'Review automation',
        description: `A pending-automation reminder for ${name}.`,
        group: 'Automation',
        keywords: ['automation', 'reminder', 'review'],
        name: 'Automation reminder',
        subject: `A ${name} automation is waiting for review`,
        symbol: '↗',
        timing: 'While review is pending',
      };
  }
}

export const EMAIL_LIFECYCLE_TEMPLATES = EMAIL_LIFECYCLE_TEMPLATE_DEFINITIONS.map(
  (template) => ({
    ...template,
    supportingCards: SUPPORTING_CARDS_BY_TEMPLATE[template.id] ?? [],
  })
);

export function getEmailLifecycleTemplate(elementId: string, identity?: BrandIdentity) {
  const template = EMAIL_LIFECYCLE_TEMPLATES.find(({ id }) => id === elementId);
  if (!template || !identity || identity.id === 'gt') return template;
  return createIdentityEmailTemplate(template, identity);
}
