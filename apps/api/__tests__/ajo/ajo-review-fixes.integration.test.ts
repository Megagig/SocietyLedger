/**
 * The server side of the web review fixes, against a real, disposable database: a guarantor accepting through a link, names for the
 * narrower roles, SocietyLedger's check inside the roster, "past due" on the group's own calendar, and paging of cash handovers.
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

const told: Array<{ userId: number; pushType: string }> = [];
jest.mock('../../src/services/billing/entitlements.service', () => ({ computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: 1000 } })) }));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return {
    ...actual,
    notifyUser: jest.fn(async (_a: number, userId: number, n: { pushType: string }) => { told.push({ userId, pushType: n.pushType }); }),
    notifyPermissionHolders: jest.fn(async () => undefined),
  };
});
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { getModuleStatus: jest.fn(async () => ({ isEnabled: true })), isFeatureEnabled: jest.fn(async () => true) } }));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(90000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const NOW = new Date('2027-02-01T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/* eslint-disable @typescript-eslint/no-var-requires */
suite('web review fixes: server side (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let bulk: typeof import('../../src/modules/ajo/ajo-bulk.service');
  let link: typeof import('../../src/modules/ajo/ajo-guarantor-link.service');
  let views: typeof import('../../src/modules/ajo/ajo-views.service');
  let handovers: typeof import('../../src/modules/ajo/ajo-handover.service');
  let n = 0;
  let phones = 0;
  const phone = () => `0805${String(3000000 + ++phones + Math.floor(Math.random() * 1000) * 1000).slice(-7)}`;

  async function world() {
    const slug = `ajo-rev-${run}-${++n}`;
    const assoc = await prisma.association.create({ data: { name: `Review ${n} ${run}`, slug, subdomain: slug } });
    const admin = await prisma.user.create({ data: { associationId: assoc.id, email: `admin-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return { A: assoc.id, admin };
  }
  async function circle(w: { A: number; admin: { id: number } }, rules: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
    // Real time: the rules take effect from creation, and the services under test read the real clock, so the two must agree.
    const g = await groups.createGroup({ associationId: w.A, actorUserId: w.admin.id, bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Circle' }, rules: rules as never, fields: { name: `Circle ${++n}`, model: 'COLLECTOR_THRIFT', frequency: 'DAILY', contributionKobo: 50_000, startDate: '2027-03-01', cycleLength: 5, maxParticipants: 20, ...over } as never });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id });
    return g;
  }
  async function addOne(w: { A: number; admin: { id: number } }, groupId: number, o: { approve?: boolean } = {}) {
    const p = phone();
    const r = await bulk.bulkAddContributors({ associationId: w.A, groupId, actorUserId: w.admin.id, items: [{ firstName: 'Ada', lastName: `Obi${run}`, phone: p }], approve: o.approve ?? true, acceptRulesOnBehalf: o.approve ?? true });
    return { membershipId: r.results[0].membershipId as number, memberId: r.results[0].memberId as number, phone: p };
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    bulk = require('../../src/modules/ajo/ajo-bulk.service');
    link = require('../../src/modules/ajo/ajo-guarantor-link.service');
    views = require('../../src/modules/ajo/ajo-views.service');
    handovers = require('../../src/modules/ajo/ajo-handover.service');
  });
  beforeEach(() => { told.length = 0; });
  afterAll(async () => { await prisma?.$disconnect(); });

  // ---------------------------------------------------------------------------------------------------------------------------
  describe('a guarantor accepting through a link (THM6)', () => {
    const who = { name: 'Mama Chidi Eze', phone: '08031230000', relationship: 'market neighbour' };

    it('lets the guarantor read the wording and accept, which records the agreement and activates the member', async () => {
      const w = await world();
      const g = await circle(w, { guarantorPolicy: 'REQUIRED' });
      const m = await addOne(w, g.id);
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: m.membershipId } })).status).toBe('PENDING'); // waiting for the guarantor

      const made = await link.createGuarantorLink({ associationId: w.A, membershipId: m.membershipId, actorUserId: w.admin.id, ...who, now: NOW });
      expect(made.token.length).toBeGreaterThan(30);
      expect(made.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
      const stored = await prisma.ajoGuarantorInvite.findFirstOrThrow({ where: { membershipId: m.membershipId } });
      expect(stored.tokenHash).not.toContain(made.token); // only a hash is kept
      expect(JSON.stringify(stored)).not.toContain(made.token);

      const seen = await link.viewGuarantorLink(made.token, NOW);
      expect(seen).toMatchObject({ guarantorName: who.name, relationship: who.relationship, wording: made.wording });
      expect(seen.wording).toContain('Mama Chidi Eze');
      expect(JSON.stringify(seen)).not.toMatch(/0805|bank|account/i); // nothing about money or contact details

      const done = await link.acceptGuarantorLink({ token: made.token, agreed: true, now: new Date(NOW.getTime() + 3600_000) });
      expect(done.memberName).toContain('Ada');
      const membership = await prisma.ajoMembership.findUniqueOrThrow({ where: { id: m.membershipId }, include: { guarantorAgreement: true } });
      expect(membership.status).toBe('ACTIVE');
      expect(membership.guarantorAgreement).toMatchObject({ name: who.name, wording: made.wording, recordedBy: w.admin.id, evidence: { channel: 'link' } });
      expect(membership.guarantorAgreement?.acceptedAt).not.toBeNull();
      expect(told.some((t) => t.userId === w.admin.id && t.pushType === 'ajo.guarantor_accepted')).toBe(true);
      expect(await prisma.auditLog.count({ where: { associationId: w.A, action: { in: ['AJO_GUARANTOR_LINK_CREATED', 'AJO_GUARANTOR_ACCEPTED_BY_LINK'] } } })).toBe(2);
    });

    it('works once: a second tap, or a repeat, records nothing more and says so kindly', async () => {
      const w = await world();
      const g = await circle(w, { guarantorPolicy: 'REQUIRED' });
      const m = await addOne(w, g.id);
      const made = await link.createGuarantorLink({ associationId: w.A, membershipId: m.membershipId, actorUserId: w.admin.id, ...who, now: NOW });
      const results = await Promise.allSettled([link.acceptGuarantorLink({ token: made.token, agreed: true, now: NOW }), link.acceptGuarantorLink({ token: made.token, agreed: true, now: NOW })]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.ajoGuarantorAgreement.count({ where: { associationId: w.A } })).toBe(1);
      await expect(link.acceptGuarantorLink({ token: made.token, agreed: true, now: NOW })).rejects.toMatchObject({ code: 'LINK_USED' });
      await expect(link.viewGuarantorLink(made.token, NOW)).rejects.toMatchObject({ code: 'LINK_USED' });
    });

    it('needs the explicit agreement, expires after seven days, and is replaced by a newer link', async () => {
      const w = await world();
      const g = await circle(w, { guarantorPolicy: 'REQUIRED' });
      const m = await addOne(w, g.id);
      const first = await link.createGuarantorLink({ associationId: w.A, membershipId: m.membershipId, actorUserId: w.admin.id, ...who, now: NOW });
      await expect(link.acceptGuarantorLink({ token: first.token, agreed: false })).rejects.toMatchObject({ code: 'AGREEMENT_REQUIRED' });
      expect(await prisma.ajoGuarantorAgreement.count({ where: { associationId: w.A } })).toBe(0); // looking is never agreeing
      await expect(link.viewGuarantorLink(first.token, new Date(NOW.getTime() + 8 * DAY))).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
      const second = await link.createGuarantorLink({ associationId: w.A, membershipId: m.membershipId, actorUserId: w.admin.id, ...who, now: NOW });
      await expect(link.viewGuarantorLink(first.token, NOW)).rejects.toMatchObject({ code: 'LINK_REPLACED' });
      await expect(link.viewGuarantorLink(second.token, NOW)).resolves.toBeTruthy();
    });

    it('tells a wrong or empty link nothing', async () => {
      await expect(link.viewGuarantorLink('not-a-real-token-at-all-0123456789', NOW)).rejects.toMatchObject({ code: 'LINK_INVALID' });
      await expect(link.acceptGuarantorLink({ token: '', agreed: true })).rejects.toMatchObject({ code: 'LINK_INVALID' });
    });

    it('refuses a link where no guarantor is used, for the member themselves, and for another association’s member', async () => {
      const w = await world();
      const other = await world();
      const none = await circle(w, { guarantorPolicy: 'NOT_REQUIRED' });
      const m1 = await addOne(w, none.id);
      await expect(link.createGuarantorLink({ associationId: w.A, membershipId: m1.membershipId, actorUserId: w.admin.id, ...who })).rejects.toMatchObject({ code: 'GUARANTOR_NOT_USED' });
      const need = await circle(w, { guarantorPolicy: 'OPTIONAL' });
      const m2 = await addOne(w, need.id);
      await expect(link.createGuarantorLink({ associationId: w.A, membershipId: m2.membershipId, actorUserId: w.admin.id, ...who, phone: m2.phone })).rejects.toMatchObject({ code: 'GUARANTOR_IS_MEMBER' });
      await expect(link.createGuarantorLink({ associationId: w.A, membershipId: m2.membershipId, actorUserId: w.admin.id, ...who, name: 'x' })).rejects.toMatchObject({ code: 'INVALID_GUARANTOR' });
      await expect(link.createGuarantorLink({ associationId: other.A, membershipId: m2.membershipId, actorUserId: other.admin.id, ...who })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND' });
    });
  });

  // ---------------------------------------------------------------------------------------------------------------------------
  describe('names and checks for the narrower roles', () => {
    it('lists the people by name only, inside the right association', async () => {
      const w = await world();
      const other = await world();
      const g = await circle(w);
      await addOne(w, g.id, { approve: false });
      const people = await views.listGroupPeople({ associationId: w.A, groupId: g.id });
      expect(people).toHaveLength(1);
      expect(Object.keys(people[0]).sort()).toEqual(['membershipId', 'name', 'shares', 'status']);
      expect(people[0].name).toContain('Ada');
      await expect(views.listGroupPeople({ associationId: other.A, groupId: g.id })).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    });

    it('puts SocietyLedger’s check on each person in the roster, in one read, newest review first', async () => {
      const w = await world();
      const g = await circle(w);
      const approved = await addOne(w, g.id, { approve: true });
      const waiting = await addOne(w, g.id, { approve: false });
      await prisma.ajoVerification.updateMany({ where: { memberId: approved.memberId }, data: { status: 'REJECTED' } });
      await prisma.ajoVerification.create({ data: { associationId: w.A, memberId: approved.memberId, submittedName: 'Ada', status: 'VERIFIED' } });
      const roster = await views.listGroupMembers({ associationId: w.A, groupId: g.id });
      const by = new Map(roster.people.map((p) => [p.membershipId, p.verification]));
      expect(by.get(approved.membershipId)).toBe('VERIFIED');
      expect(by.get(waiting.membershipId)).toBe('NOT_REQUESTED');
    });
  });

  // ---------------------------------------------------------------------------------------------------------------------------
  describe('"past due" on the group’s own calendar', () => {
    it('counts a due day as passed by the group’s time zone and cut-off, not the reader’s clock', async () => {
      const w = await world();
      const g = await circle(w, {}, { cycleLength: 3, timezone: 'Africa/Lagos', cutoffTime: '18:00' });
      const m = await addOne(w, g.id);
      await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: new Date('2027-02-25T10:00:00Z') });
      const at = (iso: string) => views.listMembershipInstallments({ associationId: w.A, membershipId: m.membershipId, now: new Date(iso) });
      // Instalments fall on 1, 2 and 3 March. At 17:30 Lagos on 2 March the 2nd is the current business day; after the 18:00 cut-off it has passed.
      expect((await at('2027-03-02T16:30:00Z')).installments.map((i) => i.pastDue)).toEqual([true, false, false]);
      expect((await at('2027-03-02T17:30:00Z')).installments.map((i) => i.pastDue)).toEqual([true, true, false]);
      expect((await at('2027-02-28T10:00:00Z')).installments.map((i) => i.pastDue)).toEqual([false, false, false]);
    });
  });

  // ---------------------------------------------------------------------------------------------------------------------------
  describe('paging cash handovers', () => {
    it('returns a page at a time, newest first, with the same list for every page', async () => {
      const w = await world();
      const g = await circle(w);
      const collector = await prisma.user.create({ data: { associationId: w.A, email: `col-${run}-${++n}@test.local`, passwordHash: 'x', isActive: true } });
      await addOne(w, g.id);
      await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: new Date('2027-02-25T10:00:00Z'), confirmSmallerGroup: true });
      for (let i = 0; i < 5; i++) {
        await prisma.ajoCashHandover.create({ data: { associationId: w.A, groupId: g.id, collectorUserId: collector.id, forDate: new Date(Date.UTC(2027, 2, 1 + i)), expectedKobo: 0n, collectedKobo: 0n, handedOverKobo: 0n, differenceKobo: 0n, idempotencyKey: `h-${run}-${n}-${i}` } });
      }
      const all = await handovers.listHandovers({ associationId: w.A, groupId: g.id });
      expect(all).toHaveLength(5);
      const page1 = await handovers.listHandovers({ associationId: w.A, groupId: g.id, take: 2 });
      const page2 = await handovers.listHandovers({ associationId: w.A, groupId: g.id, take: 2, skip: 2 });
      const page3 = await handovers.listHandovers({ associationId: w.A, groupId: g.id, take: 2, skip: 4 });
      expect([...page1, ...page2, ...page3].map((h) => h.id)).toEqual(all.map((h) => h.id));
      expect(page3).toHaveLength(1);
    });
  });
});
