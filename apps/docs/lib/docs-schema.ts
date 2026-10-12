import { pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

/**
 * Frontmatter contract — architecture.md §14.3. A standalone module (no
 * Fumadocs `loader()`/`defineDocs` involved) so `scripts/check-frontmatter.ts`
 * can validate `.mdx` files under plain `tsx`, outside the Next.js/webpack
 * pipeline the macro-based `defineDocs` call in `lib/source.ts` needs.
 */
export const docsFrontmatterSchema = pageSchema.extend({
  description: z.string().max(160),
  type: z.enum(['overview', 'task', 'concept', 'reference', 'faq', 'platform']),
  audience: z.array(z.enum(['all', 'member', 'officer', 'admin', 'founder'])).min(1),
  platforms: z.array(z.enum(['web', 'mobile'])).min(1),
  permission: z.string().optional(),
  module: z.string().optional(),
  covers: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  status: z.enum(['draft', 'review', 'published']),
  lastVerified: z.iso.date().optional(),
  /** Extra search terms folded into the page's hidden search content (D1.5) — see `lib/search-synonyms.ts`. */
  keywords: z.array(z.string()).optional(),
});
