import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { FRESHNESS, createQueryClient, resetClientCache } from '@societyledger/query';

import { ApiError } from '@/api/errors';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session';

/**
 * The one query client and its saved copy. Kept apart from `providers/QueryProvider.tsx` (which wires NetInfo and AppState and renders the
 * provider) so features can reset the cache without importing native modules.
 */
const mmkvAsyncStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

export const persister = createAsyncStoragePersister({ storage: mmkvAsyncStorage, key: 'rq.cache' });

function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError && error.isNetwork;
}

/**
 * The defaults live in `@societyledger/query` (one set of rules for web, mobile and admin). Mobile differences: reads run offline-first (show
 * saved data, and send the request when the network is back), an app that comes back to the front refreshes what is stale, and anything
 * without an entry in the freshness table keeps the 1-minute window it always had.
 */
export const queryClient = createQueryClient({
  isRetryable: isRetryableError,
  offlineFirst: true,
  refetchOnFocus: true,
  defaultStaleTime: 60_000,
  defaultGcTime: FRESHNESS.directory.gcTime,
});

/**
 * Forget everything cached for the person who is leaving: memory, the saved copy on the phone, and requests still in flight. Safe to call
 * more than once.
 */
export function resetAppQueryCache(): Promise<void> {
  return resetClientCache(queryClient, persister);
}

/**
 * Wipe the cache the moment the session ends. Logging out, a failed token refresh (api/client.ts signs the person out) and a cold start with
 * an expired session all end in the `unauthenticated` status, so this one watcher covers every way out. Returns the function that stops watching.
 */
export function watchSessionForCacheReset(): () => void {
  return useSessionStore.subscribe((state, previous) => {
    if (state.status === 'unauthenticated' && previous.status !== 'unauthenticated') void resetAppQueryCache();
  });
}
