/**
 * Fast, offline internal link checker (`library-docs.md`'s lychee note —
 * lychee itself only runs weekly, for external links; this is the one CI
 * runs on every PR). Walks every `.mdx` file's markdown links and `href`/
 * `url` JSX props, and fails if any `/docs/...` link doesn't match a real
 * page.
 *
 * Deliberately simple regex extraction, not full MDX/AST parsing — good
 * enough for plain markdown links and the common `href="..."`/`url="..."`
 * component props; a link built from a JS expression (`href={variable}`)
 * won't be checked. Revisit if that turns out to miss real breakage.
 *
 * Run: pnpm -F @societyledger/docs check:links
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { sections } from './sitemap-data';

const contentDir = path.join(__dirname, '..', 'content', 'docs');

const validUrls = new Set<string>(['/docs', '/docs/_kitchen-sink']);
for (const section of sections) {
  for (const page of section.pages) {
    validUrls.add(page.slug === 'index' ? `/docs/${section.slug}` : `/docs/${section.slug}/${page.slug}`);
  }
}

const linkPattern = /\]\(([^)\s]+)\)|(?:href|url)="([^"]+)"/g;

function extractLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(linkPattern)) {
    const link = match[1] ?? match[2];
    if (link) links.push(link);
  }
  return links;
}

const files = readdirSync(contentDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
  .map((entry) => path.join(entry.parentPath, entry.name));

let broken = 0;
let checked = 0;

for (const file of files) {
  const relative = path.relative(contentDir, file).split(path.sep).join('/');
  const content = readFileSync(file, 'utf8');

  for (const link of extractLinks(content)) {
    if (!link.startsWith('/docs')) continue; // external, mailto:, or a non-docs app route
    checked++;
    const [pathname] = link.split('#');
    if (!validUrls.has(pathname)) {
      broken++;
      console.error(`${relative}: broken link "${link}"`);
    }
  }
}

console.log(`\n${checked} internal link(s) checked, ${broken} broken.`);
if (broken > 0) process.exit(1);
