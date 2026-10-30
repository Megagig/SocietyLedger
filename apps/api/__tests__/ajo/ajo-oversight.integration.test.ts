/**
 * Staff oversight reads (T9.2) against a real (disposable) database: the cross-tenant list with its filters, and the group detail, whose
 * answer must go out as JSON (money columns are BigInt, which JSON cannot carry unless converted).
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-oversight.integration --forceExit
 */
export {};
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
  process.env.TOTP_ENCRYPTION_KEY = 'integration-test-encryption-key-0123456789';
}

jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return { ...actual, notifyUser: jest.fn(async () => undefined), notifyPermissionHolders: jest.fn(async () => undefined) };
});
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));

import { isOverLimit } from '../../src/modules/ajo/ajo-oversight.service';

describe('the over-limit flag (pure)', () => {
  it('flags only a count above a real limit; unlimited and unknown never flag, and sitting exactly at the limit is fine', () => {
    expect(isOverLimit(30, 31)).toBe(true);
    expect(isOverLimit(30, 30)).toBe(false);
    expect(isOverLimit(null, 5000)).toBe(false);
    expect(isOverLimit(undefined, 5000)).toBe(false);
  });
});

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(60000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo oversight reads (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let oversight: typeof import('../../src/modules/ajo/ajo-oversight.service');
  let standaloneGroup: number;
  let associationGroup: number;
  const name = `Oversight ${run}`;

  async function seed(label: string, kind: 'ASSOCIATION' | 'THRIFT_GROUP', model: 'ROTATING_POT' | 'COLLECTOR_THRIFT') {
    const slug = `ov-${label}-${run}`;
    const assoc = await prisma.association.create({ data: { name: `${name} ${label}`, slug, subdomain: slug, kind } });
    const group = await prisma.ajoGroup.create({
      data: { associationId: assoc.id, name: `${label} circle`, model, frequency: 'WEEKLY', contributionKobo: 500_000n, startDate: new Date('2027-03-01'), maxParticipants: 10, status: 'ACTIVE' },
    });
    const member = await prisma.member.create({ data: { associationId: assoc.id, memberId: `OV-${label}-${run}`, firstName: 'Ada', lastName: label } });
    const membership = await prisma.ajoMembership.create({ data: { associationId: assoc.id, groupId: group.id, memberId: member.id, status: 'ACTIVE' } });
    return { assoc, group, membership };
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    oversight = require('../../src/modules/ajo/ajo-oversight.service');
    const a = await seed('pot', 'THRIFT_GROUP', 'ROTATING_POT');
    standaloneGroup = a.group.id;
    await prisma.ajoPayout.create({
      data: {
        associationId: a.assoc.id, groupId: a.group.id, membershipId: a.membership.id, round: 1, grossKobo: 5_000_000n, netKobo: 4_900_000n, confirmedKobo: 5_000_000n,
        status: 'APPROVED', preparedBy: 1, accountSnapshot: { bankName: 'Test Bank', accountName: 'Ada Pot', last4: '1234' }, idempotencyKey: `ov-${run}-1`,
      },
    });
    await prisma.ajoDefaultCase.create({ data: { associationId: a.assoc.id, groupId: a.group.id, membershipId: a.membership.id, outstandingKobo: 250_000n, status: 'OPEN' } });
    const b = await seed('collect', 'ASSOCIATION', 'COLLECTOR_THRIFT');
    associationGroup = b.group.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('lists circles of every owner and filters by owner kind, type and name', async () => {
    const all = await oversight.listGroups({ search: name, take: 50 });
    expect(all.items.map((g) => g.id).sort()).toEqual([standaloneGroup, associationGroup].sort());

    const standalone = await oversight.listGroups({ search: name, kind: 'THRIFT_GROUP' });
    expect(standalone.items.map((g) => g.id)).toEqual([standaloneGroup]);
    const collectors = await oversight.listGroups({ search: name, model: 'COLLECTOR_THRIFT' });
    expect(collectors.items.map((g) => g.id)).toEqual([associationGroup]);
    expect((await oversight.listGroups({ search: `${name} no such` })).total).toBe(0);
  });

  it('flags what needs a look: open payouts and default cases, with money as plain numbers', async () => {
    const row = (await oversight.listGroups({ search: name, kind: 'THRIFT_GROUP' })).items[0]!;
    expect(row).toMatchObject({ openPayouts: 1, openCases: 1, participants: 1, contributionKobo: 500_000, tier: null });
    expect(typeof row.contributionKobo).toBe('number');
    const quiet = (await oversight.listGroups({ search: name, kind: 'ASSOCIATION' })).items[0]!;
    expect(quiet).toMatchObject({ openPayouts: 0, openCases: 0 });
  });

  it('gives the detail as JSON-safe data: payouts, cases, people and the tier picture without the trial tier', async () => {
    const detail = await oversight.getGroup(standaloneGroup);
    expect(() => JSON.stringify(detail)).not.toThrow();
    expect(detail.payouts).toHaveLength(1);
    expect(detail.payouts[0]).toMatchObject({ status: 'APPROVED', netKobo: 4_900_000, name: 'Ada pot' });
    expect(detail.cases[0]).toMatchObject({ status: 'OPEN', outstandingKobo: 250_000 });
    expect(detail.members).toEqual({ ACTIVE: 1 });
    expect(detail.tier.current).toBeNull();
    expect(detail.tier.activeContributors).toBe(1);
    expect(detail.tier.options.map((o) => o.code)).not.toContain('ajo-trial');
    expect(detail.association.kind).toBe('THRIFT_GROUP');
  });

  it('shows no over-limit warning for a group that holds no tier', async () => {
    expect((await oversight.getGroup(standaloneGroup)).tier.overLimit).toBe(false);
    expect((await oversight.listGroups({ search: name, kind: 'THRIFT_GROUP' })).items[0]!.overLimit).toBe(false);
  });

  it('cancels an approved payout as staff for real: the payout is void, the group audit trail and the staff Action log both carry the reason', async () => {
    const staff = await prisma.user.create({ data: { email: `staff-${run}@test.local`, passwordHash: 'x', isActive: true, platformRole: 'FINANCE_ADMIN' } });
    const payout = await prisma.ajoPayout.findFirstOrThrow({ where: { groupId: standaloneGroup } });
    const reason = 'The bank account was entered wrongly';

    await oversight.voidPayoutAsStaff({ payoutId: payout.id, reason, actor: { id: staff.id, role: 'FINANCE_ADMIN' } });

    const after = await prisma.ajoPayout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(after).toMatchObject({ status: 'VOID', voidedBy: staff.id });
    expect(after.voidReason).toContain(reason);
    expect(await prisma.auditLog.count({ where: { tableName: 'ajo_payouts', recordId: payout.id, action: 'AJO_PAYOUT_VOIDED', userId: staff.id } })).toBe(1);
    const log = await prisma.platformActionLog.findFirstOrThrow({ where: { actionType: 'AJO_PAYOUT_VOIDED_BY_STAFF', targetId: payout.id } });
    expect(log).toMatchObject({ reason, actorId: staff.id, actorRole: 'FINANCE_ADMIN' });

    // Doing it again is a no-op with no second log row, and a payout that is paid is never touched.
    await oversight.voidPayoutAsStaff({ payoutId: payout.id, reason, actor: { id: staff.id, role: 'FINANCE_ADMIN' } });
    expect(await prisma.platformActionLog.count({ where: { actionType: 'AJO_PAYOUT_VOIDED_BY_STAFF', targetId: payout.id } })).toBe(1);
    await prisma.ajoPayout.update({ where: { id: payout.id }, data: { status: 'PAID' } });
    await expect(oversight.voidPayoutAsStaff({ payoutId: payout.id, reason, actor: { id: staff.id, role: 'FINANCE_ADMIN' } })).rejects.toMatchObject({ code: 'PAYOUT_ALREADY_PAID' });
  });

  it('suspends and reactivates the owner through the platform path, with the reason in the Action log', async () => {
    const staff = await prisma.user.create({ data: { email: `super-${run}@test.local`, passwordHash: 'x', isActive: true, platformRole: 'SUPER_ADMIN' } });
    const owner = (await prisma.ajoGroup.findUniqueOrThrow({ where: { id: associationGroup } })).associationId;
    const reason = 'Chargeback dispute under review';

    await oversight.setOwnerSuspended({ groupId: associationGroup, suspend: true, reason, actor: { id: staff.id, role: 'SUPER_ADMIN' } });
    expect((await prisma.association.findUniqueOrThrow({ where: { id: owner } })).status).toBe('SUSPENDED');
    expect((await oversight.getGroup(associationGroup)).association.status).toBe('SUSPENDED');
    await expect(oversight.setOwnerSuspended({ groupId: associationGroup, suspend: true, reason, actor: { id: staff.id, role: 'SUPER_ADMIN' } })).rejects.toMatchObject({ status: 409, code: 'OWNER_STATUS_UNCHANGED' });
    await expect(oversight.setOwnerSuspended({ groupId: associationGroup, suspend: false, reason: 'short', actor: { id: staff.id, role: 'SUPER_ADMIN' } })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

    await oversight.setOwnerSuspended({ groupId: associationGroup, suspend: false, reason, actor: { id: staff.id, role: 'SUPER_ADMIN' } });
    expect((await prisma.association.findUniqueOrThrow({ where: { id: owner } })).status).toBe('ACTIVE');
    expect(await prisma.platformActionLog.count({ where: { associationId: owner, reason, actorId: staff.id } })).toBe(2);
  });

  it('answers a missing group with a clear 404', async () => {
    await expect(oversight.getGroup(2_000_000_000)).rejects.toMatchObject({ status: 404, code: 'GROUP_NOT_FOUND' });
  });
});
