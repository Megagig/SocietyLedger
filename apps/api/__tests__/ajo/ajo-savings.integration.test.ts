/**
 * A collector-thrift saver's own view (spec §16.6) against a real (disposable) database: my savings, the calendar, payments, where my
 * cash is, my collector, my record, and the statement and receipt files. Their own records only.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-savings.integration --forceExit
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
const START = '2027-03-01';
/** Weekly, three payments: due 1, 8 and 15 March. */
const D1 = at('2027-03-01T10:00:00Z');
const D2 = at('2027-03-09T10:00:00Z');
const MIN = 50_000n; // ₦500.00

/* eslint-disable @typescript-eslint/no-var-requires */
suite('A collector-thrift saver\'s own view (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let groups: typeof import('../../src/modules/ajo/ajo-group.service');
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let consent: typeof import('../../src/modules/ajo/ajo-consent.service');
  let contrib: typeof import('../../src/modules/ajo/ajo-contribution.service');
  let handovers: typeof import('../../src/modules/ajo/ajo-handover.service');
  let savings: typeof import('../../src/modules/ajo/ajo-savings.service');
  let statement: typeof import('../../src/modules/ajo/ajo-savings-statement');

  interface World {
    A: number;
    admin: { id: number };
    recon: { id: number };
    collector: { id: number };
  }
  let counter = 0;

  async function world(): Promise<World> {
    const slug = `ajo-sav-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Ajo Savings ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const w: World = { A: assoc.id, admin: await user('admin'), recon: await user('recon'), collector: await user('collector') };
    await prisma.member.create({ data: { associationId: w.A, userId: w.collector.id, memberId: `COL${run}${++counter}`, firstName: 'Musa', lastName: 'Ibrahim', phone: '08099990000', status: 'active' } });
    await prisma.member.create({ data: { associationId: w.A, userId: w.recon.id, memberId: `REC${run}${++counter}`, firstName: 'Funke', lastName: 'Adeyemi', status: 'active' } });
    const permission = await prisma.permission.upsert({ where: { key: 'ajo.reconcile' }, create: { key: 'ajo.reconcile', description: 'Test', module: 'Ajo' }, update: {} });
    const role = await prisma.role.create({ data: { associationId: w.A, name: `sav-recon-${run}-${++counter}`, displayName: 'recon' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await prisma.userRole.create({ data: { userId: w.recon.id, roleId: role.id, associationId: w.A } });
    return w;
  }
  async function mkMember(w: World) {
    const n = ++counter;
    const user = await prisma.user.create({ data: { associationId: w.A, email: `saver-${run}-${n}@test.local`, passwordHash: 'x', isActive: true } });
    return prisma.member.create({ data: { associationId: w.A, userId: user.id, memberId: `SAV${run}${n}`, firstName: 'Adaeze', lastName: `Okafor${n}`, phone: '08031234567', status: 'active' } });
  }
  async function newGroup(w: World) {
    const g = await groups.createGroup({
      associationId: w.A,
      actorUserId: w.admin.id,
      now: NOW,
      bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle Ajo' },
      fields: { name: `Thrift ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', cycleLength: 3, contributionKobo: Number(MIN), startDate: START, maxParticipants: 30, collectorFeeType: 'DAYS', collectorFeeValue: 1 } as never,
    });
    await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW });
    return g;
  }
  async function join(w: World, groupId: number) {
    const member = await mkMember(w);
    const membership = await members.addMember({ associationId: w.A, groupId, memberId: member.id, actorUserId: w.admin.id, amountKobo: MIN });
    await consent.acceptRules({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, actorIsOfficer: true, note: 'read aloud, agreed in person', now: NOW });
    await members.approveMembership({ associationId: w.A, membershipId: membership.id, actorUserId: w.admin.id, now: NOW });
    return { member, membership };
  }
  async function saver(w: World) {
    const g = await newGroup(w);
    const a = await join(w, g.id);
    await groups.startGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: BEFORE_START });
    await prisma.ajoCollectorAssignment.create({ data: { associationId: w.A, collectorUserId: w.collector.id, membershipId: a.membership.id, startsOn: at('2027-02-20T00:00:00Z') } });
    return { g, a };
  }
  async function transfer(w: World, groupId: number, membershipId: number, amount: bigint, now: Date, confirm: boolean) {
    const rep = await contrib.reportTransfer({ associationId: w.A, groupId, membershipId, amountKobo: amount, idempotencyKey: `k-${run}-${++counter}`, actorUserId: w.admin.id, actorCanManage: true, proof: { buffer: Buffer.from(`p-${run}-${++counter}`), mimeType: 'image/png' }, now });
    if (confirm) await contrib.confirmTransfer({ associationId: w.A, contributionId: rep.contribution.id, actorUserId: w.recon.id, now });
    return rep.contribution.id;
  }
  const cash = (w: World, groupId: number, membershipId: number, amount: bigint, now: Date) =>
    contrib.recordCash({ associationId: w.A, groupId, membershipId, amountKobo: amount, idempotencyKey: `c-${run}-${++counter}`, actorUserId: w.collector.id, actorCanManage: false, now });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    groups = require('../../src/modules/ajo/ajo-group.service');
    members = require('../../src/modules/ajo/ajo-membership.service');
    consent = require('../../src/modules/ajo/ajo-consent.service');
    contrib = require('../../src/modules/ajo/ajo-contribution.service');
    handovers = require('../../src/modules/ajo/ajo-handover.service');
    savings = require('../../src/modules/ajo/ajo-savings.service');
    statement = require('../../src/modules/ajo/ajo-savings-statement');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('my savings', () => {
    it('shows saved and reported apart, the progress, and exactly what the saver will receive after the collector\'s fee', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 100_000n, D1, true); // two payments confirmed: ₦1,000.00
      await transfer(w, g.id, a.membership.id, 50_000n, D1, false); // a third, reported but not confirmed
      const s = await savings.getSavings({ associationId: w.A, membershipId: a.membership.id, now: D1 });
      expect(s.saved).toMatchObject({ savedKobo: '100000', reportedKobo: '50000', carriedKobo: '0' });
      expect(s.progress).toMatchObject({ total: 3, made: 2, missed: 0 });
      expect(s.pace).toMatchObject({ upToDate: true });
      // ₦1,000.00 saved, less one of the saver's own contributions (₦500.00) as the fee.
      expect(s.receive).toMatchObject({ feeKobo: '50000', netKobo: '50000', text: '₦1,000.00 saved − ₦500.00 collector fee = ₦500.00' });
      expect(s.receive.feeText).toBe('1 day of your contribution (₦500.00).');
      expect(s.payout).toMatchObject({ state: 'UPCOMING', willBe: 'WITHDRAW' });
      expect(s.cycleNo).toBe(1);
      expect(s.endsOn).toBe('2027-03-15');
    });

    it('says how far behind a saver is, in full naira, and shows a reported payment as Reported not as paid', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 50_000n, D2, false);
      const s = await savings.getSavings({ associationId: w.A, membershipId: a.membership.id, now: D2 });
      expect(s.pace).toMatchObject({ expectedToDateKobo: '100000', behindKobo: '100000', upToDate: false });
      const first = s.calendar[0];
      expect(['REPORTED', 'OVERDUE', 'MISSED']).toContain(first.status);
      expect(s.calendar.some((d) => d.status === 'REPORTED' && d.label === 'Reported, awaiting confirmation')).toBe(true);
      expect(s.saved.savedKobo).toBe('0');
    });

    it('gives the calendar one entry per due date with the same status words as the circle board', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 50_000n, D1, true);
      const s = await savings.getSavings({ associationId: w.A, membershipId: a.membership.id, now: D2 });
      expect(s.calendar.map((d) => d.dueDate)).toEqual(['2027-03-01', '2027-03-08', '2027-03-15']);
      expect(s.calendar[0]).toMatchObject({ status: 'PAID_ON_TIME', label: 'Paid on time', datePaid: '2027-03-01' });
      expect(s.calendar[1].status).toBe('OVERDUE');
      expect(s.calendar[1].graceEndsOn).toBe('2027-03-11');
      expect(s.calendar[2].status).toBe('DUE');
    });

    it('is for collector thrift only', async () => {
      const w = await world();
      const g = await groups.createGroup({ associationId: w.A, actorUserId: w.admin.id, now: NOW, fields: { name: 'Pot', model: 'ROTATING_POT', frequency: 'MONTHLY', contributionKobo: 500000, startDate: START, maxParticipants: 3 } as never });
      await groups.openGroup({ associationId: w.A, groupId: g.id, actorUserId: w.admin.id, now: NOW }).catch(() => undefined);
      const member = await mkMember(w);
      const m = await members.addMember({ associationId: w.A, groupId: g.id, memberId: member.id, actorUserId: w.admin.id }).catch(() => null);
      if (m) await expect(savings.getSavings({ associationId: w.A, membershipId: m.id })).rejects.toMatchObject({ code: 'NOT_COLLECTOR_THRIFT' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('where my cash is', () => {
    it('follows a cash payment through three steps, names who did each, and flags a step that is late', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      const day = at('2027-03-02T08:15:00Z');
      await cash(w, g.id, a.membership.id, 50_000n, day);

      // Recorded, not yet handed in.
      let t = await savings.getCashTracker({ associationId: w.A, membershipId: a.membership.id, now: at('2027-03-02T12:00:00Z') });
      expect(t.payments[0]).toMatchObject({ stage: 'RECORDED', amountKobo: '50000', handedIn: null, confirmed: null, late: null });
      expect(t.payments[0].recorded.by).toBe('Musa I.');
      expect(JSON.stringify(t)).not.toContain('08099990000'); // the collector's phone is not part of the tracker

      // More than a day later and still not handed in: "Not yet handed in", and the saver is given the instalment to ask about.
      t = await savings.getCashTracker({ associationId: w.A, membershipId: a.membership.id, now: at('2027-03-03T12:00:00Z') });
      expect(t.payments[0].late).toEqual({ step: 'HANDED_IN', text: 'Not yet handed in' });
      expect(t.payments[0].queryInstallmentId).not.toBeNull();

      // The collector hands it in.
      const handed = await handovers.createHandover({ associationId: w.A, groupId: g.id, collectorUserId: w.collector.id, handedOverKobo: 50_000n, idempotencyKey: `h-${run}-${++counter}`, forDate: at('2027-03-02T00:00:00Z'), now: at('2027-03-02T18:40:00Z') });
      // A handover is stamped by the database clock; the test lives in 2027, so say when it was handed in.
      await prisma.ajoCashHandover.update({ where: { id: handed.handoverId }, data: { createdAt: at('2027-03-02T18:40:00Z') } });
      t = await savings.getCashTracker({ associationId: w.A, membershipId: a.membership.id, now: at('2027-03-02T19:00:00Z') });
      expect(t.payments[0]).toMatchObject({ stage: 'HANDED_IN', late: null });
      expect(t.payments[0].handedIn).not.toBeNull();

      // The office counts it and confirms.
      await handovers.reconcileHandover({ associationId: w.A, handoverId: handed.handoverId, actorUserId: w.recon.id, countedKobo: 50_000n, now: at('2027-03-03T09:10:00Z') });
      t = await savings.getCashTracker({ associationId: w.A, membershipId: a.membership.id, now: at('2027-03-03T10:00:00Z') });
      expect(t.payments[0].stage).toBe('CONFIRMED');
      expect(t.payments[0].confirmed).toMatchObject({ by: 'Funke A.' });
      expect(t.payments[0].late).toBeNull();
    });

    it('says when handed-in cash has waited too long for the office', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await cash(w, g.id, a.membership.id, 50_000n, at('2027-03-02T08:00:00Z'));
      const handed = await handovers.createHandover({ associationId: w.A, groupId: g.id, collectorUserId: w.collector.id, handedOverKobo: 50_000n, idempotencyKey: `h-${run}-${++counter}`, forDate: at('2027-03-02T00:00:00Z'), now: at('2027-03-02T18:00:00Z') });
      await prisma.ajoCashHandover.update({ where: { id: handed.handoverId }, data: { createdAt: at('2027-03-02T18:00:00Z') } });
      const t = await savings.getCashTracker({ associationId: w.A, membershipId: a.membership.id, now: at('2027-03-05T10:00:00Z') });
      expect(t.payments[0].late).toEqual({ step: 'CONFIRMED', text: 'Not yet confirmed by the office' });
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('payments, collector and record', () => {
    it('lists each payment with who took it, when it was confirmed and its receipt number', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 50_000n, D1, true);
      const p = await savings.getPayments({ associationId: w.A, membershipId: a.membership.id });
      expect(p.payments[0]).toMatchObject({ method: 'TRANSFER', counts: true, label: 'Confirmed', recordedBy: 'You', confirmedBy: 'Funke A.', canDownloadReceipt: true });
      expect(p.payments[0].receiptNumber).toBeTruthy();
    });

    it('shows the saver\'s own collector, with their phone, and the fee rule in words', async () => {
      const w = await world();
      const { a } = await saver(w);
      const info = await savings.getCollectorInfo({ associationId: w.A, membershipId: a.membership.id, now: D1 });
      expect(info.collector).toMatchObject({ name: 'Musa Ibrahim', initials: 'MI', phone: '08099990000' });
      expect(info.fee.text).toBe('1 day of your contribution (₦500.00).');
    });

    it('counts the streak of payments made on time and stops at the first that was not', async () => {
      expect(savings.streakOf([], D1)).toBe(0);
      const d = (iso: string, status: 'PAID_ON_TIME' | 'PAID_LATE' | 'MISSED') => ({ dueDate: at(`${iso}T00:00:00Z`), state: { status } });
      const days = [d('2027-03-01', 'PAID_ON_TIME'), d('2027-03-02', 'PAID_LATE'), d('2027-03-03', 'PAID_ON_TIME'), d('2027-03-04', 'PAID_ON_TIME'), d('2027-03-05', 'PAID_ON_TIME')];
      expect(savings.streakOf(days, at('2027-03-10T00:00:00Z'))).toBe(3);
      expect(savings.streakOf([...days, d('2027-03-06', 'MISSED')], at('2027-03-10T00:00:00Z'))).toBe(0);
      // One still inside its grace has not been decided, so it neither counts nor ends the streak.
      const waiting = { dueDate: at('2027-03-07T00:00:00Z'), state: { status: 'OVERDUE' as never } };
      expect(savings.streakOf([...days, waiting as never], at('2027-03-10T00:00:00Z'))).toBe(3);
    });

    it('gives the trust band with its counts, and the streak', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 50_000n, D1, true);
      const r = await savings.getRecord({ associationId: w.A, membershipId: a.membership.id, now: D2 });
      expect(r.trust).toMatchObject({ dueCount: 2 });
      expect(r.streak).toBe(1);
      expect(r.pastCycles).toEqual([]);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('statements and receipts', () => {
    it('makes a CSV with full naira, a note that the bank statement is final, and cells that cannot run as formulas', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      await transfer(w, g.id, a.membership.id, 100_000n, D1, true);
      const data = await statement.buildStatement({ associationId: w.A, membershipId: a.membership.id, now: D2 });
      const csv = statement.statementCsv(data);
      expect(csv.startsWith('﻿')).toBe(true);
      expect(csv).toContain('"Saved so far","₦1,000.00"');
      expect(csv).toContain('"You will receive","₦500.00"');
      expect(csv).toContain('The bank statement is the final word.');
      expect(csv).not.toContain('0123456789');
      expect(csv).not.toContain('08031234567');
      const evil = statement.statementCsv({ ...data, groupName: '=HYPERLINK("http://x")' });
      expect(evil).toContain('"\'=HYPERLINK(""http://x"")"');
    });

    it('makes a PDF statement and a receipt for a confirmed payment only, and only for the saver or an officer', async () => {
      const w = await world();
      const { g, a } = await saver(w);
      const id = await transfer(w, g.id, a.membership.id, 50_000n, D1, true);
      const pending = await transfer(w, g.id, a.membership.id, 50_000n, D1, false);
      const data = await statement.buildStatement({ associationId: w.A, membershipId: a.membership.id, now: D2 });
      const pdf = await statement.statementPdf(data);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const receipt = await statement.receiptPdf({ associationId: w.A, contributionId: id, viewerUserId: a.member.userId as number, viewerIsOfficer: false });
      expect(receipt.file.subarray(0, 5).toString()).toBe('%PDF-');
      expect(receipt.name).toMatch(/^receipt-.*\.pdf$/);
      await expect(statement.receiptPdf({ associationId: w.A, contributionId: pending, viewerUserId: a.member.userId as number, viewerIsOfficer: false })).rejects.toMatchObject({ code: 'NOT_CONFIRMED' });
      const stranger = await mkMember(w);
      await expect(statement.receiptPdf({ associationId: w.A, contributionId: id, viewerUserId: stranger.userId as number, viewerIsOfficer: false })).rejects.toMatchObject({ code: 'CONTRIBUTION_NOT_FOUND' });
      expect((await statement.receiptPdf({ associationId: w.A, contributionId: id, viewerUserId: w.recon.id, viewerIsOfficer: true })).file.length).toBeGreaterThan(100);
    });
  });
});
