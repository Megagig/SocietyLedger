/**
 * The Ajo reports (T10) against a real (disposable) database. The point of these tests is the Definition of Done: report totals reconcile
 * with the group ledger to the kobo, a reported payment is never counted as received, tier and role limits hold, nothing private leaks,
 * and the files are written from the same figures the screens show.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-reports.integration --forceExit
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

const mockDisabled = new Set<string>();
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
  ModuleFeatureService: {
    getModuleStatus: jest.fn(async () => ({ isEnabled: true })),
    getFeatureStatus: jest.fn(async (_associationId: number, code: string) => ({ isEnabled: !mockDisabled.has(code) })),
  },
}));

import { assertUnderCap, MAX_ROWS, startOfDayIn } from '../../src/modules/ajo/reports/report-context';
import { nairaPlain, pdfSafe, reportCsv } from '../../src/modules/ajo/reports/report-export';
import { totalsOf } from '../../src/modules/ajo/reports/report.service';

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(120000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const at = (iso: string) => new Date(iso);
const NOW = at('2027-02-01T10:00:00Z');
const BEFORE_START = at('2027-02-25T10:00:00Z');
const START = '2027-03-01';
const D1 = at('2027-03-01T10:00:00Z');
const LATER = at('2027-03-10T10:00:00Z');
const MIN = 500_000n;
const RANGE = { from: '2027-03-01', to: '2027-03-31' };

describe('pure report helpers', () => {
  it('finds the first instant of a day in the circle\'s own timezone', () => {
    expect(startOfDayIn('2027-03-01', 'Africa/Lagos').toISOString()).toBe('2027-02-28T23:00:00.000Z'); // Lagos is UTC+1
    expect(startOfDayIn('2027-03-01', 'UTC').toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(startOfDayIn('2027-03-01', 'America/New_York').toISOString()).toBe('2027-03-01T05:00:00.000Z');
  });
  it('writes naira as a plain number a spreadsheet can add up', () => {
    expect(nairaPlain('1000050')).toBe('10000.50');
    expect(nairaPlain('5')).toBe('0.05');
    expect(nairaPlain('-250000')).toBe('-2500.00');
    expect(nairaPlain('0')).toBe('0.00');
  });
  it('writes the naira sign as NGN in a PDF, wherever the server put it, because the built-in fonts cannot draw it', () => {
    expect(pdfSafe('A payment of ₦5,000.00 was reversed')).toBe('A payment of NGN 5,000.00 was reversed');
    expect(pdfSafe('₦1.00 and ₦2.00')).toBe('NGN 1.00 and NGN 2.00');
    expect(pdfSafe('no money here')).toBe('no money here');
  });
  it('refuses a report with too many rows and says how to fix it', () => {
    expect(() => assertUnderCap(MAX_ROWS)).not.toThrow();
    expect(() => assertUnderCap(MAX_ROWS + 1)).toThrow(/Narrow the dates/);
  });
  it('adds figures across circles of the same kind only, and never adds a percentage', () => {
    const block = (groupId: number, model: 'ROTATING_POT' | 'COLLECTOR_THRIFT', kobo: string, bps: number) => ({
      groupId, groupName: `G${groupId}`, model, timezone: 'Africa/Lagos',
      metrics: [{ key: 'a', label: 'A', kind: 'money' as const, value: kobo }, { key: 'n', label: 'N', kind: 'int' as const, value: 2 }, { key: 'p', label: 'P', kind: 'percent' as const, value: bps }],
    });
    const totals = totalsOf([block(1, 'ROTATING_POT', '100', 5000), block(2, 'ROTATING_POT', '250', 10000), block(3, 'COLLECTOR_THRIFT', '999', 1)]);
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ label: 'All rotating pots', circles: 2 });
    expect(totals[0].metrics.map((m) => m.value)).toEqual(['350', 4, null]);
    expect(totalsOf([block(1, 'ROTATING_POT', '100', 1), block(3, 'COLLECTOR_THRIFT', '999', 1)])).toEqual([]);
  });
});

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo reports (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let ledger: typeof import('../../src/modules/ajo/ajo-ledger.service');
  let svc: typeof import('../../src/modules/ajo/reports/report.service');

  interface World {
    A: number;
    admin: { id: number };
    recon: { id: number };
    collector: { id: number };
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-rep-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Reports ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), recon: await user('recon'), collector: await user('collector') };
    for (const [u, first, last] of [[w.admin, 'Tunde', 'Bello'], [w.recon, 'Funke', 'Adeyemi'], [w.collector, 'Musa', 'Ibrahim']] as const) {
      await prisma.member.create({ data: { associationId: w.A, userId: u.id, memberId: `REP${run}${++counter}`, firstName: first, lastName: last, status: 'active' } });
    }
    return w;
  }
  async function mkMember(w: World, last = `Okafor${++counter}`) {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `private-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `REM${run}${n}`, firstName: 'Adaeze', lastName: last, email: `private-${run}-${n}@test.local`, phone: `0803${String(1000000 + n)}`, address: `${n} Secret Street`, status: 'active' } });
  }
  async function newGroup(w: World, fields: Record<string, unknown>) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Secret Account Name' },
      fields: { name: `Circle ${++counter}`, frequency: 'WEEKLY', contributionKobo: Number(MIN), startDate: START, maxParticipants: 30, ...fields } as never,
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  async function join(w: World, groupId: number) {
    const member = await mkMember(w);
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id });
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return { member, membership };
  }
  async function pot(w: World) {
    const g = await newGroup(w, { model: 'ROTATING_POT', maxParticipants: 3 });
    const people = [await join(w, g.id), await join(w, g.id), await join(w, g.id)];
    await order.runDraw({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    return { g, people };
  }
  async function report(w: World, groupId: number, membershipId: number, now: Date) {
    return contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: MIN, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
  }
  /** The ledger stamps entries with the real clock; fixtures live in 2027, so give the new ones the fixture's time. */
  const stamp = (groupId: number, when: Date) => prisma.ajoLedgerEntry.updateMany({ where: { groupId, createdAt: { lt: at('2027-01-01T00:00:00Z') } }, data: { createdAt: when } });
  async function confirmed(w: World, groupId: number, membershipId: number, when: Date) {
    const r = await report(w, groupId, membershipId, when);
    await contrib.confirmTransfer({ associationId: w.A, contributionId: r.contribution.id, actorUserId: w.recon.id, now: when });
    await stamp(groupId, when);
    return r.contribution;
  }
  const officer = (w: World) => ({ userId: w.admin.id, collectorOnly: false });
  const full = (w: World, name: string, query: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
    svc.runReport({ associationId: w.A, name, query: { ...RANGE, ...query }, scope: officer(w), access: 'FULL', now: LATER, all: true, ...over });
  const metricOf = (r: { blocks: Array<{ metrics: Array<{ key: string; value: string | number | null }> }> }, key: string, block = 0) => r.blocks[block].metrics.find((m) => m.key === key)?.value;

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    ledger = require('../../src/modules/ajo/ajo-ledger.service');
    svc = require('../../src/modules/ajo/reports/report.service');
  });
  beforeEach(() => mockDisabled.clear());
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('counts only confirmed money as paid: a reported payment is shown as reported, and a person who has not paid is missed once the grace is over', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1); // person 0 paid round 1
    await report(w, g.id, people[1].membership.id, D1); // person 1 reported round 1, not confirmed
    // person 2 paid nothing

    const r = await full(w, 'contributions');
    expect(metricOf(r, 'expectedKobo')).toBe('4500000'); // 3 people x 3 rounds x 500,000
    expect(metricOf(r, 'paidKobo')).toBe('500000');
    expect(metricOf(r, 'reportedKobo')).toBe('500000');
    expect(metricOf(r, 'receivedKobo')).toBe('500000');
    // Round 1 and 2 are due by 10 March: 6 instalments of 500,000, less the 500,000 paid.
    expect(metricOf(r, 'outstandingKobo')).toBe('2500000');
    expect(metricOf(r, 'missedKobo')).toBe('500000'); // person 2, round 1, past its grace
    expect(metricOf(r, 'overdueKobo')).toBe('1500000'); // round 2 for all three, still inside its grace
    const statuses = r.rows.filter((x) => x.dueDate === '2027-03-01').map((x) => x.status);
    expect(statuses.sort()).toEqual(['Missed', 'Paid on time', 'Reported, awaiting confirmation']);
  });

  it('reconciles with the group ledger: contributions, balance, member ledger and financial summary all agree to the kobo', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const a = await confirmed(w, g.id, people[0].membership.id, D1);
    await confirmed(w, g.id, people[1].membership.id, D1);
    await confirmed(w, g.id, people[2].membership.id, D1);
    // One of them is reversed later in the month, and a payout of the round is recorded.
    await contrib.reverseContribution({ associationId: w.A, contributionId: a.id, actorUserId: w.recon.id, reason: 'Duplicate entry, paid twice by mistake', now: at('2027-03-05T10:00:00Z') });
    await stamp(g.id, at('2027-03-05T10:00:00Z'));
    await prisma.ajoContribution.updateMany({ where: { reversalOfId: a.id }, data: { createdAt: at('2027-03-05T10:00:00Z') } });
    await ledger.recordEntry(prisma as never, { associationId: w.A, groupId: g.id, membershipId: people[0].membership.id, type: 'PAYOUT', direction: 'DEBIT', amountKobo: 1_000_000n, refType: 'payout', refId: 1, idempotencyKey: `payout-${run}-${++counter}` });
    await stamp(g.id, at('2027-03-06T10:00:00Z'));

    const truth = await ledger.balanceKobo(prisma as never, { associationId: w.A, groupId: g.id });
    expect(truth).toBe(0n); // 1,500,000 in, 500,000 reversed out, 1,000,000 paid out
    const contributions = await full(w, 'contributions');
    expect(metricOf(contributions, 'receivedKobo')).toBe('1000000'); // 1,500,000 less the reversed 500,000
    const summary = await full(w, 'financial-summary');
    expect(metricOf(summary, 'contributionsKobo')).toBe('1000000');
    expect(metricOf(summary, 'payoutsKobo')).toBe('1000000');
    expect(metricOf(summary, 'balanceKobo')).toBe(truth.toString());
    expect(summary.rows.reduce((a2, x) => a2 + BigInt(x.netKobo as string), 0n)).toBe(truth);
    const memberLedger = await full(w, 'member-ledger');
    expect(metricOf(memberLedger, 'closingKobo')).toBe(truth.toString());
    expect(BigInt(metricOf(memberLedger, 'creditKobo') as string) - BigInt(metricOf(memberLedger, 'debitKobo') as string)).toBe(truth);
    // The running balance of the last row for each person ends where that person's ledger ends.
    for (const p of people) {
      const own = await ledger.balanceKobo(prisma as never, { associationId: w.A, groupId: g.id, membershipId: p.membership.id });
      const rows = memberLedger.rows.filter((x) => x.member === `${p.member.firstName} ${p.member.lastName}`);
      expect(BigInt(rows[rows.length - 1].balanceKobo as string)).toBe(own);
    }
  });

  it('puts a payment on the right day for the circle\'s timezone: late on the last evening in Lagos is still that day', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    // 23:30 in Lagos on 31 March is 22:30 UTC the same day; 00:30 in Lagos on 1 April is 23:30 UTC on 31 March.
    await confirmed(w, g.id, people[0].membership.id, at('2027-03-31T22:30:00Z'));
    await confirmed(w, g.id, people[1].membership.id, at('2027-03-31T23:30:00Z'));
    const march = await full(w, 'contributions');
    expect(metricOf(march, 'receivedKobo')).toBe('500000');
    const april = await full(w, 'contributions', { from: '2027-04-01', to: '2027-04-30' });
    expect(metricOf(april, 'receivedKobo')).toBe('500000');
  });

  it('refuses a range longer than a year and a range that runs backwards', async () => {
    const w = await world();
    await pot(w);
    await expect(full(w, 'contributions', { from: '2027-01-01', to: '2028-06-01' })).rejects.toMatchObject({ code: 'RANGE_TOO_LONG' });
    await expect(full(w, 'contributions', { from: '2027-03-31', to: '2027-03-01' })).rejects.toMatchObject({ code: 'INVALID_RANGE' });
    await expect(full(w, 'no-such-report')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('locks reports by tier with a clear refusal, lists the lock, and leaves every report open while the add-on is expired', async () => {
    const w = await world();
    await pot(w);
    mockDisabled.add('ajo.advanced_reports');
    mockDisabled.add('ajo.audit_reports');
    await expect(full(w, 'collectors')).rejects.toMatchObject({ code: 'REPORT_NOT_IN_TIER' });
    await expect(full(w, 'defaults')).rejects.toMatchObject({ code: 'REPORT_NOT_IN_TIER' });
    await expect(full(w, 'audit')).rejects.toMatchObject({ code: 'REPORT_NOT_IN_TIER' });
    await expect(full(w, 'contributions')).resolves.toBeDefined(); // basic reports come with every tier
    const list = await svc.listReports({ associationId: w.A, access: 'FULL', scope: officer(w) });
    expect(list.filter((x) => x.lock?.kind === 'TIER').map((x) => x.name).sort()).toEqual(['audit', 'collectors', 'defaults', 'fees-revenue']);
    expect(list.find((x) => x.name === 'audit')?.lock?.message).toMatch(/Upgrade/);
    // Growth has advanced reports but not the audit report.
    mockDisabled.delete('ajo.advanced_reports');
    await expect(full(w, 'collectors')).resolves.toBeDefined();
    await expect(full(w, 'audit')).rejects.toMatchObject({ code: 'REPORT_NOT_IN_TIER' });
    // Expired add-on: read-only keeps every report it had.
    mockDisabled.add('ajo.advanced_reports');
    await expect(svc.runReport({ associationId: w.A, name: 'audit', query: RANGE, scope: officer(w), access: 'READ_ONLY', now: LATER })).resolves.toBeDefined();
  });

  it('shows a collector who is not an officer only the reports meant for them, and only the people assigned to them', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1);
    await confirmed(w, g.id, people[1].membership.id, D1);
    await prisma.ajoCollectorAssignment.create({ data: { associationId: w.A, collectorUserId: w.collector.id, membershipId: people[0].membership.id, startsOn: at('2027-02-01T00:00:00Z') } });
    const collector = { userId: w.collector.id, collectorOnly: true };
    const mine = await svc.runReport({ associationId: w.A, name: 'contributions', query: RANGE, scope: collector, access: 'FULL', now: LATER, all: true });
    expect(new Set(mine.rows.map((x) => x.member))).toEqual(new Set([`${people[0].member.firstName} ${people[0].member.lastName}`]));
    expect(metricOf(mine, 'expectedKobo')).toBe('1500000');
    const ledgerRows = await svc.runReport({ associationId: w.A, name: 'member-ledger', query: RANGE, scope: collector, access: 'FULL', now: LATER, all: true });
    expect(ledgerRows.rows.length).toBeGreaterThan(0);
    expect(new Set(ledgerRows.rows.map((x) => x.member)).size).toBe(1);
    for (const name of ['payouts', 'financial-summary', 'defaults', 'fees-revenue', 'audit']) {
      await expect(svc.runReport({ associationId: w.A, name, query: RANGE, scope: collector, access: 'FULL', now: LATER })).rejects.toMatchObject({ code: 'REPORT_NOT_FOR_YOU' });
    }
    const list = await svc.listReports({ associationId: w.A, access: 'FULL', scope: collector });
    expect(list.filter((x) => !x.lock).map((x) => x.name).sort()).toEqual(['collectors', 'contributions', 'member-ledger']);
  });

  it('never shows another association\'s circle, even when asked for it by number', async () => {
    const w1 = await world();
    const w2 = await world();
    const { g } = await pot(w1);
    await pot(w2);
    await expect(full(w2, 'contributions', { groupId: g.id })).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    const own = await full(w2, 'contributions');
    expect(own.blocks.map((b) => b.groupId)).not.toContain(g.id);
  });

  it('leaves out bank accounts, emails, addresses, proof links and guarantor details from every report and file', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1);
    await prisma.ajoGuarantorAgreement.create({ data: { associationId: w.A, name: 'Guarantor Secretname', phone: '08099990000', relationship: 'Brother', wording: 'I agree', acceptedAt: D1 } });
    await prisma.ajoLateFeeAssessment.create({ data: { associationId: w.A, installmentId: (await prisma.ajoInstallment.findFirstOrThrow({ where: { membershipId: people[2].membership.id } })).id, ruleVersionId: (await prisma.ajoGroupRuleVersion.findFirstOrThrow({ where: { groupId: g.id } })).id, basisKobo: MIN, feeKobo: 50_000n, calculation: {}, status: 'WAIVED', waivedReason: 'Hardship, agreed by the group', waivedBy: w.admin.id, waivedAt: at('2027-03-05T10:00:00Z') } });
    await prisma.ajoPayout.create({ data: { associationId: w.A, groupId: g.id, membershipId: people[0].membership.id, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.admin.id, paidRecordedBy: w.recon.id, paidAt: at('2027-03-02T10:00:00Z'), paidReference: 'BANK-REF-1', proofKey: 'proofs/secret-proof.png', accountSnapshot: { bankName: 'GTBank', accountName: 'Secret Account Name', last4: '6789' }, idempotencyKey: `payout-${run}-${++counter}` } });
    const names = ['contributions', 'member-ledger', 'collectors', 'payouts', 'defaults', 'financial-summary', 'fees-revenue', 'audit'];
    for (const name of names) {
      const r = await full(w, name);
      const json = JSON.stringify(r);
      const csv = reportCsv(r);
      for (const secret of ['0123456789', 'Secret Account Name', 'Secret Street', 'private-', '@test.local', 'secret-proof', 'Guarantor Secretname', '08099990000', 'I agree']) {
        expect(json).not.toContain(secret);
        expect(csv).not.toContain(secret);
      }
    }
    // The officer can chase arrears, so the phone number is there for the people who are behind.
    const defaults = await full(w, 'defaults');
    expect(defaults.rows.some((x) => typeof x.phone === 'string' && x.phone.startsWith('0803'))).toBe(true);
  });

  it('writes an audit row for every export, and the audit report lists it', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1);
    const file = await svc.exportReport({ associationId: w.A, name: 'contributions', query: { ...RANGE, groupId: g.id }, scope: officer(w), access: 'FULL', format: 'csv', actorUserId: w.admin.id, now: LATER });
    expect(file.contentType).toMatch(/text\/csv/);
    expect(file.fileName).toBe('ajo-contributions-2027-03-01-to-2027-03-31.csv');
    const row = await prisma.auditLog.findFirst({ where: { associationId: w.A, action: 'AJO_REPORT_EXPORTED' } });
    expect(row?.userId).toBe(w.admin.id);
    expect(row?.newValues).toMatchObject({ report: 'contributions', format: 'csv', from: '2027-03-01', to: '2027-03-31', groupId: g.id });
    // The export happened "now" in the test, so look for it in a range that holds the real clock.
    const today = new Date().toISOString().slice(0, 10);
    const audit = await svc.runReport({ associationId: w.A, name: 'audit', query: { from: today, to: today }, scope: officer(w), access: 'FULL', all: true });
    expect(audit.rows.some((x) => x.event === 'Report exported' && String(x.what).includes('contributions'))).toBe(true);
  });

  it('makes a CSV Excel can open and a PDF, from the same figures as the screen', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1);
    await prisma.member.update({ where: { id: people[0].member.id }, data: { firstName: '=HYPERLINK("http://x")' } });
    const csvFile = await svc.exportReport({ associationId: w.A, name: 'member-ledger', query: RANGE, scope: officer(w), access: 'FULL', format: 'csv', actorUserId: w.admin.id, now: LATER });
    const csv = String(csvFile.body);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Money in (₦)"');
    expect(csv).toContain(',5000.00,'); // 500,000 kobo as a number, not text
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")'); // a name cannot run as a formula
    const pdfFile = await svc.exportReport({ associationId: w.A, name: 'contributions', query: RANGE, scope: officer(w), access: 'FULL', format: 'pdf', actorUserId: w.admin.id, now: LATER });
    expect(pdfFile.contentType).toBe('application/pdf');
    expect((pdfFile.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdfFile.body as Buffer).length).toBeGreaterThan(1500);
  });

  it('pages the rows but keeps the totals whole, and a file holds every row', async () => {
    const w = await world();
    await pot(w);
    const everything = await full(w, 'contributions');
    expect(everything.rows).toHaveLength(9);
    const first = await svc.runReport({ associationId: w.A, name: 'contributions', query: RANGE, scope: officer(w), access: 'FULL', now: LATER, page: 1, pageSize: 4 });
    const third = await svc.runReport({ associationId: w.A, name: 'contributions', query: RANGE, scope: officer(w), access: 'FULL', now: LATER, page: 3, pageSize: 4 });
    expect(first.rows).toHaveLength(4);
    expect(third.rows).toHaveLength(1);
    expect(first.page).toEqual({ page: 1, pageSize: 4, total: 9 });
    expect(metricOf(first, 'expectedKobo')).toBe(metricOf(everything, 'expectedKobo'));
  });

  it('shows late fees assessed, paid and waived apart, and the collector fee and levy as separate lines', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const version = await prisma.ajoGroupRuleVersion.findFirstOrThrow({ where: { groupId: g.id } });
    const inst = (i: number) => prisma.ajoInstallment.findFirstOrThrow({ where: { membershipId: people[i].membership.id }, orderBy: { dueDate: 'asc' } });
    const fee = (installmentId: number, status: 'WAIVED' | 'PAYABLE', extra: Record<string, unknown> = {}) =>
      prisma.ajoLateFeeAssessment.create({ data: { associationId: w.A, installmentId, ruleVersionId: version.id, basisKobo: MIN, feeKobo: 50_000n, calculation: {}, status, createdAt: at('2027-03-04T10:00:00Z'), ...extra } as never });
    await fee((await inst(0)).id, 'WAIVED', { waivedReason: 'Hardship', waivedBy: w.admin.id, waivedAt: at('2027-03-05T10:00:00Z') });
    await fee((await inst(1)).id, 'PAYABLE');
    await prisma.ajoLevyAssessment.create({ data: { associationId: w.A, groupId: g.id, kind: 'CYCLE', status: 'ACCRUED', dedupeKey: `cycle:${g.id}:${run}`, baseKobo: 4_500_000n, rateBps: 50, minKobo: 50_000n, maxKobo: 500_000n, amountKobo: 50_000n, addonCode: 'ajo-starter', calculation: '0.5% of ₦45,000.00', accruedAt: at('2027-03-02T10:00:00Z') } });
    const r = await full(w, 'fees-revenue');
    expect(metricOf(r, 'lateFeesAssessedKobo')).toBe('100000');
    expect(metricOf(r, 'lateFeesWaivedKobo')).toBe('50000');
    expect(metricOf(r, 'lateFeesOwedKobo')).toBe('50000');
    expect(metricOf(r, 'lateFeesPaidKobo')).toBe('0');
    expect(metricOf(r, 'levyAccruedKobo')).toBe('50000');
    expect(r.rows.map((x) => x.kind).sort()).toEqual(['Late fee', 'Late fee', 'Platform levy (cycle)']);
  });

  it('lists who is behind with the case and plan around them, as of today', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await confirmed(w, g.id, people[0].membership.id, D1);
    await prisma.ajoDefaultCase.create({ data: { associationId: w.A, groupId: g.id, membershipId: people[2].membership.id, outstandingKobo: MIN, status: 'PLAN_AGREED' } });
    const r = await full(w, 'defaults');
    const byName = (p: (typeof people)[number]) => r.rows.find((x) => x.member === `${p.member.firstName} ${p.member.lastName}`)!;
    expect(byName(people[2])).toMatchObject({ standing: 'Missed', instalments: 2, behindKobo: '1000000', caseStatus: 'Plan agreed' });
    expect(byName(people[0])).toMatchObject({ standing: 'Overdue', instalments: 1, behindKobo: '500000' });
    expect(metricOf(r, 'membersBehind')).toBe(3);
    expect(metricOf(r, 'openCases')).toBe(1);
  });

  it('lists payouts by their status, with the rounds still to be prepared as scheduled, and the ledger total to check against', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: g.id }, orderBy: { position: 'asc' } });
    const first = slots[0];
    await prisma.ajoPayout.create({ data: { associationId: w.A, groupId: g.id, membershipId: first.membershipId, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.admin.id, approvedBy: w.recon.id, paidRecordedBy: w.admin.id, preparedAt: at('2027-03-02T09:00:00Z'), paidAt: at('2027-03-02T10:00:00Z'), paidReference: 'BANK-REF-9', accountSnapshot: { last4: '1111' }, idempotencyKey: `payout-${run}-${++counter}` } });
    await ledger.recordEntry(prisma as never, { associationId: w.A, groupId: g.id, membershipId: first.membershipId, type: 'PAYOUT', direction: 'DEBIT', amountKobo: 1_500_000n, refType: 'payout', refId: 1, idempotencyKey: `payout-l-${run}-${++counter}` });
    await stamp(g.id, at('2027-03-02T10:00:00Z'));
    const r = await full(w, 'payouts');
    expect(metricOf(r, 'paidKobo')).toBe('1500000');
    expect(metricOf(r, 'ledgerPaidKobo')).toBe('1500000');
    expect(metricOf(r, 'scheduledCount')).toBe(2); // rounds 2 and 3 have no payout yet
    expect(r.rows.map((x) => x.status)).toEqual(['Paid', 'Scheduled', 'Scheduled']);
    expect(r.rows[0]).toMatchObject({ reference: 'BANK-REF-9', preparedBy: 'Tunde Bello', approvedBy: 'Funke Adeyemi' });
  });

  it('audits confirmations, reversals, waivers and rule changes newest first, with who and why, and counts a self-confirmation', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const c = await confirmed(w, g.id, people[0].membership.id, D1);
    await contrib.reverseContribution({ associationId: w.A, contributionId: c.id, actorUserId: w.recon.id, reason: 'Duplicate entry, paid twice by mistake', now: at('2027-03-05T10:00:00Z') });
    await prisma.ajoContribution.updateMany({ where: { reversalOfId: c.id }, data: { createdAt: at('2027-03-05T10:00:00Z') } }); // the service stamps the real clock
    await prisma.ajoGroupRuleVersion.create({ data: { associationId: w.A, groupId: g.id, version: 2, effectiveFrom: at('2027-03-20T00:00:00Z'), createdBy: w.admin.id, createdAt: at('2027-03-08T10:00:00Z') } });
    await prisma.ajoContribution.update({ where: { id: c.id }, data: { selfConfirmed: true } });
    const r = await full(w, 'audit');
    const events = r.rows.map((x) => x.event);
    expect(events).toEqual(expect.arrayContaining(['Payment confirmed', 'Payment reversed', 'Rules changed']));
    expect(r.rows.find((x) => x.event === 'Payment reversed')).toMatchObject({ by: 'Funke Adeyemi', reason: 'Duplicate entry, paid twice by mistake' });
    expect(r.rows.find((x) => x.event === 'Rules changed')).toMatchObject({ by: 'Tunde Bello' });
    const times = r.rows.map((x) => new Date(String(x.at)).getTime());
    expect([...times].sort((a2, b2) => b2 - a2)).toEqual(times);
    expect(metricOf(r, 'selfConfirmations')).toBe(1);
    expect(metricOf(r, 'reversals')).toBe(1);
  });

  it('keeps a pot and a collector-thrift group apart in the totals', async () => {
    const w = await world();
    await pot(w);
    await pot(w);
    await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
    const r = await full(w, 'contributions');
    expect(r.blocks).toHaveLength(3);
    expect(r.totals.map((t) => t.label)).toEqual(['All rotating pots']);
    const sum = r.blocks.reduce((a, b) => a + BigInt(b.metrics.find((m) => m.key === 'expectedKobo')?.value as string), 0n);
    expect(r.totals[0].metrics.find((m) => m.key === 'expectedKobo')?.value).toBe(sum.toString());
  });
});
