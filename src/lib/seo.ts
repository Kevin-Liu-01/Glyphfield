import type { Metadata } from 'next';

import packageJson from '../../package.json';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import { STUDIO_TOOLS } from '@/lib/studioCatalog';

const DEFAULT_SITE_URL = 'https://www.glyphfield.com';

/** Public origin for canonical URLs, Open Graph, the sitemap, and robots.txt. Self-hosters set NEXT_PUBLIC_STUDIO_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_STUDIO_URL || DEFAULT_SITE_URL
).replace(/\/$/, '');

export const SOFTWARE_VERSION: string = packageJson.version;

export const HOME_TITLE = 'Glyphfield: open-source brand design and motion studio';

export const HOME_DESCRIPTION =
  'Glyphfield is a free, open-source brand design studio in the browser. It turns one brand identity into motion, graphics, templates, and production files.';

export const STUDIO_TITLE = 'Glyphfield Studio: brand identity and motion editor';

export const STUDIO_DESCRIPTION =
  'Glyphfield Studio is a free browser workspace for brand identity, motion, shader compositions, social images, and slides. Projects are saved in your browser.';

export const DOCS_SITE_NAME = `${PRODUCT_BRAND.name} Docs`;

/** A real Studio capture in public/, used as the SoftwareApplication screenshot. */
export const STUDIO_SCREENSHOT = {
  caption: 'Design Lab in Glyphfield Studio with a shader layer behind the General Translation mark',
  height: 900,
  path: '/screenshots/studio-gt-design-lab-light-2026.png',
  width: 1600,
} as const;

const CREATOR_URL = 'https://github.com/Kevin-Liu-01';
const LICENSE_URL = `${PRODUCT_BRAND.repository.url}/blob/main/LICENSE`;

export const SEO_KEYWORDS = [
  'brand design software',
  'brand identity system',
  'brand studio',
  'design system',
  'motion design',
  'open source design tool',
  'AI design agents',
  'SVG generator',
] as const;

/** Rendered as the visible landing FAQ and as the FAQPage JSON-LD, so both always carry the same text. */
export const HOME_FAQS = [
  {
    answer:
      'Glyphfield is a free, open-source brand design studio that runs in a web browser. You define a brand identity once, and every Studio tool uses it to make brand books, moodboards, motion, social images, slides, and UI components.',
    question: 'What is Glyphfield?',
  },
  {
    answer:
      'Glyphfield is free to use at www.glyphfield.com, and its source code is on GitHub under the MIT License. Bundled third-party brand marks, fonts, and shader packages keep their own licenses.',
    question: 'Is Glyphfield free and open source?',
  },
  {
    answer:
      'Glyphfield has no accounts or sign-in. The Studio keeps projects, drafts, and named designs in your browser’s localStorage and IndexedDB, and uploaded images and fonts stay in the browser. The generation API processes requests in memory and does not store them.',
    question: 'Do I need an account, and where is my work stored?',
  },
  {
    answer:
      'The Studio has tools for brand identity, brand elements, moodboards, brand books, animation, Lottie files, layered Design Lab compositions, color tokens, typography, OpenGraph images, terminal cards, partnership lockups, blog covers, slide decks, and a component library. Every tool reads the same saved identity, so a color or font change reaches the boards, the brand book, templates, components, and motion.',
    question: 'What can I make with Glyphfield?',
  },
  {
    answer:
      'Glyphfield exports PNG, JPG, SVG, GIF, MP4, PDF, HTML email, JSON, and Lottie files. The brand kit adds W3C DTCG design tokens, CSS custom properties, a Tailwind CSS v4 theme, and a brand.md guide. The component library produces React with Tailwind or HTML with CSS.',
    question: 'What file formats can Glyphfield export?',
  },
  {
    answer:
      'The Shader Library combines Paper Shaders (Apache-2.0), the Shaders.com WebGPU components (MIT), ShaderGradient (MIT), and original Glyphfield shaders. It also includes a fluid simulation adapted from Pavel Dobryakov’s WebGL Fluid Simulation (MIT) and a cloth material adapted from HoloCloth (MIT). The /api/materials endpoint lists every material with its engine.',
    question: 'Which shader engines does Glyphfield include?',
  },
  {
    answer:
      'AI agents can generate SVG and JSON through the HTTP API described at /openapi.json. Inside the Studio, agents operate every tool through the window.glyphfield.studio Browser API. The documentation is available as plain text at /llms.txt and /llms-full.txt and as Markdown by adding .md to any docs URL, and the repository includes installable Agent Skills.',
    question: 'Can AI agents use Glyphfield?',
  },
] as const;

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const WEBSITE_ID = `${SITE_URL}/#website`;
const CREATOR_ID = `${SITE_URL}/#creator`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const SOFTWARE_ID = `${SITE_URL}/#software`;
const SOURCE_CODE_ID = `${SITE_URL}/#source-code`;

