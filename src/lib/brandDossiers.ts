import type {
  BrandArtDirection,
  BrandDossier,
  BrandReference,
} from './brandIdentity';

type BrandSystemSource = {
  artDirection: BrandArtDirection;
  dossier: BrandDossier;
  references: BrandReference[];
};

type ReferenceSeed = {
  campaign: string[];
  concept: string[];
  material: string[];
  motion: string[];
  official: string[];
  officialSources?: string[];
  owner: string;
  sourceUrl: string;
};

function referencePack(id: string, seed: ReferenceSeed): BrandReference[] {
  const nativeAssetIds = [
    'library-overview',
    'library-interface',
    'library-detail',
    'library-campaign',
    'library-editorial',
    'library-motion',
  ] as const;
  const entries = (
    Object.entries({
      official: seed.official,
      campaign: seed.campaign,
      concept: seed.concept,
      material: seed.material,
      motion: seed.motion,
    }) as [BrandReference['category'], string[]][]
  ).flatMap(([category, titles]) =>
    titles.map((title, index) => {
      const assetId = category === 'official'
        ? nativeAssetIds[index]
        : category === 'campaign' && index === 0
          ? 'library-atmosphere'
          : undefined;
      return {
      assetId,
      category,
      capturedAt: assetId ? '2026-07' : undefined,
      id: `${id}-${category}-${index + 1}`,
      intendedUse: `${category} reference for ${title.toLocaleLowerCase()}`,
      owner: assetId ? seed.owner : 'Reference owner to verify before capture',
      redistribution: 'research-only' as const,
      sourceUrl: assetId ? seed.officialSources?.[index] ?? seed.sourceUrl : '',
      status: category === 'official' && index === 0
        ? 'captured' as const
        : assetId
          ? 'reviewed' as const
          : 'planned' as const,
      title,
    }})
  );

  return entries;
}

export const GT_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'monochrome-language',
    preview: 'translation-frame',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Monochrome identity board', 'Language-motion header', 'Localization workspace', 'Welcome email', 'CLI and documentation', 'Event and lanyard system'],
    color: 'Black and white are the identity. Gray exists only to establish hierarchy, state, or depth. Product colors belong to the product being shown and never become decorative GT accents.',
    graphicDevice: 'The translation frame keeps one fixed center while language, writing system, and product context change inside it. The frame may be implied through alignment and motion; it should not become a literal decorative bracket.',
    imagery: 'Prefer real product evidence, multilingual typography, repositories, documentation, review states, and human language contexts. Locadex artwork appears only when the subject is explicitly Locadex.',
    layout: 'Use open monochrome fields, centered language moments, strong horizontal alignment, and restrained metadata. Headlines stay within two lines and supporting copy remains visibly subordinate.',
    logo: 'Use the official GT mark, wordmark, banner, and product lockups in black or white. Preserve their geometry, clear space, and surface contrast. Do not stroke, shade, texture, or use the mark as an oversized background watermark.',
    motion: 'Language changes through centered morph fades, type-and-delete sequences, and text-to-mark transitions. Motion preserves the optical center, avoids vertical stutter, and uses short cubic-bezier transitions with deliberate holds.',
    personality: 'Direct, technically credible, globally aware, calm, and specific. The system should make internationalization feel like durable infrastructure rather than celebratory travel imagery.',
    premise: 'General Translation keeps product language and code moving together. The identity makes one source of truth visible across many writing systems without turning difference into visual noise.',
    prohibited: ['No decorative Locadex marks', 'No corner brackets as a house motif', 'No layered duplicate headlines', 'No generic globe or flag collage', 'No interface-font fallback in exported work'],
    provenance: 'Use current GT-owned marks, product captures, documentation, and original Glyphfield studies. External partner marks remain proof assets with their own usage restrictions.',
    renderingRecipe: ['Begin in black and white', 'Set one stable optical center', 'Choose one language or product proof as the focal element', 'Use gray only for hierarchy', 'Confirm every logo belongs to the depicted product context'],
    typography: 'Use GT’s supplied Inter/Rasmus direction with restrained weight, open spacing, and language-aware fallback coverage. Display text should not exceed 550 weight; code and metadata use the approved technical face only where semantically appropriate.',
  },
  references: referencePack('gt', {
    owner: 'General Translation',
    sourceUrl: 'https://generaltranslation.com',
    official: ['Current GT homepage', 'Dashboard localization workspace', 'GT documentation hierarchy', 'Locadex pull-request flow', 'Package and CLI surfaces', 'Welcome email system'],
    officialSources: ['https://generaltranslation.com', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs/core/quickstart', 'https://generaltranslation.com'],
    campaign: ['Multilingual launch sequence', 'Customer proof in monochrome', 'Language-motion announcement', 'Developer event signage'],
    concept: ['Optical-center language study', 'Writing-system rhythm comparison', 'Source-to-locale transformation', 'Black-and-white editorial translation'],
    material: ['Uncoated white paper and black ink', 'Embossed monochrome signage', 'Transparent language overlays'],
    motion: ['Centered morph fade', 'Type and delete sequence', 'Mark-to-language transition'],
  }),
};

