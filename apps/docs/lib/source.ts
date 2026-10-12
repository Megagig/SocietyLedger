import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons';
import type { Folder, Node, Root } from 'fumadocs-core/page-tree';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema } from 'fumadocs-core/source/schema';
import { docsFrontmatterSchema } from './docs-schema';

// Frontmatter contract — architecture.md §14.3. The schema itself lives in
// `./docs-schema` (not here, and not a separate `source.config.ts`): this
// Fumadocs version's `defineDocs` is a compile-time macro with no file-path
// convention to honour, and keeping the schema loader-free lets
// `scripts/check-frontmatter.ts` import it outside the Next.js build.
export { docsFrontmatterSchema };

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: docsFrontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const showDrafts = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';

function isVisible(url: string): boolean {
  if (showDrafts) return true;
  const entry = source.getPageByHref(url);
  return entry?.page.data.status !== 'draft';
}

function filterNode(node: Node): Node | undefined {
  if (node.type === 'page') return isVisible(node.url) ? node : undefined;
  if (node.type === 'separator') return node;

  const folder = node as Folder;
  const children = folder.children
    .map(filterNode)
    .filter((child): child is Node => child !== undefined);
  const index = folder.index && isVisible(folder.index.url) ? folder.index : undefined;

  if (children.length === 0 && !index) return undefined;
  return { ...folder, children, index };
}

/**
 * The sidebar tree with `status: draft` pages removed, unless
 * `NEXT_PUBLIC_SHOW_DRAFTS=true` (preview builds). D1.3 scope only — search
 * and the sitemap get their own draft exclusion at D1.5.
 */
export function getVisiblePageTree(): Root {
  const tree = source.getPageTree();
  const children = tree.children
    .map(filterNode)
    .filter((child): child is Node => child !== undefined);

  return { ...tree, children };
}

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
