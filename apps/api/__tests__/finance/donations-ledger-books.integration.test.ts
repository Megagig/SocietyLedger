/**
 * Donations, member ledgers and books on a real, disposable database: every way a donation or a payment can happen must leave the member
 * ledgers and the books agreeing with the charges and payments, and the repair that runs on deploy must find nothing left to fix.
 *
 * Skipped unless LEDGER_TEST_DATABASE_URL is set. Point it at an empty database whose name contains "test" with the migrations applied:
 *   createdb societyledger_ledger_test
 *   DATABASE_URL=postgresql://.../societyledger_ledger_test pnpm --filter api exec prisma migrate deploy
 *   LEDGER_TEST_DATABASE_URL=postgresql://.../societyledger_ledger_test pnpm --filter api test donations-ledger-books
 */
const TEST_DB = process.env.LEDGER_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('LEDGER_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

jest.mock('../../src/services/cache-invalidation.service', () => ({
  cacheInvalidationService: { onTransactionChange: jest.fn(async () => undefined), onPaymentChange: jest.fn(async () => undefined) },
}));

const suite = TEST_DB ? describe : describe.skip;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const num = (v: unknown) => Number(v);

suite('donations on the member ledger and the books', () => {
  let prisma: any;
  let services: any;
  let A: { associationId: number; userId: number; dues: number; donation: number; members: number[] };

  async function newAssociation(tag: string) {
    const assoc = await prisma.association.create({ data: { name: `Test ${tag}`, slug: `t-${run}-${tag}`, subdomain: `t-${run}-${tag}` } });
    const user = await prisma.user.create({ data: { email: `${tag}-${run}@example.test`, passwordHash: 'x', role: 'admin', associationId: assoc.id, isActive: true, emailVerified: true } });
    await services.accountingService.initializeChartOfAccounts(assoc.id);
    const dues = await prisma.financialCategory.create({ data: { associationId: assoc.id, name: 'Dues', type: 'due', amount: 20000 } });
    const donation = await prisma.financialCategory.create({ data: { associationId: assoc.id, name: 'Building Fund', type: 'donation' } });
    const members = [];
    for (let i = 1; i <= 8; i += 1) {
      members.push((await prisma.member.create({ data: { associationId: assoc.id, memberId: `M${i}`, firstName: `M${i}`, lastName: tag, status: 'active' } })).id);
    }
    return { associationId: assoc.id, userId: user.id, dues: dues.id, donation: donation.id, members };
  }

  async function pay(assoc: typeof A, transactionId: number, amount: number, method: string, tag: string, status: string) {
    const p = await prisma.payment.create({ data: { associationId: assoc.associationId, transactionId, amountPaid: amount, paymentDate: new Date(), paymentMethod: method, receiptNumber: `RCP-${run}-${tag}`, confirmedBy: assoc.userId } });
    await prisma.transaction.update({ where: { id: transactionId }, data: { status } });
    await services.syncPaymentEffects({ paymentId: p.id }, assoc.userId);
    return p;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../../src/lib/prisma'));
    services = {
      accountingService: (await import('../../src/modules/accounting/accounting.service')).accountingService,
      accounting: (await import('../../src/services/accounting-integration.service')).accountingIntegrationService,
      runAsCashCollection: (await import('../../src/services/accounting-integration.service')).runAsCashCollection,
      ledger: (await import('../../src/modules/member-finance/member-ledger.service')).memberLedgerService,
      donations: (await import('../../src/modules/finance/advanced/donations.service')).donationsService,
      syncPaymentEffects: (await import('../../src/services/payment-sync.service')).syncPaymentEffects,
      unwind: (await import('../../src/modules/finance/charge-unwind')).unwindDeletedCharges,
      syncLedgerDebit: (await import('../../src/modules/finance/ledger-sync')).syncLedgerDebit,
      repair: await import('../../src/services/ledger-books-repair.service'),
    };
    A = await newAssociation('a');
    const [m1, m2, m3, m4, m5, m6, m7] = A.members;
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    const rec = (memberId: number, amount: number, extra: object = {}) => services.donations.recordDonation(A.associationId, A.userId, { memberId, categoryId: A.donation, amount, ...extra });

    await rec(m1, 20000, { paymentMethod: 'cash', donationType: 'instant' }); // instant
    await rec(m2, 10000, { donationType: 'pledge', pledgeDate: future }); // unpaid pledge
    const pl3 = await rec(m3, 10000, { donationType: 'pledge', pledgeDate: future }); // pledge paid online
    await pay(A, pl3.transaction.id, 10000, 'paystack', 'pl3', 'paid');
    await services.runAsCashCollection(() => rec(m4, 20000, { paymentMethod: 'cash', donationType: 'instant' })); // cash route
    const due = await prisma.transaction.create({ data: { associationId: A.associationId, memberId: m5, categoryId: A.dues, amount: 15000, status: 'pending', createdBy: A.userId, referenceNumber: `D5-${run}` } });
    await services.syncLedgerDebit(due.id, A.userId);
    await services.accounting.onTransactionCreated(await prisma.transaction.findUnique({ where: { id: due.id }, include: { member: true, category: true } }), A.userId);
    await pay(A, due.id, 15000, 'nomba', 'd5', 'paid'); // dues paid online
    const gone: any = await rec(m6, 8000, { paymentMethod: 'cash', donationType: 'instant' }); // donation then deleted
    await prisma.donationRecord.delete({ where: { id: gone.donationRecord.id } });
    await prisma.payment.deleteMany({ where: { transactionId: gone.transaction.id } });
    await prisma.transaction.delete({ where: { id: gone.transaction.id } });
    await services.unwind({ associationId: A.associationId, userId: A.userId, memberIds: [m6], transactionIds: [gone.transaction.id], paymentIds: [gone.payment.id], reason: 'deleted', reference: 'DEL' });
    const pl7 = await rec(m7, 10000, { donationType: 'pledge', pledgeDate: future }); // part-paid pledge
    await pay(A, pl7.transaction.id, 4000, 'cash', 'pl7', 'partial');
  }, 120000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const balanceOf = (memberId: number) => services.ledger.getMemberBalance(A.associationId, memberId);

  it('an instant donation leaves the member owing nothing, by every route that records one', async () => {
    const [m1, , m3, m4, , m6] = A.members;
    expect(await balanceOf(m1)).toBe(0); // admin screen
    expect(await balanceOf(m3)).toBe(0); // pledge paid online
    expect(await balanceOf(m4)).toBe(0); // cash route
    expect(await balanceOf(m6)).toBe(0); // deleted: nothing left behind
  });

  it('an unpaid pledge is owed, and a part-paid one owes only what is left', async () => {
    const [, m2, , , , , m7] = A.members;
    expect(await balanceOf(m2)).toBe(10000);
    expect(await balanceOf(m7)).toBe(6000);
  });

  it('dues paid online clear the member ledger like any other payment', async () => {
    expect(await balanceOf(A.members[4])).toBe(0);
  });

  it('the books agree: donation income, pledges receivable, dues receivable and cash all match the money recorded', async () => {
    const lines = await prisma.journalEntryLine.findMany({ where: { journalEntry: { associationId: A.associationId } }, include: { account: true } });
    const net = (code: string) => lines.filter((l: any) => l.account.code === code).reduce((s: number, l: any) => s + num(l.debitAmount) - num(l.creditAmount), 0);
    expect(-net('4300')).toBe(10000 + 10000 + 20000 + 20000 + 10000); // every live donation, once
    expect(net('1123')).toBe(10000 + 6000); // the unpaid part of the two pledges
    expect(net('1121')).toBe(0); // dues receivable is cleared and never negative
    expect(net('1112') + net('1114')).toBe(20000 + 10000 + 20000 + 15000 + 4000); // only money actually received
    expect(net('1114')).toBe(20000); // the cash route's money sits in Cash in hand
  });

  it('the donation total on the member ledgers equals the Donation Pledges Receivable account', async () => {
    const d = await prisma.memberFinancialLedger.aggregate({ where: { associationId: A.associationId, category: 'DONATION', entryType: 'DEBIT' }, _sum: { amount: true } });
    const c = await prisma.memberFinancialLedger.aggregate({ where: { associationId: A.associationId, category: 'DONATION', entryType: 'CREDIT' }, _sum: { amount: true } });
    expect(num(d._sum.amount) - num(c._sum.amount)).toBe(16000);
  });

  it('the repair finds nothing to fix on data the new code wrote', async () => {
    const [report] = await services.repair.repairAllAssociations({ dryRun: true, onlyAssociationId: A.associationId });
    expect(report.ledger).toMatchObject({ created: 0, removed: 0, updated: 0 });
    expect(report.books).toMatchObject({ orphansReversed: 0, correctionsPosted: 0 });
  });

  it('repairing data the OLD code wrote makes it agree, and running the repair again changes nothing', async () => {
    const B = await newAssociation('b');
    const [m1, m2] = B.members;
    // The old way: a donation as a lone credit on the ledger, and the books posted twice (bank income, then a dues payment).
    const t = await prisma.transaction.create({ data: { associationId: B.associationId, memberId: m1, categoryId: B.donation, amount: 20000, status: 'paid', createdBy: B.userId, referenceNumber: `OLD-${run}` } });
    const p = await prisma.payment.create({ data: { associationId: B.associationId, transactionId: t.id, amountPaid: 20000, paymentDate: new Date(), paymentMethod: 'cash', receiptNumber: `OLDP-${run}`, confirmedBy: B.userId } });
    await prisma.donationRecord.create({ data: { transactionId: t.id, receiptNumber: `DON-OLD-${run}` } });
    await services.ledger.createEntry({ associationId: B.associationId, memberId: m1, entryType: 'CREDIT', category: 'DONATION', amount: 20000, effectiveDate: new Date(), description: 'Donation: old', sourceTable: 'payment', sourceId: p.id, createdBy: B.userId });
    const bank = await services.accounting.findAccount(B.associationId, '1112');
    const income = await services.accounting.findAccount(B.associationId, '4300');
    const dues = await services.accounting.findAccount(B.associationId, '1121');
    const post = (lines: any[], table: string, id: number) =>
      services.accounting.createAndPostJournalEntry(B.associationId, B.userId, { entryDate: new Date().toISOString(), description: 'old', reference: 'old', lines }, table, id);
    await post([{ accountId: bank.id, debitAmount: 20000, creditAmount: 0 }, { accountId: income.id, debitAmount: 0, creditAmount: 20000 }], 'Transaction', t.id);
    await post([{ accountId: bank.id, debitAmount: 20000, creditAmount: 0 }, { accountId: dues.id, debitAmount: 0, creditAmount: 20000 }], 'Payment', p.id);
    // a waiver credit that did not come from a charge must survive
    await services.ledger.createEntry({ associationId: B.associationId, memberId: m2, entryType: 'CREDIT', category: 'WAIVER', amount: 1500, effectiveDate: new Date(), description: 'waiver', sourceTable: 'penalty_waiver', sourceId: 1, createdBy: B.userId });
    expect(await services.ledger.getMemberBalance(B.associationId, m1)).toBe(-20000);

    await services.repair.repairAllAssociations({ onlyAssociationId: B.associationId });

    expect(await services.ledger.getMemberBalance(B.associationId, m1)).toBe(0);
    expect(await services.ledger.getMemberBalance(B.associationId, m2)).toBe(-1500); // the waiver is still there
    const lines = await prisma.journalEntryLine.findMany({ where: { journalEntry: { associationId: B.associationId } }, include: { account: true } });
    const net = (code: string) => lines.filter((l: any) => l.account.code === code).reduce((s: number, l: any) => s + num(l.debitAmount) - num(l.creditAmount), 0);
    expect(net('1112')).toBe(20000); // the cash once, not twice
    expect(net('1121')).toBe(0); // dues receivable no longer negative
    expect(-net('4300')).toBe(20000);

    const entriesBefore = await prisma.journalEntry.count({ where: { associationId: B.associationId } });
    const ledgerBefore = await prisma.memberFinancialLedger.count({ where: { associationId: B.associationId } });
    const [again] = await services.repair.repairAllAssociations({ onlyAssociationId: B.associationId });
    expect(again.books.correctionsPosted + again.books.orphansReversed + again.ledger.created + again.ledger.removed).toBe(0);
    expect(await prisma.journalEntry.count({ where: { associationId: B.associationId } })).toBe(entriesBefore);
    expect(await prisma.memberFinancialLedger.count({ where: { associationId: B.associationId } })).toBe(ledgerBefore);
  });

  it("a second association's first donation works (receipt numbers used to collide across associations), and parallel ones both succeed", async () => {
    const C = await newAssociation('c');
    const record = () => services.donations.recordDonation(C.associationId, C.userId, { memberId: C.members[0], categoryId: C.donation, amount: 1000, paymentMethod: 'cash', donationType: 'instant' });
    const both = await Promise.all([record(), record()]);
    const receipts = both.map((r: any) => r.donationRecord.receiptNumber);
    expect(new Set(receipts).size).toBe(2);
    expect(receipts.every((r: string) => r.includes(`-${C.associationId}-`))).toBe(true);
  });

  it('twelve ledger writes at the same moment add up exactly', async () => {
    const m = A.members[7];
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        services.ledger.createEntry({ associationId: A.associationId, memberId: m, entryType: i % 2 ? 'DEBIT' : 'CREDIT', category: 'OTHER', amount: 100, effectiveDate: new Date(), description: `p${i}`, sourceTable: 'test', sourceId: i, createdBy: A.userId }),
      ),
    );
    expect(await balanceOf(m)).toBe(0);
  });
});
