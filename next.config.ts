import { withGTConfig } from 'gt-next/config';
import { createMDX } from 'fumadocs-mdx/next';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Next 16 does not optimize this barrel by default; it keeps a root
    // `@phosphor-icons/react` import from compiling every icon.
    optimizePackageImports: ['@phosphor-icons/react'],
  },
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
  async redirects() {
    return [
      { destination: '/docs/skills', permanent: true, source: '/docs/agents/skills' },
      { destination: '/docs/skills.md', permanent: true, source: '/docs/agents/skills.md' },
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
  getRegionPath: './src/getRegion.ts',
  ignoreBrowserLocales: true,
  runtimeUrl: null,
}));
