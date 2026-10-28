/**
 * Ajo platform levy (T5.4) against a real (disposable) database: assessment from the schedule, the exempt tier, late joiners, the 60-day
 * rule, the checkout line and its settlement, a levy paid twice, and what staff see. Billing's own checkout is exercised end to end in
 * ajo-levy-billing.integration.test.ts.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-levy.integration --forceExit
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

const tier = { code: 'ajo-growth' as string | null };
const notices: Array<{ to: string; pushType: string }> = [];

jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })),
}));
jest.mock('../../src/services/billing/held-addon.service', () => ({
  heldAddonCodeInFamily: jest.fn(async () => tier.code),
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return {
    ...actual,
    notifyUser: jest.fn(async (_a: number, _u: number, n: { pushType: string }) => {
      notices.push({ to: 'user', pushType: n.pushType });
    }),
    notifyPermissionHolders: jest.fn(async (_a: number, _p: string, n: { pushType: string }) => {
      notices.push({ to: 'holders', pushType: n.pushType });
    }),
  };
});
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(async (k: string) => k), deleteFile: jest.fn(async () => undefined), getPresignedUrl: jest.fn(async (k: string) => k) }));
jest.mock('../../src/modules/sms/sms-engine', () => ({
  dispatchMessages: jest.fn(async () => ({ accepted: 1, credits: 1, messageIds: [1], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) })),
}));
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(90000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');
const BEFORE_START = new Date('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const PAY = new Date('2027-03-02T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo platform levy (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let levy: typeof import('../../src/modules/ajo/ajo-levy.service');
  let lifecycle: typeof import('../../src/services/billing/lifecycle.service');

  let admin: { id: number };
  let counter = 0;

  async function mkAssociation(label: string) {
    const slug = `ajo-l-${label}-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo L ${label} ${run}`, slug, subdomain: slug } });
    const user = await prisma.user.create({ data: { associationId: assoc.id, email: `admin-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    return { id: assoc.id, admin: user };
  }
  async function mkMember(associationId: number) {
    const n = ++counter;
    return prisma.member.create({ data: { associationId, memberId: `L${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', address: '12 Market Road, Aba', status: 'active' } });
  }
  async function newGroup(a: { id: number; admin: { id: number } }, fields: Record<string, unknown> = {}) {
    const g = await groups.createGroup({
      associationId: a.id,
      actorUserId: a.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      fields: { name: `Circle ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500_000, startDate: START, cycleLength: 10, maxParticipants: 30, ...fields },
    });
    await groups.openGroup({ associationId: a.id, groupId: g.id, actorUserId: a.admin.id, now: NOW });
    return g;
  }
  async function join(a: { id: number; admin: { id: number } }, groupId: number, now: Date = NOW) {
    const member = await mkMember(a.id);
    const membership = await members.addMember({ associationId: a.id, groupId, memberId: member.id, actorUserId: a.admin.id });
    await consent.acceptRules({ associationId: a.id, membershipId: membership.id, actorUserId: a.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now });
    await members.approveMembership({ associationId: a.id, membershipId: membership.id, actorUserId: a.admin.id, now });
    return { member, membership };
  }
  /** A running group of `people`: 10 weekly instalments of ₦5,000.00 each is ₦50,000.00 a person. */
  async function running(a: { id: number; admin: { id: number } }, people: number, fields: Record<string, unknown> = {}) {
    const g = await newGroup(a, fields);
    const joined = [];
    for (let i = 0; i < people; i++) joined.push(await join(a, g.id));
    await groups.startGroup({ associationId: a.id, groupId: g.id, actorUserId: a.admin.id, now: BEFORE_START });
    return { g, joined };
  }
  const rowsOf = (groupId: number) => prisma.ajoLevyAssessment.findMany({ where: { groupId }, orderBy: { id: 'asc' } });
  const sum = (rows: Array<{ amountKobo: bigint }>) => rows.reduce((s, r) => s + r.amountKobo, 0n);

  /** A row aged to order, for the 60-day rule and the checkout tests. */
  async function plant(associationId: number, groupId: number, over: Partial<{ amountKobo: bigint; status: 'ACCRUED' | 'BILLED' | 'PAID' | 'WAIVED' | 'VOID'; accruedAt: Date; kind: 'CYCLE' | 'PARTICIPANT' | 'CREDIT' }> = {}) {
    return prisma.ajoLevyAssessment.create({
      data: { associationId, groupId, kind: over.kind ?? 'CYCLE', status: over.status ?? 'ACCRUED', dedupeKey: `plant:${run}:${++counter}`, baseKobo: 0n, rateBps: 50, minKobo: 0n, maxKobo: 0n, amountKobo: over.amountKobo ?? 250_000n, addonCode: 'ajo-growth', calculation: 'A planted levy for a test.', accruedAt: over.accruedAt ?? NOW },
    });
  }
  async function bareGroup(associationId: number) {
    return prisma.ajoGroup.create({ data: { associationId, name: `Planted ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500_000n, startDate: new Date(START), maxParticipants: 5 } });
  }
  const quoteOf = (totalKobo: number, over: Record<string, unknown> = {}) =>
    ({ kind: 'RENEW', planId: 1, planCode: 'x', planName: 'Plan X', planVersionId: 1, billingCycle: 'MONTHLY', extend: true, addons: [], lines: [{ type: 'PLAN', label: 'Plan X (monthly)', amountKobo: totalKobo, amount: '₦8,000.00' }], totalKobo, total: '₦8,000.00', periodEndsAt: '2027-04-01T00:00:00.000Z', deferred: false, deferredEffectiveAt: null, createdAt: NOW.toISOString(), ...over }) as never;

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    levy = require('../../src/modules/ajo/ajo-levy.service');
    lifecycle = require('../../src/services/billing/lifecycle.service');
    admin = (await mkAssociation('seed')).admin;
  });

  beforeEach(() => {
    tier.code = 'ajo-growth';
    notices.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('assessing a group’s levy (T5.4)', () => {
    it('matches the spec’s worked example: 10 people paying ₦5,000.00 weekly for 10 weeks come to ₦3,750.00', async () => {
      const a = await mkAssociation('worked');
      const { g } = await running(a, 10);
      const rows = await rowsOf(g.id);
      const cycle = rows.filter((r) => r.kind === 'CYCLE');
      const people = rows.filter((r) => r.kind === 'PARTICIPANT');
      expect(cycle).toHaveLength(1);
      expect(cycle[0]).toMatchObject({ status: 'ACCRUED', baseKobo: 50_000_000n, rateBps: 50, minKobo: 50_000n, maxKobo: 500_000n, amountKobo: 250_000n, addonCode: 'ajo-growth' });
      expect(people).toHaveLength(10);
      expect(people.every((r) => r.baseKobo === 5_000_000n && r.amountKobo === 12_500n && r.membershipId !== null)).toBe(true);
      expect(sum(rows)).toBe(375_000n); // ₦3,750.00
      expect(cycle[0].calculation).toContain('0.5% of ₦500,000.00');
      expect(cycle[0].calculation).toContain('Levy: ₦2,500.00');
      expect(people[0].calculation).toContain('0.25% of ₦50,000.00');
      expect((await audits(a.id, 'AJO_GROUP_STARTED'))[0].newValues).toMatchObject({ levyKobo: '375000', levyExempt: false });
    });

    it('freezes the rates it used, so a later change of settings never alters what was assessed', async () => {
      const a = await mkAssociation('frozen');
      const { g } = await running(a, 2);
      const before = await rowsOf(g.id);
      const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');
      const spy = jest.spyOn(PlatformSettingsService, 'getSettings').mockResolvedValue({ ajoCycleLevyBps: 100, ajoCycleLevyMinKobo: 50_000, ajoCycleLevyMaxKobo: 500_000, ajoParticipantLevyBps: 100, ajoParticipantLevyMinKobo: 5_000, ajoParticipantLevyMaxKobo: 100_000, ajoLevyExemptAddonCodes: ['ajo-starter'] });
      try {
        await prisma.$transaction((tx) => levy.assessGroupLevy(tx, { associationId: a.id, groupId: g.id, now: BEFORE_START }));
      } finally {
        spy.mockRestore();
      }
      const after = await rowsOf(g.id);
      expect(after.map((r) => [r.id, r.amountKobo, r.rateBps])).toEqual(before.map((r) => [r.id, r.amountKobo, r.rateBps])); // assessing again changed nothing
    });

    it('assesses nothing for the exempt tier, and nothing when there is no add-on', async () => {
      tier.code = 'ajo-starter';
      const a = await mkAssociation('starter');
      const { g } = await running(a, 3);
      expect(await rowsOf(g.id)).toEqual([]);
      expect((await audits(a.id, 'AJO_GROUP_STARTED'))[0].newValues).toMatchObject({ levyExempt: true });

      tier.code = null;
      const b = await mkAssociation('none');
      const { g: g2 } = await running(b, 2);
      expect(await rowsOf(g2.id)).toEqual([]);
    });

    it('keeps the cycle levy within its minimum and maximum', async () => {
      const a = await mkAssociation('limits');
      const small = await running(a, 1, { contributionKobo: 10_000, cycleLength: 2 }); // ₦200.00 scheduled in all
      const rows = await rowsOf(small.g.id);
      expect(rows.find((r) => r.kind === 'CYCLE')?.amountKobo).toBe(50_000n); // raised to ₦500.00
      expect(rows.find((r) => r.kind === 'PARTICIPANT')?.amountKobo).toBe(5_000n); // raised to ₦50.00
      expect(rows.find((r) => r.kind === 'CYCLE')?.calculation).toContain('raised to the minimum of ₦500.00');
    });

    it('charges a person who joins late a participant levy on their own schedule, once, and leaves the cycle levy alone', async () => {
      const a = await mkAssociation('late');
      const { g } = await running(a, 2);
      const cycleBefore = (await rowsOf(g.id)).find((r) => r.kind === 'CYCLE')!;
      const late = await join(a, g.id, new Date('2027-03-20T10:00:00Z'));
      const mine = (await rowsOf(g.id)).filter((r) => r.membershipId === late.membership.id);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ kind: 'PARTICIPANT', baseKobo: 3_500_000n, amountKobo: 8_750n }); // seven instalments left, 0.25%
      expect((await rowsOf(g.id)).find((r) => r.kind === 'CYCLE')!.amountKobo).toBe(cycleBefore.amountKobo);
      await prisma.$transaction((tx) => levy.assessParticipantLevy(tx, { associationId: a.id, groupId: g.id, membershipId: late.membership.id, now: PAY }));
      expect((await rowsOf(g.id)).filter((r) => r.membershipId === late.membership.id)).toHaveLength(1);
    });

    it('voids a cancelled group’s unbilled levy, and leaves billed levy alone', async () => {
      const a = await mkAssociation('cancel');
      const { g } = await running(a, 3);
      const rows = await rowsOf(g.id);
      await prisma.ajoLevyAssessment.update({ where: { id: rows[1].id }, data: { status: 'BILLED', billedPaymentId: 99 } });
      await groups.cancelGroup({ associationId: a.id, groupId: g.id, actorUserId: a.admin.id, reason: 'The group did not go ahead', now: PAY });
      const after = await rowsOf(g.id);
      expect(after[0]).toMatchObject({ status: 'VOID', statusReason: 'The group was cancelled before any money was confirmed.' });
      expect(after[1].status).toBe('BILLED');
      expect(after.slice(2).every((r) => r.status === 'VOID')).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the 60-day rule', () => {
    it('stops a new group starting when levy more than 60 days old is unpaid, saying how much in full', async () => {
      const a = await mkAssociation('overdue');
      const old = await bareGroup(a.id);
      await plant(a.id, old.id, { amountKobo: 375_000n, accruedAt: new Date(BEFORE_START.getTime() - 61 * DAY) });
      const g = await newGroup(a);
      await join(a, g.id);
      let message = '';
      try {
        await groups.startGroup({ associationId: a.id, groupId: g.id, actorUserId: a.admin.id, now: BEFORE_START });
      } catch (error) {
        message = (error as Error).message;
        expect((error as { code?: string }).code).toBe('LEVY_OVERDUE');
      }
      expect(message).toContain('₦3,750.00');
      expect(message).toContain('Your existing groups are not affected');
      expect((await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).status).toBe('OPEN');
    });

    it('does not stop anything else: records, contributions and payouts carry on', async () => {
      const a = await mkAssociation('carry-on');
      const { g, joined } = await running(a, 1); // started while nothing was owed
      await plant(a.id, g.id, { amountKobo: 250_000n, accruedAt: new Date(PAY.getTime() - 90 * DAY) });
      const made = await contrib.reportTransfer({ associationId: a.id, groupId: g.id, membershipId: joined[0].membership.id, amountKobo: 500_000n, idempotencyKey: `k-${run}-carry`, actorUserId: a.admin.id, actorCanManage: true, proof: { buffer: Buffer.from('slip'), mimeType: 'image/png' }, now: PAY });
      expect(made.contribution.status).toBe('REPORTED');
      expect((await levy.listAssociationLevy(a.id)).items.length).toBeGreaterThan(0);
    });

    it('lets a group start when the levy is 59 days old, paid, waived, voided, or someone else’s', async () => {
      const a = await mkAssociation('not-yet');
      const old = await bareGroup(a.id);
      const cutoff = BEFORE_START.getTime();
      await plant(a.id, old.id, { accruedAt: new Date(cutoff - 59 * DAY) });
      for (const status of ['PAID', 'WAIVED', 'VOID'] as const) await plant(a.id, old.id, { status, accruedAt: new Date(cutoff - 200 * DAY) });
      const other = await mkAssociation('other-owes');
      await plant(other.id, (await bareGroup(other.id)).id, { accruedAt: new Date(cutoff - 200 * DAY) });
      const g = await newGroup(a);
      await join(a, g.id);
      await expect(groups.startGroup({ associationId: a.id, groupId: g.id, actorUserId: a.admin.id, now: BEFORE_START })).resolves.toMatchObject({ group: { status: 'ACTIVE' } });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('on the checkout (T5.4)', () => {
    it('adds the levy as its own lines, itemised per group, outside the plan price, and leaves a quote with no levy untouched', async () => {
      const a = await mkAssociation('quote');
      const quote = quoteOf(800_000);
      expect(await levy.attachLevyToQuote(a.id, quote)).toBe(quote); // nothing owed: the very same quote

      const g1 = await bareGroup(a.id);
      const g2 = await bareGroup(a.id);
      const x = await plant(a.id, g1.id, { amountKobo: 250_000n });
      const y = await plant(a.id, g1.id, { amountKobo: 12_500n, kind: 'PARTICIPANT' });
      const z = await plant(a.id, g2.id, { amountKobo: 100_000n });
      await plant(a.id, g2.id, { amountKobo: 999_999n, status: 'WAIVED' });
      await plant(a.id, g2.id, { amountKobo: 999_999n, status: 'PAID' });

      const q = (await levy.attachLevyToQuote(a.id, quote)) as unknown as { lines: Array<{ type: string; label: string; amountKobo: number; amount: string }>; totalKobo: number; total: string; levy: { assessmentIds: number[]; totalKobo: number } };
      expect(q.lines[0]).toMatchObject({ type: 'PLAN', amountKobo: 800_000 });
      const levyLines = q.lines.filter((l) => l.type === 'LEVY');
      expect(levyLines).toHaveLength(2);
      expect(levyLines.map((l) => l.amountKobo).sort((p, r) => p - r)).toEqual([100_000, 262_500]);
      expect(levyLines.find((l) => l.amountKobo === 262_500)).toMatchObject({ label: expect.stringContaining('2 charges'), amount: '₦2,625.00' });
      expect(q.levy.totalKobo).toBe(362_500);
      expect(q.totalKobo).toBe(1_162_500);
      expect(q.total).toBe('₦11,625.00');
      expect([...q.levy.assessmentIds].sort()).toEqual([x.id, y.id, z.id].sort());
    });

    it('keeps the levy out of the plan and add-on shares', async () => {
      const q = quoteOf(0, { lines: [{ type: 'PLAN', label: 'Plan X', amountKobo: 500_000, amount: '' }, { type: 'ADDON', label: 'Ajo', amountKobo: 300_000, amount: '', addonId: 3 }, { type: 'CREDIT', label: 'Unused', amountKobo: -50_000, amount: '' }, { type: 'LEVY', label: 'Ajo platform levy', amountKobo: 375_000, amount: '' }], totalKobo: 1_125_000 });
      const shares = lifecycle.netShares(q);
      expect(shares.planKobo).toBe(450_000); // the plan less its credit
      expect(shares.addons.get(3)).toBe(300_000);
      expect([...shares.addons.values()].reduce((s, v) => s + v, shares.planKobo)).toBe(750_000); // the levy is not in either
    });

    it('marks the levy billed when a payment starts, takes it again if that checkout is abandoned, and marks it paid only when the payment is applied', async () => {
      const a = await mkAssociation('settle');
      const g = await bareGroup(a.id);
      const x = await plant(a.id, g.id, { amountKobo: 250_000n });
      const y = await plant(a.id, g.id, { amountKobo: 12_500n, kind: 'PARTICIPANT' });
      const ids = [x.id, y.id];

      await levy.markLevyBilled(prisma, ids, 101);
      expect((await prisma.ajoLevyAssessment.findMany({ where: { id: { in: ids } } })).map((r) => [r.status, r.billedPaymentId])).toEqual([['BILLED', 101], ['BILLED', 101]]);
      // The first checkout is abandoned. The next quote still carries the levy, and the next payment takes it over.
      const again = (await levy.attachLevyToQuote(a.id, quoteOf(800_000))) as unknown as { levy: { totalKobo: number } };
      expect(again.levy.totalKobo).toBe(262_500);
      await levy.markLevyBilled(prisma, ids, 102);
      expect((await prisma.ajoLevyAssessment.findMany({ where: { id: { in: ids } } })).every((r) => r.billedPaymentId === 102)).toBe(true);

      const settled = await prisma.$transaction((tx) => levy.settleLevyInTx(tx, { quote: { levy: { assessmentIds: ids, totalKobo: 262_500 } }, paymentHistoryId: 102, now: PAY }));
      expect(settled).toEqual({ paid: 2, credited: 0 });
      expect((await prisma.ajoLevyAssessment.findMany({ where: { id: { in: ids } } })).every((r) => r.status === 'PAID' && r.paidPaymentId === 102)).toBe(true);
      expect(await levy.attachLevyToQuote(a.id, quoteOf(800_000)).then((q) => (q as unknown as { levy?: unknown }).levy)).toBeUndefined(); // nothing owed any more

      // Settling the same payment again changes nothing.
      expect(await prisma.$transaction((tx) => levy.settleLevyInTx(tx, { quote: { levy: { assessmentIds: ids, totalKobo: 262_500 } }, paymentHistoryId: 102, now: PAY }))).toEqual({ paid: 0, credited: 0 });
      expect(await prisma.ajoLevyAssessment.count({ where: { associationId: a.id, kind: 'CREDIT' } })).toBe(0);
    });

    it('keeps the extra as a credit when the same levy is paid twice or was waived after the checkout began, and uses it on the next', async () => {
      const a = await mkAssociation('twice');
      const g = await bareGroup(a.id);
      const x = await plant(a.id, g.id, { amountKobo: 250_000n });
      const waived = await plant(a.id, g.id, { amountKobo: 100_000n });
      const quote = { levy: { assessmentIds: [x.id, waived.id], totalKobo: 350_000 } };
      await levy.markLevyBilled(prisma, [x.id, waived.id], 201);
      // Staff waive one of them while the buyer is still on the payment page.
      await levy.setLevyStatus({ id: waived.id, to: 'WAIVED', reason: 'Goodwill after a billing mistake', staffId: 9001, staffRole: 'FINANCE_ADMIN' });
      // Two payments are made against the same levy.
      const first = await prisma.$transaction((tx) => levy.settleLevyInTx(tx, { quote, paymentHistoryId: 201, now: PAY }));
      expect(first).toEqual({ paid: 1, credited: 1 }); // the waived one was paid for nothing
      const second = await prisma.$transaction((tx) => levy.settleLevyInTx(tx, { quote, paymentHistoryId: 202, now: PAY }));
      expect(second).toEqual({ paid: 0, credited: 2 });

      const credits = await prisma.ajoLevyAssessment.findMany({ where: { associationId: a.id, kind: 'CREDIT' }, orderBy: { id: 'asc' } });
      expect(credits.map((c) => c.amountKobo).sort()).toEqual([-250_000n, -100_000n, -100_000n].sort());
      expect(credits.every((c) => c.status === 'ACCRUED')).toBe(true);
      // The same payment settled again makes no more credits.
      await prisma.$transaction((tx) => levy.settleLevyInTx(tx, { quote, paymentHistoryId: 202, now: PAY }));
      expect(await prisma.ajoLevyAssessment.count({ where: { associationId: a.id, kind: 'CREDIT' } })).toBe(3);

      // New levy comes along: the credits are used against it, never beyond it.
      await plant(a.id, g.id, { amountKobo: 300_000n });
      const q = (await levy.attachLevyToQuote(a.id, quoteOf(800_000))) as unknown as { levy: { totalKobo: number }; lines: Array<{ type: string; label: string; amountKobo: number }>; totalKobo: number };
      expect(q.lines.some((l) => l.type === 'LEVY' && l.label.includes('credit') && l.amountKobo < 0)).toBe(true);
      expect(q.levy.totalKobo).toBeGreaterThanOrEqual(0);
      expect(q.totalKobo).toBe(800_000 + q.levy.totalKobo);
    });

    it('does not add the levy to a plan change that is only scheduled for later', async () => {
      const a = await mkAssociation('deferred');
      await plant(a.id, (await bareGroup(a.id)).id);
      const q = quoteOf(0, { deferred: true });
      expect(await levy.attachLevyToQuote(a.id, q)).toBe(q);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('what staff and the group admin see', () => {
    it('lists the levy with its calculation, and reports it by association and status on its own', async () => {
      const a = await mkAssociation('staff-a');
      const b = await mkAssociation('staff-b');
      const ga = await bareGroup(a.id);
      const gb = await bareGroup(b.id);
      await plant(a.id, ga.id, { amountKobo: 250_000n });
      await plant(a.id, ga.id, { amountKobo: 100_000n, status: 'PAID' });
      await plant(b.id, gb.id, { amountKobo: 50_000n });

      const list = await levy.listLevy({ associationId: a.id });
      expect(list.total).toBe(2);
      expect(list.items[0]).toMatchObject({ calculation: 'A planted levy for a test.', amount: expect.stringMatching(/^₦/) });
      expect((await levy.listLevy({ associationId: a.id, status: 'PAID' })).items).toHaveLength(1);

      const report = await levy.levyReport({ associationId: a.id });
      expect(report.associations).toHaveLength(1);
      expect(report.associations[0].totals).toMatchObject({ ACCRUED: { count: 1, kobo: '250000' }, PAID: { count: 1, kobo: '100000' } });
      expect(report.totals.ACCRUED).toEqual({ kobo: '250000', amount: '₦2,500.00' });
      const all = await levy.levyReport();
      expect(all.associations.length).toBeGreaterThanOrEqual(2);

      const own = await levy.listAssociationLevy(a.id);
      expect(own).toMatchObject({ owedKobo: '250000', owed: '₦2,500.00' });
      expect(own.items.every((i) => i.associationId === a.id)).toBe(true);
    });

    it('lets staff waive or void a levy still owed, with a reason that stays on the record, and nothing else', async () => {
      const a = await mkAssociation('waive');
      const g = await bareGroup(a.id);
      const owed = await plant(a.id, g.id, { amountKobo: 250_000n });
      const paid = await plant(a.id, g.id, { status: 'PAID' });
      const staff = { staffId: 9001, staffRole: 'FINANCE_ADMIN' };

      expect(await codeOf(levy.setLevyStatus({ id: owed.id, to: 'WAIVED', reason: 'short', ...staff }))).toBe('REASON_REQUIRED');
      expect(await codeOf(levy.setLevyStatus({ id: 99_999_999, to: 'WAIVED', reason: 'Goodwill after a billing mistake', ...staff }))).toBe('LEVY_NOT_FOUND');
      expect(await codeOf(levy.setLevyStatus({ id: paid.id, to: 'WAIVED', reason: 'Trying to waive a paid levy', ...staff }))).toBe('INVALID_LEVY_STATE');

      const done = await levy.setLevyStatus({ id: owed.id, to: 'WAIVED', reason: 'Goodwill after a billing mistake', ...staff });
      expect(done).toMatchObject({ replayed: false, levy: { status: 'WAIVED', statusReason: 'Goodwill after a billing mistake' } });
      expect((await levy.setLevyStatus({ id: owed.id, to: 'WAIVED', reason: 'Goodwill after a billing mistake', ...staff })).replayed).toBe(true);
      expect(await codeOf(levy.setLevyStatus({ id: owed.id, to: 'VOID', reason: 'Changing my mind afterwards', ...staff }))).toBe('INVALID_LEVY_STATE');
      const log = await prisma.platformActionLog.findFirst({ where: { actionType: 'AJO_LEVY_WAIVED', targetId: owed.id } });
      expect(log).toMatchObject({ actorId: 9001, actorRole: 'FINANCE_ADMIN', reason: 'Goodwill after a billing mistake', associationId: a.id });
      // A waived levy never appears on a checkout.
      expect(await levy.attachLevyToQuote(a.id, quoteOf(800_000)).then((q) => (q as unknown as { levy?: unknown }).levy)).toBeUndefined();
    });

    it('never touches the group’s own ledger: the levy is SocietyLedger’s money, not the group’s', async () => {
      const a = await mkAssociation('ledger');
      const { g } = await running(a, 2);
      expect((await rowsOf(g.id)).length).toBeGreaterThan(0);
      expect(await prisma.ajoLedgerEntry.count({ where: { groupId: g.id } })).toBe(0);
      expect(admin.id).toBeGreaterThan(0);
    });
  });

  async function audits(associationId: number, action: string) {
    return prisma.auditLog.findMany({ where: { associationId, action }, orderBy: { id: 'asc' } });
  }
});
