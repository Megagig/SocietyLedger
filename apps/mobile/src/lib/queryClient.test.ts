import { key, userKey } from '@societyledger/query';

import { useSessionStore } from '@/stores/session';

// The phone's storage is MMKV, unavailable under Jest — the same in-memory fake the other tests use.
const mockStore = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => mockStore.set(k, String(v)),
    remove: (k: string) => mockStore.delete(k),
  },
}));
jest.mock('@/api/errors', () => ({ ApiError: class ApiError extends Error { isNetwork = false; } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { queryClient, resetAppQueryCache, persister, watchSessionForCacheReset } = require('./queryClient');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  queryClient.clear();
  mockStore.clear();
  useSessionStore.getState().reset();
});

describe('resetAppQueryCache', () => {
  it('empties the cache in memory and the saved copy on the phone', async () => {
    queryClient.setQueryData(key('acme', 'members', 'list'), ['Ada']);
    queryClient.setQueryData(userKey('acme', 7, 'ajoSavings'), { kobo: '500000' });
    mockStore.set('rq.cache', '{"saved":true}');

    await resetAppQueryCache();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mockStore.has('rq.cache')).toBe(false);
  });

  it('is safe to run twice', async () => {
    await resetAppQueryCache();
    await expect(resetAppQueryCache()).resolves.toBeUndefined();
  });
});

describe('when the session ends', () => {
  it('wipes the cache when the person signs out, or the token refresh fails and signs them out', async () => {
    const stop = watchSessionForCacheReset();
    useSessionStore.getState().setStatus('authenticated');
    queryClient.setQueryData(key('acme', 'members', 'list'), ['Ada']);
    mockStore.set('rq.cache', '{"saved":true}');

    useSessionStore.getState().setStatus('unauthenticated'); // what api/client.ts forceSignOut and the logout do
    await flush();

    expect(queryClient.getQueryData(key('acme', 'members', 'list'))).toBeUndefined();
    expect(mockStore.has('rq.cache')).toBe(false);
    stop();
  });

  it('wipes a previous person’s saved data on a cold start with an expired session (idle to unauthenticated)', async () => {
    useSessionStore.setState({ status: 'idle' }); // how the app starts, before it has checked the saved sign-in
    const stop = watchSessionForCacheReset();
    mockStore.set('rq.cache', '{"previous":"person"}');
    useSessionStore.getState().setStatus('unauthenticated');
    await flush();
    expect(mockStore.has('rq.cache')).toBe(false);
    stop();
  });

  it('leaves the cache alone while the person stays signed in', async () => {
    const stop = watchSessionForCacheReset();
    useSessionStore.getState().setStatus('authenticated');
    queryClient.setQueryData(key('acme', 'members', 'list'), ['Ada']);
    useSessionStore.getState().setStatus('authenticated');
    await flush();
    expect(queryClient.getQueryData(key('acme', 'members', 'list'))).toEqual(['Ada']);
    stop();
  });

  it('exposes the persister so the saved copy and the provider use the same storage key', () => {
    expect(typeof persister.removeClient).toBe('function');
  });
});
