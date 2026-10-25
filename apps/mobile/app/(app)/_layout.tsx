import { useEffect } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { AppState } from 'react-native';

import { PrivacyOverlay } from '@/components/feedback/PrivacyOverlay';
import { SubscriptionBlockedScreen } from '@/features/session/components/SubscriptionBlockedScreen';
import { isSetupPending, isSubscriptionBlocked, SETUP_HREF } from '@/features/session/landing';
import { useAutoLockTimer } from '@/hooks/useAutoLockTimer';
import { usePushSetup } from '@/hooks/usePushSetup';
import { useAppLockStore } from '@/stores/appLock';
import { useModulesStore } from '@/stores/modules';
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
  const user = useSessionStore((state) => state.user);
  const segments = useSegments();
  useAutoLockTimer();
  usePushSetup();

  // A plan upgrade/downgrade can change which modules the tenant has; `modules` only remembers "disabled"
  // answers for this session, so forget them whenever the app returns to the foreground and re-probe.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') useModulesStore.getState().reset();
    });
    return () => sub.remove();
  }, []);

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (isLocked && biometricsEnabled) {
    return <Redirect href="/(lock)/unlock" />;
  }

  // The association's free trial or subscription has ended: nothing in the app works until it pays, so say so instead of showing empty lists.
  if (isSubscriptionBlocked(user)) {
    return <SubscriptionBlockedScreen />;
  }

  // A new association's admin finishes (or skips) the setup wizard before anything else.
  if (isSetupPending(user) && segments[1] !== 'onboarding') {
    return <Redirect href={SETUP_HREF} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PrivacyOverlay />
    </>
  );
}
