import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ChartOfAccountInput,
  ChartOfAccountResponse,
  JournalEntryInput,
  JournalEntryResponse,
  IncomeStatementReport,
  BalanceSheetReport,
  CashFlowReport,
  BudgetInput,
  BudgetResponse,
  BudgetVarianceReport,
  AccountingDashboard,
  AccountBalance,
  STANDARD_CHART_OF_ACCOUNTS,
} from './accounting.types';
import { getDateRange } from '../reports/reports.service';
import { accountingPeriodsService } from './accounting-periods.service';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique entry number for journal entries
 */
async function generateEntryNumber(associationId: number): Promise<string> {
  const year = new Date().getFullYear();
  // Based on the highest existing suffix, not a row count — a count-based "next number"
  // collides with an already-used number the moment any entry for the year is ever
  // deleted (G90), since the count drops but the highest number already issued doesn't.
  const latest = await prisma.journalEntry.findFirst({
    where: {
      associationId,
      entryNumber: { startsWith: `JE-${year}-` },
    },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });

  const latestSuffix = latest ? parseInt(latest.entryNumber.split('-')[2], 10) || 0 : 0;
  return `JE-${year}-${String(latestSuffix + 1).padStart(5, '0')}`;
}

/**
 * Calculate account balance from journal entries
 */
async function calculateAccountBalance(
  accountId: number,
  associationId: number,
  asOfDate?: Date
): Promise<Decimal> {
  const account = await prisma.chartOfAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) return new Decimal(0);

  const dateFilter = asOfDate ? { lte: asOfDate } : {};

  const entries = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        associationId,
        status: 'POSTED',
        entryDate: dateFilter,
      },
    },
    select: {
      debitAmount: true,
      creditAmount: true,
    },
  });

  let balance = new Decimal(0);
  entries.forEach(entry => {
    if (account.normalBalance === 'DEBIT') {
      balance = balance.plus(entry.debitAmount).minus(entry.creditAmount);
    } else {
      balance = balance.plus(entry.creditAmount).minus(entry.debitAmount);
    }
  });

  return balance;
}

/**
 * Get all account balances for a specific type
 */
async function getAccountBalancesByType(
  associationId: number,
  type: string,
  asOfDate?: Date,
  subType?: string
): Promise<AccountBalance[]> {
  const whereClause: any = {
    associationId,
    type,
    isActive: true,
  };

  if (subType) {
    whereClause.subType = subType;
  }

  const accounts = await prisma.chartOfAccount.findMany({
    where: whereClause,
    orderBy: { code: 'asc' },
  });

  const balances: AccountBalance[] = [];

  for (const account of accounts) {
    const balance = await calculateAccountBalance(account.id, associationId, asOfDate);
    if (!balance.isZero()) {
      balances.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        balance,
      });
    }
  }

  return balances;
}

// ============================================
// ACCOUNTING SERVICE
// ============================================

