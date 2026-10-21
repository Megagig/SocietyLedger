import type { z } from 'zod';

/** code-standards.md §4 — route params read via `useLocalSearchParams()` are validated here
 * before use. Returns `null` on a bad/missing param rather than throwing: no root `ErrorBoundary`
 * exists yet to catch a thrown parse error, and every screen using this so far is reached only by
 * this app's own navigation (not a deep link), so the caller's own fallback (usually a redirect)
 * is simpler and safer than crashing. */
export function parseParams<T>(schema: z.ZodType<T>, params: unknown): T | null {
  const result = schema.safeParse(params);
  return result.success ? result.data : null;
}
