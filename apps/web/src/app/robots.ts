import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/features',
          '/contact',
          '/about',
          '/faq',
          '/privacy',
          '/terms',
          '/documentation',
          '/testimonials',
          '/blog',
        ],
        disallow: [
          '/dashboard/*',
          '/admin/*',
          '/auth/*',
          '/login',
          '/register',
          '/api/*',
        ],
      },
    ],
    sitemap: 'https://societyledger.com.ng/sitemap.xml',
  };
}
