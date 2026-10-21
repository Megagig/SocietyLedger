import { waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { useSessionStore } from '@/stores/session';
import { renderHookWithQueryClient } from '@/test-utils/renderWithProviders';

let mockTokenCache = { accessToken: null as string | null, refreshToken: null as string | null, accessTokenExpiresAt: null as string | null };
const mockClearTokens = jest.fn(async () => {
  mockTokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };
});

jest.mock('@/lib/secure', () => ({
  getTokenCache: () => mockTokenCache,
  clearTokens: mockClearTokens,
}));

// The members endpoint pulls in the API client → tenant store → real MMKV (native, unavailable under Jest).
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

const mockGetMe = jest.fn();
jest.mock('@/api/endpoints/auth', () => ({ authApi: { getMe: mockGetMe } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useSessionBootstrap } = require('./useBootstrap');

describe('useSessionBootstrap', () => {
  beforeEach(() => {
    mockTokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };
    mockGetMe.mockReset();
    mockClearTokens.mockClear();
    useSessionStore.getState().reset();
  });

  it('routes to Welcome when there is no stored token at all', async () => {
    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useSessionBootstrap());

    await waitFor(() => expect(result.current).toBe('/(auth)/welcome'));
    expect(mockGetMe).not.toHaveBeenCalled();
    unmount();
    queryClient.clear();
  });

  it('calls /auth/me and routes to tabs when a token resolves to a real user', async () => {
    mockTokenCache = { accessToken: 'at', refreshToken: 'rt', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString() };
    mockGetMe.mockResolvedValue({
      user: {
        id: 1,
        email: 'ada@example.com',
        role: 'member',
        isActive: true,
        emailVerified: true,
        associationId: 1,
        platformRole: null,
        member: null,
        userApproval: { approvalStatus: 'approved' },
        association: { id: 1, name: 'Opuogun State', subdomain: 'opuogunstate' },
        requiresOnboarding: false,
        permissions: [],
        roles: ['member'],
      },
    });

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useSessionBootstrap());

    await waitFor(() => expect(result.current).toBe('/(app)/(tabs)/home'));
    expect(useSessionStore.getState().status).toBe('authenticated');
    unmount();
    queryClient.clear();
  });

  it('clears tokens and routes to Welcome on a genuine auth rejection', async () => {
    mockTokenCache = { accessToken: 'stale', refreshToken: 'rt', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString() };
    mockGetMe.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthorized' }));

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useSessionBootstrap());

    await waitFor(() => expect(result.current).toBe('/(auth)/welcome'));
    expect(mockClearTokens).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    unmount();
    queryClient.clear();
  });

  it('keeps tokens but still routes to Welcome on a network failure', async () => {
    mockTokenCache = { accessToken: 'at', refreshToken: 'rt', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString() };
    mockGetMe.mockRejectedValue(new ApiError({ status: 0, message: "You're offline.", isNetwork: true }));

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useSessionBootstrap());

    await waitFor(() => expect(result.current).toBe('/(auth)/welcome'));
    expect(mockClearTokens).not.toHaveBeenCalled();
    unmount();
    queryClient.clear();
  });
});
