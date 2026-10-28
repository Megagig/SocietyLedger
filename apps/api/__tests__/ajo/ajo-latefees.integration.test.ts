/**
 * Ajo T6 against a real (disposable) database: overdue, late fees (assessment from the rule version the member accepted, the pause while a
 * payment is checked, disclosure and the 48-hour notice, payment after instalments, waiving), disputes, reminders and the job cycle.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped. Times are passed in, so nothing depends on today's date, and every test
 * has its own association so jobs run on one test's groups never touch another's.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-latefees --forceExit
 */
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
  process.env.TOTP_ENCRYPTION_KEY = 'integration-test-encryption-key-0123456789';
}

const notices: Array<{ to: string; userId?: number; permission?: string; pushType: string; message: string }> = [];
const inApp: Array<{ userId: number; kind: string; title: string; message: string; pushType?: string }> = [];
const sms: Array<{ to: string; text: string }> = [];
const smsMode = { noCredits: false };
const moduleOn = new Map<number, boolean>();

jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })),
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return {
    ...actual,
    notifyUser: jest.fn(async (_a: number, userId: number, n: { pushType: string; message: string }) => {
      notices.push({ to: 'user', userId, pushType: n.pushType, message: n.message });
    }),
    notifyPermissionHolders: jest.fn(async (_a: number, permission: string, n: { pushType: string; message: string }) => {
      notices.push({ to: 'holders', permission, pushType: n.pushType, message: n.message });
    }),
  };
});
jest.mock('../../src/lib/storage', () => ({
  uploadFile: jest.fn(async (key: string) => key),
  deleteFile: jest.fn(async () => undefined),
  getPresignedUrl: jest.fn(async (key: string) => `https://files.test/${key}`),
}));
jest.mock('../../src/modules/sms/sms-engine', () => {
  const { RuleError } = jest.requireActual('../../src/modules/finance/rule-error');
  return {
    dispatchMessages: jest.fn(async (input: { recipients: Array<{ phone: string }>; text: string }) => {
      if (smsMode.noCredits) throw new RuleError('No SMS credits left.', 402, 'INSUFFICIENT_CREDITS');
      sms.push({ to: input.recipients[0].phone, text: input.text });
      return { accepted: 1, credits: 1, messageIds: [sms.length], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) };
    }),
  };
});
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async (o: { userId: number; kind: string; title: string; message: string; pushType?: string }) => {
    inApp.push({ userId: o.userId, kind: o.kind, title: o.title, message: o.message, pushType: o.pushType });
    return { inAppCreated: true, emailSent: false, smsSent: false };
  }),
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: jest.fn(async (associationId: number) => ({ isEnabled: moduleOn.get(associationId) ?? true })) },
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(90000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const at = (iso: string) => new Date(iso);
const NOW = at('2027-02-01T10:00:00Z');
const BEFORE_START = at('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const FEE = { lateFeeType: 'FIXED' as const, lateFeeValue: 50_000n, graceDays: 3 };
const AMOUNT = 500_000n;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo late fees, disputes and reminders (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let rules: typeof import('../../src/modules/ajo/ajo-rules.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let fees: typeof import('../../src/modules/ajo/ajo-latefee.service');
  let disputes: typeof import('../../src/modules/ajo/ajo-dispute.service');
  let reminders: typeof import('../../src/modules/ajo/ajo-reminder.service');
  let cycle: typeof import('../../src/modules/ajo/ajo-risk-cycle');
  let ledger: typeof import('../../src/modules/ajo/ajo-ledger.service');

  interface World {
    A: number;
    admin: { id: number };
    officer: { id: number };
    recon: { id: number };
    roles: Map<string, number>;
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-t6-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo T6 ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), officer: await user('officer'), recon: await user('recon'), roles: new Map() };
    await setHolders(w, 'ajo.reconcile', [w.recon.id]);
    return w;
  }
  async function setHolders(w: World, key: string, userIds: number[]) {
    if (!w.roles.has(key)) {
      const permission = await prisma.permission.upsert({ where: { key }, create: { key, description: `Test ${key}`, module: 'Ajo' }, update: {} });
      const role = await prisma.role.create({ data: { associationId: w.A, name: `t6-${key}-${run}-${++counter}`, displayName: key } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      w.roles.set(key, role.id);
    }
    const roleId = w.roles.get(key) as number;
    await prisma.userRole.deleteMany({ where: { associationId: w.A, roleId } });
    for (const userId of userIds) await prisma.userRole.create({ data: { userId, roleId, associationId: w.A } });
  }
  async function mkMember(w: World, login: boolean) {
    const n = ++counter;
    const user = login ? await prisma.user.create({ data: { associationId: w.A, email: `member-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } }) : null;
    return prisma.member.create({ data: { associationId: w.A, userId: user?.id ?? null, memberId: `T6${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', address: '12 Market Road, Aba', status: 'active' } });
  }
  async function join(w: World, groupId: number, login: boolean) {
    const member = await mkMember(w, login);
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id });
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return { member, membership };
  }
  async function thrift(w: World, o: { people?: number; login?: boolean; rules?: Record<string, unknown>; cycleLength?: number; frequency?: 'WEEKLY' | 'DAILY'; contribution?: number } = {}) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      rules: o.rules as never,
      fields: { name: `Circle ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: o.frequency ?? 'WEEKLY', contributionKobo: o.contribution ?? Number(AMOUNT), startDate: START, cycleLength: o.cycleLength ?? 4, maxParticipants: 30 },
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    const joined = [];
    for (let i = 0; i < (o.people ?? 2); i++) joined.push(await join(w, g.id, o.login ?? true));
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    return { g, joined, groupsToRun: [{ id: g.id, associationId: w.A, timezone: 'Africa/Lagos', cutoffTime: '18:00', name: g.name }] };
  }
  /** A payment reported and confirmed by someone else, so it counts. */
  async function pay(w: World, groupId: number, membershipId: number, amount: bigint, now: Date) {
    const rep = await contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: amount, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
    await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now });
    return rep.contribution.id;
  }
  const feesOf = (w: World) => prisma.ajoLateFeeAssessment.findMany({ where: { associationId: w.A }, orderBy: { id: 'asc' } });
  const installments = (membershipId: number) => prisma.ajoInstallment.findMany({ where: { membershipId }, orderBy: { dueDate: 'asc' } });
  const audits = (w: World, action: string) => prisma.auditLog.findMany({ where: { associationId: w.A, action } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    rules = require('../../src/modules/ajo/ajo-rules.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    fees = require('../../src/modules/ajo/ajo-latefee.service');
    disputes = require('../../src/modules/ajo/ajo-dispute.service');
    reminders = require('../../src/modules/ajo/ajo-reminder.service');
    cycle = require('../../src/modules/ajo/ajo-risk-cycle');
    ledger = require('../../src/modules/ajo/ajo-ledger.service');
  });

  beforeEach(() => {
    notices.length = 0;
    inApp.length = 0;
    sms.length = 0;
    smsMode.noCredits = false;
    moduleOn.clear();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('overdue (T6.1)', () => {
    it('marks an unpaid instalment overdue after its due date, leaves a part-paid one alone, and is safe to repeat', async () => {
      const w = await world();
      const { joined, groupsToRun, g } = await thrift(w);
      await pay(w, g.id, joined[1].membership.id, 200_000n, at('2027-03-02T10:00:00Z')); // part-paid
      expect(await fees.markOverdue(at('2027-03-01T10:00:00Z'), groupsToRun)).toBe(0); // due today is not overdue
      expect(await fees.markOverdue(at('2027-03-02T10:00:00Z'), groupsToRun)).toBe(1); // only the one with nothing paid
      expect((await installments(joined[0].membership.id))[0].status).toBe('OVERDUE');
      expect((await installments(joined[1].membership.id))[0].status).toBe('PARTIAL');
      expect(await fees.markOverdue(at('2027-03-03T10:00:00Z'), groupsToRun)).toBe(0);
      expect((await installments(joined[0].membership.id))[1].status).toBe('DUE'); // the next one is not yet due
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('assessing a late fee (T6.2)', () => {
    it('assesses nothing in grace, then one fee for each overdue instalment the day after grace, once, with its calculation', async () => {
      const w = await world();
      const { joined, groupsToRun } = await thrift(w, { rules: FEE });
      expect((await fees.assessLateFees(at('2027-03-04T10:00:00Z'), groupsToRun)).assessed).toBe(0); // the last day of grace
      expect((await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun)).assessed).toBe(2);
      expect((await fees.assessLateFees(at('2027-03-05T12:00:00Z'), groupsToRun)).assessed).toBe(0); // repeating changes nothing

      const rows = await feesOf(w);
      const v1 = await prisma.ajoGroupRuleVersion.findFirstOrThrow({ where: { group: { associationId: w.A }, version: 1 } });
      expect(rows).toHaveLength(2);
      for (const r of rows) {
        expect(r).toMatchObject({ status: 'PENDING', feeKobo: 50_000n, basisKobo: 500_000n, capApplied: false, ruleVersionId: v1.id, notifiedAt: null, payableAt: null, paidKobo: 0n });
        expect((r.calculation as { text: string }).text).toContain('fixed late fee of ₦500.00');
        expect(r.calculation).toMatchObject({ type: 'FIXED', value: '50000', basisKobo: '500000', rawKobo: '50000', capKobo: null });
      }
      expect(rows.map((r) => r.membershipId).sort()).toEqual(joined.map((j) => j.membership.id).sort());

      // The second instalment (due on 8 March) has its own grace.
      expect((await fees.assessLateFees(at('2027-03-11T10:00:00Z'), groupsToRun)).assessed).toBe(0);
      expect((await fees.assessLateFees(at('2027-03-12T10:00:00Z'), groupsToRun)).assessed).toBe(2);
      expect(await feesOf(w)).toHaveLength(4);
    });

    it('assesses nothing when the group’s rules have no late fee, however late', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w);
      expect((await fees.assessLateFees(at('2027-06-01T10:00:00Z'), groupsToRun)).assessed).toBe(0);
      expect(await feesOf(w)).toEqual([]);
    });

    it('works the fee out from the version the member accepted, never a newer one they did not', async () => {
      const w = await world();
      const { g, joined, groupsToRun } = await thrift(w, { rules: FEE });
      // A newer version doubles the fee. It takes effect before the due date, but only one member accepts it.
      await rules.publishRuleVersion({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, rules: { lateFeeValue: 100_000n }, now: NOW });
      await consent.acceptRules({ associationId: w.A, membershipId: joined[1].membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: at('2027-02-10T10:00:00Z') });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      const byMember = new Map((await feesOf(w)).map((f) => [f.membershipId, f.feeKobo]));
      expect(byMember.get(joined[0].membership.id)).toBe(50_000n); // accepted version 1 only
      expect(byMember.get(joined[1].membership.id)).toBe(100_000n); // accepted version 2
    });

    it('charges nobody who had not accepted the rules by the due date', async () => {
      const w = await world();
      const { joined, groupsToRun } = await thrift(w, { rules: FEE });
      await prisma.ajoRuleAcceptance.updateMany({ where: { membershipId: joined[0].membership.id }, data: { acceptedAt: at('2027-03-02T10:00:00Z') } });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      const rows = await feesOf(w);
      expect(rows.map((r) => r.membershipId)).toEqual([joined[1].membership.id]);
    });

    it('works a percentage out of the instalment and holds it to the cap', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1, rules: { lateFeeType: 'PERCENT', lateFeeValue: 1_000n, lateFeeCapKobo: 30_000n, graceDays: 3 } });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      const [f] = await feesOf(w);
      expect(f).toMatchObject({ feeKobo: 30_000n, capApplied: true });
      expect((f.calculation as { text: string }).text).toContain('10% of the ₦5,000.00 contribution');
      expect((f.calculation as { text: string }).text).toContain('held to the group’s limit of ₦300.00');
    });

    it('does not charge for an instalment that is paid, but does for one that is only part paid', async () => {
      const w = await world();
      const { g, joined, groupsToRun } = await thrift(w, { rules: FEE });
      await pay(w, g.id, joined[0].membership.id, AMOUNT, at('2027-03-03T10:00:00Z'));
      await pay(w, g.id, joined[1].membership.id, 300_000n, at('2027-03-03T10:00:00Z'));
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      expect((await feesOf(w)).map((f) => f.membershipId)).toEqual([joined[1].membership.id]);
    });

    it('does nothing to a member while a payment of theirs is being verified, and gives them a clear day when it is turned down', async () => {
      const w = await world();
      const { g, joined, groupsToRun } = await thrift(w, { rules: FEE });
      const claim = await contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: joined[0].membership.id, amountKobo: AMOUNT, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now: at('2027-03-03T10:00:00Z') });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      expect((await feesOf(w)).map((f) => f.membershipId)).toEqual([joined[1].membership.id]); // the one being verified is left alone

      await contrib.rejectContribution({ associationId: w.A, contributionId: claim.contribution.id, actorUserId: w.recon.id, reason: 'The bank statement does not show it', now: at('2027-03-06T10:00:00Z') });
      expect((await fees.assessLateFees(at('2027-03-06T11:00:00Z'), groupsToRun)).assessed).toBe(0); // the day it was turned down
      expect((await fees.assessLateFees(at('2027-03-07T10:00:00Z'), groupsToRun)).assessed).toBe(1); // a clear day later
      expect(await feesOf(w)).toHaveLength(2);
    });

    it('does nothing while a dispute is open, and a clear day after it is not upheld', async () => {
      const w = await world();
      const { joined, groupsToRun } = await thrift(w, { rules: FEE });
      const first = (await installments(joined[0].membership.id))[0];
      const d = await disputes.raiseDispute({ associationId: w.A, membershipId: joined[0].membership.id, installmentId: first.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: joined[0].member.userId as number, actorCanManage: false });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      expect((await feesOf(w)).map((f) => f.membershipId)).toEqual([joined[1].membership.id]);

      await disputes.resolveDispute({ associationId: w.A, disputeId: d.id, outcome: 'NOT_UPHELD', reason: 'The collector has no record of this cash', actorUserId: w.officer.id, now: at('2027-03-10T10:00:00Z') });
      expect((await fees.assessLateFees(at('2027-03-10T12:00:00Z'), groupsToRun)).assessed).toBe(0); // the day it was decided
      expect((await feesOf(w)).filter((f) => f.membershipId === joined[0].membership.id)).toHaveLength(0);
      expect((await fees.assessLateFees(at('2027-03-11T10:00:00Z'), groupsToRun)).assessed).toBe(1);
      expect((await feesOf(w)).filter((f) => f.membershipId === joined[0].membership.id)).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('telling the member, and the notice window (T6.2)', () => {
    it('tells the member, and makes the fee payable only 48 hours later', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1, rules: FEE });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      const told = await fees.noticeLateFees(at('2027-03-05T10:05:00Z'), groupsToRun);
      expect(told).toEqual({ told: 1, unreachable: 0 });
      expect(inApp.some((n) => n.pushType === 'ajo.late_fee' && n.message.includes('₦500.00') && n.message.includes('48 hours'))).toBe(true);

      const [pending] = await feesOf(w);
      expect(pending).toMatchObject({ status: 'PENDING' });
      expect(pending.notifiedAt).not.toBeNull();
      expect(await fees.promotePayableFees(at('2027-03-07T10:04:00Z'), [w.A])).toBe(0); // 47 hours 59 minutes
      expect(await fees.promotePayableFees(at('2027-03-07T10:05:00Z'), [w.A])).toBe(1);
      expect(await fees.promotePayableFees(at('2027-03-08T10:05:00Z'), [w.A])).toBe(0);
      const [payable] = await feesOf(w);
      expect(payable).toMatchObject({ status: 'PAYABLE' });
      expect(payable.payableAt).not.toBeNull();
      // Telling them twice does not message them twice.
      const again = await fees.noticeLateFees(at('2027-03-06T10:00:00Z'), groupsToRun);
      expect(again.told).toBe(0);
    });

    it('keeps a fee pending while a dispute is open on its instalment', async () => {
      const w = await world();
      const { joined, groupsToRun } = await thrift(w, { people: 1, rules: FEE });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      await fees.noticeLateFees(at('2027-03-05T10:05:00Z'), groupsToRun);
      const first = (await installments(joined[0].membership.id))[0];
      const d = await disputes.raiseDispute({ associationId: w.A, membershipId: joined[0].membership.id, installmentId: first.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: joined[0].member.userId as number, actorCanManage: false });
      expect(await fees.promotePayableFees(at('2027-03-08T10:00:00Z'), [w.A])).toBe(0);
      await disputes.resolveDispute({ associationId: w.A, disputeId: d.id, outcome: 'NOT_UPHELD', reason: 'No record of this payment anywhere', actorUserId: w.officer.id, now: at('2027-03-09T10:00:00Z') });
      expect(await fees.promotePayableFees(at('2027-03-09T10:00:00Z'), [w.A])).toBe(1);
    });

    it('never makes a fee payable for someone it could not tell, until an officer records that they were told', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1, login: false, rules: FEE });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      smsMode.noCredits = true;
      expect(await fees.noticeLateFees(at('2027-03-05T10:05:00Z'), groupsToRun)).toEqual({ told: 0, unreachable: 1 });
      expect((await feesOf(w))[0].notifiedAt).toBeNull();
      expect(await fees.promotePayableFees(at('2027-03-20T10:00:00Z'), [w.A])).toBe(0); // weeks later: still never told, so never owed

      // Credits come back: the next round tells them.
      smsMode.noCredits = false;
      expect(await fees.noticeLateFees(at('2027-03-06T10:00:00Z'), groupsToRun)).toEqual({ told: 1, unreachable: 0 });
      expect(sms[0].text).toContain('late fee');
      expect(sms[0].text).toContain('₦500.00');
    });

    it('lets an officer record that they told a member in person, with a note', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1, login: false, rules: FEE });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      const [f] = await feesOf(w);
      expect(await codeOf(fees.markFeeNotified({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, note: 'no' }))).toBe('NOTE_REQUIRED');
      const done = await fees.markFeeNotified({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, note: 'Told her in person at the market', now: at('2027-03-05T11:00:00Z') });
      expect(done.replayed).toBe(false);
      expect((await fees.markFeeNotified({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, note: 'Told her in person at the market' })).replayed).toBe(true);
      expect(await fees.promotePayableFees(at('2027-03-07T11:00:00Z'), [w.A])).toBe(1);
      expect((await audits(w, 'AJO_LATE_FEE_TOLD')).length).toBe(1);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('paying a late fee (T6.2)', () => {
    /** One member, two instalments (₦5,000.00 each), both missed, both fees payable: ₦10,000.00 + ₦1,000.00 owed. */
    async function owing() {
      const w = await world();
      const t = await thrift(w, { people: 1, rules: FEE, cycleLength: 2 });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), t.groupsToRun);
      await fees.assessLateFees(at('2027-03-12T10:00:00Z'), t.groupsToRun);
      await fees.noticeLateFees(at('2027-03-12T10:05:00Z'), t.groupsToRun);
      await fees.promotePayableFees(at('2027-03-14T11:00:00Z'), [w.A]);
      const rows = await feesOf(w);
      expect(rows.map((r) => r.status)).toEqual(['PAYABLE', 'PAYABLE']);
      return { w, ...t, mid: t.joined[0].membership.id };
    }
    const T = at('2027-03-15T10:00:00Z');

    it('clears the instalments first and then the fees, with the fee part recorded apart as the group’s own income', async () => {
      const { w, g, mid } = await owing();
      const id = await pay(w, g.id, mid, 1_100_000n, T);
      const insts = await installments(mid);
      expect(insts.map((i) => [i.paidKobo, i.status])).toEqual([[AMOUNT, 'PAID'], [AMOUNT, 'PAID']]);
      const rows = await feesOf(w);
      expect(rows.map((r) => [r.paidKobo, r.status])).toEqual([[50_000n, 'PAID'], [50_000n, 'PAID']]);

      const entries = await prisma.ajoLedgerEntry.findMany({ where: { associationId: w.A, membershipId: mid }, orderBy: { id: 'asc' } });
      expect(entries.map((e) => [e.type, e.direction, e.amountKobo, e.refType])).toEqual([['CONTRIBUTION', 'CREDIT', 1_000_000n, 'contribution'], ['FEE', 'CREDIT', 100_000n, 'late_fee']]);
      const view = (await contrib.listMembershipContributions({ associationId: w.A, membershipId: mid, officer: true })).find((c) => c.id === id)!;
      expect(view.installmentsCovered).toHaveLength(2);
      expect(view.lateFeesCovered).toHaveLength(2);
    });

    it('always puts the savings first: a payment that only covers an instalment leaves the fees owing', async () => {
      const { w, g, mid } = await owing();
      await pay(w, g.id, mid, AMOUNT, T);
      expect((await feesOf(w)).map((r) => r.paidKobo)).toEqual([0n, 0n]);
      // The next payment finishes the other instalment and then pays the fees, oldest first, part of one if that is all there is.
      await pay(w, g.id, mid, 520_000n, T);
      const rows = await feesOf(w);
      expect(rows[0]).toMatchObject({ paidKobo: 20_000n, status: 'PAYABLE' });
      expect(rows[1].paidKobo).toBe(0n);
      await pay(w, g.id, mid, 80_000n, T);
      expect((await feesOf(w)).map((r) => [r.paidKobo, r.status])).toEqual([[50_000n, 'PAID'], [50_000n, 'PAID']]);
    });

    it('limits a payment to what is owed, counting payable fees but not pending ones', async () => {
      const { w, g, mid } = await owing();
      expect(await codeOf(contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: mid, amountKobo: 1_100_001n, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('x'), mimeType: 'image/png' }, now: T }))).toBe('EXCEEDS_OWED');
      await expect(contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: mid, amountKobo: 1_100_000n, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('y'), mimeType: 'image/png' }, now: T })).resolves.toBeTruthy();

      // A fee that is still pending is shown but is not owed.
      await prisma.ajoLateFeeAssessment.updateMany({ where: { associationId: w.A }, data: { status: 'PENDING' } });
      expect(await codeOf(contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: mid, amountKobo: 1_000_001n, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('z'), mimeType: 'image/png' }, now: T }))).toBe('EXCEEDS_OWED');
    });

    it('undoes both parts when the payment is reversed, and the fees are owed again', async () => {
      const { w, g, mid } = await owing();
      const id = await pay(w, g.id, mid, 1_100_000n, T);
      await contrib.reverseContribution({ associationId: w.A, contributionId: id, actorUserId: w.recon.id, reason: 'Recorded against the wrong person', now: T });
      expect((await installments(mid)).map((i) => i.paidKobo)).toEqual([0n, 0n]);
      expect((await feesOf(w)).map((r) => [r.paidKobo, r.status])).toEqual([[0n, 'PAYABLE'], [0n, 'PAYABLE']]);
      const entries = await prisma.ajoLedgerEntry.findMany({ where: { associationId: w.A, membershipId: mid }, orderBy: { id: 'asc' } });
      expect(entries.map((e) => e.type)).toEqual(['CONTRIBUTION', 'FEE', 'REVERSAL', 'REVERSAL']);
      expect(await ledger.balanceKobo(prisma as never, { associationId: w.A, membershipId: mid })).toBe(0n);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('waiving (T6.2)', () => {
    it('waives a fee with a reason, never counts it, and undoes a waiver only by a recorded reversal', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1, rules: FEE, cycleLength: 2 });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      await fees.noticeLateFees(at('2027-03-05T10:05:00Z'), groupsToRun);
      const [f] = await feesOf(w);
      expect(await codeOf(fees.waiveLateFee({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'short' }))).toBe('REASON_REQUIRED');
      const done = await fees.waiveLateFee({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'Goodwill: the collector was away that week', now: at('2027-03-06T10:00:00Z') });
      expect(done.fee).toMatchObject({ status: 'WAIVED', owedKobo: '0' });
      expect((await fees.waiveLateFee({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'Goodwill: the collector was away that week' })).replayed).toBe(true);
      expect(await fees.promotePayableFees(at('2027-03-10T10:00:00Z'), [w.A])).toBe(0); // a waived fee never becomes payable

      const back = await fees.reverseWaiver({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'Waived by mistake: wrong member', now: at('2027-03-10T10:00:00Z') });
      expect(back.fee.status).toBe('PAYABLE'); // they had been told more than 48 hours earlier
      expect((await audits(w, 'AJO_LATE_FEE_WAIVED')).length).toBe(1);
      expect((await audits(w, 'AJO_LATE_FEE_WAIVER_REVERSED')).length).toBe(1);
      expect(await codeOf(fees.reverseWaiver({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'Trying to reverse a waiver twice' }))).toBe('INVALID_FEE_STATE');
    });

    it('does not waive a fee that has been paid, and treats another association’s fee as missing', async () => {
      const w = await world();
      const other = await world();
      const { g, joined, groupsToRun } = await thrift(w, { people: 1, rules: FEE, cycleLength: 2 });
      await fees.assessLateFees(at('2027-03-05T10:00:00Z'), groupsToRun);
      await fees.noticeLateFees(at('2027-03-05T10:05:00Z'), groupsToRun);
      await fees.promotePayableFees(at('2027-03-07T11:00:00Z'), [w.A]);
      await pay(w, g.id, joined[0].membership.id, 1_050_000n, at('2027-03-08T10:00:00Z')); // both instalments are due by now, then the fee
      const [f] = await feesOf(w);
      expect(f.status).toBe('PAID');
      expect(await codeOf(fees.waiveLateFee({ associationId: w.A, feeId: f.id, actorUserId: w.officer.id, reason: 'Trying to waive a paid fee' }))).toBe('INVALID_FEE_STATE');
      expect(await codeOf(fees.waiveLateFee({ associationId: other.A, feeId: f.id, actorUserId: other.officer.id, reason: 'Trying across associations' }))).toBe('LATE_FEE_NOT_FOUND');
      expect(await codeOf(fees.markFeeNotified({ associationId: other.A, feeId: f.id, actorUserId: other.officer.id, note: 'Trying across associations' }))).toBe('LATE_FEE_NOT_FOUND');
      expect((await fees.listLateFees({ associationId: other.A })).length).toBe(0);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('disputes (T6.5)', () => {
    it('lets a member say "I paid" about one instalment, pauses the process for them, and tells the officers', async () => {
      const w = await world();
      await setHolders(w, 'ajo.manage', [w.officer.id]);
      const { joined } = await thrift(w, { people: 2 });
      const mine = joined[0];
      const inst = (await installments(mine.membership.id))[0];
      const base = { associationId: w.A, membershipId: mine.membership.id, installmentId: inst.id, actorUserId: mine.member.userId as number, actorCanManage: false };

      expect(await codeOf(disputes.raiseDispute({ ...base, claim: 'short' }))).toBe('CLAIM_REQUIRED');
      expect(await codeOf(disputes.raiseDispute({ ...base, claim: 'I paid the collector in cash on Monday morning', evidence: { buffer: Buffer.from('x'), mimeType: 'text/plain' } }))).toBe('INVALID_PROOF');
      const d = await disputes.raiseDispute({ ...base, claim: 'I paid the collector in cash on Monday morning', evidence: { buffer: Buffer.from('slip'), mimeType: 'image/png' } });
      expect(d).toMatchObject({ status: 'OPEN', outcome: 'OPEN', hasEvidence: true, installmentId: inst.id });
      expect(JSON.stringify(d)).not.toContain('dispute-evidence');
      expect(notices.some((n) => n.permission === 'ajo.manage' && n.pushType === 'ajo.dispute_raised')).toBe(true);
      expect(await codeOf(disputes.raiseDispute({ ...base, claim: 'I paid the collector in cash on Monday morning' }))).toBe('DISPUTE_ALREADY_OPEN');
      expect((await disputes.verificationState(prisma, mine.membership.id)).pending).toBe(true);
      expect((await disputes.verificationState(prisma, joined[1].membership.id)).pending).toBe(false);
      expect((await audits(w, 'AJO_DISPUTE_RAISED')).length).toBe(1);
    });

    it('only lets a person act for themselves, an officer for anyone, and not on an instalment that is already paid', async () => {
      const w = await world();
      const { g, joined } = await thrift(w, { people: 2 });
      const [a, b] = joined;
      const bInst = (await installments(b.membership.id))[0];
      const claim = 'I paid the collector in cash on Monday morning';
      expect(await codeOf(disputes.raiseDispute({ associationId: w.A, membershipId: b.membership.id, installmentId: bInst.id, claim, actorUserId: a.member.userId as number, actorCanManage: false }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(disputes.raiseDispute({ associationId: w.A, membershipId: a.membership.id, installmentId: bInst.id, claim, actorUserId: a.member.userId as number, actorCanManage: false }))).toBe('INSTALMENT_NOT_FOUND');
      await expect(disputes.raiseDispute({ associationId: w.A, membershipId: b.membership.id, installmentId: bInst.id, claim, actorUserId: w.officer.id, actorCanManage: true })).resolves.toMatchObject({ status: 'OPEN' });

      await pay(w, g.id, a.membership.id, AMOUNT, at('2027-03-03T10:00:00Z'));
      const aInst = (await installments(a.membership.id))[0];
      expect(await codeOf(disputes.raiseDispute({ associationId: w.A, membershipId: a.membership.id, installmentId: aInst.id, claim, actorUserId: a.member.userId as number, actorCanManage: false }))).toBe('ALREADY_PAID');
    });

    it('is decided by a different person with a written reason, tells the member, and is never changed', async () => {
      const w = await world();
      const { joined } = await thrift(w, { people: 1 });
      const m = joined[0];
      const inst = (await installments(m.membership.id))[0];
      const raised = await disputes.raiseDispute({ associationId: w.A, membershipId: m.membership.id, installmentId: inst.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: w.officer.id, actorCanManage: true });

      expect(await codeOf(disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'UPHELD', reason: 'I checked and it is right', actorUserId: w.officer.id }))).toBe('SELF_RESOLUTION_NOT_ALLOWED');
      expect(await codeOf(disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'UPHELD', reason: 'short', actorUserId: w.recon.id }))).toBe('REASON_REQUIRED');
      const done = await disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'UPHELD', reason: 'The collector confirms he took the cash', actorUserId: w.recon.id, now: at('2027-03-04T10:00:00Z') });
      expect(done).toMatchObject({ status: 'RESOLVED', outcome: 'UPHELD', resolution: 'The collector confirms he took the cash' });
      expect(inApp.some((n) => n.userId === m.member.userId && n.pushType === 'ajo.dispute_decided' && n.message.includes('accepted'))).toBe(true);

      expect((await disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'UPHELD', reason: 'The collector confirms he took the cash', actorUserId: w.recon.id })).status).toBe('RESOLVED'); // the same decision again
      expect(await codeOf(disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'NOT_UPHELD', reason: 'Changing my mind afterwards', actorUserId: w.recon.id }))).toBe('ALREADY_DECIDED');
      expect((await audits(w, 'AJO_DISPUTE_RESOLVED')).length).toBe(1);
    });

    it('never creates money: an upheld claim leaves the instalment unpaid until the payment is recorded the normal way', async () => {
      const w = await world();
      const { g, joined } = await thrift(w, { people: 1 });
      const m = joined[0];
      const inst = (await installments(m.membership.id))[0];
      const raised = await disputes.raiseDispute({ associationId: w.A, membershipId: m.membership.id, installmentId: inst.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: w.officer.id, actorCanManage: true });
      await disputes.resolveDispute({ associationId: w.A, disputeId: raised.id, outcome: 'UPHELD', reason: 'The collector confirms he took the cash', actorUserId: w.recon.id });
      expect((await installments(m.membership.id))[0].paidKobo).toBe(0n);
      expect(await prisma.ajoContribution.count({ where: { membershipId: m.membership.id } })).toBe(0);
      expect(await prisma.ajoLedgerEntry.count({ where: { groupId: g.id } })).toBe(0);
    });

    it('keeps evidence private and treats other associations’ disputes as missing', async () => {
      const w = await world();
      const other = await world();
      const { joined } = await thrift(w, { people: 2 });
      const [a, b] = joined;
      const inst = (await installments(a.membership.id))[0];
      const d = await disputes.raiseDispute({ associationId: w.A, membershipId: a.membership.id, installmentId: inst.id, claim: 'I paid the collector in cash on Monday morning', evidence: { buffer: Buffer.from('slip'), mimeType: 'image/png' }, actorUserId: a.member.userId as number, actorCanManage: false });
      const base = { associationId: w.A, disputeId: d.id };
      expect((await disputes.getEvidenceLink({ ...base, viewerUserId: a.member.userId as number, viewerIsOfficer: false })).url).toMatch(/dispute-evidence/);
      expect((await disputes.getEvidenceLink({ ...base, viewerUserId: w.officer.id, viewerIsOfficer: true })).url).toBeTruthy();
      expect(await codeOf(disputes.getEvidenceLink({ ...base, viewerUserId: b.member.userId as number, viewerIsOfficer: false }))).toBe('DISPUTE_NOT_FOUND');
      expect(await codeOf(disputes.getEvidenceLink({ associationId: other.A, disputeId: d.id, viewerUserId: other.officer.id, viewerIsOfficer: true }))).toBe('DISPUTE_NOT_FOUND');
      expect(await codeOf(disputes.resolveDispute({ associationId: other.A, disputeId: d.id, outcome: 'UPHELD', reason: 'Trying across associations', actorUserId: other.officer.id }))).toBe('DISPUTE_NOT_FOUND');
      expect(await disputes.listDisputes({ associationId: other.A })).toEqual([]);
      expect(await codeOf(disputes.raiseDispute({ associationId: other.A, membershipId: a.membership.id, installmentId: inst.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: other.officer.id, actorCanManage: true }))).toBe('MEMBERSHIP_NOT_FOUND');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('reminders (T6.1)', () => {
    const morning = (day: string) => at(`${day}T08:00:00Z`); // 09:00 in Lagos

    it('reminds the day before, the day after and on the last day of grace, once each, in plain words with money in full', async () => {
      const w = await world();
      const { joined, groupsToRun } = await thrift(w, { people: 1, rules: FEE });
      const userId = joined[0].member.userId as number;
      const messages = () => inApp.filter((n) => n.userId === userId && n.pushType === 'ajo.reminder');

      expect((await reminders.runReminders(at('2027-03-07T05:00:00Z'), groupsToRun)).reminded).toBe(0); // 06:00 in Lagos: too early
      expect((await reminders.runReminders(morning('2027-03-07'), groupsToRun)).reminded).toBe(1);
      expect(messages()[0].message).toContain('₦5,000.00 is due tomorrow (2027-03-08)');
      expect((await reminders.runReminders(at('2027-03-07T09:30:00Z'), groupsToRun)).reminded).toBe(0); // the job ran twice: still one message
      expect(messages()).toHaveLength(1);

      await reminders.runReminders(morning('2027-03-09'), groupsToRun);
      expect(messages()[1].message).toMatch(/still unpaid/);
      expect(messages()[1].title).toBe('A payment is overdue');

      await reminders.runReminders(morning('2027-03-11'), groupsToRun);
      expect(messages()[2].message).toContain('a late fee applies from tomorrow');
      await reminders.runReminders(morning('2027-03-11'), groupsToRun);
      expect(messages()).toHaveLength(3);
      const rows = await prisma.ajoReminder.findMany({ where: { associationId: w.A, kind: { not: 'DIGEST' } } });
      expect(new Set(rows.map((r) => r.dedupeKey)).size).toBe(rows.length); // every reminded item exists once
    });

    it('leaves out the last-day-of-grace reminder when the rules have no late fee, and sends nothing when reminders are off', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 1 });
      await reminders.runReminders(morning('2027-03-11'), groupsToRun);
      expect(inApp.some((n) => n.message.includes('late fee applies'))).toBe(false);
      const off = await thrift(w, { people: 1, rules: { remindersEnabled: false } });
      inApp.length = 0;
      expect((await reminders.runReminders(morning('2027-03-09'), off.groupsToRun)).reminded).toBe(0);
      expect(inApp).toEqual([]);
    });

    it('texts a contributor with no login, and skips (not queues) the text when credits run out, telling the officers once', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 2, login: false });
      await reminders.runReminders(morning('2027-03-07'), groupsToRun);
      expect(sms).toHaveLength(2);
      expect(sms[0].text).toContain('₦5,000.00 is due tomorrow');

      smsMode.noCredits = true;
      sms.length = 0;
      const out = await reminders.runReminders(morning('2027-03-09'), groupsToRun);
      expect(out).toMatchObject({ reminded: 0, skippedNoCredits: 2 });
      expect(notices.filter((n) => n.pushType === 'ajo.reminders_skipped')).toHaveLength(1); // one alert, not one per person
      await reminders.runReminders(morning('2027-03-09'), groupsToRun);
      expect(notices.filter((n) => n.pushType === 'ajo.reminders_skipped')).toHaveLength(1);
      const skipped = await prisma.ajoReminder.findMany({ where: { associationId: w.A, state: 'SKIPPED' } });
      expect(skipped.length).toBeGreaterThan(0);
      expect(skipped.every((r) => (r.channels as { reason?: string } | null)?.reason === 'NO_SMS_CREDITS')).toBe(true);

      // A reminder that was skipped is not sent late, even when credits come back.
      smsMode.noCredits = false;
      await reminders.runReminders(morning('2027-03-10'), groupsToRun);
      expect(sms.some((s) => s.text.includes('due on 2027-03-08'))).toBe(false);
    });

    it('does not chase a member for being late while a payment of theirs is being verified, but still warns what is coming', async () => {
      const w = await world();
      const { g, joined, groupsToRun } = await thrift(w, { people: 1 });
      await contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: joined[0].membership.id, amountKobo: AMOUNT, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('slip'), mimeType: 'image/png' }, now: at('2027-03-03T10:00:00Z') });
      await reminders.runReminders(morning('2027-03-09'), groupsToRun);
      expect(inApp.filter((n) => n.pushType === 'ajo.reminder')).toHaveLength(0); // overdue, but being verified
      await reminders.runReminders(morning('2027-03-14'), groupsToRun); // the day before the 15 March instalment
      expect(inApp.filter((n) => n.pushType === 'ajo.reminder').map((n) => n.message).join(' ')).toContain('due tomorrow (2027-03-15)');
    });

    it('keeps a daily group to one overdue message a week and no "upcoming" reminders', async () => {
      const w = await world();
      const { groupsToRun, joined } = await thrift(w, { people: 1, frequency: 'DAILY', cycleLength: 14, contribution: 100_000 });
      const userId = joined[0].member.userId as number;
      const count = () => inApp.filter((n) => n.userId === userId && n.pushType === 'ajo.reminder').length;
      await reminders.runReminders(morning('2027-02-28'), groupsToRun); // the day before it starts
      expect(count()).toBe(0);
      await reminders.runReminders(morning('2027-03-04'), groupsToRun);
      expect(count()).toBe(1);
      await reminders.runReminders(morning('2027-03-05'), groupsToRun); // the same week
      expect(count()).toBe(1);
      await reminders.runReminders(morning('2027-03-09'), groupsToRun); // the next week
      expect(count()).toBe(2);
    });

    it('sends the officers one digest a day, and none when nobody is overdue', async () => {
      const w = await world();
      const { groupsToRun } = await thrift(w, { people: 3 });
      await reminders.runReminders(morning('2027-03-01'), groupsToRun);
      expect(notices.filter((n) => n.pushType === 'ajo.overdue_digest')).toHaveLength(0);
      const first = await reminders.runReminders(morning('2027-03-03'), groupsToRun);
      const again = await reminders.runReminders(at('2027-03-03T12:00:00Z'), groupsToRun);
      expect(first.digests).toBe(1);
      expect(again.digests).toBe(0);
      const digests = notices.filter((n) => n.pushType === 'ajo.overdue_digest');
      expect(digests).toHaveLength(1);
      expect(digests[0]).toMatchObject({ to: 'holders', permission: 'ajo.manage' });
      expect(digests[0].message).toContain('3 people are overdue, ₦15,000.00 in all');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the job cycle (T6.1)', () => {
    it('does its work once: running the whole cycle twice assesses, tells and reminds only the first time', async () => {
      const w = await world();
      const { g, groupsToRun } = await thrift(w, { people: 2, rules: FEE });
      const when = at('2027-03-05T08:00:00Z');
      const first = await cycle.runAjoRiskCycle(when, { groupIds: [g.id] });
      expect(first).toMatchObject({ groups: 1, feesAssessed: 2, feesTold: 2, errors: [] });
      expect(first.overdueMarked).toBe(2);
      expect(first.reminded).toBeGreaterThan(0);
      expect(first.digests).toBe(1);
      const second = await cycle.runAjoRiskCycle(when, { groupIds: [g.id] });
      expect(second).toMatchObject({ groups: 1, overdueMarked: 0, feesAssessed: 0, feesTold: 0, reminded: 0, digests: 0, casesOpened: 0, errors: [] });
      expect(await feesOf(w)).toHaveLength(2);
      expect(groupsToRun).toHaveLength(1);
      // Two days later the fees become payable, on the next run.
      const later = await cycle.runAjoRiskCycle(at('2027-03-07T09:00:00Z'), { groupIds: [g.id] });
      expect(later.feesPayable).toBe(2);
    });

    it('does nothing for a tenant whose Ajo add-on is no longer fully active', async () => {
      const w = await world();
      const { g } = await thrift(w, { people: 1, rules: FEE });
      moduleOn.set(w.A, false);
      const summary = await cycle.runAjoRiskCycle(at('2027-03-05T08:00:00Z'), { groupIds: [g.id] });
      expect(summary.groups).toBe(0);
      expect(await feesOf(w)).toEqual([]);
      expect(inApp).toEqual([]);
      moduleOn.set(w.A, true);
      expect((await cycle.runAjoRiskCycle(at('2027-03-05T08:00:00Z'), { groupIds: [g.id] })).feesAssessed).toBe(1);
    });

    it('limits a run to the groups it is given', async () => {
      const w = await world();
      const a = await thrift(w, { people: 1, rules: FEE });
      const b = await thrift(w, { people: 1, rules: FEE });
      await cycle.runAjoRiskCycle(at('2027-03-05T08:00:00Z'), { groupIds: [a.g.id] });
      const rows = await feesOf(w);
      expect(rows).toHaveLength(1);
      expect(rows[0].membershipId).toBe(a.joined[0].membership.id);
      expect(b.g.id).not.toBe(a.g.id);
      expect(iso(at('2027-03-05T08:00:00Z'))).toBe('2027-03-05');
    });
  });
});
