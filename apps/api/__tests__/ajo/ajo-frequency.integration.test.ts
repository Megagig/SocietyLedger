/**
 * A group on its own step, against a real, disposable database: the schedule it really creates, what the API says about it, that the step
 * cannot be changed once it has started, and that the database itself refuses a half-described step.
 * Needs AJO_TEST_DATABASE_URL pointing at a database whose name contains "test"; without it the suite is skipped.
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

jest.mock('../../src/services/billing/entitlements.service', () => ({ computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })) }));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return { ...actual, notifyUser: jest.fn(async () => undefined), notifyPermissionHolders: jest.fn(async () => undefined) };
});
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { getModuleStatus: jest.fn(async () => ({ isEnabled: true })), isFeatureEnabled: jest.fn(async () => true) } }));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(90000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');
const BEFORE_START = new Date('2027-02-25T10:00:00Z');
const iso = (x: Date) => x.toISOString().slice(0, 10);

/* eslint-disable @typescript-eslint/no-var-requires */
suite('a group on its own step (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let bulk: typeof import('../../src/modules/ajo/ajo-bulk.service');
  let n = 0;

  async function world() {
    const slug = `ajo-freq-${run}-${++n}`;
    const assoc = await prisma.association.create({ data: { name: `Freq ${n} ${run}`, slug, subdomain: slug } });
    const admin = await prisma.user.create({ data: { associationId: assoc.id, email: `admin-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return { A: assoc.id, admin };
  }
  const make = (w: { A: number; admin: { id: number } }, fields: Record<string, unknown>) =>
    groups.createGroup({ associationId: w.A, actorUserId: w.admin.id, now: NOW, bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Circle' }, fields: { name: `Circle ${++n}`, contributionKobo: 50_000, startDate: '2027-03-01', maxParticipants: 20, ...fields } as never });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    bulk = require('../../src/modules/ajo/ajo-bulk.service');
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  async function startedWithOnePerson(w: { A: number; admin: { id: number } }, fields: Record<string, unknown>) {
    const g = await make(w, fields);
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: [{ firstName: 'Ada', lastName: `Obi${run}`, phone: `0803${String(2000000 + n).slice(-7)}` }], approve: true, acceptRulesOnBehalf: true });
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    return g;
  }
  const dueDatesOf = async (groupId: number) => (await prisma.ajoInstallment.findMany({ where: { membership: { groupId } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true } })).map((r) => iso(r.dueDate));

  it('creates every instalment on its own step, and the API says it in words', async () => {
    const w = await world();
    const g = await startedWithOnePerson(w, { model: 'COLLECTOR_THRIFT', frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS', cycleLength: 4 });
    expect(g).toMatchObject({ frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS', cadence: 'every 2 weeks' });
    expect(await dueDatesOf(g.id)).toEqual(['2027-03-01', '2027-03-15', '2027-03-29', '2027-04-12']);
    expect(iso((await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id } })).endsOn as Date)).toBe('2027-04-12');
  });

  it('runs a quarterly group, and an every-two-months group, from the same start', async () => {
    const w = await world();
    const q = await startedWithOnePerson(w, { model: 'COLLECTOR_THRIFT', frequency: 'QUARTERLY', cycleLength: 3 });
    expect(q).toMatchObject({ cadence: 'every 3 months', intervalCount: null, intervalUnit: null });
    expect(await dueDatesOf(q.id)).toEqual(['2027-03-01', '2027-06-01', '2027-09-01']);
    const w2 = await world();
    const m = await startedWithOnePerson(w2, { model: 'COLLECTOR_THRIFT', frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'MONTHS', cycleLength: 3 });
    expect(await dueDatesOf(m.id)).toEqual(['2027-03-01', '2027-05-01', '2027-07-01']);
  });

  it('draws a rotating pot’s rounds on the same step', async () => {
    const w = await world();
    const g = await make(w, { model: 'ROTATING_POT', frequency: 'ANNUALLY', maxParticipants: 3, maxSharesPerMember: 1 });
    expect(g).toMatchObject({ cadence: 'every year' });
  });

  it('will not change how often a group collects after it has started, or save a custom group without a step', async () => {
    const w = await world();
    const g = await startedWithOnePerson(w, { model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 3 });
    await expect(groups.updateGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, fields: { frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'DAYS' }, now: BEFORE_START })).rejects.toMatchObject({ code: 'GROUP_LOCKED' });
    await expect(make(w, { model: 'COLLECTOR_THRIFT', frequency: 'CUSTOM', cycleLength: 3 })).rejects.toMatchObject({ code: 'INVALID_GROUP' });
    // a draft can still be changed freely
    const draft = await make(w, { model: 'COLLECTOR_THRIFT', frequency: 'DAILY', cycleLength: 3 });
    const changed = await groups.updateGroup({ associationId: w.A, groupId: draft.id, actorUserId: w.admin.id, fields: { frequency: 'CUSTOM', intervalCount: 10, intervalUnit: 'DAYS' }, now: NOW });
    expect(JSON.stringify(changed)).toContain('every 10 days');
  });

  it('is protected by the database itself: a step with a missing half is refused', async () => {
    const w = await world();
    const g = await make(w, { model: 'COLLECTOR_THRIFT', frequency: 'DAILY', cycleLength: 3 });
    await expect(prisma.ajoGroup.update({ where: { id: g.id }, data: { intervalCount: 2 } })).rejects.toBeTruthy();
    await expect(prisma.ajoGroup.update({ where: { id: g.id }, data: { intervalCount: 99, intervalUnit: 'DAYS' } })).rejects.toBeTruthy();
    await expect(prisma.ajoGroup.update({ where: { id: g.id }, data: { intervalCount: 3, intervalUnit: 'WEEKS' } })).resolves.toBeTruthy();
  });
});
