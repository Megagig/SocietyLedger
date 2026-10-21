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

// `AppLayout` itself only needs to make the right redirect decision (architecture.md §5's one
// guard) — mocking `Stack`/`Redirect` keeps this test from pulling in the real router tree (every
// screen under `(tabs)`, MMKV-backed stores, etc.), which is what `_layout.test.tsx` is and isn't
// testing: the guard's branch, not the navigator it guards.
let mockRedirectHref: string | null = null;
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirectHref = href;
    return null;
  },
  Stack: () => null,
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
});