export const STARTER_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'research-wall',
    preview: 'focus-window',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Identity thesis', 'Research wall', 'Working deck', 'Product workspace', 'Field notes', 'Launch sequence'],
    color: 'Warm white and near-black form a neutral research surface. A concentrated blue focus window identifies the active claim, decision, or evidence rather than filling the entire composition.',
    graphicDevice: 'The focus window is a precise blue aperture that isolates the most useful fragment of a larger field. It can crop an image, frame a decision, or become a navigational state.',
    imagery: 'Use candid research, material studies, interface evidence, process photography, taped references, and close crops. The image set should reveal how a system was built rather than simulate a finished luxury campaign.',
    layout: 'Compose like an authored research wall: one decisive focal frame, quiet annotations, unequal image scales, and generous breathing room. Avoid universal card grids.',
    logo: 'The spark mark and Starter wordmark establish orientation but remain small. The identity is demonstrated by selection, framing, and evidence rather than repeated logo stamping.',
    motion: 'The focus window moves between evidence, then settles. Transitions are quick but not abrupt; surrounding material remains stable so the selection change is legible.',
    personality: 'Curious, authored, pragmatic, observant, and quietly opinionated.',
    premise: 'Starter demonstrates how a new identity grows from research, choices, and repeatable rules. It is a complete neutral example, not an empty template.',
    prohibited: ['No generic placeholder copy', 'No equal-sized image grid', 'No random blue gradients', 'No decorative evidence without a stated role'],
    provenance: 'Use original Glyphfield compositions and safely licensed research imagery. Every external reference must remain URL-only or research-only until its redistribution status is confirmed.',
    renderingRecipe: ['Choose one research question', 'Assemble varied evidence', 'Create one blue focus window', 'Let adjacent material remain quiet', 'Annotate only decisions that change the system'],
    typography: 'Switzer provides clear working typography; Instrument Serif adds an authored editorial voice for selected statements. Geist Mono is limited to measurements, source labels, and technical evidence.',
  },
  references: referencePack('starter', {
    owner: 'Glyphfield',
    sourceUrl: 'https://glyphfield.app',
    official: ['Starter identity overview', 'Starter logo family', 'Starter workspace', 'Starter field notes', 'Starter working deck', 'Starter progress cards'],
    campaign: ['Research-led launch poster', 'Process journal spread', 'Decision checkpoint card', 'Team working-session wall'],
    concept: ['Blue aperture over archive', 'Selected fragment in a contact sheet', 'Evidence pinned to a neutral field', 'Focus and peripheral context'],
    material: ['Warm paper and blue acetate', 'Graphite notes and registration tape', 'Pinned print and screen proof'],
    motion: ['Moving focus window', 'Evidence reorder transition', 'Research-to-system reveal'],
  }),
};

