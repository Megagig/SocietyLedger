import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: false,
  images: {
    unoptimized: true,
    // VideoEmbed's click-to-load thumbnail (D1.4) — not an API/app domain.
    remotePatterns: [{ hostname: 'i.ytimg.com' }],
  },
};

export default withMDX(config);
