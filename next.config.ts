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
        {
          source: '/',
          has: [{ type: 'host', value: 'docs.glyphfield.com' }],
          destination: '/docs',
        },
        { destination: '/api/docs', source: '/docs.md' },
        { destination: '/api/docs/:path*', source: '/docs/:path*.md' },
      ],
      fallback: [
        {
          source: '/:path*.md',
          has: [{ type: 'host', value: 'docs.glyphfield.com' }],
          destination: '/api/docs/:path*',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'docs.glyphfield.com' }],
          destination: '/docs/:path*',
        },
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