export const RAMP_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'editorial-evidence',
    preview: 'economic-ledger',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Savings proof', 'Finance operations dashboard', 'Corporate card', 'Benchmark report', 'Operator story', 'Finance event system'],
    color: 'Warm paper, dark slate, and highlighter yellow build a financial working surface. Yellow marks the proof or action; it should not become a decorative gradient.',
    graphicDevice: 'The savings ledger aligns dollars, hours, approvals, and outcomes on one measurable plane. Rules and highlighted cells turn operational evidence into the composition.',
    imagery: 'Use real product UI, corporate cards, operator portraits, receipts, workplaces, and financial artifacts. Crop for evidence and human consequence, not generic aspirational office imagery.',
    layout: 'Lead with one quantified outcome. Use ledger alignment, warm negative space, and compact supporting product evidence. Oversized numbers may dominate, but titles remain under two lines.',
    logo: 'Use the official slate or white Ramp logo without recoloring or ornamental treatment. Maintain generous clear space and treat the card itself as a primary brand artifact.',
    motion: 'Figures count into place, approval states resolve, and ledger rows move from pending to controlled. Motion should feel efficient and consequential rather than playful.',
    personality: 'Decisive, financially literate, optimistic, evidence-led, and human.',
    premise: 'Ramp turns financial operations into time and money returned to the business. The identity should make that recovery visible before it describes features.',
    prohibited: ['No generic fintech gradients', 'No unverified savings figures', 'No interface-font substitution for Lausanne', 'No logo recoloring'],
    provenance: 'Official Ramp product, press, and logo sources remain research or proof material. Editorial and workplace imagery requires an explicit source and redistribution status.',
    renderingRecipe: ['Choose one verified metric', 'Set it as the visual anchor', 'Align evidence to a ledger', 'Apply yellow to the decisive line only', 'Pair the outcome with readable product proof'],
    typography: 'Lausanne carries the identity across display and body roles. Use lighter weights for confident spacious headlines, regular weights for product detail, and avoid synthetic bolding.',
  },
  references: referencePack('ramp', {
    owner: 'Ramp',
    sourceUrl: 'https://ramp.com',
    official: ['Current Ramp homepage', 'Ramp product dashboard', 'Ramp corporate card', 'Savings proof module', 'Ramp newsroom', 'Ramp customer story'],
    officialSources: ['https://ramp.com', 'https://ramp.com/products', 'https://support.ramp.com/cards/', 'https://ramp.com/press', 'https://ramp.com/press', 'https://ramp.com/customers'],
    campaign: ['Finance benchmark report', 'Operator portrait campaign', 'Product launch evidence', 'Finance event environment'],
    concept: ['Highlighted ledger entry', 'Time reclaimed from paperwork', 'Warm editorial financial archive', 'Oversized verified numeral'],
    material: ['Warm accounting paper', 'Highlighter and graphite notation', 'Corporate card material study'],
    motion: ['Savings counter resolution', 'Approval-flow sequence', 'Ledger-to-product transition'],
  }),
};

