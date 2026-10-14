/**
 * Web helpers for linking into the docs site (architecture.md §15.2).
 * Mirrors the shape `apps/mobile/src/lib/docs.ts` will use once mobile ships,
 * so both apps carry the same signature even though only web exists today.
 */
import { DOCS_LINKS } from '@societyledger/shared';

const DOCS_BASE_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.societyledger.com.ng';

/** Builds a full docs URL with a `utm_source=web&utm_medium=<surface>` tag (architecture.md §9.8). */
export function docsUrl(path: string = '/docs', surface: string = 'web'): string {
  const url = new URL(path, DOCS_BASE_URL);
  url.searchParams.set('utm_source', 'web');
  url.searchParams.set('utm_medium', surface);
  return url.toString();
}

/**
 * Resolves the current dashboard route to a docs path via `DOCS_LINKS`,
 * matching dynamic segments like `/dashboard/governance/meetings/[id]`
 * against the real pathname (e.g. `/dashboard/governance/meetings/42`).
 * Returns `undefined` when the route isn't mapped — `HelpLink` renders
 * nothing in that case rather than linking to a generic page.
 */
export function getHelpDocsPath(pathname: string): string | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (DOCS_LINKS[normalized]) return DOCS_LINKS[normalized];

  const pathnameSegments = normalized.split('/');
  for (const [route, docsPath] of Object.entries(DOCS_LINKS)) {
    if (!route.startsWith('/')) continue; // skip mobile screen IDs (e.g. "H2") — not a route pattern
    const routeSegments = route.split('/');
    if (routeSegments.length !== pathnameSegments.length) continue;
    const matches = routeSegments.every(
      (segment, index) => segment.startsWith('[') || segment === pathnameSegments[index],
    );
    if (matches) return docsPath;
  }

  return undefined;
}
