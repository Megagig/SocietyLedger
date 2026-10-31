import { useEffect, useMemo, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE_MS, shouldPersistQuery, trimInfiniteData } from '@societyledger/query';

import { persister, queryClient, watchSessionForCacheReset } from '@/lib/queryClient';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => setOnline(state.isConnected === true && state.isInternetReachable !== false));
});

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => handleFocus(status === 'active'));
  return () => subscription.remove();
});

const APP_VERSION = Constants.expoConfig?.version ?? '0';

export type QueryProviderProps = { children: ReactNode };

/**
 * `PersistQueryClientProvider` wraps `QueryClientProvider`. What reaches the phone is decided by `shouldPersistQuery` in
 * `@societyledger/query`: successful queries only, from the allow-listed domains (policy.ts), for the association and person signed in now,
 * and never anything with a secret or one-time value in its key (bank details, proofs, links). Payments, contributions and payouts are never saved.
 * Pending queries are not saved either: persisting them causes "dehydrated as pending ended up rejecting" errors when they reject on restore.
 *
 * The saved copy is used on the next open only when the build and the association match (the buster). Signing out, a failed token refresh
 * and a cold start with an expired session all end in `unauthenticated`, and that one transition wipes memory and the saved copy.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const tenant = useTenantStore((s) => s.current?.subdomain ?? null);

  useEffect(() => watchSessionForCacheReset(), []);

  const persistOptions = useMemo(
    () => ({
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      // Bump the first part whenever the allow-list or the dehydration rules change shape; the app version already changes it on every release.
      buster: `v3|${APP_VERSION}|${tenant ?? 'none'}`,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
          shouldPersistQuery(query, { tenant: useTenantStore.getState().current?.subdomain, userId: useSessionStore.getState().user?.id }),
        serializeData: trimInfiniteData,
      },
    }),
    [tenant],
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
