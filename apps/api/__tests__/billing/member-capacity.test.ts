/** The member limit must hold on every path that creates a member, not only POST /members. */
const mockCount = jest.fn();
const mockEntitlements = jest.fn();
jest.mock('../../src/lib/prisma', () => ({ prisma: { member: { count: (...a: unknown[]) => mockCount(...a) } }, __esModule: true, default: {} }));
jest.mock('../../src/services/billing/entitlements.service', () => ({ getEntitlements: (...a: unknown[]) => mockEntitlements(...a) }));

import fs from 'fs';
import path from 'path';
import { assertMemberCapacity, MemberLimitError } from '../../src/middleware/subscription.middleware';

describe('assertMemberCapacity', () => {
  it('allows a member while under the limit and refuses at it', async () => {
    mockEntitlements.mockResolvedValue({ limits: { members: 100 } });
    mockCount.mockResolvedValue(99);
    await expect(assertMemberCapacity(1)).resolves.toBeUndefined();
    mockCount.mockResolvedValue(100);
    await expect(assertMemberCapacity(1)).rejects.toBeInstanceOf(MemberLimitError);
  });

  it('refuses a batch that would pass the limit and reports the numbers', async () => {
    mockEntitlements.mockResolvedValue({ limits: { members: 100 } });
    mockCount.mockResolvedValue(98);
    await expect(assertMemberCapacity(1, 3)).rejects.toMatchObject({ code: 'MEMBER_LIMIT_REACHED', limit: 100, currentCount: 98 });
  });

  it('never refuses a plan with no member limit', async () => {
    mockEntitlements.mockResolvedValue({ limits: {} });
    mockCount.mockResolvedValue(100000);
    await expect(assertMemberCapacity(1)).resolves.toBeUndefined();
  });
});

describe('every member-creating path checks the limit', () => {
  const src = (f: string) => fs.readFileSync(path.resolve(__dirname, '../../src/modules', f), 'utf8');
  it.each([
    ['members/members.routes.ts', 'memberLimitMiddleware'],
    ['member-invites/member-invites.service.ts', 'assertMemberCapacity'],
    ['onboarding/onboarding.controller.ts', 'assertMemberCapacity'],
    ['member-finance/member-finance.controller.ts', 'assertMemberCapacity'],
  ])('%s', (file, guard) => {
    expect(src(file)).toContain(guard);
  });
});
