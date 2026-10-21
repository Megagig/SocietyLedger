import { useEffect, useRef } from 'react';
import type { Href } from 'expo-router';

import { ApiError } from '@/api/errors';
import { clearTokens, getTokenCache } from '@/lib/secure';
import { useSessionStore } from '@/stores/session';
import { mapMeUserToSessionUser } from './mappers';
import { useMe } from './queries';

/**
 * architecture.md §7.3 — A1 Splash's real decision: no token → Welcome; token present → `/auth/me`
 * → tabs. **F2.4 — now cache-first**: `useMe()` is a `useQuery`, so a previous session's
 * persisted response (`QueryProvider.tsx`'s `PERSISTED_DOMAINS` already allow-lists `'session'`,
 * ready for this since F1.7) rehydrates into `data` before the network call resolves — an instant
 * route decision on a warm start, with the real `/auth/me` call still running in the background
 * to catch a revoked/expired session. `platformRole` (A12) and `requiresOnboarding` still both
 * route to tabs for now (unchanged from F2.1 — neither destination exists before the admin
 * cutover/Phase 8).
 */
export function useSessionBootstrap(): Href | null {
  const setUser = useSessionStore((state) => state.setUser);
  const { accessToken, refreshToken } = getTokenCache();
  const hasToken = !!accessToken || !!refreshToken;

  const query = useMe(hasToken);
  // `query.isError` alone (`status === 'error'`) only ever becomes true when there's *no* data
  // to fall back on — once a cache-restored or previously-fetched `data` exists, a failed
  // background refetch (e.g. the token actually got revoked) shows up as `isRefetchError`
  // instead, with `status` staying `'success'`. Both need handling here.
  const failed = query.isError || query.isRefetchError;
  const lastHandledError = useRef<unknown>(undefined);

  useEffect(() => {
    if (query.data) setUser(mapMeUserToSessionUser(query.data.user));
  }, [query.data, setUser]);

  useEffect(() => {
    if (!failed || query.error === lastHandledError.current) return;
    lastHandledError.current = query.error;

    // Only a genuine auth rejection (expired/invalid session, tenant mismatch) means the session
    // is really gone — a network/timeout failure shouldn't throw away a still-valid refresh token
    // over a transient blip; `query.data` (if any, from a previous warm session) is left alone.
    const error = query.error;
    const isAuthFailure = error instanceof ApiError && !error.isNetwork && !error.isTimeout;
    if (isAuthFailure) {
      clearTokens();
      setUser(null);
    }
  }, [failed, query.error, setUser]);

  if (!hasToken) return '/(auth)/welcome';
  if (query.data) return '/(app)/(tabs)/home';
  if (query.isError) return '/(auth)/welcome';
  return null;
}
