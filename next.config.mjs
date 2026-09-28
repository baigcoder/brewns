/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['three'],
  images: {
    unoptimized: true,
  },
  // Photos, models and fonts rarely change: let browsers and the CDN keep them
  // for a week and refresh in the background, so repeat visits load instantly.
  async headers() {
    return [
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/draco/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] },
    ];
  },
};

export default nextConfig;
