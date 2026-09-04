import { withGTConfig } from 'gt-next/config';
import { createMDX } from 'fumadocs-mdx/next';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        headers: [
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
        source: '/llms.txt',
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { destination: '/api/docs', source: '/docs.md' },
        { destination: '/api/docs/:path*', source: '/docs/:path*.md' },
      ],
    };
  },
};

const withMDX = createMDX();

export default withMDX(withGTConfig(nextConfig, {
  cacheUrl: null,
  config: './gt.config.json',
  getLocalePath: './src/getLocale.ts',
  ignoreBrowserLocales: true,
  runtimeUrl: null,
}));
