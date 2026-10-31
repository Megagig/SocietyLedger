/**
 * @jest-environment jsdom
 *
 * Which token the fetch-based API client sends. It must be this tab's own sign-in: the API's HttpOnly login cookie is shared by every group
 * in the browser and holds whoever signed in last, so relying on it makes a person with accounts in two groups fail with TENANT_MISMATCH.
 */
jest.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ markSubscriptionBlocked: jest.fn() }) } }));
jest.mock('@/store/moduleLockStore', () => ({ useModuleLockStore: { getState: () => ({ open: jest.fn() }) } }));
jest.mock('@societyledger/shared', () => ({ accessCopy: jest.fn(), moduleDisplayName: jest.fn() }));
jest.mock('@/utils/tenant', () => ({ createFetchHeaders: (h: Record<string, string>) => h }));

import { apiFetch, getAuthToken } from '@/utils/api';
import { verifySubscriptionPayment } from '@/lib/api/subscriptions';

const save = (token: unknown) => window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token } }));
const setCookie = (value: string) => { document.cookie = `token=${value}; path=/`; };
const clearCookie = () => { document.cookie = 'token=; path=/; max-age=0'; };

beforeEach(() => {
  window.localStorage.clear();
  clearCookie();
});

describe('getAuthToken', () => {
  it('uses this tab’s own saved sign-in', () => {
    save('TOKEN-OF-THIS-TAB');
    expect(getAuthToken()).toBe('TOKEN-OF-THIS-TAB');
  });

  it('prefers the saved sign-in over a cookie, so another group’s cookie can never win', () => {
    save('TOKEN-OF-THIS-TAB');
    setCookie('TOKEN-OF-ANOTHER-GROUP');
    expect(getAuthToken()).toBe('TOKEN-OF-THIS-TAB');
  });

  it('falls back to the readable cookie when there is no saved sign-in (impersonation writes it)', () => {
    setCookie('COOKIE-TOKEN');
    expect(getAuthToken()).toBe('COOKIE-TOKEN');
  });

  it('falls back to the cookie when the saved state is unreadable or has no token', () => {
    window.localStorage.setItem('auth-storage', '{not json');
    setCookie('COOKIE-TOKEN');
    expect(getAuthToken()).toBe('COOKIE-TOKEN');
    save(null);
    expect(getAuthToken()).toBe('COOKIE-TOKEN');
  });

  it('is null when there is nothing to send', () => {
    expect(getAuthToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it('sends this tab’s token as the Authorization header', async () => {
    const calls: Array<{ headers: Record<string, string> }> = [];
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => { calls.push({ headers: init?.headers as Record<string, string> }); return { status: 200 } as Response; }) as unknown as typeof fetch;
    save('TOKEN-OF-THIS-TAB');
    setCookie('TOKEN-OF-ANOTHER-GROUP');
    await apiFetch('http://localhost:4001/api/subscriptions/plans');
    expect(calls[0].headers.Authorization).toBe('Bearer TOKEN-OF-THIS-TAB');
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    const calls: Array<{ headers: Record<string, string> }> = [];
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => { calls.push({ headers: init?.headers as Record<string, string> }); return { status: 200 } as Response; }) as unknown as typeof fetch;
    await apiFetch('http://localhost:4001/api/subscriptions/plans');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });
});

describe('checking a payment', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it('asks the API who you are with this tab’s token, not the browser-wide login cookie', async () => {
    const seen: Array<{ url: string; auth?: string }> = [];
    global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), auth: (init?.headers as Record<string, string>)?.Authorization });
      return { status: 200, ok: true, json: async () => ({ success: true, data: { status: 'ACTIVE', subdomain: 'progress' } }) } as unknown as Response;
    }) as unknown as typeof fetch;
    save('TOKEN-OF-THIS-TAB');
    setCookie('TOKEN-OF-ANOTHER-GROUP');
    const outcome = await verifySubscriptionPayment('SUB-123');
    expect(seen[0].url).toContain('/verify/SUB-123');
    expect(seen[0].auth).toBe('Bearer TOKEN-OF-THIS-TAB');
    expect(outcome.state).toBe('success');
  });
});
