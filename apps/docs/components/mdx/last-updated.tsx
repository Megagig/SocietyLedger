/**
 * Renders the `lastVerified` frontmatter date (`architecture.md §14.3`). If
 * absent, renders nothing — every real page sets `lastVerified` when
 * written (`code-standards.md §17.5`'s accuracy workflow), so the "falls
 * back to git commit date" case in §14.3 only covers a hand-edited page
 * that skipped that step. Shelling out to `git log` for all 197 (currently
 * all-draft, all unverified) pages on every build isn't worth doing before
 * a concrete page actually needs that fallback — revisit if one does.
 */
export function LastUpdated({ date }: { date?: string }) {
  if (!date) return null;

  const formatted = new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return <p className="docs-text-small text-fd-muted-foreground">Last updated {formatted}</p>;
}
