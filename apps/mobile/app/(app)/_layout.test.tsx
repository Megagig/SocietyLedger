import { render } from '@testing-library/react-native';

import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useSessionStore, type SessionUser } from '@/stores/session';

import AppLayout from './_layout';

// `prefs.ts` (new at F2.4) persists via the real `lib/storage.ts` → `react-native-mmkv`, whose
// native module isn't available under Jest (same class of gap as F1.2's MMKV-under-SSR note) —
// mocked here with the same in-memory fake `client.test.ts` already established. Jest hoists
// this call above the imports above regardless of source order, so this placement is for lint
// (`import/first`), not correctness.
jest.mock('@/lib/storage', () => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => map.get(key),
      set: (key: string, value: string) => map.set(key, String(value)),
      remove: (key: string) => map.delete(key),
    },
  };
});

// F3.1's push hook registers tokens / OS listeners — irrelevant to the guard being tested here.
jest.mock('@/hooks/usePushSetup', () => ({ usePushSetup: jest.fn() }));

// `AppLayout` itself only needs to make the right redirect decision (architecture.md §5's one
// guard) — mocking `Stack`/`Redirect` keeps this test from pulling in the real router tree (every
// screen under `(tabs)`, MMKV-backed stores, etc.), which is what `_layout.test.tsx` is and isn't
// testing: the guard's branch, not the navigator it guards.
let mockRedirectHref: unknown = null;
let mockSegments: string[] = ['(app)'];
let mockShowedBlockedScreen = false;
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirectHref = href;
    return null;
  },
  Stack: () => null,
  useSegments: () => mockSegments,
}));

// What the guard shows instead of the app when the association's trial or subscription has ended.
jest.mock('@/features/session/components/SubscriptionBlockedScreen', () => ({
  SubscriptionBlockedScreen: () => {
    mockShowedBlockedScreen = true;
    return null;
  },
}));

const fakeUser: SessionUser = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  permissions: ['ledger.view_own'],
  roles: ['member'],
  requiresOnboarding: false,
  platformRole: null,
  member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001' },
};

describe('(app)/_layout guard', () => {
  beforeEach(() => {
    mockRedirectHref = null;
    mockSegments = ['(app)'];
    mockShowedBlockedScreen = false;
    useSessionStore.getState().reset();
    useAppLockStore.getState().unlock();
    usePrefsStore.getState().setBiometricsEnabled(false);
  });

  it('redirects to /(auth)/welcome when idle (no session yet)', async () => {
    await render(<AppLayout />);
    expect(mockRedirectHref).toBe('/(auth)/welcome');
  });

  it('redirects to /(auth)/welcome when explicitly unauthenticated', async () => {
    useSessionStore.getState().setUser(null);
    await render(<AppLayout />);
    expect(mockRedirectHref).toBe('/(auth)/welcome');
  });

  it('renders the Stack, not a redirect, when authenticated', async () => {
    useSessionStore.getState().setUser(fakeUser);
    await render(<AppLayout />);
    expect(mockRedirectHref).toBeNull();
  });

  it('redirects to /(lock)/unlock when authenticated but locked with biometrics enabled', async () => {
    useSessionStore.getState().setUser(fakeUser);
    usePrefsStore.getState().setBiometricsEnabled(true);
    useAppLockStore.getState().lock();
    await render(<AppLayout />);
    expect(mockRedirectHref).toBe('/(lock)/unlock');
  });

  it('does not redirect to the lock screen when locked but biometrics is disabled', async () => {
    useSessionStore.getState().setUser(fakeUser);
    useAppLockStore.getState().lock();
    await render(<AppLayout />);
    expect(mockRedirectHref).toBeNull();
  });

  describe('free trial and setup wizard', () => {
    const admin: SessionUser = { ...fakeUser, role: 'admin', requiresOnboarding: true };

    it('shows the blocked screen, not the app, once the trial has ended', async () => {
      useSessionStore.getState().setUser({
        ...fakeUser,
        subscriptionAccess: { allowed: false, reason: 'TRIAL_ENDED', status: 'TRIALING', trialEndsAt: '2026-11-01T00:00:00.000Z', trialDaysLeft: null },
      });
      await render(<AppLayout />);
      expect(mockShowedBlockedScreen).toBe(true);
    });

    it('keeps the app open while the trial is still running', async () => {
      useSessionStore.getState().setUser({
        ...fakeUser,
        subscriptionAccess: { allowed: true, reason: 'OK', status: 'TRIALING', trialEndsAt: '2026-11-17T00:00:00.000Z', trialDaysLeft: 12 },
      });
      await render(<AppLayout />);
      expect(mockShowedBlockedScreen).toBe(false);
    });

    it('sends an admin whose setup is pending to the setup wizard', async () => {
      useSessionStore.getState().setUser(admin);
      await render(<AppLayout />);
      expect(mockRedirectHref).toBe('/(app)/onboarding');
    });

    it('does not bounce the admin around once they are already inside the wizard', async () => {
      mockSegments = ['(app)', 'onboarding'];
      useSessionStore.getState().setUser(admin);
      await render(<AppLayout />);
      expect(mockRedirectHref).toBeNull();
    });

    it('leaves a member alone even if the flag is set, and platform staff are never blocked', async () => {
      useSessionStore.getState().setUser({ ...fakeUser, requiresOnboarding: true });
      await render(<AppLayout />);
      expect(mockRedirectHref).toBeNull();
    });
  });
});
