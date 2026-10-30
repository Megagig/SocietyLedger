/**
 * Ajo T3 against a real (disposable) database: group lifecycle, rules and consent, joining, schedules, the rotating-pot draw, swaps and
 * exceptions, guarantors and collector assignments.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-groups --forceExit
 *
 * Only the edges are replaced: the plan's contributor limit, notifications and the permission lookup for collectors. The transactions,
 * locks, constraints, audit rows and encryption are the real thing. Times are passed in, so nothing depends on today's date.
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

const mockLimit = { value: 100 as number | null };
const collectors = new Set<number>();
const notices: Array<{ to: string; userId?: number; permission?: string; pushType: string; message: string }> = [];

jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: mockLimit.value } })),
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasPermission: jest.fn(async (ctx: { userId: number }) => collectors.has(ctx.userId)) },
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

const suite = TEST_DB ? describe : describe.skip;
// Real transactions against a shared database: under load a test can take longer than Jest's 5 seconds, and a test that times out keeps running into the next.
if (TEST_DB) jest.setTimeout(30000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const ACCOUNT = '0123456789';
const NOW = new Date('2027-02-01T10:00:00Z');
const BEFORE_START = new Date('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const DAY = 24 * 60 * 60 * 1000;
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
suite('Ajo groups, rules, schedules, order and collectors (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let rules: typeof import('../../src/modules/ajo/ajo-rules.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let draw: typeof import('../../src/modules/ajo/ajo-draw');
  let schedule: typeof import('../../src/modules/ajo/ajo-schedule.service');
  let collector: typeof import('../../src/modules/ajo/ajo-collector.service');
  let views: typeof import('../../src/modules/ajo/ajo-views.service');

  let A: number;
  let B: number;
  let officer: { id: number };
  let officerB: { id: number };
  let counter = 0;

  async function mkAssociation(label: string) {
    const slug = `ajo-g-${label}-${run}`;
    return prisma.association.create({ data: { name: `Ajo G ${label} ${run}`, slug, subdomain: slug } });
  }
  async function mkUser(associationId: number, label: string) {
    return prisma.user.create({ data: { associationId, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
  }
  async function mkMember(associationId: number, over: { withUser?: boolean; phone?: string } = {}) {
    const n = ++counter;
    const user = over.withUser ? await mkUser(associationId, 'member') : null;
    return prisma.member.create({
      data: { associationId, userId: user?.id ?? null, memberId: `G${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: over.phone ?? '08031234567', address: '12 Market Road, Aba', status: 'active' },
    });
  }

  const BANK = { bankName: 'GTBank', accountNumber: ACCOUNT, accountName: 'Market Circle Ajo' };

  async function newGroup(over: { fields?: Record<string, unknown>; rules?: Parameters<typeof rules.normaliseRules>[0]; bank?: boolean; assoc?: number; actor?: number } = {}) {
    return groups.createGroup({
      associationId: over.assoc ?? A,
      actorUserId: over.actor ?? officer.id,
      now: NOW,
      bank: over.bank === false ? undefined : BANK,
      rules: over.rules,
      fields: { name: `Market Circle ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500_000, startDate: START, cycleLength: 8, maxParticipants: 30, ...over.fields },
    });
  }
  async function openedGroup(over: Parameters<typeof newGroup>[0] = {}) {
    const g = await newGroup(over);
    await groups.openGroup({ associationId: over.assoc ?? A, groupId: g.id, actorUserId: officer.id, now: NOW });
    return g;
  }

  /** Add a person, record that they accepted the rules (by the officer, in person), and approve them. */
  async function join(groupId: number, opts: { shares?: number; withUser?: boolean; now?: Date; accept?: boolean; approve?: boolean } = {}) {
    const now = opts.now ?? NOW;
    const member = await mkMember(A, { withUser: opts.withUser });
    const membership = await members.addMember({ associationId: A, groupId, memberId: member.id, actorUserId: officer.id, shares: opts.shares });
    if (opts.accept !== false) await consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: officer.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now });
    const approval = opts.approve === false ? null : await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id, now });
    return { member, membership, approval };
  }

  async function startedThrift(people = 2) {
    const g = await openedGroup();
    const joined = [];
    for (let i = 0; i < people; i++) joined.push(await join(g.id));
    const started = await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: BEFORE_START });
    return { g, joined, started };
  }

  /** Three people, one of them with two shares: four slots. Drawn and started. */
  async function startedPot() {
    const g = await openedGroup({ fields: { model: 'ROTATING_POT', frequency: 'MONTHLY', contributionKobo: 5_000_000, cycleLength: null, maxParticipants: 3 } });
    const p1 = await join(g.id, { withUser: true });
    const p2 = await join(g.id, { withUser: true, shares: 2 });
    const p3 = await join(g.id, { withUser: true });
    await order.runDraw({ associationId: A, groupId: g.id, actorUserId: officer.id });
    await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: BEFORE_START });
    const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: g.id }, orderBy: { position: 'asc' } });
    return { g, p: [p1, p2, p3], slots };
  }

  const audits = (action: string, recordId?: number) => prisma.auditLog.findMany({ where: { associationId: A, action, ...(recordId ? { recordId } : {}) } });
  const installmentCount = (groupId: number) => prisma.ajoInstallment.count({ where: { membership: { groupId } } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    rules = require('../../src/modules/ajo/ajo-rules.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    draw = require('../../src/modules/ajo/ajo-draw');
    schedule = require('../../src/modules/ajo/ajo-schedule.service');
    collector = require('../../src/modules/ajo/ajo-collector.service');
    views = require('../../src/modules/ajo/ajo-views.service');
    A = (await mkAssociation('a')).id;
    B = (await mkAssociation('b')).id;
    officer = await mkUser(A, 'officer');
    officerB = await mkUser(B, 'officer-b');
  });

  beforeEach(() => {
    mockLimit.value = 100;
    collectors.clear();
    notices.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('group lifecycle (T3.1)', () => {
    it('creates a draft with version 1 of the rules, an encrypted bank account and an audit entry', async () => {
      const g = await newGroup();
      expect(g).toMatchObject({ status: 'DRAFT', contributionKobo: '500000', bankAccount: { bankName: 'GTBank', masked: '••••6789' } });

      const row = await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } });
      expect(row.bankAccountEnc).toBeTruthy();
      expect(row.bankAccountEnc).not.toContain(ACCOUNT);
      expect(row.bankAccountLast4).toBe('6789');

      const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: g.id } });
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ version: 1, lateFeeType: 'NONE', graceDays: 3, guarantorPolicy: 'OPTIONAL', remindersEnabled: true });

      const [entry] = await audits('AJO_GROUP_CREATED', g.id);
      expect(entry).toBeTruthy();
      expect(JSON.stringify(entry)).not.toContain(ACCOUNT);
    });

    it('takes nobody while it is a draft, and opening needs the bank account', async () => {
      const noBank = await newGroup({ bank: false });
      expect(await codeOf(groups.openGroup({ associationId: A, groupId: noBank.id, actorUserId: officer.id, now: NOW }))).toBe('BANK_ACCOUNT_REQUIRED');

      const g = await newGroup();
      const member = await mkMember(A);
      expect(await codeOf(members.addMember({ associationId: A, groupId: g.id, memberId: member.id, actorUserId: officer.id }))).toBe('GROUP_NOT_OPEN');

      const opened = await groups.openGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: NOW });
      expect(opened.status).toBe('OPEN');
      await groups.openGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: NOW }); // opening twice is harmless
      expect(await audits('AJO_GROUP_OPENED', g.id)).toHaveLength(1);
      await expect(members.addMember({ associationId: A, groupId: g.id, memberId: member.id, actorUserId: officer.id })).resolves.toBeTruthy();
    });

    it('refuses a start date that has passed', async () => {
      await expect(groups.createGroup({ associationId: A, actorUserId: officer.id, now: new Date('2027-04-01T10:00:00Z'), fields: { name: 'Late', model: 'COLLECTOR_THRIFT', frequency: 'DAILY', contributionKobo: 100_000, startDate: START, cycleLength: 10, maxParticipants: 5 } })).rejects.toMatchObject({ code: 'START_DATE_PASSED' });
    });

    it('starts a collector-thrift group: every active person gets a schedule, the money fields lock, and starting again changes nothing', async () => {
      const { g, started } = await startedThrift(3);
      expect(started.group).toMatchObject({ status: 'ACTIVE' });
      expect(started.installments).toBe(24); // 3 people × 8 weekly instalments
      expect(iso(started.group.endsOn as Date)).toBe('2027-04-19');
      expect(await installmentCount(g.id)).toBe(24);

      const again = await groups.startGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: BEFORE_START });
      expect(again.replayed).toBe(true);
      expect(await installmentCount(g.id)).toBe(24);
      expect(await audits('AJO_GROUP_STARTED', g.id)).toHaveLength(1);

      for (const fields of [{ contributionKobo: 600_000 }, { frequency: 'DAILY' as const }, { cycleLength: 10 }, { startDate: '2027-03-08' }, { cutoffTime: '17:00' }, { collectorFeeType: 'FIXED' as const, collectorFeeValue: 1000 }]) {
        expect(await codeOf(groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields, now: BEFORE_START }))).toBe('GROUP_LOCKED');
      }
      const renamed = await groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields: { name: 'Renamed Circle' }, now: BEFORE_START });
      expect(renamed.group.name).toBe('Renamed Circle');
    });

    it('will not start with nobody in it, from a draft, or twice at the same moment', async () => {
      const g = await openedGroup();
      expect(await codeOf(groups.startGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: BEFORE_START }))).toBe('NOT_ENOUGH_PARTICIPANTS');
      const draft = await newGroup();
      expect(await codeOf(groups.startGroup({ associationId: A, groupId: draft.id, actorUserId: officer.id, now: BEFORE_START }))).toBe('INVALID_GROUP_STATE');

      const ready = await openedGroup();
      await join(ready.id);
      const results = await Promise.all([groups.startGroup({ associationId: A, groupId: ready.id, actorUserId: officer.id, now: BEFORE_START }), groups.startGroup({ associationId: A, groupId: ready.id, actorUserId: officer.id, now: BEFORE_START })]);
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect(await installmentCount(ready.id)).toBe(8);
      expect(await audits('AJO_GROUP_STARTED', ready.id)).toHaveLength(1);
    });

    it('cancels with a reason, tells the members, and then refuses to open, start or edit', async () => {
      const g = await openedGroup();
      const { member } = await join(g.id, { withUser: true });
      expect(await codeOf(groups.cancelGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, reason: 'no' }))).toBe('REASON_REQUIRED');

      const cancelled = await groups.cancelGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, reason: 'Not enough people signed up', now: NOW });
      expect(cancelled.group).toMatchObject({ status: 'CANCELLED', cancelReason: 'Not enough people signed up' });
      expect(notices.some((n) => n.userId === member.userId && n.pushType === 'ajo.group_cancelled')).toBe(true);

      expect(await codeOf(groups.openGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: NOW }))).toBe('INVALID_GROUP_STATE');
      expect(await codeOf(groups.startGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, now: BEFORE_START }))).toBe('INVALID_GROUP_STATE');
      expect(await codeOf(groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields: { name: 'x1' } }))).toBe('GROUP_CLOSED');
      expect((await groups.cancelGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, reason: 'Not enough people signed up' })).replayed).toBe(true);
      expect(await audits('AJO_GROUP_CANCELLED', g.id)).toHaveLength(1);
    });

    it('will not cancel a group with confirmed money on its books', async () => {
      const { g, joined } = await startedThrift(1);
      await prisma.ajoContribution.create({ data: { associationId: A, groupId: g.id, membershipId: joined[0].membership.id, amountKobo: 500_000n, method: 'CASH', status: 'CONFIRMED', reference: `ref-${run}`, idempotencyKey: `idem-${run}-cancel`, receivedAt: BEFORE_START } });
      expect(await codeOf(groups.cancelGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, reason: 'We want to stop this group' }))).toBe('GROUP_HAS_MONEY');
      expect((await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).status).toBe('ACTIVE');
    });

    it('never lets the number of places drop below the people already in', async () => {
      const g = await openedGroup({ fields: { maxParticipants: 5 } });
      for (let i = 0; i < 3; i++) await join(g.id);
      expect(await codeOf(groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields: { maxParticipants: 2 } }))).toBe('CAP_BELOW_MEMBERS');
      await expect(groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields: { maxParticipants: 3 } })).resolves.toMatchObject({ changed: ['maxParticipants'] });
    });

    it('treats another association’s group as missing, for every action', async () => {
      const g = await openedGroup();
      const asB = { associationId: B, groupId: g.id, actorUserId: officerB.id };
      expect(await codeOf(groups.updateGroup({ ...asB, fields: { name: 'Hijack' } }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(groups.openGroup({ ...asB, now: NOW }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(groups.startGroup({ ...asB, now: BEFORE_START }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(groups.cancelGroup({ ...asB, reason: 'Trying something' }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(rules.publishRuleVersion({ ...asB, rules: { graceDays: 9 }, now: NOW }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(order.runDraw(asB))).toBe('GROUP_NOT_FOUND');
      const member = await mkMember(B);
      expect(await codeOf(members.addMember({ ...asB, memberId: member.id }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(views.listGroupMembers({ associationId: B, groupId: g.id }))).toBe('GROUP_NOT_FOUND');
      expect((await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).name).not.toBe('Hijack');
    });

    it('lists a person’s groups only, and every group for a manager', async () => {
      const g1 = await openedGroup();
      const g2 = await openedGroup();
      const { member } = await join(g1.id, { withUser: true });
      const mine = await groups.listGroups({ associationId: A, userId: member.userId as number, isManager: false });
      expect(mine.map((g) => g.id)).toEqual([g1.id]);
      const all = await groups.listGroups({ associationId: A, userId: officer.id, isManager: true });
      expect(all.map((g) => g.id)).toEqual(expect.arrayContaining([g1.id, g2.id]));
      expect(await groups.listGroups({ associationId: B, userId: officerB.id, isManager: true })).toEqual([]);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the group’s own bank account', () => {
    it('is shown in full to its members and officers, masked everywhere else, and never written to an audit row or a notice', async () => {
      const g = await openedGroup();
      const { member } = await join(g.id, { withUser: true });
      const outsider = await mkMember(A, { withUser: true });

      const full = await groups.getGroupBankAccount({ associationId: A, groupId: g.id, userId: member.userId as number, isManager: false });
      expect(full).toMatchObject({ accountNumber: ACCOUNT, masked: '••••6789' });
      expect((await groups.getGroupBankAccount({ associationId: A, groupId: g.id, userId: officer.id, isManager: true })).accountNumber).toBe(ACCOUNT);
      expect(await codeOf(groups.getGroupBankAccount({ associationId: A, groupId: g.id, userId: outsider.userId as number, isManager: false }))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(groups.getGroupBankAccount({ associationId: B, groupId: g.id, userId: officerB.id, isManager: true }))).toBe('GROUP_NOT_FOUND');

      // The detail and list views carry the masked form only.
      const detail = await groups.getGroupDetail({ associationId: A, groupId: g.id, userId: member.userId as number, isManager: false });
      expect(JSON.stringify(detail)).not.toContain(ACCOUNT);
      expect(detail.bankAccount).toMatchObject({ masked: '••••6789' });

      // Changing the account is audited (masked), and tells every member.
      const NEW_ACCOUNT = '9876543210';
      const changed = await groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, bank: { bankName: 'Access Bank', accountNumber: NEW_ACCOUNT, accountName: 'Market Circle Ajo' }, now: NOW });
      expect(changed.replayed).toBe(false);
      expect(notices.some((n) => n.userId === member.userId && n.pushType === 'ajo.group_account_changed')).toBe(true);
      expect((await groups.getGroupBankAccount({ associationId: A, groupId: g.id, userId: member.userId as number, isManager: false })).accountNumber).toBe(NEW_ACCOUNT);

      const trail = JSON.stringify(await prisma.auditLog.findMany({ where: { associationId: A, tableName: 'ajo_groups', recordId: g.id } }));
      expect(trail).not.toContain(ACCOUNT);
      expect(trail).not.toContain(NEW_ACCOUNT);
      expect(trail).toContain('••••3210');
      expect(JSON.stringify(notices)).not.toContain(ACCOUNT);
      expect(JSON.stringify(notices)).not.toContain(NEW_ACCOUNT);

      // The same details again change nothing and tell nobody.
      notices.length = 0;
      const same = await groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, bank: { bankName: 'Access Bank', accountNumber: NEW_ACCOUNT, accountName: 'Market Circle Ajo' }, now: NOW });
      expect(same.replayed).toBe(true);
      expect(notices).toEqual([]);
    });

    it('cannot be decrypted onto another group', async () => {
      const g1 = await newGroup();
      const g2 = await newGroup();
      const r1 = await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g1.id } });
      const { decryptGroupAccountNumber } = require('../../src/modules/ajo/ajo-secrets');
      expect(decryptGroupAccountNumber(g1.id, r1.bankAccountEnc as string)).toBe(ACCOUNT);
      expect(() => decryptGroupAccountNumber(g2.id, r1.bankAccountEnc as string)).toThrow();
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('rules and acceptance (T3.2)', () => {
    it('keeps a person pending until the rules are accepted, by the member themselves', async () => {
      const g = await openedGroup();
      const { member, membership, approval } = await join(g.id, { withUser: true, accept: false });
      expect(approval).toMatchObject({ status: 'PENDING', activated: false, unmet: ['RULE_ACCEPTANCE'] });
      expect(await codeOf(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id }))).toBe('MEMBERSHIP_NOT_ACTIVE');

      const done = await consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: member.userId as number, actorIsOfficer: false, device: 'mobile', now: NOW });
      expect(done).toMatchObject({ ruleVersion: 1, channel: 'app', replayed: false });
      expect(done.activation).toMatchObject({ status: 'ACTIVE', activated: true });

      const row = await prisma.ajoRuleAcceptance.findFirstOrThrow({ where: { membershipId: membership.id } });
      expect(row.evidence).toMatchObject({ channel: 'app', device: 'mobile' });
      expect(row.acceptedAt).toBeInstanceOf(Date);
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).resolves.toBeUndefined();
      expect(await audits('AJO_RULES_ACCEPTED', row.id)).toHaveLength(1);
    });

    it('lets an officer record it for someone with no login, but only with a note saying how', async () => {
      const g = await openedGroup();
      const { membership } = await join(g.id, { accept: false });
      const base = { associationId: A, membershipId: membership.id, actorUserId: officer.id, actorIsOfficer: true, now: NOW };
      expect(await codeOf(consent.acceptRules(base))).toBe('NOTE_REQUIRED');
      expect(await codeOf(consent.acceptRules({ ...base, note: 'ok' }))).toBe('NOTE_REQUIRED');

      const done = await consent.acceptRules({ ...base, note: 'read aloud in Igbo, agreed in person' });
      expect(done.channel).toBe('officer');
      const row = await prisma.ajoRuleAcceptance.findFirstOrThrow({ where: { membershipId: membership.id } });
      expect(row.evidence).toMatchObject({ channel: 'officer', recordedBy: officer.id, note: 'read aloud in Igbo, agreed in person' });
      expect(JSON.stringify(await audits('AJO_RULES_ACCEPTED', row.id))).toContain('read aloud in Igbo');
    });

    it('refuses anyone else, and counts an officer accepting for themselves as the member’s own acceptance', async () => {
      const g = await openedGroup();
      const { membership } = await join(g.id, { accept: false });
      const stranger = await mkUser(A, 'stranger');
      expect(await codeOf(consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: stranger.id, actorIsOfficer: false, now: NOW }))).toBe('FORBIDDEN');
      expect(await codeOf(consent.acceptRules({ associationId: B, membershipId: membership.id, actorUserId: officerB.id, actorIsOfficer: true, note: 'trying across', now: NOW }))).toBe('MEMBERSHIP_NOT_FOUND');

      // An officer who is also a member of the group: their own acceptance is recorded as theirs ("app"), never as an officer's say-so.
      const own = await join(g.id, { withUser: true, accept: false });
      const done = await consent.acceptRules({ associationId: A, membershipId: own.membership.id, actorUserId: own.member.userId as number, actorIsOfficer: true, now: NOW });
      expect(done.channel).toBe('app');
    });

    it('is safe to repeat: one acceptance row, replayed', async () => {
      const g = await openedGroup();
      const { membership } = await join(g.id, { accept: false });
      const base = { associationId: A, membershipId: membership.id, actorUserId: officer.id, actorIsOfficer: true, note: 'read aloud, agreed', now: NOW };
      const first = await consent.acceptRules(base);
      const second = await consent.acceptRules(base);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.acceptanceId).toBe(first.acceptanceId);
      expect(await prisma.ajoRuleAcceptance.count({ where: { membershipId: membership.id } })).toBe(1);
      expect(await audits('AJO_RULES_ACCEPTED', first.acceptanceId)).toHaveLength(1);
    });

    it('publishes a new version with at least seven days’ notice, tells the members, and keeps the old version', async () => {
      const g = await openedGroup();
      const { member, membership } = await join(g.id, { withUser: true });
      expect(await codeOf(rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 7 }, effectiveFrom: new Date(NOW.getTime() + 3 * DAY), now: NOW }))).toBe('NOTICE_TOO_SHORT');

      const v2 = await rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 7, lateFeeType: 'FIXED', lateFeeValue: 50_000n }, now: NOW });
      expect(v2.version).toBe(2);
      expect(v2.effectiveFrom.getTime()).toBe(NOW.getTime() + 7 * DAY);
      expect(notices.some((n) => n.userId === member.userId && n.pushType === 'ajo.rules_changed')).toBe(true);

      const versions = await rules.listRuleVersions(prisma, g.id);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
      expect(versions[0].rules.graceDays).toBe(3); // the old version is untouched
      expect(versions[1].rules).toMatchObject({ graceDays: 7, lateFeeType: 'FIXED', lateFeeValue: 50_000n, guarantorPolicy: 'OPTIONAL' });

      // The member accepted v1 only, so v1 still binds them.
      const inForce = await rules.ruleVersionInForce(prisma, membership.id);
      expect(inForce?.version.version).toBe(1);
      expect(inForce?.rules.graceDays).toBe(3);
      expect((await audits('AJO_RULES_PUBLISHED')).length).toBeGreaterThan(0);
    });

    it('refuses a second change while one is waiting, and a change that changes nothing', async () => {
      const g = await openedGroup();
      expect(await codeOf(rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 3 }, now: NOW }))).toBe('RULES_UNCHANGED');
      await rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 5 }, now: NOW });
      expect(await codeOf(rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 9 }, now: NOW }))).toBe('CHANGE_PENDING');
      // Once it has taken effect, the next change is allowed.
      await expect(rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 9 }, now: new Date(NOW.getTime() + 8 * DAY) })).resolves.toMatchObject({ version: 3 });
    });

    it('binds a member by the version they accepted, and never stops anyone contributing for not accepting a newer one', async () => {
      const g = await openedGroup();
      const { member, membership } = await join(g.id, { withUser: true });
      await rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 7 }, now: NOW });
      const later = new Date(NOW.getTime() + 8 * DAY);

      // v2 is in effect now. This member has only accepted v1: still active, still able to contribute, and v1 still binds them.
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).resolves.toBeUndefined();
      expect((await rules.ruleVersionInForce(prisma, membership.id))?.version.version).toBe(1);

      // The roster shows who has not accepted the newest version.
      expect(await rules.acceptanceStats(prisma, g.id)).toMatchObject({ latestVersion: 2, accepted: 0, total: 1, pendingMembershipIds: [membership.id] });

      // Accepting v2 moves them onto it.
      await consent.acceptRules({ associationId: A, membershipId: membership.id, actorUserId: member.userId as number, actorIsOfficer: false, now: later });
      expect((await rules.ruleVersionInForce(prisma, membership.id))?.version.version).toBe(2);
      expect(await rules.acceptanceStats(prisma, g.id)).toMatchObject({ latestVersion: 2, accepted: 1, total: 1, pendingMembershipIds: [] });
    });

    it('makes a newcomer accept the version in effect when they join', async () => {
      const g = await openedGroup();
      await rules.publishRuleVersion({ associationId: A, groupId: g.id, actorUserId: officer.id, rules: { graceDays: 7 }, now: NOW });
      const later = new Date(NOW.getTime() + 8 * DAY);

      // Before v2 takes effect, accepting v1 is enough to join.
      const early = await join(g.id, { accept: false });
      const v1 = await prisma.ajoGroupRuleVersion.findFirstOrThrow({ where: { groupId: g.id, version: 1 } });
      const ok = await consent.acceptRules({ associationId: A, membershipId: early.membership.id, ruleVersionId: v1.id, actorUserId: officer.id, actorIsOfficer: true, note: 'read aloud, agreed', now: NOW });
      expect(ok.activation.status).toBe('ACTIVE');

      // After it takes effect, v1 is no longer enough for someone still waiting.
      const waiting = await join(g.id, { accept: false, approve: false });
      await consent.acceptRules({ associationId: A, membershipId: waiting.membership.id, ruleVersionId: v1.id, actorUserId: officer.id, actorIsOfficer: true, note: 'read aloud, agreed', now: later });
      const approval = await members.approveMembership({ associationId: A, membershipId: waiting.membership.id, actorUserId: officer.id, now: later });
      expect(approval).toMatchObject({ status: 'PENDING', unmet: ['RULE_ACCEPTANCE'] });
    });

    it('shows the roster what each person is waiting for and how their acceptance was recorded', async () => {
      const g = await openedGroup();
      await join(g.id);
      await join(g.id, { accept: false });
      const view = await views.listGroupMembers({ associationId: A, groupId: g.id, now: NOW });
      const [done, waiting] = view.people;
      expect(done).toMatchObject({ status: 'ACTIVE', acceptedRuleVersion: 1, acceptedVia: 'officer', waitingFor: [] });
      expect(waiting.status).toBe('PENDING');
      expect(waiting.waitingFor.map((w) => w.requirement)).toEqual(['RULE_ACCEPTANCE']);
      expect(view.rules).toMatchObject({ latestVersion: 1, accepted: 1, total: 2 });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('guarantors (T3.6)', () => {
    const consentFor = (membershipId: number, over: Record<string, string> = {}) => ({ associationId: A, membershipId, actorUserId: officer.id, name: 'Mrs Ngozi Eze', phone: '08099998888', relationship: 'aunt', note: 'spoke to her on the phone and read it out', now: NOW, ...over });

    it('keeps a member pending until the required guarantor’s consent is recorded, with the exact wording stored', async () => {
      const g = await openedGroup({ rules: { guarantorPolicy: 'REQUIRED' } });
      const { membership, approval } = await join(g.id);
      expect(approval).toMatchObject({ status: 'PENDING', unmet: ['GUARANTOR_CONSENT'] });

      expect(await codeOf(consent.recordGuarantorConsent(consentFor(membership.id, { note: '' })))).toBe('NOTE_REQUIRED');
      expect(await codeOf(consent.recordGuarantorConsent(consentFor(membership.id, { name: ' ' })))).toBe('INVALID_GUARANTOR');
      expect(await codeOf(consent.recordGuarantorConsent(consentFor(membership.id, { phone: 'abc' })))).toBe('INVALID_GUARANTOR');
      expect(await codeOf(consent.recordGuarantorConsent(consentFor(membership.id, { phone: '08031234567' })))).toBe('GUARANTOR_IS_MEMBER');

      const done = await consent.recordGuarantorConsent(consentFor(membership.id));
      expect(done.activation).toMatchObject({ status: 'ACTIVE', activated: true });

      const row = await prisma.ajoGuarantorAgreement.findUniqueOrThrow({ where: { id: done.agreementId } });
      const member = await prisma.member.findFirstOrThrow({ where: { ajoMemberships: { some: { id: membership.id } } } });
      expect(row.wording).toBe(consent.guarantorWording({ guarantorName: 'Mrs Ngozi Eze', memberName: `${member.firstName} ${member.lastName}`, groupName: (await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).name }));
      expect(row.wording).toMatch(/not a legal guarantee/);
      expect(row).toMatchObject({ name: 'Mrs Ngozi Eze', relationship: 'aunt', recordedBy: officer.id });
      expect(row.acceptedAt).toBeInstanceOf(Date);
      expect(row.evidence).toMatchObject({ channel: 'officer' });
      expect(await audits('AJO_GUARANTOR_RECORDED', row.id)).toHaveLength(1);
    });

    it('keeps an earlier agreement on file when a new guarantor replaces it', async () => {
      const g = await openedGroup({ rules: { guarantorPolicy: 'OPTIONAL' } });
      const { membership } = await join(g.id);
      const first = await consent.recordGuarantorConsent(consentFor(membership.id));
      const second = await consent.recordGuarantorConsent(consentFor(membership.id, { name: 'Chief Obi', phone: '08077776666', relationship: 'neighbour' }));
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } })).guarantorAgreementId).toBe(second.agreementId);
      expect(await prisma.ajoGuarantorAgreement.count({ where: { id: { in: [first.agreementId, second.agreementId] } } })).toBe(2);
    });

    it('refuses a guarantor where the group does not use them, or for another association’s member', async () => {
      const none = await openedGroup({ rules: { guarantorPolicy: 'NOT_REQUIRED' } });
      const { membership } = await join(none.id);
      expect(await codeOf(consent.recordGuarantorConsent(consentFor(membership.id)))).toBe('GUARANTOR_NOT_USED');
      expect(await codeOf(consent.recordGuarantorConsent({ ...consentFor(membership.id), associationId: B, actorUserId: officerB.id }))).toBe('MEMBERSHIP_NOT_FOUND');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('joining a group that is running (T3.3)', () => {
    it('gives a late joiner only the instalments from the day they joined, ending with everyone else’s', async () => {
      const { g } = await startedThrift(2);
      const joinedAt = new Date('2027-03-20T10:00:00Z');
      const late = await join(g.id, { now: joinedAt });
      expect(late.approval).toMatchObject({ status: 'ACTIVE', activated: true });

      const rows = await prisma.ajoInstallment.findMany({ where: { membershipId: late.membership.id }, orderBy: { dueDate: 'asc' } });
      expect(rows.map((r) => iso(r.dueDate))).toEqual(['2027-03-22', '2027-03-29', '2027-04-05', '2027-04-12', '2027-04-19']);
      const founder = await prisma.ajoInstallment.findMany({ where: { membership: { groupId: g.id, id: { not: late.membership.id } } }, orderBy: { dueDate: 'desc' }, take: 1 });
      expect(iso(founder[0].dueDate)).toBe('2027-04-19');
      expect(rows.every((r) => r.amountKobo === 500_000n)).toBe(true);

      // Regenerating later never back-fills the weeks before they were there.
      await prisma.$transaction((tx) => schedule.generateGroupSchedule(tx, { groupId: g.id, now: new Date('2027-03-25T10:00:00Z') }));
      expect(await prisma.ajoInstallment.count({ where: { membershipId: late.membership.id } })).toBe(5);
    });

    it('can be switched off for a group, and a started rotating pot is frozen', async () => {
      const { g } = await startedThrift(1);
      await groups.updateGroup({ associationId: A, groupId: g.id, actorUserId: officer.id, fields: { allowLateJoin: false }, now: BEFORE_START });
      const member = await mkMember(A);
      expect(await codeOf(members.addMember({ associationId: A, groupId: g.id, memberId: member.id, actorUserId: officer.id }))).toBe('LATE_JOIN_CLOSED');

      const { g: pot } = await startedPot();
      expect(await codeOf(members.addMember({ associationId: A, groupId: pot.id, memberId: member.id, actorUserId: officer.id }))).toBe('ROSTER_FROZEN');
    });

    it('keeps a full group (a seat) and a full plan (a contributor slot) apart', async () => {
      const g = await openedGroup({ fields: { maxParticipants: 1 } });
      await join(g.id);
      const extra = await mkMember(A);
      expect(await codeOf(members.addMember({ associationId: A, groupId: g.id, memberId: extra.id, actorUserId: officer.id }))).toBe('GROUP_FULL');

      const roomy = await openedGroup();
      mockLimit.value = 0;
      const blocked = await join(roomy.id);
      expect(blocked.approval).toMatchObject({ status: 'PENDING', blockedByLimit: { code: 'AJO_CONTRIBUTOR_LIMIT' } });
    });

    it('removes instalments still ahead when someone leaves, but never one with money against it', async () => {
      const { g, joined } = await startedThrift(1);
      const mid = joined[0].membership.id;
      // 2027-03-22 has money against it; 2027-03-01 and 03-08 are already past.
      await prisma.ajoInstallment.updateMany({ where: { membershipId: mid, dueDate: new Date('2027-03-22T00:00:00Z') }, data: { paidKobo: 100_000n, status: 'PARTIAL' } });

      const left = await members.leaveMembership({ associationId: A, membershipId: mid, actorUserId: officer.id, reason: 'moved away', now: new Date('2027-03-10T10:00:00Z') });
      expect(left).toMatchObject({ status: 'LEFT', replayed: false });
      const rows = await prisma.ajoInstallment.findMany({ where: { membershipId: mid }, orderBy: { dueDate: 'asc' } });
      expect(rows.map((r) => iso(r.dueDate))).toEqual(['2027-03-01', '2027-03-08', '2027-03-22']);
      expect(rows[2].paidKobo).toBe(100_000n);

      expect((await members.leaveMembership({ associationId: A, membershipId: mid, actorUserId: officer.id })).replayed).toBe(true);
      expect(await audits('AJO_MEMBER_LEFT', mid)).toHaveLength(1);
      expect(g.id).toBeGreaterThan(0);
    });

    it('lets a person who left be added again, as a fresh pending member', async () => {
      const g = await openedGroup();
      const first = await join(g.id);
      await members.leaveMembership({ associationId: A, membershipId: first.membership.id, actorUserId: officer.id });
      const again = await members.addMember({ associationId: A, groupId: g.id, memberId: first.member.id, actorUserId: officer.id });
      expect(again.id).toBe(first.membership.id);
      expect(again).toMatchObject({ status: 'PENDING', approvedAt: null });
      expect(await codeOf(members.addMember({ associationId: A, groupId: g.id, memberId: first.member.id, actorUserId: officer.id }))).toBe('ALREADY_IN_GROUP');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the schedule (T3.4)', () => {
    it('can be regenerated any number of times without a duplicate or a change', async () => {
      const { g } = await startedThrift(3);
      const before = await prisma.ajoInstallment.findMany({ where: { membership: { groupId: g.id } }, orderBy: [{ membershipId: 'asc' }, { dueDate: 'asc' }] });
      for (let i = 0; i < 3; i++) {
        const summary = await prisma.$transaction((tx) => schedule.generateGroupSchedule(tx, { groupId: g.id, now: BEFORE_START }));
        expect(summary).toMatchObject({ created: 0, removed: 0, repriced: 0, memberships: 3 });
      }
      const after = await prisma.ajoInstallment.findMany({ where: { membership: { groupId: g.id } }, orderBy: [{ membershipId: 'asc' }, { dueDate: 'asc' }] });
      expect(after.map((r) => [r.id, iso(r.dueDate), r.amountKobo])).toEqual(before.map((r) => [r.id, iso(r.dueDate), r.amountKobo]));
    });

    it('repairs a missing instalment without touching a paid one', async () => {
      const { g, joined } = await startedThrift(1);
      const mid = joined[0].membership.id;
      await prisma.ajoInstallment.updateMany({ where: { membershipId: mid, dueDate: new Date('2027-03-08T00:00:00Z') }, data: { paidKobo: 500_000n, status: 'PAID' } });
      await prisma.ajoInstallment.deleteMany({ where: { membershipId: mid, dueDate: new Date('2027-03-15T00:00:00Z') } });
      const summary = await prisma.$transaction((tx) => schedule.generateGroupSchedule(tx, { groupId: g.id, now: BEFORE_START }));
      expect(summary.created).toBe(1);
      expect(await prisma.ajoInstallment.count({ where: { membershipId: mid } })).toBe(8);
      expect((await prisma.ajoInstallment.findFirstOrThrow({ where: { membershipId: mid, dueDate: new Date('2027-03-08T00:00:00Z') } })).paidKobo).toBe(500_000n);
    });

    it('will not make a schedule for a group that has not started', async () => {
      const g = await openedGroup();
      const { membership } = await join(g.id);
      await expect(prisma.$transaction((tx) => schedule.syncMembershipSchedule(tx, { groupId: g.id, membershipId: membership.id, now: NOW }))).rejects.toMatchObject({ code: 'GROUP_NOT_STARTED' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('rotating pot: shares, the draw and starting (T3.7)', () => {
    async function openPot(over: Record<string, unknown> = {}) {
      return openedGroup({ fields: { model: 'ROTATING_POT', frequency: 'MONTHLY', contributionKobo: 5_000_000, cycleLength: null, maxParticipants: 5, ...over } });
    }

    it('keeps shares within the group’s limit, and only in a rotating pot', async () => {
      const pot = await openPot();
      const member = await mkMember(A);
      expect(await codeOf(members.addMember({ associationId: A, groupId: pot.id, memberId: member.id, actorUserId: officer.id, shares: 3 }))).toBe('TOO_MANY_SHARES');
      expect(await codeOf(members.addMember({ associationId: A, groupId: pot.id, memberId: member.id, actorUserId: officer.id, shares: 0 }))).toBe('INVALID_SHARES');
      const thrift = await openedGroup();
      expect(await codeOf(members.addMember({ associationId: A, groupId: thrift.id, memberId: member.id, actorUserId: officer.id, shares: 2 }))).toBe('SHARES_NOT_USED');

      const added = await members.addMember({ associationId: A, groupId: pot.id, memberId: member.id, actorUserId: officer.id, shares: 2 });
      expect(added.shares).toBe(2);
      expect(await members.setShares({ associationId: A, membershipId: added.id, shares: 1, actorUserId: officer.id })).toMatchObject({ shares: 1, replayed: false });
      expect((await members.setShares({ associationId: A, membershipId: added.id, shares: 1, actorUserId: officer.id })).replayed).toBe(true);
      expect(await audits('AJO_SHARES_CHANGED', added.id)).toHaveLength(1);
    });

    it('draws one slot per share, saves the seed, and can be reproduced from it', async () => {
      const pot = await openPot();
      const p1 = await join(pot.id, { withUser: true });
      const p2 = await join(pot.id, { shares: 2 });
      await join(pot.id);

      const result = await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      expect(result).toMatchObject({ slots: 4, redraw: false });
      expect(result.seed).toMatch(/^[0-9a-f]{32}$/);

      const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: pot.id }, orderBy: { position: 'asc' } });
      expect(slots.map((s) => s.position)).toEqual([1, 2, 3, 4]);
      expect(slots.filter((s) => s.membershipId === p2.membership.id)).toHaveLength(2);

      // Anyone can redo the draw from the saved seed and get the same order.
      const redone = draw.drawOrder({ slots: order.expectedSlots(await prisma.ajoMembership.findMany({ where: { groupId: pot.id, status: 'ACTIVE' }, select: { id: true, shares: true } })), seed: result.seed });
      expect(redone.positions.map((p) => [p.membershipId, p.shareNo, p.position])).toEqual(slots.map((s) => [s.membershipId, s.shareNo, s.position]));

      // Every participant can see the order, the seed, and which positions are theirs.
      const seen = await order.getOrder(prisma, pot.id, p1.member.userId as number);
      expect(seen).toMatchObject({ drawn: true, seed: result.seed });
      expect(seen.slots.filter((s) => s.mine).map((s) => s.membershipId)).toEqual([p1.membership.id]);
      expect((await audits('AJO_ORDER_DRAWN')).length).toBeGreaterThan(0);
    });

    it('refuses to re-roll the same roster, and allows a new draw only after the roster or the shares change', async () => {
      const pot = await openPot();
      await join(pot.id);
      const p2 = await join(pot.id);
      await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      expect(await codeOf(order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id }))).toBe('DRAW_ALREADY_DONE');

      await members.setShares({ associationId: A, membershipId: p2.membership.id, shares: 2, actorUserId: officer.id });
      expect(await codeOf(groups.startGroup({ associationId: A, groupId: pot.id, actorUserId: officer.id, confirmSmallerGroup: true, now: BEFORE_START }))).toBe('DRAW_REQUIRED');
      const again = await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      expect(again).toMatchObject({ redraw: true, slots: 3 });
      expect(await prisma.ajoPayoutOrderEvent.count({ where: { groupId: pot.id, type: 'DRAW' } })).toBe(2);
      expect(await prisma.ajoPayoutSlot.count({ where: { groupId: pot.id } })).toBe(3);
    });

    it('says when a draw is out of date and why, and allows (and only then) a new draw, so a circle drawn too early can still start', async () => {
      const pot = await openPot();
      await join(pot.id);
      await join(pot.id);
      const waiting = await join(pot.id, { approve: false });
      const before = await order.getOrder(prisma, pot.id, null);
      expect(before).toMatchObject({ drawn: false, canDraw: true, pendingPeople: 1 });

      await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      const fresh = await order.getOrder(prisma, pot.id, null);
      expect(fresh).toMatchObject({ drawn: true, current: true, stale: false, canDraw: false, staleBecause: null });

      // The person waiting is approved after the draw: the draw no longer matches the circle.
      await members.approveMembership({ associationId: A, membershipId: waiting.membership.id, actorUserId: officer.id, now: NOW });
      const stale = await order.getOrder(prisma, pot.id, null);
      expect(stale).toMatchObject({ drawn: true, current: false, stale: true, canDraw: true, pendingPeople: 0 });
      expect(stale.staleBecause).toBe('1 person was approved since the draw');
      expect(await codeOf(groups.startGroup({ associationId: A, groupId: pot.id, actorUserId: officer.id, confirmSmallerGroup: true, now: BEFORE_START }))).toBe('DRAW_REQUIRED');

      const again = await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      expect(again).toMatchObject({ redraw: true, slots: 3 });
      expect(await order.getOrder(prisma, pot.id, null)).toMatchObject({ current: true, stale: false, canDraw: false });
      expect(await prisma.ajoPayoutOrderEvent.count({ where: { groupId: pot.id, type: 'DRAW' } })).toBe(2);
    });

    it('needs the draw, an empty waiting list and an admin’s confirmation before it starts, then fixes the rounds and prices every share', async () => {
      const pot = await openPot();
      const p1 = await join(pot.id);
      const p2 = await join(pot.id, { shares: 2 });
      const waiting = await join(pot.id, { approve: false });
      const start = (confirm?: boolean) => groups.startGroup({ associationId: A, groupId: pot.id, actorUserId: officer.id, confirmSmallerGroup: confirm, now: BEFORE_START });

      expect(await codeOf(start(true))).toBe('PENDING_MEMBERS');
      await members.leaveMembership({ associationId: A, membershipId: waiting.membership.id, actorUserId: officer.id });
      expect(await codeOf(start(true))).toBe('DRAW_REQUIRED');
      await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: officer.id });
      expect(await codeOf(start())).toBe('CONFIRM_SMALLER_GROUP'); // 2 people for 5 places

      const started = await start(true);
      expect(started.group).toMatchObject({ status: 'ACTIVE', rounds: 3, maxParticipants: 2 });
      expect(iso(started.group.endsOn as Date)).toBe('2027-05-01'); // 3 monthly rounds from 1 March
      const a = await prisma.ajoInstallment.findMany({ where: { membershipId: p1.membership.id } });
      const b = await prisma.ajoInstallment.findMany({ where: { membershipId: p2.membership.id } });
      expect(a).toHaveLength(3);
      expect(b).toHaveLength(3);
      expect(new Set(a.map((r) => r.amountKobo))).toEqual(new Set([5_000_000n]));
      expect(new Set(b.map((r) => r.amountKobo))).toEqual(new Set([10_000_000n])); // two shares: double, every round
    });

    it('freezes shares, the draw and leaving once it has started', async () => {
      const { g, p } = await startedPot();
      expect(await codeOf(members.setShares({ associationId: A, membershipId: p[0].membership.id, shares: 2, actorUserId: officer.id }))).toBe('GROUP_LOCKED');
      expect(await codeOf(order.runDraw({ associationId: A, groupId: g.id, actorUserId: officer.id }))).toBe('INVALID_GROUP_STATE');
      expect(await codeOf(members.leaveMembership({ associationId: A, membershipId: p[0].membership.id, actorUserId: officer.id }))).toBe('USE_DEFAULT_PROCESS');
    });

    it('only draws a rotating pot', async () => {
      const g = await openedGroup();
      expect(await codeOf(order.runDraw({ associationId: A, groupId: g.id, actorUserId: officer.id }))).toBe('NOT_A_ROTATING_POT');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('swaps and emergency exceptions (T3.7)', () => {
    const positions = async (groupId: number) => (await prisma.ajoPayoutSlot.findMany({ where: { groupId }, orderBy: { position: 'asc' } })).map((s) => s.id);

    it('moves two slots only when the admin approves, and records the swap', async () => {
      const { g, p, slots } = await startedPot();
      const mine = slots.find((s) => s.membershipId === p[0].membership.id)!;
      const theirs = slots.find((s) => s.membershipId === p[2].membership.id)!;
      const before = await positions(g.id);

      const req = await order.requestSwap({ associationId: A, groupId: g.id, slotAId: mine.id, slotBId: theirs.id, actorUserId: p[0].member.userId as number, actorIsOfficer: false, reason: 'We agreed' });
      expect(req.status).toBe('PENDING');
      expect(await positions(g.id)).toEqual(before); // nothing moves until the admin decides
      expect(notices.some((n) => n.to === 'holders' && n.permission === 'ajo.approve_payout' && n.pushType === 'ajo.swap_requested')).toBe(true);
      expect(notices.some((n) => n.userId === p[2].member.userId && n.pushType === 'ajo.swap_requested')).toBe(true);

      const admin = await mkUser(A, 'admin');
      const decided = await order.decideSwap({ associationId: A, requestId: req.requestId, decision: 'APPROVED', actorUserId: admin.id });
      expect(decided).toMatchObject({ status: 'APPROVED', applied: true });
      const after = await prisma.ajoPayoutSlot.findMany({ where: { id: { in: [mine.id, theirs.id] } } });
      expect(after.find((s) => s.id === mine.id)!.position).toBe(theirs.position);
      expect(after.find((s) => s.id === theirs.id)!.position).toBe(mine.position);
      expect(new Set((await prisma.ajoPayoutSlot.findMany({ where: { groupId: g.id } })).map((s) => s.position))).toEqual(new Set([1, 2, 3, 4]));

      const event = await prisma.ajoPayoutOrderEvent.findFirstOrThrow({ where: { groupId: g.id, type: 'SWAP' } });
      expect(event).toMatchObject({ approvedBy: admin.id, requestedBy: p[0].member.userId, reason: 'We agreed' });
      expect(await audits('AJO_SWAP_APPROVED', event.id)).toHaveLength(1);

      expect(await codeOf(order.decideSwap({ associationId: A, requestId: req.requestId, decision: 'APPROVED', actorUserId: admin.id }))).toBe('ALREADY_DECIDED');
    });

    it('leaves the order alone when the swap is rejected', async () => {
      const { g, p, slots } = await startedPot();
      const a = slots.find((s) => s.membershipId === p[0].membership.id)!;
      const b = slots.find((s) => s.membershipId === p[2].membership.id)!;
      const before = await positions(g.id);
      const req = await order.requestSwap({ associationId: A, groupId: g.id, slotAId: a.id, slotBId: b.id, actorUserId: officer.id, actorIsOfficer: true });
      const decided = await order.decideSwap({ associationId: A, requestId: req.requestId, decision: 'REJECTED', actorUserId: (await mkUser(A, 'admin')).id, note: 'Not now' });
      expect(decided).toMatchObject({ status: 'REJECTED', applied: false });
      expect(await positions(g.id)).toEqual(before);
      expect(await prisma.ajoPayoutOrderEvent.count({ where: { groupId: g.id, type: 'SWAP' } })).toBe(0);
    });

    it('refuses a swap nobody involved asked for, one between a person’s own slots, a duplicate, and an admin judging their own position', async () => {
      const { g, p, slots } = await startedPot();
      const s1 = slots.find((s) => s.membershipId === p[0].membership.id)!;
      const s3 = slots.find((s) => s.membershipId === p[2].membership.id)!;
      const own = slots.filter((s) => s.membershipId === p[1].membership.id);
      const base = { associationId: A, groupId: g.id };

      expect(await codeOf(order.requestSwap({ ...base, slotAId: s1.id, slotBId: s3.id, actorUserId: p[1].member.userId as number, actorIsOfficer: false }))).toBe('FORBIDDEN');
      expect(await codeOf(order.requestSwap({ ...base, slotAId: own[0].id, slotBId: own[1].id, actorUserId: officer.id, actorIsOfficer: true }))).toBe('SAME_PERSON');
      expect(await codeOf(order.requestSwap({ ...base, slotAId: s1.id, slotBId: s1.id, actorUserId: officer.id, actorIsOfficer: true }))).toBe('INVALID_SWAP');

      const first = await order.requestSwap({ ...base, slotAId: s1.id, slotBId: s3.id, actorUserId: officer.id, actorIsOfficer: true });
      expect(await codeOf(order.requestSwap({ ...base, slotAId: s3.id, slotBId: s1.id, actorUserId: officer.id, actorIsOfficer: true }))).toBe('SWAP_PENDING');
      // The person judging cannot hold one of the slots.
      expect(await codeOf(order.decideSwap({ associationId: A, requestId: first.requestId, decision: 'APPROVED', actorUserId: p[0].member.userId as number }))).toBe('CONFLICT_OF_INTEREST');
      expect((await prisma.ajoOrderChangeRequest.findUniqueOrThrow({ where: { id: first.requestId } })).status).toBe('PENDING');
    });

    it('treats other associations’ slots and requests as missing', async () => {
      const { g, p, slots } = await startedPot();
      const a = slots.find((s) => s.membershipId === p[0].membership.id)!;
      const b = slots.find((s) => s.membershipId === p[2].membership.id)!;
      expect(await codeOf(order.requestSwap({ associationId: B, groupId: g.id, slotAId: a.id, slotBId: b.id, actorUserId: officerB.id, actorIsOfficer: true }))).toBe('GROUP_NOT_FOUND');
      const req = await order.requestSwap({ associationId: A, groupId: g.id, slotAId: a.id, slotBId: b.id, actorUserId: officer.id, actorIsOfficer: true });
      expect(await codeOf(order.decideSwap({ associationId: B, requestId: req.requestId, decision: 'APPROVED', actorUserId: officerB.id }))).toBe('REQUEST_NOT_FOUND');
    });

    it('allows an exception only after a payout has been paid, never moves a paid slot, and needs a written reason', async () => {
      const { g, p, slots } = await startedPot();
      const target = slots[3]; // position 4
      const base = { associationId: A, groupId: g.id, slotId: target.id, newPosition: 3, actorUserId: officer.id };

      expect(await codeOf(order.emergencyException({ ...base, reason: 'The member has a family emergency' }))).toBe('EXCEPTION_NOT_NEEDED');

      // The first round is paid out.
      await prisma.ajoPayout.create({ data: { associationId: A, groupId: g.id, membershipId: slots[0].membershipId, round: 1, grossKobo: 25_000_000n, netKobo: 25_000_000n, status: 'PAID', preparedBy: officer.id, accountSnapshot: { bankName: 'GTBank', last4: '6789' }, idempotencyKey: `payout-${run}-${g.id}`, paidAt: BEFORE_START } });

      expect(await codeOf(order.requestSwap({ associationId: A, groupId: g.id, slotAId: slots[1].id, slotBId: slots[3].id, actorUserId: officer.id, actorIsOfficer: true }))).toBe('USE_EXCEPTION');
      expect(await codeOf(order.emergencyException({ ...base, reason: 'too short' }))).toBe('REASON_REQUIRED');
      expect(await codeOf(order.emergencyException({ ...base, slotId: slots[0].id, newPosition: 3, reason: 'The member has a family emergency' }))).toBe('EXCEPTION_NOT_ALLOWED'); // already paid
      expect(await codeOf(order.emergencyException({ ...base, newPosition: 1, reason: 'The member has a family emergency' }))).toBe('EXCEPTION_NOT_ALLOWED'); // onto a paid position

      const done = await order.emergencyException({ ...base, reason: 'The member has a family emergency' });
      expect(done.moved.length).toBeGreaterThan(0);
      const now = await prisma.ajoPayoutSlot.findMany({ where: { groupId: g.id }, orderBy: { position: 'asc' } });
      expect(now.map((s) => s.position)).toEqual([1, 2, 3, 4]);
      expect(now[0].id).toBe(slots[0].id); // the paid slot did not move
      expect(now.find((s) => s.id === target.id)!.position).toBe(3);
      expect(now.find((s) => s.id === slots[2].id)!.position).toBe(4);

      const event = await prisma.ajoPayoutOrderEvent.findFirstOrThrow({ where: { groupId: g.id, type: 'EXCEPTION' } });
      expect(event.reason).toBe('The member has a family emergency');
      expect(await audits('AJO_ORDER_EXCEPTION', event.id)).toHaveLength(1);
      expect(notices.some((n) => n.pushType === 'ajo.order_exception' && n.message.includes('family emergency'))).toBe(true);
      expect(p.length).toBe(3);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('collector assignments (T3.5)', () => {
    async function twoCollectors() {
      const c1 = await mkUser(A, 'collector');
      const c2 = await mkUser(A, 'collector');
      collectors.add(c1.id);
      collectors.add(c2.id);
      return { c1, c2 };
    }

    it('assigns a collector, shows them only their own contributors, and replays safely', async () => {
      const { c1, c2 } = await twoCollectors();
      const g = await openedGroup();
      const mine = await join(g.id);
      const other = await join(g.id);

      const first = await collector.assignCollector({ associationId: A, membershipId: mine.membership.id, collectorUserId: c1.id, dailyTargetKobo: 200_000, actorUserId: officer.id, now: NOW });
      expect(first).toMatchObject({ collectorUserId: c1.id, dailyTargetKobo: '200000', replayed: false });
      expect(notices.some((n) => n.userId === c1.id && n.pushType === 'ajo.collector_assigned')).toBe(true);
      const replay = await collector.assignCollector({ associationId: A, membershipId: mine.membership.id, collectorUserId: c1.id, dailyTargetKobo: 200_000, actorUserId: officer.id, now: NOW });
      expect(replay).toMatchObject({ replayed: true, assignmentId: first.assignmentId });
      expect(await prisma.ajoCollectorAssignment.count({ where: { membershipId: mine.membership.id } })).toBe(1);

      const list = await collector.listAssignedContributors({ associationId: A, collectorUserId: c1.id, now: NOW });
      expect(list.map((r) => r.membershipId)).toEqual([mine.membership.id]);
      expect(list.map((r) => r.membershipId)).not.toContain(other.membership.id);
      expect(await collector.listAssignedContributors({ associationId: A, collectorUserId: c2.id, now: NOW })).toEqual([]);
    });

    it('reassigns by ending the old assignment, not editing it, and tells both collectors', async () => {
      const { c1, c2 } = await twoCollectors();
      const g = await openedGroup();
      const { membership } = await join(g.id);
      await collector.assignCollector({ associationId: A, membershipId: membership.id, collectorUserId: c1.id, actorUserId: officer.id, now: NOW });
      notices.length = 0;
      await collector.assignCollector({ associationId: A, membershipId: membership.id, collectorUserId: c2.id, dailyTargetKobo: 100_000, startsOn: new Date('2027-02-10T00:00:00Z'), actorUserId: officer.id, now: NOW });

      const rows = await prisma.ajoCollectorAssignment.findMany({ where: { membershipId: membership.id }, orderBy: { id: 'asc' } });
      expect(rows).toHaveLength(2);
      expect(iso(rows[0].endsOn as Date)).toBe('2027-02-09');
      expect(rows[1].endsOn).toBeNull();
      expect(notices.map((n) => `${n.userId}:${n.pushType}`).sort()).toEqual([`${c1.id}:ajo.collector_unassigned`, `${c2.id}:ajo.collector_assigned`].sort());

      const day = new Date('2027-02-15T10:00:00Z');
      expect(await collector.listAssignedContributors({ associationId: A, collectorUserId: c1.id, now: day })).toEqual([]);
      expect((await collector.listAssignedContributors({ associationId: A, collectorUserId: c2.id, now: day })).map((r) => r.membershipId)).toEqual([membership.id]);
      expect((await collector.listGroupAssignments({ associationId: A, groupId: g.id })).length).toBe(2);
      expect((await audits('AJO_COLLECTOR_REASSIGNED')).length).toBeGreaterThan(0);

      expect(await collector.unassignCollector({ associationId: A, membershipId: membership.id, actorUserId: officer.id, now: day })).toEqual({ ended: true });
      expect(await collector.unassignCollector({ associationId: A, membershipId: membership.id, actorUserId: officer.id, now: day })).toEqual({ ended: false });
    });

    it('only assigns real collectors from the same association, and only that association’s contributors', async () => {
      const { c1 } = await twoCollectors();
      const g = await openedGroup();
      const { membership } = await join(g.id);
      const notACollector = await mkUser(A, 'plain');
      const otherAssoc = await mkUser(B, 'collector-b');
      collectors.add(otherAssoc.id);

      expect(await codeOf(collector.assignCollector({ associationId: A, membershipId: membership.id, collectorUserId: notACollector.id, actorUserId: officer.id }))).toBe('NOT_A_COLLECTOR');
      expect(await codeOf(collector.assignCollector({ associationId: A, membershipId: membership.id, collectorUserId: otherAssoc.id, actorUserId: officer.id }))).toBe('COLLECTOR_NOT_FOUND');
      expect(await codeOf(collector.assignCollector({ associationId: B, membershipId: membership.id, collectorUserId: otherAssoc.id, actorUserId: officerB.id }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await codeOf(collector.assignCollector({ associationId: A, membershipId: membership.id, collectorUserId: c1.id, dailyTargetKobo: -5, actorUserId: officer.id }))).toBe('INVALID_TARGET');
      expect(await codeOf(collector.unassignCollector({ associationId: B, membershipId: membership.id, actorUserId: officerB.id }))).toBe('MEMBERSHIP_NOT_FOUND');
      expect(await prisma.ajoCollectorAssignment.count({ where: { membershipId: membership.id } })).toBe(0);
    });
  });
});