export const MINTLIFY_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'knowledge-system',
    preview: 'knowledge-beam',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Documentation home', 'API playground', 'Theme gallery', 'Product launch', 'Long-form guide', 'Developer event desk'],
    color: 'Near-black knowledge surfaces and restrained mint signals create focus. Green functions as illumination, navigation, and successful discovery rather than ambient decoration.',
    graphicDevice: 'The knowledge beam reveals the relevant document, answer, or interface state within a larger information field.',
    imagery: 'Prioritize readable product captures, code, API requests, navigation, search, and authored documentation. Dimensional light may frame these surfaces but must never obscure them.',
    layout: 'Create calm reading environments with strong left rails, visible document hierarchy, and one illuminated answer. Editorial serif moments add contrast without turning the product into a magazine mockup.',
    logo: 'Use the sprout mark and wordmark as navigational anchors. Preserve the official green and approved light/dark variants.',
    motion: 'A soft green signal travels from query to relevant document and settles on an answer. Page transitions preserve reading position and avoid cinematic interruption.',
    personality: 'Helpful, literate, composed, developer-aware, and quietly magical.',
    premise: 'Mintlify is the front door to a product. Its identity should make complex knowledge feel authored, discoverable, and ready to use.',
    prohibited: ['No illegible code screenshots', 'No full-canvas green fog', 'No unrelated botanical imagery', 'No interface font leaking into brand output'],
    provenance: 'Use official product and documentation captures as research/proof. Abstract light and editorial imagery should be original or redistributable.',
    renderingRecipe: ['Start with a real document or API task', 'Preserve readable hierarchy', 'Place one mint signal on the answer', 'Use serif contrast sparingly', 'Verify the product remains the hero'],
    typography: 'Arizona Flare leads primary editorial headlines. Inter carries navigation, product UI, buttons, and reading text. Paper Mono is a compact data accent, while Geist Mono is reserved for code, API examples, and terminal output.',
  },
  references: referencePack('mintlify', {
    owner: 'Mintlify',
    sourceUrl: 'https://mintlify.com',
    official: ['Current Mintlify homepage', 'Documentation product home', 'API reference surface', 'AI answer flow', 'Theme customization', 'Mintlify customer documentation'],
    officialSources: ['https://mintlify.com', 'https://mintlify.com/docs/index', 'https://mintlify.com/docs', 'https://learn.mintlify.com', 'https://mintlify.com/docs/customize', 'https://mintlify.com/customers'],
    campaign: ['Product launch beam', 'Documentation redesign story', 'Developer guide cover', 'Conference documentation desk'],
    concept: ['Green light finding one page', 'Knowledge archive in darkness', 'Editorial page and terminal contrast', 'Search result illumination'],
    material: ['Dark glass and mint light', 'Fine paper documentation index', 'Annotated code printout'],
    motion: ['Query-to-answer beam', 'Document navigation transition', 'Theme transformation sequence'],
  }),
};

export const TAILWIND_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'utility-current',
    preview: 'utility-wave',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Framework documentation', 'Playground', 'Responsive component proof', 'Release system', 'Community showcase', 'Workshop kit'],
    color: 'Cyan signals active utility and composition against slate technical surfaces. White keeps code legible; supporting blues should never blur into a generic SaaS gradient.',
    graphicDevice: 'The utility current shows small classes accumulating into expressive interface behavior. Twin wave forms connect source code to rendered result.',
    imagery: 'Use real HTML, CSS output, component states, responsive comparisons, and community work. Every screenshot should show a technique or outcome clearly.',
    layout: 'Pair code with result, often as adjacent or interlocking fields. Utility labels may annotate the composition, but the finished interface must retain visual priority.',
    logo: 'Use the official twin-wave mark and approved wordmark variants. Keep sufficient clear space and never repurpose the mark as an arbitrary pattern.',
    motion: 'Utility-sized units assemble into a current, then resolve into a working interface. Motion is responsive and quick, with a clear before/after relationship.',
    personality: 'Practical, fast, generous, composable, and craft-oriented.',
    premise: 'Tailwind makes small, explicit utilities accumulate into any design. The identity should demonstrate that composability instead of merely saying “build anything.”',
    prohibited: ['No fake code', 'No cyan fog without a technical subject', 'No inaccessible code contrast', 'No implication of official affiliation in derivative work'],
    provenance: 'Official Tailwind assets and site captures remain governed by their trademark terms. Community work must retain creator attribution and usage status.',
    renderingRecipe: ['Select one real component', 'Show code and result together', 'Use cyan for the active utility path', 'Annotate only meaningful classes', 'Verify every responsive state'],
    typography: 'The product’s sans system carries interface and explanatory text; IBM Plex Mono supports code examples and utility labels without taking over editorial copy.',
  },
  references: referencePack('tailwind', {
    owner: 'Tailwind Labs',
    sourceUrl: 'https://tailwindcss.com',
    official: ['Current Tailwind homepage', 'Tailwind documentation', 'Playground interface', 'Responsive utility example', 'Tailwind UI component', 'Tailwind showcase project'],
    officialSources: ['https://tailwindcss.com', 'https://tailwindcss.com/docs', 'https://play.tailwindcss.com', 'https://tailwindcss.com/docs/responsive-design', 'https://tailwindui.com', 'https://tailwindcss.com/showcase'],
    campaign: ['Major version release', 'Community build story', 'Workshop visual system', 'Utility migration guide'],
    concept: ['Twin currents meeting', 'Class tokens assembling a surface', 'Responsive breakpoint sequence', 'Cyan signal through slate'],
    material: ['Technical blueprint in cyan', 'Layered transparent interface sheets', 'Code annotation print'],
    motion: ['Utility assembly', 'Breakpoint transition', 'Code-to-component reveal'],
  }),
};

