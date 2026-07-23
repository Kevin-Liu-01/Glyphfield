import { withGTConfig } from 'gt-next/config';
import { createMDX } from 'fumadocs-mdx/next';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

const withMDX = createMDX();

export default withMDX(withGTConfig(nextConfig, {
  cacheUrl: null,
  config: './gt.config.json',
  getLocalePath: './src/getLocale.ts',
  ignoreBrowserLocales: true,
  runtimeUrl: null,
}));
