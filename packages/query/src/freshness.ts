/**
 * The small "Offline · last updated 10:42" / "Updating…" line shown when saved data is on screen. Hidden when the data is fresh and nothing is happening.
 */
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

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

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();

/** Is the app online right now? Follows NetInfo on mobile and the browser on web. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}

/** `useFreshness(query)` -> { state, label }. */
export function useFreshness(query: { isFetching: boolean; data: unknown; dataUpdatedAt: number }): { state: FreshnessState; label: string | null } {
  const online = useIsOnline();
  const state = freshnessState({ isOnline: online, isFetching: query.isFetching, hasData: query.data !== undefined });
  return { state, label: freshnessLabel(state, query.dataUpdatedAt) };
}
