/**
 * @jest-environment jsdom
 *
 * The cache is bound to who is signed in. Signing out, or another person (or association) signing in, gives the app a new empty cache, and
 * what was saved on the device for the one who left is deleted. Only allow-listed data is saved, and never payments.
 */
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { key, userKey } from '@societyledger/query';

type MockUser = { id: number; associationId?: number } | null;
let mockState: { user: MockUser; impersonatedAssociation: { id: number } | null } = { user: null, impersonatedAssociation: null };
const mockListeners = new Set<() => void>();
jest.mock('@/store/authStore', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useAuthStore: (select: (s: typeof mockState) => unknown) =>
      select(useSyncExternalStore((l: () => void) => { mockListeners.add(l); return () => mockListeners.delete(l); }, () => mockState, () => mockState)),
  };
});

const mockSaved = new Map<string, string>();
const mockRemoved: string[] = [];
jest.mock('@/lib/query/idb', () => ({
  cacheStorageKey: (id: string) => `rq.web.${id}`,
  idbStorage: {
    getItem: async (k: string) => mockSaved.get(k) ?? null,
    setItem: async (k: string, v: string) => { mockSaved.set(k, v); },
    removeItem: async (k: string) => { mockRemoved.push(k); mockSaved.delete(k); },
  },
}));

import { QueryBoundary } from '@/lib/query/QueryBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let current: QueryClient;
function Probe() {
  current = useQueryClient();
  return null;
}

function signIn(user: MockUser, impersonatedAssociation: { id: number } | null = null) {
  mockState = { user, impersonatedAssociation };
  mockListeners.forEach((l) => l());
}

let root: Root;
let host: HTMLElement;
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  mockSaved.clear();
  mockRemoved.length = 0;
  mockState = { user: { id: 1, associationId: 7 }, impersonatedAssociation: null };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryBoundary><Probe /></QueryBoundary>);
    await settle();
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('who the cache belongs to', () => {
  it('gives a person who signs in after another an empty cache', async () => {
    current.setQueryData(key(7, 'members', 'list'), ['Ada']);
    current.setQueryData(['members-list'], ['Ada']); // an old-style key with no association is dropped too
    const first = current;

    await act(async () => { signIn({ id: 2, associationId: 7 }); await settle(); });

    expect(current).not.toBe(first);
    expect(current.getQueryData(key(7, 'members', 'list'))).toBeUndefined();
    expect(current.getQueryData(['members-list'])).toBeUndefined();
  });

  it('gives the same association a different cache for a different person', async () => {
    current.setQueryData(userKey(7, 1, 'ajoSavings'), { kobo: '500000' });
    await act(async () => { signIn({ id: 3, associationId: 7 }); await settle(); });
    expect(current.getQueryData(userKey(7, 1, 'ajoSavings'))).toBeUndefined();
  });

  it('gives a new cache when the association changes for the same person (acting for another association)', async () => {
    current.setQueryData(key(7, 'members', 'list'), ['Ada']);
    await act(async () => { signIn({ id: 1, associationId: 7 }, { id: 9 }); await settle(); });
    expect(current.getQueryData(key(7, 'members', 'list'))).toBeUndefined();
  });

  it('gives sign-out an empty cache and deletes what was saved for the person who left', async () => {
    current.setQueryData(key(7, 'settings', 'association'), { name: 'Ajo Ltd' });
    await act(async () => { await settle(1300); }); // the saved copy is written after a short delay
    expect(mockSaved.has('rq.web.7:1')).toBe(true);

    await act(async () => { signIn(null); await settle(); });

    expect(current.getQueryData(key(7, 'settings', 'association'))).toBeUndefined();
    expect(mockRemoved).toContain('rq.web.7:1');
    expect(mockSaved.has('rq.web.7:1')).toBe(false);
  });

  it('keeps the same cache while the same person stays signed in', async () => {
    const first = current;
    current.setQueryData(key(7, 'members', 'list'), ['Ada']);
    await act(async () => { signIn({ id: 1, associationId: 7 }); await settle(); }); // the same identity, a new object
    expect(current).toBe(first);
    expect(current.getQueryData(key(7, 'members', 'list'))).toEqual(['Ada']);
  });
});

describe('what is saved on the device', () => {
  it('saves allow-listed data and never payments, payouts or a bank account', async () => {
    current.setQueryData(key(7, 'settings', 'association'), { name: 'Ajo Ltd' });
    current.setQueryData(key(7, 'payments', 'list'), [{ id: 1, amount: '100000' }]);
    current.setQueryData(key(7, 'ajoPayouts', 'mine'), [{ id: 2 }]);
    current.setQueryData(key(7, 'profile', 'bank-account'), { number: '0123456789' });
    await act(async () => { await settle(1300); });

    const saved = mockSaved.get('rq.web.7:1') ?? '';
    expect(saved).toContain('settings');
    expect(saved).not.toContain('payments');
    expect(saved).not.toContain('ajoPayouts');
    expect(saved).not.toContain('0123456789');
  });

  it('saves nothing for a signed-out visitor', async () => {
    await act(async () => { signIn(null); await settle(); });
    current.setQueryData(key(7, 'settings', 'association'), { name: 'Ajo Ltd' });
    await act(async () => { await settle(1300); });
    expect([...mockSaved.keys()]).toEqual([]);
  });
});
