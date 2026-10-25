/** `getting_started` → "Getting started". Category names arrive as snake_case slugs (web does the same in `formatCategoryLabel`). */
export function categoryLabel(name: string): string {
  const spaced = name.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
