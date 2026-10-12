import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const published = source
    .getPages()
    .filter((page) => page.data.status === 'published')
    .map((page) => ({
      url: `${siteUrl}${page.url}`,
      lastModified: page.data.lastVerified,
    }));

  return [{ url: siteUrl }, ...published];
}
