/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal self-contained server bundle (apps/web/.next/standalone)
  // so the production Docker image doesn't need the full node_modules tree.
  output: 'standalone',

  images: {
    domains: ['localhost'],
  },

  // Transpile packages that need it (monorepo support)
  transpilePackages: ['react-quill', 'quill'],
  
  // Optimize font loading and handle timeouts gracefully
  optimizeFonts: true,
  
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