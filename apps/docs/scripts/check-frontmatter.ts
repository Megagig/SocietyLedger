/**
 * Validates every `content/docs/**\/*.mdx` file's frontmatter against
 * `docsFrontmatterSchema` (`lib/docs-schema.ts`). Independent of
 * `sitemap-data.ts` / `gen-skeleton.ts` — this only checks what's on disk.
 *
 * Run: pnpm -F @societyledger/docs check:frontmatter
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { docsFrontmatterSchema } from '../lib/docs-schema';

const contentDir = path.join(__dirname, '..', 'content', 'docs');

const files = readdirSync(contentDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
  .map((entry) => path.join(entry.parentPath, entry.name));

let failed = 0;

for (const file of files) {
  const relative = path.relative(contentDir, file).split(path.sep).join('/');
  const { data } = matter(readFileSync(file, 'utf8'));
  const result = docsFrontmatterSchema.safeParse(data);

  if (!result.success) {
    failed++;
    console.error(`\n${relative}`);
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
}

console.log(`\n${files.length} page(s) checked, ${failed} failed.`);
if (failed > 0) process.exit(1);
