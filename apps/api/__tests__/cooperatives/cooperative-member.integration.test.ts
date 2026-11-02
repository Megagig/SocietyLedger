/**
 * What a member sees on their cooperative pages, against a real (disposable) database: the dashboard tiles and contribution table, the
 * transaction history, the cashbook with its running balances, and their own payment requests. These are computed from the same records the
 * officers work with, so the numbers here have to match the books exactly.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/cooperatives/cooperative-member --forceExit
 */

export {};
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
}

jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(120000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const at = (iso: string) => new Date(iso);
const NOW = at('2026-06-15T10:00:00Z');

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Member cooperative pages (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let types: typeof import('../../src/modules/cooperatives/cooperative-types.service').cooperativeTypesService;
  let payments: typeof import('../../src/modules/cooperatives/cooperative-payments.service').cooperativePaymentsService;
  let member: typeof import('../../src/modules/cooperatives/cooperative-member.service').cooperativeMemberService;
  let counter = 0;

  const receipt = { filename: 'proof.png', filepath: 'cooperative-payments/test/proof.png' };

  /** A member with: Monthly savings (₦5,000 expected), Shares, paid in for Jan and Mar, a direct officer deposit in April, and a loan. */
  async function world() {
    const slug = `cm-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Member pages ${counter} ${run}`, slug, subdomain: slug } });
    const mkUser = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const officer = await mkUser('officer');
    const memberUser = await mkUser('member');
    const m = await prisma.member.create({
      data: { associationId: assoc.id, userId: memberUser.id, memberId: `CM${run}${++counter}`, firstName: 'Anthony', lastName: 'Obi', status: 'active' },
    });
    const savings = await types.createAccountType(assoc.id, { name: 'Monthly savings', defaultMonthlyAmount: 5000 });
    const shares = await types.createAccountType(assoc.id, { name: 'Shares', accountClass: 'SHARES' });
    await types.createLoanCategory(assoc.id, { name: 'Normal Loans' });
    return { A: assoc.id, officer, memberUser, m, savings, shares };
  }

  async function approveRequest(w: Awaited<ReturnType<typeof world>>, lines: Array<[number, number, number]>, paidOn: string) {
    const request = await payments.createRequest(
      w.A,
      w.m.id,
      {
        paymentDate: at(paidOn),
        lines: lines.map(([accountTypeId, amount, periodMonth]) => ({ accountTypeId, amount, periodMonth, periodYear: 2026 })),
      },
      receipt,
    );
    await payments.approve(w.A, request.id, w.officer.id);
    return request;
  }

  /** Pins the dates the database stamped with the real clock, so the tests read the same on any day. */
  async function pinDates(w: Awaited<ReturnType<typeof world>>, when: Record<number, string>) {
    for (const [id, iso] of Object.entries(when)) {
      await prisma.savingsTransaction.update({ where: { id: Number(id) }, data: { transactionDate: at(iso) } });
    }
    await prisma.savingsAccount.updateMany({ where: { associationId: w.A }, data: { openedAt: at('2026-01-01T00:00:00Z') } });
  }

  async function story() {
    const w = await world();
    await approveRequest(w, [[w.savings.id, 5000, 1]], '2026-03-02'); // January's savings, paid late
    await approveRequest(w, [[w.savings.id, 5000, 3], [w.shares.id, 2000, 3]], '2026-03-04');
    const txs = await prisma.savingsTransaction.findMany({ where: { associationId: w.A }, orderBy: { id: 'asc' } });
    const [janTx, marSavingsTx, marSharesTx] = txs;
    const account = await prisma.savingsAccount.findFirstOrThrow({ where: { associationId: w.A, accountTypeId: w.savings.id } });
    // A deposit an officer recorded directly in April: no "for month", so it counts in the month it was made.
    const direct = await prisma.savingsTransaction.create({
      data: { associationId: w.A, savingsAccountId: account.id, type: 'DEPOSIT', amount: 5000, balanceAfter: 15000, processedBy: w.officer.id, notes: 'Cash at meeting' },
    });
    await prisma.savingsAccount.update({ where: { id: account.id }, data: { balance: { increment: 5000 } } }); // real postings move the balance too
    await pinDates(w, {
      [janTx!.id]: '2026-03-02T10:00:00Z',
      [marSavingsTx!.id]: '2026-03-04T10:00:00Z',
      [marSharesTx!.id]: '2026-03-04T10:00:00Z',
      [direct.id]: '2026-04-10T10:00:00Z',
    });

    const category = await prisma.loanCategory.findFirstOrThrow({ where: { associationId: w.A } });
    const product = await prisma.loanProduct.create({
      data: { associationId: w.A, name: 'Emergency Loan', minAmount: 1000, maxAmount: 500000, interestRate: 10, minTenureMonths: 1, maxTenureMonths: 12, loanCategoryId: category.id },
    });
    const application = await prisma.loanApplication.create({
      data: {
        associationId: w.A, applicationNumber: `LA-${run}-${++counter}`, memberId: w.m.id, loanProductId: product.id, amount: 100000, tenureMonths: 10,
        interestRate: 10, interestType: 'FLAT', monthlyRepayment: 11000, totalRepayment: 110000, totalInterest: 10000, purpose: 'Stock for the shop', status: 'DISBURSED',
      },
    });
    const loan = await prisma.loan.create({
      data: {
        associationId: w.A, loanNumber: `LN-${run}-${++counter}`, applicationId: application.id, memberId: w.m.id, loanProductId: product.id, principalAmount: 100000,
        interestRate: 10, interestType: 'FLAT', tenureMonths: 10, monthlyRepayment: 11000, totalRepayment: 110000, totalInterest: 10000, amountDisbursed: 100000,
        totalPaid: 20000, principalPaid: 18000, interestPaid: 2000, outstandingBalance: 90000, disbursedAt: at('2026-05-01T09:00:00Z'), maturityDate: at('2027-03-01T00:00:00Z'),
      },
    });
    await prisma.loanRepayment.create({
      data: { associationId: w.A, loanId: loan.id, amount: 20000, principalPortion: 18000, interestPortion: 2000, paymentMethod: 'BANK_TRANSFER', processedBy: w.officer.id, paidAt: at('2026-05-10T09:00:00Z'), paymentDate: at('2026-05-10T09:00:00Z') },
    });
    return w;
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    types = require('../../src/modules/cooperatives/cooperative-types.service').cooperativeTypesService;
    payments = require('../../src/modules/cooperatives/cooperative-payments.service').cooperativePaymentsService;
    member = require('../../src/modules/cooperatives/cooperative-member.service').cooperativeMemberService;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('dashboard', () => {
    it('shows a tile per account type with its balance and the last entry, and a tile per loan category', async () => {
      const w = await story();
      const d = await member.dashboard(w.A, w.m.id, 2026, NOW);

      const savings = d.savingsTiles.find((t) => t.name === 'Monthly savings');
      expect(savings?.balance.toString()).toBe('15000'); // 5,000 (Jan) + 5,000 (Mar) + 5,000 cash in April
      expect(savings?.lastEntry?.amount.toString()).toBe('5000');
      expect(d.savingsTiles.find((t) => t.name === 'Shares')?.balance.toString()).toBe('2000');

      const normal = d.loanTiles.find((t) => t.name === 'Normal Loans');
      expect(normal?.outstanding.toString()).toBe('90000');
      expect(normal?.activeLoans).toBe(1);
      expect(d.outstandingLoans.toString()).toBe('90000');
      expect(d.monthlyContribution.toString()).toBe('5000');
    });

    it('fills the contribution table by the month each payment is FOR, and marks missed months only once they are over', async () => {
      const w = await story();
      const d = await member.dashboard(w.A, w.m.id, 2026, NOW);
      const row = d.contributionTable.rows.find((r) => r.name === 'Monthly savings');
      const status = (month: number) => row?.months[month - 1]?.status;

      expect(status(1)).toBe('PAID'); // paid in March, but for January
      expect(status(2)).toBe('DEFAULTED'); // nothing for February, and it is over
      expect(status(3)).toBe('PAID');
      expect(status(4)).toBe('PAID'); // the officer's direct deposit counts in April
      expect(status(5)).toBe('DEFAULTED');
      expect(status(6)).toBe('DUE'); // June is the current month: not a default yet
      expect(status(9)).toBe('DUE');
      expect(row?.months[0]?.paid.toString()).toBe('5000');
      // Share capital has no monthly amount expected, so it only shows what was paid.
      expect(d.contributionTable.rows.find((r) => r.name === 'Shares')?.months[2]?.paid.toString()).toBe('2000');
    });

    it('splits the year chart by account class and shows loans disbursed and repaid by month', async () => {
      const w = await story();
      const d = await member.dashboard(w.A, w.m.id, 2026, NOW);
      expect(d.charts.savingsByMonth.CONTRIBUTION[2]?.toString()).toBe('10000'); // March: two 5,000 deposits
      expect(d.charts.savingsByMonth.SHARES[2]?.toString()).toBe('2000');
      expect(d.charts.loansByMonth.disbursed[4]?.toString()).toBe('100000');
      expect(d.charts.loansByMonth.repaid[4]?.toString()).toBe('20000');
    });

    it("never shows another member's money, and has nothing for a member with no records", async () => {
      const w = await story();
      const stranger = await prisma.member.create({
        data: { associationId: w.A, memberId: `ST${run}${++counter}`, firstName: 'Ada', lastName: 'Eze', status: 'active' },
      });
      const d = await member.dashboard(w.A, stranger.id, 2026, NOW);
      expect(d.savingsTiles.every((t) => t.balance.isZero())).toBe(true);
      expect(d.outstandingLoans.isZero()).toBe(true);
      expect(d.contributionTable.rows).toHaveLength(0);
    });
  });

  describe('transaction history', () => {
    it('totals everything all-time on the overview, ignoring the date range', async () => {
      const w = await story();
      const t = await member.transactions(w.A, w.m.id, { from: at('2026-04-01'), to: at('2026-04-30') });
      expect(t.overview.contributions.toString()).toBe('15000');
      expect(t.overview.shares.toString()).toBe('2000');
      expect(t.overview.loansDisbursed.toString()).toBe('100000');
      expect(t.overview.outstandingLoans.toString()).toBe('90000');
      expect(t.overview.loanRepayments.toString()).toBe('20000');
    });

    it('limits the contributions, shares and loans tabs to the chosen dates, including the whole last day', async () => {
      const w = await story();
      const april = await member.transactions(w.A, w.m.id, { from: at('2026-04-01'), to: at('2026-04-10') });
      expect(april.contributions.rows).toHaveLength(1);
      expect(april.contributions.total.toString()).toBe('5000'); // the 10th at 10:00 is inside "to 2026-04-10"
      expect(april.shares.rows).toHaveLength(0);
      expect(april.loans.rows).toHaveLength(0);

      const may = await member.transactions(w.A, w.m.id, { from: at('2026-05-01'), to: at('2026-05-31') });
      expect(may.loans.rows).toHaveLength(1);
      expect(may.loans.rows[0]).toMatchObject({ category: 'Normal Loans', title: 'Emergency Loan' });
      expect(may.loans.totalLoans.toString()).toBe('100000');
      expect(may.loans.totalRepaid.toString()).toBe('20000');
      expect(may.loans.outstandingBalance.toString()).toBe('90000');
    });
  });

  describe('cashbook', () => {
    it('puts shares, savings, loans and interest in their own columns with running balances', async () => {
      const w = await story();
      const book = await member.cashbook(w.A, w.m.id, {});

      expect(book.tiles.totalShares.toString()).toBe('2000');
      expect(book.tiles.totalSavings.toString()).toBe('15000');
      expect(book.tiles.totalLoans.toString()).toBe('82000'); // 100,000 lent, 18,000 of principal repaid
      expect(book.tiles.totalLoanInterest.toString()).toBe('8000'); // 10,000 charged, 2,000 paid

      const loanRow = book.rows.find((r) => r.narration === 'Emergency Loan disbursed');
      expect(loanRow?.loans).toMatchObject({ desc: 'Emergency Loan' });
      expect(loanRow?.loans?.dr?.toString()).toBe('100000');
      expect(loanRow?.interest?.dr?.toString()).toBe('10000');

      const repayment = book.rows.find((r) => r.narration === 'Emergency Loan repayment');
      expect(repayment?.loans?.cr?.toString()).toBe('18000');
      expect(repayment?.loans?.balance.toString()).toBe('82000');
      expect(repayment?.interest?.cr?.toString()).toBe('2000');
      expect(repayment?.interest?.balance.toString()).toBe('8000');

      expect(book.totals.shares.toString()).toBe('2000');
      expect(book.totals.savingsCr.toString()).toBe('15000');
      expect(book.totals.loansDr.toString()).toBe('100000');
    });

    it('starts a date range from the true opening balance, not from zero', async () => {
      const w = await story();
      const book = await member.cashbook(w.A, w.m.id, { from: at('2026-04-01'), to: at('2026-04-30') });
      expect(book.rows).toHaveLength(1);
      // January and March were paid before April, so April's deposit lands on 15,000, not on 5,000.
      expect(book.rows[0]?.savings?.cr?.toString()).toBe('5000');
      expect(book.rows[0]?.savings?.balance.toString()).toBe('15000');
    });

    it('is empty, with zero tiles, for a member with no activity', async () => {
      const w = await story();
      const stranger = await prisma.member.create({ data: { associationId: w.A, memberId: `ST${run}${++counter}`, firstName: 'Ada', lastName: 'Eze', status: 'active' } });
      const book = await member.cashbook(w.A, stranger.id, {});
      expect(book.rows).toHaveLength(0);
      expect(book.tiles.totalSavings.isZero()).toBe(true);
    });
  });

  describe('my pending payments', () => {
    it("lists the member's own payment and repayment requests, newest first, and filters them", async () => {
      const w = await story();
      await payments.createRequest(
        w.A,
        w.m.id,
        { paymentDate: at('2026-06-01'), lines: [{ accountTypeId: w.savings.id, amount: 5000, periodMonth: 6, periodYear: 2026 }, { accountTypeId: w.shares.id, amount: 1000, periodMonth: 6, periodYear: 2026 }] },
        receipt,
      );
      const loan = await prisma.loan.findFirstOrThrow({ where: { associationId: w.A } });
      await prisma.loanRepaymentRequest.create({
        data: { associationId: w.A, loanId: loan.id, memberId: w.m.id, amount: 11000, paymentDate: at('2026-06-02'), filename: 'r.png', filepath: 'x/r.png' },
      });

      const all = await member.pendingPayments(w.A, w.m.id, {});
      expect(all.count).toBe(4); // two approved savings requests + one waiting savings request + one waiting repayment
      expect(all.pendingCount).toBe(2);

      const waiting = await member.pendingPayments(w.A, w.m.id, { status: 'PENDING' });
      expect(waiting.items.map((i) => i.kind).sort()).toEqual(['LOAN_REPAYMENT', 'SAVINGS']);
      const multi = waiting.items.find((i) => i.kind === 'SAVINGS');
      expect(multi?.paymentType).toBe('Savings (2 items)');
      expect(multi?.amount.toString()).toBe('6000');

      const onlyRepayments = await member.pendingPayments(w.A, w.m.id, { type: 'LOAN_REPAYMENT' });
      expect(onlyRepayments.items.every((i) => i.kind === 'LOAN_REPAYMENT')).toBe(true);
    });

    it("doesn't show another member's requests", async () => {
      const w = await story();
      const other = await prisma.member.create({ data: { associationId: w.A, memberId: `OT${run}${++counter}`, firstName: 'Ada', lastName: 'Eze', status: 'active' } });
      expect((await member.pendingPayments(w.A, other.id, {})).count).toBe(0);
    });
  });

  describe('cooperative bank accounts', () => {
    it('lists only the active accounts, and never anything but what a member needs to pay in', async () => {
      const w = await world();
      await prisma.associationBankAccount.create({ data: { associationId: w.A, bankName: 'GTBank', accountName: 'Umuoji Cooperative', accountNumber: `01${run}1`.slice(0, 10), description: 'Savings collection' } });
      await prisma.associationBankAccount.create({ data: { associationId: w.A, bankName: 'Zenith', accountName: 'Old', accountNumber: `02${run}2`.slice(0, 10), isActive: false } });

      const list = await member.bankAccounts(w.A);
      expect(list).toHaveLength(1);
      expect(Object.keys(list[0] as object).sort()).toEqual(['accountName', 'accountNumber', 'bankName', 'description', 'id', 'isDefault']);
      expect(await member.bankAccounts(w.A, 'gtbank')).toHaveLength(1);
      expect(await member.bankAccounts(w.A, 'zenith')).toHaveLength(0);
    });
  });
});
