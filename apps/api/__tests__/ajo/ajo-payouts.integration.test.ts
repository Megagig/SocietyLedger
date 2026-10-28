/**
 * Ajo T5 payouts against a real (disposable) database: the calculation and shortfall, when and in what order a payout can be prepared,
 * approval and who may give it, recording the payment the group made, failing, voiding and reversing, supplementary payouts, and closing a
 * group. SocietyLedger never sends money: every payment here is something an officer RECORDS.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-payouts --forceExit
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
jest.mock('../../src/modules/sms/sms-engine', () => ({
  dispatchMessages: jest.fn(async () => ({ accepted: 1, credits: 1, messageIds: [1], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) })),
}));
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(60000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');
const BEFORE_START = new Date('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const PAY = new Date('2027-03-02T10:00:00Z');
const ROUND1 = new Date('2027-03-02T10:00:00Z');
const ROUND2 = new Date('2027-04-02T10:00:00Z');
const AFTER_CYCLE = new Date('2027-03-09T10:00:00Z');
const AMOUNT = 500_000n; // ₦5,000.00 per share per instalment

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo payouts (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let payouts: typeof import('../../src/modules/ajo/ajo-payout.service');
  let accounts: typeof import('../../src/modules/ajo/ajo-payout-account.service');
  let secrets: typeof import('../../src/modules/ajo/ajo-secrets');
  let ledger: typeof import('../../src/modules/ajo/ajo-ledger.service');

  let A: number;
  let B: number;
  let admin: { id: number };
  let adminB: { id: number };
  let officer: { id: number };
  let approver1: { id: number };
  let approver2: { id: number };
  let recorder1: { id: number };
  let recorder2: { id: number };
  const roleFor = new Map<string, number>();
  let counter = 0;

  async function mkAssociation(label: string) {
    const slug = `ajo-p-${label}-${run}`;
    return prisma.association.create({ data: { name: `Ajo P ${label} ${run}`, slug, subdomain: slug } });
  }
  async function mkUser(associationId: number, label: string) {
    return prisma.user.create({ data: { associationId, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
  }
  async function mkMember(associationId: number, withUser = true) {
    const n = ++counter;
    const user = withUser ? await mkUser(associationId, 'member') : null;
    return prisma.member.create({ data: { associationId, userId: user?.id ?? null, memberId: `P${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', address: '12 Market Road, Aba', status: 'active' } });
  }
  /** Make exactly these users hold a permission in association A. */
  async function setHolders(key: string, userIds: number[]) {
    if (!roleFor.has(key)) {
      const permission = await prisma.permission.upsert({ where: { key }, create: { key, description: `Test ${key}`, module: 'Ajo' }, update: {} });
      const role = await prisma.role.create({ data: { associationId: A, name: `test-${key}-${run}`, displayName: key } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      roleFor.set(key, role.id);
    }
    const roleId = roleFor.get(key) as number;
    await prisma.userRole.deleteMany({ where: { associationId: A, roleId } });
    for (const userId of userIds) await prisma.userRole.create({ data: { userId, roleId, associationId: A } });
  }

  /** A recipient who can be paid: an account on file, past its cool-off, and verified by SocietyLedger. */
  async function makePayable(memberId: number, over: { verified?: boolean; coolOffUntil?: Date | null } = {}) {
    const number = '0123456789';
    await prisma.ajoPayoutAccount.upsert({
      where: { memberId },
      create: { associationId: A, memberId, bankName: 'GTBank', accountName: 'Adaeze Okafor', accountNumberEnc: secrets.encryptAccountNumber(memberId, number), last4: number.slice(-4), coolOffUntil: over.coolOffUntil ?? null },
      update: {},
    });
    await prisma.ajoVerification.create({ data: { associationId: A, memberId, submittedName: 'Adaeze Okafor', status: over.verified === false ? 'PENDING' : 'VERIFIED', nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true, reviewedBy: admin.id, reviewedAt: new Date('2027-01-01') } });
  }

  const key = () => `key-${run}-${++counter}`;
  async function newGroup(fields: Record<string, unknown>) {
    const g = await groups.createGroup({
      associationId: A,
      actorUserId: admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      fields: { name: `Circle ${++counter}`, contributionKobo: Number(AMOUNT), startDate: START, ...fields },
    });
    await groups.openGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: NOW });
    return g;
  }
  async function join(groupId: number, shares = 1) {
    const member = await mkMember(A);
    const membership = await members.addMember({ associationId: A, groupId, memberId: member.id, actorUserId: admin.id, shares });
    await consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: admin.id, now: NOW });
    return { member, membership };
  }
  /** The transfer is reported and confirmed by someone else, so the money counts. */
  async function fund(groupId: number, membershipId: number, amount: bigint, now: Date = PAY) {
    const rep = await contrib.reportTransfer({ associationId: A, groupId, membershipId, amountKobo: amount, idempotencyKey: key(), actorUserId: admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
    await contrib.confirmTransfer({ associationId: A, contributionId: rep.contribution.id, actorUserId: recorder1.id, now });
    return rep.contribution.id;
  }

  /** A rotating pot of three people (one holds two shares: four rounds). Round 1 is ₦20,000.00 when everyone has paid. */
  async function pot(over: { fee?: [string, number]; payable?: boolean; payRound1?: boolean } = {}) {
    const g = await newGroup({ model: 'ROTATING_POT', frequency: 'MONTHLY', maxParticipants: 3, ...(over.fee ? { collectorFeeType: over.fee[0], collectorFeeValue: over.fee[1] } : {}) });
    const p1 = await join(g.id);
    const p2 = await join(g.id, 2);
    const p3 = await join(g.id);
    await order.runDraw({ associationId: A, groupId: g.id, actorUserId: admin.id });
    await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: BEFORE_START });
    const people = [p1, p2, p3];
    if (over.payable !== false) for (const p of people) await makePayable(p.member.id);
    if (over.payRound1 !== false) for (const [i, p] of people.entries()) await fund(g.id, p.membership.id, AMOUNT * BigInt(i === 1 ? 2 : 1));
    const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: g.id }, orderBy: { position: 'asc' }, include: { membership: { include: { member: true } } } });
    return { g, people, slots, holder: (position: number) => slots.find((s) => s.position === position)!.membership };
  }

  /** Collector thrift over two weeks: ₦10,000.00 each by the end. */
  async function thrift(over: { people?: number; fee?: [string, number]; payable?: boolean; fund?: boolean } = {}) {
    const g = await newGroup({ model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 2, maxParticipants: 30, ...(over.fee ? { collectorFeeType: over.fee[0], collectorFeeValue: over.fee[1] } : {}) });
    const people = [];
    for (let i = 0; i < (over.people ?? 2); i++) people.push(await join(g.id));
    await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: admin.id, now: BEFORE_START });
    for (const p of people) {
      if (over.payable !== false) await makePayable(p.member.id);
      if (over.fund !== false) await fund(g.id, p.membership.id, AMOUNT * 2n);
    }
    return { g, people };
  }

  const prepare = (groupId: number, over: { round?: number; membershipId?: number; actor?: number; now?: Date }) =>
    payouts.preparePayout({ associationId: A, groupId, round: over.round, membershipId: over.membershipId, actorUserId: over.actor ?? officer.id, now: over.now ?? ROUND1 });
  const approve = (payoutId: number, over: { actor?: number; self?: boolean; note?: string; now?: Date } = {}) =>
    payouts.approvePayout({ associationId: A, payoutId, actorUserId: over.actor ?? approver1.id, confirmSelfApproval: over.self, note: over.note, now: over.now ?? ROUND1 });
  const record = (payoutId: number, over: { actor?: number; reference?: string; proof?: { buffer: Buffer; mimeType: string }; own?: boolean; note?: string; now?: Date } = {}) =>
    payouts.recordPayoutPaid({ associationId: A, payoutId, actorUserId: over.actor ?? recorder1.id, reference: over.reference ?? `GTB-${run}-${++counter}`, proof: over.proof, confirmOwn: over.own, note: over.note, now: over.now ?? ROUND1 });
  /** Prepare, approve and record in one go (three different people). */
  async function pay(groupId: number, over: { round?: number; membershipId?: number; now?: Date }) {
    const prep = await prepare(groupId, over);
    await approve(prep.payout.id, { now: over.now });
    return record(prep.payout.id, { now: over.now });
  }

  /** The ledger entries a payout made for a person (their own contributions are not counted here). */
  const entries = (membershipId: number) => prisma.ajoLedgerEntry.findMany({ where: { associationId: A, membershipId, refType: 'payout' }, orderBy: { id: 'asc' } });
  const balance = (membershipId: number) => ledger.balanceKobo(prisma as never, { associationId: A, membershipId });
  const audits = (action: string, recordId?: number) => prisma.auditLog.findMany({ where: { associationId: A, action, ...(recordId ? { recordId } : {}) } });
  const row = (id: number) => prisma.ajoPayout.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    payouts = require('../../src/modules/ajo/ajo-payout.service');
    accounts = require('../../src/modules/ajo/ajo-payout-account.service');
    secrets = require('../../src/modules/ajo/ajo-secrets');
    ledger = require('../../src/modules/ajo/ajo-ledger.service');
    A = (await mkAssociation('a')).id;
    B = (await mkAssociation('b')).id;
    admin = await mkUser(A, 'admin');
    adminB = await mkUser(B, 'admin-b');
    officer = await mkUser(A, 'officer');
    approver1 = await mkUser(A, 'approver');
    approver2 = await mkUser(A, 'approver');
    recorder1 = await mkUser(A, 'recorder');
    recorder2 = await mkUser(A, 'recorder');
  });

  beforeEach(async () => {
    notices.length = 0;
    files.clear();
    await setHolders('ajo.reconcile', [recorder1.id, recorder2.id]);
    await setHolders('ajo.approve_payout', [approver1.id, approver2.id]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the calculation and the preview (T5.1)', () => {
    it('works out a fully paid round and says who is paid and into which account, masked', async () => {
      const { g, holder } = await pot();
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview).toMatchObject({ round: 1, grossKobo: '2000000', confirmedKobo: '2000000', shortfallKobo: '0', feeKobo: '0', netKobo: '2000000', net: '₦20,000.00', canPrepare: true, nothingToPay: false });
      expect(preview.membershipId).toBe(holder(1).id);
      expect(preview.account).toMatchObject({ bankName: 'GTBank', masked: '••••6789' });
      expect(JSON.stringify(preview)).not.toContain('0123456789');
      expect(preview.readiness.ok && preview.eligibility.ok).toBe(true);
    });

    it('shows the shortfall and who is short, pays only what is confirmed, and takes the collector fee off', async () => {
      const { g, people } = await pot({ payRound1: false, fee: ['FIXED', 50_000] });
      await fund(g.id, people[0].membership.id, AMOUNT);
      await fund(g.id, people[1].membership.id, AMOUNT * 2n); // the third person has not paid
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview).toMatchObject({ grossKobo: '2000000', confirmedKobo: '1500000', shortfallKobo: '500000', feeKobo: '50000', netKobo: '1450000', net: '₦14,500.00' });
      expect(preview.shortfall).toHaveLength(1);
      expect(preview.shortfall[0]).toMatchObject({ membershipId: people[2].membership.id, shortKobo: '500000', short: '₦5,000.00' });
      expect(preview.explanation.join(' ')).toContain('Shortfall ₦5,000.00');
      expect(preview.canPrepare).toBe(true);
    });

    it('shows the recipient’s own arrears without stopping the payout', async () => {
      const { g, people, holder } = await pot({ payRound1: false });
      const recipient = holder(1);
      for (const p of people) if (p.membership.id !== recipient.id) await fund(g.id, p.membership.id, AMOUNT * (p.membership.shares === 2 ? 2n : 1n));
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview.recipientArrearsKobo).toBe((AMOUNT * BigInt(recipient.shares)).toString());
      expect(preview.recipientArrearsNote).toMatch(/behind on their own contributions/);
      expect(preview.canPrepare).toBe(true);
    });

    it('reports nothing to pay when nothing is confirmed, and when a fixed fee swallows what there is', async () => {
      const empty = await pot({ payRound1: false });
      const none = await payouts.previewPayout({ associationId: A, groupId: empty.g.id, round: 1, now: ROUND1 });
      expect(none).toMatchObject({ nothingToPay: true, canPrepare: false, netKobo: '0' });
      expect(await codeOf(prepare(empty.g.id, { round: 1 }))).toBe('NOTHING_TO_PAY');

      const small = await pot({ payRound1: false, fee: ['FIXED', 900_000] });
      await fund(small.g.id, small.people[0].membership.id, 100_000n);
      expect(await codeOf(prepare(small.g.id, { round: 1 }))).toBe('NOTHING_TO_PAY');
    });

    it('explains why it cannot be prepared yet instead of failing, and says what to fix when the person cannot be paid', async () => {
      const { g, holder } = await pot({ payable: false });
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview.canPrepare).toBe(false);
      expect(preview.eligibility).toMatchObject({ ok: false, code: 'PAYOUT_ACCOUNT_MISSING' });
      expect(preview.account).toBeNull();
      expect(holder(1).id).toBe(preview.membershipId);
      const early = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 2, now: ROUND1 });
      expect(early.readiness).toMatchObject({ ok: false, code: 'ROUND_NOT_DUE' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('when and in what order (T5.1)', () => {
    it('opens a rotating-pot round only once its date has come, and only after the round before it was paid', async () => {
      const { g, people } = await pot();
      expect(await codeOf(prepare(g.id, { round: 1, now: new Date('2027-02-28T10:00:00Z') }))).toBe('ROUND_NOT_DUE');
      expect(await codeOf(prepare(g.id, { round: 2, now: ROUND2 }))).toBe('PREVIOUS_ROUND_NOT_PAID');
      expect(await codeOf(prepare(g.id, { round: 9, now: ROUND2 }))).toBe('INVALID_ROUND');
      expect(await codeOf(prepare(g.id, { now: ROUND1 }))).toBe('INVALID_ROUND');

      await pay(g.id, { round: 1 });
      for (const p of people) await fund(g.id, p.membership.id, AMOUNT * BigInt(p.membership.shares), ROUND2); // round 2 is paid for
      await expect(prepare(g.id, { round: 2, now: ROUND2 })).resolves.toMatchObject({ replayed: false });
    });

    it('pays a collector-thrift participant only after the cycle’s last due date, and each on their own', async () => {
      const { g, people } = await thrift();
      expect(await codeOf(prepare(g.id, { membershipId: people[0].membership.id, now: new Date('2027-03-08T10:00:00Z') }))).toBe('CYCLE_NOT_FINISHED');
      expect(await codeOf(prepare(g.id, { now: AFTER_CYCLE }))).toBe('INVALID_RECIPIENT');
      const done = await prepare(g.id, { membershipId: people[0].membership.id, now: AFTER_CYCLE });
      expect(done.payout).toMatchObject({ round: null, netKobo: '1000000', net: '₦10,000.00', status: 'PREPARED' });
    });

    it('will not prepare for a group that is not running', async () => {
      const g = await newGroup({ model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 2, maxParticipants: 5 });
      const p = await join(g.id);
      expect(await codeOf(prepare(g.id, { membershipId: p.membership.id, now: AFTER_CYCLE }))).toBe('GROUP_NOT_ACTIVE');
    });

    it('holds a slot still from the moment a payout is prepared for it', async () => {
      const { g, slots } = await pot();
      const first = slots.find((s) => s.position === 1)!;
      // Any slot held by someone else: the draw is random, so the position cannot be assumed.
      const other = slots.find((s) => s.membershipId !== first.membershipId)!;
      const prep = await prepare(g.id, { round: 1 });
      expect(await codeOf(order.requestSwap({ associationId: A, groupId: g.id, slotAId: first.id, slotBId: other.id, actorUserId: admin.id, actorIsOfficer: true }))).toBe('SLOT_LOCKED');
      // Once the payout is cancelled, the slot is free again.
      await payouts.voidPayout({ associationId: A, payoutId: prep.payout.id, actorUserId: officer.id, actorIsAdmin: false, reason: 'Prepared for the wrong round by mistake' });
      await expect(order.requestSwap({ associationId: A, groupId: g.id, slotAId: first.id, slotBId: other.id, actorUserId: admin.id, actorIsOfficer: true })).resolves.toMatchObject({ status: 'PENDING' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('who can be paid (T5.2)', () => {
    it('refuses to prepare for a person who is not verified, has no account, or changed it recently', async () => {
      const unverified = await pot({ payable: false });
      const r1 = unverified.holder(1);
      expect(await codeOf(prepare(unverified.g.id, { round: 1 }))).toBe('PAYOUT_ACCOUNT_MISSING');
      await makePayable(r1.memberId, { verified: false });
      expect(await codeOf(prepare(unverified.g.id, { round: 1 }))).toBe('PERSON_NOT_VERIFIED');

      const cooling = await pot({ payable: false });
      await makePayable(cooling.holder(1).memberId, { coolOffUntil: new Date('2027-03-10T00:00:00Z') });
      expect(await codeOf(prepare(cooling.g.id, { round: 1 }))).toBe('PAYOUT_COOL_OFF');
    });

    it('checks again when approving: an account changed since it was prepared cancels the payout', async () => {
      const { g, holder } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      await prisma.ajoPayoutAccount.update({ where: { memberId: holder(1).memberId }, data: { accountName: 'Someone Else', last4: '1111' } });
      expect(await codeOf(approve(prep.payout.id))).toBe('ACCOUNT_CHANGED');
      expect(await row(prep.payout.id)).toMatchObject({ status: 'VOID', voidReason: expect.stringContaining('changed their payout account') });
      expect(notices.some((n) => n.permission === 'ajo.approve_payout' && n.pushType === 'ajo.payout_voided')).toBe(true);
    });

    it('cancels an approved payout when the recipient changes their account through the normal route, and it cannot be recorded', async () => {
      const { g, holder } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      const m = holder(1);
      await accounts.setPayoutAccount({ associationId: A, memberId: m.memberId, actorUserId: admin.id, bankName: 'Access Bank', accountNumber: '9876543210', accountName: 'Adaeze Okafor', now: new Date('2027-03-02T11:00:00Z') });
      expect((await row(prep.payout.id)).status).toBe('VOID');
      expect(await codeOf(record(prep.payout.id))).toBe('INVALID_PAYOUT_STATE');
      expect(await entries(m.id)).toHaveLength(0);
    });

    it('checks again when recording: an account changed behind the scenes cancels it, and a person who is no longer verified stops it', async () => {
      const changed = await pot();
      const a = await prepare(changed.g.id, { round: 1 });
      await approve(a.payout.id);
      await prisma.ajoPayoutAccount.update({ where: { memberId: changed.holder(1).memberId }, data: { last4: '2222' } });
      expect(await codeOf(record(a.payout.id))).toBe('ACCOUNT_CHANGED');
      expect((await row(a.payout.id)).status).toBe('VOID');
      expect(await entries(changed.holder(1).id)).toHaveLength(0);

      const rejected = await pot();
      const b = await prepare(rejected.g.id, { round: 1 });
      await approve(b.payout.id);
      await prisma.ajoVerification.create({ data: { associationId: A, memberId: rejected.holder(1).memberId, submittedName: 'x', status: 'REJECTED', rejectionReason: 'The name does not match', reviewedBy: admin.id, reviewedAt: new Date() } });
      expect(await codeOf(record(b.payout.id))).toBe('PERSON_NOT_VERIFIED');
      expect((await row(b.payout.id)).status).toBe('APPROVED');
    });

    it('refuses to approve or pay a payout whose money was reversed after it was prepared', async () => {
      const { g, people } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      const some = await prisma.ajoContribution.findFirstOrThrow({ where: { membershipId: people[0].membership.id, status: 'CONFIRMED' } });
      await contrib.reverseContribution({ associationId: A, contributionId: some.id, actorUserId: recorder1.id, reason: 'Recorded against the wrong person', now: PAY });
      expect(await codeOf(approve(prep.payout.id))).toBe('PAYOUT_NOT_COVERED');
      expect((await row(prep.payout.id)).status).toBe('PREPARED');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('approval and separation of duties (T5.2)', () => {
    it('keeps a payout waiting for an admin, and tells the admins', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      expect(prep.payout).toMatchObject({ status: 'PREPARED', approvedBy: null, round: 1, sequence: 1 });
      expect(notices.some((n) => n.permission === 'ajo.approve_payout' && n.pushType === 'ajo.payout_prepared')).toBe(true);
      expect(await audits('AJO_PAYOUT_PREPARED', prep.payout.id)).toHaveLength(1);
      expect(await codeOf(record(prep.payout.id))).toBe('INVALID_PAYOUT_STATE');
    });

    it('does not let the preparer approve their own payout when there is another admin', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1, actor: approver1.id });
      expect(await codeOf(approve(prep.payout.id, { actor: approver1.id }))).toBe('SELF_APPROVAL_NOT_ALLOWED');
      expect(await codeOf(approve(prep.payout.id, { actor: approver1.id, self: true, note: 'I would like to approve it myself' }))).toBe('SELF_APPROVAL_NOT_ALLOWED');
      const done = await approve(prep.payout.id, { actor: approver2.id });
      expect(done.payout).toMatchObject({ status: 'APPROVED', approvedBy: approver2.id, selfApprovalConfirmed: false });
    });

    it('lets a group with one admin approve what they prepared, but only with an explicit confirmation and a note, flagged for everyone', async () => {
      await setHolders('ajo.approve_payout', [approver1.id]);
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1, actor: approver1.id });
      expect(await codeOf(approve(prep.payout.id, { actor: approver1.id }))).toBe('SELF_APPROVAL_NEEDS_CONFIRMATION');
      expect(await codeOf(approve(prep.payout.id, { actor: approver1.id, self: true }))).toBe('SELF_APPROVAL_NEEDS_CONFIRMATION');
      expect(await codeOf(approve(prep.payout.id, { actor: approver1.id, self: true, note: 'too short' }))).toBe('SELF_APPROVAL_NEEDS_CONFIRMATION');

      const done = await approve(prep.payout.id, { actor: approver1.id, self: true, note: 'We have only one admin; the treasurer checked it with me' });
      expect(done.payout).toMatchObject({ status: 'APPROVED', selfApprovalConfirmed: true });
      expect(notices.some((n) => n.permission === 'ajo.manage' && n.pushType === 'ajo.payout_self_approved')).toBe(true);
      expect(JSON.stringify(await audits('AJO_PAYOUT_APPROVED', prep.payout.id))).toContain('We have only one admin');
    });

    it('does not let an admin approve a payout that is theirs, unless they are the only admin and say so', async () => {
      const { g, holder } = await pot();
      const recipientUserId = (await prisma.member.findUniqueOrThrow({ where: { id: holder(1).memberId } })).userId as number;
      await setHolders('ajo.approve_payout', [approver1.id, recipientUserId]);
      const prep = await prepare(g.id, { round: 1 });
      expect(await codeOf(approve(prep.payout.id, { actor: recipientUserId }))).toBe('SELF_APPROVAL_NOT_ALLOWED');
      await setHolders('ajo.approve_payout', [recipientUserId]);
      expect(await codeOf(approve(prep.payout.id, { actor: recipientUserId }))).toBe('SELF_APPROVAL_NEEDS_CONFIRMATION');
      await expect(approve(prep.payout.id, { actor: recipientUserId, self: true, note: 'Our only admin is also this round’s recipient' })).resolves.toMatchObject({ payout: { selfApprovalConfirmed: true } });
    });

    it('is safe to approve twice, and tells the people who pay that it is ready', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      const again = await approve(prep.payout.id, { actor: approver2.id });
      expect(again.replayed).toBe(true);
      expect(await audits('AJO_PAYOUT_APPROVED', prep.payout.id)).toHaveLength(1);
      expect(notices.filter((n) => n.permission === 'ajo.reconcile' && n.pushType === 'ajo.payout_approved')).toHaveLength(1);
    });

    it('prepares once however many times it is asked, even at the same moment', async () => {
      const { g } = await pot();
      const [a, b] = await Promise.all([prepare(g.id, { round: 1 }), prepare(g.id, { round: 1 })]);
      expect(a.payout.id).toBe(b.payout.id);
      expect(await prisma.ajoPayout.count({ where: { groupId: g.id, round: 1 } })).toBe(1);
      expect((await prepare(g.id, { round: 1 })).replayed).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('recording the payment the group made (T5.3)', () => {
    it('writes the ledger only when it is recorded: one debit for the payout and one for the collector fee', async () => {
      const { g, holder } = await pot({ fee: ['FIXED', 50_000] });
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      expect(await entries(holder(1).id)).toHaveLength(0);

      const bytes = Buffer.from(`transfer-slip-${run}`);
      const done = await record(prep.payout.id, { reference: 'GTB 0099-887766', proof: { buffer: bytes, mimeType: 'image/png' } });
      expect(done.payout).toMatchObject({ status: 'PAID', paidReference: 'GTB 0099-887766', hasProof: true, netKobo: '1950000', collectorFeeKobo: '50000' });
      expect(JSON.stringify(done)).not.toContain('payout-proofs');

      const list = (await prisma.ajoLedgerEntry.findMany({ where: { refType: 'payout', refId: prep.payout.id }, orderBy: { id: 'asc' } }));
      expect(list.map((e) => [e.type, e.direction, e.amountKobo])).toEqual([['PAYOUT', 'DEBIT', 1_950_000n], ['FEE', 'DEBIT', 50_000n]]);
      expect([...files.keys()].some((k) => k.startsWith(`ajo/payout-proofs/${A}/${g.id}/`))).toBe(true);
      expect(await audits('AJO_PAYOUT_PAID', prep.payout.id)).toHaveLength(1);
      expect(notices.some((n) => n.pushType === 'ajo.payout_paid' && n.message.includes('₦19,500.00') && n.message.includes('••••6789'))).toBe(true);
      expect(JSON.stringify(notices)).not.toContain('0123456789');
    });

    it('is idempotent: the same reference again changes nothing, a different one is refused', async () => {
      const { g, holder } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      await record(prep.payout.id, { reference: 'GTB-77001' });
      const again = await record(prep.payout.id, { reference: 'gtb 77001' }); // the same reference, written differently
      expect(again.replayed).toBe(true);
      expect(await codeOf(record(prep.payout.id, { reference: 'GTB-OTHER-9' }))).toBe('IDEMPOTENCY_CONFLICT');
      expect(await entries(holder(1).id)).toHaveLength(1);
      expect(await audits('AJO_PAYOUT_PAID', prep.payout.id)).toHaveLength(1);
    });

    it('needs the bank’s reference, refuses one already used for another payout, and a proof of the wrong kind', async () => {
      const a = await pot();
      const b = await pot();
      const pa = await prepare(a.g.id, { round: 1 });
      const pb = await prepare(b.g.id, { round: 1 });
      await approve(pa.payout.id);
      await approve(pb.payout.id);
      expect(await codeOf(record(pa.payout.id, { reference: '  ' }))).toBe('REFERENCE_REQUIRED');
      expect(await codeOf(record(pa.payout.id, { reference: 'ab' }))).toBe('REFERENCE_REQUIRED');
      expect(await codeOf(record(pa.payout.id, { reference: 'GTB-100', proof: { buffer: Buffer.from('x'), mimeType: 'text/plain' } }))).toBe('INVALID_PROOF');
      await record(pa.payout.id, { reference: 'GTB-DUP-1001' });
      expect(await codeOf(record(pb.payout.id, { reference: 'gtb dup 1001' }))).toBe('DUPLICATE_PAYOUT_REFERENCE');
      expect((await row(pb.payout.id)).status).toBe('APPROVED');
      expect([...files.keys()].some((k) => k.includes('payout-proofs'))).toBe(false); // nothing was stored for the refusals
    });

    it('does not let the recipient record their own payout, unless they are the only reconciler and say so', async () => {
      const { g, holder } = await pot();
      const recipientUserId = (await prisma.member.findUniqueOrThrow({ where: { id: holder(1).memberId } })).userId as number;
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      await setHolders('ajo.reconcile', [recorder1.id, recipientUserId]);
      expect(await codeOf(record(prep.payout.id, { actor: recipientUserId }))).toBe('SELF_CONFIRM_NOT_ALLOWED');
      await setHolders('ajo.reconcile', [recipientUserId]);
      expect(await codeOf(record(prep.payout.id, { actor: recipientUserId }))).toBe('SELF_CONFIRM_NEEDS_NOTE');
      await expect(record(prep.payout.id, { actor: recipientUserId, own: true, note: 'I am the only treasurer; the statement is attached' })).resolves.toMatchObject({ payout: { status: 'PAID' } });
    });

    it('keeps the group’s own balance honest: contributions in, payout and fee out', async () => {
      const { g, holder } = await pot({ fee: ['FIXED', 50_000] });
      const m = holder(1);
      const before = await balance(m.id);
      await pay(g.id, { round: 1 });
      expect(await balance(m.id)).toBe(before - 1_950_000n - 50_000n);
      const group = await ledger.balanceKobo(prisma as never, { associationId: A, groupId: g.id });
      expect(group).toBe(2_000_000n - 1_950_000n - 50_000n); // everything the round brought in has gone out
      expect(group).toBe(0n);
    });

    it('never sends money anywhere: no payment provider is touched and no transfer is made', async () => {
      const { g } = await pot();
      const before = await prisma.paymentHistory.count();
      await pay(g.id, { round: 1 });
      expect(await prisma.paymentHistory.count()).toBe(before);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('stopping or undoing a payout (T5.3)', () => {
    it('lets the preparer cancel their own prepared payout and an admin void any open one, and nobody else', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      const base = { associationId: A, payoutId: prep.payout.id };
      expect(await codeOf(payouts.voidPayout({ ...base, actorUserId: recorder1.id, actorIsAdmin: false, reason: 'Trying to cancel it' }))).toBe('FORBIDDEN');
      expect(await codeOf(payouts.voidPayout({ ...base, actorUserId: officer.id, actorIsAdmin: false, reason: 'short' }))).toBe('REASON_REQUIRED');
      const done = await payouts.voidPayout({ ...base, actorUserId: officer.id, actorIsAdmin: false, reason: 'Prepared for the wrong round by mistake' });
      expect(done.payout).toMatchObject({ status: 'VOID', failed: false, voidReason: 'Prepared for the wrong round by mistake' });
      expect((await payouts.voidPayout({ ...base, actorUserId: approver1.id, actorIsAdmin: true, reason: 'Cancelling it again' })).replayed).toBe(true);

      const second = await prepare(g.id, { round: 1 });
      await approve(second.payout.id);
      await expect(payouts.voidPayout({ associationId: A, payoutId: second.payout.id, actorUserId: approver1.id, actorIsAdmin: true, reason: 'The treasurer is away this week' })).resolves.toMatchObject({ payout: { status: 'VOID' } });
    });

    it('marks a failed transfer, puts the round back to pending, writes nothing to the ledger, and tells the admins', async () => {
      const { g, holder } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      await approve(prep.payout.id);
      notices.length = 0;
      const failed = await payouts.voidPayout({ associationId: A, payoutId: prep.payout.id, actorUserId: recorder1.id, actorIsAdmin: false, reason: 'The bank returned the transfer: account closed', failed: true });
      expect(failed.payout).toMatchObject({ status: 'VOID', failed: true });
      expect(await entries(holder(1).id)).toHaveLength(0);
      expect(notices.some((n) => n.permission === 'ajo.approve_payout' && n.pushType === 'ajo.payout_voided' && n.message.includes('failed at the bank'))).toBe(true);

      // The round is pending again: a new payout can be prepared (the second attempt).
      const again = await prepare(g.id, { round: 1 });
      expect(again.payout).toMatchObject({ sequence: 2, status: 'PREPARED' });
      expect(await codeOf(payouts.voidPayout({ associationId: A, payoutId: again.payout.id, actorUserId: recorder1.id, actorIsAdmin: false, reason: 'The bank returned the transfer', failed: true }))).toBe('INVALID_PAYOUT_STATE');
    });

    it('never voids a payout that was recorded as paid: that is a reversal', async () => {
      const { g } = await pot();
      const paid = await pay(g.id, { round: 1 });
      expect(await codeOf(payouts.voidPayout({ associationId: A, payoutId: paid.payout.id, actorUserId: approver1.id, actorIsAdmin: true, reason: 'Trying to undo a paid payout' }))).toBe('PAYOUT_ALREADY_PAID');
    });

    it('reverses a paid payout with a reason: ledger reversals, the round pending again, nothing edited', async () => {
      const { g, holder } = await pot({ fee: ['FIXED', 50_000] });
      const m = holder(1);
      const paid = await pay(g.id, { round: 1 });
      const afterPaid = await balance(m.id);
      expect(await codeOf(payouts.reversePaidPayout({ associationId: A, payoutId: paid.payout.id, actorUserId: approver1.id, reason: 'short' }))).toBe('REASON_REQUIRED');

      const reversed = await payouts.reversePaidPayout({ associationId: A, payoutId: paid.payout.id, actorUserId: approver1.id, reason: 'The bank returned the money to the group account' });
      expect(reversed.payout).toMatchObject({ status: 'REVERSED', reverseReason: 'The bank returned the money to the group account' });
      expect(await balance(m.id)).toBe(afterPaid + 1_950_000n + 50_000n);
      const list = await prisma.ajoLedgerEntry.findMany({ where: { refType: 'payout', refId: paid.payout.id }, orderBy: { id: 'asc' } });
      expect(list.map((e) => e.type)).toEqual(['PAYOUT', 'FEE', 'REVERSAL', 'REVERSAL']);
      expect(list[2]).toMatchObject({ direction: 'CREDIT', reversalOfId: list[0].id });
      expect((await payouts.reversePaidPayout({ associationId: A, payoutId: paid.payout.id, actorUserId: approver2.id, reason: 'The bank returned the money to the group account' })).replayed).toBe(true);
      expect(await prisma.ajoLedgerEntry.count({ where: { refType: 'payout', refId: paid.payout.id } })).toBe(4);
      expect(await audits('AJO_PAYOUT_REVERSED', paid.payout.id)).toHaveLength(1);

      // The round is pending again.
      expect(await prepare(g.id, { round: 1 })).toMatchObject({ payout: { sequence: 2 } });
    });

    it('reverses only what was paid', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      expect(await codeOf(payouts.reversePaidPayout({ associationId: A, payoutId: prep.payout.id, actorUserId: approver1.id, reason: 'Trying to reverse an unpaid one' }))).toBe('NOT_PAID');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('late money and supplementary payouts (T5.1, T5.3)', () => {
    it('pays what is confirmed now and the late money later, taking the collector fee only once', async () => {
      const { g, people, holder } = await pot({ payRound1: false, fee: ['FIXED', 50_000] });
      await fund(g.id, people[0].membership.id, AMOUNT);
      await fund(g.id, people[1].membership.id, AMOUNT * 2n); // the third person pays later
      const first = await pay(g.id, { round: 1 });
      expect(first.payout).toMatchObject({ netKobo: '1450000', collectorFeeKobo: '50000', shortfallKobo: '500000', sequence: 1 });

      // The late payment arrives and is confirmed.
      await fund(g.id, people[2].membership.id, AMOUNT);
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview).toMatchObject({ shortfallKobo: '0', feeKobo: '0', netKobo: '500000', alreadyPlannedKobo: '1450000', canPrepare: true });

      const top = await pay(g.id, { round: 1 });
      expect(top.payout).toMatchObject({ sequence: 2, netKobo: '500000', collectorFeeKobo: '0', shortfallKobo: '0' });
      const group = await ledger.balanceKobo(prisma as never, { associationId: A, groupId: g.id });
      expect(group).toBe(0n); // every naira that came in has been paid out, and the fee was taken once
      expect((await prisma.ajoLedgerEntry.findMany({ where: { refType: 'payout', type: 'FEE', membershipId: holder(1).id } }))).toHaveLength(1);

      // Nothing more is payable for the round.
      expect(await codeOf(prepare(g.id, { round: 1 }))).toBe('NOTHING_TO_PAY');
    });

    it('does not change a prepared payout when more money arrives afterwards', async () => {
      const { g, people } = await pot({ payRound1: false });
      await fund(g.id, people[0].membership.id, AMOUNT);
      const prep = await prepare(g.id, { round: 1 });
      await fund(g.id, people[1].membership.id, AMOUNT * 2n);
      expect(await row(prep.payout.id)).toMatchObject({ netKobo: AMOUNT, confirmedKobo: AMOUNT });
      // The preview now sees the open payout and the extra money, but will not prepare a second one on top of it.
      const preview = await payouts.previewPayout({ associationId: A, groupId: g.id, round: 1, now: ROUND1 });
      expect(preview.openPayoutId).toBe(prep.payout.id);
      expect(preview.canPrepare).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('collector thrift: everyone at the end (T5.1)', () => {
    it('prepares for everyone who is ready and lists the ones who are not, with the reason', async () => {
      const { g, people } = await thrift({ people: 3, payable: false });
      await makePayable(people[0].member.id);
      await makePayable(people[1].member.id, { verified: false });
      const result = await payouts.prepareAllReady({ associationId: A, groupId: g.id, actorUserId: officer.id, now: AFTER_CYCLE });
      expect(result.prepared.map((p) => p.membershipId)).toEqual([people[0].membership.id]);
      expect(result.notReady.map((n) => [n.membershipId, n.code]).sort()).toEqual([[people[1].membership.id, 'PERSON_NOT_VERIFIED'], [people[2].membership.id, 'PAYOUT_ACCOUNT_MISSING']].sort());
      const again = await payouts.prepareAllReady({ associationId: A, groupId: g.id, actorUserId: officer.id, now: AFTER_CYCLE });
      expect(again.prepared).toEqual([]); // the first is already waiting
      const rotating = await pot();
      expect(await codeOf(payouts.prepareAllReady({ associationId: A, groupId: rotating.g.id, actorUserId: officer.id }))).toBe('NOT_COLLECTOR_THRIFT');
    });

    it('gives a participant their own savings back, less the fee, and uses their own instalment for a fee in days', async () => {
      const { g, people } = await thrift({ fee: ['DAYS', 1] });
      const done = await pay(g.id, { membershipId: people[0].membership.id, now: AFTER_CYCLE });
      expect(done.payout).toMatchObject({ grossKobo: '1000000', confirmedKobo: '1000000', collectorFeeKobo: '500000', netKobo: '500000' }); // one instalment kept as the fee
    });

    it('pays out a participant who left, for the money they had paid in', async () => {
      const { g, people } = await thrift();
      await members.leaveMembership({ associationId: A, membershipId: people[0].membership.id, actorUserId: admin.id, now: new Date('2027-03-03T10:00:00Z') });
      const done = await pay(g.id, { membershipId: people[0].membership.id, now: AFTER_CYCLE });
      expect(done.payout.netKobo).toBe('1000000');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('closing a group', () => {
    it('completes a group only after the cycle, with nothing waiting and nothing still payable', async () => {
      const { g, people } = await thrift();
      expect(await codeOf(payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: new Date('2027-03-05T10:00:00Z') }))).toBe('CYCLE_NOT_FINISHED');
      expect(await codeOf(payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: AFTER_CYCLE }))).toBe('PAYOUTS_PENDING'); // still payable
      const prep = await prepare(g.id, { membershipId: people[0].membership.id, now: AFTER_CYCLE });
      expect(await codeOf(payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: AFTER_CYCLE }))).toBe('PAYOUTS_PENDING'); // one waiting for approval
      await approve(prep.payout.id, { now: AFTER_CYCLE });
      await record(prep.payout.id, { now: AFTER_CYCLE });
      await pay(g.id, { membershipId: people[1].membership.id, now: AFTER_CYCLE });

      const done = await payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: AFTER_CYCLE });
      expect(done).toMatchObject({ status: 'COMPLETED', replayed: false });
      expect((await payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: AFTER_CYCLE })).replayed).toBe(true);
      expect(await audits('AJO_GROUP_COMPLETED', g.id)).toHaveLength(1);
      // A completed group takes no more payments, but its records stay readable.
      expect(await codeOf(contrib.reportTransfer({ associationId: A, groupId: g.id, membershipId: people[0].membership.id, amountKobo: AMOUNT, idempotencyKey: key(), actorUserId: admin.id, actorCanManage: true, proof: { buffer: Buffer.from('z'), mimeType: 'image/png' }, now: AFTER_CYCLE }))).toBe('GROUP_CLOSED');
      expect((await payouts.listPayouts({ associationId: A, groupId: g.id })).length).toBe(2);
    });

    it('completes a rotating pot only when every round has been paid', async () => {
      const { g } = await pot();
      const late = new Date('2027-07-01T10:00:00Z');
      expect(await codeOf(payouts.completeGroup({ associationId: A, groupId: g.id, actorUserId: approver1.id, now: late }))).toBe('PAYOUTS_PENDING');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('reading, and other associations', () => {
    it('shows a person only their own payouts, with the account masked and no storage key', async () => {
      const { g, holder } = await pot();
      const paid = await pay(g.id, { round: 1 });
      const recipientUserId = (await prisma.member.findUniqueOrThrow({ where: { id: holder(1).memberId } })).userId as number;
      const mine = await payouts.listOwnPayouts({ associationId: A, userId: recipientUserId });
      expect(mine.map((p) => p.id)).toEqual([paid.payout.id]);
      expect(mine[0]).toMatchObject({ account: { masked: '••••6789' }, net: '₦20,000.00' });
      expect(JSON.stringify(mine)).not.toMatch(/0123456789|proofKey|payout-proofs/);
      const other = await mkMember(A);
      expect(await payouts.listOwnPayouts({ associationId: A, userId: other.userId as number })).toEqual([]);
    });

    it('treats another association’s group and payout as missing, for every action', async () => {
      const { g } = await pot();
      const prep = await prepare(g.id, { round: 1 });
      const asB = { associationId: B, actorUserId: adminB.id };
      expect(await codeOf(payouts.previewPayout({ associationId: B, groupId: g.id, round: 1, now: ROUND1 }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(payouts.preparePayout({ ...asB, groupId: g.id, round: 1, now: ROUND1 }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(payouts.prepareAllReady({ ...asB, groupId: g.id }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(payouts.listPayouts({ associationId: B, groupId: g.id }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(payouts.completeGroup({ ...asB, groupId: g.id }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(payouts.getPayout({ associationId: B, payoutId: prep.payout.id }))).toBe('PAYOUT_NOT_FOUND');
      expect(await codeOf(payouts.approvePayout({ ...asB, payoutId: prep.payout.id, now: ROUND1 }))).toBe('PAYOUT_NOT_FOUND');
      expect(await codeOf(payouts.voidPayout({ ...asB, payoutId: prep.payout.id, actorIsAdmin: true, reason: 'Trying across tenants' }))).toBe('PAYOUT_NOT_FOUND');
      expect(await codeOf(payouts.recordPayoutPaid({ ...asB, payoutId: prep.payout.id, reference: 'GTB-ACROSS-1' }))).toBe('PAYOUT_NOT_FOUND');
      expect(await codeOf(payouts.reversePaidPayout({ ...asB, payoutId: prep.payout.id, reason: 'Trying across tenants' }))).toBe('PAYOUT_NOT_FOUND');
      expect((await row(prep.payout.id)).status).toBe('PREPARED');
    });
  });
});
