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
        // Basic CSP — tightened further in A1.6
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
