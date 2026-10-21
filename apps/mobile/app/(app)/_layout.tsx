import { Redirect, Stack } from 'expo-router';

import { PrivacyOverlay } from '@/components/feedback/PrivacyOverlay';
import { useAutoLockTimer } from '@/hooks/useAutoLockTimer';
import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useSessionStore } from '@/stores/session';

/**
 * architecture.md §5 — the one guard for the authenticated area: "`(app)/_layout.tsx` reads
 * session status … No guards in individual screens." `'idle'` (nothing has signed in yet) and
 * `'unauthenticated'` (signed out, or `/auth/me` rejected the stored token) both bounce the same
 * way. `app/index.tsx`'s splash (F2.1, `useSessionBootstrap`) is what actually calls `/auth/me`
 * and `setUser`/`setStatus` on cold start; this guard is just the backstop for anyone who lands
 * on an `(app)` route without having gone through it (e.g. a stale deep link).
 *
 * **F2.4 — app lock**: a second gate, checked only once authenticated. `stores/appLock.ts`'s
 * `isLocked` starts `true` on every cold start for free (fresh JS process); `useAutoLockTimer`
 * (mounted here, so it only ever runs while authenticated) re-locks after backgrounding past
 * `autoLockMinutes`. Both are no-ops for a user who never opted into `biometricsEnabled`.
 *
 * Modal-presented routes (`manage/members/form`-style create/edit screens) aren't declared on
 * this Stack yet — none exist in the app until later features build them; each adds its own
 * `presentation: 'modal' | 'fullScreenModal'` at that point (library-docs.md's Expo Router note).
 */
export default function AppLayout() {
  const status = useSessionStore((state) => state.status);
  const isLocked = useAppLockStore((state) => state.isLocked);
  const biometricsEnabled = usePrefsStore((state) => state.biometricsEnabled);
  useAutoLockTimer();

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (isLocked && biometricsEnabled) {
    return <Redirect href="/(lock)/unlock" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PrivacyOverlay />
    </>
  );
}
