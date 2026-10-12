import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

/**
 * Preview/staging `noindex` is set via the `X-Robots-Tag` HTTP header at
 * the nginx/Dokploy level (`architecture.md §14.9`), not here — this file
 * is the same on every environment.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
