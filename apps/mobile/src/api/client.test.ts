import axios, { AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';

// `client.ts` transitively imports `stores/tenant.ts` (zustand `persist`), which imports
// `lib/storage.ts`'s `createMMKV(...)` at module scope — MMKV's native module isn't available
// under Jest (same class of gap as `react-native-reanimated`'s, found at F1.4/F1.5). Mock both
// `lib/storage` and `lib/secure` with in-memory fakes so importing `client.ts` doesn't crash.
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

// Jest hoists `jest.mock()` factories above other module-scope code and only allows closing
// over variables named `mock*` for exactly this reason — can't use a plain `tokenCache` here.
let mockTokenCache = { accessToken: null as string | null, refreshToken: null as string | null, accessTokenExpiresAt: null as string | null };
jest.mock('@/lib/secure', () => ({
  getTokenCache: () => mockTokenCache,
  setTokens: async (next: Partial<typeof mockTokenCache>) => {
    mockTokenCache = { ...mockTokenCache, ...next };
  },
  clearTokens: async () => {
    mockTokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };
  },
  loadTokenCache: async () => mockTokenCache,
}));

jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- needs to run after the jest.mock calls above
const { client } = require('./client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setTokens, clearTokens } = require('@/lib/secure');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useModulesStore } = require('@/stores/modules');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSessionStore } = require('@/stores/session');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast } = require('sonner-native');

function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

describe('api/client', () => {
  let clientMock: MockAdapter;
  let globalMock: MockAdapter;

  beforeEach(async () => {
    clientMock = new MockAdapter(client);
    globalMock = new MockAdapter(axios);
    useModulesStore.getState().reset();
    await clearTokens();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clientMock.restore();
    globalMock.restore();
  });

  describe('single-flight refresh', () => {
    it('calls /auth/refresh exactly once for 3 concurrent 401s, then retries all 3 with the new token', async () => {
      await setTokens({ accessToken: 'old-token', refreshToken: 'refresh-1', accessTokenExpiresAt: futureIso(3600_000) });

      let refreshCalls = 0;
      globalMock.onPost(/\/auth\/refresh$/).reply(() => {
        refreshCalls += 1;
        return [200, { data: { token: 'new-token', refreshToken: 'refresh-2', accessTokenExpiresAt: futureIso(3600_000) } }];
      });

      clientMock.onGet('/ping').reply((config) => {
        const { headers } = config;
        const auth = headers instanceof AxiosHeaders ? headers.get('Authorization') : headers?.Authorization;
        if (auth === 'Bearer old-token') {
          return [401, { success: false, message: 'Unauthorized' }];
        }
        return [200, { success: true, data: { auth } }];
      });

      const results = await Promise.all([client.get('/ping'), client.get('/ping'), client.get('/ping')]);

      expect(refreshCalls).toBe(1);
      for (const result of results) {
        expect(result.data.data.auth).toBe('Bearer new-token');
      }
    });

    it('signs out (clears tokens, toasts) when the refresh itself fails', async () => {
      await setTokens({ accessToken: 'old-token', refreshToken: 'refresh-1', accessTokenExpiresAt: futureIso(3600_000) });
      globalMock.onPost(/\/auth\/refresh$/).reply(401, { success: false, code: 'REFRESH_TOKEN_INVALID', message: 'Invalid' });
      clientMock.onGet('/ping').reply(401, { success: false, message: 'Unauthorized' });

      await expect(client.get('/ping')).rejects.toMatchObject({ status: 401 });
      expect(toast.error).toHaveBeenCalledWith('Session expired');
    });
  });

  describe('SUBSCRIPTION_INACTIVE', () => {
    it('blocks the signed-in user when the server says the trial has ended', async () => {
      useSessionStore.getState().setUser({
        id: 1,
        email: 'ada@example.com',
        role: 'admin',
        permissions: [],
        roles: ['admin'],
        requiresOnboarding: false,
        platformRole: null,
        member: null,
      });
      clientMock.onGet('/members').reply(403, { success: false, code: 'SUBSCRIPTION_INACTIVE', reason: 'TRIAL_ENDED', message: 'Your free trial has ended.' });

      await expect(client.get('/members')).rejects.toMatchObject({ status: 403, code: 'SUBSCRIPTION_INACTIVE' });
      expect(useSessionStore.getState().user?.subscriptionAccess).toMatchObject({ allowed: false, reason: 'TRIAL_ENDED' });
    });
  });

  describe('MODULE_DISABLED', () => {
    it('marks the module disabled in stores/modules', async () => {
      clientMock.onGet('/welfare').reply(403, { success: false, error: 'MODULE_DISABLED', message: 'Not available', module: 'welfare' });

      await expect(client.get('/welfare')).rejects.toThrow();
      expect(useModulesStore.getState().isDisabled('welfare')).toBe(true);
    });

    it('also marks the module disabled for FEATURE_DISABLED', async () => {
      clientMock.onGet('/cooperatives/x').reply(403, {
        success: false,
        error: 'FEATURE_DISABLED',
        message: 'Not available',
        feature: 'loans',
        module: 'cooperatives',
      });

      await expect(client.get('/cooperatives/x')).rejects.toThrow();
      expect(useModulesStore.getState().isDisabled('cooperatives')).toBe(true);
    });
  });

  describe('429', () => {
    it('is never retried', async () => {
      let attempts = 0;
      clientMock.onGet('/rate-limited').reply(() => {
        attempts += 1;
        return [429, { success: false, message: 'Too many attempts' }];
      });

      await expect(client.get('/rate-limited')).rejects.toMatchObject({ status: 429 });
      expect(attempts).toBe(1);
    });
  });

  describe('token logging', () => {
    it('never logs the access or refresh token value', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await setTokens({ accessToken: 'super-secret-token', refreshToken: 'super-secret-refresh', accessTokenExpiresAt: futureIso(3600_000) });
      clientMock.onGet('/ping').reply(200, { success: true, data: { ok: true } });
      await client.get('/ping');

      const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls].flat().map((arg) => String(arg));
      expect(allCalls.some((text) => text.includes('super-secret-token') || text.includes('super-secret-refresh'))).toBe(false);

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
