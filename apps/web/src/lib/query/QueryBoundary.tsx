'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE_MS, persistBuster, shouldPersistQuery, trimInfiniteData } from '@societyledger/query';
import { useAuthStore } from '@/store/authStore';
import { createWebQueryClient } from './client';
import { cacheStorageKey, idbStorage } from './idb';
import { queryScope } from './identity';

const BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? '0';

/**
 * One query client per signed-in identity (association + person).
 *
 * When the person signs out, or someone else signs in, or a platform user starts or ends acting for an association, the identity changes: a
 * NEW client replaces the old one, so nothing cached for the old identity can be shown to the new one, and a response that arrives late for
 * the old identity has nowhere to land. The saved copy of the old identity's cache is deleted when they sign out.
 *
 * What is saved on this device is decided in @societyledger/query (allow-list, never payments or secrets), and is used on the next open only
 * for the same build, association and person.
 */
export function QueryBoundary({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const impersonated = useAuthStore((s) => s.impersonatedAssociation);
  const scope = useMemo(() => queryScope(user, impersonated), [user, impersonated]);

  const client = useMemo(() => createWebQueryClient(), [scope.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving an identity (sign-out, or another person/association) removes what was saved for it on this device.
  const previous = useRef(scope.id);
  useEffect(() => {
    if (previous.current !== scope.id && previous.current !== 'anonymous') void idbStorage.removeItem(cacheStorageKey(previous.current));
    previous.current = scope.id;
  }, [scope.id]);

  const persistOptions = useMemo(() => {
    if (scope.tenant === null || scope.userId === null) return null;
    const persister = createAsyncStoragePersister({ storage: idbStorage, key: cacheStorageKey(scope.id), throttleTime: 1000 });
    return {
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      buster: persistBuster({ appVersion: BUILD, tenant: scope.tenant, userId: scope.userId }),
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => shouldPersistQuery(query, { tenant: scope.tenant, userId: scope.userId }),
        serializeData: trimInfiniteData,
      },
    };
  }, [scope]);

  if (!persistOptions) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
