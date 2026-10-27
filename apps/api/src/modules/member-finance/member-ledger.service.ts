import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerEntryType, LedgerCategory } from '@prisma/client';
import { chargeDescription, ledgerCategoryFor, paymentDescription, planLedgerReconciliation, runningBalances } from './ledger-reconcile-rules';

export interface LedgerEntryInput {
  associationId: number;
  memberId: number;
  entryType: LedgerEntryType;
  category: LedgerCategory;
  amount: number | Decimal;
  effectiveDate: Date;
  description: string;
  sourceTable: string;
  sourceId: number;
  referenceNumber?: string;
  createdBy: number;
}

export interface LedgerReportOptions {
  associationId: number;
  memberId: number;
  startDate?: Date;
  endDate?: Date;
  category?: LedgerCategory;
  page?: number;
  limit?: number;
}

export interface LedgerStatement {
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
  openingBalance: number;
  entries: Array<{
    id: number;
    date: Date;
    description: string;
    category: string;
    debit: number;
    credit: number;
    balance: number;
    reference: string | null;
  }>;
  totals: {
    totalDebits: number;
    totalCredits: number;
  };
  closingBalance: number;
}

export const memberLedgerService = {
  /**
   * Create a new ledger entry
   * Ledger entries are append-only for audit integrity
   */
  async createEntry(input: LedgerEntryInput) {
    const amount = new Decimal(input.amount);
    // DEBIT increases what the member owes; CREDIT decreases it (a negative balance is a credit in the member's favour).
    // ADJUSTMENT entries are informational and never move the balance.
    const balanceChange =
      input.entryType === 'CREDIT' ? amount.negated() : input.entryType === 'DEBIT' ? amount : new Decimal(0);

    // One writer per member at a time, and the balance is worked out from the entries (not read off "the last row"), so two payments
    // arriving together can never write a wrong running balance.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${input.associationId}::int4, ${input.memberId}::int4)`;
      const previousBalance = await currentBalance(tx, input.associationId, input.memberId);

      return tx.memberFinancialLedger.create({
        data: {
          associationId: input.associationId,
          memberId: input.memberId,
          entryType: input.entryType,
          category: input.category,
          amount: input.amount,
          runningBalance: previousBalance.plus(balanceChange),
          effectiveDate: input.effectiveDate,
          description: input.description,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          referenceNumber: input.referenceNumber,
          createdBy: input.createdBy,
        },
      });
    });
  },

  /**
   * Put a charge on the member's ledger as what they owe: dues, levies, penalties and donations alike.
   * A donation is a charge too. An instant donation is paid the moment it is recorded, so its debit and its payment's credit cancel out;
   * a pledge stays owed until it is paid. Safe to call twice: a charge already on the ledger is returned, not written again.
   */
  async createFromTransaction(transactionId: number, createdBy: number) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: true,
        member: true,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // A voided charge is no longer owed.
    if (transaction.isVoided) return null;

    const existing = await prisma.memberFinancialLedger.findFirst({
      where: { associationId: transaction.associationId, sourceTable: 'transaction', sourceId: transaction.id },
    });
    if (existing) return existing;

    return this.createEntry({
      associationId: transaction.associationId,
      memberId: transaction.memberId,
      entryType: 'DEBIT',
      category: ledgerCategoryFor(transaction.category.type) as LedgerCategory,
      amount: transaction.amount,
      effectiveDate: transaction.createdAt,
      description: chargeDescription(transaction.category.type, transaction.category.name, transaction.notes, Boolean(transaction.dueDate)),
      sourceTable: 'transaction',
      sourceId: transaction.id,
      referenceNumber: transaction.referenceNumber || undefined,
      createdBy,
    });
  },

  /**
   * Put a payment on the member's ledger: a credit that reduces what they owe for the charge it pays (dues, levy, penalty, donation or pledge).
   * Safe to call twice: a payment already on the ledger is returned, not written again.
   */
  async createFromPayment(paymentId: number, createdBy: number) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        transaction: {
          include: { category: true },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const existing = await prisma.memberFinancialLedger.findFirst({
      where: { associationId: payment.associationId, sourceTable: 'payment', sourceId: payment.id },
    });
    if (existing) return existing;

    return this.createEntry({
      associationId: payment.associationId,
      memberId: payment.transaction.memberId,
      entryType: 'CREDIT',
      category: ledgerCategoryFor(payment.transaction.category.type) as LedgerCategory,
      amount: payment.amountPaid,
      effectiveDate: payment.paymentDate,
      description: paymentDescription(payment.transaction.category.type, payment.transaction.category.name, Boolean(payment.transaction.dueDate)),
      sourceTable: 'payment',
      sourceId: payment.id,
      referenceNumber: payment.receiptNumber || undefined,
      createdBy,
    });
  },

  /**
   * Create ledger entry from penalty waiver
   */
  async createFromWaiver(waiverId: number, createdBy: number) {
    const waiver = await prisma.penaltyWaiver.findUnique({
      where: { id: waiverId },
      include: {
        transaction: {
          include: { member: true },
        },
      },
    });

    if (!waiver) {
      throw new Error('Waiver not found');
    }

    const description = `Penalty waiver: ${waiver.reason}`;

    // Waivers are credits (reducing what member owes)
    return this.createEntry({
      associationId: waiver.associationId,
      memberId: waiver.transaction.memberId,
      entryType: 'CREDIT',
      category: 'WAIVER',
      amount: waiver.waivedAmount,
      effectiveDate: waiver.waivedAt,
      description,
      sourceTable: 'penalty_waiver',
      sourceId: waiver.id,
      createdBy,
    });
  },

  /**
   * Create ledger entry from savings transaction
   */
  async createFromSavingsTransaction(savingsTransactionId: number, createdBy: number) {
    const savingsTxn = await prisma.savingsTransaction.findUnique({
      where: { id: savingsTransactionId },
      include: {
        savingsAccount: {
          include: { member: true },
        },
      },
    });

    if (!savingsTxn) {
      throw new Error('Savings transaction not found');
    }

    const isDeposit = ['DEPOSIT', 'INTEREST', 'TRANSFER_IN'].includes(savingsTxn.type);
    const category: LedgerCategory = isDeposit ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAWAL';
    const entryType: LedgerEntryType = isDeposit ? 'CREDIT' : 'DEBIT';

    const description = `Savings ${savingsTxn.type.toLowerCase().replace('_', ' ')}`;

    return this.createEntry({
      associationId: savingsTxn.associationId,
      memberId: savingsTxn.savingsAccount.memberId,
      entryType,
      category,
      amount: savingsTxn.amount,
      effectiveDate: savingsTxn.createdAt,
      description,
      sourceTable: 'savings_transaction',
      sourceId: savingsTxn.id,
      referenceNumber: savingsTxn.reference || undefined,
      createdBy,
    });
  },

  /**
   * Create ledger entry from loan disbursement
   */
  async createFromLoanDisbursement(loanId: number, createdBy: number) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { member: true },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    const description = `Loan disbursement - ${loan.loanNumber}`;

    // Loan disbursement is a credit (member receives money)
    return this.createEntry({
      associationId: loan.associationId,
      memberId: loan.memberId,
      entryType: 'CREDIT',
      category: 'LOAN_DISBURSEMENT',
      amount: loan.amountDisbursed,
      effectiveDate: loan.disbursedAt,
      description,
      sourceTable: 'loan',
      sourceId: loan.id,
      referenceNumber: loan.loanNumber,
      createdBy,
    });
  },

  /**
   * Create ledger entry from loan repayment
   */
  async createFromLoanRepayment(repaymentId: number, createdBy: number) {
    const repayment = await prisma.loanRepayment.findUnique({
      where: { id: repaymentId },
      include: {
        loan: {
          include: { member: true },
        },
      },
    });

    if (!repayment) {
      throw new Error('Loan repayment not found');
    }

    const description = `Loan repayment - ${repayment.loan.loanNumber}`;

    // Loan repayment is a debit (member pays back)
    return this.createEntry({
      associationId: repayment.associationId,
      memberId: repayment.loan.memberId,
      entryType: 'DEBIT',
      category: 'LOAN_REPAYMENT',
      amount: repayment.amount,
      effectiveDate: repayment.paidAt,
      description,
      sourceTable: 'loan_repayment',
      sourceId: repayment.id,
      referenceNumber: repayment.reference || undefined,
      createdBy,
    });
  },


  /**
   * Get member's current balance (computed)
   */
  async getMemberBalance(associationId: number, memberId: number, asOfDate?: Date) {
    return Number(await currentBalance(prisma, associationId, memberId, asOfDate));
  },

  /**
   * Get member's ledger entries with pagination
   */
  async getLedgerEntries(options: LedgerReportOptions) {
    const { associationId, memberId, startDate, endDate, category, page = 1, limit = 50 } = options;

    const whereClause: any = {
      associationId,
      memberId,
    };

    if (startDate || endDate) {
      whereClause.effectiveDate = {};
      if (startDate) whereClause.effectiveDate.gte = startDate;
      if (endDate) whereClause.effectiveDate.lte = endDate;
    }

    if (category) {
      whereClause.category = category;
    }

    const [entries, total] = await Promise.all([
      prisma.memberFinancialLedger.findMany({
        where: whereClause,
        orderBy: { effectiveDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.memberFinancialLedger.count({ where: whereClause }),
    ]);

    return {
      entries: entries.map(e => ({
        ...e,
        amount: Number(e.amount),
        runningBalance: Number(e.runningBalance),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Generate a complete member statement with opening/closing balance
   */
  async generateStatement(
    associationId: number,
    memberId: number,
    startDate: Date,
    endDate: Date
  ): Promise<LedgerStatement> {
    // Get member details
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
      select: {
        id: true,
        memberId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Get opening balance (balance before start date)
    const openingBalanceEntry = await prisma.memberFinancialLedger.findFirst({
      where: {
        associationId,
        memberId,
        effectiveDate: { lt: startDate },
      },
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });
    const openingBalance = Number(openingBalanceEntry?.runningBalance || 0);

    // Get all entries in the period
    const entries = await prisma.memberFinancialLedger.findMany({
      where: {
        associationId,
        memberId,
        effectiveDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { effectiveDate: 'asc' },
    });

    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;
    let runningBalance = openingBalance;

    const formattedEntries = entries.map(entry => {
      const amount = Number(entry.amount);
      let debit = 0;
      let credit = 0;

      if (entry.entryType === 'DEBIT') {
        debit = amount;
        totalDebits += amount;
        runningBalance += amount;
      } else if (entry.entryType === 'CREDIT') {
        credit = amount;
        totalCredits += amount;
        runningBalance -= amount;
      }

      return {
        id: entry.id,
        date: entry.effectiveDate,
        description: entry.description,
        category: entry.category,
        debit,
        credit,
        balance: runningBalance,
        reference: entry.referenceNumber,
      };
    });

    const closingBalance = openingBalance + totalDebits - totalCredits;

    return {
      member,
      period: { startDate, endDate },
      openingBalance,
      entries: formattedEntries,
      totals: { totalDebits, totalCredits },
      closingBalance,
    };
  },

  /**
   * Get ledger summary for a member
   */
  async getMemberLedgerSummary(associationId: number, memberId: number) {
    // Get current balance
    const currentBalance = await this.getMemberBalance(associationId, memberId);

    // Get totals by category
    const categoryTotals = await prisma.memberFinancialLedger.groupBy({
      by: ['category', 'entryType'],
      where: { associationId, memberId },
      _sum: { amount: true },
      _count: { _all: true },
    });

    // Get recent entries
    const recentEntries = await prisma.memberFinancialLedger.findMany({
      where: { associationId, memberId },
      orderBy: { effectiveDate: 'desc' },
      take: 10,
    });

    // Calculate summary
    let totalDebits = 0;
    let totalCredits = 0;
    let totalAdjustments = 0;
    let entryCount = 0;
    const byCategory: Record<string, { debits: number; credits: number }> = {};

    categoryTotals.forEach(item => {
      const amount = Number(item._sum.amount || 0);
      entryCount += item._count._all;
      if (item.entryType === 'ADJUSTMENT') totalAdjustments += amount;
      if (!byCategory[item.category]) {
        byCategory[item.category] = { debits: 0, credits: 0 };
      }
      if (item.entryType === 'DEBIT') {
        totalDebits += amount;
        byCategory[item.category].debits += amount;
      } else if (item.entryType === 'CREDIT') {
        totalCredits += amount;
        byCategory[item.category].credits += amount;
      }
    });

    // The web ledger page reads these (with a per-category net); `byCategory` stays for the mobile app.
    const categoryBreakdown = Object.fromEntries(
      Object.entries(byCategory).map(([category, totals]) => [category, { ...totals, net: totals.debits - totals.credits }])
    );

    return {
      currentBalance,
      totalDebits,
      totalCredits,
      totalAdjustments,
      entryCount,
      lastEntryDate: recentEntries[0]?.effectiveDate ?? null,
      byCategory,
      categoryBreakdown,
      recentEntries: recentEntries.map(e => ({
        ...e,
        amount: Number(e.amount),
        runningBalance: Number(e.runningBalance),
      })),
    };
  },

  /**
   * Clear all ledger entries for a member (for re-sync)
   */
  async clearMemberLedger(associationId: number, memberId: number) {
    const deleted = await prisma.memberFinancialLedger.deleteMany({
      where: { associationId, memberId },
    });
    return deleted.count;
  },

  /**
   * Clear all ledger entries for an association (for full re-sync)
   */
  async clearAssociationLedgers(associationId: number) {
    const deleted = await prisma.memberFinancialLedger.deleteMany({
      where: { associationId },
    });
    return deleted.count;
  },

  /**
   * Bring a member's ledger in line with their charges and payments (for migration, backfill, and after a delete or a move).
   * Only entries that come from charges and payments are touched: waivers, savings, loans, welfare and manual adjustments are kept.
   * With force=false it refuses to run over an existing ledger, as before; force=true reconciles it.
   */
  async syncExistingTransactions(associationId: number, memberId: number, createdBy: number, force: boolean = false) {
    const existingCount = await prisma.memberFinancialLedger.count({ where: { associationId, memberId } });
    if (existingCount > 0 && !force) {
      throw new Error('Member already has ledger entries. Use force=true to clear and re-sync.');
    }
    const result = await this.reconcileMemberLedger(associationId, memberId, createdBy);
    return { entriesCreated: result.created, finalBalance: result.balance };
  },

  /**
   * The repair: make the entries that come from this member's charges and payments match the charges and payments exactly.
   *  - adds the debit for every charge (including donations and pledges) and the credit for every payment that is missing,
   *  - removes entries whose charge or payment is gone, voided or moved to someone else, and removes duplicates,
   *  - corrects an amount that no longer matches,
   *  - then re-numbers the running balance in date order.
   * Idempotent: a ledger that is already right is left alone and nothing is written.
   */
  async reconcileMemberLedger(associationId: number, memberId: number, createdBy: number, options: { dryRun?: boolean } = {}) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${associationId}::int4, ${memberId}::int4)`;

        const [transactions, existing, voids] = await Promise.all([
          tx.transaction.findMany({
            where: { associationId, memberId },
            include: { category: { select: { type: true, name: true } }, payments: { select: { id: true, amountPaid: true, paymentDate: true, receiptNumber: true } } },
          }),
          tx.memberFinancialLedger.findMany({
            where: { associationId, memberId, sourceTable: { in: ['transaction', 'payment'] } },
            select: { id: true, sourceTable: true, sourceId: true, entryType: true, amount: true, category: true, description: true },
          }),
          tx.memberFinancialLedger.findMany({ where: { associationId, memberId, sourceTable: 'payment_void' }, select: { sourceId: true } }),
        ]);

        const plan = planLedgerReconciliation({
          transactions,
          existing,
          neutralisedPaymentIds: new Set(voids.map((v) => v.sourceId)),
        });

        const before = await currentBalance(tx, associationId, memberId);
        if (options.dryRun) {
          return { created: plan.toCreate.length, removed: plan.toRemoveIds.length, updated: plan.toUpdate.length, rebalanced: 0, balance: Number(before), balanceBefore: Number(before) };
        }

        if (plan.toRemoveIds.length) await tx.memberFinancialLedger.deleteMany({ where: { id: { in: plan.toRemoveIds } } });
        for (const change of plan.toUpdate) {
          await tx.memberFinancialLedger.update({ where: { id: change.id }, data: { ...(change.amount !== undefined ? { amount: change.amount } : {}), ...(change.description !== undefined ? { description: change.description } : {}) } });
        }
        if (plan.toCreate.length) {
          await tx.memberFinancialLedger.createMany({
            data: plan.toCreate.map((entry) => ({
              associationId,
              memberId,
              entryType: entry.entryType,
              category: entry.category as LedgerCategory,
              amount: entry.amount,
              runningBalance: 0,
              effectiveDate: entry.effectiveDate,
              description: entry.description,
              sourceTable: entry.sourceTable,
              sourceId: entry.sourceId,
              referenceNumber: entry.referenceNumber,
              createdBy,
            })),
          });
        }

        const rebalanced = await renumberRunningBalances(tx, associationId, memberId);
        const balance = await currentBalance(tx, associationId, memberId);
        return { created: plan.toCreate.length, removed: plan.toRemoveIds.length, updated: plan.toUpdate.length, rebalanced, balance: Number(balance), balanceBefore: Number(before) };
      },
      { timeout: 120000, maxWait: 30000 },
    );
  },

};

type LedgerDb = Pick<typeof prisma, 'memberFinancialLedger'>;

/** What the member owes now: everything charged less everything paid, worked out from the entries. Negative = credit in their favour. */
async function currentBalance(db: LedgerDb, associationId: number, memberId: number, asOfDate?: Date): Promise<Decimal> {
  const where: any = { associationId, memberId };
  if (asOfDate) where.effectiveDate = { lte: asOfDate };
  const [debits, credits] = await Promise.all([
    db.memberFinancialLedger.aggregate({ where: { ...where, entryType: 'DEBIT' }, _sum: { amount: true } }),
    db.memberFinancialLedger.aggregate({ where: { ...where, entryType: 'CREDIT' }, _sum: { amount: true } }),
  ]);
  return new Decimal(debits._sum.amount ?? 0).minus(credits._sum.amount ?? 0);
}

/**
 * Re-number the running balance down the member's entries in date order. Writes only the rows whose number is wrong,
 * so a ledger that is already right costs one read and no writes.
 */
async function renumberRunningBalances(tx: any, associationId: number, memberId: number): Promise<number> {
  const entries = await tx.memberFinancialLedger.findMany({
    where: { associationId, memberId },
    orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
    select: { id: true, entryType: true, amount: true, runningBalance: true },
  });
  const wanted = runningBalances(entries);
  let updated = 0;
  for (const entry of entries) {
    const want = wanted.get(entry.id) ?? 0;
    if (Math.abs(Number(entry.runningBalance) - want) < 0.005) continue;
    await tx.memberFinancialLedger.update({ where: { id: entry.id }, data: { runningBalance: want } });
    updated += 1;
  }
  return updated;
}
