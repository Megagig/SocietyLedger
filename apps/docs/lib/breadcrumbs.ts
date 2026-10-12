import { siteUrl, docsRoute } from './shared';
import { sections } from '@/scripts/sitemap-data';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * `Documentation › <Section> › <Page>` for `BreadcrumbList` JSON-LD.
 * Section title comes from `sitemap-data.ts` (same source the sidebar's
 * `meta.json` files were generated from, D1.3) rather than re-deriving it
 * from the page tree, since a page's section is just its first slug segment.
 */
export function breadcrumbsFor(page: { slugs: string[]; url: string; data: { title: string } }): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ name: 'Documentation', url: `${siteUrl}${docsRoute}` }];

  if (page.slugs.length === 0) return [{ name: page.data.title, url: `${siteUrl}${page.url}` }];

  const section = sections.find((s) => s.slug === page.slugs[0]);
  if (section) items.push({ name: section.title, url: `${siteUrl}${docsRoute}/${section.slug}` });

  items.push({ name: page.data.title, url: `${siteUrl}${page.url}` });
  return items;
}
