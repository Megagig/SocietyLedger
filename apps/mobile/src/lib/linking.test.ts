import { parseDeepLink } from './linking';

// `expo-linking`'s `parse()` calls into `expo-constants` (`getHostUri()` → `hasCustomScheme()`)
// even for a simple parse — jest-expo's default auto-mock leaves `executionEnvironment`
// undefined, which makes `hasCustomScheme()` fall through to a branch that reads
// `Constants.linkingUri.replace(...)` on `undefined` and throws. `executionEnvironment: 'bare'`
// short-circuits that branch, matching how the app always ships with a custom scheme (never the
// Expo Go store client) — see app.config.ts's per-variant `scheme`. Jest hoists this call above
// the import above regardless of source order, so this placement is for lint (`import/first`),
// not correctness.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { scheme: 'societyledger' } },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));

describe('parseDeepLink', () => {
  it('parses a valid invite link', () => {
    expect(parseDeepLink('societyledger://invite?token=abc123&tenant=opuogunstate')).toEqual({
      type: 'invite',
      token: 'abc123',
      tenant: 'opuogunstate',
    });
  });

  it('rejects an invite link missing tenant', () => {
    expect(parseDeepLink('societyledger://invite?token=abc123')).toBeNull();
  });

  it('parses a valid reset-password link', () => {
    expect(parseDeepLink('societyledger://reset-password?token=xyz&tenant=opuogunstate')).toEqual({
      type: 'resetPassword',
      token: 'xyz',
      tenant: 'opuogunstate',
    });
  });

  it('parses a valid payments/return link, with optional status', () => {
    expect(parseDeepLink('societyledger://payments/return?reference=ref-1&status=success')).toEqual({
      type: 'paymentsReturn',
      reference: 'ref-1',
      status: 'success',
    });
  });

  it('parses a payments/return link with no status', () => {
    expect(parseDeepLink('societyledger://payments/return?reference=ref-1')).toEqual({
      type: 'paymentsReturn',
      reference: 'ref-1',
    });
  });

  it('rejects a payments link missing reference', () => {
    expect(parseDeepLink('societyledger://payments/return?status=success')).toBeNull();
  });

  it('rejects a payments link with an unknown path', () => {
    expect(parseDeepLink('societyledger://payments/initiate?reference=ref-1')).toBeNull();
  });

  it('parses a notifications link into its route', () => {
    expect(parseDeepLink('societyledger://notifications/money/payments')).toEqual({
      type: 'notifications',
      route: 'money/payments',
    });
  });

  it('parses a thrift link, with or without a path', () => {
    expect(parseDeepLink('societyledger://thrift/circles/12')).toEqual({ type: 'thrift', route: 'circles/12' });
    expect(parseDeepLink('societyledger://thrift')).toEqual({ type: 'thrift', route: '' });
  });

  it('returns null for an unrecognised host', () => {
    expect(parseDeepLink('societyledger://unknown?foo=bar')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseDeepLink('not a url at all')).toBeNull();
  });
});
