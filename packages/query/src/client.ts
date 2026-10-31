/**
 * The query client every app builds. Reads retry (a GET can be repeated safely); writes never retry, so a payment or a contribution is
 * never sent twice by the cache. Window focus does not refetch by itself: data is refreshed by staleTime, by opening a screen, and by invalidation.
 */
import { QueryClient } from '@tanstack/query-core';

export const MAX_READ_RETRIES = 2;

/** 1 s, 2 s, 4 s ... capped at 15 s, with a little spread so many clients do not retry in step. */
export function retryDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  return Math.round(base * (0.85 + random() * 0.3));
}

export interface ClientOptions {
  /** Should a failed read be tried again? Only network failures and server errors; never a 4xx. */
  isRetryable: (error: unknown) => boolean;
  /** Mobile: show saved data and run the request when the network comes back instead of failing at once. */
  offlineFirst?: boolean;
  /** For a query whose domain has no entry in the table yet. Keep what the app had before it moved over. */
  /** Refetch stale queries when the window or app comes back to the front. Off on the web; on in the mobile app, where it means "the app was reopened". */
  refetchOnFocus?: boolean;
  defaultStaleTime?: number;
  defaultGcTime?: number;
}

export function createQueryClient(options: ClientOptions): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options.defaultStaleTime ?? 60_000,
        gcTime: options.defaultGcTime ?? 5 * 60_000,
        retry: (failureCount, error) => failureCount < MAX_READ_RETRIES && options.isRetryable(error),
        retryDelay: (attempt) => retryDelay(attempt),
        refetchOnWindowFocus: options.refetchOnFocus ?? false,
        refetchOnReconnect: true,
        networkMode: options.offlineFirst ? 'offlineFirst' : 'online',
      },
      mutations: {
        // Never repeat a write on our own. The person (or an idempotency key) decides.
        retry: false,
        networkMode: 'online',
      },
    },
  });
}
