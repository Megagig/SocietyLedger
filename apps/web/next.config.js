// Old DB-backed `/documentation/[slug]` → new docs site page, for slugs
// worth a direct redirect instead of landing on `/docs`. Empty for now —
// the old CMS's content lives in the `DocPage` table, not in source, so
// building this for real needs an inventory of the live rows (see G59);
// any slug not listed here still redirects, just to the docs homepage.
/** @type {Record<string, string>} */
const DOCS_SLUG_REDIRECT_MAP = {};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal self-contained server bundle (apps/web/.next/standalone)
  // so the production Docker image doesn't need the full node_modules tree.
  output: 'standalone',

  images: {
    domains: ['localhost'],
  },

  // Transpile packages that need it (monorepo support)
  transpilePackages: ['react-quill', 'quill', '@societyledger/shared'],

  // Optimize font loading and handle timeouts gracefully
  optimizeFonts: true,

  // D6.3: send the old DB-backed docs CMS routes to the new docs site
  // (architecture.md §15.3) instead of retiring the CMS code itself.
  // There's no static per-slug map yet — see DOCS_SLUG_REDIRECT_MAP below
  // and G59 in progress-tracker.md for why.
  async redirects() {
    const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.societyledger.com.ng';
    const slugRedirects = Object.entries(DOCS_SLUG_REDIRECT_MAP).map(([slug, destinationPath]) => ({
      source: `/documentation/${slug}`,
      destination: `${docsUrl}${destinationPath}`,
      permanent: true,
    }));
    return [
      ...slugRedirects,
      {
        source: '/documentation/search',
        destination: `${docsUrl}/docs`,
        permanent: true,
      },
      {
        source: '/documentation/:slug',
        destination: `${docsUrl}/docs`,
        permanent: true,
      },
      {
        source: '/documentation',
        destination: `${docsUrl}/docs`,
        permanent: true,
      },
    ];
  },

  // PWA headers for service worker and manifest
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig