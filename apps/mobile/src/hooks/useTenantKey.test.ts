import { renderHook } from '@testing-library/react-native';

import { useTenantStore } from '@/stores/tenant';
import { useTenantKey } from './useTenantKey';

// `tenant.ts` persists via the real `lib/storage.ts` → `react-native-mmkv`, unavailable under
// Jest — mocked with the same in-memory fake `client.test.ts` already established. Jest hoists
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

const fakeTenant = {
  id: 1,
  name: 'Opuogun State',
  slug: 'opuogunstate',
  subdomain: 'opuogunstate',
  tier: 'STARTER' as const,
  status: 'ACTIVE' as const,
  logo: null,
  primaryColor: null,
};

describe('useTenantKey', () => {
  it('returns the current tenant subdomain', async () => {
    useTenantStore.getState().setCurrent(fakeTenant);
    const { result } = await renderHook(() => useTenantKey());
    expect(result.current).toBe('opuogunstate');
  });

  it("falls back to 'no-tenant' when none is set", async () => {
    useTenantStore.getState().clearCurrent();
    const { result } = await renderHook(() => useTenantKey());
    expect(result.current).toBe('no-tenant');
  });
});
