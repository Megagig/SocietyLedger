/**
 * Officer and admin accountability (spec §16.7) against a real (disposable) database: who prepared, approved and recorded each payout,
 * the confirmation backlog by age, cash by collector and day, and exceptions with their reasons.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-accountability.integration --forceExit
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

import { backlogBucket } from '../../src/modules/ajo/ajo-accountability.service';

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

describe('which age bucket a waiting payment is in', () => {
  it('starts each bucket at its own age, and the 48-hour target is the third', () => {
    expect(backlogBucket(0)).toBe('UNDER_24H');
    expect(backlogBucket(23)).toBe('UNDER_24H');
    expect(backlogBucket(24)).toBe('H24_TO_48');
    expect(backlogBucket(47)).toBe('H24_TO_48');
    expect(backlogBucket(48)).toBe('OVER_TARGET');
    expect(backlogBucket(167)).toBe('OVER_TARGET');
    expect(backlogBucket(168)).toBe('OVER_7D');
  });
});

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Officer accountability (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let order: typeof import('../../src/modules/ajo/ajo-order.service');
  let acc: typeof import('../../src/modules/ajo/ajo-accountability.service');

  interface World {
    A: number;
    admin: { id: number };
    recon: { id: number };
    other: { id: number };
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-acc-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Accountability ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), recon: await user('recon'), other: await user('other') };
    for (const [u, first, last] of [[w.admin, 'Tunde', 'Bello'], [w.recon, 'Funke', 'Adeyemi'], [w.other, 'Musa', 'Ibrahim']] as const) {
      await prisma.member.create({ data: { associationId: w.A, userId: u.id, memberId: `ACC${run}${++counter}`, firstName: first, lastName: last, status: 'active' } });
    }
    const permission = await prisma.permission.upsert({ where: { key: 'ajo.reconcile' }, create: { key: 'ajo.reconcile', description: 'Test', module: 'Ajo' }, update: {} });
    const role = await prisma.role.create({ data: { associationId: w.A, name: `acc-recon-${run}-${++counter}`, displayName: 'recon' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await prisma.userRole.create({ data: { userId: w.recon.id, roleId: role.id, associationId: w.A } });
    return w;
  }
  async function mkMember(w: World) {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `m-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `ACM${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, status: 'active' } });
  }
  async function newGroup(w: World, fields: Record<string, unknown>) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
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
  const payoutRow = (w: World, groupId: number, membershipId: number, over: Record<string, unknown>) =>
    prisma.ajoPayout.create({ data: { associationId: w.A, groupId, membershipId, round: 1, grossKobo: 1_500_000n, netKobo: 1_500_000n, confirmedKobo: 1_500_000n, status: 'PAID', preparedBy: w.admin.id, accountSnapshot: { bankName: 'GTBank', accountName: 'Secret Name', last4: '6789' }, idempotencyKey: `payout-${run}-${++counter}`, ...over } as never });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    order = require('../../src/modules/ajo/ajo-order.service');
    acc = require('../../src/modules/ajo/ajo-accountability.service');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('flags a payout one person prepared and approved, and one the preparer or approver also recorded as paid, and names everyone in full', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const m = (i: number) => people[i].membership.id;
    await payoutRow(w, g.id, m(0), { round: 1, preparedBy: w.admin.id, approvedBy: w.recon.id, paidRecordedBy: w.other.id, approvedAt: at('2027-03-02T10:00:00Z'), paidAt: at('2027-03-02T12:00:00Z') });
    await payoutRow(w, g.id, m(1), { round: 2, preparedBy: w.admin.id, approvedBy: w.admin.id, selfApprovalConfirmed: true, paidRecordedBy: w.recon.id, approvedAt: at('2027-03-09T10:00:00Z'), paidAt: at('2027-03-09T12:00:00Z') });
    await payoutRow(w, g.id, m(2), { round: 3, preparedBy: w.admin.id, approvedBy: w.recon.id, paidRecordedBy: w.admin.id, approvedAt: at('2027-03-16T10:00:00Z'), paidAt: at('2027-03-16T12:00:00Z') });

    const a = await acc.getAccountability({ associationId: w.A, groupId: g.id, now: LATER });
    const by = (round: number) => a.separation.payouts.find((p) => p.round === round)!;
    expect(by(1)).toMatchObject({ preparedBy: 'Tunde Bello', approvedBy: 'Funke Adeyemi', recordedPaidBy: 'Musa Ibrahim', singleAdminApproval: false, sameRecorder: false });
    expect(by(2)).toMatchObject({ singleAdminApproval: true });
    expect(by(3)).toMatchObject({ sameRecorder: true, singleAdminApproval: false });
    expect(a.separation.flaggedCount).toBe(2);
    expect(JSON.stringify(a)).not.toContain('Secret Name');
  });

  it('counts payments waiting for confirmation by age against the 48-hour target, oldest first, with the member\'s full name', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const a1 = await report(w, g.id, people[0].membership.id, D1);
    const a2 = await report(w, g.id, people[1].membership.id, D1);
    await report(w, g.id, people[2].membership.id, D1);
    const hoursAgo = (h: number) => new Date(LATER.getTime() - h * 3_600_000);
    await prisma.ajoContribution.update({ where: { id: a1.contribution.id }, data: { createdAt: hoursAgo(60) } });
    await prisma.ajoContribution.update({ where: { id: a2.contribution.id }, data: { createdAt: hoursAgo(10) } });
    const rest = await prisma.ajoContribution.findMany({ where: { groupId: g.id, status: 'REPORTED', id: { notIn: [a1.contribution.id, a2.contribution.id] } } });
    await prisma.ajoContribution.update({ where: { id: rest[0].id }, data: { createdAt: hoursAgo(200) } });

    const a = await acc.getAccountability({ associationId: w.A, groupId: g.id, now: LATER });
    expect(a.backlog).toMatchObject({ total: 3, targetHours: 48, pastTarget: 2, oldestHours: 200 });
    expect(Object.fromEntries(a.backlog.buckets.map((b) => [b.key, b.count]))).toEqual({ UNDER_24H: 1, H24_TO_48: 0, OVER_TARGET: 1, OVER_7D: 1 });
    expect(a.backlog.oldest.map((x) => x.ageHours)).toEqual([200, 60, 10]); // oldest first
    expect(a.backlog.oldest.map((x) => x.member).every((n) => /^Adaeze Okafor\d+$/.test(n))).toBe(true);
  });

  it('shows cash by collector and day for a collector-thrift scheme only', async () => {
    const w = await world();
    const thrift = await newGroup(w, { model: 'COLLECTOR_THRIFT', cycleLength: 3 });
    await prisma.ajoCashHandover.create({ data: { associationId: w.A, groupId: thrift.id, collectorUserId: w.other.id, forDate: at('2027-03-02T00:00:00Z'), expectedKobo: 1_000_000n, collectedKobo: 900_000n, handedOverKobo: 850_000n, differenceKobo: -50_000n, countedKobo: 850_000n, reconciledBy: w.recon.id, reconciledAt: at('2027-03-03T09:00:00Z'), idempotencyKey: `h-${run}-${++counter}` } });
    await prisma.ajoCashHandover.create({ data: { associationId: w.A, groupId: thrift.id, collectorUserId: w.other.id, forDate: at('2027-03-03T00:00:00Z'), expectedKobo: 1_000_000n, collectedKobo: 1_000_000n, handedOverKobo: 1_000_000n, differenceKobo: 0n, idempotencyKey: `h-${run}-${++counter}` } });
    const a = await acc.getAccountability({ associationId: w.A, groupId: thrift.id, now: LATER });
    expect(a.cash).toHaveLength(2);
    expect(a.cash?.[1]).toMatchObject({ date: '2027-03-02', collector: 'Musa Ibrahim', expectedKobo: '1000000', collectedKobo: '900000', handedOverKobo: '850000', countedKobo: '850000', differenceKobo: '-50000', reconciled: true, reconciledBy: 'Funke Adeyemi' });
    expect(a.cash?.[0]).toMatchObject({ reconciled: false, countedKobo: null, countDifferenceKobo: null });
    const rotating = await pot(w);
    expect((await acc.getAccountability({ associationId: w.A, groupId: rotating.g.id, now: LATER })).cash).toBeNull();
  });

  it('lists reversals, emergency position changes, voided payouts and rule changes with their reasons and who did them', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    const rep = await report(w, g.id, people[0].membership.id, D1);
    await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now: D1 });
    await contrib.reverseContribution({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, reason: 'Duplicate entry, paid twice by mistake', now: D1 });
    await prisma.ajoPayoutOrderEvent.create({ data: { associationId: w.A, groupId: g.id, type: 'EXCEPTION', detail: { membershipId: people[1].membership.id, from: 3, to: 1 }, reason: 'Medical emergency', requestedBy: w.admin.id, approvedBy: w.admin.id } });
    await payoutRow(w, g.id, people[0].membership.id, { status: 'VOID', voidReason: 'Wrong account number', voidedBy: w.recon.id, voidedAt: at('2027-03-05T10:00:00Z') });
    await prisma.ajoGroupRuleVersion.create({ data: { associationId: w.A, groupId: g.id, version: 2, effectiveFrom: at('2027-03-20T00:00:00Z'), createdBy: w.admin.id } });

    const a = await acc.getAccountability({ associationId: w.A, groupId: g.id, now: LATER });
    const kinds = a.exceptions.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['REVERSAL', 'ORDER_CHANGE', 'PAYOUT_VOIDED', 'RULES']));
    expect(a.exceptions.find((e) => e.kind === 'REVERSAL')).toMatchObject({ reason: 'Duplicate entry, paid twice by mistake', by: 'Funke Adeyemi' });
    expect(a.exceptions.find((e) => e.kind === 'ORDER_CHANGE')).toMatchObject({ reason: 'Medical emergency', by: 'Tunde Bello' });
    expect(a.exceptions.find((e) => e.kind === 'PAYOUT_VOIDED')).toMatchObject({ reason: 'Wrong account number', by: 'Funke Adeyemi' });
    expect(a.exceptions.find((e) => e.kind === 'RULES')?.by).toBe('Tunde Bello');
    // Newest first.
    const times = a.exceptions.map((e) => e.at.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('exports the same report as a CSV that opens in a spreadsheet and cannot run a name as a formula', async () => {
    const w = await world();
    const { g, people } = await pot(w);
    await report(w, g.id, people[0].membership.id, D1);
    await prisma.ajoPayoutOrderEvent.create({ data: { associationId: w.A, groupId: g.id, type: 'EXCEPTION', detail: { membershipId: people[1].membership.id, from: 3, to: 1 }, reason: '=HYPERLINK("http://x")', requestedBy: w.admin.id, approvedBy: w.admin.id } });
    const a = await acc.getAccountability({ associationId: w.A, groupId: g.id, now: LATER });
    const csv = acc.accountabilityCsv(a, LATER);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Accountability report"');
    expect(csv).toContain('Payments waiting for confirmation');
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")"');
    expect(csv).not.toContain('0123456789');
  });
});
