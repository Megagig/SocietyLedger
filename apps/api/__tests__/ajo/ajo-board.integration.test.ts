/**
 * The Circle board (spec §16) against a real (disposable) database: who may see it, what it shows, and, above all, what it never shows.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-board.integration --forceExit
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

jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })),
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return { ...actual, notifyUser: jest.fn(async () => undefined), notifyPermissionHolders: jest.fn(async () => undefined) };
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
/** Round 1 of a weekly pot starting 1 March is due 1 March; its grace ends 4 March. On the due day it is the round being collected. */
const ROUND1_DAY = at('2027-03-01T10:00:00Z');
const START = '2027-03-01';
const AMOUNT = 500_000n;

// Things that must never come out of a board response, whatever the view.
const PHONE = '08031234567';
const ADDRESS = '12 Market Road, Aba';
const GROUP_ACCOUNT = '0123456789';
const FORBIDDEN_KEYS = /phone|email|address|account|guarantor|note|proof|evidence|bank|password|token|secret/i;

function keysOf(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keysOf(v, path));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, v]) => [`${path}.${key}`, ...keysOf(v, `${path}.${key}`)]);
  return [];
}

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('The Circle board (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let board: typeof import('../../src/modules/ajo/ajo-board.service');
  let rulesService: typeof import('../../src/modules/ajo/ajo-rules.service');

  interface World {
    A: number;
    admin: { id: number };
    recon: { id: number };
    roles: Map<string, number>;
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-board-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Board ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), recon: await user('recon'), roles: new Map() };
    const permission = await prisma.permission.upsert({ where: { key: 'ajo.reconcile' }, create: { key: 'ajo.reconcile', description: 'Test', module: 'Ajo' }, update: {} });
    const role = await prisma.role.create({ data: { associationId: w.A, name: `board-recon-${run}-${++counter}`, displayName: 'recon' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await prisma.userRole.create({ data: { userId: w.recon.id, roleId: role.id, associationId: w.A } });
    return w;
  }
  async function mkMember(w: World, first = 'Adaeze') {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `member-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `BRD${run}${n}`, firstName: first, lastName: `Okafor${n}`, email: `member-${run}-${n}@test.local`, phone: PHONE, address: ADDRESS, status: 'active' } });
  }
  async function joinMember(w: World, groupId: number, member: { id: number }, o: { accept?: boolean } = {}) {
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id });
    if (o.accept === false) return membership;
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return membership;
  }
  async function newGroup(w: World, fields: Record<string, unknown>, rules?: Record<string, unknown>) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: GROUP_ACCOUNT, accountName: 'Market Circle Ajo' },
      rules: rules as never,
      fields: { name: `Circle ${++counter}`, frequency: 'WEEKLY', contributionKobo: Number(AMOUNT), startDate: START, maxParticipants: 30, ...fields } as never,
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  /** A started rotating pot of three. Its rules start with the circle board on, as every new rotating pot does. */
  async function pot(w: World, rules?: Record<string, unknown>) {
    const g = await newGroup(w, { model: 'ROTATING_POT', maxParticipants: 3 }, rules);
    const people = [];
    for (let i = 0; i < 3; i += 1) {
      const member = await mkMember(w);
      people.push({ member, membership: await joinMember(w, g.id, member) });
    }
    await order.runDraw({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    return { g, people };
  }
  const asMember = (member: { userId: number | null }) => ({ userId: member.userId as number, isOfficer: false });
  async function report(w: World, groupId: number, membershipId: number, now: Date) {
    return contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: AMOUNT, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`proof-${run}-${++counter}`), mimeType: 'image/png' }, now });
  }
  async function pay(w: World, groupId: number, membershipId: number, now: Date) {
    const rep = await report(w, groupId, membershipId, now);
    await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now });
    return rep.contribution.id;
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    board = require('../../src/modules/ajo/ajo-board.service');
    rulesService = require('../../src/modules/ajo/ajo-rules.service');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('who may see it', () => {
    it('shows a circle to its own members and officers, and to nobody else', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const outsider = await mkMember(w);
      const base = { associationId: w.A, groupId: g.id, now: ROUND1_DAY };
      expect(await codeOf(board.boardOverview({ ...base, viewer: asMember(people[0].member) }))).toBe('NO_ERROR');
      expect(await codeOf(board.boardOverview({ ...base, viewer: { userId: w.admin.id, isOfficer: true } }))).toBe('NO_ERROR');
      expect(await codeOf(board.boardOverview({ ...base, viewer: asMember(outsider) }))).toBe('GROUP_NOT_FOUND');
    });

    it('shows nothing of one circle to a member of another circle in the same association', async () => {
      const w = await world();
      const a = await pot(w);
      const b = await pot(w);
      expect(await codeOf(board.boardMatrix({ associationId: w.A, groupId: a.g.id, viewer: asMember(b.people[0].member), now: ROUND1_DAY }))).toBe('GROUP_NOT_FOUND');
    });

    it('is not available for a collector-thrift scheme, even to an officer', async () => {
      const w = await world();
      const g = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
      const member = await mkMember(w);
      await joinMember(w, g.id, member);
      await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
      for (const viewer of [asMember(member), { userId: w.admin.id, isOfficer: true }]) {
        expect(await codeOf(board.boardOverview({ associationId: w.A, groupId: g.id, viewer, now: ROUND1_DAY }))).toBe('BOARD_NOT_AVAILABLE');
      }
    });

    it('stays closed to members when the admin has the circle board off, but officers can still open it', async () => {
      const w = await world();
      const { g, people } = await pot(w, { memberVisibility: 'OFF' });
      expect(await codeOf(board.boardOverview({ associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: ROUND1_DAY }))).toBe('BOARD_OFF');
      expect(await codeOf(board.boardOverview({ associationId: w.A, groupId: g.id, viewer: { userId: w.admin.id, isOfficer: true }, now: ROUND1_DAY }))).toBe('NO_ERROR');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('what it never shows (spec §16.2, acceptance 3)', () => {
    it('has no phone, email, address, bank account, guarantor, note or proof anywhere in any view, for a member or an officer', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      // Real activity, so every view has something in it: a confirmed payment with a proof file, a reported one, a reversal, a payout.
      const confirmedId = await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      await report(w, g.id, people[1].membership.id, ROUND1_DAY);
      const proofKeys = (await prisma.ajoContribution.findMany({ where: { groupId: g.id }, select: { proofKey: true, reference: true } })).flatMap((c) => [c.proofKey]).filter((k): k is string => !!k);
      expect(proofKeys.length).toBeGreaterThan(0);
      await prisma.ajoPayout.create({ data: { associationId: w.A, groupId: g.id, membershipId: people[0].membership.id, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.admin.id, approvedBy: w.admin.id, paidRecordedBy: w.recon.id, accountSnapshot: { bankName: 'GTBank', accountName: 'Secret Name', last4: '6789' }, paidReference: `ref-${run}-4821`, paidAt: at('2027-03-02T12:00:00Z'), idempotencyKey: `payout-${run}-${++counter}` } });
      void confirmedId;

      const views = (viewer: { userId: number; isOfficer: boolean }) => {
        const base = { associationId: w.A, groupId: g.id, viewer, now: ROUND1_DAY };
        return Promise.all([board.boardOverview(base), board.boardRound({ ...base, round: 1 }), board.boardMatrix(base), board.boardPayouts(base), board.boardMembers(base), board.boardArrears(base), board.boardMetrics(base), board.boardActivity(base)]);
      };
      for (const viewer of [asMember(people[1].member), { userId: w.admin.id, isOfficer: true }]) {
        const responses = await views(viewer);
        const text = JSON.stringify(responses);
        expect(text).not.toContain(PHONE);
        expect(text).not.toContain(PHONE.slice(1));
        expect(text).not.toContain(ADDRESS);
        expect(text).not.toContain('Market Road');
        expect(text).not.toContain(GROUP_ACCOUNT);
        expect(text).not.toContain('@test.local');
        expect(text).not.toContain('Secret Name');
        for (const key of proofKeys) expect(text).not.toContain(key);
        expect(keysOf(responses).filter((key) => FORBIDDEN_KEYS.test(key.split('.').pop() as string))).toEqual([]);
      }
    });

    it('shows other members by first name and last initial only, never the whole surname', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const view = await board.boardMembers({ associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: ROUND1_DAY });
      const others = view.people.filter((p) => !p.isYou);
      expect(others).toHaveLength(2);
      for (const p of others) expect(p.name).toMatch(/^Adaeze O\.$/);
      expect(JSON.stringify(view)).not.toContain('Okafor');
    });

    it('shows full names when the group chose them, and still never contact details', async () => {
      const w = await world();
      const { g, people } = await pot(w, { nameDisplay: 'FULL' });
      const view = await board.boardMembers({ associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: ROUND1_DAY });
      expect(view.people.map((p) => p.name).every((n) => /^Adaeze Okafor\d+$/.test(n))).toBe(true);
      expect(JSON.stringify(view)).not.toContain(PHONE);
    });

    it('shows a person who has not accepted the board rule as "Member n", to other members but not to officers or to themselves', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const silent = await mkMember(w, 'Chinedu');
      // Added to the circle but has not accepted any rule version, so the board has no consent to show their name.
      await prisma.ajoMembership.create({ data: { associationId: w.A, groupId: g.id, memberId: silent.id, status: 'ACTIVE', shares: 1 } });
      const asOther = await board.boardMembers({ associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: ROUND1_DAY });
      expect(asOther.people.some((p) => /^Member \d+$/.test(p.name))).toBe(true);
      expect(JSON.stringify(asOther)).not.toContain('Chinedu');
      const asOfficer = await board.boardMembers({ associationId: w.A, groupId: g.id, viewer: { userId: w.admin.id, isOfficer: true }, now: ROUND1_DAY });
      expect(JSON.stringify(asOfficer)).toContain('Chinedu');
      const asSelf = await board.boardMembers({ associationId: w.A, groupId: g.id, viewer: asMember(silent), now: ROUND1_DAY });
      expect(asSelf.people.find((p) => p.isYou)?.name).toBe('Chinedu O.');
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('what it shows (spec §16.3)', () => {
    it('shows a reported payment as Reported and not as paid, until an officer confirms it', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const rep = await report(w, g.id, people[0].membership.id, ROUND1_DAY);
      const viewer = asMember(people[1].member);
      let round = await board.boardRound({ associationId: w.A, groupId: g.id, viewer, round: 1, now: ROUND1_DAY });
      const row = () => round.people.find((p) => p.membershipId === people[0].membership.id);
      expect(row()).toMatchObject({ status: 'REPORTED', label: 'Reported, awaiting confirmation' });
      expect(round.summary.paidCount).toBe(0);
      expect(round.summary.collectedKobo).toBe('0');

      await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now: ROUND1_DAY });
      round = await board.boardRound({ associationId: w.A, groupId: g.id, viewer, round: 1, now: ROUND1_DAY });
      expect(row()).toMatchObject({ status: 'PAID_ON_TIME' });
      expect(round.summary).toMatchObject({ paidCount: 1, collectedKobo: AMOUNT.toString() });
      expect(row()?.receiptLast4).toHaveLength(4);
    });

    it('shows a disputed round as Under review, never as missed, even long after grace', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const [inst] = await prisma.ajoInstallment.findMany({ where: { membershipId: people[0].membership.id }, orderBy: { dueDate: 'asc' } });
      await prisma.ajoDispute.create({ data: { associationId: w.A, membershipId: people[0].membership.id, installmentId: inst.id, claim: 'I paid by transfer on the 1st', status: 'OPEN' } });
      const late = at('2027-03-20T10:00:00Z');
      const round = await board.boardRound({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), round: 1, now: late });
      expect(round.people.find((p) => p.membershipId === people[0].membership.id)).toMatchObject({ status: 'UNDER_REVIEW' });
      const arrears = await board.boardArrears({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), now: late });
      // Rounds 2 and 3 really are missed by then; the disputed round 1 is not counted in what they are behind.
      const mine = arrears.behind.find((r) => r.membershipId === people[0].membership.id);
      expect(mine).toMatchObject({ roundsMissed: 2, behindKobo: (AMOUNT * 2n).toString(), behindText: 'Behind by ₦10,000.00' });
      expect(JSON.stringify(arrears).toLowerCase()).not.toContain('defaulter');
    });

    it('says Overdue inside grace and Missed after it, with "Behind by" in full naira', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const viewer = asMember(people[1].member);
      const inGrace = await board.boardRound({ associationId: w.A, groupId: g.id, viewer, round: 1, now: at('2027-03-03T10:00:00Z') });
      expect(inGrace.people[0]).toMatchObject({ status: 'OVERDUE', graceEndsOn: '2027-03-04' });
      const after = await board.boardRound({ associationId: w.A, groupId: g.id, viewer, round: 1, now: at('2027-03-10T10:00:00Z') });
      expect(after.people[0].status).toBe('MISSED');
      const arrears = await board.boardArrears({ associationId: w.A, groupId: g.id, viewer, now: at('2027-03-10T10:00:00Z') });
      expect(arrears.behind[0].behindText).toMatch(/^Behind by ₦5,000\.00$/);
    });

    it('agrees with the instalment records the officers work from', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      await pay(w, g.id, people[2].membership.id, ROUND1_DAY);
      const round = await board.boardRound({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), round: 1, now: ROUND1_DAY });
      const first = await prisma.ajoInstallment.findMany({ where: { membership: { groupId: g.id } }, orderBy: { dueDate: 'asc' } });
      const dueFirst = first.filter((i) => i.dueDate.getTime() === first[0].dueDate.getTime());
      expect(round.summary.collectedKobo).toBe(dueFirst.reduce((s, i) => s + i.paidKobo, 0n).toString());
      expect(round.summary.expectedKobo).toBe(dueFirst.reduce((s, i) => s + i.amountKobo, 0n).toString());
    });

    it('lists those who still need to act first, then those who have paid', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const round = await board.boardRound({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), round: 1, now: ROUND1_DAY });
      expect(round.people.map((p) => p.status)).toEqual(['DUE', 'DUE', 'PAID_ON_TIME']);
      const paidOnly = await board.boardRound({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), round: 1, filter: 'PAID', now: ROUND1_DAY });
      expect(paidOnly.people).toHaveLength(1);
      expect(await codeOf(board.boardRound({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), round: 99, now: ROUND1_DAY }))).toBe('ROUND_NOT_FOUND');
    });

    it('gives the overview, the matrix, the payouts and the figures a shape the screens can draw', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const base = { associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: ROUND1_DAY };
      const overview = await board.boardOverview(base);
      expect(overview.header).toMatchObject({ round: 1, totalRounds: 3, contributionPerShareKobo: AMOUNT.toString(), timezone: 'Africa/Lagos' });
      expect(overview.thisRound).toMatchObject({ round: 1, paidCount: 1, expectedCount: 3 });
      expect(overview.you).toMatchObject({ upToDate: true, shares: 1 });
      expect(overview.upNext?.position).toBe(1);
      const matrix = await board.boardMatrix(base);
      expect(matrix.rounds).toHaveLength(3);
      expect(matrix.members).toHaveLength(3);
      expect(matrix.members.find((m) => m.isYou)).toMatchObject({ roundsPaid: 1, roundsDue: 1 });
      const payouts = await board.boardPayouts(base);
      expect(payouts.rows.map((r) => r.position)).toEqual([1, 2, 3]);
      expect(payouts.drawn).toBe(true);
      const metrics = await board.boardMetrics(base);
      expect(metrics.recordedBalance.caption).toContain('bank statement is the final word');
      expect(metrics.membersUpToDate).toMatchObject({ total: 3 });
      const roster = await board.boardMembers(base);
      expect(roster.counts).toMatchObject({ members: 3, shares: 3 });
    });

    it('says why a payout is held, in a category that gives nothing private away', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const payouts = await board.boardPayouts({ associationId: w.A, groupId: g.id, viewer: asMember(people[0].member), now: at('2027-03-03T10:00:00Z') });
      const held = payouts.rows.find((r) => r.position === 1);
      expect(held?.status).toBe('HELD');
      expect(held?.holdReason).toMatch(/verification|payout account|not fully collected|prepare/i);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('the rules a member accepts', () => {
    it('start with the board on for a new rotating pot, and can never be on for collector thrift', async () => {
      const w = await world();
      const { g } = await pot(w);
      const versions = await rulesService.listRuleVersions(prisma, g.id);
      expect(versions[0].rules).toMatchObject({ memberVisibility: 'FULL', nameDisplay: 'FIRST_INITIAL' });
      expect(versions[0].summary.join(' ')).toContain('Other members of this circle can see your name');

      const thrift = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
      expect((await rulesService.listRuleVersions(prisma, thrift.id))[0].rules.memberVisibility).toBe('OFF');
      expect(await codeOf(groups.createGroup({ associationId: w.A, actorUserId: w.admin.id, now: NOW, rules: { memberVisibility: 'FULL' } as never, fields: { name: 'Bad', model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500000, startDate: START, cycleLength: 3, maxParticipants: 5 } as never }))).toBe('VISIBILITY_NOT_ALLOWED');
    });
  });
  describe('what the short-lived cache saves', () => {
    let counting = false;
    let queries = 0;
    let hooked = false;

    it('serves a repeat open of the board with no database queries, and works it out again after a payment is confirmed', async () => {
      const cache = require('../../src/modules/ajo/ajo-cache') as typeof import('../../src/modules/ajo/ajo-cache');
      if (!hooked) {
        hooked = true;
        prisma.$use(async (params, next) => {
          if (counting) queries += 1;
          return next(params);
        });
      }
      const w = await world();
      const { g, people } = await pot(w);
      cache.resetAjoCacheForTests();
      const viewer = asMember(people[0].member);
      const base = { associationId: w.A, groupId: g.id, viewer, now: ROUND1_DAY };
      // The eight reads the board screens make, each through the same cache the controller uses.
      const reads: Array<[string, () => Promise<unknown>]> = [
        ['overview', () => board.boardOverview(base)],
        ['round', () => board.boardRound({ ...base, round: 1 })],
        ['matrix', () => board.boardMatrix(base)],
        ['payouts', () => board.boardPayouts(base)],
        ['members', () => board.boardMembers(base)],
        ['arrears', () => board.boardArrears(base)],
        ['metrics', () => board.boardMetrics(base)],
        ['activity', () => board.boardActivity(base)],
      ];
      const perRead: Record<string, number> = {};
      const openBoard = async () => {
        const answers: unknown[] = [];
        for (const [name, run] of reads) {
          const before = queries;
          answers.push(await cache.ajoCached(w.A, viewer, ['board', g.id, name], run));
          perRead[name] = queries - before;
        }
        return answers;
      };
      const count = async () => {
        queries = 0;
        counting = true;
        const answers = await openBoard();
        counting = false;
        return { answers, queries };
      };

      const first = await count();
      const perReadFirst = { ...perRead };
      const repeat = await count();
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY); // a payment is confirmed...
      await cache.bumpAjoCache(w.A); // ...which bumps the version before the writer's response, as the route middleware does
      const afterPayment = await count();

      console.log(`[measure] circle board, 8 reads: first open ${first.queries} database queries, repeat open ${repeat.queries}, first open after a confirmed payment ${afterPayment.queries}`);
      console.log(`[measure] first open, queries per read: ${JSON.stringify(perReadFirst)}`);
      expect(first.queries).toBeGreaterThan(0);
      expect(repeat.queries).toBe(0);
      expect(repeat.answers).toEqual(JSON.parse(JSON.stringify(first.answers)));
      expect(afterPayment.queries).toBeGreaterThan(0);
      expect(JSON.stringify(afterPayment.answers)).not.toEqual(JSON.stringify(repeat.answers)); // the new payment is in what they see
    });
  });

});
