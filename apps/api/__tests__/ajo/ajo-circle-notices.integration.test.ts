/**
 * Circle notifications (spec §16.4.9) against a real (disposable) database: a round fully paid, a payout recorded, your turn, and the weekly summary.
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
const told: Array<{ userId: number; pushType: string; message: string }> = [];
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

/** The text drawn on an uncompressed pdfkit page. It stores each string as hex, so decode them, and keep the raw bytes too. */
const pdfText = (file: Buffer): string => {
  const raw = file.toString('latin1');
  // A line is one TJ array of hex pieces with kerning numbers between them: join the pieces of each array into one string.
  const decoded = [...raw.matchAll(/\[((?:<[0-9a-fA-F]*>|\s|-?[\d.]+)+)\]\s*TJ/g)]
    .map((line) => [...(line[1] as string).matchAll(/<([0-9a-fA-F]*)>/g)].map((piece) => Buffer.from(piece[1] as string, 'hex').toString('latin1')).join(''))
    .join('\n');
  return `${raw}\n${decoded}`;
};

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Circle notifications (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let board: typeof import('../../src/modules/ajo/ajo-board.service');
  let rulesService: typeof import('../../src/modules/ajo/ajo-rules.service');
  let notices: typeof import('../../src/modules/ajo/ajo-circle-notices.service');

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
  const boardOverviewOf = (w: World, groupId: number, viewer: { userId: number; isOfficer: boolean }) => require('../../src/modules/ajo/ajo-board.service').boardOverview({ associationId: w.A, groupId, viewer, now: ROUND1_DAY });
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
    notices = require('../../src/modules/ajo/ajo-circle-notices.service');
  });

  beforeEach(() => {
    told.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const ofKind = (pushType: string) => told.filter((t) => t.pushType === pushType);
  const userIdsOf = (people: Array<{ member: { userId: number | null } }>) => people.map((p) => p.member.userId as number).sort((a, b) => a - b);
  /** All three people pay round 1 on its due day. */
  async function fundRound1(w: World, groupId: number, people: Array<{ membership: { id: number } }>) {
    for (const p of people) await pay(w, groupId, p.membership.id, ROUND1_DAY);
  }

  describe('a round that is fully paid', () => {
    it('tells every member once, says who receives it and when, and not again', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      expect((await notices.sweepCircle(g.id, ROUND1_DAY)).roundsFunded).toBe(0); // nothing paid yet
      await fundRound1(w, g.id, people);
      const first = await notices.sweepCircle(g.id, ROUND1_DAY);
      expect(first.roundsFunded).toBe(1);
      const sent = ofKind('ajo.circle_round_funded');
      expect(sent.map((s) => s.userId).sort((a, b) => a - b)).toEqual(userIdsOf(people));
      expect(sent[0].message).toBe('Round 1 is fully paid. Adaeze O. receives ₦15,000.00 on 1 Mar.');
      told.length = 0;
      expect((await notices.sweepCircle(g.id, ROUND1_DAY)).roundsFunded).toBe(0);
      expect(told).toHaveLength(0);
    });

    it('does not name a recipient who has not accepted the rule that lets others see their name', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await fundRound1(w, g.id, people);
      const slot = await prisma.ajoPayoutSlot.findFirstOrThrow({ where: { groupId: g.id, position: 1 } });
      await prisma.ajoRuleAcceptance.deleteMany({ where: { membershipId: slot.membershipId } });
      await notices.sweepCircle(g.id, ROUND1_DAY);
      const message = ofKind('ajo.circle_round_funded')[0].message;
      expect(message).toBe('Round 1 is fully paid. A member receives ₦15,000.00 on 1 Mar.');
      expect(message).not.toContain('Adaeze');
    });

    it('skips anyone who switched it off, and still tells the rest', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await fundRound1(w, g.id, people);
      const quiet = people[0].member.userId as number;
      expect(await notices.setNoticePreferences(w.A, quiet, { roundFunded: false })).toMatchObject({ roundFunded: false, payoutRecorded: true, yourTurn: true, weeklySummary: false });
      await notices.sweepCircle(g.id, ROUND1_DAY);
      expect(ofKind('ajo.circle_round_funded').map((s) => s.userId)).not.toContain(quiet);
      expect(ofKind('ajo.circle_round_funded')).toHaveLength(2);
    });

    it('is silent for a circle whose board is off and for a collector-thrift scheme, and does not report old history', async () => {
      const w = await world();
      const off = await pot(w, { memberVisibility: 'OFF' });
      await fundRound1(w, off.g.id, off.people);
      expect((await notices.sweepCircle(off.g.id, ROUND1_DAY)).roundsFunded).toBe(0);
      const thrift = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
      expect(await notices.sweepCircle(thrift.id, ROUND1_DAY)).toEqual({ roundsFunded: 0, turns: 0 });

      const old = await pot(w);
      await fundRound1(w, old.g.id, old.people);
      expect((await notices.sweepCircle(old.g.id, at('2027-04-30T10:00:00Z'))).roundsFunded).toBe(0); // round 1 was nearly two months ago
      expect(told.filter((n) => n.pushType.startsWith('ajo.circle_'))).toHaveLength(0);
    });
  });

  describe('your turn', () => {
    it('tells the member whose payout is two rounds away, only them, and only once', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const slot3 = await prisma.ajoPayoutSlot.findFirstOrThrow({ where: { groupId: g.id, position: 3 } });
      const holder = people.find((p) => p.membership.id === slot3.membershipId) as (typeof people)[number];
      const first = await notices.sweepCircle(g.id, ROUND1_DAY);
      expect(first.turns).toBe(1);
      const turn = ofKind('ajo.circle_your_turn');
      expect(turn).toHaveLength(1);
      expect(turn[0]).toMatchObject({ userId: holder.member.userId, message: 'Your turn is in 2 rounds (15 Mar).' });
      told.length = 0;
      await notices.sweepCircle(g.id, ROUND1_DAY);
      expect(ofKind('ajo.circle_your_turn')).toHaveLength(0);
    });

    it('can be switched off', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const slot3 = await prisma.ajoPayoutSlot.findFirstOrThrow({ where: { groupId: g.id, position: 3 } });
      const holder = people.find((p) => p.membership.id === slot3.membershipId) as (typeof people)[number];
      await notices.setNoticePreferences(w.A, holder.member.userId as number, { yourTurn: false });
      await notices.sweepCircle(g.id, ROUND1_DAY);
      expect(ofKind('ajo.circle_your_turn')).toHaveLength(0);
    });
  });

  describe('a payout recorded', () => {
    it('tells the circle once who was paid, by name only if they consented', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const payout = await prisma.ajoPayout.create({ data: { associationId: w.A, groupId: g.id, membershipId: people[0].membership.id, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.admin.id, accountSnapshot: { bankName: 'GTBank', accountName: 'Secret Name', last4: '6789' }, paidReference: `ref-${run}`, paidAt: ROUND1_DAY, idempotencyKey: `payout-${run}-${++counter}` } });
      expect(await notices.sweepPayout(payout.id, ROUND1_DAY)).toBe(3);
      const sent = ofKind('ajo.circle_payout_recorded');
      expect(sent[0].message).toBe('Payout to Adaeze O. was recorded as paid.');
      expect(JSON.stringify(sent)).not.toContain('Secret Name');
      expect(JSON.stringify(sent)).not.toContain('ref-');
      expect(await notices.sweepPayout(payout.id, ROUND1_DAY)).toBe(0);
    });

    it('does nothing for a payout that is not paid yet', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const prepared = await prisma.ajoPayout.create({ data: { associationId: w.A, groupId: g.id, membershipId: people[0].membership.id, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PREPARED', preparedBy: w.admin.id, accountSnapshot: { bankName: 'GTBank', accountName: 'x', last4: '6789' }, idempotencyKey: `payout-${run}-${++counter}` } });
      expect(await notices.sweepPayout(prepared.id, ROUND1_DAY)).toBe(0);
    });
  });

  describe('the weekly summary', () => {
    it('is off unless a member opts in, then goes on Mondays in the circle\'s timezone, once a week', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      expect((await notices.getNoticePreferences(w.A, people[0].member.userId as number)).weeklySummary).toBe(false);
      expect(await notices.sendWeeklySummaries(g.id, ROUND1_DAY)).toBe(0); // nobody opted in

      const keen = people[1].member.userId as number;
      await notices.setNoticePreferences(w.A, keen, { weeklySummary: true });
      expect(await notices.sendWeeklySummaries(g.id, at('2027-03-02T10:00:00Z'))).toBe(0); // a Tuesday
      expect(await notices.sendWeeklySummaries(g.id, ROUND1_DAY)).toBe(1); // Monday 1 March
      const weekly = ofKind('ajo.circle_weekly');
      expect(weekly).toHaveLength(1);
      expect(weekly[0].userId).toBe(keen);
      expect(weekly[0].message).toMatch(/^1 of 3 paid this round · 0 behind · next payout \w+day$/);
      expect(await notices.sendWeeklySummaries(g.id, ROUND1_DAY)).toBe(0); // already sent this week
    });
  });

  describe('a member\'s choices', () => {
    it('start with everything on except the weekly summary, and change one thing at a time', async () => {
      const w = await world();
      const { people } = await pot(w);
      const u = people[0].member.userId as number;
      expect(await notices.getNoticePreferences(w.A, u)).toEqual({ roundFunded: true, payoutRecorded: true, yourTurn: true, weeklySummary: false });
      expect(await notices.setNoticePreferences(w.A, u, { weeklySummary: true })).toEqual({ roundFunded: true, payoutRecorded: true, yourTurn: true, weeklySummary: true });
      expect(await notices.setNoticePreferences(w.A, u, { yourTurn: false })).toEqual({ roundFunded: true, payoutRecorded: true, yourTurn: false, weeklySummary: true });
    });
  });
});
