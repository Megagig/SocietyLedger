/**
 * Collector-thrift cycles (spec §16.5) against a real (disposable) database: each saver's own amount, withdraw or continue at the end
 * (no answer means withdraw), the collector's fee as one of that saver's contributions, savings carried into the next cycle, and a payout
 * in the second cycle that includes them.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-cycles.integration --forceExit
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

const told: Array<{ userId: number; pushType: string; message: string }> = [];
jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })),
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return {
    ...actual,
    notifyUser: jest.fn(async (_a: number, userId: number, n: { pushType: string; message: string }) => {
      told.push({ userId, pushType: n.pushType, message: n.message });
    }),
    notifyPermissionHolders: jest.fn(async () => undefined),
  };
});
jest.mock('../../src/lib/storage', () => ({
  uploadFile: jest.fn(async (key: string) => key),
  deleteFile: jest.fn(async () => undefined),
  getPresignedUrl: jest.fn(async (key: string) => `https://files.test/${key}`),
}));
jest.mock('../../src/modules/sms/sms-engine', () => ({
  dispatchMessages: jest.fn(async () => ({ accepted: 1, credits: 1, messageIds: [1], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) })),
}));
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: jest.fn(async () => ({ isEnabled: true })) },
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(120000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const at = (iso: string) => new Date(iso);
const NOW = at('2027-02-01T10:00:00Z');
const BEFORE_START = at('2027-02-25T10:00:00Z');
const START = '2027-03-01';
/** A weekly cycle of two payments: due 1 March and 8 March, so it ends on 8 March. */
const MID = at('2027-03-02T10:00:00Z');
const PROMPT_OPEN = at('2027-03-05T10:00:00Z');
const OVER = at('2027-03-10T10:00:00Z');
const MIN = 50_000n; // ₦500.00, the smallest a saver can choose

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Collector-thrift cycles (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let payouts: typeof import('../../src/modules/ajo/ajo-payout.service');
  let cycles: typeof import('../../src/modules/ajo/ajo-cycle.service');
  let secrets: typeof import('../../src/modules/ajo/ajo-secrets');

  interface World {
    A: number;
    admin: { id: number };
    officer: { id: number };
    recon: { id: number };
    approver: { id: number };
  }
  let counter = 0;
  const holders = new Map<string, number>();

  async function world(): Promise<World> {
    const slug = `ajo-cyc-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Cycles ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), officer: await user('officer'), recon: await user('recon'), approver: await user('approver') };
    for (const [key, who] of [['ajo.reconcile', w.recon.id], ['ajo.approve_payout', w.approver.id]] as const) {
      const permission = await prisma.permission.upsert({ where: { key }, create: { key, description: `Test ${key}`, module: 'Ajo' }, update: {} });
      const role = await prisma.role.create({ data: { associationId: w.A, name: `cyc-${key}-${run}-${++counter}`, displayName: key } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      await prisma.userRole.create({ data: { userId: who, roleId: role.id, associationId: w.A } });
      holders.set(`${w.A}:${key}`, role.id);
    }
    return w;
  }
  async function mkMember(w: World) {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `saver-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `CYC${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', status: 'active' } });
  }
  async function makePayable(w: World, memberId: number) {
    const number = '0123456789';
    await prisma.ajoPayoutAccount.upsert({ where: { memberId }, create: { associationId: w.A, memberId, bankName: 'GTBank', accountName: 'Adaeze Okafor', accountNumberEnc: secrets.encryptAccountNumber(memberId, number), last4: number.slice(-4) }, update: {} });
    await prisma.ajoVerification.create({ data: { associationId: w.A, memberId, submittedName: 'Adaeze Okafor', status: 'VERIFIED', nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true, reviewedBy: w.admin.id, reviewedAt: new Date('2027-01-01') } });
  }
  async function newGroup(w: World, fields: Record<string, unknown> = {}) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      fields: { name: `Thrift ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 2, contributionKobo: Number(MIN), startDate: START, maxParticipants: 30, collectorFeeType: 'DAYS', collectorFeeValue: 1, ...fields } as never,
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  /** Add a saver at the amount they chose, with their rules accepted and approval given. */
  async function join(w: World, groupId: number, amountKobo?: bigint) {
    const member = await mkMember(w);
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id, amountKobo });
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return { member, membership };
  }
  async function fund(w: World, groupId: number, membershipId: number, amount: bigint, now: Date) {
    const rep = await contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: amount, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
    await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now });
  }
  async function payOut(w: World, groupId: number, membershipId: number, now: Date) {
    const prep = await payouts.preparePayout({ associationId: w.A, groupId, membershipId, actorUserId: w.officer.id, now });
    await payouts.approvePayout({ associationId: w.A, payoutId: prep.payout.id, actorUserId: w.approver.id, now });
    return payouts.recordPayoutPaid({ associationId: w.A, payoutId: prep.payout.id, actorUserId: w.recon.id, reference: `GTB-${run}-${++counter}`, now });
  }
  const installments = (membershipId: number, cycleNo?: number) => prisma.ajoInstallment.findMany({ where: { membershipId, ...(cycleNo ? { cycleNo } : {}) }, orderBy: { dueDate: 'asc' } });
  const start = (w: World, groupId: number) => groups.startGroup({ associationId: w.A, groupId, actorUserId: w.admin.id, now: BEFORE_START });
  const nextCycle = (w: World, groupId: number, now: Date) => cycles.startNextCycle({ associationId: w.A, groupId, actorUserId: w.approver.id, now });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    payouts = require('../../src/modules/ajo/ajo-payout.service');
    cycles = require('../../src/modules/ajo/ajo-cycle.service');
    secrets = require('../../src/modules/ajo/ajo-secrets');
    void order;
  });

  beforeEach(() => {
    told.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('each saver chooses their own amount', () => {
    it('gives each saver an installment schedule at the amount they chose, in the cycle they are in', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      const b = await join(w, g.id, 100_000n);
      const c = await join(w, g.id); // chose nothing: the group's smallest
      await start(w, g.id);
      expect((await installments(a.membership.id)).map((i) => [i.amountKobo, i.cycleNo])).toEqual([[50_000n, 1], [50_000n, 1]]);
      expect((await installments(b.membership.id)).map((i) => i.amountKobo)).toEqual([100_000n, 100_000n]);
      expect((await installments(c.membership.id)).map((i) => i.amountKobo)).toEqual([MIN, MIN]);
    });

    it('refuses an amount below the group\'s smallest, in full naira', async () => {
      const w = await world();
      const g = await newGroup(w);
      const member = await mkMember(w);
      await expect(members.addMember({ associationId: w.A, groupId: g.id, memberId: member.id, actorUserId: w.admin.id, amountKobo: 49_999n })).rejects.toMatchObject({ code: 'INVALID_AMOUNT', message: 'The smallest amount for this group is ₦500.00.' });
    });

    it('lets a saver change it before the cycle begins for them, and re-prices what is planned', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      await start(w, g.id);
      const res = await cycles.setSaverAmount({ associationId: w.A, membershipId: a.membership.id, amountKobo: 200_000n, actorUserId: w.admin.id, now: at('2027-02-26T10:00:00Z') });
      expect(res).toMatchObject({ amountKobo: '200000', changed: true });
      expect((await installments(a.membership.id)).map((i) => i.amountKobo)).toEqual([200_000n, 200_000n]);
    });

    it('keeps it the same for the whole cycle once it has begun', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      await start(w, g.id);
      expect(await codeOf(cycles.setSaverAmount({ associationId: w.A, membershipId: a.membership.id, amountKobo: 100_000n, actorUserId: w.admin.id, now: MID }))).toBe('AMOUNT_LOCKED');
      expect((await installments(a.membership.id)).map((i) => i.amountKobo)).toEqual([50_000n, 50_000n]);
    });

    it('also locks it as soon as any money has been recorded, even before the first due date', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      await start(w, g.id);
      await fund(w, g.id, a.membership.id, 50_000n, at('2027-02-26T10:00:00Z'));
      expect(await codeOf(cycles.setSaverAmount({ associationId: w.A, membershipId: a.membership.id, amountKobo: 100_000n, actorUserId: w.admin.id, now: at('2027-02-27T10:00:00Z') }))).toBe('AMOUNT_LOCKED');
    });

    it('is for collector thrift only: a rotating pot has one fixed amount', async () => {
      const w = await world();
      const pot = await newGroup(w, { model: 'ROTATING_POT', cycleLength: null, maxParticipants: 3 });
      const p = await join(w, pot.id);
      expect(await codeOf(cycles.setSaverAmount({ associationId: w.A, membershipId: p.membership.id, amountKobo: 100_000n, actorUserId: w.admin.id }))).toBe('NOT_COLLECTOR_THRIFT');
      const member = await mkMember(w);
      expect(await codeOf(members.addMember({ associationId: w.A, groupId: pot.id, memberId: member.id, actorUserId: w.admin.id, amountKobo: 100_000n }))).toBe('NOT_COLLECTOR_THRIFT');
    });

    it('treats a group from before cycles as one cycle at the group\'s own amount, so nothing changes for anyone', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id);
      // An older group has no cycle rows at all.
      await prisma.ajoMembershipCycle.deleteMany({ where: { membershipId: a.membership.id } });
      await start(w, g.id);
      expect((await installments(a.membership.id)).map((i) => [i.amountKobo, i.cycleNo])).toEqual([[MIN, 1], [MIN, 1]]);
      expect((await prisma.ajoMembershipCycle.findUniqueOrThrow({ where: { membershipId_cycleNo: { membershipId: a.membership.id, cycleNo: 1 } } })).amountKobo).toBe(MIN);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the collector\'s fee is one contribution of each saver', () => {
    it('takes ₦500.00 from the ₦500.00 saver and ₦1,000.00 from the ₦1,000.00 saver', async () => {
      const w = await world();
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      const b = await join(w, g.id, 100_000n);
      await start(w, g.id);
      for (const p of [a, b]) await makePayable(w, p.member.id);
      await fund(w, g.id, a.membership.id, 100_000n, MID);
      await fund(w, g.id, b.membership.id, 200_000n, MID);
      const pa = await payouts.previewPayout({ associationId: w.A, groupId: g.id, membershipId: a.membership.id, now: OVER });
      const pb = await payouts.previewPayout({ associationId: w.A, groupId: g.id, membershipId: b.membership.id, now: OVER });
      expect(pa).toMatchObject({ confirmedKobo: '100000', feeKobo: '50000', netKobo: '50000' });
      expect(pb).toMatchObject({ confirmedKobo: '200000', feeKobo: '100000', netKobo: '100000' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the end of the cycle', () => {
    async function threeSavers(w: World) {
      const g = await newGroup(w);
      const a = await join(w, g.id, 50_000n);
      const b = await join(w, g.id, 100_000n);
      const c = await join(w, g.id, 50_000n);
      await start(w, g.id);
      for (const p of [a, b, c]) await makePayable(w, p.member.id);
      await fund(w, g.id, a.membership.id, 100_000n, MID);
      await fund(w, g.id, b.membership.id, 200_000n, MID);
      await fund(w, g.id, c.membership.id, 100_000n, MID);
      return { g, a, b, c };
    }

    it('opens the question three days before the last due date, and not before', async () => {
      const w = await world();
      const { a } = await threeSavers(w);
      expect(await codeOf(cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'WITHDRAW', actorUserId: w.admin.id, viaOfficer: false, now: MID }))).toBe('TOO_EARLY');
      const view = await cycles.getCycleView({ associationId: w.A, membershipId: a.membership.id, now: PROMPT_OPEN });
      expect(view).toMatchObject({ cycleNo: 1, amountKobo: '50000', canDecide: true, choice: 'PENDING', effectiveChoice: 'WITHDRAW', promptOpensOn: '2027-03-05', endsOn: '2027-03-08' });
      expect(view.ifNoAnswer).toMatch(/paid out to you/);
    });

    it('asks each saver once, and never twice', async () => {
      const w = await world();
      const { a } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'CONTINUE', actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      expect(await cycles.runCycleEndPrompts(at('2027-03-04T10:00:00Z'))).toEqual({ asked: 0 });
      const first = await cycles.runCycleEndPrompts(PROMPT_OPEN);
      expect(first.asked).toBeGreaterThanOrEqual(2); // the two who have not answered (others in the test database may add to it)
      const questions = told.filter((t) => t.pushType === 'ajo.cycle_ending');
      expect(questions.length).toBe(first.asked);
      expect(questions[0].message).toMatch(/If you do not answer, your savings are paid out to you/);
      expect((await cycles.runCycleEndPrompts(PROMPT_OPEN)).asked).toBe(0);
    });

    it('holds the next cycle back until the cycle is over, and until every saver who is leaving has been paid', async () => {
      const w = await world();
      const { g, a, b } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'CONTINUE', nextAmountKobo: 150_000n, actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: b.membership.id, choice: 'WITHDRAW', actorUserId: w.officer.id, viaOfficer: true, now: PROMPT_OPEN });
      // c said nothing, which means withdraw.
      expect(await codeOf(nextCycle(w, g.id, PROMPT_OPEN))).toBe('CYCLE_NOT_FINISHED');
      const blocked = await nextCycle(w, g.id, OVER).catch((e) => e as { code: string; message: string });
      expect(blocked).toMatchObject({ code: 'WITHDRAWALS_NOT_PAID' });
      expect((blocked as { message: string }).message).toContain('₦1,000.00'); // b: ₦2,000.00 saved less a ₦1,000.00 fee
    });

    it('refuses to start another cycle when nobody is continuing', async () => {
      const w = await world();
      const { g } = await threeSavers(w);
      expect(await codeOf(nextCycle(w, g.id, OVER))).toBe('NOBODY_CONTINUING');
    });

    it('carries a continuing saver\'s savings, less one contribution as the fee, into a new cycle at the amount they chose, and lets the rest leave', async () => {
      const w = await world();
      const { g, a, b, c } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'CONTINUE', nextAmountKobo: 150_000n, actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: b.membership.id, choice: 'WITHDRAW', actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });

      // The two who are leaving are paid first: b ₦2,000.00 less a ₦1,000.00 fee, c ₦1,000.00 less a ₦500.00 fee.
      const paidB = await payOut(w, g.id, b.membership.id, OVER);
      const paidC = await payOut(w, g.id, c.membership.id, OVER);
      expect([paidB.payout.netKobo, paidB.payout.collectorFeeKobo]).toEqual(['100000', '100000']);
      expect([paidC.payout.netKobo, paidC.payout.collectorFeeKobo]).toEqual(['50000', '50000']);

      const next = await nextCycle(w, g.id, OVER);
      expect(next).toMatchObject({ cycleNo: 2, continuing: 1, withdrawn: 2, startsOn: '2027-03-15', endsOn: '2027-03-22' });

      const cycle1 = await prisma.ajoMembershipCycle.findUniqueOrThrow({ where: { membershipId_cycleNo: { membershipId: a.membership.id, cycleNo: 1 } } });
      const cycle2 = await prisma.ajoMembershipCycle.findUniqueOrThrow({ where: { membershipId_cycleNo: { membershipId: a.membership.id, cycleNo: 2 } } });
      expect(cycle1.feeSettledKobo).toBe(50_000n); // one of a's contributions
      expect(cycle2).toMatchObject({ amountKobo: 150_000n, carriedKobo: 50_000n, choice: 'PENDING' }); // ₦1,000.00 saved less ₦500.00 fee
      expect((await installments(a.membership.id, 2)).map((i) => [i.amountKobo, i.cycleNo])).toEqual([[150_000n, 2], [150_000n, 2]]);
      expect((await installments(a.membership.id, 1)).every((i) => i.amountKobo === 50_000n)).toBe(true);

      const fee = await prisma.ajoLedgerEntry.findMany({ where: { membershipId: a.membership.id, refType: 'cycle_fee' } });
      expect(fee.map((e) => [e.type, e.direction, e.amountKobo])).toEqual([['FEE', 'DEBIT', 50_000n]]);

      expect((await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).cycleNo).toBe(2);
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: b.membership.id } })).status).toBe('LEFT');
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: c.membership.id } })).status).toBe('LEFT');
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: a.membership.id } })).status).toBe('ACTIVE');
      expect(told.some((t) => t.pushType === 'ajo.cycle_started' && t.message.includes('You pay ₦1,500.00 each time and bring ₦500.00 forward'))).toBe(true);

      // It cannot be started twice.
      expect(await codeOf(nextCycle(w, g.id, OVER))).toBe('CYCLE_NOT_FINISHED');
    });

    it('pays out the second cycle with the carried savings, takes only the second cycle\'s fee, and leaves the first cycle alone', async () => {
      const w = await world();
      const { g, a, b, c } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'CONTINUE', nextAmountKobo: 150_000n, actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      await payOut(w, g.id, b.membership.id, OVER);
      await payOut(w, g.id, c.membership.id, OVER);
      await nextCycle(w, g.id, OVER);

      // Cycle 2: two payments of ₦1,500.00 (due 15 and 22 March).
      await fund(w, g.id, a.membership.id, 300_000n, at('2027-03-16T10:00:00Z'));
      const after = at('2027-03-25T10:00:00Z');
      const preview = await payouts.previewPayout({ associationId: w.A, groupId: g.id, membershipId: a.membership.id, now: after });
      // Confirmed this cycle ₦3,000.00 plus ₦500.00 carried in; the fee is one of this cycle's contributions (₦1,500.00) and is not taken on the carried part.
      expect(preview).toMatchObject({ confirmedKobo: '350000', shortfallKobo: '0', feeKobo: '150000', netKobo: '200000', canPrepare: true });
      const paid = await payOut(w, g.id, a.membership.id, after);
      expect(paid.payout).toMatchObject({ netKobo: '200000', collectorFeeKobo: '150000' });
      expect((await prisma.ajoPayout.findUniqueOrThrow({ where: { id: paid.payout.id } })).cycleNo).toBe(2);
      // Cycle 1's payout for a was never made (a continued), and b's and c's are untouched.
      expect(await prisma.ajoPayout.count({ where: { membershipId: a.membership.id } })).toBe(1);
    });

    it('does not let someone change their answer once their payout has started', async () => {
      const w = await world();
      const { g, b } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: b.membership.id, choice: 'WITHDRAW', actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      await payouts.preparePayout({ associationId: w.A, groupId: g.id, membershipId: b.membership.id, actorUserId: w.officer.id, now: OVER });
      expect(await codeOf(cycles.decideCycleEnd({ associationId: w.A, membershipId: b.membership.id, choice: 'CONTINUE', actorUserId: w.admin.id, viaOfficer: false, now: OVER }))).toBe('PAYOUT_ALREADY_STARTED');
    });

    it('shows the officer who continues, who withdraws and who has said nothing', async () => {
      const w = await world();
      const { g, a, b } = await threeSavers(w);
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: a.membership.id, choice: 'CONTINUE', actorUserId: w.admin.id, viaOfficer: false, now: PROMPT_OPEN });
      await cycles.decideCycleEnd({ associationId: w.A, membershipId: b.membership.id, choice: 'WITHDRAW', actorUserId: w.officer.id, viaOfficer: true, now: PROMPT_OPEN });
      const view = await cycles.getGroupCycle({ associationId: w.A, groupId: g.id, now: OVER });
      expect(view).toMatchObject({ cycleNo: 1, cycleOver: true, counts: { continuing: 1, withdrawing: 2, noAnswer: 1 }, canStartNext: true });
      expect(view.people.find((p) => p.membershipId === b.membership.id)).toMatchObject({ choice: 'WITHDRAW', decidedVia: 'officer', amountKobo: '100000', savedKobo: '200000' });
      expect(view.people.find((p) => p.membershipId === a.membership.id)?.effectiveChoice).toBe('CONTINUE');
    });
  });
});
