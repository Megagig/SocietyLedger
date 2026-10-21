import { waitFor } from '@testing-library/react-native';

import { useAppLockStore } from '@/stores/appLock';
import { useModulesStore } from '@/stores/modules';
import { useSessionStore, type SessionUser } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';
import { renderHookWithQueryClient } from '@/test-utils/renderWithProviders';

let mockTokenCache = { accessToken: 'at' as string | null, refreshToken: 'rt' as string | null, accessTokenExpiresAt: null as string | null };
const mockClearTokens = jest.fn(async () => {
  mockTokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };
});
jest.mock('@/lib/secure', () => ({
  getTokenCache: () => mockTokenCache,
  clearTokens: mockClearTokens,
}));

const mockLogout = jest.fn();
jest.mock('@/api/endpoints/auth', () => ({ authApi: { logout: mockLogout } }));

// `tenant.ts` persists via the real `lib/storage.ts` → `react-native-mmkv`, unavailable under
// Jest — mocked with the same in-memory fake `client.test.ts` already established.
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

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useLogout } = require('./mutations');

const fakeUser: SessionUser = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  permissions: ['ledger.view_own'],
  roles: ['member'],
  requiresOnboarding: false,
  platformRole: null,
  member: null,
};

const fakeTenant = { id: 1, name: 'Opuogun State', slug: 'opuogunstate', subdomain: 'opuogunstate', tier: 'STARTER' as const, status: 'ACTIVE' as const, logo: null, primaryColor: null };

describe('useLogout', () => {
  beforeEach(() => {
    mockTokenCache = { accessToken: 'at', refreshToken: 'rt', accessTokenExpiresAt: null };
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockClearTokens.mockClear();
    useSessionStore.getState().setUser(fakeUser);
    useModulesStore.getState().markDisabled('welfare');
    useTenantStore.getState().setCurrent(fakeTenant);
    useAppLockStore.getState().unlock();
  });

  it('wipes tokens, session and modules but keeps the tenant on a plain sign-out', async () => {
    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useLogout());

    result.current.mutate(undefined);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockLogout).toHaveBeenCalledWith({ refreshToken: 'rt' });
    expect(mockClearTokens).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useModulesStore.getState().isDisabled('welfare')).toBe(false);
    expect(useAppLockStore.getState().isLocked).toBe(true);
    expect(useTenantStore.getState().current).toEqual(fakeTenant);

    unmount();
    queryClient.clear();
  });

  it('also clears the tenant when switching association', async () => {
    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useLogout());

    result.current.mutate({ clearTenant: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(useTenantStore.getState().current).toBeNull();

    unmount();
    queryClient.clear();
  });

  it('still wipes local state even when the server logout call fails', async () => {
    mockLogout.mockRejectedValue(new Error('network error'));
    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useLogout());

    result.current.mutate(undefined);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockClearTokens).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');

    unmount();
    queryClient.clear();
  });
});
