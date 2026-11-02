import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { contributionCell, type ContributionCell } from './cooperative-rules';

/**
 * Read models for a member's cooperative pages: the dashboard, the transaction history, the cashbook, and the list of their own payment
 * requests. Everything is computed from the same records the officers work with (savings and loan transactions, approved payment lines), so
 * these pages can never disagree with the books. Nothing here writes.
 */

const ZERO = new Decimal(0);
const LIVE_LOAN_STATUSES = ['ACTIVE', 'OVERDUE', 'DEFAULTED'] as const;
const CREDIT_TYPES = ['DEPOSIT', 'INTEREST', 'TRANSFER_IN'];

type AccountClass = 'CONTRIBUTION' | 'SHARES' | 'SPECIAL';
const classOf = (account: { accountTypeRef?: { accountClass: AccountClass } | null }): AccountClass => account.accountTypeRef?.accountClass ?? 'CONTRIBUTION';

const emptyMonths = () => Array.from({ length: 12 }, () => new Decimal(0));
const monthIndex = (date: Date) => date.getUTCMonth();

/** Midnight of the first day, and the very end of the last day, so a "to" date includes that whole day. */
function dayRange(from?: Date, to?: Date) {
  const start = from ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) : undefined;
  const end = to ? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999)) : undefined;
  return { start, end };
}
const within = (date: Date, start?: Date, end?: Date) => (!start || date >= start) && (!end || date <= end);

async function memberAccounts(associationId: number, memberId: number) {
  return prisma.savingsAccount.findMany({
    where: { associationId, memberId },
    include: { accountTypeRef: true },
    orderBy: { openedAt: 'asc' },
  });
}

