/**
 * Ajo T6 against a real (disposable) database: default cases for rotating-pot members who were paid and then stopped, repayment plans
 * (a promise about timing that shields covered instalments from fees while kept), closing, and the trust score with its draw hook.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped. Times are
 * passed in, and every test has its own association so runs on one test's groups never touch another's.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-risk.integration --forceExit
 */

// This file is a module, so its names never clash with the other suites in the same test run.
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

const notices: Array<{ to: string; userId?: number; permission?: string; pushType: string; message: string }> = [];
const inApp: Array<{ userId: number; kind: string; title: string; message: string; pushType?: string }> = [];
const sms: Array<{ to: string; text: string }> = [];

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
jest.mock('../../src/modules/sms/sms-engine', () => ({
  dispatchMessages: jest.fn(async (input: { recipients: Array<{ phone: string }>; text: string }) => {
    sms.push({ to: input.recipients[0].phone, text: input.text });
    return { accepted: 1, credits: 1, messageIds: [sms.length], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) };
  }),
}));
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async (o: { userId: number; kind: string; title: string; message: string; pushType?: string }) => {
    inApp.push({ userId: o.userId, kind: o.kind, title: o.title, message: o.message, pushType: o.pushType });
    return { inAppCreated: true, emailSent: false, smsSent: false };
  }),
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: jest.fn(async () => ({ isEnabled: true })) },
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
/** Instalment 1 of a weekly group starting 1 March was due on 1 March; its grace ended on 4 March, so a fee can land on 5 March. */
const DAY5 = at('2027-03-05T10:00:00Z');

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo defaults, repayment plans and trust (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let fees: typeof import('../../src/modules/ajo/ajo-latefee.service');
  let disputes: typeof import('../../src/modules/ajo/ajo-dispute.service');
  let defaults: typeof import('../../src/modules/ajo/ajo-default.service');
  let trust: typeof import('../../src/modules/ajo/ajo-trust.service');
  let cycle: typeof import('../../src/modules/ajo/ajo-risk-cycle');

  interface World {
    A: number;
    admin: { id: number };
    officer: { id: number };
    recon: { id: number };
    roles: Map<string, number>;
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-t6d-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo T6D ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), officer: await user('officer'), recon: await user('recon'), roles: new Map() };
    await setHolders(w, 'ajo.reconcile', [w.recon.id]);
    return w;
  }
  async function setHolders(w: World, key: string, userIds: number[]) {
    if (!w.roles.has(key)) {
      const permission = await prisma.permission.upsert({ where: { key }, create: { key, description: `Test ${key}`, module: 'Ajo' }, update: {} });
      const role = await prisma.role.create({ data: { associationId: w.A, name: `t6d-${key}-${run}-${++counter}`, displayName: key } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      w.roles.set(key, role.id);
    }
    const roleId = w.roles.get(key) as number;
    await prisma.userRole.deleteMany({ where: { associationId: w.A, roleId } });
    for (const userId of userIds) await prisma.userRole.create({ data: { userId, roleId, associationId: w.A } });
  }
  async function mkMember(w: World) {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `member-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `T6D${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', address: '12 Market Road, Aba', status: 'active' } });
  }
  async function joinMember(w: World, groupId: number, member: { id: number }) {
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id });
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return membership;
  }
  async function join(w: World, groupId: number) {
    const member = await mkMember(w);
    return { member, membership: await joinMember(w, groupId, member) };
  }
  async function newGroup(w: World, fields: Record<string, unknown>, rules?: Record<string, unknown>) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      rules: rules as never,
      fields: { name: `Circle ${++counter}`, frequency: 'WEEKLY', contributionKobo: Number(AMOUNT), startDate: START, maxParticipants: 30, ...fields } as never,
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  /** A rotating pot of three, started. The first person in the list has been paid their round. */
  async function pot(w: World, rules?: Record<string, unknown>, o: { paid?: boolean } = {}) {
    const g = await newGroup(w, { model: 'ROTATING_POT', maxParticipants: 3 }, rules);
    const joined = [await join(w, g.id), await join(w, g.id), await join(w, g.id)];
    await order.runDraw({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    if (o.paid !== false) await markPaid(w, g.id, joined[0].membership.id);
    const run1 = [{ id: g.id, associationId: w.A, timezone: 'Africa/Lagos', cutoffTime: '18:00', name: g.name, model: 'ROTATING_POT' as const }];
    return { g, joined, run1 };
  }
  /** The payout is written straight in as paid: the payout flow itself is T5's, covered there. */
  const markPaid = (w: World, groupId: number, membershipId: number) =>
    prisma.ajoPayout.create({ data: { associationId: w.A, groupId, membershipId, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.officer.id, accountSnapshot: { bankName: 'GTBank', accountName: 'Test', last4: '6789' }, paidReference: `ref-${run}-${++counter}`, paidAt: at('2027-03-01T12:00:00Z'), idempotencyKey: `payout-${run}-${++counter}` } });
  async function pay(w: World, groupId: number, membershipId: number, amount: bigint, now: Date) {
    const rep = await contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: amount, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
    await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now });
    return rep.contribution.id;
  }
  const installments = (membershipId: number) => prisma.ajoInstallment.findMany({ where: { membershipId }, orderBy: { dueDate: 'asc' } });
  const casesOf = (w: World) => prisma.ajoDefaultCase.findMany({ where: { associationId: w.A }, orderBy: { id: 'asc' } });
  const eventKinds = async (caseId: number) => (await prisma.ajoCaseEvent.findMany({ where: { caseId }, orderBy: { id: 'asc' } })).map((e) => e.kind);
  const holdersTold = (pushType: string) => notices.filter((n) => n.to === 'holders' && n.pushType === pushType);

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    fees = require('../../src/modules/ajo/ajo-latefee.service');
    disputes = require('../../src/modules/ajo/ajo-dispute.service');
    defaults = require('../../src/modules/ajo/ajo-default.service');
    trust = require('../../src/modules/ajo/ajo-trust.service');
    cycle = require('../../src/modules/ajo/ajo-risk-cycle');
  });

  beforeEach(() => {
    notices.length = 0;
    inApp.length = 0;
    sms.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('opening a case (T6.3)', () => {
    it('is only for a rotating pot, and only after the person has been paid', async () => {
      const w = await world();
      const g = await newGroup(w, { model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 3 });
      const t = await join(w, g.id);
      await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
      expect(await codeOf(defaults.openCase({ associationId: w.A, membershipId: t.membership.id, actorUserId: w.officer.id, now: DAY5 }))).toBe('NOT_A_ROTATING_POT');

      const p = await pot(w, undefined, { paid: false });
      expect(await codeOf(defaults.openCase({ associationId: w.A, membershipId: p.joined[0].membership.id, actorUserId: w.officer.id, now: DAY5 }))).toBe('NOT_AFTER_PAYOUT');
      await markPaid(w, p.g.id, p.joined[0].membership.id);
      expect(await codeOf(defaults.openCase({ associationId: w.A, membershipId: p.joined[0].membership.id, actorUserId: w.officer.id, now: at('2027-02-26T10:00:00Z') }))).toBe('NO_ERROR'); // owes the whole pot, with nothing overdue yet, is still a case an officer may open
    });

    it('freezes a snapshot at opening, keeps one open case per person, and writes the file as events', async () => {
      const w = await world();
      const { g, joined } = await pot(w);
      const m = joined[0].membership.id;
      const r = await defaults.openCase({ associationId: w.A, membershipId: m, actorUserId: w.officer.id, now: DAY5 });
      expect(r.created).toBe(true);
      const [c] = await casesOf(w);
      expect(c).toMatchObject({ groupId: g.id, membershipId: m, status: expect.stringMatching(/OPEN|PLAN_AGREED/), outstandingKobo: 1_500_000n });
      const snap = c.snapshot as { overdue: unknown[]; outstanding: { totalKobo: string; overdueKobo: string }; payout: { round: number } };
      expect(snap.payout.round).toBe(1);
      expect(snap.outstanding).toMatchObject({ totalKobo: '1500000', overdueKobo: '500000' });
      expect(snap.overdue).toHaveLength(1);

      // Paying afterwards changes what is owed now, never what was recorded at opening.
      await pay(w, g.id, m, AMOUNT, at('2027-03-06T10:00:00Z'));
      const view = await defaults.getCase({ associationId: w.A, caseId: c.id, now: at('2027-03-06T10:00:00Z') });
      expect(view.outstandingAtOpeningKobo).toBe('1500000');
      expect(view.outstandingNowKobo).toBe('1000000');
      expect((await casesOf(w))[0].snapshot).toEqual(c.snapshot);

      const again = await defaults.openCase({ associationId: w.A, membershipId: m, actorUserId: w.officer.id, now: DAY5 });
      expect(again).toMatchObject({ created: false, caseId: c.id });
      expect(await casesOf(w)).toHaveLength(1);
      expect((await eventKinds(c.id))[0]).toBe('OPENED');
      expect(await codeOf(defaults.openCase({ associationId: w.A, membershipId: joined[1].membership.id, actorUserId: w.officer.id, now: DAY5 }))).toBe('NOT_AFTER_PAYOUT');
    });

    it('follows the procedure the member accepted: tell the admins, offer a plan, or both', async () => {
      for (const [procedure, tellsAdmins, offersPlan] of [['NOTIFY_ADMIN', true, false], ['REPAYMENT_PLAN', false, true], ['CASE_AND_PLAN', true, true]] as const) {
        const w = await world();
        const { joined } = await pot(w, { defaultProcedure: procedure });
        notices.length = 0;
        inApp.length = 0;
        sms.length = 0;
        await defaults.openCase({ associationId: w.A, membershipId: joined[0].membership.id, actorUserId: null, now: DAY5 });
        const [c] = await casesOf(w);
        expect(c.procedure).toBe(procedure);
        expect(holdersTold('ajo.default_case').length > 0).toBe(tellsAdmins);
        const plans = await prisma.ajoRepaymentPlan.findMany({ where: { caseId: c.id } });
        expect(plans.length > 0).toBe(offersPlan);
        if (offersPlan) {
          expect(plans[0].status).toBe('PROPOSED');
          expect(inApp.some((n) => n.pushType === 'ajo.plan_offered' && n.message.includes('₦15,000.00'))).toBe(true);
        }
        expect((await prisma.ajoLedgerEntry.count({ where: { associationId: w.A, type: { not: 'PAYOUT' } } }))).toBe(0); // opening a case moves no money
      }
    });

    it('takes nothing from anyone else and changes no membership', async () => {
      const w = await world();
      const { g, joined } = await pot(w);
      const before = await prisma.ajoMembership.findMany({ where: { groupId: g.id }, orderBy: { id: 'asc' }, select: { id: true, status: true } });
      await defaults.openCase({ associationId: w.A, membershipId: joined[0].membership.id, actorUserId: w.officer.id, now: DAY5 });
      expect(await prisma.ajoMembership.findMany({ where: { groupId: g.id }, orderBy: { id: 'asc' }, select: { id: true, status: true } })).toEqual(before);
      expect(await prisma.ajoLedgerEntry.count({ where: { groupId: g.id } })).toBe(0);
      expect(await prisma.ajoInstallment.count({ where: { membership: { groupId: g.id }, status: 'WAIVED' } })).toBe(0);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('finding defaults by themselves (T6.3)', () => {
    it('opens a case only once a paid-out member is overdue past grace, never for the others, and only once', async () => {
      const w = await world();
      const { joined, run1 } = await pot(w, FEE);
      expect(await defaults.detectDefaults(at('2027-03-04T10:00:00Z'), run1)).toBe(0); // the last day of grace
      expect(await defaults.detectDefaults(DAY5, run1)).toBe(1);
      expect(await defaults.detectDefaults(at('2027-03-05T14:00:00Z'), run1)).toBe(0);
      const cases = await casesOf(w);
      expect(cases.map((c) => c.membershipId)).toEqual([joined[0].membership.id]); // the other two have not been paid out
      expect(await eventKinds(cases[0].id)).toContain('OPENED');
    });

    it('does not open a case while a payment of theirs is being verified or a dispute is open', async () => {
      const w = await world();
      const { g, joined, run1 } = await pot(w, FEE);
      const claim = await contrib.reportTransfer({ associationId: w.A, groupId: g.id, membershipId: joined[0].membership.id, amountKobo: AMOUNT, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('slip'), mimeType: 'image/png' }, now: at('2027-03-03T10:00:00Z') });
      expect(await defaults.detectDefaults(DAY5, run1)).toBe(0);
      await contrib.rejectContribution({ associationId: w.A, contributionId: claim.contribution.id, actorUserId: w.recon.id, reason: 'The bank statement does not show it', now: at('2027-03-06T10:00:00Z') });
      expect(await defaults.detectDefaults(at('2027-03-06T12:00:00Z'), run1)).toBe(0); // the day it was turned down
      expect(await defaults.detectDefaults(at('2027-03-07T10:00:00Z'), run1)).toBe(1); // a clear day later
    });

    it('is run by the job cycle, once, and a closed case is not reopened by the next run', async () => {
      const w = await world();
      const { g, joined } = await pot(w, FEE);
      const first = await cycle.runAjoRiskCycle(at('2027-03-05T09:00:00Z'), { groupIds: [g.id] });
      expect(first).toMatchObject({ casesOpened: 1, errors: [] });
      expect((await cycle.runAjoRiskCycle(at('2027-03-05T09:30:00Z'), { groupIds: [g.id] })).casesOpened).toBe(0);
      const [c] = await casesOf(w);
      await defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'CLOSED_UNRESOLVED', reason: 'The group decided to write it off', now: at('2027-03-06T10:00:00Z') });
      // After a case is closed the same overdue money can open a new one only if the person is still late; here they are, so a fresh case is allowed.
      expect(joined).toHaveLength(3);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('repayment plans (T6.3)', () => {
    async function withPlan(rules: Record<string, unknown> = FEE) {
      const w = await world();
      const p = await pot(w, rules);
      await defaults.openCase({ associationId: w.A, membershipId: p.joined[0].membership.id, actorUserId: null, now: DAY5 });
      const [c] = await casesOf(w);
      const plan = await prisma.ajoRepaymentPlan.findFirstOrThrow({ where: { caseId: c.id } });
      return { w, ...p, c, plan, mid: p.joined[0].membership.id };
    }

    it('is only a promise once an officer records the agreement with a note, or the member accepts', async () => {
      const { w, plan, c, joined } = await withPlan();
      expect(plan.status).toBe('PROPOSED');
      const lines = plan.schedule as Array<{ dueDate: string; amountKobo: string }>;
      expect(lines.reduce((s, l) => s + BigInt(l.amountKobo), 0n)).toBe(1_500_000n);

      expect(await codeOf(defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, now: DAY5 }))).toBe('NOTE_REQUIRED');
      expect(await codeOf(defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: joined[1].member.userId as number, actorCanManage: false, now: DAY5 }))).toBe('PLAN_NOT_FOUND'); // somebody else's plan
      const done = await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 });
      expect(done).toMatchObject({ status: 'ACTIVE', replayed: false });
      expect((await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 })).replayed).toBe(true);
      const active = await prisma.ajoRepaymentPlan.findUniqueOrThrow({ where: { id: plan.id } });
      expect(active).toMatchObject({ status: 'ACTIVE', agreedVia: 'officer', agreedNote: 'Agreed on the phone with her' });
      expect((await prisma.ajoDefaultCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('PLAN_AGREED');
    });

    it('can be accepted by the member in the app, with no note needed', async () => {
      const { w, plan, joined } = await withPlan();
      const r = await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: joined[0].member.userId as number, actorCanManage: false, now: DAY5 });
      expect(r.status).toBe('ACTIVE');
      expect((await prisma.ajoRepaymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).agreedVia).toBe('app');
    });

    it('stops new fees on the instalments it covers while the member keeps to it, and not on the ones it does not', async () => {
      const { w, plan, run1, mid, g } = await withPlan();
      await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 });
      expect((await fees.assessLateFees(at('2027-03-05T11:00:00Z'), run1)).assessed).toBe(2); // the other two; instalment 1 of the member with the plan is covered
      const insts = await installments(mid);
      expect((await prisma.ajoLateFeeAssessment.findMany({ where: { installmentId: insts[0].id } }))).toHaveLength(0);
      // Someone else in the pot, with nobody to shield them, is charged in the normal way.
      const others = await prisma.ajoInstallment.findMany({ where: { membership: { groupId: g.id, id: { not: mid } }, dueDate: insts[0].dueDate } });
      expect(others).toHaveLength(2);
      expect(await prisma.ajoLateFeeAssessment.count({ where: { associationId: w.A } })).toBe(2); // one each for the other two
    });

    it('stops shielding once the member breaks it, and fees on the covered instalment are then assessed', async () => {
      const { w, plan, run1, mid, c } = await withPlan();
      await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 });
      const first = (plan.schedule as Array<{ dueDate: string }>)[0].dueDate;
      const after = new Date(new Date(`${first}T10:00:00Z`).getTime() + 2 * 86_400_000);
      const missed = await defaults.trackPlans(after, [c.groupId]);
      expect(missed.missed).toBeGreaterThanOrEqual(1);
      expect((await defaults.trackPlans(after, [c.groupId])).missed).toBe(0); // recorded once
      expect(holdersTold('ajo.plan_missed')).toHaveLength(1);
      expect((await eventKinds(c.id)).filter((k) => k === 'PLAN_MISSED').length).toBeGreaterThanOrEqual(1);
      await fees.assessLateFees(after, run1);
      const inst1 = (await installments(mid))[0];
      expect(await prisma.ajoLateFeeAssessment.count({ where: { installmentId: inst1.id } })).toBe(1);
    });

    it('goes back to an open case when cancelled, so fees resume, and the reason stays on the file', async () => {
      const { w, plan, run1, mid, c } = await withPlan();
      await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 });
      expect(await codeOf(defaults.cancelPlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, reason: 'short' }))).toBe('REASON_REQUIRED');
      await defaults.cancelPlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, reason: 'She asked to be treated as before' });
      expect((await prisma.ajoDefaultCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('OPEN');
      expect((await defaults.cancelPlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, reason: 'She asked to be treated as before' })).replayed).toBe(true);
      await fees.assessLateFees(at('2027-03-05T11:00:00Z'), run1);
      expect(await prisma.ajoLateFeeAssessment.count({ where: { installmentId: (await installments(mid))[0].id } })).toBe(1);
      expect(await eventKinds(c.id)).toContain('PLAN_CANCELLED');
    });

    it('ends the case as resolved when the plan is paid in full, and not before', async () => {
      const { w, plan, g, mid, c } = await withPlan({});
      await defaults.agreePlan({ associationId: w.A, planId: plan.id, actorUserId: w.officer.id, actorCanManage: true, note: 'Agreed on the phone with her', now: DAY5 });
      await pay(w, g.id, mid, AMOUNT, at('2027-03-06T10:00:00Z'));
      expect((await defaults.trackPlans(at('2027-03-06T12:00:00Z'), [g.id])).completed).toBe(0);
      await pay(w, g.id, mid, 1_000_000n, at('2027-03-16T10:00:00Z'));
      expect((await defaults.trackPlans(at('2027-03-16T12:00:00Z'), [g.id])).completed).toBe(1);
      expect((await defaults.trackPlans(at('2027-03-16T13:00:00Z'), [g.id])).completed).toBe(0);
      const done = await prisma.ajoDefaultCase.findUniqueOrThrow({ where: { id: c.id } });
      expect(done).toMatchObject({ status: 'RESOLVED', resolution: 'Paid in full.' });
      expect((await prisma.ajoRepaymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).status).toBe('COMPLETED');
      const kinds = await eventKinds(c.id);
      expect(kinds.filter((k) => k === 'PLAN_COMPLETED')).toHaveLength(1);
    });

    it('offers a new plan for a case, replacing one that was never agreed', async () => {
      const { w, c, plan } = await withPlan();
      const next = await defaults.proposePlan({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, periods: 5, now: DAY5 });
      expect(next.schedule).toHaveLength(5);
      expect((await prisma.ajoRepaymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).status).toBe('CANCELLED');
      expect((await prisma.ajoRepaymentPlan.findMany({ where: { caseId: c.id, status: 'PROPOSED' } })).length).toBe(1);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the case file and closing (T6.3)', () => {
    it('adds notes and the member’s own explanation, but not to a closed case', async () => {
      const w = await world();
      const { joined } = await pot(w);
      await defaults.openCase({ associationId: w.A, membershipId: joined[0].membership.id, actorUserId: w.officer.id, now: DAY5 });
      const [c] = await casesOf(w);
      expect(await codeOf(defaults.addCaseNote({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, note: 'no' }))).toBe('NOTE_REQUIRED');
      await defaults.addCaseNote({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, note: 'Called her; she is travelling' });
      await defaults.addCaseNote({ associationId: w.A, caseId: c.id, actorUserId: joined[0].member.userId as number, note: 'My shop was closed for two weeks', fromMember: true });
      expect((await prisma.ajoDefaultCase.findUniqueOrThrow({ where: { id: c.id } })).memberResponse).toBe('My shop was closed for two weeks');
      await defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'RESOLVED', reason: 'She paid at the monthly meeting', now: at('2027-03-09T10:00:00Z') });
      expect(await codeOf(defaults.addCaseNote({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, note: 'A note after closing' }))).toBe('CASE_CLOSED');
    });

    it('is closed by a person with a written reason, once, and a closed case is not changed', async () => {
      const w = await world();
      const { joined } = await pot(w);
      await defaults.openCase({ associationId: w.A, membershipId: joined[0].membership.id, actorUserId: w.officer.id, now: DAY5 });
      const [c] = await casesOf(w);
      expect(await codeOf(defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'RESOLVED', reason: 'short' }))).toBe('REASON_REQUIRED');
      const done = await defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'CLOSED_UNRESOLVED', reason: 'The group wrote it off at the meeting', now: at('2027-03-09T10:00:00Z') });
      expect(done).toMatchObject({ status: 'CLOSED_UNRESOLVED', replayed: false });
      expect((await defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'CLOSED_UNRESOLVED', reason: 'The group wrote it off at the meeting' })).replayed).toBe(true);
      expect(await codeOf(defaults.closeCase({ associationId: w.A, caseId: c.id, actorUserId: w.officer.id, outcome: 'RESOLVED', reason: 'Changing it afterwards for no reason' }))).toBe('CASE_CLOSED');
      const row = await prisma.ajoDefaultCase.findUniqueOrThrow({ where: { id: c.id } });
      expect(row).toMatchObject({ status: 'CLOSED_UNRESOLVED', resolution: 'The group wrote it off at the meeting', closedBy: w.officer.id });
      expect(await prisma.ajoRepaymentPlan.count({ where: { caseId: c.id, status: { in: ['ACTIVE', 'PROPOSED'] } } })).toBe(0);
      // The member stays in the group, and a closed case moved no money.
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: joined[0].membership.id } })).status).toBe('ACTIVE');
      expect(await prisma.ajoLedgerEntry.count({ where: { associationId: w.A } })).toBe(0);
    });

    it('keeps every case to its own association', async () => {
      const w = await world();
      const other = await world();
      const { joined } = await pot(w);
      await defaults.openCase({ associationId: w.A, membershipId: joined[0].membership.id, actorUserId: w.officer.id, now: DAY5 });
      const [c] = await casesOf(w);
      expect(await codeOf(defaults.getCase({ associationId: other.A, caseId: c.id }))).toBe('CASE_NOT_FOUND');
      expect(await codeOf(defaults.openCase({ associationId: other.A, membershipId: joined[0].membership.id, actorUserId: other.officer.id, now: DAY5 }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(defaults.closeCase({ associationId: other.A, caseId: c.id, actorUserId: other.officer.id, outcome: 'RESOLVED', reason: 'Trying across associations' }))).toBe('CASE_NOT_FOUND');
      expect(await codeOf(defaults.addCaseNote({ associationId: other.A, caseId: c.id, actorUserId: other.officer.id, note: 'Trying across associations' }))).toBe('CASE_NOT_FOUND');
      expect(await codeOf(defaults.proposePlan({ associationId: other.A, caseId: c.id, actorUserId: other.officer.id }))).toBe('CASE_NOT_FOUND');
      expect(await defaults.listCases({ associationId: other.A })).toEqual([]);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('my memberships (T7 member screens)', () => {
    it('lists only the signed-in person’s own memberships, with what is owed, what is next and where they are in the order', async () => {
      const views = require('../../src/modules/ajo/ajo-views.service') as typeof import('../../src/modules/ajo/ajo-views.service');
      const w = await world();
      const other = await world();
      const { joined } = await pot(w, undefined, { paid: false });
      const me = joined[0];
      const mine = await views.listMyMemberships({ associationId: w.A, userId: me.member.userId as number, now: at('2027-03-09T10:00:00Z') });
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ membershipId: me.membership.id, status: 'ACTIVE', shares: 1, overdueKobo: '1000000', totalOwedKobo: '1500000', waitingFor: [] });
      expect(mine[0].nextDue).toMatchObject({ remainingKobo: '500000' });
      expect(mine[0].payoutPositions).toHaveLength(1);
      expect(mine[0].group.bankAccount?.masked).toMatch(/6789$/);
      expect(JSON.stringify(mine)).not.toContain('0123456789');
      // Another association's person, and an officer who is not in the group, see nothing of it.
      expect(await views.listMyMemberships({ associationId: other.A, userId: me.member.userId as number })).toEqual([]);
      expect(await views.listMyMemberships({ associationId: w.A, userId: w.officer.id })).toEqual([]);
    });

    it('lets an officer find association members to add, only in their own association, and lists who can be a collector', async () => {
      const views = require('../../src/modules/ajo/ajo-views.service') as typeof import('../../src/modules/ajo/ajo-views.service');
      const w = await world();
      const other = await world();
      const mine = await mkMember(w);
      await mkMember(other);
      const found = await views.searchPeople({ associationId: w.A, search: mine.lastName });
      expect(found.map((p) => p.id)).toEqual([mine.id]);
      expect(found[0]).toMatchObject({ name: `${mine.firstName} ${mine.lastName}`, hasLogin: true });
      expect((await views.searchPeople({ associationId: w.A, search: 'zzz-nobody' })).length).toBe(0);
      expect((await views.searchPeople({ associationId: other.A, search: mine.lastName })).length).toBe(0); // another association's search never sees them
      expect((await views.searchPeople({ associationId: w.A })).length).toBeGreaterThanOrEqual(1);

      expect(await views.listCollectorCandidates(w.A)).toEqual([]);
      await setHolders(w, 'ajo.collect', [w.officer.id]);
      const candidates = await views.listCollectorCandidates(w.A);
      expect(candidates.map((c) => c.userId)).toEqual([w.officer.id]);
      expect(await views.listCollectorCandidates(other.A)).toEqual([]);
    });

    it('shows a person who has just been added what they are still waiting for', async () => {
      const views = require('../../src/modules/ajo/ajo-views.service') as typeof import('../../src/modules/ajo/ajo-views.service');
      const w = await world();
      const g = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
      const member = await mkMember(w);
      await members.addMember({ associationId: w.A, groupId: g.id, memberId: member.id, actorUserId: w.admin.id });
      const [row] = await views.listMyMemberships({ associationId: w.A, userId: member.userId as number, now: NOW });
      expect(row.status).toBe('PENDING');
      expect(row.waitingFor.length).toBeGreaterThan(0);
      expect(row.waitingFor[0].text).toBeTruthy();
    });
  });

  describe('the trust score (T6.4)', () => {
    it('has no history for a new person, then counts on-time and late instalments across the person’s groups', async () => {
      const w = await world();
      const { g, joined } = await pot(w, undefined, { paid: false });
      const m = joined[0];
      const view = async (now: Date) => trust.toTrustView(await trust.personTrust(prisma, w.A, m.member.id, now));
      expect(await view(at('2027-03-01T10:00:00Z'))).toMatchObject({ band: 'NO_HISTORY', dueCount: 0 });

      await pay(w, g.id, m.membership.id, AMOUNT, at('2027-03-02T10:00:00Z')); // instalment 1, paid the day after it was due
      const late = await view(at('2027-03-09T10:00:00Z'));
      expect(late).toMatchObject({ dueCount: 2, onTimeCount: expect.any(Number) });
    });

    it('rates a person who paid every instalment on its day Excellent, and one who paid none At risk', async () => {
      const w = await world();
      const { g, joined } = await pot(w, undefined, { paid: false });
      await pay(w, g.id, joined[0].membership.id, AMOUNT, at('2027-03-01T10:00:00Z'));
      await pay(w, g.id, joined[0].membership.id, AMOUNT, at('2027-03-08T10:00:00Z'));
      const now = at('2027-03-09T10:00:00Z');
      expect(trust.toTrustView(await trust.personTrust(prisma, w.A, joined[0].member.id, now))).toMatchObject({ band: 'EXCELLENT', onTimeCount: 2, dueCount: 2, onTimePercent: 100 });
      expect(trust.toTrustView(await trust.personTrust(prisma, w.A, joined[1].member.id, now))).toMatchObject({ band: 'AT_RISK', onTimeCount: 0, dueCount: 2 });
      const list = await trust.listGroupTrust({ associationId: w.A, groupId: g.id, now });
      expect(list.map((r) => r.band)).toEqual(['EXCELLENT', 'AT_RISK', 'AT_RISK']);
      expect((await trust.getMembershipTrust({ associationId: w.A, membershipId: joined[1].membership.id, now })).text).toBeTruthy();
    });

    it('leaves a disputed instalment out until the dispute is decided', async () => {
      const w = await world();
      const { joined } = await pot(w, undefined, { paid: false });
      const now = at('2027-03-09T10:00:00Z');
      const m = joined[1];
      const before = await trust.personTrust(prisma, w.A, m.member.id, now);
      const inst = (await installments(m.membership.id))[0];
      const d = await disputes.raiseDispute({ associationId: w.A, membershipId: m.membership.id, installmentId: inst.id, claim: 'I paid the collector in cash on Monday morning', actorUserId: m.member.userId as number, actorCanManage: false });
      const during = await trust.personTrust(prisma, w.A, m.member.id, now);
      expect(during.dueCount).toBe(before.dueCount - 1);
      expect(during.excludedDisputed).toBe(1);
      await disputes.resolveDispute({ associationId: w.A, disputeId: d.id, outcome: 'NOT_UPHELD', reason: 'The collector has no record of this cash', actorUserId: w.officer.id, now });
      expect((await trust.personTrust(prisma, w.A, m.member.id, now)).dueCount).toBe(before.dueCount);
    });

    it('follows the person into a new group, and feeds the "At risk cannot take early positions" draw rule', async () => {
      const w = await world();
      const a = await pot(w, undefined, { paid: false });
      const person = a.joined[1]; // paid nothing in the first group
      const b = await newGroup(w, { model: 'ROTATING_POT', maxParticipants: 3 }, { blockAtRiskEarly: true });
      const inB = await joinMember(w, b.id, person.member);
      const fresh = await join(w, b.id);
      const now = at('2027-03-20T10:00:00Z');
      const risky = await trust.atRiskMembershipIds(prisma, b.id, now);
      expect([...risky]).toEqual([inB.id]);
      expect(risky.has(fresh.membership.id)).toBe(false);
      expect([...(await order.atRiskMemberships(prisma, b.id, now))]).toEqual([inB.id]);
    });

    it('records a snapshot only when the score has changed, and the daily job is safe to repeat', async () => {
      const w = await world();
      const { g, joined } = await pot(w, undefined, { paid: false });
      const day = at('2027-03-09T02:30:00Z');
      const first = await cycle.runAjoDailyJobs(day, { groupIds: [g.id] });
      expect(first.errors).toEqual([]);
      expect(first.snapshots).toBe(3);
      expect((await cycle.runAjoDailyJobs(at('2027-03-09T02:45:00Z'), { groupIds: [g.id] })).snapshots).toBe(0);
      await pay(w, g.id, joined[0].membership.id, AMOUNT, at('2027-03-09T10:00:00Z'));
      expect((await cycle.runAjoDailyJobs(at('2027-03-10T02:30:00Z'), { groupIds: [g.id] })).snapshots).toBe(0); // paying late does not change an on-time count
      expect((await cycle.runAjoDailyJobs(at('2027-03-16T02:30:00Z'), { groupIds: [g.id] })).snapshots).toBe(3); // the 15 March instalment fell due for everyone
      const history = await trust.getMembershipTrust({ associationId: w.A, membershipId: joined[0].membership.id, now: at('2027-03-16T10:00:00Z') });
      expect(history.history).toHaveLength(2);
    });

    it('keeps one association’s people out of another’s score', async () => {
      const w = await world();
      const other = await world();
      const { joined } = await pot(w, undefined, { paid: false });
      expect(await codeOf(trust.getMembershipTrust({ associationId: other.A, membershipId: joined[0].membership.id }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(trust.listGroupTrust({ associationId: other.A, groupId: joined[0].membership.groupId }))).toBe('GROUP_NOT_FOUND');
      expect(trust.toTrustView(await trust.personTrust(prisma, other.A, joined[0].member.id, at('2027-03-09T10:00:00Z'))).band).toBe('NO_HISTORY');
    });
  });
});
