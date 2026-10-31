/**
 * The circle statement (spec §16.4.10) against a real (disposable) database: the PDF, its code, and the page that checks it.
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
suite('The circle statement (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let board: typeof import('../../src/modules/ajo/ajo-board.service');
  let rulesService: typeof import('../../src/modules/ajo/ajo-rules.service');
  let stmt: typeof import('../../src/modules/ajo/ajo-circle-statement');

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
    stmt = require('../../src/modules/ajo/ajo-circle-statement');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe('the code', () => {
    it('is ten letters and digits in two groups of five, with nothing easy to misread', () => {
      for (let i = 0; i < 50; i += 1) expect(stmt.newStatementCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    });
    it('is read back however a person types it, and a malformed one is refused', () => {
      expect(stmt.normaliseCode('abcde-fghjk')).toBe('ABCDE-FGHJK');
      expect(stmt.normaliseCode(' abcdefghjk ')).toBe('ABCDE-FGHJK');
      expect(stmt.normaliseCode('ABCDE-FGHJ')).toBeNull();
      expect(stmt.normaliseCode('ABCDE-FGHJ0')).toBeNull();
      expect(stmt.normaliseCode('')).toBeNull();
    });
  });

  describe('the statement', () => {
    it('is a PDF of the circle with a code, and shows no phone, email, address, bank account, proof or surname', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const { file, name, code } = await stmt.makeCircleStatement({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), now: ROUND1_DAY, verifyBaseUrl: 'https://example.test', compress: false });
      expect(file.subarray(0, 5).toString()).toBe('%PDF-');
      expect(name).toMatch(/^circle-statement-.*-2027-03-01\.pdf$/);
      const text = pdfText(file);
      expect(text).toContain(`Verification code: ${code}`);
      expect(text).toContain(`https://example.test/verify/circle/${code}`);
      expect(text).toContain('Payment history');
      expect(text).toContain('Recorded balance');
      expect(text).toContain('(you)');
      for (const secret of [PHONE, PHONE.slice(1), ADDRESS, 'Market Road', GROUP_ACCOUNT, '@test.local', 'Okafor']) expect(text).not.toContain(secret);
      expect(await prisma.ajoStatementCode.count({ where: { groupId: g.id, code } })).toBe(1);
    });

    it('matches what the board shows on the day it is made', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const viewer = asMember(people[1].member);
      const board = await boardOverviewOf(w, g.id, viewer);
      const { code } = await stmt.makeCircleStatement({ associationId: w.A, groupId: g.id, viewer, now: ROUND1_DAY, compress: false });
      const stored = await prisma.ajoStatementCode.findUniqueOrThrow({ where: { code } });
      expect(stored.snapshot).toMatchObject({ round: board.header.round, collectedKobo: board.thisRound.collectedKobo, expectedKobo: board.thisRound.expectedKobo, paidCount: board.thisRound.paidCount, members: 3 });
    });

    it('is only for the circle\'s own members and officers, and only for a rotating pot with the board on', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      const outsider = await mkMember(w);
      const call = (viewer: { userId: number; isOfficer: boolean }, groupId = g.id) => stmt.makeCircleStatement({ associationId: w.A, groupId, viewer, now: ROUND1_DAY, compress: false });
      expect(await codeOf(call(asMember(outsider)))).toBe('GROUP_NOT_FOUND');
      expect(await codeOf(call({ userId: w.admin.id, isOfficer: true }))).toBe('NO_ERROR');
      const off = await pot(w, { memberVisibility: 'OFF' });
      expect(await codeOf(call(asMember(off.people[0].member), off.g.id))).toBe('BOARD_OFF');
      const thrift = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
      expect(await codeOf(call({ userId: w.admin.id, isOfficer: true }, thrift.id))).toBe('BOARD_NOT_AVAILABLE');
      void people;
    });
  });

  describe('checking a statement', () => {
    it('says it matches straight after it was made, and shows circle totals only', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const { code } = await stmt.makeCircleStatement({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), now: ROUND1_DAY, compress: false });
      const v = await stmt.verifyCircleStatement(code.toLowerCase().replace('-', ''), ROUND1_DAY);
      expect(v).toMatchObject({ code, matches: true, timezone: 'Africa/Lagos' });
      expect(v.printed).toEqual(v.current);
      const text = JSON.stringify(v);
      for (const secret of ['Okafor', 'Adaeze', PHONE, '@test.local', GROUP_ACCOUNT]) expect(text).not.toContain(secret);
    });

    it('says the record has changed once more money is confirmed, and still shows what was printed', async () => {
      const w = await world();
      const { g, people } = await pot(w);
      await pay(w, g.id, people[0].membership.id, ROUND1_DAY);
      const { code } = await stmt.makeCircleStatement({ associationId: w.A, groupId: g.id, viewer: asMember(people[1].member), now: ROUND1_DAY, compress: false });
      await pay(w, g.id, people[1].membership.id, ROUND1_DAY);
      const v = await stmt.verifyCircleStatement(code, ROUND1_DAY);
      expect(v.matches).toBe(false);
      expect(v.printed.collectedKobo).toBe(AMOUNT.toString());
      expect(v.current.collectedKobo).toBe((AMOUNT * 2n).toString());
    });

    it('verifies a circle whose board is off, and refuses a wrong or malformed code with the same answer', async () => {
      const w = await world();
      const { g } = await pot(w);
      const { code } = await stmt.makeCircleStatement({ associationId: w.A, groupId: g.id, viewer: { userId: w.admin.id, isOfficer: true }, now: ROUND1_DAY, compress: false });
      await prisma.ajoGroupRuleVersion.updateMany({ where: { groupId: g.id }, data: { memberVisibility: 'OFF' } });
      expect((await stmt.verifyCircleStatement(code, ROUND1_DAY)).matches).toBe(true);
      expect(await codeOf(stmt.verifyCircleStatement('AAAAA-AAAAA'))).toBe('CODE_NOT_FOUND');
      expect(await codeOf(stmt.verifyCircleStatement('nonsense'))).toBe('CODE_NOT_FOUND');
    });
  });
});