export const cooperativeMemberService = {
  // ============================================================
  // Dashboard
  // ============================================================
  async dashboard(associationId: number, memberId: number, year: number, now: Date = new Date()) {
    const [accounts, activeTypes, loans, categories, who] = await Promise.all([
      memberAccounts(associationId, memberId),
      prisma.cooperativeAccountType.findMany({ where: { associationId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.loan.findMany({
        where: { associationId, memberId },
        include: { loanProduct: { include: { category: true } }, repayments: { orderBy: { paidAt: 'desc' }, take: 1 } },
      }),
      prisma.loanCategory.findMany({ where: { associationId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.member.findFirst({ where: { id: memberId, associationId }, select: { firstName: true, lastName: true } }),
    ]);

    const accountIds = accounts.map((a) => a.id);
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [lastTx, yearTx, lines, repaymentsInYear] = await Promise.all([
      prisma.savingsTransaction.findMany({
        where: { savingsAccountId: { in: accountIds } },
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        select: { savingsAccountId: true, type: true, amount: true, transactionDate: true },
      }),
      prisma.savingsTransaction.findMany({
        where: { savingsAccountId: { in: accountIds }, type: 'DEPOSIT', transactionDate: { gte: yearStart, lt: yearEnd } },
        select: { id: true, savingsAccountId: true, amount: true, transactionDate: true },
      }),
      prisma.cooperativePaymentLine.findMany({
        where: { request: { associationId, memberId, status: 'APPROVED' }, periodYear: year },
        select: { accountTypeId: true, amount: true, periodMonth: true, savingsTransactionId: true },
      }),
      prisma.loanRepayment.findMany({
        where: { associationId, loan: { memberId }, paidAt: { gte: yearStart, lt: yearEnd } },
        select: { amount: true, paidAt: true },
      }),
    ]);

    const byAccount = new Map(accounts.map((a) => [a.id, a]));

    // ---- Savings tiles: one per account type the association offers (plus any retired type the member still holds money in) ----
    const typeIdsHeld = new Set(accounts.filter((a) => a.balance.gt(0) || a.accountTypeId).map((a) => a.accountTypeId).filter((id): id is number => !!id));
    const shownTypes = activeTypes.concat(
      (await prisma.cooperativeAccountType.findMany({ where: { associationId, isActive: false, id: { in: [...typeIdsHeld] } } })).filter(
        (t) => accounts.some((a) => a.accountTypeId === t.id && a.balance.gt(0)),
      ),
    );
    const savingsTiles = shownTypes.map((type) => {
      const mine = accounts.filter((a) => a.accountTypeId === type.id);
      const ids = new Set(mine.map((a) => a.id));
      const last = lastTx.find((t) => ids.has(t.savingsAccountId));
      return {
        accountTypeId: type.id,
        name: type.name,
        description: type.description,
        accountClass: type.accountClass,
        balance: mine.reduce((sum, a) => sum.plus(a.balance), ZERO),
        lastEntry: last ? { amount: last.amount, type: last.type, date: last.transactionDate } : null,
      };
    });

    // ---- Loan tiles: one per loan category ----
    const liveLoans = loans.filter((l) => (LIVE_LOAN_STATUSES as readonly string[]).includes(l.status));
    const loanTiles = categories.map((category) => {
      const mine = loans.filter((l) => l.loanProduct.loanCategoryId === category.id);
      const live = mine.filter((l) => (LIVE_LOAN_STATUSES as readonly string[]).includes(l.status));
      const lastRepayment = mine.flatMap((l) => l.repayments).sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0];
      return {
        loanCategoryId: category.id,
        name: category.name,
        description: category.description,
        isGoods: category.isGoods,
        outstanding: live.reduce((sum, l) => sum.plus(l.outstandingBalance), ZERO),
        totalCollected: mine.reduce((sum, l) => sum.plus(l.amountDisbursed), ZERO),
        activeLoans: live.length,
        lastEntry: lastRepayment ? { amount: lastRepayment.amount, type: 'REPAYMENT', date: lastRepayment.paidAt } : null,
      };
    });

    // ---- The contribution table: what was paid FOR each month, against what was expected of the member ----
    const linkedTxIds = new Set(lines.map((l) => l.savingsTransactionId).filter((id): id is number => !!id));
    const paid = new Map<string, Decimal>(); // `${typeId}-${month}` -> amount
    const addPaid = (typeId: number | null, month: number, amount: Decimal) => {
      if (!typeId) return;
      const key = `${typeId}-${month}`;
      paid.set(key, (paid.get(key) ?? ZERO).plus(amount));
    };
    for (const line of lines) addPaid(line.accountTypeId, line.periodMonth, line.amount);
    // A deposit an officer recorded directly has no "for month", so it counts in the month it was made.
    for (const tx of yearTx) {
      if (linkedTxIds.has(tx.id)) continue;
      addPaid(byAccount.get(tx.savingsAccountId)?.accountTypeId ?? null, monthIndex(tx.transactionDate) + 1, tx.amount);
    }

    const current = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const tableRows = shownTypes
      .map((type) => {
        const mine = accounts.filter((a) => a.accountTypeId === type.id);
        const expected = mine.reduce<Decimal | null>((sum, a) => {
          const each = a.monthlyContribution ?? type.defaultMonthlyAmount;
          return each ? (sum ?? ZERO).plus(each) : sum;
        }, null);
        const firstOpened = mine.reduce<Date | null>((min, a) => (!min || a.openedAt < min ? a.openedAt : min), null);
        const months = Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const monthEnd = new Date(Date.UTC(year, month, 1));
          const amount = paid.get(`${type.id}-${month}`) ?? ZERO;
          const status: ContributionCell = contributionCell({
            expected,
            paid: amount,
            year,
            month,
            current,
            openedBefore: !!firstOpened && firstOpened < monthEnd,
          });
          return { month, paid: amount, status };
        });
        return { accountTypeId: type.id, name: type.name, accountClass: type.accountClass, expected, months };
      })
      .filter((row) => row.expected || row.months.some((m) => m.paid.gt(0)));
    const totalRow = Array.from({ length: 12 }, (_, i) => {
      const monthPaid = tableRows.reduce((sum, row) => sum.plus(row.months[i]?.paid ?? ZERO), ZERO);
      const statuses = tableRows.map((row) => row.months[i]?.status);
      const status: ContributionCell = statuses.includes('DEFAULTED')
        ? 'DEFAULTED'
        : statuses.includes('PARTIAL')
          ? 'PARTIAL'
          : monthPaid.gt(0)
            ? 'PAID'
            : statuses.includes('DUE')
              ? 'DUE'
              : 'NONE';
      return { month: i + 1, paid: monthPaid, status };
    });

    // ---- Chart series, 12 months of the year ----
    const savingsByMonth: Record<AccountClass, Decimal[]> = { CONTRIBUTION: emptyMonths(), SHARES: emptyMonths(), SPECIAL: emptyMonths() };
    for (const tx of yearTx) {
      const account = byAccount.get(tx.savingsAccountId);
      if (!account) continue;
      const series = savingsByMonth[classOf(account)];
      const i = monthIndex(tx.transactionDate);
      series[i] = (series[i] ?? ZERO).plus(tx.amount);
    }
    const disbursed = emptyMonths();
    for (const loan of loans) {
      if (loan.disbursedAt >= yearStart && loan.disbursedAt < yearEnd) {
        const i = monthIndex(loan.disbursedAt);
        disbursed[i] = (disbursed[i] ?? ZERO).plus(loan.amountDisbursed);
      }
    }
    const repaid = emptyMonths();
    for (const r of repaymentsInYear) {
      const i = monthIndex(r.paidAt);
      repaid[i] = (repaid[i] ?? ZERO).plus(r.amount);
    }

    return {
      year,
      memberName: who ? `${who.firstName} ${who.lastName}`.trim() : '',
      monthlyContribution: accounts
        .filter((a) => a.status === 'ACTIVE' && classOf(a) === 'CONTRIBUTION')
        .reduce((sum, a) => sum.plus(a.monthlyContribution ?? a.accountTypeRef?.defaultMonthlyAmount ?? ZERO), ZERO),
      savingsTiles,
      loanTiles,
      outstandingLoans: liveLoans.reduce((sum, l) => sum.plus(l.outstandingBalance), ZERO),
      contributionTable: { year, rows: tableRows, total: totalRow },
      charts: { savingsByMonth, loansByMonth: { disbursed, repaid } },
    };
  },

  // ============================================================
  // Transaction history (Overview, Loans, Contributions, Shares)
  // ============================================================
  async transactions(associationId: number, memberId: number, range: { from?: Date; to?: Date } = {}) {
    const { start, end } = dayRange(range.from, range.to);
    const [accounts, loans, member] = await Promise.all([
      memberAccounts(associationId, memberId),
      prisma.loan.findMany({
        where: { associationId, memberId },
        include: { loanProduct: { include: { category: true } } },
        orderBy: { disbursedAt: 'asc' },
      }),
      prisma.member.findFirst({ where: { id: memberId, associationId }, select: { firstName: true, lastName: true } }),
    ]);
    const byAccount = new Map(accounts.map((a) => [a.id, a]));
    const deposits = await prisma.savingsTransaction.findMany({
      where: { savingsAccountId: { in: accounts.map((a) => a.id) }, type: 'DEPOSIT' },
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
    });

    const memberName = member ? `${member.firstName} ${member.lastName}`.trim() : '';
    const rows = deposits.map((tx) => {
      const account = byAccount.get(tx.savingsAccountId);
      return {
        id: tx.id,
        date: tx.transactionDate,
        typeName: account?.accountTypeRef?.name ?? 'Savings',
        accountClass: account ? classOf(account) : ('CONTRIBUTION' as AccountClass),
        memberName,
        amount: tx.amount,
      };
    });

    const sum = (list: { amount: Decimal }[]) => list.reduce((total, r) => total.plus(r.amount), ZERO);
    const contributionsAll = rows.filter((r) => r.accountClass !== 'SHARES');
    const sharesAll = rows.filter((r) => r.accountClass === 'SHARES');
    const repayments = await prisma.loanRepayment.aggregate({ where: { associationId, loan: { memberId } }, _sum: { amount: true } });
    const disbursedAll = loans.reduce((total, l) => total.plus(l.amountDisbursed), ZERO);
    const outstandingAll = loans
      .filter((l) => (LIVE_LOAN_STATUSES as readonly string[]).includes(l.status))
      .reduce((total, l) => total.plus(l.outstandingBalance), ZERO);

    const loansInRange = loans.filter((l) => within(l.disbursedAt, start, end));
    const contributions = contributionsAll.filter((r) => within(r.date, start, end));
    const shares = sharesAll.filter((r) => within(r.date, start, end));

    return {
      // "All-time cumulative": the totals ignore the date range.
      overview: {
        contributions: sum(contributionsAll),
        shares: sum(sharesAll),
        loansDisbursed: disbursedAll,
        outstandingLoans: outstandingAll,
        loanRepayments: repayments._sum.amount ?? ZERO,
      },
      loans: {
        totalLoans: loansInRange.reduce((total, l) => total.plus(l.amountDisbursed), ZERO),
        totalRepaid: loansInRange.reduce((total, l) => total.plus(l.totalPaid), ZERO),
        outstandingBalance: loansInRange
          .filter((l) => (LIVE_LOAN_STATUSES as readonly string[]).includes(l.status))
          .reduce((total, l) => total.plus(l.outstandingBalance), ZERO),
        rows: loansInRange.map((l) => ({
          id: l.id,
          date: l.disbursedAt,
          category: l.loanProduct.category?.name ?? 'Loan',
          title: l.loanProduct.name,
          amount: l.amountDisbursed,
          repaid: l.totalPaid,
          balance: l.outstandingBalance,
        })),
      },
      contributions: { total: sum(contributions), rows: contributions },
      shares: { total: sum(shares), rows: shares },
      period: { from: range.from ?? null, to: range.to ?? null },
    };
  },

  // ============================================================
  // Cashbook: Shares | Savings (DR/CR/balance) | Loans (DR/CR/balance) | Interest (DR/CR/balance)
  // ============================================================
  async cashbook(associationId: number, memberId: number, range: { from?: Date; to?: Date } = {}) {
    const { start, end } = dayRange(range.from, range.to);
    const [accounts, loans, member] = await Promise.all([
      memberAccounts(associationId, memberId),
      prisma.loan.findMany({
        where: { associationId, memberId },
        include: { loanProduct: { select: { name: true } }, repayments: true },
      }),
      prisma.member.findFirst({ where: { id: memberId, associationId }, select: { firstName: true, lastName: true, memberId: true } }),
    ]);
    const byAccount = new Map(accounts.map((a) => [a.id, a]));
    const transactions = await prisma.savingsTransaction.findMany({
      where: { savingsAccountId: { in: accounts.map((a) => a.id) } },
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
    });

    // One chronological list of everything that moved, then running balances over ALL of it so a date range starts from the true opening
    // balance instead of zero.
    type Event = {
      at: Date;
      order: number;
      narration: string;
      shares?: Decimal;
      savings?: { desc: string; dr?: Decimal; cr?: Decimal };
      loans?: { desc: string; dr?: Decimal; cr?: Decimal };
      interest?: { dr?: Decimal; cr?: Decimal };
    };
    const events: Event[] = [];

    for (const tx of transactions) {
      const account = byAccount.get(tx.savingsAccountId);
      const typeName = account?.accountTypeRef?.name ?? 'Savings';
      const isCredit = CREDIT_TYPES.includes(tx.type);
      if (account && classOf(account) === 'SHARES') {
        // Share capital only ever goes up in the cashbook; it can't be withdrawn.
        events.push({ at: tx.transactionDate, order: tx.id, narration: typeName, shares: isCredit ? tx.amount : tx.amount.negated() });
      } else {
        events.push({
          at: tx.transactionDate,
          order: tx.id,
          narration: typeName,
          savings: { desc: typeName, ...(isCredit ? { cr: tx.amount } : { dr: tx.amount }) },
        });
      }
    }
    for (const loan of loans) {
      events.push({
        at: loan.disbursedAt,
        order: loan.id,
        narration: `${loan.loanProduct.name} disbursed`,
        loans: { desc: loan.loanProduct.name, dr: loan.principalAmount },
        // The interest the member will pay over the life of the loan is charged when it is paid out, then settled as they repay.
        interest: { dr: loan.totalInterest },
      });
      for (const repayment of loan.repayments) {
        events.push({
          at: repayment.paidAt,
          order: repayment.id,
          narration: `${loan.loanProduct.name} repayment`,
          loans: { desc: loan.loanProduct.name, cr: repayment.principalPortion },
          interest: { cr: repayment.interestPortion },
        });
      }
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);

    let savingsBalance = ZERO;
    let loansBalance = ZERO;
    let interestBalance = ZERO;
    let sharesBalance = ZERO;
    type Side = { desc: string; dr: Decimal | null; cr: Decimal | null; balance: Decimal };
    const rows: Array<{
      date: Date;
      narration: string;
      shares: Decimal | null;
      savings: Side | null;
      loans: Side | null;
      interest: { dr: Decimal | null; cr: Decimal | null; balance: Decimal } | null;
    }> = [];
    for (const event of events) {
      if (event.shares) sharesBalance = sharesBalance.plus(event.shares);
      if (event.savings) savingsBalance = savingsBalance.plus(event.savings.cr ?? ZERO).minus(event.savings.dr ?? ZERO);
      if (event.loans) loansBalance = loansBalance.plus(event.loans.dr ?? ZERO).minus(event.loans.cr ?? ZERO);
      if (event.interest) interestBalance = interestBalance.plus(event.interest.dr ?? ZERO).minus(event.interest.cr ?? ZERO);
      if (!within(event.at, start, end)) continue;
      rows.push({
        date: event.at,
        narration: event.narration,
        shares: event.shares ?? null,
        savings: event.savings ? { desc: event.savings.desc, dr: event.savings.dr ?? null, cr: event.savings.cr ?? null, balance: savingsBalance } : null,
        loans: event.loans ? { desc: event.loans.desc, dr: event.loans.dr ?? null, cr: event.loans.cr ?? null, balance: loansBalance } : null,
        interest: event.interest ? { dr: event.interest.dr ?? null, cr: event.interest.cr ?? null, balance: interestBalance } : null,
      });
    }

    const total = (pick: (r: (typeof rows)[number]) => Decimal | null | undefined) => rows.reduce((sum, r) => sum.plus(pick(r) ?? ZERO), ZERO);
    return {
      member: member ? { name: `${member.firstName} ${member.lastName}`.trim(), memberNumber: member.memberId } : null,
      period: { from: range.from ?? events[0]?.at ?? null, to: range.to ?? null },
      tiles: {
        totalShares: sharesBalance,
        totalSavings: savingsBalance,
        totalLoans: loansBalance,
        totalLoanInterest: interestBalance,
      },
      rows,
      totals: {
        shares: total((r) => r.shares),
        savingsDr: total((r) => r.savings?.dr),
        savingsCr: total((r) => r.savings?.cr),
        loansDr: total((r) => r.loans?.dr),
        loansCr: total((r) => r.loans?.cr),
        interestDr: total((r) => r.interest?.dr),
        interestCr: total((r) => r.interest?.cr),
      },
    };
  },

  // ============================================================
  // My pending payments: the member's own payment and loan-repayment requests
  // ============================================================
  async pendingPayments(
    associationId: number,
    memberId: number,
    options: { from?: Date; to?: Date; type?: 'SAVINGS' | 'LOAN_REPAYMENT'; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; newestFirst?: boolean } = {},
  ) {
    const { start, end } = dayRange(options.from, options.to);
    const createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    const where = { associationId, memberId, ...(options.status ? { status: options.status } : {}), ...(start || end ? { createdAt } : {}) };

    const [savings, repayments] = await Promise.all([
      options.type === 'LOAN_REPAYMENT'
        ? []
        : prisma.cooperativePaymentRequest.findMany({ where, include: { lines: { include: { accountType: { select: { name: true } } } } } }),
      options.type === 'SAVINGS' ? [] : prisma.loanRepaymentRequest.findMany({ where, include: { loan: { select: { loanNumber: true } } } }),
    ]);

    const items = [
      ...savings.map((r) => ({
        kind: 'SAVINGS' as const,
        id: r.id,
        date: r.createdAt,
        paymentType: r.lines.length === 1 ? (r.lines[0]?.accountType.name ?? 'Savings') : `Savings (${r.lines.length} items)`,
        detail: r.lines.map((l) => l.accountType.name).join(', '),
        amount: r.totalAmount,
        reference: r.reference,
        status: r.status,
        rejectionReason: r.rejectionReason,
        hasReceipt: !!r.filepath,
      })),
      ...repayments.map((r) => ({
        kind: 'LOAN_REPAYMENT' as const,
        id: r.id,
        date: r.createdAt,
        paymentType: 'Loan repayment',
        detail: r.loan.loanNumber,
        amount: r.amount,
        reference: r.reference,
        status: r.status,
        rejectionReason: r.rejectionReason,
        hasReceipt: !!r.filepath,
      })),
    ].sort((a, b) => (options.newestFirst === false ? 1 : -1) * (a.date.getTime() - b.date.getTime()));

    return { items, count: items.length, pendingCount: items.filter((i) => i.status === 'PENDING').length };
  },

  // ============================================================
  // The cooperative's bank accounts, read-only, for a member to pay into
  // ============================================================
  async bankAccounts(associationId: number, search?: string) {
    const rows = await prisma.associationBankAccount.findMany({
      where: {
        associationId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { bankName: { contains: search, mode: 'insensitive' } },
                { accountName: { contains: search, mode: 'insensitive' } },
                { accountNumber: { contains: search } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { bankName: 'asc' }],
      select: { id: true, bankName: true, accountName: true, accountNumber: true, description: true, isDefault: true },
    });
    return rows;
  },
};
