/**
 * Docs coverage report — how many of the 197 `§9.6` pages are published,
 * by section. Printed as a Markdown table (same shape as
 * `progress-tracker.md`'s "Docs coverage" table) for the D1.7 CI
 * pipeline's PR comment step (`architecture.md §14.9`).
 *
 * Run: pnpm -F @societyledger/docs coverage
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { sections, totalPageCount } from './sitemap-data';

const contentDir = path.join(__dirname, '..', 'content', 'docs');

interface PageStatus {
  status?: string;
  covers?: string[];
}

function readStatus(file: string): PageStatus {
  const { data } = matter(readFileSync(file, 'utf8'));
  return { status: data.status, covers: data.covers };
}

function sectionFile(sectionSlug: string, pageSlug: string): string {
  return pageSlug === 'index'
    ? path.join(contentDir, `${sectionSlug}.mdx`)
    : path.join(contentDir, sectionSlug, `${pageSlug}.mdx`);
}

const rows: { section: string; total: number; published: number; draft: number; review: number }[] = [];
let totalPublished = 0;
let totalDraft = 0;
let totalReview = 0;
const webRoutesCovered = new Set<string>();
const webRoutesTotal = new Set<string>();

for (const section of sections) {
  let published = 0;
  let draft = 0;
  let review = 0;

  for (const page of section.pages) {
    const { status, covers } = readStatus(sectionFile(section.slug, page.slug));
    if (status === 'published') published++;
    else if (status === 'review') review++;
    else draft++;

    for (const cover of covers ?? []) {
      if (!cover.startsWith('/')) continue;
      webRoutesTotal.add(cover);
      if (status === 'published') webRoutesCovered.add(cover);
    }
  }

  rows.push({ section: section.title, total: section.pages.length, published, draft, review });
  totalPublished += published;
  totalDraft += draft;
  totalReview += review;
}

console.log(`## Docs coverage\n`);
console.log('| Section | Pages | Published | Draft | Review |');
console.log('|---|---|---|---|---|');
for (const row of rows) {
  console.log(`| ${row.section} | ${row.total} | ${row.published} | ${row.draft} | ${row.review} |`);
}
console.log(`| **Total** | **${totalPageCount - 1 /* root index, not in sections */}** | **${totalPublished}** | **${totalDraft}** | **${totalReview}** |`);
console.log(
  `\nWeb route coverage (via \`covers\` frontmatter, published pages only): ${webRoutesCovered.size} / ${webRoutesTotal.size} referenced routes.`,
);
