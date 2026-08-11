import './globals.css';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { GTProvider } from 'gt-next';

import AppThemeProvider from '@/components/AppThemeProvider';
import {
  Be_Vietnam_Pro,
  Geist_Mono,
  Rethink_Sans,
  Schibsted_Grotesk,
} from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PRODUCT_BRAND } from '@/lib/productBrand';
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SEO_KEYWORDS,
  SITE_URL,
  serializeJsonLd,
  websiteJsonLd,
} from '@/lib/seo';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const beVietnamPro = Be_Vietnam_Pro({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  weight: ['400', '500'],
});

const rethinkSans = Rethink_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-rethink-sans',
  weight: 'variable',
});

const schibstedGrotesk = Schibsted_Grotesk({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-schibsted-grotesk',
  weight: 'variable',
});

export const metadata: Metadata = {
  applicationName: PRODUCT_BRAND.name,
  authors: [{ name: PRODUCT_BRAND.company, url: 'https://github.com/Kevin-Liu-01' }],
  category: 'design',
  classification: 'Brand design and motion graphics software',
  creator: PRODUCT_BRAND.company,
  description: HOME_DESCRIPTION,
  keywords: [...SEO_KEYWORDS],
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(SITE_URL),
  publisher: PRODUCT_BRAND.company,
  title: {
    default: HOME_TITLE,
    template: `%s | ${PRODUCT_BRAND.name}`,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    description: HOME_DESCRIPTION,
    locale: 'en_US',
    siteName: PRODUCT_BRAND.name,
    title: HOME_TITLE,
    type: 'website',
    url: '/',
  },
  referrer: 'origin-when-cross-origin',
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    index: true,
  },
  twitter: {
    card: 'summary_large_image',
    description: HOME_DESCRIPTION,
    title: HOME_TITLE,
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { color: '#f8f8f5', media: '(prefers-color-scheme: light)' },
    { color: '#121212', media: '(prefers-color-scheme: dark)' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang='en'
      className={`${geistMono.variable} ${beVietnamPro.variable} ${rethinkSans.variable} ${schibstedGrotesk.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd()) }}
          type='application/ld+json'
        />
        <link href='/llms.txt' rel='alternate' title='Glyphfield agent and LLM instructions' type='text/plain' />
        <link href='/openapi.json' rel='service-desc' type='application/vnd.oai.openapi+json' />
        <link href='https://api.fontshare.com' rel='preconnect' />
        <link href='https://cdn.fontshare.com' rel='preconnect' />
        <link
          href='https://api.fontshare.com/v2/css?f[]=switzer@400,500&display=swap'
          rel='stylesheet'
        />
      </head>
      <body className='flex min-h-screen flex-col'>
        <AppThemeProvider>
          <RootProvider theme={{ enabled: false }}>
            <GTProvider>{children}</GTProvider>
          </RootProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
