/**
 * D1.3 — writes the `content/docs/**` skeleton (section `meta.json` files +
 * page `.mdx` stubs) from `sitemap-data.ts`. Never overwrites a file that
 * already exists, so it's safe to re-run after D2+ content has replaced
 * stubs with real pages. Reports drift between `sitemap-data.ts` and the
 * files actually on disk and exits non-zero if any is found.
 *
 * Run: pnpm -F @societyledger/docs gen:skeleton
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sections, rootNavOrder, totalPageCount, type PageDef, type PageType } from './sitemap-data';

const contentDir = path.join(__dirname, '..', 'content', 'docs');

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function yamlArray(values: string[]): string {
  return `[${values.map(yamlString).join(', ')}]`;
}

function frontmatter(page: PageDef): string {
  const lines = [
    `title: ${yamlString(page.title)}`,
    `description: ${yamlString('Content pending — see context/build-plan.md for scheduling.')}`,
    `type: ${page.type}`,
    `audience: ${yamlArray(page.audience)}`,
    `platforms: ${yamlArray(page.platforms)}`,
  ];
  if (page.permission) lines.push(`permission: ${page.permission}`);
  if (page.module) lines.push(`module: ${page.module}`);
  if (page.covers.length > 0) lines.push(`covers: ${yamlArray(page.covers)}`);
  lines.push('status: draft');
  return `---\n${lines.join('\n')}\n---\n`;
}

function outline(type: PageType): string {
  switch (type) {
    case 'overview':
      return '## Start here\n\n## All pages\n';
    case 'task':
    case 'platform':
      return '## Before you start\n\n## Steps\n\n## What happens next\n\n## Related\n';
    case 'concept':
      return '## How it works\n\n## Why it matters\n\n## What you can do\n';
    case 'reference':
      return '## Reference\n';
    case 'faq':
      return '';
  }
}

let created = 0;
let skipped = 0;
const expectedFiles = new Set<string>();

function toPosixRelative(filePath: string): string {
  return path.relative(contentDir, filePath).split(path.sep).join('/');
}

function writeIfMissing(filePath: string, content: string, label: string) {
  expectedFiles.add(toPosixRelative(filePath));
  if (existsSync(filePath)) {
    skipped++;
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  created++;
  console.log(`created ${label}`);
}

expectedFiles.add('index.mdx'); // root /docs page, created at D1.1, fixed by hand at D1.3

for (const section of sections) {
  const nonIndexSlugs = section.pages.filter((p) => p.slug !== 'index').map((p) => p.slug);

  writeIfMissing(
    path.join(contentDir, section.slug, 'meta.json'),
    JSON.stringify({ title: section.title, icon: section.icon, pages: nonIndexSlugs }, null, 2) + '\n',
    `${section.slug}/meta.json`,
  );

  for (const page of section.pages) {
    const filePath =
      page.slug === 'index'
        ? path.join(contentDir, `${section.slug}.mdx`)
        : path.join(contentDir, section.slug, `${page.slug}.mdx`);
    writeIfMissing(filePath, frontmatter(page) + '\n' + outline(page.type), `${section.slug}/${page.slug}`);
  }
}

// Root meta.json: section order + separators from each section's navGroup (architecture.md §14.4).
const rootPages: string[] = ['index'];
let lastGroup: string | undefined;
for (const slug of rootNavOrder) {
  const section = sections.find((s) => s.slug === slug);
  if (!section) throw new Error(`rootNavOrder references unknown section "${slug}"`);
  if (section.navGroup !== lastGroup) {
    rootPages.push(`---${section.navGroup}---`);
    lastGroup = section.navGroup;
  }
  rootPages.push(slug);
}
writeIfMissing(
  path.join(contentDir, 'meta.json'),
  JSON.stringify({ title: 'SocietyLedger Docs', pages: rootPages }, null, 2) + '\n',
  'meta.json (root)',
);

// Drift check: every .mdx/meta.json on disk should be accounted for by sitemap-data.ts,
// and vice versa (the writeIfMissing calls above already cover the reverse direction).
const onDisk = readdirSync(contentDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && (entry.name.endsWith('.mdx') || entry.name === 'meta.json'))
  .map((entry) => toPosixRelative(path.join(entry.parentPath, entry.name)));

const drift = onDisk.filter((file) => !expectedFiles.has(file));

console.log(`\n${created} created, ${skipped} already existed, ${totalPageCount} pages total in sitemap-data.ts.`);

if (drift.length > 0) {
  console.error(`\nDrift: ${drift.length} file(s) on disk aren't in sitemap-data.ts:`);
  for (const file of drift) console.error(`  ${file}`);
  process.exit(1);
}
