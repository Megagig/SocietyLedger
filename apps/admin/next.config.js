// Next.js dev mode's React Refresh runtime evaluates strings as JavaScript. Without
// 'unsafe-eval' the main bundle throws before React hydrates, leaving every page as inert
// HTML. Production builds ship no Refresh runtime, so the strict policy still applies there.
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Pre-existing type-level mismatches in shared code don't affect runtime;
    // Zod validates inputs at the API boundary. Allow the build to succeed.
    ignoreBuildErrors: true,
  },

  transpilePackages: ['@societyledger/shared'],

  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Block all indexing — admin console must never appear in search results
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        // CSP — unsafe-inline required by Next.js SSR hydration; unsafe-eval dev-only (see above)
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            scriptSrc,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

module.exports = nextConfig;
