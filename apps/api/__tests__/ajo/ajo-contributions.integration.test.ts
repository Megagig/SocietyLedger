/**
 * Ajo T4 against a real (disposable) database: recording and confirming contributions, allocation, reversal, bank-transfer proofs and
 * duplicates, the collector's day and the line-by-line reconcile, and receipts.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-contributions --forceExit
 *
 * Only the edges are replaced: the contributor limit, notifications, file storage, the text-message provider and the in-app notification
 * sender. The transactions, locks, constraints, ledger, allocations and audit rows are the real thing. Times are passed in, so nothing
 * depends on today's date.
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
const files = new Map<string, number>();
const sms: Array<{ to: string; text: string }> = [];
const smsMode = { noCredits: false };
const inApp: Array<{ userId: number; kind: string; title: string; message: string; pushType?: string; entityId?: number }> = [];
const inAppMode = { fail: false };

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
  uploadFile: jest.fn(async (key: string, buffer: Buffer) => {
    files.set(key, buffer.length);
    return key;
  }),
  deleteFile: jest.fn(async (key: string) => {
    files.delete(key);
  }),
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
  dispatchNotification: jest.fn(async (o: { userId: number; kind: string; title: string; message: string; pushType?: string; entityId?: number }) => {
    if (inAppMode.fail) throw new Error('push provider is down');
    inApp.push({ userId: o.userId, kind: o.kind, title: o.title, message: o.message, pushType: o.pushType, entityId: o.entityId });
    return { inAppCreated: true, emailSent: false, smsSent: false };
  }),
}));

const suite = TEST_DB ? describe : describe.skip;
// Real transactions against a shared database: under load a test can take longer than Jest's 5 seconds, and a test that times out keeps running into the next.
if (TEST_DB) jest.setTimeout(60000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');
const BEFORE_START = new Date('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const D1 = new Date('2027-03-01T10:00:00Z'); // 11:00 in Lagos on the first due date
const PAY = new Date('2027-03-02T10:00:00Z');
const WEEK2 = new Date('2027-03-09T10:00:00Z');
const AMOUNT = 500_000n; // ₦5,000.00 a week, eight weeks: ₦40,000.00 owed in all
const TOTAL_OWED = 4_000_000n;
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
suite('Ajo contributions, collections and receipts (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let handovers: typeof import('../../src/modules/ajo/ajo-handover.service');
  let receipts: typeof import('../../src/modules/ajo/ajo-receipt.service');
  let ledger: typeof import('../../src/modules/ajo/ajo-ledger.service');

  let A: number;
  let B: number;
  let admin: { id: number };
  let adminB: { id: number };
  let recon1: { id: number };
  let recon2: { id: number };
  let collector: { id: number };
  let collector2: { id: number };
  let reconcilerRoleId: number;
  let counter = 0;

  async function mkAssociation(label: string) {
    const slug = `ajo-c-${label}-${run}`;
    return prisma.association.create({ data: { name: `Ajo C ${label} ${run}`, slug, subdomain: slug } });
  }
  async function mkUser(associationId: number, label: string) {
    return prisma.user.create({ data: { associationId, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
  }
  async function mkMember(associationId: number, over: { withUser?: boolean } = {}) {
    const n = ++counter;
    const user = over.withUser ? await mkUser(associationId, 'member') : null;
    return prisma.member.create({ data: { associationId, userId: user?.id ?? null, memberId: `C${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', address: '12 Market Road, Aba', status: 'active' } });
  }
  async function setReconcilers(userIds: number[]) {
    await prisma.userRole.deleteMany({ where: { associationId: A, roleId: reconcilerRoleId } });
    for (const userId of userIds) await prisma.userRole.create({ data: { userId, roleId: reconcilerRoleId, associationId: A } });
  }

  const key = () => `key-${run}-${++counter}`;
  const proof = (text?: string) => ({ buffer: Buffer.from(text ?? `proof-${run}-${++counter}`), mimeType: 'image/png' });

  async function newGroup(over: Record<string, unknown> = {}) {
    return groups.createGroup({
      associationId: A,
      actorUserId: admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      fields: { name: `Market Circle ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: Number(AMOUNT), startDate: START, cycleLength: 8, maxParticipants: 30, ...over },
    });
  }
  async function join(groupId: number, opts: { withUser?: boolean; approve?: boolean } = {}) {
    const member = await mkMember(A, { withUser: opts.withUser });
    const membership = await members.addMember({ associationId: A, groupId, memberId: member.id, actorUserId: admin.id });
    await consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    if (opts.approve !== false) await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: admin.id, now: NOW });
    return { member, membership };
  }
  /** A running group with `people` active contributors. */
  async function startedGroup(people = 2, opts: { withUser?: boolean } = {}) {
    const g = await newGroup();
    await groups.openGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: NOW });
    const joined = [];
    for (let i = 0; i < people; i++) joined.push(await join(g.id, opts));
    await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: BEFORE_START });
    return { g, joined };
  }
  const assign = (collectorUserId: number, membershipId: number, target?: bigint) =>
    prisma.ajoCollectorAssignment.create({ data: { associationId: A, collectorUserId, membershipId, startsOn: new Date('2027-02-01T00:00:00Z'), dailyTargetKobo: target ?? null, createdBy: admin.id } });

  const cash = (groupId: number, membershipId: number, amount: bigint, over: { collectorId?: number; manage?: boolean; now?: Date; key?: string } = {}) =>
    contrib.recordCash({ associationId: A, groupId, membershipId, amountKobo: amount, idempotencyKey: over.key ?? key(), actorUserId: over.collectorId ?? collector.id, actorCanManage: over.manage ?? false, now: over.now ?? PAY });
  const transfer = (groupId: number, membershipId: number, amount: bigint, over: { actor?: number; manage?: boolean; proof?: { buffer: Buffer; mimeType: string } | null; bankReference?: string; now?: Date; key?: string } = {}) =>
    contrib.reportTransfer({ associationId: A, groupId, membershipId, amountKobo: amount, idempotencyKey: over.key ?? key(), actorUserId: over.actor ?? admin.id, actorCanManage: over.manage ?? true, proof: over.proof === null ? undefined : (over.proof ?? proof()), bankReference: over.bankReference, now: over.now ?? PAY });
  const confirm = (contributionId: number, over: { actor?: number; ack?: boolean; note?: string; own?: boolean; now?: Date } = {}) =>
    contrib.confirmTransfer({ associationId: A, contributionId, actorUserId: over.actor ?? recon1.id, acknowledgeDuplicate: over.ack, note: over.note, confirmOwn: over.own, now: over.now ?? PAY });

  const installments = (membershipId: number) => prisma.ajoInstallment.findMany({ where: { membershipId }, orderBy: { dueDate: 'asc' } });
  const balance = (membershipId: number) => ledger.balanceKobo(prisma as never, { associationId: A, membershipId });
  const entries = (membershipId: number) => prisma.ajoLedgerEntry.findMany({ where: { associationId: A, membershipId }, orderBy: { id: 'asc' } });
  const receiptsOf = (contributionId: number) => prisma.ajoReceipt.findMany({ where: { contributionId }, orderBy: { id: 'asc' } });
  const audits = (action: string, recordId?: number) => prisma.auditLog.findMany({ where: { associationId: A, action, ...(recordId ? { recordId } : {}) } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    handovers = require('../../src/modules/ajo/ajo-handover.service');
    receipts = require('../../src/modules/ajo/ajo-receipt.service');
    ledger = require('../../src/modules/ajo/ajo-ledger.service');
    A = (await mkAssociation('a')).id;
    B = (await mkAssociation('b')).id;
    admin = await mkUser(A, 'admin');
    adminB = await mkUser(B, 'admin-b');
    recon1 = await mkUser(A, 'reconciler');
    recon2 = await mkUser(A, 'reconciler');
    collector = await mkUser(A, 'collector');
    collector2 = await mkUser(A, 'collector');
    const permission = await prisma.permission.upsert({ where: { key: 'ajo.reconcile' }, create: { key: 'ajo.reconcile', description: 'Reconcile Ajo money', module: 'Ajo' }, update: {} });
    const role = await prisma.role.create({ data: { associationId: A, name: `ajo-reconciler-${run}`, displayName: 'Ajo reconciler' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    reconcilerRoleId = role.id;
  });

  beforeEach(async () => {
    smsMode.noCredits = false;
    inAppMode.fail = false;
    sms.length = 0;
    inApp.length = 0;
    notices.length = 0;
    files.clear();
    await setReconcilers([recon1.id, recon2.id]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('confirming a payment (T4.1)', () => {
    it('does not count a reported transfer until an officer confirms it, then pays the oldest instalment and writes one ledger entry', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      const m = joined[0];
      const reported = await transfer(g.id, m.membership.id, AMOUNT, { actor: m.member.userId as number, manage: false });
      expect(reported.contribution).toMatchObject({ status: 'REPORTED', counts: false, awaitingConfirmation: true, amount: '₦5,000.00' });
      expect(await balance(m.membership.id)).toBe(0n);
      expect((await installments(m.membership.id)).every((i) => i.paidKobo === 0n)).toBe(true);
      expect(await entries(m.membership.id)).toHaveLength(0);

      const done = await confirm(reported.contribution.id);
      const insts = await installments(m.membership.id);
      expect(done.replayed).toBe(false);
      expect(done.allocations).toEqual([{ installmentId: insts[0].id, amountKobo: AMOUNT }]);
      expect(insts[0]).toMatchObject({ paidKobo: AMOUNT, status: 'PAID' });
      expect(insts.slice(1).every((i) => i.paidKobo === 0n)).toBe(true);
      expect(await balance(m.membership.id)).toBe(AMOUNT);
      const [entry] = await entries(m.membership.id);
      expect(entry).toMatchObject({ type: 'CONTRIBUTION', direction: 'CREDIT', amountKobo: AMOUNT, refType: 'contribution', refId: reported.contribution.id });

      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reported.contribution.id } });
      expect(row).toMatchObject({ status: 'CONFIRMED', confirmedBy: recon1.id });
      expect(await audits('AJO_CONTRIBUTION_CONFIRMED', row.id)).toHaveLength(1);
    });

    it('spreads a bigger payment across instalments, oldest first, and stores exactly how', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, 1_200_000n);
      await confirm(reported.contribution.id);

      const insts = await installments(mid);
      expect(insts.slice(0, 3).map((i) => [i.paidKobo, i.status])).toEqual([[AMOUNT, 'PAID'], [AMOUNT, 'PAID'], [200_000n, 'PARTIAL']]);
      expect(insts.slice(3).every((i) => i.paidKobo === 0n)).toBe(true);
      const allocations = await prisma.ajoContributionAllocation.findMany({ where: { contributionId: reported.contribution.id }, orderBy: { installmentId: 'asc' } });
      expect(allocations.map((a) => a.amountKobo)).toEqual([AMOUNT, AMOUNT, 200_000n]);
      expect(allocations.reduce((s, a) => s + a.amountKobo, 0n)).toBe(1_200_000n);
      expect(await balance(mid)).toBe(1_200_000n);
    });

    it('pays last week’s arrears before this week, even when the payment is meant for this week', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, AMOUNT, { now: WEEK2 });
      await confirm(reported.contribution.id, { now: WEEK2 });
      const insts = await installments(mid);
      expect(insts[0]).toMatchObject({ paidKobo: AMOUNT, status: 'PAID' }); // 1 March, the oldest
      expect(insts[1].paidKobo).toBe(0n); // 8 March, the one this payment was "for"
    });

    it('refuses a payment bigger than everything still owed, when recording and again when confirming', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      expect(await codeOf(transfer(g.id, mid, TOTAL_OWED + 1n))).toBe('EXCEEDS_OWED');

      // Two reports that each fit on their own but not together: the second fails at confirmation and nothing of it sticks.
      const first = await transfer(g.id, mid, 3_000_000n);
      const second = await transfer(g.id, mid, 3_000_000n);
      await confirm(first.contribution.id);
      expect(await codeOf(confirm(second.contribution.id))).toBe('EXCEEDS_OWED');
      expect((await prisma.ajoContribution.findUniqueOrThrow({ where: { id: second.contribution.id } })).status).toBe('REPORTED');
      expect(await prisma.ajoContributionAllocation.count({ where: { contributionId: second.contribution.id } })).toBe(0);
      expect(await entries(mid)).toHaveLength(1);
      expect(await balance(mid)).toBe(3_000_000n);
    });

    it('is safe to confirm twice, and when two officers confirm at the same moment only one confirmation happens', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, 800_000n);
      const [a, b] = await Promise.all([confirm(reported.contribution.id, { actor: recon1.id }), confirm(reported.contribution.id, { actor: recon2.id })]);
      expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
      expect(await entries(mid)).toHaveLength(1);
      expect(await prisma.ajoContributionAllocation.count({ where: { contributionId: reported.contribution.id } })).toBe(2);
      expect(await balance(mid)).toBe(800_000n);
      const insts = await installments(mid);
      expect(insts[0].paidKobo + insts[1].paidKobo).toBe(800_000n);

      const again = await confirm(reported.contribution.id);
      expect(again.replayed).toBe(true);
      expect(await entries(mid)).toHaveLength(1);
      expect(await audits('AJO_CONTRIBUTION_CONFIRMED', reported.contribution.id)).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('recording is idempotent', () => {
    it('returns the original for a repeated request: one row, one receipt, one notification', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      const m = joined[0];
      await assign(collector.id, m.membership.id);
      const k = key();
      const first = await cash(g.id, m.membership.id, AMOUNT, { key: k });
      const second = await cash(g.id, m.membership.id, AMOUNT, { key: k });
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.contribution.id).toBe(first.contribution.id);
      expect(await prisma.ajoContribution.count({ where: { membershipId: m.membership.id } })).toBe(1);
      expect(await receiptsOf(first.contribution.id)).toHaveLength(1);
      expect(inApp.filter((n) => n.entityId === first.contribution.id)).toHaveLength(1);
      expect(await audits('AJO_CONTRIBUTION_RECORDED', first.contribution.id)).toHaveLength(1);
    });

    it('refuses a key reused for a different payment, a key that is too short, and keeps keys per association', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const k = key();
      await cash(g.id, mid, AMOUNT, { key: k, manage: true });
      expect(await codeOf(cash(g.id, mid, AMOUNT + 1n, { key: k, manage: true }))).toBe('IDEMPOTENCY_CONFLICT');
      expect(await codeOf(cash(g.id, mid, AMOUNT, { key: 'short', manage: true }))).toBe('KEY_REQUIRED');
      expect(await codeOf(cash(g.id, mid, 0n, { manage: true }))).toBe('INVALID_AMOUNT');
      const row = await prisma.ajoContribution.findFirstOrThrow({ where: { membershipId: mid } });
      expect(row.idempotencyKey).toBe(`a${A}:${k}`);
    });

    it('records once when the same request arrives twice at the same moment', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const k = key();
      const [a, b] = await Promise.all([cash(g.id, mid, AMOUNT, { key: k, manage: true }), cash(g.id, mid, AMOUNT, { key: k, manage: true })]);
      expect(a.contribution.id).toBe(b.contribution.id);
      expect(await prisma.ajoContribution.count({ where: { membershipId: mid } })).toBe(1);
      expect(await receiptsOf(a.contribution.id)).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('reversing and rejecting (T4.1)', () => {
    it('reverses a confirmed payment with a reason: the instalments, the ledger and the record all show it, and nothing is edited', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, 1_200_000n);
      await confirm(reported.contribution.id);

      expect(await codeOf(contrib.reverseContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'too short', now: PAY }))).toBe('REASON_REQUIRED');
      const reversed = await contrib.reverseContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'Recorded against the wrong person', now: PAY });
      expect(reversed.replayed).toBe(false);

      const insts = await installments(mid);
      expect(insts.slice(0, 3).map((i) => [i.paidKobo, i.status])).toEqual([[0n, 'OVERDUE'], [0n, 'DUE'], [0n, 'DUE']]);
      expect(await balance(mid)).toBe(0n);
      const [credit, reversal] = await entries(mid);
      expect(credit).toMatchObject({ type: 'CONTRIBUTION', direction: 'CREDIT' });
      expect(reversal).toMatchObject({ type: 'REVERSAL', direction: 'DEBIT', amountKobo: 1_200_000n, reversalOfId: credit.id, reason: 'Recorded against the wrong person' });

      const original = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reported.contribution.id } });
      expect(original.status).toBe('CONFIRMED'); // the original is never edited
      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reversed.reversalId } });
      expect(row).toMatchObject({ status: 'REVERSED', reversalOfId: original.id, amountKobo: 1_200_000n, reason: 'Recorded against the wrong person' });
      expect(await prisma.ajoContributionAllocation.count({ where: { contributionId: original.id } })).toBe(3); // the split stays on record
      expect(await audits('AJO_CONTRIBUTION_REVERSED', original.id)).toHaveLength(1);

      const view = (await contrib.listMembershipContributions({ associationId: A, membershipId: mid, officer: true })).find((c) => c.id === original.id);
      expect(view).toMatchObject({ reversed: true, counts: false, reversalReason: 'Recorded against the wrong person' });
    });

    it('reverses only once, never a reversal, never something unconfirmed', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const pending = await transfer(g.id, mid, AMOUNT);
      expect(await codeOf(contrib.reverseContribution({ associationId: A, contributionId: pending.contribution.id, actorUserId: recon1.id, reason: 'Trying to undo a pending one', now: PAY }))).toBe('NOT_CONFIRMED');

      await confirm(pending.contribution.id);
      const first = await contrib.reverseContribution({ associationId: A, contributionId: pending.contribution.id, actorUserId: recon1.id, reason: 'Recorded against the wrong person', now: PAY });
      const again = await contrib.reverseContribution({ associationId: A, contributionId: pending.contribution.id, actorUserId: recon2.id, reason: 'Recorded against the wrong person', now: PAY });
      expect(again).toMatchObject({ replayed: true, reversalId: first.reversalId });
      expect(await entries(mid)).toHaveLength(2);
      expect(await codeOf(contrib.reverseContribution({ associationId: A, contributionId: first.reversalId, actorUserId: recon1.id, reason: 'Reversing the reversal', now: PAY }))).toBe('CANNOT_REVERSE_A_REVERSAL');
      expect(await balance(mid)).toBe(0n);
    });

    it('undoes exactly what that payment paid and leaves the others alone', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const a = await transfer(g.id, mid, AMOUNT);
      const b = await transfer(g.id, mid, AMOUNT);
      await confirm(a.contribution.id);
      await confirm(b.contribution.id);
      await contrib.reverseContribution({ associationId: A, contributionId: a.contribution.id, actorUserId: recon1.id, reason: 'Entered twice by mistake', now: PAY });

      const insts = await installments(mid);
      expect(insts[0].paidKobo).toBe(0n);
      expect(insts[1]).toMatchObject({ paidKobo: AMOUNT, status: 'PAID' });
      expect(await balance(mid)).toBe(AMOUNT);
    });

    it('rejects a report that was never confirmed: it never counted, it keeps its reason, and the contributor is told', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, AMOUNT);
      expect(await codeOf(contrib.rejectContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'no' }))).toBe('REASON_REQUIRED');

      const rejected = await contrib.rejectContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'The bank statement shows ₦4,000.00, not ₦5,000.00', now: PAY });
      expect(rejected.replayed).toBe(false);
      expect(await contrib.rejectContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon2.id, reason: 'Something else entirely, ignored', now: PAY })).toMatchObject({ replayed: true });

      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reported.contribution.id } });
      expect(row).toMatchObject({ status: 'REJECTED', reason: 'The bank statement shows ₦4,000.00, not ₦5,000.00', rejectedBy: recon1.id });
      expect(await balance(mid)).toBe(0n);
      expect(await entries(mid)).toHaveLength(0);
      expect(await confirmCode(reported.contribution.id)).toBe('CONTRIBUTION_NOT_CONFIRMABLE');
      const rs = await receiptsOf(reported.contribution.id);
      expect(rs.map((r) => r.moment).sort()).toEqual(['RECORDED', 'REJECTED']);
      expect(rs.find((r) => r.moment === 'REJECTED')?.message).toContain('The bank statement shows ₦4,000.00');
      expect(await audits('AJO_CONTRIBUTION_REJECTED', row.id)).toHaveLength(1);
    });

    it('will not reject a confirmed payment: that is reversed instead', async () => {
      const { g, joined } = await startedGroup(1);
      const reported = await transfer(g.id, joined[0].membership.id, AMOUNT);
      await confirm(reported.contribution.id);
      expect(await codeOf(contrib.rejectContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'Changed my mind about this one' }))).toBe('CONTRIBUTION_NOT_REJECTABLE');
    });

    async function confirmCode(contributionId: number) {
      return codeOf(confirm(contributionId));
    }
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('who and when', () => {
    it('keeps out a person who is not active yet, a group that has not started, and a closed group', async () => {
      const g = await newGroup();
      await groups.openGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: NOW });
      const waiting = await join(g.id, { approve: false });
      const early = await join(g.id);
      expect(await codeOf(cash(g.id, early.membership.id, AMOUNT, { manage: true }))).toBe('GROUP_NOT_STARTED');
      expect(await codeOf(transfer(g.id, early.membership.id, AMOUNT))).toBe('GROUP_NOT_STARTED');

      await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: BEFORE_START });
      expect(await codeOf(cash(g.id, waiting.membership.id, AMOUNT, { manage: true }))).toBe('MEMBERSHIP_NOT_ACTIVE');

      const closed = await newGroup();
      await groups.cancelGroup({ associationId: A, groupId: closed.id, actorUserId: admin.id, reason: 'Not enough people signed up', now: NOW });
      expect(await codeOf(cash(closed.id, early.membership.id, AMOUNT, { manage: true }))).toBe('GROUP_CLOSED');
    });

    it('treats another association’s group, payment and handover as missing, for every action', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, AMOUNT, { proof: proof() });
      const asB = { associationId: B, actorUserId: adminB.id };

      expect(await codeOf(contrib.recordCash({ ...asB, groupId: g.id, membershipId: mid, amountKobo: AMOUNT, idempotencyKey: key(), actorCanManage: true, now: PAY }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(contrib.reportTransfer({ ...asB, groupId: g.id, membershipId: mid, amountKobo: AMOUNT, idempotencyKey: key(), actorCanManage: true, proof: proof(), now: PAY }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(contrib.confirmTransfer({ ...asB, contributionId: reported.contribution.id, now: PAY }))).toBe('CONTRIBUTION_NOT_FOUND');
      expect(await codeOf(contrib.rejectContribution({ ...asB, contributionId: reported.contribution.id, reason: 'Trying across tenants' }))).toBe('CONTRIBUTION_NOT_FOUND');
      expect(await codeOf(contrib.reverseContribution({ ...asB, contributionId: reported.contribution.id, reason: 'Trying across tenants', now: PAY }))).toBe('CONTRIBUTION_NOT_FOUND');
      expect(await codeOf(contrib.getProofLink({ associationId: B, contributionId: reported.contribution.id, viewerUserId: adminB.id, viewerIsOfficer: true }))).toBe('CONTRIBUTION_NOT_FOUND');
      expect(await codeOf(contrib.listMembershipContributions({ associationId: B, membershipId: mid, officer: true }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(contrib.listGroupContributions({ associationId: B, groupId: g.id }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(handovers.collectorDaySummary({ associationId: B, groupId: g.id, collectorUserId: adminB.id, now: PAY }))).toBe('GROUP_NOT_FOUND');
      expect((await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reported.contribution.id } })).status).toBe('REPORTED');
    });

    it('lets a contributor report only their own transfer, and an officer report one for anyone', async () => {
      const { g, joined } = await startedGroup(2, { withUser: true });
      const [mine, theirs] = joined;
      expect(await codeOf(transfer(g.id, theirs.membership.id, AMOUNT, { actor: mine.member.userId as number, manage: false }))).toBe('MEMBERSHIP_NOT_FOUND');
      await expect(transfer(g.id, mine.membership.id, AMOUNT, { actor: mine.member.userId as number, manage: false })).resolves.toBeTruthy();
      const onBehalf = await transfer(g.id, theirs.membership.id, AMOUNT, { actor: admin.id, manage: true });
      expect((await prisma.ajoContribution.findUniqueOrThrow({ where: { id: onBehalf.contribution.id } })).recordedBy).toBe(admin.id);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('bank transfers, proofs and duplicates (T4.3)', () => {
    it('needs a proof or a bank reference, stores the proof without ever sending its storage key out, and only for a real picture or PDF', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      const m = joined[0];
      const own = { actor: m.member.userId as number, manage: false };
      expect(await codeOf(transfer(g.id, m.membership.id, AMOUNT, { ...own, proof: null }))).toBe('PROOF_REQUIRED');
      expect(await codeOf(transfer(g.id, m.membership.id, AMOUNT, { ...own, proof: { buffer: Buffer.from('hello'), mimeType: 'text/plain' } }))).toBe('INVALID_PROOF');
      expect(await codeOf(transfer(g.id, m.membership.id, AMOUNT, { ...own, proof: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), mimeType: 'image/png' } }))).toBe('INVALID_PROOF');
      expect(await codeOf(transfer(g.id, m.membership.id, TOTAL_OWED + 1n, { ...own }))).toBe('EXCEEDS_OWED');
      expect(files.size).toBe(0); // nothing was stored for any of the refusals

      const bytes = Buffer.from(`screenshot-${run}`);
      const ok = await transfer(g.id, m.membership.id, AMOUNT, { ...own, proof: { buffer: bytes, mimeType: 'image/png' } });
      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: ok.contribution.id } });
      expect(row.proofKey).toMatch(new RegExp(`^ajo/proofs/${A}/${g.id}/.+\\.png$`));
      expect(files.has(row.proofKey as string)).toBe(true);
      expect(row.proofHash).toBe(require('../../src/modules/ajo/ajo-collections').hashProof(bytes));
      expect(JSON.stringify(ok)).not.toContain(row.proofKey as string);
      expect(JSON.stringify(ok)).not.toContain(row.proofHash as string);

      // A bank reference alone is enough when there is no file.
      const refOnly = await transfer(g.id, m.membership.id, AMOUNT, { ...own, proof: null, bankReference: 'TRF-20270302-884213' });
      expect(refOnly.contribution.status).toBe('REPORTED');
    });

    it('gives a short-lived link to the proof to the person who paid and to officers, and to nobody else', async () => {
      const { g, joined } = await startedGroup(2, { withUser: true });
      const [a, b] = joined;
      const reported = await transfer(g.id, a.membership.id, AMOUNT, { actor: a.member.userId as number, manage: false });
      const base = { associationId: A, contributionId: reported.contribution.id };
      expect((await contrib.getProofLink({ ...base, viewerUserId: a.member.userId as number, viewerIsOfficer: false })).url).toMatch(/^https:\/\/files\.test\/ajo\/proofs\//);
      expect((await contrib.getProofLink({ ...base, viewerUserId: admin.id, viewerIsOfficer: true })).url).toBeTruthy();
      expect(await codeOf(contrib.getProofLink({ ...base, viewerUserId: b.member.userId as number, viewerIsOfficer: false }))).toBe('CONTRIBUTION_NOT_FOUND');
      const noProof = await transfer(g.id, a.membership.id, AMOUNT, { proof: null, bankReference: 'TRF-ONLY-REF-1' });
      expect(await codeOf(contrib.getProofLink({ associationId: A, contributionId: noProof.contribution.id, viewerUserId: admin.id, viewerIsOfficer: true }))).toBe('NO_PROOF');
    });

    it('flags the same proof file used twice, and then refuses to confirm it if the first one stands', async () => {
      const { g, joined } = await startedGroup(2);
      const [a, b] = joined;
      const shared = Buffer.from(`same-screenshot-${run}`);
      const first = await transfer(g.id, a.membership.id, AMOUNT, { proof: { buffer: shared, mimeType: 'image/png' } });
      expect(first.possibleDuplicate).toBe(false);
      const second = await transfer(g.id, b.membership.id, AMOUNT, { proof: { buffer: shared, mimeType: 'image/png' } });
      expect(second.possibleDuplicate).toBe(true);
      expect(second.contribution.possibleDuplicateOf).toBe(first.contribution.id);

      // While its twin is still waiting, even the first needs the officer to say they checked the statement.
      expect(await codeOf(confirm(first.contribution.id))).toBe('DUPLICATE_ACK_REQUIRED');
      await confirm(first.contribution.id, { ack: true, note: 'Checked the statement: this is the real payment' });
      expect(await codeOf(confirm(second.contribution.id, { ack: true, note: 'It is a different payment, I checked' }))).toBe('DUPLICATE_PROOF');
      expect((await prisma.ajoContribution.findUniqueOrThrow({ where: { id: second.contribution.id } })).status).toBe('REPORTED');

      // Once the first is reversed it no longer stands behind its proof, so the second can be confirmed.
      await contrib.reverseContribution({ associationId: A, contributionId: first.contribution.id, actorUserId: recon1.id, reason: 'It was entered against the wrong person', now: PAY });
      await expect(confirm(second.contribution.id)).resolves.toMatchObject({ replayed: false });
    });

    it('needs an acknowledgement and a note to confirm a flagged duplicate that is not confirmed yet, and records it', async () => {
      const { g, joined } = await startedGroup(2);
      const [a, b] = joined;
      const first = await transfer(g.id, a.membership.id, AMOUNT, { proof: null, bankReference: 'TRF 998-877' });
      const second = await transfer(g.id, b.membership.id, AMOUNT, { proof: null, bankReference: 'trf998877' }); // the same reference, written differently
      expect(second.possibleDuplicate).toBe(true);

      expect(await codeOf(confirm(second.contribution.id))).toBe('DUPLICATE_ACK_REQUIRED');
      expect(await codeOf(confirm(second.contribution.id, { ack: true }))).toBe('DUPLICATE_ACK_REQUIRED');
      const done = await confirm(second.contribution.id, { ack: true, note: 'Two members paid with the same bank app, different times' });
      expect(done).toMatchObject({ replayed: false, duplicateAcknowledged: true });
      expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: second.contribution.id } })).toMatchObject({ duplicateAckBy: recon1.id, duplicateAckNote: 'Two members paid with the same bank app, different times' });
      // The first one now has a confirmed twin, so it can no longer be confirmed at all.
      expect(await codeOf(confirm(first.contribution.id, { ack: true, note: 'Checked the statement again' }))).toBe('DUPLICATE_PROOF');
    });

    it('does not let the officer who recorded a payment for someone confirm it, unless they are the only reconciler and say so', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const reported = await transfer(g.id, mid, AMOUNT, { actor: recon1.id, manage: true });

      // Two reconcilers: the other one must confirm.
      expect(await codeOf(confirm(reported.contribution.id, { actor: recon1.id }))).toBe('SELF_CONFIRM_NOT_ALLOWED');
      expect(await codeOf(confirm(reported.contribution.id, { actor: recon1.id, own: true, note: 'I checked the statement myself' }))).toBe('SELF_CONFIRM_NOT_ALLOWED');

      // Only one reconciler: allowed, but only with an explicit "confirm my own" and a note.
      await setReconcilers([recon1.id]);
      expect(await codeOf(confirm(reported.contribution.id, { actor: recon1.id }))).toBe('SELF_CONFIRM_NEEDS_NOTE');
      expect(await codeOf(confirm(reported.contribution.id, { actor: recon1.id, own: true }))).toBe('SELF_CONFIRM_NEEDS_NOTE');
      await confirm(reported.contribution.id, { actor: recon1.id, own: true, note: 'I checked the statement myself' });
      expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: reported.contribution.id } })).toMatchObject({ status: 'CONFIRMED', selfConfirmed: true, confirmNote: 'I checked the statement myself' });

      // Someone who is not a reconciler at all cannot use the exception.
      const other = await transfer(g.id, mid, AMOUNT, { actor: admin.id, manage: true });
      expect(await codeOf(confirm(other.contribution.id, { actor: admin.id, own: true, note: 'I checked the statement myself' }))).toBe('SELF_CONFIRM_NOT_ALLOWED');
    });

    it('lets any other officer confirm a contributor’s own report, but not the contributor if they hold the permission too', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      const m = joined[0];
      const reported = await transfer(g.id, m.membership.id, AMOUNT, { actor: m.member.userId as number, manage: false });
      await setReconcilers([recon1.id, recon2.id, m.member.userId as number]);
      expect(await codeOf(confirm(reported.contribution.id, { actor: m.member.userId as number }))).toBe('SELF_CONFIRM_NOT_ALLOWED');
      await expect(confirm(reported.contribution.id, { actor: recon2.id })).resolves.toMatchObject({ replayed: false });
    });

    it('will not confirm cash through the transfer route', async () => {
      const { g, joined } = await startedGroup(1);
      await assign(collector.id, joined[0].membership.id);
      const c = await cash(g.id, joined[0].membership.id, AMOUNT);
      expect(await codeOf(confirm(c.contribution.id))).toBe('USE_HANDOVER');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('cash and the collector’s day (T4.2)', () => {
    it('lets a collector record cash only for the people assigned to them, and an officer for anyone', async () => {
      const { g, joined } = await startedGroup(2);
      const [mine, other] = joined;
      await assign(collector.id, mine.membership.id);
      expect(await codeOf(cash(g.id, other.membership.id, AMOUNT))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(cash(g.id, mine.membership.id, AMOUNT, { collectorId: collector2.id }))).toBe('MEMBERSHIP_NOT_FOUND');

      const ok = await cash(g.id, mine.membership.id, AMOUNT);
      expect(ok.contribution).toMatchObject({ status: 'CASH_RECEIVED', method: 'CASH', counts: false, awaitingConfirmation: true, collectorUserId: collector.id });
      expect(ok.contribution.reference).toMatch(/^AJO-270302-[A-Z2-9]{8}$/);
      await expect(cash(g.id, other.membership.id, AMOUNT, { manage: true })).resolves.toBeTruthy();
    });

    it('never counts cash before the handover is reconciled', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      await assign(collector.id, mid);
      await cash(g.id, mid, AMOUNT);
      expect(await balance(mid)).toBe(0n);
      expect((await installments(mid)).every((i) => i.paidKobo === 0n)).toBe(true);
    });

    it('counts a payment taken after the cutoff time toward the next business day', async () => {
      const { g, joined } = await startedGroup(1);
      await assign(collector.id, joined[0].membership.id);
      const late = await cash(g.id, joined[0].membership.id, AMOUNT, { now: new Date('2027-03-02T17:30:00Z') }); // 18:30 in Lagos
      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: late.contribution.id } });
      expect(iso(row.businessDate as Date)).toBe('2027-03-03');
    });

    it('summarises the collector’s day: expected, target, collected and in hand, with arrears kept apart', async () => {
      const { g, joined } = await startedGroup(3);
      const [m1, m2, m3] = joined;
      await assign(collector.id, m1.membership.id, 100_000n);
      await assign(collector.id, m2.membership.id, 150_000n);
      await assign(collector2.id, m3.membership.id);
      await cash(g.id, m1.membership.id, AMOUNT, { now: D1 });
      await cash(g.id, m2.membership.id, 200_000n, { now: D1 });

      const day = await handovers.collectorDaySummary({ associationId: A, groupId: g.id, collectorUserId: collector.id, forDate: new Date('2027-03-01T00:00:00Z'), now: D1 });
      expect(day).toMatchObject({ contributors: 2, expectedKobo: '1000000', targetKobo: '250000', collectedKobo: '700000', inHandKobo: '700000', handedOverKobo: '0', differenceKobo: '700000', handover: null });
      expect(day.arrears).toEqual([]);
      expect(day.payments.map((p) => p.amountKobo)).toEqual(['500000', '200000']);

      const other = await handovers.collectorDaySummary({ associationId: A, groupId: g.id, collectorUserId: collector2.id, forDate: new Date('2027-03-01T00:00:00Z'), now: D1 });
      expect(other).toMatchObject({ contributors: 1, expectedKobo: '500000', collectedKobo: '0' });

      // A week later the first week's instalments are arrears. Unreconciled cash does not count, so they are still owed.
      const later = await handovers.collectorDaySummary({ associationId: A, groupId: g.id, collectorUserId: collector.id, forDate: new Date('2027-03-08T00:00:00Z'), now: WEEK2 });
      expect(later.expectedKobo).toBe('1000000'); // only the instalments due on 8 March
      expect(later.arrears.map((a) => a.overdueKobo)).toEqual(['500000', '500000']);
      expect(later.arrears[0].overdue).toBe('₦5,000.00');
    });

    it('hands over once a day with the figures frozen, closes the day to more cash, and refuses nonsense', async () => {
      const { g, joined } = await startedGroup(2);
      const [m1, m2] = joined;
      await assign(collector.id, m1.membership.id, 100_000n);
      await assign(collector.id, m2.membership.id, 150_000n);
      await cash(g.id, m1.membership.id, AMOUNT, { now: D1 });
      await cash(g.id, m2.membership.id, 300_000n, { now: D1 });
      const base = { associationId: A, groupId: g.id, collectorUserId: collector.id, now: new Date('2027-03-01T15:00:00Z') };

      expect(await codeOf(handovers.createHandover({ ...base, handedOverKobo: 800_001n, idempotencyKey: key() }))).toBe('INVALID_AMOUNT');
      expect(await codeOf(handovers.createHandover({ ...base, handedOverKobo: 800_000n, idempotencyKey: 'short' }))).toBe('KEY_REQUIRED');
      expect(await codeOf(handovers.createHandover({ ...base, handedOverKobo: 800_000n, idempotencyKey: key(), forDate: new Date('2027-03-05T00:00:00Z') }))).toBe('INVALID_DATE');
      expect(await codeOf(handovers.createHandover({ ...base, collectorUserId: collector2.id, handedOverKobo: 0n, idempotencyKey: key() }))).toBe('NOTHING_TO_HAND_OVER');

      const k = key();
      const made = await handovers.createHandover({ ...base, handedOverKobo: 600_000n, idempotencyKey: k, note: 'Kept ₦2,000.00 for the bus fare' });
      expect(made).toMatchObject({ replayed: false, collectedKobo: '800000', handedOverKobo: '600000', differenceKobo: '200000', payments: 2 });
      const stored = await prisma.ajoCashHandover.findUniqueOrThrow({ where: { id: made.handoverId } });
      expect(stored).toMatchObject({ expectedKobo: 1_000_000n, targetKobo: 250_000n, collectedKobo: 800_000n, handedOverKobo: 600_000n, differenceKobo: 200_000n, reconciledAt: null });
      expect(await prisma.ajoContribution.count({ where: { handoverId: made.handoverId } })).toBe(2);

      expect(await handovers.createHandover({ ...base, handedOverKobo: 600_000n, idempotencyKey: k, note: 'Kept ₦2,000.00 for the bus fare' })).toMatchObject({ replayed: true, handoverId: made.handoverId });
      expect(await codeOf(handovers.createHandover({ ...base, handedOverKobo: 700_000n, idempotencyKey: k }))).toBe('IDEMPOTENCY_CONFLICT');
      expect(await codeOf(handovers.createHandover({ ...base, handedOverKobo: 600_000n, idempotencyKey: key() }))).toBe('ALREADY_HANDED_OVER');
      // The day is closed to this collector.
      expect(await codeOf(cash(g.id, m1.membership.id, 100_000n, { now: new Date('2027-03-01T16:00:00Z') }))).toBe('HANDOVER_CLOSED');
      expect(await audits('AJO_HANDOVER_CREATED', made.handoverId)).toHaveLength(1);

      const view = await handovers.getHandover({ associationId: A, handoverId: made.handoverId });
      expect(view).toMatchObject({ reconciled: false, collectedKobo: '800000', targetKobo: '250000' });
      expect(view.payments).toHaveLength(2);
    });

    it('lets a day’s second handover happen once the first has been made for another day, and not before', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      await assign(collector.id, mid);
      await cash(g.id, mid, AMOUNT, { now: D1 });
      await handovers.createHandover({ associationId: A, groupId: g.id, collectorUserId: collector.id, handedOverKobo: AMOUNT, idempotencyKey: key(), now: new Date('2027-03-01T15:00:00Z') });
      // The next business day is a new day with a new handover.
      await cash(g.id, mid, 100_000n, { now: PAY });
      await expect(handovers.createHandover({ associationId: A, groupId: g.id, collectorUserId: collector.id, handedOverKobo: 100_000n, idempotencyKey: key(), now: new Date('2027-03-02T15:00:00Z') })).resolves.toMatchObject({ replayed: false });
      expect(await prisma.ajoCashHandover.count({ where: { groupId: g.id, collectorUserId: collector.id } })).toBe(2);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('reconciling a handover line by line (T4.2)', () => {
    /** Three people, one collector, cash taken and handed over for 1 March. */
    async function dayWithCash(amounts: bigint[] = [500_000n, 300_000n, 200_000n], handedOver?: bigint) {
      const { g, joined } = await startedGroup(amounts.length);
      const recorded = [];
      for (let i = 0; i < amounts.length; i++) {
        await assign(collector.id, joined[i].membership.id);
        recorded.push((await cash(g.id, joined[i].membership.id, amounts[i], { now: D1 })).contribution);
      }
      const total = amounts.reduce((s, a) => s + a, 0n);
      const handover = await handovers.createHandover({ associationId: A, groupId: g.id, collectorUserId: collector.id, handedOverKobo: handedOver ?? total, idempotencyKey: key(), now: new Date('2027-03-01T15:00:00Z') });
      return { g, joined, recorded, handover, total };
    }
    const reconcile = (handoverId: number, over: { counted: bigint; ticked?: number[]; note?: string; actor?: number; own?: boolean }) =>
      handovers.reconcileHandover({ associationId: A, handoverId, actorUserId: over.actor ?? recon1.id, countedKobo: over.counted, receivedContributionIds: over.ticked, note: over.note, confirmOwn: over.own, now: new Date('2027-03-01T17:00:00Z') });

    it('confirms every line when the count agrees: instalments paid, ledger written, handover closed', async () => {
      const { joined, recorded, handover, total } = await dayWithCash();
      const done = await reconcile(handover.handoverId, { counted: total });
      expect(done).toMatchObject({ replayed: false, confirmed: 3, missing: 0 });

      for (let i = 0; i < 3; i++) {
        const insts = await installments(joined[i].membership.id);
        expect(insts[0].paidKobo).toBe(BigInt(recorded[i].amountKobo));
        expect(await balance(joined[i].membership.id)).toBe(BigInt(recorded[i].amountKobo));
        expect(await entries(joined[i].membership.id)).toHaveLength(1);
      }
      expect(await prisma.ajoContribution.count({ where: { handoverId: handover.handoverId, status: 'CONFIRMED' } })).toBe(3);
      expect(await prisma.ajoCashHandover.findUniqueOrThrow({ where: { id: handover.handoverId } })).toMatchObject({ reconciledBy: recon1.id, countedKobo: total });
      expect(await audits('AJO_HANDOVER_RECONCILED', handover.handoverId)).toHaveLength(1);

      // Reconciling again, even by another officer, changes nothing.
      const again = await reconcile(handover.handoverId, { counted: total, actor: recon2.id });
      expect(again.replayed).toBe(true);
      for (const j of joined) expect(await entries(j.membership.id)).toHaveLength(1);
    });

    it('refuses a count that does not match the ticked lines, and changes nothing', async () => {
      const { recorded, handover, total } = await dayWithCash();
      expect(await codeOf(reconcile(handover.handoverId, { counted: total - 100_000n }))).toBe('COUNT_MISMATCH');
      expect(await codeOf(reconcile(handover.handoverId, { counted: total, ticked: [recorded[0].id, recorded[1].id], note: 'The last one was not handed in' }))).toBe('COUNT_MISMATCH');
      expect(await codeOf(reconcile(handover.handoverId, { counted: 500_000n, ticked: [recorded[0].id, 999_999_999] }))).toBe('LINE_NOT_IN_HANDOVER');
      expect(await prisma.ajoCashHandover.findUniqueOrThrow({ where: { id: handover.handoverId } })).toMatchObject({ reconciledAt: null });
      expect(await prisma.ajoContribution.count({ where: { handoverId: handover.handoverId, status: 'CASH_RECEIVED' } })).toBe(3);
      expect(await prisma.ajoLedgerEntry.count({ where: { associationId: A, refType: 'contribution', refId: { in: recorded.map((r) => r.id) } } })).toBe(0);
    });

    it('confirms the lines received and leaves a missing one flagged, uncounted, with a note and a message to the contributor', async () => {
      const { joined, recorded, handover } = await dayWithCash([500_000n, 300_000n, 200_000n], 800_000n);
      expect(await codeOf(reconcile(handover.handoverId, { counted: 800_000n, ticked: [recorded[0].id, recorded[1].id] }))).toBe('NOTE_REQUIRED');

      const done = await reconcile(handover.handoverId, { counted: 800_000n, ticked: [recorded[0].id, recorded[1].id], note: 'The ₦2,000.00 from the third person was not in the envelope' });
      expect(done).toMatchObject({ confirmed: 2, missing: 1, confirmedKobo: '800000', missingKobo: '200000' });

      const missing = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: recorded[2].id } });
      expect(missing).toMatchObject({ status: 'CASH_RECEIVED', missingFromHandover: true });
      expect((await installments(joined[2].membership.id)).every((i) => i.paidKobo === 0n)).toBe(true); // does not count
      expect(await balance(joined[2].membership.id)).toBe(0n);
      expect(await balance(joined[0].membership.id)).toBe(500_000n);

      // The contributor can prove they paid: a text tells them it has not reached the group yet.
      expect((await receiptsOf(recorded[2].id)).map((r) => r.moment).sort()).toEqual(['MISSING', 'RECORDED']);
      expect(sms.some((s) => s.text.includes('Keep this message as proof') && s.text.includes('₦2,000.00'))).toBe(true);
      const view = (await contrib.listMembershipContributions({ associationId: A, membershipId: joined[2].membership.id, officer: false }))[0];
      expect(view).toMatchObject({ missingFromHandover: true, counts: false, awaitingConfirmation: true });
    });

    it('carries a missing payment into the next handover, where it can be reconciled', async () => {
      const { g, joined, recorded, handover } = await dayWithCash([500_000n, 200_000n], 500_000n);
      await reconcile(handover.handoverId, { counted: 500_000n, ticked: [recorded[0].id], note: 'The second payment was not handed in' });

      const next = await handovers.createHandover({ associationId: A, groupId: g.id, collectorUserId: collector.id, handedOverKobo: 200_000n, idempotencyKey: key(), now: new Date('2027-03-02T15:00:00Z') });
      expect(next).toMatchObject({ collectedKobo: '200000', differenceKobo: '0', payments: 1 });
      expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: recorded[1].id } })).toMatchObject({ handoverId: next.handoverId, missingFromHandover: false, status: 'CASH_RECEIVED' });

      await handovers.reconcileHandover({ associationId: A, handoverId: next.handoverId, actorUserId: recon1.id, countedKobo: 200_000n, now: PAY });
      expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: recorded[1].id } })).toMatchObject({ status: 'CONFIRMED' });
      expect(await balance(joined[1].membership.id)).toBe(200_000n);
    });

    it('lets the officer reject a missing payment with a reason, and it never counts', async () => {
      const { joined, recorded, handover } = await dayWithCash([500_000n, 200_000n], 500_000n);
      await reconcile(handover.handoverId, { counted: 500_000n, ticked: [recorded[0].id], note: 'The second payment was not handed in' });
      const rejected = await contrib.rejectContribution({ associationId: A, contributionId: recorded[1].id, actorUserId: recon1.id, reason: 'The collector confirmed the cash was never received' });
      expect(rejected.replayed).toBe(false);
      expect(await balance(joined[1].membership.id)).toBe(0n);
      expect((await receiptsOf(recorded[1].id)).map((r) => r.moment).sort()).toEqual(['MISSING', 'RECORDED', 'REJECTED']);
    });

    it('needs a note when the count differs from what the collector said they handed over', async () => {
      const { handover, recorded } = await dayWithCash([500_000n, 300_000n], 800_000n);
      // The collector said 800,000. The officer counts 500,000, so only the first line was received.
      expect(await codeOf(reconcile(handover.handoverId, { counted: 500_000n, ticked: [recorded[0].id] }))).toBe('NOTE_REQUIRED');
    });

    it('lets the whole day fail together if one line cannot be applied, and succeed once that line is unticked', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      await assign(collector.id, mid);
      const first = (await cash(g.id, mid, 3_000_000n, { now: D1 })).contribution;
      const second = (await cash(g.id, mid, 3_000_000n, { now: D1 })).contribution; // each fits alone, the two do not
      const h = await handovers.createHandover({ associationId: A, groupId: g.id, collectorUserId: collector.id, handedOverKobo: 6_000_000n, idempotencyKey: key(), now: new Date('2027-03-01T15:00:00Z') });

      let failure = '';
      try {
        await reconcile(h.handoverId, { counted: 6_000_000n });
      } catch (error) {
        failure = (error as Error).message;
        expect((error as { code?: string }).code).toBe('EXCEEDS_OWED');
      }
      expect(failure).toContain(second.reference);
      expect(await entries(mid)).toHaveLength(0);
      expect(await prisma.ajoContribution.count({ where: { handoverId: h.handoverId, status: 'CASH_RECEIVED' } })).toBe(2);
      expect((await prisma.ajoCashHandover.findUniqueOrThrow({ where: { id: h.handoverId } })).reconciledAt).toBeNull();

      await reconcile(h.handoverId, { counted: 3_000_000n, ticked: [first.id], note: 'Second payment looks like a duplicate entry' });
      expect(await balance(mid)).toBe(3_000_000n);
    });

    it('does not let a collector reconcile their own cash, unless they are the only reconciler and say so', async () => {
      const { recorded, handover, total } = await dayWithCash();
      await setReconcilers([recon1.id, collector.id]);
      expect(await codeOf(reconcile(handover.handoverId, { counted: total, actor: collector.id }))).toBe('SELF_CONFIRM_NOT_ALLOWED');

      await setReconcilers([collector.id]);
      expect(await codeOf(reconcile(handover.handoverId, { counted: total, actor: collector.id }))).toBe('SELF_CONFIRM_NEEDS_NOTE');
      await reconcile(handover.handoverId, { counted: total, actor: collector.id, own: true, note: 'Counted it in front of the group secretary' });
      const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: recorded[0].id } });
      expect(row).toMatchObject({ status: 'CONFIRMED', selfConfirmed: true });
    });

    it('lists handovers for the officers, open or reconciled', async () => {
      const { g, handover, total } = await dayWithCash();
      expect((await handovers.listHandovers({ associationId: A, groupId: g.id, reconciled: false })).map((h) => h.id)).toEqual([handover.handoverId]);
      await reconcile(handover.handoverId, { counted: total });
      expect(await handovers.listHandovers({ associationId: A, groupId: g.id, reconciled: false })).toEqual([]);
      expect((await handovers.listHandovers({ associationId: A, groupId: g.id, reconciled: true }))[0]).toMatchObject({ id: handover.handoverId, reconciled: true, countedKobo: total.toString() });
      expect(await codeOf(handovers.getHandover({ associationId: B, handoverId: handover.handoverId }))).toBe('HANDOVER_NOT_FOUND');
      expect(await codeOf(handovers.reconcileHandover({ associationId: B, handoverId: handover.handoverId, actorUserId: adminB.id, countedKobo: total }))).toBe('HANDOVER_NOT_FOUND');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('receipts (T4.4)', () => {
    it('sends exactly one receipt per moment, in plain words with the amount in full and the reference', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      const m = joined[0];
      const reported = await transfer(g.id, m.membership.id, AMOUNT, { actor: m.member.userId as number, manage: false });
      await confirm(reported.contribution.id);
      await confirm(reported.contribution.id); // a repeat
      await contrib.reverseContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'Recorded against the wrong person', now: PAY });
      await contrib.reverseContribution({ associationId: A, contributionId: reported.contribution.id, actorUserId: recon1.id, reason: 'Recorded against the wrong person', now: PAY });

      const rs = await receiptsOf(reported.contribution.id);
      expect(rs.map((r) => r.moment)).toEqual(['RECORDED', 'CONFIRMED', 'REVERSED']);
      expect(rs.every((r) => r.state === 'SENT')).toBe(true);
      const mine = inApp.filter((n) => n.userId === m.member.userId && n.entityId === reported.contribution.id);
      expect(mine).toHaveLength(3);
      expect(mine.every((n) => n.kind === 'payment_received' && n.pushType === 'ajo.receipt')).toBe(true);
      expect(mine[0].message).toContain('₦5,000.00');
      expect(mine[0].message).toContain(reported.contribution.reference);
      expect(mine[2].message).toContain('Recorded against the wrong person');
      expect(sms).toHaveLength(0); // someone with a login is not texted
    });

    it('texts a contributor with no login when the payment is recorded and when it goes wrong, but not for a routine confirmation', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const a = await transfer(g.id, mid, AMOUNT);
      expect(sms).toHaveLength(1);
      expect(sms[0].to).toMatch(/^\+?234/);
      expect(sms[0].text).toContain('₦5,000.00');
      expect(sms[0].text).toContain(a.contribution.reference);

      await confirm(a.contribution.id);
      expect(sms).toHaveLength(1); // no text for the confirmation
      expect((await receiptsOf(a.contribution.id)).find((r) => r.moment === 'CONFIRMED')?.state).toBe('SKIPPED');

      const b = await transfer(g.id, mid, AMOUNT);
      await contrib.rejectContribution({ associationId: A, contributionId: b.contribution.id, actorUserId: recon1.id, reason: 'The bank statement does not show it', now: PAY });
      expect(sms).toHaveLength(3); // recorded, then rejected
      expect(sms[2].text).toContain('The bank statement does not show it');

      await contrib.reverseContribution({ associationId: A, contributionId: a.contribution.id, actorUserId: recon1.id, reason: 'Recorded against the wrong person', now: PAY });
      expect(sms).toHaveLength(4);
    });

    it('queues the receipt when SMS credits run out, keeps the payment, and tells the officers once', async () => {
      const { g, joined } = await startedGroup(3);
      smsMode.noCredits = true;
      const made = [];
      for (const j of joined) made.push(await transfer(g.id, j.membership.id, AMOUNT));
      expect(sms).toHaveLength(0);

      for (const c of made) {
        expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: c.contribution.id } })).toMatchObject({ status: 'REPORTED' }); // the payment is not lost
        const [r] = await receiptsOf(c.contribution.id);
        expect(r).toMatchObject({ moment: 'RECORDED', state: 'QUEUED', lastError: 'NO_SMS_CREDITS' });
      }
      expect(await receipts.queuedReceiptCount(A)).toBeGreaterThanOrEqual(3);
      expect(notices.filter((n) => n.pushType === 'ajo.receipts_waiting')).toHaveLength(1);
      expect(notices.find((n) => n.pushType === 'ajo.receipts_waiting')).toMatchObject({ to: 'holders', permission: 'ajo.manage' });
      const listed = await receipts.listReceipts({ associationId: A, contributionId: made[0].contribution.id });
      expect(listed[0]).toMatchObject({ state: 'QUEUED', queuedForCredits: true });

      // Credits come back: everything waiting goes out, and the queue is empty.
      smsMode.noCredits = false;
      const flushed = await receipts.flushQueuedReceipts({ associationId: A });
      expect(flushed.sent).toBeGreaterThanOrEqual(3);
      expect(flushed.stillQueued).toBe(0);
      expect(sms.length).toBeGreaterThanOrEqual(3);
      for (const c of made) expect((await receiptsOf(c.contribution.id))[0].state).toBe('SENT');

      // A later shortage raises a new alert.
      smsMode.noCredits = true;
      const again = await transfer(g.id, joined[0].membership.id, AMOUNT);
      expect((await receiptsOf(again.contribution.id))[0].state).toBe('QUEUED');
      expect(notices.filter((n) => n.pushType === 'ajo.receipts_waiting')).toHaveLength(2);
    });

    it('stops sending queued receipts at the first shortage instead of trying them all', async () => {
      const { g, joined } = await startedGroup(2);
      smsMode.noCredits = true;
      for (const j of joined) await transfer(g.id, j.membership.id, AMOUNT);
      const before = notices.filter((n) => n.pushType === 'ajo.receipts_waiting').length;
      const result = await receipts.flushQueuedReceipts({ associationId: A });
      expect(result.sent).toBe(0);
      expect(result.attempted).toBe(1);
      expect(result.stillQueued).toBeGreaterThanOrEqual(2);
      expect(notices.filter((n) => n.pushType === 'ajo.receipts_waiting')).toHaveLength(before);
    });

    it('sends a queued receipt once even when two things try to send it at the same moment', async () => {
      const { g, joined } = await startedGroup(1);
      smsMode.noCredits = true;
      const c = await transfer(g.id, joined[0].membership.id, AMOUNT);
      const [r] = await receiptsOf(c.contribution.id);
      smsMode.noCredits = false;
      await Promise.all([receipts.deliverReceipt(r.id), receipts.deliverReceipt(r.id), receipts.deliverReceipt(r.id)]);
      expect(sms).toHaveLength(1);
      expect((await receiptsOf(c.contribution.id))[0]).toMatchObject({ state: 'SENT', attempts: 2 });
    });

    it('never lets a receipt problem undo or block the payment', async () => {
      const { g, joined } = await startedGroup(1, { withUser: true });
      inAppMode.fail = true;
      const c = await transfer(g.id, joined[0].membership.id, AMOUNT, { actor: joined[0].member.userId as number, manage: false });
      expect(await prisma.ajoContribution.findUniqueOrThrow({ where: { id: c.contribution.id } })).toMatchObject({ status: 'REPORTED' });
      expect((await receiptsOf(c.contribution.id))[0].state).toBe('QUEUED');
      inAppMode.fail = false;
      const flushed = await receipts.flushQueuedReceipts({ associationId: A });
      expect(flushed.sent).toBeGreaterThanOrEqual(1);
      expect((await receiptsOf(c.contribution.id))[0].state).toBe('SENT');
    });

    it('keeps a receipt for a contributor with no phone from being lost silently', async () => {
      const { g, joined } = await startedGroup(1);
      await prisma.member.update({ where: { id: joined[0].member.id }, data: { phone: null } });
      const c = await transfer(g.id, joined[0].membership.id, AMOUNT);
      expect((await receiptsOf(c.contribution.id))[0]).toMatchObject({ state: 'FAILED', lastError: 'NO_PHONE' });
      expect(sms).toHaveLength(0);
    });

    it('shows a contributor their own history with what counts and what is still being checked', async () => {
      const { g, joined } = await startedGroup(1);
      const mid = joined[0].membership.id;
      const confirmed = await transfer(g.id, mid, AMOUNT);
      await confirm(confirmed.contribution.id);
      await transfer(g.id, mid, 300_000n);
      const history = await contrib.listMembershipContributions({ associationId: A, membershipId: mid, officer: false });
      expect(history.map((h) => [h.amount, h.counts, h.awaitingConfirmation])).toEqual(expect.arrayContaining([['₦5,000.00', true, false], ['₦3,000.00', false, true]]));
      const asContributor = JSON.stringify(history);
      expect(asContributor).not.toContain('proofKey');
      expect(asContributor).not.toContain('hasProof'); // officer-only detail
      const queue = await contrib.listGroupContributions({ associationId: A, groupId: g.id, status: 'REPORTED' });
      expect(queue.total).toBe(1);
      expect(queue.items[0]).toMatchObject({ amount: '₦3,000.00', hasProof: true });
    });
  });
});
