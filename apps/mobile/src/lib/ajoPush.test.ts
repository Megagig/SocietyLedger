import { ajoPushHref, thriftDeepLinkPath } from './ajoPush';

const member = ['ajo.view_own'];
const collector = ['ajo.collect'];
const officer = ['ajo.manage', 'ajo.reconcile'];
const admin = ['ajo.manage', 'ajo.approve_payout'];

describe('ajoPushHref', () => {
  it('sends a contributor to their own circles and payments', () => {
    for (const type of ['ajo.receipt', 'ajo.reminder', 'ajo.late_fee', 'ajo.rules_changed', 'ajo.payout_paid', 'ajo.group_started', 'ajo.order_drawn', 'ajo.verification_status']) {
      expect(ajoPushHref(type, 5, member)).toBe('/(app)/(tabs)/money/thrift');
    }
  });
  it('opens the membership when someone is approved', () => {
    expect(ajoPushHref('ajo.membership_approved', 9, member)).toBe('/(app)/(tabs)/money/thrift/9');
    expect(ajoPushHref('ajo.membership_approved', undefined, member)).toBe('/(app)/(tabs)/money/thrift');
  });
  it('sends officers to the circles list and a default case to the case', () => {
    expect(ajoPushHref('ajo.payout_prepared', 3, admin)).toBe('/(app)/(tabs)/manage/thrift');
    expect(ajoPushHref('ajo.dispute_raised', 3, officer)).toBe('/(app)/(tabs)/manage/thrift');
    expect(ajoPushHref('ajo.default_case', 7, admin)).toBe('/(app)/(tabs)/manage/thrift/case/7');
    expect(ajoPushHref('ajo.plan_missed', 7, officer)).toBe('/(app)/(tabs)/manage/thrift/case/7');
  });
  it('sends a collector to today when contributors change', () => {
    expect(ajoPushHref('ajo.collector_assigned', 2, collector)).toBe('/(app)/(tabs)/manage/thrift/today');
    expect(ajoPushHref('ajo.collector_unassigned', 2, member)).toBe('/(app)/notifications');
  });
  it('follows the role for a swap request, and never sends someone to a screen they cannot open', () => {
    expect(ajoPushHref('ajo.swap_requested', 1, admin)).toBe('/(app)/(tabs)/manage/thrift');
    expect(ajoPushHref('ajo.swap_requested', 1, member)).toBe('/(app)/(tabs)/money/thrift');
    expect(ajoPushHref('ajo.payout_prepared', 3, member)).toBe('/(app)/notifications');
    expect(ajoPushHref('ajo.default_case', 7, member)).toBe('/(app)/notifications');
    expect(ajoPushHref('ajo.receipt', 1, [])).toBe('/(app)/notifications');
  });
  it('falls back to the notifications list for a type it does not know', () => {
    expect(ajoPushHref('ajo.something_new', 1, admin)).toBe('/(app)/notifications');
  });
});

describe('thriftDeepLinkPath', () => {
  it('maps the thrift links', () => {
    expect(thriftDeepLinkPath('')).toBe('/(app)/(tabs)/money/thrift');
    expect(thriftDeepLinkPath('today')).toBe('/(app)/(tabs)/manage/thrift/today');
    expect(thriftDeepLinkPath('circles')).toBe('/(app)/(tabs)/manage/thrift');
    expect(thriftDeepLinkPath('circles/12')).toBe('/(app)/(tabs)/manage/thrift/12');
    expect(thriftDeepLinkPath('12')).toBe('/(app)/(tabs)/money/thrift/12');
  });
  it('refuses anything else', () => {
    expect(thriftDeepLinkPath('circles/abc')).toBeNull();
    expect(thriftDeepLinkPath('guarantor/abc')).toBeNull();
    expect(thriftDeepLinkPath('12/pay/now')).toBeNull();
  });
});
