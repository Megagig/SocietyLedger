'use client';

import { useFreshness } from '@societyledger/query';

/**
 * A quiet line under a heading when saved data is on screen: "Updating…" while the page checks the server, and "Offline · last updated 10:42"
 * when it cannot. Nothing is drawn when the data is fresh, or when there is no data yet (the page shows its own loading state then).
 */
export function FreshnessNote({ query }: { query: { isFetching: boolean; data: unknown; dataUpdatedAt: number } }) {
  const { label } = useFreshness(query);
  if (!label) return null;
  return (
    <p role="status" aria-live="polite" className="mt-1 text-xs text-ink-muted" data-testid="freshness-note">
      {label}
    </p>
  );
}
