import * as WebBrowser from 'expo-web-browser';
import { DOCS_LINKS, isPlanBillingDocsPath } from '@societyledger/shared';

/** Mirrors `apps/web/src/lib/docs.ts`'s shape (architecture.md §15.2) — same signature on both apps. */
const DOCS_BASE_URL = process.env.EXPO_PUBLIC_DOCS_URL ?? 'https://docs.societyledger.com.ng';

/** Builds a full docs URL with a `utm_source=mobile&utm_medium=<surface>` tag (architecture.md §9.8). No `URL`/`URLSearchParams` — not reliably available in the Hermes runtime without a polyfill this app doesn't carry. */
export function docsUrl(path: string = '/docs', surface: string = 'mobile'): string {
  const base = DOCS_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}?utm_source=mobile&utm_medium=${encodeURIComponent(surface)}`;
}

/** Resolves a mobile screen ID (e.g. `'H2'`) to its docs path via the shared `DOCS_LINKS` map. */
export function getDocsPathForScreen(screenId: string): string | undefined {
  return DOCS_LINKS[screenId];
}

/**
 * Opens the docs page for a screen ID in the in-app browser (ui-rules.md §12 — the header `?`
 * icon and the "User manual" row). Never opens a plan-billing page from mobile (architecture.md
 * rule #16 — no in-app selling of subscriptions); returns `false` without opening anything for
 * an unmapped or filtered screen ID, rather than falling back to a generic page.
 */
export async function openDocs(screenId: string, surface?: string): Promise<boolean> {
  const path = getDocsPathForScreen(screenId);
  if (!path || isPlanBillingDocsPath(path)) return false;
  await WebBrowser.openBrowserAsync(docsUrl(path, surface));
  return true;
}
