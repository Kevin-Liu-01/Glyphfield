import 'lenis/dist/lenis.css';
import './globals.css';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { GTProvider } from 'gt-next';
import {
  Be_Vietnam_Pro,
  Geist_Mono,
  Rethink_Sans,
  Schibsted_Grotesk,
} from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PRODUCT_BRAND } from '@/lib/productBrand';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const beVietnamPro = Be_Vietnam_Pro({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  weight: ['400', '500', '600', '700'],
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_STUDIO_URL ?? 'https://studio.generaltranslation.com'
  ),
  title: {
    default: PRODUCT_BRAND.name,
    template: `%s · ${PRODUCT_BRAND.name}`,
  },
  description: PRODUCT_BRAND.description,
  openGraph: {
    description: PRODUCT_BRAND.description,
    siteName: PRODUCT_BRAND.name,
    title: PRODUCT_BRAND.name,
    type: 'website',
  },
  robots: {
    follow: true,
    index: true,
  },
  twitter: {
    card: 'summary_large_image',
    description: PRODUCT_BRAND.description,
    title: PRODUCT_BRAND.name,
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
        <link href='https://api.fontshare.com' rel='preconnect' />
        <link href='https://cdn.fontshare.com' rel='preconnect' />
        <link
          href='https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap'
          rel='stylesheet'
        />
      </head>
      <body className='flex min-h-screen flex-col'>
        <RootProvider>
          <GTProvider>{children}</GTProvider>
        </RootProvider>
      </body>
    </html>
  );
}
