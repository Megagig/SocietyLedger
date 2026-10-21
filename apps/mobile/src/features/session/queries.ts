import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/api/endpoints/auth';
import { membersApi } from '@/api/endpoints/members';

/** `['session', 'me']` — the `'session'` 2nd segment matches `QueryProvider.tsx`'s
 * `PERSISTED_DOMAINS` allow-list exactly (it was added there at F1.7, ready for this). This is
 * what makes the splash's bootstrap "cache-first": a previous session's persisted `/auth/me`
 * response rehydrates into this query's `data` before the network call resolves. */
export const sessionKeys = {
  me: () => ['session', 'me'] as const,
  profile: () => ['session', 'profile'] as const,
  sessions: () => ['session', 'sessions'] as const,
};

/** architecture.md §7.4 — "refetched on app foreground (max once per 5 min)". `staleTime` alone
 * gets this for free: `QueryProvider.tsx`'s `focusManager` is already wired to `AppState`
 * (F1.7), so any mounted `useMe()` observer automatically refetches on foreground once the cached
 * data is older than 5 minutes — no bespoke `AppState` listener needed here. */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: sessionKeys.me(),
    queryFn: authApi.getMe,
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** Full member-self profile row — used by P1 profile home and P2 personal info edit. */
export function useProfile() {
  return useQuery({
    queryKey: sessionKeys.profile(),
    queryFn: membersApi.getProfile,
    staleTime: 5 * 60 * 1000,
  });
}

/** Active refresh-token sessions (devices list) — P3 security screen. */
export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.sessions(),
    queryFn: authApi.getSessions,
    select: (data) => data.sessions,
  });
}