export const VITEPLUS_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'cinematic-field',
    preview: 'unified-terminal',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Unified terminal', 'Toolchain diagram', 'Performance benchmark', 'Launch sequence', 'Migration guide', 'Web tooling keynote'],
    color: 'A white technical shell contains intense violet, blue, and mint energy fields. The spectrum represents convergence and acceleration; mint remains a success signal.',
    graphicDevice: 'The convergence field bends many runtimes, packages, checks, and build paths toward one executable command.',
    imagery: 'Use credible terminal output, measured benchmarks, framework marks, isometric runtime diagrams, and granular build evidence. Grainy energy fields supply atmosphere around—not over—the proof.',
    layout: 'Reticle-like dividers and precise technical rails organize generous white space. A terminal or stack diagram anchors each composition while the energy field creates depth behind it.',
    logo: 'Use the official bolt and light/dark Vite+ logotypes with their original color behavior. Do not invent secondary sigils or distort the parenthetical form.',
    motion: 'Separate tool paths curve inward, lock into the `vp` command, and accelerate forward. Terminal state changes stay readable and reduced motion retains the completed command state.',
    personality: 'Unified, fast, exact, modern, and confidently infrastructural.',
    premise: 'Vite+ replaces a fragmented toolchain with one coherent flow. The visual system makes many paths visibly converge without sacrificing the credibility of the tools underneath.',
    prohibited: ['No fake benchmark figures', 'No energy field obscuring terminal output', 'No excessive rounded SaaS cards', 'No invented Vite+ marks'],
    provenance: 'Use current product documentation, official framework marks, and verified benchmark context. Atmospheric fields should be original shader or raster exports.',
    renderingRecipe: ['Choose one toolchain task', 'Show the exact command and result', 'Converge supporting tools toward it', 'Place the proof on a white technical shell', 'Use spectrum energy only behind the focal surface'],
    typography: 'APK Protocol provides the primary technical voice, KH Teka Mono supports terminal and metadata, and supporting sans text remains restrained and never visually heavier than 550.',
  },
  references: referencePack('viteplus', {
    owner: 'VoidZero',
    sourceUrl: 'https://viteplus.dev',
    official: ['Current Vite+ homepage', 'Create command terminal', 'Build output terminal', 'Check command output', 'Unified toolchain diagram', 'Installation guide'],
    officialSources: ['https://viteplus.dev', 'https://viteplus.dev/guide/create', 'https://viteplus.dev/guide/build', 'https://viteplus.dev/guide', 'https://viteplus.dev', 'https://viteplus.dev/guide/install'],
    campaign: ['Beta launch announcement', 'Benchmark comparison', 'Framework ecosystem panel', 'Toolchain keynote'],
    concept: ['Many paths converging', 'Electric violet grain field', 'Reticle technical shell', 'Isometric runtime stack'],
    material: ['Translucent violet film', 'Technical plotting paper', 'Granular light exposure'],
    motion: ['Tool-path convergence', 'Terminal success sequence', 'Runtime stack assembly'],
  }),
};

