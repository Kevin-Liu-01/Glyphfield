import { PRODUCT_BRAND } from '@/lib/productBrand';

const DEFAULT_SITE_URL = 'https://studio.generaltranslation.com';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_STUDIO_URL ?? DEFAULT_SITE_URL
).replace(/\/$/, '');

export const HOME_TITLE = 'Glyphfield — Open-source brand design and motion studio';

export const HOME_DESCRIPTION =
  'Build brand identity systems, motion, graphics, and production-ready assets in one local-first workspace for designers, developers, and AI agents.';

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

export const HOME_FAQS = [
  {
    answer:
      'Glyphfield is a free, open-source, local-first brand studio for defining an identity and turning it into motion, graphics, product UI, templates, and portable production assets.',
    question: 'What is Glyphfield?',
  },
  {
    answer:
      'Glyphfield is built for designers, developers, brand teams, and AI agents that need to work from the same identity system and generation rules.',
    question: 'Who is Glyphfield for?',
  },
  {
    answer:
      'Glyphfield can create identity systems, moodboards, product and marketing graphics, animated marks, live shader materials, templates, and downloadable PNG, SVG, GIF, and JSON artifacts.',
    question: 'What can I create with Glyphfield?',
  },
  {
    answer:
      'Yes. Agents can discover Glyphfield through llms.txt, an OpenAPI 3.1 document, versioned catalogs, and a structured generation API. Browser-capable agents can also use the visual Studio.',
    question: 'Can AI agents use Glyphfield?',
  },
  {
    answer:
      'Yes. Glyphfield source is available under the MIT License. Browser projects and uploaded files stay in the browser, while generation API requests are processed in memory without persisting the submitted identity or asset.',
    question: 'Is Glyphfield free, open source, and local-first?',
  },
] as const;

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': `${SITE_URL}/#website`,
        '@type': 'WebSite',
        alternateName: PRODUCT_BRAND.displayName,
        description: HOME_DESCRIPTION,
        inLanguage: 'en-US',
        name: PRODUCT_BRAND.name,
        publisher: { '@id': `${SITE_URL}/#creator` },
        url: absoluteUrl('/'),
      },
      {
        '@id': `${SITE_URL}/#creator`,
        '@type': 'Person',
        name: PRODUCT_BRAND.company,
        sameAs: ['https://github.com/Kevin-Liu-01'],
        url: 'https://github.com/Kevin-Liu-01',
      },
    ],
  };
}

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': `${SITE_URL}/#software`,
        '@type': 'SoftwareApplication',
        applicationCategory: 'DesignApplication',
        applicationSubCategory: 'Brand design and motion graphics',
        author: { '@id': `${SITE_URL}/#creator` },
        description: HOME_DESCRIPTION,
        featureList: [
          'Brand identity systems',
          'Motion and animated mark design',
          'Live shader and material library',
          'Product and marketing artifact templates',
          'PNG, SVG, GIF, and JSON export',
          'Structured API for AI agents',
        ],
        image: absoluteUrl('/opengraph-image'),
        isAccessibleForFree: true,
        license: 'https://github.com/Kevin-Liu-01/Glyphfield/blob/main/LICENSE',
        name: PRODUCT_BRAND.name,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        operatingSystem: 'Any',
        sameAs: 'https://github.com/Kevin-Liu-01/Glyphfield',
        url: absoluteUrl('/studio'),
      },
      {
        '@type': 'FAQPage',
        mainEntity: HOME_FAQS.map(({ answer, question }) => ({
          '@type': 'Question',
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
          name: question,
        })),
      },
    ],
  };
}
