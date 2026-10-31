/**
 * The small "Offline · last updated 10:42" / "Updating…" line shown when saved data is on screen. Hidden when the data is fresh and nothing is
 * happening. Pure: each app reads whether it is online with its own hook and passes it in.
 */
export type FreshnessState = 'fresh' | 'updating' | 'offline';

export interface FreshnessInput {
  isOnline: boolean;
  isFetching: boolean;
  /** Is there data on screen already (cached or loaded)? With none, the screen shows a skeleton and no line. */
  hasData: boolean;
}

export function freshnessState({ isOnline, isFetching, hasData }: FreshnessInput): FreshnessState {
  if (!hasData) return 'fresh';
  if (!isOnline) return 'offline';
  return isFetching ? 'updating' : 'fresh';
}

function clock(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The text for the line, or null when there is nothing to say. */
export function freshnessLabel(state: FreshnessState, dataUpdatedAt: number): string | null {
  if (state === 'offline') return dataUpdatedAt > 0 ? `Offline · last updated ${clock(dataUpdatedAt)}` : 'Offline';
  if (state === 'updating') return 'Updating…';
  return null;
}

/** Everything a screen needs from one query to draw the line. */
export function freshnessLabelFor(query: { isFetching: boolean; data: unknown; dataUpdatedAt: number }, isOnline: boolean): string | null {
  const state = freshnessState({ isOnline, isFetching: query.isFetching, hasData: query.data !== undefined });
  return freshnessLabel(state, query.dataUpdatedAt);
}