export const CLOUDFLARE_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'network-atlas',
    preview: 'network-horizon',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Global network atlas', 'Connectivity dashboard', 'Workers developer surface', 'Internet report', 'Incident analysis', 'Network summit'],
    color: 'Orange is the network intervention signal against cream, white, and near-black. Product sub-colors may clarify architecture but orange remains the primary connective cue.',
    graphicDevice: 'The network horizon marks the point where a request meets Cloudflare’s global edge and gains security, performance, reliability, or compute.',
    imagery: 'Use real topology, city and cable infrastructure, traffic data, operational dashboards, developer runtimes, and human-scale stories about the Internet.',
    layout: 'Organize information like an atlas: one horizon or route, clear labels, accurate node relationships, and scalable context from local request to global network.',
    logo: 'Use official cloud and wordmark assets in documented orange, black, or white arrangements. Maintain trademark restrictions and never reconstruct the cloud from generic circles.',
    motion: 'Requests travel to the orange horizon, resolve across edge nodes, and reach an origin or user. Speed supports comprehension; routes must remain technically plausible.',
    personality: 'Global, useful, resilient, technically authoritative, and public-minded.',
    premise: 'Cloudflare makes an invisible connectivity layer visible. The identity should show where the network acts and why that intervention matters.',
    prohibited: ['No inaccurate topology', 'No generic orange cloudscape', 'No fabricated network scale', 'No unofficial mark construction'],
    provenance: 'Official network, product, and company sources remain research/proof. Maps and infrastructure photography need explicit geographic and licensing metadata.',
    renderingRecipe: ['Define the request or network event', 'Draw one technically plausible route', 'Use orange at the intervention horizon', 'Label nodes and scale accurately', 'Pair the map with operational evidence'],
    typography: 'FT Kunst Grotesk supplies approachable authority; Apercu Mono Pro is limited to network labels, code, metrics, and technical annotation.',
  },
  references: referencePack('cloudflare', {
    owner: 'Cloudflare',
    sourceUrl: 'https://cloudflare.com',
    official: ['Current Cloudflare homepage', 'Global network map', 'Cloudflare dashboard', 'Workers developer platform', 'Internet insights report', 'Cloudflare press materials'],
    officialSources: ['https://cloudflare.com', 'https://cloudflare.com/network', 'https://dash.cloudflare.com', 'https://developers.cloudflare.com/workers', 'https://radar.cloudflare.com', 'https://www.cloudflare.com/press/press-kit/'],
    campaign: ['Connectivity Cloud launch', 'Internet impact story', 'Security incident report', 'Developer Week campaign'],
    concept: ['Orange edge horizon', 'Request crossing a global network', 'City-scale infrastructure atlas', 'Human and origin endpoints'],
    material: ['Fiber optic cable detail', 'Orange safety coating and metal', 'Printed network atlas'],
    motion: ['Edge route resolution', 'Traffic surge sequence', 'Global node activation'],
  }),
};

export const STRIPE_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'product-spectrum',
    preview: 'programmable-field',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Payment surface', 'Developer integration', 'Economic report', 'Product launch', 'Stripe Sessions', 'Global business story'],
    color: 'Blurple, slate, white, and dimensional spectral fields communicate programmable movement. Every gradient must bend around a concrete product or economic object.',
    graphicDevice: 'The programmable field visualizes money and data in motion around a transaction, workflow, business, or market signal.',
    imagery: 'Use detailed product UI, payment objects, business environments, founders, global economic stories, and dimensional abstract fields tied to a specific claim.',
    layout: 'Balance ambitious headlines with exact implementation evidence. Dimensional fields can occupy large areas, but code, product objects, and economic figures remain crisp.',
    logo: 'Use the official Stripe wordmark in slate, blurple, or white only. Do not invent a symbol or use the wordmark as a texture.',
    motion: 'A transaction or product object moves through layered color and resolves into a clear state. Depth, parallax, and gradients support the workflow rather than becoming a screensaver.',
    personality: 'Ambitious, precise, global, developer-first, and economically literate.',
    premise: 'Stripe makes economic infrastructure programmable. The identity should connect large-scale possibility to a concrete integration or business outcome.',
    prohibited: ['No unofficial Stripe symbol', 'No gradient without a product object', 'No unreadable code', 'No unverified economic figures'],
    provenance: 'Official wordmarks, product captures, and company material retain Stripe usage terms. Business photography and external economic data require independent provenance.',
    renderingRecipe: ['Choose one economic object', 'Place it in a dimensional field', 'Show the exact product or code path', 'Use official wordmark colors only', 'Resolve the story into a measurable state'],
    typography: 'Söhne supports the full product and editorial hierarchy; Source Code Pro is reserved for APIs, terminal output, and exact implementation detail.',
  },
  references: referencePack('stripe', {
    owner: 'Stripe',
    sourceUrl: 'https://stripe.com',
    official: ['Current Stripe homepage', 'Stripe payment surface', 'Developer documentation', 'Stripe product launch', 'Stripe Sessions environment', 'Annual letter and economic report'],
    officialSources: ['https://stripe.com', 'https://stripe.com/payments/checkout', 'https://docs.stripe.com', 'https://stripe.com/newsroom', 'https://stripe.com/sessions', 'https://stripe.com/newsroom/brand-assets'],
    campaign: ['Internet economy story', 'Founder and business portrait', 'Global payments expansion', 'Developer integration campaign'],
    concept: ['Programmable color field', 'Transaction object in depth', 'Economic signal crossing borders', 'Layered product and code'],
    material: ['Iridescent payment card surface', 'Dimensional glass and paper', 'Global commerce receipt archive'],
    motion: ['Payment object resolution', 'Layered field transition', 'Code-to-success workflow'],
  }),
};

