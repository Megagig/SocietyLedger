import { isThriftPathAllowed, thriftWord } from '@/lib/ajo/thriftScope';

describe('isThriftPathAllowed', () => {
  it('keeps the Ajo pages, the people, notifications, help and the plan', () => {
    for (const p of ['/dashboard', '/dashboard/member', '/dashboard/ajo', '/dashboard/ajo/8/members', '/dashboard/my-thrift/3/pay', '/dashboard/members', '/dashboard/members/4', '/dashboard/notifications/archive', '/dashboard/help/tickets', '/dashboard/subscription/addons', '/dashboard/member/my-profile', '/dashboard/member/settings']) {
      expect(isThriftPathAllowed(p)).toBe(true);
    }
  });

  it("closes an association's own pages", () => {
    for (const p of ['/dashboard/finance', '/dashboard/finance/transactions/2', '/dashboard/cooperatives', '/dashboard/welfare', '/dashboard/governance', '/dashboard/member/my-meetings', '/dashboard/member/my-voting', '/dashboard/my-finances', '/dashboard/payments', '/dashboard/accounting', '/dashboard/communications', '/dashboard/ai', '/dashboard/reports', '/dashboard/cash', '/dashboard/exports', '/dashboard/system/cron-jobs']) {
      expect(isThriftPathAllowed(p)).toBe(false);
    }
  });

  it('keeps only the settings a thrift group has', () => {
    for (const p of ['/dashboard/settings', '/dashboard/settings/association', '/dashboard/settings/roles', '/dashboard/settings/users', '/dashboard/settings/audit-logs']) expect(isThriftPathAllowed(p)).toBe(true);
    for (const p of ['/dashboard/settings/financial', '/dashboard/settings/payments', '/dashboard/settings/integrations', '/dashboard/settings/members-access', '/dashboard/settings/accounting-integration']) expect(isThriftPathAllowed(p)).toBe(false);
  });

  it('never touches a page outside the dashboard', () => {
    expect(isThriftPathAllowed('/onboarding/thrift')).toBe(true);
    expect(isThriftPathAllowed('/login')).toBe(true);
  });
});

describe('thriftWord', () => {
  it('swaps association words for a standalone group only', () => {
    expect(thriftWord('Association Profile', true)).toBe('Group profile');
    expect(thriftWord('Association Profile', false)).toBe('Association Profile');
    expect(thriftWord('Anything else', true)).toBe('Anything else');
  });
});
