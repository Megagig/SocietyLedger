import { useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { ApiError } from '@/api/errors';
import { storage } from '@/lib/storage';

/**
 * architecture.md §11 — persisted domains (query key's 2nd segment, after the tenant
 * subdomain). None of these feature modules exist yet (F2.x+) — the allow-list is ready for
 * when they do; nothing currently produces a query key matching it.
 */
const PERSISTED_DOMAINS = ['session', 'memberFinance', 'memberLedger', 'meetings', 'voting', 'notifications', 'profile'];

const mmkvAsyncStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

const persister = createAsyncStoragePersister({ storage: mmkvAsyncStorage, key: 'rq.cache' });

function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError && error.isNetwork;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
      refetchOnReconnect: true,
    },
  },
});

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => setOnline(state.isConnected === true && state.isInternetReachable !== false));
});

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => handleFocus(status === 'active'));
  return () => subscription.remove();
});

export type QueryProviderProps = { children: ReactNode };

/**
 * `PersistQueryClientProvider` wraps `QueryClientProvider` — `shouldDehydrateQuery` allow-lists
 * `PERSISTED_DOMAINS` only. **Not yet implemented:** library-docs.md's "only first pages" nuance
 * for persisted infinite queries — no `useInfiniteQuery` exists yet to validate it against;
 * revisit when the first paginated list feature lands.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [persistOptions] = useState(() => ({
    persister,
    dehydrateOptions: {
      shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) => {
        const domain = query.queryKey[1];
        return typeof domain === 'string' && PERSISTED_DOMAINS.includes(domain);
      },
    },
  }));

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
