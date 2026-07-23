import 'lenis/dist/lenis.css';
import './globals.css';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { GTProvider } from 'gt-next';
import { Geist_Mono, Inter } from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PRODUCT_BRAND } from '@/lib/productBrand';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_BRAND.name,
    template: `%s · ${PRODUCT_BRAND.name}`,
  },
  description: PRODUCT_BRAND.description,
  robots: {
    follow: true,
    index: true,
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
    <html lang='en' className={`${inter.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className='flex min-h-screen flex-col'>
        <RootProvider>
          <GTProvider>{children}</GTProvider>
        </RootProvider>
      </body>
    </html>
  );
}
