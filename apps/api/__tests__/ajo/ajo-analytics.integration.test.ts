/**
 * Ajo add-on analytics (T9.3): the month helpers, then the head count and tier adoption against a real (disposable) database.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it only the pure part runs.
 * The database is shared with other suites, so every check is a difference from a reading taken just before the test's own rows.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-analytics.integration --forceExit
 */
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

import { lastMonths, monthKey } from '../../src/modules/ajo/ajo-analytics.service';

describe('month helpers (pure)', () => {
  it('names a month by its UTC year and month', () => {
    expect(monthKey(new Date('2026-10-30T23:59:59Z'))).toBe('2026-10');
    expect(monthKey(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01');
  });

  it('lists the last months oldest first, across a year end', () => {
    expect(lastMonths(new Date('2027-02-15T00:00:00Z'), 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
});

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(60000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const DAY = 24 * 60 * 60 * 1000;

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo analytics (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let analytics: typeof import('../../src/modules/ajo/ajo-analytics.service');
  let n = 0;

  async function person(associationId: number, label: string) {
    return prisma.member.create({ data: { associationId, memberId: `A-${run}-${++n}`, firstName: label, lastName: 'Tester' } });
  }

  beforeAll(() => {
    prisma = require('../../src/lib/prisma').default;
    analytics = require('../../src/modules/ajo/ajo-analytics.service');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('counts a person once however many payments, and leaves out reversed, old and unconfirmed ones', async () => {
    const now = new Date();
    const before = (await analytics.ajoAnalytics(now)).contributors.active;

    const slug = `ajo-an-${run}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Analytics ${run}`, slug, subdomain: slug } });
    const group = await prisma.ajoGroup.create({
      data: { associationId: assoc.id, name: 'Test pot', model: 'ROTATING_POT', frequency: 'WEEKLY', contributionKobo: 500_000n, startDate: new Date('2027-03-01'), maxParticipants: 10, status: 'ACTIVE' },
    });
    const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map((l) => person(assoc.id, l)));
    const ms = await Promise.all([a, b, c, d].map((m) => prisma.ajoMembership.create({ data: { associationId: assoc.id, groupId: group.id, memberId: m.id, status: 'ACTIVE' } })));

    let k = 0;
    const pay = (membershipId: number, status: 'CONFIRMED' | 'REPORTED' | 'REVERSED', confirmedDaysAgo: number, extra: Record<string, unknown> = {}) =>
      prisma.ajoContribution.create({
        data: {
          associationId: assoc.id, groupId: group.id, membershipId, amountKobo: 500_000n, method: 'CASH', status,
          reference: `ref-${run}-${++k}`, idempotencyKey: `idem-${run}-${k}`, receivedAt: new Date(now.getTime() - confirmedDaysAgo * DAY),
          confirmedAt: status === 'REPORTED' ? null : new Date(now.getTime() - confirmedDaysAgo * DAY), ...extra,
        },
      });

    // A paid twice this month: one person.
    await pay(ms[0]!.id, 'CONFIRMED', 3);
    await pay(ms[0]!.id, 'CONFIRMED', 10);
    // B's only payment was reversed: not an active contributor.
    const original = await pay(ms[1]!.id, 'CONFIRMED', 5);
    await pay(ms[1]!.id, 'REVERSED', 4, { reversalOfId: original.id });
    // C paid, but 45 days ago. D only reported, nobody confirmed it.
    await pay(ms[2]!.id, 'CONFIRMED', 45);
    await pay(ms[3]!.id, 'REPORTED', 1);

    const after = await analytics.ajoAnalytics(now);
    expect(after.contributors.active - before).toBe(1);
    expect(after.contributors.windowDays).toBe(30);
  });

  it('reports the shape the screen needs: six months of levy, kobo totals and group counts', async () => {
    const r = await analytics.ajoAnalytics(new Date());
    expect(r.revenue.levySeries).toHaveLength(6);
    expect(r.revenue.levySeries.every((m) => /^\d{4}-\d{2}$/.test(m.month) && Number.isInteger(m.kobo))).toBe(true);
    expect(Number.isInteger(r.revenue.subscriptionMonthlyKobo)).toBe(true);
    expect(Object.keys(r.adoption.groups.byStatus)).toContain('ACTIVE');
    expect(r.adoption.owners.associations + r.adoption.owners.standalone).toBeGreaterThan(0);
  });
});
