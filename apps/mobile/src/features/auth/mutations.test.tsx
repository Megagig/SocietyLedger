import { waitFor } from '@testing-library/react-native';

import { useAppLockStore } from '@/stores/appLock';
import { useSessionStore } from '@/stores/session';
import { renderHookWithQueryClient } from '@/test-utils/renderWithProviders';

const mockSetTokens = jest.fn(async () => {});
jest.mock('@/lib/secure', () => ({ setTokens: mockSetTokens }));

const mockLogin = jest.fn();
jest.mock('@/api/endpoints/auth', () => ({
  authApi: { login: mockLogin, verifyEmail: jest.fn(), resendVerification: jest.fn(), forgotPassword: jest.fn(), resetPassword: jest.fn() },
}));

// `mutations.ts` also imports `memberInvitesApi` (for `useSelfRegister`/`useAcceptInvite`) —
// mocked here too so this file never pulls in the real `api/client.ts` → `sonner-native` chain
// (the same ESM-under-Jest issue `api/client.test.ts` already solved by mocking `sonner-native`
// directly; mocking the endpoint module one layer up avoids needing that mock here too).
jest.mock('@/api/endpoints/memberInvites', () => ({
  memberInvitesApi: { verifyInvite: jest.fn(), acceptInvite: jest.fn(), selfRegister: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useLogin } = require('./mutations');

describe('useLogin', () => {
  beforeEach(() => {
    mockSetTokens.mockClear();
    mockLogin.mockReset();
    useSessionStore.getState().reset();
    useAppLockStore.getState().lock();
  });

  it('stores the token pair and populates the session store on success', async () => {
    mockLogin.mockResolvedValue({
      user: {
        id: 1,
        email: 'ada@example.com',
        role: 'member',
        member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001' },
        association: { id: 1, name: 'Opuogun State', subdomain: 'opuogunstate' },
        platformRole: null,
        requiresOnboarding: false,
        permissions: ['ledger.view_own'],
        roles: ['member'],
        isPlatformLogin: false,
      },
      token: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    });

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useLogin());
    result.current.mutate({ email: 'ada@example.com', password: 'secret' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSetTokens).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: expect.any(String),
    });
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().user?.email).toBe('ada@example.com');
    expect(useAppLockStore.getState().isLocked).toBe(false);
    unmount();
    queryClient.clear();
  });

  it('does not touch tokens or the session store on failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useLogin());
    result.current.mutate({ email: 'ada@example.com', password: 'wrong' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSetTokens).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useAppLockStore.getState().isLocked).toBe(true);
    unmount();
    queryClient.clear();
  });
});
