/**
 * Site-wide term equivalences (`architecture.md §14.6`), e.g. so searching
 * "subscription fee" finds pages written in the docs voice around "dues".
 * Applied in `app/api/search/route.ts`'s `buildIndex`: for each page, if
 * either side of a pair appears in its content, the other side is folded
 * into the page's hidden, indexed-but-not-rendered search content.
 *
 * The installed search engine's advanced schema has no literal `keywords`
 * field (only `content`/`tags`/`breadcrumbs`/`url`/etc. —
 * `fumadocs-core@16.17.1`'s `SharedIndex`), unlike what `architecture.md
 * §14.6`'s "indexed into each page's hidden keywords field" assumed. The
 * mechanism here (extra `StructuredData.contents` entries) achieves the
 * same outcome — matchable, invisible — adapted to what's actually there.
 */
export const synonymPairs: [string, string][] = [
  ['dues', 'subscription fee'],
  ['levy', 'contribution'],
  ['proof', 'receipt'],
  ['exco', 'officer'],
];

export function synonymKeywordsFor(text: string): string[] {
  const lower = text.toLowerCase();
  const extra = new Set<string>();

  for (const [a, b] of synonymPairs) {
    if (lower.includes(a)) extra.add(b);
    if (lower.includes(b)) extra.add(a);
  }

  return [...extra];
}
