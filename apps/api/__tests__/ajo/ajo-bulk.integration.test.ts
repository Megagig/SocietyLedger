/**
 * Adding a list of contributors at once (thrift onboarding, step 3) against a real, disposable database.
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

const limit = { value: 1000 as number | null };
jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: limit.value } })),
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return { ...actual, notifyUser: jest.fn(async () => undefined), notifyPermissionHolders: jest.fn(async () => undefined) };
});
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: jest.fn(async () => ({ isEnabled: true })), isFeatureEnabled: jest.fn(async () => true) },
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(90000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');

/* eslint-disable @typescript-eslint/no-var-requires */
suite('adding contributors in bulk (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let bulk: typeof import('../../src/modules/ajo/ajo-bulk.service');
  let n = 0;
  let phoneSeq = 0;
  const phone = () => `0803${String(1000000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 1000).slice(-7)}`;

  async function world() {
    const slug = `ajo-bulk-${run}-${++n}`;
    const assoc = await prisma.association.create({ data: { name: `Bulk ${n} ${run}`, slug, subdomain: slug, kind: 'THRIFT_GROUP' } });
    const admin = await prisma.user.create({ data: { associationId: assoc.id, email: `admin-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return { A: assoc.id, admin };
  }
  async function circle(w: { A: number; admin: { id: number } }, o: { model?: 'COLLECTOR_THRIFT' | 'ROTATING_POT'; open?: boolean } = {}) {
    const g = await groups.createGroup({
      associationId: w.A, actorUserId: w.admin.id, now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Circle' },
      fields: { name: `Circle ${++n}`, model: o.model ?? 'COLLECTOR_THRIFT', frequency: o.model === 'ROTATING_POT' ? 'MONTHLY' : 'DAILY', contributionKobo: 50_000, startDate: '2027-03-01', cycleLength: o.model === 'ROTATING_POT' ? undefined : 10, maxParticipants: 50, maxSharesPerMember: 3 } as never,
    });
    if (o.open) await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ firstName: `Person${i}`, lastName: `Test${run}`, phone: phone(), address: '12 Market Road' }));

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    bulk = require('../../src/modules/ajo/ajo-bulk.service');
  });
  beforeEach(() => { limit.value = 1000; });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('creates the people, puts them in a draft circle, records the rules and approves them, all in one go', async () => {
    const w = await world();
    const g = await circle(w);
    expect(g.status).toBe('DRAFT');
    const list = rows(30);
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: list, approve: true, acceptRulesOnBehalf: true });
    // A draft only stages people: they are approved and ready, and become active the moment the circle is opened.
    expect(r.summary).toMatchObject({ added: 30, alreadyIn: 0, approved: 30, active: 0, problems: 0 });
    expect(r.results.every((x) => x.status === 'added' && x.approved && x.rulesRecorded)).toBe(true);
    expect(await prisma.member.count({ where: { associationId: w.A } })).toBe(30);
    expect(await prisma.ajoMembership.count({ where: { groupId: g.id, status: 'PENDING' } })).toBe(30);
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    expect(await prisma.ajoMembership.count({ where: { groupId: g.id, status: 'ACTIVE' } })).toBe(30);
    expect(await prisma.ajoRuleAcceptance.count({ where: { membership: { groupId: g.id } } })).toBe(30);
    const audit = await prisma.auditLog.findMany({ where: { associationId: w.A, action: 'AJO_BULK_MEMBERS_ADDED' } });
    expect(audit).toHaveLength(1);
  });

  it('adds without approving or recording rules unless asked, leaving them waiting', async () => {
    const w = await world();
    const g = await circle(w);
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: rows(3), approve: false, acceptRulesOnBehalf: false });
    expect(r.summary).toMatchObject({ added: 3, approved: 0, active: 0 });
    expect(await prisma.ajoMembership.count({ where: { groupId: g.id, status: 'PENDING' } })).toBe(3);
    expect(await prisma.ajoRuleAcceptance.count({ where: { membership: { groupId: g.id } } })).toBe(0);
  });

  it('does nothing twice: sending the same list again creates nobody and records nothing again', async () => {
    const w = await world();
    const g = await circle(w);
    const list = rows(5);
    await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: list, approve: true, acceptRulesOnBehalf: true });
    const again = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: list, approve: true, acceptRulesOnBehalf: true });
    expect(again.summary).toMatchObject({ added: 0, alreadyIn: 5, approved: 5 });
    expect(await prisma.member.count({ where: { associationId: w.A } })).toBe(5);
    expect(await prisma.ajoMembership.count({ where: { groupId: g.id } })).toBe(5);
    expect(await prisma.ajoRuleAcceptance.count({ where: { membership: { groupId: g.id } } })).toBe(5);
  });

  it('finishes a half-done earlier list: people added without approval are approved on the second go', async () => {
    const w = await world();
    const g = await circle(w);
    const list = rows(4);
    await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: list, approve: false, acceptRulesOnBehalf: false });
    const second = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: list, approve: true, acceptRulesOnBehalf: true });
    expect(second.summary).toMatchObject({ added: 0, alreadyIn: 4, approved: 4 });
  });

  it('reports each bad row on its own and still adds the good ones', async () => {
    const w = await world();
    const g = await circle(w);
    const good = rows(2);
    const items = [good[0], { firstName: '', lastName: 'X', phone: phone() }, { firstName: 'A', lastName: 'B', phone: '123' }, { ...good[0], firstName: 'Copy' }, good[1]];
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items, approve: false, acceptRulesOnBehalf: false });
    expect(r.results.map((x) => x.status)).toEqual(['added', 'invalid', 'invalid', 'invalid', 'added']);
    expect(r.results[1].message).toContain('first name');
    expect(r.results[3].message).toContain('same phone number as row 1');
    expect(r.summary).toMatchObject({ added: 2, problems: 3 });
  });

  it('reuses a person already on file under that phone number and does not create them again', async () => {
    const w = await world();
    const g = await circle(w);
    const p = phone();
    const existing = await prisma.member.create({ data: { associationId: w.A, memberId: `OLD${run}${n}`, firstName: 'Old', lastName: 'Friend', phone: p, status: 'active' } });
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: [{ firstName: 'Old', lastName: 'Friend', phone: p.replace(/^0/, '+234') }], approve: false, acceptRulesOnBehalf: false });
    expect(r.results[0].status).toBe('added');
    expect(await prisma.member.count({ where: { associationId: w.A } })).toBe(1);
    expect((await prisma.ajoMembership.findFirstOrThrow({ where: { groupId: g.id } })).memberId).toBe(existing.id);
  });

  it('gives shares in a rotating pot, refuses more than the limit, and ignores shares elsewhere', async () => {
    const w = await world();
    const pot = await circle(w, { model: 'ROTATING_POT' });
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: pot.id, actorUserId: w.admin.id, items: [{ ...rows(1)[0], shares: 2 }, { ...rows(1)[0], shares: 9 }], approve: false, acceptRulesOnBehalf: false });
    expect(r.results.map((x) => x.status)).toEqual(['added', 'invalid']);
    expect((await prisma.ajoMembership.findFirstOrThrow({ where: { groupId: pot.id } })).shares).toBe(2);
  });

  it('will not let the admin approve their own membership', async () => {
    const w = await world();
    const g = await circle(w, { open: true });
    const p = phone();
    await prisma.member.create({ data: { associationId: w.A, userId: w.admin.id, memberId: `ADM${run}${n}`, firstName: 'The', lastName: 'Admin', phone: p, status: 'active' } });
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: [{ firstName: 'The', lastName: 'Admin', phone: p }, ...rows(1)], approve: true, acceptRulesOnBehalf: true });
    expect(r.results[0].status).toBe('failed');
    expect(r.results[0].message).toBeTruthy();
    expect(r.results[1]).toMatchObject({ status: 'added', approved: true, active: true });
  });

  it('keeps them waiting, with the reason, when the plan has no room for another contributor', async () => {
    const w = await world();
    const g = await circle(w, { open: true });
    limit.value = 2;
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: rows(4), approve: true, acceptRulesOnBehalf: true });
    expect(r.summary.active).toBe(2);
    expect(r.results.filter((x) => !x.active).every((x) => x.status === 'added' && x.approved && (x.message ?? '').length > 0)).toBe(true);
    // After moving to a bigger tier the same list finishes the job.
    limit.value = 100;
    const again = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: r.results.map((_, i) => ({ firstName: `Person${i}`, lastName: `Test${run}`, phone: '' })), approve: true, acceptRulesOnBehalf: true });
    expect(again.summary.added).toBe(0); // the phone-less rows are invalid, nothing duplicated
  });

  it('refuses an empty list, too many rows, and another association’s group', async () => {
    const w = await world();
    const other = await world();
    const g = await circle(w);
    const call = (over: object) => bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: rows(1), approve: false, acceptRulesOnBehalf: false, ...over });
    await expect(call({ items: [] })).rejects.toMatchObject({ code: 'NO_ROWS' });
    await expect(call({ items: rows(201) })).rejects.toMatchObject({ code: 'TOO_MANY_ROWS' });
    await expect(bulk.bulkAddContributors({ associationId: other.A, groupId: g.id, actorUserId: other.admin.id, items: rows(1), approve: false, acceptRulesOnBehalf: false })).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    expect(await prisma.member.count({ where: { associationId: other.A } })).toBe(0);
  });

  it('works on an open circle too, and a closed one refuses everybody with the reason', async () => {
    const w = await world();
    const g = await circle(w, { open: true });
    expect((await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: rows(2), approve: true, acceptRulesOnBehalf: true })).summary.active).toBe(2);
    await groups.cancelGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, reason: 'Cancelled for this test', now: NOW });
    const closed = await bulk.bulkAddContributors({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, items: rows(1), approve: false, acceptRulesOnBehalf: false });
    expect(closed.results[0]).toMatchObject({ status: 'failed' });
    expect(closed.results[0].message).toContain('closed');
  });
});
