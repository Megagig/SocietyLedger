import { thriftRedirectFor } from './thriftRouteGuard';

const at = (...rest: string[]) => ['(app)', '(tabs)', ...rest];

describe('thriftRedirectFor', () => {
  it('leaves an association alone', () => {
    expect(thriftRedirectFor(at('home'), false)).toBeNull();
    expect(thriftRedirectFor(at('manage', 'cash'), false)).toBeNull();
  });

  it('sends a standalone group away from the association Home and Community', () => {
    expect(thriftRedirectFor(at('home'), true)).toBe('/(app)/(tabs)/money');
    expect(thriftRedirectFor(at('community', 'welfare'), true)).toBe('/(app)/(tabs)/money');
  });

  it('closes the association Money screens but keeps Thrift', () => {
    expect(thriftRedirectFor(at('money', 'dues'), true)).toBe('/(app)/(tabs)/money');
    expect(thriftRedirectFor(at('money', 'loans'), true)).toBe('/(app)/(tabs)/money');
    expect(thriftRedirectFor(at('money', 'thrift'), true)).toBeNull();
    expect(thriftRedirectFor(at('money'), true)).toBeNull();
  });

  it('closes the association Manage screens but keeps Thrift, Members, Settings', () => {
    for (const area of ['finance', 'cash', 'cooperatives', 'welfare', 'meetings', 'elections', 'polls', 'accounting', 'communication', 'ai', 'payments', 'reports']) {
      expect(thriftRedirectFor(at('manage', area), true)).toBe('/(app)/(tabs)/manage');
    }
    for (const area of ['thrift', 'members', 'settings']) expect(thriftRedirectFor(at('manage', area), true)).toBeNull();
    expect(thriftRedirectFor(at('manage', 'thrift', 'payments'), true)).toBeNull();
    expect(thriftRedirectFor(at('money', 'thrift', 'payments'), true)).toBeNull();
    expect(thriftRedirectFor(at('manage'), true)).toBeNull();
  });

  it('keeps the Circle and Profile tabs', () => {
    expect(thriftRedirectFor(at('circle'), true)).toBeNull();
    expect(thriftRedirectFor(at('profile', 'security'), true)).toBeNull();
  });
});
