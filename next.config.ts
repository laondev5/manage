import type { NextConfig } from 'next';

const apiOrigin = (
  process.env.API_ORIGIN ??
  process.env.API_BASE_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${apiOrigin}/api/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