export const accountingService = {
  // ==========================================
  // TASK-ACC-001: Chart of Accounts
  // ==========================================

  /**
   * Initialize standard chart of accounts for an association
   */
  async initializeChartOfAccounts(associationId: number): Promise<ChartOfAccountResponse[]> {
    const existingAccounts = await prisma.chartOfAccount.count({
      where: { associationId },
    });

    if (existingAccounts > 0) {
      throw new Error('Chart of accounts already initialized');
    }

    // Create accounts in order to maintain parent-child relationships
    const accountMap: Record<string, number> = {};

    for (const accountData of STANDARD_CHART_OF_ACCOUNTS) {
      // Find parent ID if this is a child account
      let parentId: number | undefined;
      if (accountData.code.length > 4) {
        const parentCode = accountData.code.substring(0, accountData.code.length - 1) + '0';
        parentId = accountMap[parentCode];
      }

      const account = await prisma.chartOfAccount.create({
        data: {
          associationId,
          code: accountData.code,
          name: accountData.name,
          type: accountData.type,
          subType: accountData.subType,
          description: accountData.description,
          parentId,
          normalBalance: accountData.normalBalance || 'DEBIT',
          isSystemAccount: true,
        },
      });

      accountMap[account.code] = account.id;
    }

    return this.getChartOfAccounts(associationId);
  },

  /**
   * Get all accounts for an association
   */
  async getChartOfAccounts(
    associationId: number,
    options: {
      type?: string;
      isActive?: boolean;
      includeBalances?: boolean;
      hierarchical?: boolean;
    } = {}
  ): Promise<ChartOfAccountResponse[]> {
    const whereClause: any = { associationId };

    if (options.type) whereClause.type = options.type;
    if (options.isActive !== undefined) whereClause.isActive = options.isActive;

    const accounts = await prisma.chartOfAccount.findMany({
      where: whereClause,
      include: {
        children: options.hierarchical ? true : false,
      },
      orderBy: { code: 'asc' },
    });

    const result: ChartOfAccountResponse[] = [];

    for (const account of accounts) {
      const response: ChartOfAccountResponse = {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type as any,
        subType: account.subType,
        description: account.description,
        parentId: account.parentId,
        isActive: account.isActive,
        isSystemAccount: account.isSystemAccount,
        normalBalance: account.normalBalance as any,
      };

      if (options.includeBalances) {
        response.balance = await calculateAccountBalance(account.id, associationId);
      }

      result.push(response);
    }

    return result;
  },

  /**
   * Create a new account
   */
  async createAccount(
    associationId: number,
    data: ChartOfAccountInput
  ): Promise<ChartOfAccountResponse> {
    // Check for duplicate code
    const existing = await prisma.chartOfAccount.findUnique({
      where: { associationId_code: { associationId, code: data.code } },
    });

    if (existing) {
      throw new Error(`Account with code ${data.code} already exists`);
    }

    // Validate parent if provided
    if (data.parentId) {
      const parent = await prisma.chartOfAccount.findFirst({
        where: { id: data.parentId, associationId },
      });
      if (!parent) {
        throw new Error('Parent account not found');
      }
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        associationId,
        code: data.code,
        name: data.name,
        type: data.type,
        subType: data.subType,
        description: data.description,
        parentId: data.parentId,
        normalBalance: data.normalBalance || 'DEBIT',
      },
    });

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type as any,
      subType: account.subType,
      description: account.description,
      parentId: account.parentId,
      isActive: account.isActive,
      isSystemAccount: account.isSystemAccount,
      normalBalance: account.normalBalance as any,
    };
  },

  /**
   * Update an account
   */
  async updateAccount(
    associationId: number,
    accountId: number,
    data: Partial<ChartOfAccountInput> & { isActive?: boolean }
  ): Promise<ChartOfAccountResponse> {
    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, associationId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Cannot modify system accounts' core properties
    if (account.isSystemAccount && (data.code || data.type)) {
      throw new Error('Cannot modify code or type of system accounts');
    }

    const updated = await prisma.chartOfAccount.update({
      where: { id: accountId },
      data: {
        name: data.name,
        subType: data.subType,
        description: data.description,
        parentId: data.parentId,
        isActive: data.isActive,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      type: updated.type as any,
      subType: updated.subType,
      description: updated.description,
      parentId: updated.parentId,
      isActive: updated.isActive,
      isSystemAccount: updated.isSystemAccount,
      normalBalance: updated.normalBalance as any,
    };
  },

  /**
   * Delete an account (soft delete by deactivating)
   */
  async deleteAccount(associationId: number, accountId: number): Promise<void> {
    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, associationId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    if (account.isSystemAccount) {
      throw new Error('Cannot delete system accounts');
    }

    // Check if account has any journal entries
    const hasEntries = await prisma.journalEntryLine.count({
      where: { accountId },
    });

    if (hasEntries > 0) {
      // Soft delete
      await prisma.chartOfAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no entries
      await prisma.chartOfAccount.delete({
        where: { id: accountId },
      });
    }
  },


  // ==========================================
  // TASK-ACC-002: Journal Entry System
  // ==========================================

  /**
   * Create a journal entry
   */
  async createJournalEntry(
    associationId: number,
    userId: number,
    data: JournalEntryInput
  ): Promise<JournalEntryResponse> {
    await accountingPeriodsService.assertDateIsPostable(associationId, new Date(data.entryDate));

    const entryNumber = await generateEntryNumber(associationId);

    // Validate all accounts exist and belong to association
    const accountIds = data.lines.map(line => line.accountId);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds }, associationId, isActive: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error('One or more accounts not found or inactive');
    }

    // Calculate totals
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    const entry = await prisma.journalEntry.create({
      data: {
        associationId,
        entryNumber,
        entryDate: new Date(data.entryDate),
        description: data.description,
        reference: data.reference,
        sourceType: 'manual',
        status: 'DRAFT',
        totalDebit: new Decimal(totalDebit),
        totalCredit: new Decimal(totalCredit),
        createdBy: userId,
        lines: {
          create: data.lines.map(line => ({
            accountId: line.accountId,
            debitAmount: new Decimal(line.debitAmount || 0),
            creditAmount: new Decimal(line.creditAmount || 0),
            description: line.description,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
    });

    return this.formatJournalEntryResponse(entry);
  },

  /**
   * Get journal entries with pagination
   */
  async getJournalEntries(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ entries: JournalEntryResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };

    if (options.status) whereClause.status = options.status;
    if (options.startDate && options.endDate) {
      whereClause.entryDate = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }
    if (options.search) {
      whereClause.OR = [
        { entryNumber: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { reference: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [entries, totalCount] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
            },
          },
          creator: { select: { email: true } },
          approver: { select: { email: true } },
        },
        orderBy: { [options.sortBy || 'entryDate']: options.sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      prisma.journalEntry.count({ where: whereClause }),
    ]);

    return {
      entries: entries.map(e => this.formatJournalEntryResponse(e)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + entries.length < totalCount,
      },
    };
  },

  /**
   * Get a single journal entry
   */
  async getJournalEntry(
    associationId: number,
    entryId: number
  ): Promise<JournalEntryResponse | null> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, associationId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
        creator: { select: { email: true } },
        approver: { select: { email: true } },
      },
    });

    return entry ? this.formatJournalEntryResponse(entry) : null;
  },

  /**
   * Update a journal entry (only if DRAFT)
   */
  async updateJournalEntry(
    associationId: number,
    entryId: number,
    data: Partial<JournalEntryInput>
  ): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, associationId },
    });

    if (!entry) {
      throw new Error('Journal entry not found');
    }

    if (entry.status !== 'DRAFT') {
      throw new Error('Can only update draft entries');
    }

    if (data.entryDate) {
      await accountingPeriodsService.assertDateIsPostable(associationId, new Date(data.entryDate));
    }

    const updateData: any = {};
    if (data.entryDate) updateData.entryDate = new Date(data.entryDate);
    if (data.description) updateData.description = data.description;
    if (data.reference !== undefined) updateData.reference = data.reference;

    if (data.lines) {
      const totalDebit = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
      const totalCredit = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
      updateData.totalDebit = new Decimal(totalDebit);
      updateData.totalCredit = new Decimal(totalCredit);

      // Delete existing lines and create new ones
      await prisma.journalEntryLine.deleteMany({
        where: { journalEntryId: entryId },
      });

      await prisma.journalEntryLine.createMany({
        data: data.lines.map(line => ({
          journalEntryId: entryId,
          accountId: line.accountId,
          debitAmount: new Decimal(line.debitAmount || 0),
          creditAmount: new Decimal(line.creditAmount || 0),
          description: line.description,
        })),
      });
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Submit entry for approval
   */
  async submitForApproval(associationId: number, entryId: number): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, associationId },
    });

    if (!entry) {
      throw new Error('Journal entry not found');
    }

    if (entry.status !== 'DRAFT') {
      throw new Error('Can only submit draft entries for approval');
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { status: 'PENDING_APPROVAL' },
    });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  // ==========================================
  // TASK-ACC-007: Approval Workflow
  // ==========================================

  /**
   * Approve or reject a journal entry
   */
  async processApproval(
    associationId: number,
    entryId: number,
    userId: number,
    action: 'approve' | 'reject',
    reason?: string
  ): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, associationId },
    });

    if (!entry) {
      throw new Error('Journal entry not found');
    }

    if (entry.status !== 'PENDING_APPROVAL') {
      throw new Error('Entry is not pending approval');
    }

    if (entry.createdBy === userId) {
      throw new Error('Cannot approve your own entry');
    }

    if (action === 'approve') {
      await prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    } else {
      if (!reason) {
        throw new Error('Rejection reason is required');
      }
      await prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          status: 'REJECTED',
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      });
    }

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Post an approved journal entry
   */
  async postJournalEntry(associationId: number, entryId: number): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, associationId },
    });

    if (!entry) {
      throw new Error('Journal entry not found');
    }

    if (entry.status !== 'APPROVED') {
      throw new Error('Can only post approved entries');
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
      },
    });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Get pending approvals count
   */
  async getPendingApprovalsCount(associationId: number): Promise<number> {
    return prisma.journalEntry.count({
      where: { associationId, status: 'PENDING_APPROVAL' },
    });
  },

  /**
   * Format journal entry response
   */
  formatJournalEntryResponse(entry: any): JournalEntryResponse {
    return {
      id: entry.id,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      description: entry.description,
      reference: entry.reference,
      sourceType: entry.sourceType,
      status: entry.status,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      createdBy: entry.createdBy,
      approvedBy: entry.approvedBy,
      approvedAt: entry.approvedAt,
      createdAt: entry.createdAt,
      lines: entry.lines.map((line: any) => ({
        id: line.id,
        accountId: line.accountId,
        accountCode: line.account?.code || '',
        accountName: line.account?.name || '',
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description,
      })),
    };
  },


  // ==========================================
  // TASK-ACC-003: Income Statement (P&L)
  // ==========================================

  /**
   * Generate Income Statement (Profit & Loss)
   */
  async generateIncomeStatement(
    associationId: number,
    filter: { startDate?: Date; endDate?: Date; period?: string },
    includeComparison: boolean = false
  ): Promise<IncomeStatementReport> {
    const { startDate, endDate, label } = getDateRange(filter as any);

    // Get revenue accounts (INCOME type)
    const revenueAccounts = await getAccountBalancesByType(associationId, 'INCOME', endDate);
    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));

    // Get expense accounts (EXPENSE type)
    const expenseAccounts = await getAccountBalancesByType(associationId, 'EXPENSE', endDate);
    const totalExpenses = expenseAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));

    const netIncome = totalRevenue.minus(totalExpenses);

    const report: IncomeStatementReport = {
      period: { startDate, endDate, label },
      revenue: {
        total: totalRevenue,
        accounts: revenueAccounts,
      },
      expenses: {
        total: totalExpenses,
        accounts: expenseAccounts,
      },
      netIncome,
    };

    if (includeComparison) {
      // Calculate previous period
      const duration = endDate.getTime() - startDate.getTime();
      const prevEndDate = new Date(startDate.getTime() - 1);
      const prevStartDate = new Date(prevEndDate.getTime() - duration);

      const prevRevenueAccounts = await getAccountBalancesByType(associationId, 'INCOME', prevEndDate);
      const prevTotalRevenue = prevRevenueAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));

      const prevExpenseAccounts = await getAccountBalancesByType(associationId, 'EXPENSE', prevEndDate);
      const prevTotalExpenses = prevExpenseAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));

      const prevNetIncome = prevTotalRevenue.minus(prevTotalExpenses);

      report.comparison = {
        previousPeriod: {
          revenue: prevTotalRevenue,
          expenses: prevTotalExpenses,
          netIncome: prevNetIncome,
        },
        changes: {
          revenue: {
            amount: totalRevenue.minus(prevTotalRevenue),
            percentage: prevTotalRevenue.isZero() ? 0 : totalRevenue.minus(prevTotalRevenue).dividedBy(prevTotalRevenue).times(100).toNumber(),
          },
          expenses: {
            amount: totalExpenses.minus(prevTotalExpenses),
            percentage: prevTotalExpenses.isZero() ? 0 : totalExpenses.minus(prevTotalExpenses).dividedBy(prevTotalExpenses).times(100).toNumber(),
          },
          netIncome: {
            amount: netIncome.minus(prevNetIncome),
            percentage: prevNetIncome.isZero() ? 0 : netIncome.minus(prevNetIncome).dividedBy(prevNetIncome.abs()).times(100).toNumber(),
          },
        },
      };
    }

    return report;
  },

  // ==========================================
  // TASK-ACC-004: Balance Sheet
  // ==========================================

  /**
   * Generate Balance Sheet
   */
  async generateBalanceSheet(
    associationId: number,
    asOfDate?: Date
  ): Promise<BalanceSheetReport> {
    const date = asOfDate || new Date();

    // Get Assets
    const currentAssets = await getAccountBalancesByType(associationId, 'ASSET', date, 'current_asset');
    const fixedAssets = await getAccountBalancesByType(associationId, 'ASSET', date, 'fixed_asset');
    const otherAssets = await getAccountBalancesByType(associationId, 'ASSET', date);
    
    // Filter out current and fixed from other
    const currentAssetIds = new Set(currentAssets.map(a => a.accountId));
    const fixedAssetIds = new Set(fixedAssets.map(a => a.accountId));
    const filteredOtherAssets = otherAssets.filter(a => !currentAssetIds.has(a.accountId) && !fixedAssetIds.has(a.accountId));

    const totalCurrentAssets = currentAssets.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalFixedAssets = fixedAssets.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalOtherAssets = filteredOtherAssets.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalAssets = totalCurrentAssets.plus(totalFixedAssets).plus(totalOtherAssets);

    // Get Liabilities
    const currentLiabilities = await getAccountBalancesByType(associationId, 'LIABILITY', date, 'current_liability');
    const longTermLiabilities = await getAccountBalancesByType(associationId, 'LIABILITY', date, 'long_term_liability');

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalLiabilities = totalCurrentLiabilities.plus(totalLongTermLiabilities);

    // Get Equity
    const equityAccounts = await getAccountBalancesByType(associationId, 'EQUITY', date);
    const totalEquityAccounts = equityAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));

    // Calculate retained earnings (net income from all periods)
    const revenueAccounts = await getAccountBalancesByType(associationId, 'INCOME', date);
    const expenseAccounts = await getAccountBalancesByType(associationId, 'EXPENSE', date);
    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const totalExpenses = expenseAccounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    const retainedEarnings = totalRevenue.minus(totalExpenses);

    const totalEquity = totalEquityAccounts.plus(retainedEarnings);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);

    return {
      asOfDate: date,
      assets: {
        current: currentAssets,
        fixed: fixedAssets,
        other: filteredOtherAssets,
        totalCurrent: totalCurrentAssets,
        totalFixed: totalFixedAssets,
        totalOther: totalOtherAssets,
        total: totalAssets,
      },
      liabilities: {
        current: currentLiabilities,
        longTerm: longTermLiabilities,
        totalCurrent: totalCurrentLiabilities,
        totalLongTerm: totalLongTermLiabilities,
        total: totalLiabilities,
      },
      equity: {
        accounts: equityAccounts,
        retainedEarnings,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity,
      isBalanced: totalAssets.equals(totalLiabilitiesAndEquity),
    };
  },

  // ==========================================
  // TASK-ACC-005: Cash Flow Statement
  // ==========================================

  /**
   * Generate Cash Flow Statement
   */
  async generateCashFlowStatement(
    associationId: number,
    filter: { startDate?: Date; endDate?: Date; period?: string }
  ): Promise<CashFlowReport> {
    const { startDate, endDate, label } = getDateRange(filter as any);

    // Get cash account (typically 1110 or similar)
    const cashAccounts = await prisma.chartOfAccount.findMany({
      where: {
        associationId,
        OR: [
          { code: { startsWith: '111' } }, // Cash accounts
          { name: { contains: 'Cash', mode: 'insensitive' } },
          { name: { contains: 'Bank', mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    const cashAccountIds = cashAccounts.map(a => a.id);

    // Get beginning cash balance
    const beginningCash = await this.getCashBalanceAsOf(associationId, cashAccountIds, startDate);

    // Get ending cash balance
    const endingCash = await this.getCashBalanceAsOf(associationId, cashAccountIds, endDate);

    // Get journal entries affecting cash accounts in the period
    const cashEntries = await prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: {
          associationId,
          status: 'POSTED',
          entryDate: { gte: startDate, lte: endDate },
        },
      },
      include: {
        journalEntry: {
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });

    // Categorize cash flows
    const operating = { inflows: [] as any[], outflows: [] as any[], netCash: new Decimal(0) };
    const investing = { inflows: [] as any[], outflows: [] as any[], netCash: new Decimal(0) };
    const financing = { inflows: [] as any[], outflows: [] as any[], netCash: new Decimal(0) };

    for (const entry of cashEntries) {
      const isInflow = entry.debitAmount.greaterThan(0);
      const amount = isInflow ? entry.debitAmount : entry.creditAmount;
      const description = entry.journalEntry.description;

      // Determine category based on the other account in the entry
      const otherLines = entry.journalEntry.lines.filter(l => l.accountId !== entry.accountId);
      const otherAccount = otherLines[0]?.account;

      let category = operating; // Default to operating

      if (otherAccount) {
        if (otherAccount.type === 'ASSET' && otherAccount.subType === 'fixed_asset') {
          category = investing;
        } else if (otherAccount.type === 'LIABILITY' && otherAccount.subType === 'long_term_liability') {
          category = financing;
        } else if (otherAccount.type === 'EQUITY') {
          category = financing;
        }
      }

      const item = { description, amount, accountId: entry.accountId };

      if (isInflow) {
        category.inflows.push(item);
        category.netCash = category.netCash.plus(amount);
      } else {
        category.outflows.push(item);
        category.netCash = category.netCash.minus(amount);
      }
    }

    const netCashChange = operating.netCash.plus(investing.netCash).plus(financing.netCash);

    return {
      period: { startDate, endDate, label },
      operating,
      investing,
      financing,
      netCashChange,
      beginningCash,
      endingCash,
    };
  },

  /**
   * Get cash balance as of a specific date
   */
  async getCashBalanceAsOf(
    associationId: number,
    cashAccountIds: number[],
    asOfDate: Date
  ): Promise<Decimal> {
    let totalCash = new Decimal(0);

    for (const accountId of cashAccountIds) {
      const balance = await calculateAccountBalance(accountId, associationId, asOfDate);
      totalCash = totalCash.plus(balance);
    }

    return totalCash;
  },


  // ==========================================
  // TASK-ACC-006: Budget Planning
  // ==========================================

  /**
   * Create a budget
   */
  async createBudget(
    associationId: number,
    userId: number,
    data: BudgetInput
  ): Promise<BudgetResponse> {
    // Validate all accounts exist
    const accountIds = data.items.map(item => item.accountId);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds }, associationId, isActive: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error('One or more accounts not found or inactive');
    }

    const totalBudget = data.items.reduce((sum, item) => sum + item.annualAmount, 0);

    const budget = await prisma.budget.create({
      data: {
        associationId,
        name: data.name,
        description: data.description,
        fiscalYear: data.fiscalYear,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'DRAFT',
        totalBudget: new Decimal(totalBudget),
        createdBy: userId,
        items: {
          create: data.items.map(item => ({
            accountId: item.accountId,
            monthlyAmount: new Decimal(item.monthlyAmount || item.annualAmount / 12),
            q1Amount: item.q1Amount ? new Decimal(item.q1Amount) : null,
            q2Amount: item.q2Amount ? new Decimal(item.q2Amount) : null,
            q3Amount: item.q3Amount ? new Decimal(item.q3Amount) : null,
            q4Amount: item.q4Amount ? new Decimal(item.q4Amount) : null,
            annualAmount: new Decimal(item.annualAmount),
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
    });

    return this.formatBudgetResponse(budget);
  },

  /**
   * Get budgets with pagination
   */
  async getBudgets(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      fiscalYear?: number;
      status?: string;
    } = {}
  ): Promise<{ budgets: BudgetResponse[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };
    if (options.fiscalYear) whereClause.fiscalYear = options.fiscalYear;
    if (options.status) whereClause.status = options.status;

    const [budgets, totalCount] = await Promise.all([
      prisma.budget.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              account: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { fiscalYear: 'desc' },
        skip,
        take: limit,
      }),
      prisma.budget.count({ where: whereClause }),
    ]);

    return {
      budgets: budgets.map(b => this.formatBudgetResponse(b)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + budgets.length < totalCount,
      },
    };
  },

  /**
   * Get a single budget
   */
  async getBudget(associationId: number, budgetId: number): Promise<BudgetResponse | null> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, associationId },
      include: {
        items: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
    });

    return budget ? this.formatBudgetResponse(budget) : null;
  },

  /**
   * Update a budget (only if DRAFT)
   */
  async updateBudget(
    associationId: number,
    budgetId: number,
    data: Partial<BudgetInput>
  ): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, associationId },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    if (budget.status !== 'DRAFT') {
      throw new Error('Can only update draft budgets');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    if (data.items) {
      const totalBudget = data.items.reduce((sum, item) => sum + item.annualAmount, 0);
      updateData.totalBudget = new Decimal(totalBudget);

      // Delete existing items and create new ones
      await prisma.budgetItem.deleteMany({
        where: { budgetId },
      });

      await prisma.budgetItem.createMany({
        data: data.items.map(item => ({
          budgetId,
          accountId: item.accountId,
          monthlyAmount: new Decimal(item.monthlyAmount || item.annualAmount / 12),
          q1Amount: item.q1Amount ? new Decimal(item.q1Amount) : null,
          q2Amount: item.q2Amount ? new Decimal(item.q2Amount) : null,
          q3Amount: item.q3Amount ? new Decimal(item.q3Amount) : null,
          q4Amount: item.q4Amount ? new Decimal(item.q4Amount) : null,
          annualAmount: new Decimal(item.annualAmount),
          notes: item.notes,
        })),
      });
    }

    await prisma.budget.update({
      where: { id: budgetId },
      data: updateData,
    });

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Approve a budget
   */
  async approveBudget(
    associationId: number,
    budgetId: number,
    userId: number
  ): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, associationId },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    if (budget.status !== 'DRAFT' && budget.status !== 'PENDING_APPROVAL') {
      throw new Error('Budget cannot be approved in current status');
    }

    await prisma.budget.update({
      where: { id: budgetId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Activate a budget
   */
  async activateBudget(associationId: number, budgetId: number): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, associationId },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    if (budget.status !== 'APPROVED') {
      throw new Error('Can only activate approved budgets');
    }

    // Deactivate any other active budgets for the same fiscal year
    await prisma.budget.updateMany({
      where: {
        associationId,
        fiscalYear: budget.fiscalYear,
        status: 'ACTIVE',
        id: { not: budgetId },
      },
      data: { status: 'CLOSED' },
    });

    await prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'ACTIVE' },
    });

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Get budget variance report
   */
  async getBudgetVariance(
    associationId: number,
    budgetId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<BudgetVarianceReport> {
    const budget = await this.getBudget(associationId, budgetId);

    if (!budget) {
      throw new Error('Budget not found');
    }

    const periodStart = startDate || budget.startDate;
    const periodEnd = endDate || budget.endDate;

    const items: any[] = [];
    let totalBudget = new Decimal(0);
    let totalActual = new Decimal(0);

    for (const item of budget.items) {
      // Calculate actual amount from journal entries
      const actualAmount = await calculateAccountBalance(item.accountId, associationId, periodEnd);

      const variance = new Decimal(item.annualAmount).minus(actualAmount);
      const variancePercentage = new Decimal(item.annualAmount).isZero()
        ? 0
        : variance.dividedBy(item.annualAmount).times(100).toNumber();

      let status: 'under' | 'on_track' | 'over' = 'on_track';
      if (variancePercentage > 10) status = 'under';
      else if (variancePercentage < -10) status = 'over';

      items.push({
        accountId: item.accountId,
        accountCode: item.accountCode,
        accountName: item.accountName,
        budgetAmount: item.annualAmount,
        actualAmount,
        variance,
        variancePercentage,
        status,
      });

      totalBudget = totalBudget.plus(item.annualAmount);
      totalActual = totalActual.plus(actualAmount);
    }

    const totalVariance = totalBudget.minus(totalActual);
    const variancePercentage = totalBudget.isZero()
      ? 0
      : totalVariance.dividedBy(totalBudget).times(100).toNumber();

    return {
      budget,
      period: { startDate: periodStart, endDate: periodEnd },
      items,
      summary: {
        totalBudget,
        totalActual,
        totalVariance,
        variancePercentage,
      },
    };
  },

  /**
   * Format budget response
   */
  formatBudgetResponse(budget: any): BudgetResponse {
    return {
      id: budget.id,
      name: budget.name,
      description: budget.description,
      fiscalYear: budget.fiscalYear,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      totalBudget: budget.totalBudget,
      items: budget.items.map((item: any) => ({
        id: item.id,
        accountId: item.accountId,
        accountCode: item.account?.code || '',
        accountName: item.account?.name || '',
        monthlyAmount: item.monthlyAmount,
        q1Amount: item.q1Amount,
        q2Amount: item.q2Amount,
        q3Amount: item.q3Amount,
        q4Amount: item.q4Amount,
        annualAmount: item.annualAmount,
        notes: item.notes,
      })),
    };
  },

  // ==========================================
  // TASK-ACC-009: Accounting Dashboard
  // ==========================================

  /**
   * Get accounting dashboard data
   */
  async getDashboard(associationId: number): Promise<AccountingDashboard> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get quick stats
    const balanceSheet = await this.generateBalanceSheet(associationId, now);
    const incomeStatement = await this.generateIncomeStatement(
      associationId,
      { startDate: startOfYear, endDate: now },
      false
    );

    // Get cash balance
    const cashAccounts = await prisma.chartOfAccount.findMany({
      where: {
        associationId,
        code: { startsWith: '111' },
        isActive: true,
      },
    });

    let cashBalance = new Decimal(0);
    for (const account of cashAccounts) {
      const balance = await calculateAccountBalance(account.id, associationId, now);
      cashBalance = cashBalance.plus(balance);
    }

    // Get recent entries
    const recentEntries = await prisma.journalEntry.findMany({
      where: { associationId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get pending approvals count
    const pendingApprovals = await this.getPendingApprovalsCount(associationId);

    // Get active budget status
    const activeBudget = await prisma.budget.findFirst({
      where: { associationId, status: 'ACTIVE' },
      include: { items: true },
    });

    let budgetStatus;
    if (activeBudget) {
      const totalBudget = activeBudget.totalBudget;
      let totalSpent = new Decimal(0);

      for (const item of activeBudget.items) {
        const spent = await calculateAccountBalance(item.accountId, associationId, now);
        totalSpent = totalSpent.plus(spent.abs());
      }

      budgetStatus = {
        totalBudget,
        totalSpent,
        remainingBudget: totalBudget.minus(totalSpent),
        percentUsed: totalBudget.isZero() ? 0 : totalSpent.dividedBy(totalBudget).times(100).toNumber(),
      };
    }

    // Get monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthIncome = await this.getMonthlyTotal(associationId, 'INCOME', monthStart, monthEnd);
      const monthExpenses = await this.getMonthlyTotal(associationId, 'EXPENSE', monthStart, monthEnd);

      monthlyTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        income: monthIncome,
        expenses: monthExpenses,
      });
    }

    return {
      quickStats: {
        totalAssets: balanceSheet.assets.total,
        totalLiabilities: balanceSheet.liabilities.total,
        totalEquity: balanceSheet.equity.total,
        netIncome: incomeStatement.netIncome,
        cashBalance,
      },
      recentEntries: recentEntries.map(e => this.formatJournalEntryResponse(e)),
      pendingApprovals,
      budgetStatus,
      monthlyTrend,
    };
  },

  /**
   * Get monthly total for a specific account type
   */
  async getMonthlyTotal(
    associationId: number,
    type: string,
    startDate: Date,
    endDate: Date
  ): Promise<Decimal> {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { associationId, type: type as any, isActive: true },
    });

    let total = new Decimal(0);

    for (const account of accounts) {
      const entries = await prisma.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            associationId,
            status: 'POSTED',
            entryDate: { gte: startDate, lte: endDate },
          },
        },
        select: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      entries.forEach(entry => {
        if (account.normalBalance === 'DEBIT') {
          total = total.plus(entry.debitAmount).minus(entry.creditAmount);
        } else {
          total = total.plus(entry.creditAmount).minus(entry.debitAmount);
        }
      });
    }

    return total;
  },
};
