export type ArticleBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; text: string };

/**
 * Turns an article's body into blocks. Handles exactly what the web article page renders (apps/web/.../help/articles/[slug]):
 * `# `, `## ` and `### ` headings, `- ` / `* ` bullets (consecutive lines become one list), `1. ` numbered lines,
 * blank lines as separators, and everything else as a paragraph. Keep the two in step if either grows.
 */
export function parseArticleContent(content: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length > 0) {
      blocks.push({ type: 'bullets', items: bullets });
      bullets = [];
    }
  };

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();

    if (line.startsWith('### ')) {
      flush();
      blocks.push({ type: 'heading', level: 3, text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'heading', level: 2, text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      flush();
      blocks.push({ type: 'heading', level: 1, text: line.slice(2) });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      flush();
      blocks.push({ type: 'numbered', text: line });
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      blocks.push({ type: 'paragraph', text: line });
    }
  }

  flush();
  return blocks;
}
