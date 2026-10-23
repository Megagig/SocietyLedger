import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerEntryType, LedgerCategory } from '@prisma/client';

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
    // Calculate running balance
    const lastEntry = await prisma.memberFinancialLedger.findFirst({
      where: {
        associationId: input.associationId,
        memberId: input.memberId,
      },
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });

    const previousBalance = lastEntry?.runningBalance || new Decimal(0);
    const amount = new Decimal(input.amount);
    
    // DEBIT increases what member owes (negative for member)
    // CREDIT decreases what member owes (positive for member)
    const balanceChange = input.entryType === 'CREDIT' 
      ? amount.negated() // Credit reduces outstanding
      : input.entryType === 'DEBIT' 
        ? amount // Debit increases outstanding
        : new Decimal(0); // Adjustment handled separately
    
    const newBalance = previousBalance.plus(balanceChange);

    return prisma.memberFinancialLedger.create({
      data: {
        associationId: input.associationId,
        memberId: input.memberId,
        entryType: input.entryType,
        category: input.category,
        amount: input.amount,
        runningBalance: newBalance,
        effectiveDate: input.effectiveDate,
        description: input.description,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        referenceNumber: input.referenceNumber,
        createdBy: input.createdBy,
      },
    });
  },

  /**
   * Create ledger entry from a transaction (dues, levies, penalties)
   * Note: Donations do NOT create a transaction entry - only the payment creates a credit
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

    // Donations should NOT create a ledger entry from the transaction
    // Only the payment should create a CREDIT entry for donations
    if (transaction.category.type === 'donation') {
      return null; // No ledger entry for donation transactions - wait for payment
    }

    // Map transaction category type to ledger category
    const categoryMap: Record<string, LedgerCategory> = {
      'due': 'DUES',
      'levy': 'LEVY',
      'penalty': 'PENALTY',
    };

    const ledgerCategory = categoryMap[transaction.category.type] || 'OTHER';
    
    // Dues, levies, penalties are debits (member owes money)
    const entryType: LedgerEntryType = 'DEBIT';

    const description = `${transaction.category.name}${transaction.notes ? ` - ${transaction.notes}` : ''}`;

    return this.createEntry({
      associationId: transaction.associationId,
      memberId: transaction.memberId,
      entryType,
      category: ledgerCategory,
      amount: transaction.amount,
      effectiveDate: transaction.createdAt,
      description,
      sourceTable: 'transaction',
      sourceId: transaction.id,
      referenceNumber: transaction.referenceNumber || undefined,
      createdBy,
    });
  },

  /**
   * Create ledger entry from a payment
   * For donations: This is the actual donation being made (CREDIT)
   * For dues/levies/penalties: This offsets the original DEBIT (CREDIT)
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

    // Map transaction category type to ledger category
    const categoryMap: Record<string, LedgerCategory> = {
      'due': 'DUES',
      'levy': 'LEVY',
      'penalty': 'PENALTY',
      'donation': 'DONATION',
    };

    const isDonation = payment.transaction.category.type === 'donation';
    const ledgerCategory = categoryMap[payment.transaction.category.type] || 'OTHER';
    
    // For donations, the payment IS the donation, not a payment "for" something
    const description = isDonation 
      ? `Donation: ${payment.transaction.category.name}`
      : `Payment for ${payment.transaction.category.name}`;

    // Payments are always credits (reducing what member owes, or adding credit for donations)
    return this.createEntry({
      associationId: payment.associationId,
      memberId: payment.transaction.memberId,
      entryType: 'CREDIT',
      category: ledgerCategory,
      amount: payment.amountPaid,
      effectiveDate: payment.paymentDate,
      description,
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
    const whereClause: any = {
      associationId,
      memberId,
    };

    if (asOfDate) {
      whereClause.effectiveDate = { lte: asOfDate };
    }

    const lastEntry = await prisma.memberFinancialLedger.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });

    return Number(lastEntry?.runningBalance || 0);
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
   * Sync existing transactions to ledger (for migration/backfill)
   * @param force - If true, clears existing entries before syncing
   */
  async syncExistingTransactions(associationId: number, memberId: number, createdBy: number, force: boolean = false) {
    // Check if member already has ledger entries
    const existingCount = await prisma.memberFinancialLedger.count({
      where: { associationId, memberId },
    });

    if (existingCount > 0) {
      if (force) {
        // Clear existing entries before re-syncing
        await this.clearMemberLedger(associationId, memberId);
      } else {
        throw new Error('Member already has ledger entries. Use force=true to clear and re-sync.');
      }
    }

    // Get all transactions for this member
    const transactions = await prisma.transaction.findMany({
      where: { associationId, memberId },
      include: { category: true, payments: true },
      orderBy: { createdAt: 'asc' },
    });

    const entries: LedgerEntryInput[] = [];

    for (const txn of transactions) {
      const categoryMap: Record<string, LedgerCategory> = {
        'due': 'DUES',
        'levy': 'LEVY',
        'penalty': 'PENALTY',
        'donation': 'DONATION',
      };
      const ledgerCategory = categoryMap[txn.category.type] || 'OTHER';
      
      // For donations: Only payments should create CREDIT entries (the actual donation)
      // For dues/levies/penalties: Transaction creates DEBIT (what is owed), payment creates CREDIT (payment made)
      const isDonation = txn.category.type === 'donation';
      
      // Only create transaction entry for non-donation types (dues, levies, penalties).
      // A voided charge is no longer owed — its replacement carries the debt — so it adds no debit; any payments
      // already made against it were real money received and still count as credits below.
      if (!isDonation && !txn.isVoided) {
        entries.push({
          associationId,
          memberId,
          entryType: 'DEBIT',
          category: ledgerCategory,
          amount: txn.amount,
          effectiveDate: txn.createdAt,
          description: `${txn.category.name}${txn.notes ? ` - ${txn.notes}` : ''}`,
          sourceTable: 'transaction',
          sourceId: txn.id,
          referenceNumber: txn.referenceNumber || undefined,
          createdBy,
        });
      }

      // Add payment entries
      // For dues/levies/penalties: CREDIT to offset the DEBIT
      // For donations: CREDIT as the actual donation (only when paid)
      for (const payment of txn.payments) {
        entries.push({
          associationId,
          memberId,
          entryType: 'CREDIT',
          category: ledgerCategory,
          amount: payment.amountPaid,
          effectiveDate: payment.paymentDate,
          description: isDonation 
            ? `Donation: ${txn.category.name}` 
            : `Payment for ${txn.category.name}`,
          sourceTable: 'payment',
          sourceId: payment.id,
          referenceNumber: payment.receiptNumber || undefined,
          createdBy,
        });
      }
    }

    // Sort by effective date
    entries.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

    // Create entries in order
    let runningBalance = new Decimal(0);
    const createdEntries = [];

    for (const entry of entries) {
      const amount = new Decimal(entry.amount);
      const balanceChange = entry.entryType === 'CREDIT' 
        ? amount.negated() 
        : entry.entryType === 'DEBIT' 
          ? amount 
          : new Decimal(0);
      
      runningBalance = runningBalance.plus(balanceChange);

      const created = await prisma.memberFinancialLedger.create({
        data: {
          ...entry,
          runningBalance,
        },
      });
      createdEntries.push(created);
    }

    return {
      entriesCreated: createdEntries.length,
      finalBalance: Number(runningBalance),
    };
  },
};