export const BASEMENT_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'cinematic-field',
    preview: 'editorial-interruption',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Project-world opener', 'Identity case study', 'Campaign triptych', 'Process writing', 'Physical object', 'Studio presentation'],
    color: 'Begin with a disciplined project-specific foundation, then introduce one high-intensity signal color or material gesture. Color should contaminate the image world rather than sit behind it as a generic panel.',
    graphicDevice: 'The engineered interruption is one deliberate break in an otherwise restrained editorial system: a crop, smear, cut, block, spectral rail, or tactile surface that embodies the project idea.',
    imagery: 'Images define the identity world. Select subjects through one conceptual phrase, then connect them through crop, grade, grain, blur, dither, or material treatment. Literal product relevance is optional; conceptual coherence is mandatory.',
    layout: 'Alternate cinematic full-bleed images, quiet editorial spreads, triptychs, foundation pages, and functional applications. Large gutters and hard rectangular edges keep dense moments from becoming busy.',
    logo: 'Treat each mark as architecture: enlarge, crop, repeat, mask, or isolate it only when that behavior is derived from the mark’s concept. Maintain an unmodified master logo family alongside expressive applications.',
    motion: 'Animate the central project gesture and keep supporting elements quiet. Movement may smear, morph, reveal, or interrupt, but it must express the same concept as the still system.',
    personality: 'Conceptual, tactile, culturally alert, editorially confident, and rigorously art-directed.',
    premise: 'Basement builds complete project worlds rather than decorating templates. Strategy, image selection, writing, typography, motion, and applications all express one central idea.',
    prohibited: ['No universal Basement composition', 'No device added only to fill space', 'No unrelated stock collage', 'No repeated case-study formula', 'No busy combination of every available effect'],
    provenance: 'Use published studio work as research-only reference. New Glyphfield outputs must use original or appropriately licensed assets and should never redistribute private guideline pages.',
    renderingRecipe: ['Write one conceptual phrase', 'Select an image world that expresses it', 'Choose one engineered interruption', 'Alternate intensity with visual quiet', 'Prove the system in real applications'],
    typography: 'Typography changes with the project concept. Flauta and the bundled studio faces support the current example, but the governing rule is deliberate contrast, disciplined weight, and strong editorial hierarchy.',
  },
  references: referencePack('basement', {
    owner: 'Basement Studio',
    sourceUrl: 'https://basement.studio',
    official: ['Current Basement homepage', 'Selected identity case study', 'Project process writing', 'Digital product application', 'Campaign application', 'Physical brand application'],
    campaign: ['Cinematic case-study opener', 'Image triptych', 'Editorial strategy spread', 'Environmental brand moment'],
    concept: ['One project-world thesis', 'Engineered visual interruption', 'Unrelated subjects joined by one idea', 'Alternating intensity and quiet'],
    material: ['Printed case-study paper', 'Grain, dither, and halation study', 'Tactile object and environmental mockup'],
    motion: ['Central gesture in motion', 'Image-treatment transition', 'Case-study pacing sequence'],
  }),
};