function softwareApplicationNode() {
  return {
    '@id': SOFTWARE_ID,
    '@type': 'SoftwareApplication',
    alternateName: PRODUCT_BRAND.displayName,
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Brand design and motion graphics',
    author: { '@id': CREATOR_ID },
    browserRequirements: 'Requires JavaScript and a modern web browser',
    description: HOME_DESCRIPTION,
    featureList: STUDIO_TOOLS.map(({ name }) => name),
    image: absoluteUrl('/opengraph-image'),
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    license: LICENSE_URL,
    name: PRODUCT_BRAND.name,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    operatingSystem: 'Any',
    sameAs: [PRODUCT_BRAND.repository.url],
    screenshot: {
      '@type': 'ImageObject',
      caption: STUDIO_SCREENSHOT.caption,
      height: STUDIO_SCREENSHOT.height,
      url: absoluteUrl(STUDIO_SCREENSHOT.path),
      width: STUDIO_SCREENSHOT.width,
    },
    softwareVersion: SOFTWARE_VERSION,
    url: absoluteUrl('/studio'),
  };
}

/** Site-wide graph rendered by the root layout on every page. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': WEBSITE_ID,
        '@type': 'WebSite',
        alternateName: PRODUCT_BRAND.displayName,
        description: HOME_DESCRIPTION,
        inLanguage: 'en-US',
        name: PRODUCT_BRAND.name,
        publisher: { '@id': CREATOR_ID },
        url: absoluteUrl('/'),
      },
      {
        '@id': CREATOR_ID,
        '@type': 'Person',
        name: PRODUCT_BRAND.company,
        sameAs: [CREATOR_URL],
        url: CREATOR_URL,
      },
      {
        '@id': ORGANIZATION_ID,
        '@type': 'Organization',
        founder: { '@id': CREATOR_ID },
        logo: absoluteUrl('/icon-512.png'),
        name: PRODUCT_BRAND.name,
        sameAs: [PRODUCT_BRAND.repository.url],
        url: absoluteUrl('/'),
      },
    ],
  };
}

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      softwareApplicationNode(),
      {
        '@id': SOURCE_CODE_ID,
        '@type': 'SoftwareSourceCode',
        author: { '@id': CREATOR_ID },
        codeRepository: PRODUCT_BRAND.repository.url,
        description: `Source code for ${PRODUCT_BRAND.name}, a Next.js application written in TypeScript.`,
        license: LICENSE_URL,
        name: `${PRODUCT_BRAND.name} source code`,
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Node.js',
        targetProduct: { '@id': SOFTWARE_ID },
        url: PRODUCT_BRAND.repository.url,
        version: SOFTWARE_VERSION,
      },
      {
        '@id': `${SITE_URL}/#faq`,
        '@type': 'FAQPage',
        mainEntity: HOME_FAQS.map(({ answer, question }) => ({
          '@type': 'Question',
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
          name: question,
        })),
        url: absoluteUrl('/'),
      },
    ],
  };
}

export function studioJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [softwareApplicationNode()],
  };
}

export type DocsSection = {
  name: string;
  url?: string;
};

export type DocsPageSeoInput = {
  dateModified?: Date;
  description: string;
  imageUrl: string;
  /** Folders between the docs root and the page, outermost first. */
  sections: readonly DocsSection[];
  title: string;
  url: string;
};

export function docsPageTitle({ sections, title, url }: Pick<DocsPageSeoInput, 'sections' | 'title' | 'url'>) {
  if (url === '/docs') return `${PRODUCT_BRAND.name} documentation`;
  const section = sections.at(-1)?.name;
  return section && section !== title
    ? `${title} · ${section} · ${DOCS_SITE_NAME}`
    : `${title} · ${DOCS_SITE_NAME}`;
}

export function docsPageMetadata(input: DocsPageSeoInput): Metadata {
  const title = docsPageTitle(input);
  const { dateModified, description, imageUrl, url } = input;

  return {
    alternates: {
      canonical: url,
      types: {
        'text/markdown': `${url}.md`,
      },
    },
    category: 'documentation',
    description,
    openGraph: {
      description,
      images: [{ alt: `${input.title}, ${PRODUCT_BRAND.name} documentation`, height: 630, url: imageUrl, width: 1200 }],
      locale: 'en_US',
      ...(dateModified ? { modifiedTime: dateModified.toISOString() } : {}),
      siteName: PRODUCT_BRAND.name,
      title,
      type: 'article',
      url,
    },
    title: { absolute: title },
    twitter: {
      card: 'summary_large_image',
      description,
      images: [imageUrl],
      title,
    },
  };
}

export function docsPageJsonLd(input: DocsPageSeoInput) {
  const canonicalUrl = absoluteUrl(input.url);
  const trail = [
    { name: PRODUCT_BRAND.name, url: '/' },
    ...(input.url === '/docs' ? [] : [{ name: 'Documentation', url: '/docs' }]),
    ...input.sections.filter((section) => section.url && section.url !== '/docs' && section.url !== input.url),
    { name: input.title, url: input.url },
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': `${canonicalUrl}#article`,
        '@type': 'TechArticle',
        about: { '@id': SOFTWARE_ID },
        author: { '@id': CREATOR_ID },
        ...(input.dateModified ? { dateModified: input.dateModified.toISOString() } : {}),
        description: input.description,
        headline: input.title,
        image: absoluteUrl(input.imageUrl),
        inLanguage: 'en-US',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntityOfPage: canonicalUrl,
        publisher: { '@id': CREATOR_ID },
        url: canonicalUrl,
      },
      {
        '@id': `${canonicalUrl}#breadcrumb`,
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((item, index) => ({
          '@type': 'ListItem',
          item: absoluteUrl(item.url ?? '/docs'),
          name: item.name,
          position: index + 1,
        })),
      },
    ],
  };
}
