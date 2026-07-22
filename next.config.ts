import { withGTConfig } from 'gt-next/config';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withGTConfig(nextConfig, {
  cacheUrl: null,
  config: './gt.config.json',
  getLocalePath: './src/getLocale.ts',
  ignoreBrowserLocales: true,
  runtimeUrl: null,
});
