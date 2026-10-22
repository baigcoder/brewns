const isDev = process.env.NODE_ENV !== 'production';

/* The Content-Security-Policy: what a page may load and run. It is the safety net
   under the site's careful escaping. If some text ever slipped through unescaped, the
   browser still would not load a script from another site, let another site frame
   this one, or post a form somewhere else.

   What the site really uses is short: its own files, Cloudinary pictures, the
   order-form service if one is set, the Draco 3D decoder (WebAssembly in a blob
   worker), and the concierge's live voice line to Gemini (a WebSocket). Inline scripts and styles stay allowed because Next writes inline
   hydration scripts and the page builds a lot of inline style. */
const orderEndpointOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_ORDER_ENDPOINT ? new URL(process.env.NEXT_PUBLIC_ORDER_ENDPOINT).origin : '';
  } catch {
    return '';
  }
})();
const IMG_HOSTS = 'https://res.cloudinary.com https://images.unsplash.com';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMG_HOSTS}`,
  `media-src 'self' data: blob: ${IMG_HOSTS}`,
  "font-src 'self' data:",
  `connect-src 'self' blob: data: https://res.cloudinary.com wss://generativelanguage.googleapis.com ${orderEndpointOrigin}${isDev ? ' ws://localhost:* http://localhost:*' : ''}`.trim(),
  // The locations pages embed a Google map of each counter.
  "frame-src https://www.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${orderEndpointOrigin}`.trim(),
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['three', 'lenis'],
  },
  // Public URLs are not fingerprinted, so cache them briefly and revalidate.
  // Next's hashed build assets use immutable caching automatically.
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        source: '/draco/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
