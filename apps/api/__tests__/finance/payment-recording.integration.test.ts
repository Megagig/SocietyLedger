/**
 * Recording received payments (one charge or several), against a real database.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped:
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/finance/payment-recording --forceExit
 */
const PAY_DB = process.env.AJO_TEST_DATABASE_URL;
if (PAY_DB && !/test/i.test(new URL(PAY_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (PAY_DB) {
  process.env.DATABASE_URL = PAY_DB;
  process.env.DIRECT_URL = PAY_DB;
}

jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onPaymentRecorded: jest.fn(async () => undefined), onTransactionCreated: jest.fn(async () => undefined) },
}));

const paySuite = PAY_DB ? describe : describe.skip;
if (PAY_DB) jest.setTimeout(120000);
const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* eslint-disable @typescript-eslint/no-var-requires */
paySuite('Recording payments (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let service: typeof import('../../src/modules/finance/payment-recording.service').paymentRecordingService;
  let settingsService: typeof import('../../src/modules/settings/settings.service').SettingsService;
  let n = 0;

  async function world() {
    const slug = `pay-${stamp}-${++n}`;
    const assoc = await prisma.association.create({ data: { name: `Pay ${n} ${stamp}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${stamp}-${++n}@test.local`, passwordHash: 'x', isActive: true } });
    const officer = await user('officer');
    const otherOfficer = await user('other');
    const memberUser = await user('member');
    const mk = (userId: number | null, first: string) =>
      prisma.member.create({ data: { associationId: assoc.id, userId, memberId: `PM${stamp}${++n}`, firstName: first, lastName: 'Test', status: 'active' } });
    const member = await mk(memberUser.id, 'Ada');
    const officerAsMember = await mk(officer.id, 'Olu');
    const category = await prisma.financialCategory.create({ data: { associationId: assoc.id, name: 'Burial Levy', type: 'levy' } });
    const charge = (memberId: number, amount: number, extra: Record<string, unknown> = {}) =>
      prisma.transaction.create({ data: { associationId: assoc.id, memberId, categoryId: category.id, amount, status: 'pending', createdBy: officer.id, ...extra } });
    return { A: assoc.id, officer, otherOfficer, member, officerAsMember, charge };
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    service = require('../../src/modules/finance/payment-recording.service').paymentRecordingService;
    settingsService = require('../../src/modules/settings/settings.service').SettingsService;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const paid = async (transactionId: number) =>
    (await prisma.payment.findMany({ where: { transactionId } })).reduce((sum, p) => sum + Number(p.amountPaid), 0);

  describe('one charge', () => {
    it('records a full payment: the charge is paid, with a receipt, and the audit log says where it came from', async () => {
      const w = await world();
      const c = await w.charge(w.member.id, 3000);
      const [saved] = await service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 3000 }], paymentMethod: 'cash', source: 'levy-campaign' });
      expect(saved.transactionStatus).toBe('paid');
      expect(Number(saved.remainingBalance)).toBe(0);
      expect(saved.payment.receiptNumber).toMatch(/^RCP\d{6}-\d{6}$/);
      expect((await prisma.transaction.findUnique({ where: { id: c.id } }))?.status).toBe('paid');
      const audit = await prisma.auditLog.findFirst({ where: { associationId: w.A, tableName: 'payments', recordId: saved.payment.id } });
      expect((audit?.newValues as { source?: string }).source).toBe('levy-campaign');
    });

    it('records a part payment and leaves the balance', async () => {
      const w = await world();
      const c = await w.charge(w.member.id, 3000);
      const [saved] = await service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 1000 }] });
      expect(saved.transactionStatus).toBe('partial');
      expect(Number(saved.remainingBalance)).toBe(2000);
    });

    it('keeps a levy campaign assignment in step with the money', async () => {
      const w = await world();
      const category = await prisma.financialCategory.findFirstOrThrow({ where: { associationId: w.A } });
      const campaign = await prisma.levyCampaign.create({ data: { associationId: w.A, categoryId: category.id, name: 'Burial', targetAmount: 3000, deadline: new Date('2027-01-06'), createdBy: w.officer.id } });
      const c = await w.charge(w.member.id, 3000);
      const assignment = await prisma.levyCampaignAssignment.create({ data: { campaignId: campaign.id, memberId: w.member.id, transactionId: c.id, amount: 3000 } });
      await service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 1000 }] });
      expect((await prisma.levyCampaignAssignment.findUnique({ where: { id: assignment.id } }))?.status).toBe('partial');
      await service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 2000 }] });
      expect((await prisma.levyCampaignAssignment.findUnique({ where: { id: assignment.id } }))?.status).toBe('paid');
    });

    it('refuses more than the balance, a paid charge, a voided charge, another association’s charge', async () => {
      const w = await world();
      const other = await world();
      const c = await w.charge(w.member.id, 3000);
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 3001 }] })).rejects.toMatchObject({ code: 'OVER_BALANCE', transactionId: c.id });
      await service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 3000 }] });
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 1 }] })).rejects.toMatchObject({ code: 'ALREADY_PAID' });
      const voided = await w.charge(w.member.id, 500, { isVoided: true });
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: voided.id, amountPaid: 500 }] })).rejects.toMatchObject({ code: 'VOIDED' });
      const foreign = await other.charge(other.member.id, 500);
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: foreign.id, amountPaid: 500 }] })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    it('needs the full balance when the association has switched partial payments off', async () => {
      const w = await world();
      await settingsService.updateSettings(w.A, 'financial', { enablePartialPayments: false }, w.officer.id);
      const c = await w.charge(w.member.id, 3000);
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 1000 }] })).rejects.toMatchObject({ code: 'PARTIAL_NOT_ALLOWED' });
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 3000 }] })).resolves.toHaveLength(1);
    });

    it('refuses a payment method the association has not enabled', async () => {
      const w = await world();
      await settingsService.updateSettings(w.A, 'payments', { enabledChannels: ['cash'] }, w.officer.id);
      const c = await w.charge(w.member.id, 3000);
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: c.id, amountPaid: 3000 }], paymentMethod: 'cheque' })).rejects.toMatchObject({ code: 'METHOD_NOT_ENABLED' });
    });
  });

  describe('several charges at once', () => {
    it('records them together, each with its own receipt', async () => {
      const w = await world();
      const [a, b, c] = [await w.charge(w.member.id, 3000), await w.charge(w.member.id, 5000), await w.charge(w.member.id, 1000)];
      const saved = await service.record(w.A, w.otherOfficer.id, {
        items: [{ transactionId: a.id, amountPaid: 3000 }, { transactionId: b.id, amountPaid: 2000 }, { transactionId: c.id, amountPaid: 1000 }],
        paymentMethod: 'cash',
        source: 'member-ledger',
      });
      expect(saved.map((s) => s.transactionStatus)).toEqual(['paid', 'partial', 'paid']);
      expect(new Set(saved.map((s) => s.payment.receiptNumber)).size).toBe(3);
    });

    it('saves NOTHING when one charge breaks a rule, and names that charge', async () => {
      const w = await world();
      const [a, b] = [await w.charge(w.member.id, 3000), await w.charge(w.member.id, 5000)];
      await expect(
        service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: a.id, amountPaid: 3000 }, { transactionId: b.id, amountPaid: 9999 }] }),
      ).rejects.toMatchObject({ code: 'OVER_BALANCE', transactionId: b.id });
      expect(await paid(a.id)).toBe(0);
      expect((await prisma.transaction.findUnique({ where: { id: a.id } }))?.status).toBe('pending');
    });

    it('will not take the same charge twice in one request', async () => {
      const w = await world();
      const a = await w.charge(w.member.id, 3000);
      await expect(
        service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: a.id, amountPaid: 1000 }, { transactionId: a.id, amountPaid: 1000 }] }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_CHARGE' });
    });

    it('lets only one of two officers recording at the same moment pay the same balance', async () => {
      const w = await world();
      const a = await w.charge(w.member.id, 3000);
      const results = await Promise.allSettled([
        service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: a.id, amountPaid: 3000 }] }),
        service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: a.id, amountPaid: 3000 }] }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await paid(a.id)).toBe(3000);
    });
  });

  describe('an officer paying their own debt', () => {
    it('is refused by default, naming the reason', async () => {
      const w = await world();
      const mine = await w.charge(w.officerAsMember.id, 3000);
      await expect(service.record(w.A, w.officer.id, { items: [{ transactionId: mine.id, amountPaid: 3000 }] })).rejects.toMatchObject({
        code: 'SELF_PAYMENT_NOT_ALLOWED',
        status: 403,
        transactionId: mine.id,
      });
      expect(await paid(mine.id)).toBe(0);
    });

    it('is refused even inside a batch of other people’s debts, and saves none of them', async () => {
      const w = await world();
      const theirs = await w.charge(w.member.id, 3000);
      const mine = await w.charge(w.officerAsMember.id, 3000);
      await expect(service.record(w.A, w.officer.id, { items: [{ transactionId: theirs.id, amountPaid: 3000 }, { transactionId: mine.id, amountPaid: 3000 }] })).rejects.toMatchObject({ code: 'SELF_PAYMENT_NOT_ALLOWED' });
      expect(await paid(theirs.id)).toBe(0);
    });

    it('is allowed once the association switches the setting on', async () => {
      const w = await world();
      await settingsService.updateSettings(w.A, 'financial', { allowOfficerSelfPayment: true }, w.officer.id);
      const mine = await w.charge(w.officerAsMember.id, 3000);
      await expect(service.record(w.A, w.officer.id, { items: [{ transactionId: mine.id, amountPaid: 3000 }] })).resolves.toHaveLength(1);
    });

    it('is fine for a different officer to record it', async () => {
      const w = await world();
      const mine = await w.charge(w.officerAsMember.id, 3000);
      await expect(service.record(w.A, w.otherOfficer.id, { items: [{ transactionId: mine.id, amountPaid: 3000 }] })).resolves.toHaveLength(1);
    });
  });
});
