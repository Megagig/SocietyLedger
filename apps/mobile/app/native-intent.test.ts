import { redirectSystemPath } from './+native-intent';

// Same expo-constants mock `lib/linking.test.ts` needs — `redirectSystemPath` calls straight
// through to `parseDeepLink`, which hits the same `Linking.parse()` → `expo-constants` path.
// Jest hoists this call above the import above regardless of source order (same as that file).
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { scheme: 'societyledger' } },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));

describe('redirectSystemPath', () => {
  it('routes an invite link to accept-invite with the token, no tenant param', () => {
    const result = redirectSystemPath({ path: 'societyledger://invite?token=abc123&tenant=opuogunstate', initial: true });
    expect(result).toBe('/(auth)/accept-invite?token=abc123');
  });

  it('routes a reset-password link to reset-password with token and tenant', () => {
    const result = redirectSystemPath({ path: 'societyledger://reset-password?token=xyz789&tenant=opuogunstate', initial: true });
    expect(result).toBe('/(auth)/reset-password?token=xyz789&tenant=opuogunstate');
  });

  it('URL-encodes token/tenant values that need it', () => {
    const result = redirectSystemPath({ path: 'societyledger://reset-password?token=a%2Bb&tenant=opuogunstate', initial: true });
    expect(result).toBe('/(auth)/reset-password?token=a%2Bb&tenant=opuogunstate');
  });

  it('returns the path unchanged for an unrecognised deep link', () => {
    const path = 'societyledger://unknown-host';
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });

  it('returns the path unchanged for a malformed URL rather than throwing', () => {
    const path = 'not a url at all';
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });

  it('leaves a payments-return link unchanged (not wired to a screen until F2.8)', () => {
    const path = 'societyledger://payments/return?reference=abc&status=success';
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});
