import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import {
  AccountBalance,
  AccountingDashboard,
  BalanceSheetReport,
  BudgetInput,
  BudgetResponse,
  BudgetVarianceReport,
  BudgetVarianceSummary,
  CashFlowReport,
  ChartOfAccountInput,
  ChartOfAccountResponse,
  IncomeStatementReport,
  JournalEntryInput,
  JournalEntryResponse,
  STANDARD_CHART_OF_ACCOUNTS,
} from './accounting.types';
import { getDateRange } from '../reports/reports.service';
import { accountingPeriodsService } from './accounting-periods.service';
import {
  AccountingRuleError,
  balanceOf,
  cashFlowGroup,
  cleanEntryLines,
  defaultNormalBalance,
  lagosDayEnd,
  lagosDayKey,
  lagosDayStart,
  proratedBudget,
  toMoney,
  varianceStatus,
  type AccountType,
} from './accounting-rules';

type Db = Prisma.TransactionClient | typeof prisma;

// ============================================
// HELPER FUNCTIONS
// ============================================

const rule = (message: string, status: 400 | 403 | 404 | 409, code: string) => new AccountingRuleError(message, status, code);

async function writeAudit(db: Db, associationId: number, userId: number, action: string, tableName: string, recordId: number, values: object, before?: object) {
  await db.auditLog.create({
    data: { associationId, userId, action, tableName, recordId, newValues: values as Prisma.InputJsonValue, ...(before ? { oldValues: before as Prisma.InputJsonValue } : {}) },
  });
}

/**
 * Generate unique entry number for journal entries.
 * Based on the highest existing suffix, not a row count — a count-based "next number" collides with an already-used number the moment
 * any entry for the year is ever deleted (G90). Two entries made at the same moment can still pick the same number; the caller retries.
 */
async function generateEntryNumber(db: Db, associationId: number): Promise<string> {
  const year = lagosDayKey(new Date()).slice(0, 4);
  const latest = await db.journalEntry.findFirst({
    where: { associationId, entryNumber: { startsWith: `JE-${year}-` } },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });
  const latestSuffix = latest ? parseInt(latest.entryNumber.split('-')[2] ?? '0', 10) || 0 : 0;
  return `JE-${year}-${String(latestSuffix + 1).padStart(5, '0')}`;
}

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

type Range = { from?: Date; to?: Date };

/** Debits and credits posted to each account, in one query. With no `from` it is everything up to `to`; with one it is that stretch only. */
async function activityByAccount(associationId: number, range: Range, accountIds?: number[]): Promise<Map<number, { debit: Decimal; credit: Decimal }>> {
  const entryDate: Prisma.DateTimeFilter = {};
  if (range.from) entryDate.gte = range.from;
  if (range.to) entryDate.lte = range.to;
  if (accountIds && accountIds.length === 0) return new Map();

  const rows = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      ...(accountIds ? { accountId: { in: accountIds } } : {}),
      journalEntry: { associationId, status: 'POSTED', ...(range.from || range.to ? { entryDate } : {}) },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });
  return new Map(rows.map((r) => [r.accountId, { debit: new Decimal(r._sum.debitAmount ?? 0), credit: new Decimal(r._sum.creditAmount ?? 0) }]));
}

/** The balance of each account of a type, skipping the ones at zero. Switched-off accounts still count: their money did not go anywhere. */
async function getAccountBalancesByType(associationId: number, type: AccountType, range: Range, subType?: string): Promise<AccountBalance[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { associationId, type, ...(subType ? { subType } : {}) },
    orderBy: { code: 'asc' },
  });
  const activity = await activityByAccount(associationId, range, accounts.map((a) => a.id));
  const balances: AccountBalance[] = [];
  for (const account of accounts) {
    const sums = activity.get(account.id);
    const balance = sums ? balanceOf(account.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit) : new Decimal(0);
    if (!balance.isZero()) balances.push({ accountId: account.id, accountCode: account.code, accountName: account.name, balance });
  }
  return balances;
}

const sumBalances = (rows: AccountBalance[]): Decimal => rows.reduce((sum, r) => sum.plus(r.balance), new Decimal(0));

/** The accounts that hold the association's cash and bank money. */
export async function cashAccountIds(associationId: number): Promise<number[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      associationId,
      type: 'ASSET',
      OR: [{ code: { startsWith: '111' } }, { name: { contains: 'Cash', mode: 'insensitive' } }, { name: { contains: 'Bank', mode: 'insensitive' } }],
    },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

async function totalBalance(associationId: number, accountIds: number[], range: Range): Promise<Decimal> {
  if (accountIds.length === 0) return new Decimal(0);
  const accounts = await prisma.chartOfAccount.findMany({ where: { id: { in: accountIds }, associationId } });
  const activity = await activityByAccount(associationId, range, accountIds);
  return accounts.reduce((sum, a) => {
    const sums = activity.get(a.id);
    return sums ? sum.plus(balanceOf(a.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit)) : sum;
  }, new Decimal(0));
}

const entryInclude = {
  lines: { include: { account: { select: { code: true, name: true } } } },
  creator: { select: { email: true } },
  approver: { select: { email: true } },
} as const;

const percentOf = (part: Decimal, whole: Decimal): number => (whole.isZero() ? 0 : part.dividedBy(whole).times(100).toDecimalPlaces(1).toNumber());

// ============================================
// ACCOUNTING SERVICE
// ============================================

export const accountingService = {
  // ==========================================
  // TASK-ACC-001: Chart of Accounts
  // ==========================================

  /**
   * Initialize standard chart of accounts for an association. All or nothing: a failure part-way used to leave a half-made chart that
   * then refused to start again.
   */
  async initializeChartOfAccounts(associationId: number): Promise<ChartOfAccountResponse[]> {
    try {
      await prisma.$transaction(async (tx) => {
        if ((await tx.chartOfAccount.count({ where: { associationId } })) > 0) throw rule('The chart of accounts is already set up.', 409, 'ALREADY_INITIALIZED');

        // Create accounts in order to maintain parent-child relationships
        const accountMap: Record<string, number> = {};
        for (const accountData of STANDARD_CHART_OF_ACCOUNTS) {
          let parentId: number | undefined;
          if (accountData.code.length > 4) {
            const parentCode = accountData.code.substring(0, accountData.code.length - 1) + '0';
            parentId = accountMap[parentCode];
          }
          const account = await tx.chartOfAccount.create({
            data: {
              associationId,
              code: accountData.code,
              name: accountData.name,
              type: accountData.type,
              subType: accountData.subType,
              description: accountData.description,
              parentId,
              normalBalance: accountData.normalBalance || defaultNormalBalance(accountData.type),
              isSystemAccount: true,
            },
          });
          accountMap[account.code] = account.id;
        }
      });
    } catch (error) {
      // Two people starting it at once: the second hits the unique code
      if (isUniqueViolation(error)) throw rule('The chart of accounts is already set up.', 409, 'ALREADY_INITIALIZED');
      throw error;
    }

    return this.getChartOfAccounts(associationId);
  },

  /**
   * Get all accounts for an association
   */
  async getChartOfAccounts(
    associationId: number,
    options: { type?: string; isActive?: boolean; includeBalances?: boolean; hierarchical?: boolean } = {},
  ): Promise<ChartOfAccountResponse[]> {
    const whereClause: Prisma.ChartOfAccountWhereInput = { associationId };
    if (options.type) whereClause.type = options.type as AccountType;
    if (options.isActive !== undefined) whereClause.isActive = options.isActive;

    const accounts = await prisma.chartOfAccount.findMany({
      where: whereClause,
      include: { children: options.hierarchical ? true : false },
      orderBy: { code: 'asc' },
    });

    const activity = options.includeBalances ? await activityByAccount(associationId, {}, accounts.map((a) => a.id)) : null;

    return accounts.map((account) => {
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
      if (activity) {
        const sums = activity.get(account.id);
        response.balance = sums ? balanceOf(account.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit) : new Decimal(0);
      }
      return response;
    });
  },

  /**
   * Create a new account. Its normal balance follows its type unless one is given (a contra account such as accumulated depreciation
   * is the usual reason to give one); a child must be of the same type as its parent.
   */
  async createAccount(associationId: number, data: ChartOfAccountInput, userId?: number): Promise<ChartOfAccountResponse> {
    const code = data.code.trim();
    const existing = await prisma.chartOfAccount.findUnique({ where: { associationId_code: { associationId, code } } });
    if (existing) throw rule(`An account with code ${code} already exists.`, 409, 'CODE_EXISTS');

    if (data.parentId) {
      const parent = await prisma.chartOfAccount.findFirst({ where: { id: data.parentId, associationId } });
      if (!parent) throw rule('The parent account was not found.', 404, 'PARENT_NOT_FOUND');
      if (parent.type !== data.type) throw rule(`A ${data.type.toLowerCase()} account must sit under a ${data.type.toLowerCase()} account.`, 400, 'PARENT_TYPE');
    }

    try {
      const account = await prisma.chartOfAccount.create({
        data: {
          associationId,
          code,
          name: data.name.trim(),
          type: data.type,
          subType: data.subType,
          description: data.description,
          parentId: data.parentId,
          normalBalance: data.normalBalance || defaultNormalBalance(data.type),
        },
      });
      if (userId) await writeAudit(prisma, associationId, userId, 'ACCOUNT_CREATED', 'chart_of_accounts', account.id, { code: account.code, name: account.name, type: account.type });
      return formatAccount(account);
    } catch (error) {
      if (isUniqueViolation(error)) throw rule(`An account with code ${code} already exists.`, 409, 'CODE_EXISTS');
      throw error;
    }
  },

  /**
   * Update an account. A built-in account stays switched on, and an account cannot be placed under itself or under one of its own
   * sub-accounts.
   */
  async updateAccount(associationId: number, accountId: number, data: Partial<Omit<ChartOfAccountInput, 'parentId'>> & { isActive?: boolean; parentId?: number | null }, userId?: number): Promise<ChartOfAccountResponse> {
    const account = await prisma.chartOfAccount.findFirst({ where: { id: accountId, associationId } });
    if (!account) throw rule('Account not found.', 404, 'ACCOUNT_NOT_FOUND');

    if (account.isSystemAccount && (data.code || data.type)) throw rule('The code and type of a built-in account cannot be changed.', 400, 'SYSTEM_ACCOUNT');
    if (account.isSystemAccount && data.isActive === false) throw rule('A built-in account cannot be switched off.', 400, 'SYSTEM_ACCOUNT');

    // A number moves the account under that parent; null takes it out from under its parent
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === accountId) throw rule('An account cannot be its own parent.', 400, 'PARENT_CYCLE');
      const parent = await prisma.chartOfAccount.findFirst({ where: { id: data.parentId, associationId } });
      if (!parent) throw rule('The parent account was not found.', 404, 'PARENT_NOT_FOUND');
      if (parent.type !== account.type) throw rule(`A ${account.type.toLowerCase()} account must sit under a ${account.type.toLowerCase()} account.`, 400, 'PARENT_TYPE');
      // Walk up from the new parent: meeting this account means the move would make a loop
      let cursor: number | null = parent.parentId;
      for (let depth = 0; cursor && depth < 20; depth += 1) {
        if (cursor === accountId) throw rule('That would put the account under one of its own sub-accounts.', 400, 'PARENT_CYCLE');
        const up: { parentId: number | null } | null = await prisma.chartOfAccount.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = up?.parentId ?? null;
      }
    }

    const updated = await prisma.chartOfAccount.update({
      where: { id: accountId },
      data: { name: data.name?.trim(), subType: data.subType, description: data.description, parentId: data.parentId, isActive: data.isActive },
    });
    if (userId) await writeAudit(prisma, associationId, userId, 'ACCOUNT_UPDATED', 'chart_of_accounts', accountId, { name: updated.name, isActive: updated.isActive, parentId: updated.parentId }, { name: account.name, isActive: account.isActive, parentId: account.parentId });
    return formatAccount(updated);
  },

  /**
   * Delete an account: switched off when it has been used, removed when it never was. One with sub-accounts or a budget line stays.
   */
  async deleteAccount(associationId: number, accountId: number, userId?: number): Promise<{ removed: boolean }> {
    const account = await prisma.chartOfAccount.findFirst({ where: { id: accountId, associationId } });
    if (!account) throw rule('Account not found.', 404, 'ACCOUNT_NOT_FOUND');
    if (account.isSystemAccount) throw rule('A built-in account cannot be deleted.', 400, 'SYSTEM_ACCOUNT');

    if ((await prisma.chartOfAccount.count({ where: { parentId: accountId, associationId } })) > 0) {
      throw rule('This account has sub-accounts. Move or delete them first.', 409, 'HAS_CHILDREN');
    }
    if ((await prisma.budgetItem.count({ where: { accountId } })) > 0) {
      throw rule('This account is used in a budget, so it cannot be deleted. Switch it off instead.', 409, 'IN_BUDGET');
    }

    const used = await prisma.journalEntryLine.count({ where: { accountId } });
    if (used > 0) {
      await prisma.chartOfAccount.update({ where: { id: accountId }, data: { isActive: false } });
    } else {
      await prisma.chartOfAccount.delete({ where: { id: accountId } });
    }
    if (userId) await writeAudit(prisma, associationId, userId, used > 0 ? 'ACCOUNT_DEACTIVATED' : 'ACCOUNT_DELETED', 'chart_of_accounts', accountId, { code: account.code, name: account.name });
    return { removed: used === 0 };
  },

  // ==========================================
  // TASK-ACC-002: Journal Entry System
  // ==========================================

  /**
   * Create a journal entry. A person's entry starts as a draft; an automatic one (made by the app when money moves) is written
   * already posted, in the same step, so it can never be left half done.
   */
  async createJournalEntry(
    associationId: number,
    userId: number,
    data: JournalEntryInput,
    options: { source?: { type: string; id?: number }; autoPost?: boolean } = {},
  ): Promise<JournalEntryResponse> {
    const entryDate = new Date(data.entryDate);
    if (Number.isNaN(entryDate.getTime())) throw rule('Choose a valid date for the entry.', 400, 'INVALID_DATE');
    await accountingPeriodsService.assertDateIsPostable(associationId, entryDate);

    const description = data.description?.trim();
    if (!description) throw rule('Describe the entry.', 400, 'INVALID_ENTRY');

    // Automatic entries are worked out by the app from amounts with many decimals (interest, percentages): round to the kobo first
    const rawLines = options.autoPost
      ? data.lines.map((l) => ({ ...l, debitAmount: Number(new Decimal(l.debitAmount || 0).toDecimalPlaces(2)), creditAmount: Number(new Decimal(l.creditAmount || 0).toDecimalPlaces(2)) }))
      : data.lines;
    const { lines, total } = cleanEntryLines(rawLines);

    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const accounts = await prisma.chartOfAccount.findMany({ where: { id: { in: accountIds }, associationId, isActive: true }, select: { id: true } });
    if (accounts.length !== accountIds.length) throw rule('One or more accounts were not found or are switched off.', 400, 'INVALID_ACCOUNT');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const entry = await prisma.$transaction(async (tx) => {
          const created = await tx.journalEntry.create({
            data: {
              associationId,
              entryNumber: await generateEntryNumber(tx, associationId),
              entryDate,
              description,
              reference: data.reference?.trim() || null,
              sourceType: options.source ? `auto_sync:${options.source.type}` : 'manual',
              sourceId: options.source?.id ?? null,
              status: options.autoPost ? 'POSTED' : 'DRAFT',
              postedAt: options.autoPost ? new Date() : null,
              totalDebit: total,
              totalCredit: total,
              createdBy: userId,
              lines: { create: lines.map((l) => ({ accountId: l.accountId, debitAmount: l.debit, creditAmount: l.credit, description: l.description })) },
            },
            include: entryInclude,
          });
          if (!options.autoPost) await writeAudit(tx, associationId, userId, 'JOURNAL_CREATED', 'journal_entries', created.id, { entryNumber: created.entryNumber, total: total.toFixed(2) });
          return created;
        });
        return this.formatJournalEntryResponse(entry);
      } catch (error) {
        // Another entry took this number a moment ago: take the next one
        if (isUniqueViolation(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw rule('Could not number the entry. Try again.', 409, 'NUMBERING_CONFLICT');
  },

  /**
   * Get journal entries with pagination
   */
  async getJournalEntries(
    associationId: number,
    options: { page?: number; limit?: number; status?: string; startDate?: Date; endDate?: Date; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {},
  ): Promise<{ entries: JournalEntryResponse[]; pagination: any }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.JournalEntryWhereInput = { associationId };
    if (options.status) whereClause.status = options.status as any;
    if (options.startDate || options.endDate) {
      whereClause.entryDate = { ...(options.startDate ? { gte: options.startDate } : {}), ...(options.endDate ? { lte: options.endDate } : {}) };
    }
    if (options.search) {
      whereClause.OR = [
        { entryNumber: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { reference: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = ['entryDate', 'entryNumber', 'createdAt'].includes(options.sortBy ?? '') ? (options.sortBy as string) : 'entryDate';
    const [entries, totalCount] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: entryInclude,
        orderBy: [{ [sortBy]: options.sortOrder === 'asc' ? 'asc' : 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.journalEntry.count({ where: whereClause }),
    ]);

    return {
      entries: entries.map((e) => this.formatJournalEntryResponse(e)),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: skip + entries.length < totalCount },
    };
  },

  /**
   * Get a single journal entry
   */
  async getJournalEntry(associationId: number, entryId: number): Promise<JournalEntryResponse | null> {
    const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, associationId }, include: entryInclude });
    return entry ? this.formatJournalEntryResponse(entry) : null;
  },

  /**
   * Update a journal entry while it is a draft, or after it was rejected (editing a rejected entry makes it a draft again so it can be
   * sent back for approval). The lines are replaced in the same step as the rest, so a failure never leaves an entry with no lines.
   */
  async updateJournalEntry(associationId: number, entryId: number, data: Partial<JournalEntryInput>, userId?: number): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, associationId } });
    if (!entry) throw rule('Journal entry not found.', 404, 'ENTRY_NOT_FOUND');
    if (entry.status !== 'DRAFT' && entry.status !== 'REJECTED') throw rule('Only a draft or a rejected entry can be changed.', 409, 'WRONG_STATUS');

    const entryDate = data.entryDate ? new Date(data.entryDate) : entry.entryDate;
    if (Number.isNaN(entryDate.getTime())) throw rule('Choose a valid date for the entry.', 400, 'INVALID_DATE');
    if (data.entryDate) await accountingPeriodsService.assertDateIsPostable(associationId, entryDate);
    if (data.description !== undefined && !data.description.trim()) throw rule('Describe the entry.', 400, 'INVALID_ENTRY');

    const cleaned = data.lines ? cleanEntryLines(data.lines) : null;
    if (cleaned) {
      const accountIds = [...new Set(cleaned.lines.map((l) => l.accountId))];
      const accounts = await prisma.chartOfAccount.findMany({ where: { id: { in: accountIds }, associationId, isActive: true }, select: { id: true } });
      if (accounts.length !== accountIds.length) throw rule('One or more accounts were not found or are switched off.', 400, 'INVALID_ACCOUNT');
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.journalEntry.updateMany({
        where: { id: entryId, associationId, status: { in: ['DRAFT', 'REJECTED'] } },
        data: {
          entryDate,
          ...(data.description !== undefined ? { description: data.description.trim() } : {}),
          ...(data.reference !== undefined ? { reference: data.reference?.trim() || null } : {}),
          ...(cleaned ? { totalDebit: cleaned.total, totalCredit: cleaned.total } : {}),
          status: 'DRAFT',
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });
      if (claimed.count === 0) throw rule('That entry was just changed by someone else.', 409, 'WRONG_STATUS');

      if (cleaned) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
        await tx.journalEntryLine.createMany({
          data: cleaned.lines.map((l) => ({ journalEntryId: entryId, accountId: l.accountId, debitAmount: l.debit, creditAmount: l.credit, description: l.description })),
        });
      }
      if (userId) await writeAudit(tx, associationId, userId, 'JOURNAL_UPDATED', 'journal_entries', entryId, { entryNumber: entry.entryNumber, linesChanged: !!cleaned });
    });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Submit a draft for approval. It is checked again now (balanced, accounts on, period open) so a bad entry fails here, not at posting.
   */
  async submitForApproval(associationId: number, entryId: number, userId?: number): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, associationId }, include: { lines: true } });
    if (!entry) throw rule('Journal entry not found.', 404, 'ENTRY_NOT_FOUND');
    if (entry.status !== 'DRAFT') throw rule('Only a draft can be sent for approval.', 409, 'WRONG_STATUS');

    await assertEntryCanBePosted(associationId, entry);

    const claimed = await prisma.journalEntry.updateMany({ where: { id: entryId, associationId, status: 'DRAFT' }, data: { status: 'PENDING_APPROVAL' } });
    if (claimed.count === 0) throw rule('That entry was just changed by someone else.', 409, 'WRONG_STATUS');
    if (userId) await writeAudit(prisma, associationId, userId, 'JOURNAL_SUBMITTED', 'journal_entries', entryId, { entryNumber: entry.entryNumber });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  // ==========================================
  // TASK-ACC-007: Approval Workflow
  // ==========================================

  /**
   * Approve or reject a journal entry. Nobody approves their own entry, and an entry is decided once.
   */
  async processApproval(associationId: number, entryId: number, userId: number, action: 'approve' | 'reject', reason?: string): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, associationId } });
    if (!entry) throw rule('Journal entry not found.', 404, 'ENTRY_NOT_FOUND');
    if (entry.status !== 'PENDING_APPROVAL') throw rule('This entry is not waiting for approval.', 409, 'WRONG_STATUS');
    if (entry.createdBy === userId) throw rule('You cannot approve or reject your own entry. Ask another officer.', 403, 'OWN_ENTRY');

    if (action === 'approve') {
      const claimed = await prisma.journalEntry.updateMany({
        where: { id: entryId, associationId, status: 'PENDING_APPROVAL' },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
      if (claimed.count === 0) throw rule('Someone else just decided this entry.', 409, 'ALREADY_DECIDED');
      await writeAudit(prisma, associationId, userId, 'JOURNAL_APPROVED', 'journal_entries', entryId, { entryNumber: entry.entryNumber });
    } else {
      const why = reason?.trim();
      if (!why) throw rule('Say why you are rejecting it.', 400, 'REASON_REQUIRED');
      const claimed = await prisma.journalEntry.updateMany({
        where: { id: entryId, associationId, status: 'PENDING_APPROVAL' },
        data: { status: 'REJECTED', rejectedBy: userId, rejectedAt: new Date(), rejectionReason: why },
      });
      if (claimed.count === 0) throw rule('Someone else just decided this entry.', 409, 'ALREADY_DECIDED');
      await writeAudit(prisma, associationId, userId, 'JOURNAL_REJECTED', 'journal_entries', entryId, { entryNumber: entry.entryNumber, reason: why });
    }

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Post an approved entry to the books. Checked once more at this moment: the entry still balances, its accounts are still on, and
   * its period has not been closed since it was written. It is posted once, however many times it is asked.
   */
  async postJournalEntry(associationId: number, entryId: number, userId: number): Promise<JournalEntryResponse> {
    const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, associationId }, include: { lines: true } });
    if (!entry) throw rule('Journal entry not found.', 404, 'ENTRY_NOT_FOUND');
    if (entry.status === 'POSTED') throw rule('This entry is already posted.', 409, 'ALREADY_POSTED');
    if (entry.status !== 'APPROVED') throw rule('Only an approved entry can be posted.', 409, 'WRONG_STATUS');

    await assertEntryCanBePosted(associationId, entry);

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.journalEntry.updateMany({ where: { id: entryId, associationId, status: 'APPROVED' }, data: { status: 'POSTED', postedAt: new Date() } });
      if (claimed.count === 0) throw rule('This entry was just posted by someone else.', 409, 'ALREADY_POSTED');
      await writeAudit(tx, associationId, userId, 'JOURNAL_POSTED', 'journal_entries', entryId, { entryNumber: entry.entryNumber, total: entry.totalDebit.toString() });
    });

    return (await this.getJournalEntry(associationId, entryId))!;
  },

  /**
   * Get pending approvals count
   */
  async getPendingApprovalsCount(associationId: number): Promise<number> {
    return prisma.journalEntry.count({ where: { associationId, status: 'PENDING_APPROVAL' } });
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
      sourceId: entry.sourceId ?? null,
      status: entry.status,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      createdBy: entry.createdBy,
      createdByEmail: entry.creator?.email ?? null,
      approvedBy: entry.approvedBy,
      approvedByEmail: entry.approver?.email ?? null,
      approvedAt: entry.approvedAt,
      rejectionReason: entry.rejectionReason ?? null,
      rejectedAt: entry.rejectedAt ?? null,
      postedAt: entry.postedAt ?? null,
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
   * Generate Income Statement (Profit & Loss): income and spending within the period only. It used to add up everything since the
   * books began, so "this month" showed the association's whole history.
   */
  async generateIncomeStatement(
    associationId: number,
    filter: { startDate?: Date; endDate?: Date; period?: string },
    includeComparison: boolean = false,
  ): Promise<IncomeStatementReport> {
    const { startDate, endDate, label } = getDateRange(filter as any);
    const range = { from: startDate, to: endDate };

    const revenueAccounts = await getAccountBalancesByType(associationId, 'INCOME', range);
    const expenseAccounts = await getAccountBalancesByType(associationId, 'EXPENSE', range);
    const totalRevenue = sumBalances(revenueAccounts);
    const totalExpenses = sumBalances(expenseAccounts);
    const netIncome = totalRevenue.minus(totalExpenses);

    const report: IncomeStatementReport = {
      period: { startDate, endDate, label },
      revenue: { total: totalRevenue, accounts: revenueAccounts },
      expenses: { total: totalExpenses, accounts: expenseAccounts },
      netIncome,
    };

    if (includeComparison) {
      // The stretch of the same length just before this one
      const duration = endDate.getTime() - startDate.getTime();
      const prevEndDate = new Date(startDate.getTime() - 1);
      const prevStartDate = new Date(prevEndDate.getTime() - duration);
      const prevRange = { from: prevStartDate, to: prevEndDate };

      const prevTotalRevenue = sumBalances(await getAccountBalancesByType(associationId, 'INCOME', prevRange));
      const prevTotalExpenses = sumBalances(await getAccountBalancesByType(associationId, 'EXPENSE', prevRange));
      const prevNetIncome = prevTotalRevenue.minus(prevTotalExpenses);

      const change = (now: Decimal, before: Decimal) => ({
        amount: now.minus(before),
        percentage: before.isZero() ? 0 : now.minus(before).dividedBy(before.abs()).times(100).toNumber(),
      });
      report.comparison = {
        previousPeriod: { revenue: prevTotalRevenue, expenses: prevTotalExpenses, netIncome: prevNetIncome },
        changes: { revenue: change(totalRevenue, prevTotalRevenue), expenses: change(totalExpenses, prevTotalExpenses), netIncome: change(netIncome, prevNetIncome) },
      };
    }

    return report;
  },

  // ==========================================
  // TASK-ACC-004: Balance Sheet
  // ==========================================

  /**
   * Generate Balance Sheet: everything posted up to the date. Every asset and liability is shown, including the ones that are neither
   * current nor long term, so the sheet adds up whenever the books do.
   */
  async generateBalanceSheet(associationId: number, asOfDate?: Date): Promise<BalanceSheetReport> {
    const date = asOfDate || new Date();
    const range = { to: date };

    const allAssets = await getAccountBalancesByType(associationId, 'ASSET', range);
    const subTypes = await prisma.chartOfAccount.findMany({ where: { associationId, type: 'ASSET' }, select: { id: true, subType: true } });
    const subTypeOf = new Map(subTypes.map((a) => [a.id, a.subType]));
    const currentAssets = allAssets.filter((a) => subTypeOf.get(a.accountId) === 'current_asset');
    const fixedAssets = allAssets.filter((a) => subTypeOf.get(a.accountId) === 'fixed_asset');
    const otherAssets = allAssets.filter((a) => !['current_asset', 'fixed_asset'].includes(subTypeOf.get(a.accountId) ?? ''));

    const totalCurrentAssets = sumBalances(currentAssets);
    const totalFixedAssets = sumBalances(fixedAssets);
    const totalOtherAssets = sumBalances(otherAssets);
    const totalAssets = totalCurrentAssets.plus(totalFixedAssets).plus(totalOtherAssets);

    const allLiabilities = await getAccountBalancesByType(associationId, 'LIABILITY', range);
    const liabilitySubTypes = await prisma.chartOfAccount.findMany({ where: { associationId, type: 'LIABILITY' }, select: { id: true, subType: true } });
    const liabilitySubTypeOf = new Map(liabilitySubTypes.map((a) => [a.id, a.subType]));
    const currentLiabilities = allLiabilities.filter((a) => liabilitySubTypeOf.get(a.accountId) === 'current_liability');
    const longTermLiabilities = allLiabilities.filter((a) => liabilitySubTypeOf.get(a.accountId) === 'long_term_liability');
    const otherLiabilities = allLiabilities.filter((a) => !['current_liability', 'long_term_liability'].includes(liabilitySubTypeOf.get(a.accountId) ?? ''));

    const totalCurrentLiabilities = sumBalances(currentLiabilities);
    const totalLongTermLiabilities = sumBalances(longTermLiabilities);
    const totalOtherLiabilities = sumBalances(otherLiabilities);
    const totalLiabilities = totalCurrentLiabilities.plus(totalLongTermLiabilities).plus(totalOtherLiabilities);

    const equityAccounts = await getAccountBalancesByType(associationId, 'EQUITY', range);
    const totalEquityAccounts = sumBalances(equityAccounts);

    // What the association has earned since the books began and not yet moved into equity
    const totalRevenue = sumBalances(await getAccountBalancesByType(associationId, 'INCOME', range));
    const totalExpenses = sumBalances(await getAccountBalancesByType(associationId, 'EXPENSE', range));
    const retainedEarnings = totalRevenue.minus(totalExpenses);

    const totalEquity = totalEquityAccounts.plus(retainedEarnings);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);

    return {
      asOfDate: date,
      assets: { current: currentAssets, fixed: fixedAssets, other: otherAssets, totalCurrent: totalCurrentAssets, totalFixed: totalFixedAssets, totalOther: totalOtherAssets, total: totalAssets },
      liabilities: {
        current: currentLiabilities,
        longTerm: longTermLiabilities,
        other: otherLiabilities,
        totalCurrent: totalCurrentLiabilities,
        totalLongTerm: totalLongTermLiabilities,
        totalOther: totalOtherLiabilities,
        total: totalLiabilities,
      },
      equity: { accounts: equityAccounts, retainedEarnings, total: totalEquity },
      totalLiabilitiesAndEquity,
      isBalanced: totalAssets.equals(totalLiabilitiesAndEquity),
    };
  },

  // ==========================================
  // TASK-ACC-005: Cash Flow Statement
  // ==========================================

  /**
   * Generate Cash Flow Statement. Cash accounts are asset accounts only (a "Bank Charges" expense is not a bank account), the opening
   * balance is what stood just before the period began, and money moved between two cash accounts is not an inflow or an outflow.
   */
  async generateCashFlowStatement(associationId: number, filter: { startDate?: Date; endDate?: Date; period?: string }): Promise<CashFlowReport> {
    const { startDate, endDate, label } = getDateRange(filter as any);

    const cashIds = await cashAccountIds(associationId);
    const cashSet = new Set(cashIds);

    const beginningCash = await totalBalance(associationId, cashIds, { to: new Date(startDate.getTime() - 1) });
    const endingCash = await totalBalance(associationId, cashIds, { to: endDate });

    const cashEntries = cashIds.length
      ? await prisma.journalEntryLine.findMany({
          where: {
            accountId: { in: cashIds },
            journalEntry: { associationId, status: 'POSTED', entryDate: { gte: startDate, lte: endDate } },
          },
          include: { journalEntry: { include: { lines: { include: { account: true } } } } },
        })
      : [];

    const empty = () => ({ inflows: [] as any[], outflows: [] as any[], netCash: new Decimal(0) });
    const groups = { operating: empty(), investing: empty(), financing: empty() };

    for (const line of cashEntries) {
      const others = line.journalEntry.lines.filter((l) => l.id !== line.id);
      // Cash moved between two cash accounts nets to nothing
      if (others.length > 0 && others.every((l) => cashSet.has(l.accountId))) continue;

      const isInflow = line.debitAmount.greaterThan(0);
      const amount = isInflow ? line.debitAmount : line.creditAmount;
      const group = groups[cashFlowGroup(others.filter((l) => !cashSet.has(l.accountId)).map((l) => l.account))];
      const item = { description: line.journalEntry.description, amount, accountId: line.accountId, entryId: line.journalEntryId };
      if (isInflow) {
        group.inflows.push(item);
        group.netCash = group.netCash.plus(amount);
      } else {
        group.outflows.push(item);
        group.netCash = group.netCash.minus(amount);
      }
    }

    const netCashChange = groups.operating.netCash.plus(groups.investing.netCash).plus(groups.financing.netCash);

    return {
      period: { startDate, endDate, label },
      operating: groups.operating,
      investing: groups.investing,
      financing: groups.financing,
      netCashChange,
      beginningCash,
      endingCash,
      reconciles: beginningCash.plus(netCashChange).equals(endingCash),
      cashAccountIds: cashIds,
    };
  },

  /**
   * Get cash balance as of a specific date
   */
  async getCashBalanceAsOf(associationId: number, accountIds: number[], asOfDate: Date): Promise<Decimal> {
    return totalBalance(associationId, accountIds, { to: asOfDate });
  },

  // ==========================================
  // TASK-ACC-006: Budget Planning
  // ==========================================

  /**
   * Create a budget
   */
  async createBudget(associationId: number, userId: number, data: BudgetInput): Promise<BudgetResponse> {
    const { startDate, endDate } = checkBudgetDates(data.startDate, data.endDate);
    const items = await checkBudgetItems(associationId, data.items);
    const name = data.name.trim();

    try {
      const budget = await prisma.budget.create({
        data: {
          associationId,
          name,
          description: data.description,
          fiscalYear: data.fiscalYear,
          startDate,
          endDate,
          status: 'DRAFT',
          totalBudget: items.reduce((sum, i) => sum.plus(i.annualAmount), new Decimal(0)),
          createdBy: userId,
          items: { create: items },
        },
        include: { items: { include: { account: { select: { code: true, name: true } } } } },
      });
      await writeAudit(prisma, associationId, userId, 'BUDGET_CREATED', 'budgets', budget.id, { name: budget.name, fiscalYear: budget.fiscalYear, total: budget.totalBudget.toString() });
      return this.formatBudgetResponse(budget);
    } catch (error) {
      if (isUniqueViolation(error)) throw rule(`A budget called "${name}" already exists for ${data.fiscalYear}.`, 409, 'BUDGET_EXISTS');
      throw error;
    }
  },

  /**
   * Get budgets with pagination
   */
  async getBudgets(associationId: number, options: { page?: number; limit?: number; fiscalYear?: number; status?: string } = {}): Promise<{ budgets: BudgetResponse[]; pagination: any }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.BudgetWhereInput = { associationId };
    if (options.fiscalYear) whereClause.fiscalYear = options.fiscalYear;
    if (options.status) whereClause.status = options.status as any;

    const [budgets, totalCount] = await Promise.all([
      prisma.budget.findMany({
        where: whereClause,
        include: { items: { include: { account: { select: { code: true, name: true } } } } },
        orderBy: [{ fiscalYear: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.budget.count({ where: whereClause }),
    ]);

    return {
      budgets: budgets.map((b) => this.formatBudgetResponse(b)),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: skip + budgets.length < totalCount },
    };
  },

  /**
   * Get a single budget
   */
  async getBudget(associationId: number, budgetId: number): Promise<BudgetResponse | null> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, associationId },
      include: { items: { include: { account: { select: { code: true, name: true } } } } },
    });
    return budget ? this.formatBudgetResponse(budget) : null;
  },

  /**
   * Update a budget (only while it is a draft). The items are replaced in the same step as the rest.
   */
  async updateBudget(associationId: number, budgetId: number, data: Partial<BudgetInput>, userId?: number): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({ where: { id: budgetId, associationId } });
    if (!budget) throw rule('Budget not found.', 404, 'BUDGET_NOT_FOUND');
    if (budget.status !== 'DRAFT') throw rule('Only a draft budget can be changed.', 409, 'WRONG_STATUS');

    const items = data.items ? await checkBudgetItems(associationId, data.items) : null;
    if (data.name !== undefined && !data.name.trim()) throw rule('Give the budget a name.', 400, 'INVALID_BUDGET');

    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.budget.updateMany({
          where: { id: budgetId, associationId, status: 'DRAFT' },
          data: {
            ...(data.name ? { name: data.name.trim() } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(items ? { totalBudget: items.reduce((sum, i) => sum.plus(i.annualAmount), new Decimal(0)) } : {}),
          },
        });
        if (claimed.count === 0) throw rule('That budget was just changed by someone else.', 409, 'WRONG_STATUS');
        if (items) {
          await tx.budgetItem.deleteMany({ where: { budgetId } });
          await tx.budgetItem.createMany({ data: items.map((i) => ({ ...i, budgetId })) });
        }
        if (userId) await writeAudit(tx, associationId, userId, 'BUDGET_UPDATED', 'budgets', budgetId, { name: data.name ?? budget.name, itemsChanged: !!items });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw rule(`A budget called "${data.name}" already exists for ${budget.fiscalYear}.`, 409, 'BUDGET_EXISTS');
      throw error;
    }

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Approve a budget. Nobody approves their own, and it is approved once.
   */
  async approveBudget(associationId: number, budgetId: number, userId: number): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({ where: { id: budgetId, associationId } });
    if (!budget) throw rule('Budget not found.', 404, 'BUDGET_NOT_FOUND');
    if (budget.status !== 'DRAFT' && budget.status !== 'PENDING_APPROVAL') throw rule('This budget cannot be approved in its current state.', 409, 'WRONG_STATUS');
    if (budget.createdBy === userId) throw rule('You cannot approve your own budget. Ask another officer.', 403, 'OWN_BUDGET');

    const claimed = await prisma.budget.updateMany({
      where: { id: budgetId, associationId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
    if (claimed.count === 0) throw rule('Someone else just decided this budget.', 409, 'ALREADY_DECIDED');
    await writeAudit(prisma, associationId, userId, 'BUDGET_APPROVED', 'budgets', budgetId, { name: budget.name });

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Activate a budget; any other active budget of the same year is closed in the same step.
   */
  async activateBudget(associationId: number, budgetId: number, userId?: number): Promise<BudgetResponse> {
    const budget = await prisma.budget.findFirst({ where: { id: budgetId, associationId } });
    if (!budget) throw rule('Budget not found.', 404, 'BUDGET_NOT_FOUND');
    if (budget.status !== 'APPROVED') throw rule('Only an approved budget can be activated.', 409, 'WRONG_STATUS');

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.budget.updateMany({ where: { id: budgetId, associationId, status: 'APPROVED' }, data: { status: 'ACTIVE' } });
      if (claimed.count === 0) throw rule('That budget was just changed by someone else.', 409, 'WRONG_STATUS');
      await tx.budget.updateMany({ where: { associationId, fiscalYear: budget.fiscalYear, status: 'ACTIVE', id: { not: budgetId } }, data: { status: 'CLOSED' } });
      if (userId) await writeAudit(tx, associationId, userId, 'BUDGET_ACTIVATED', 'budgets', budgetId, { name: budget.name });
    });

    return (await this.getBudget(associationId, budgetId))!;
  },

  /**
   * Budget against actual. Actual is what was posted inside the period, not everything since the books began; and income and spending
   * are summed apart.
   */
  async getBudgetVariance(associationId: number, budgetId: number, startDate?: Date, endDate?: Date): Promise<BudgetVarianceReport> {
    const budget = await this.getBudget(associationId, budgetId);
    if (!budget) throw rule('Budget not found.', 404, 'BUDGET_NOT_FOUND');

    const periodStart = startDate || budget.startDate;
    const periodEnd = endDate || budget.endDate;

    const accounts = await prisma.chartOfAccount.findMany({ where: { associationId, id: { in: budget.items.map((i) => i.accountId) } } });
    const accountOf = new Map(accounts.map((a) => [a.id, a]));
    const activity = await activityByAccount(associationId, { from: periodStart, to: periodEnd }, accounts.map((a) => a.id));

    const items: BudgetVarianceReport['items'] = [];
    const totals = {
      all: { budget: new Decimal(0), actual: new Decimal(0) },
      INCOME: { budget: new Decimal(0), actual: new Decimal(0) },
      EXPENSE: { budget: new Decimal(0), actual: new Decimal(0) },
    };

    for (const item of budget.items) {
      const account = accountOf.get(item.accountId);
      const sums = activity.get(item.accountId);
      const actualAmount = account && sums ? balanceOf(account.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit) : new Decimal(0);
      // A narrower stretch of the year is judged against its share of the yearly amount
      const budgetAmount = proratedBudget(item.annualAmount, budget.startDate, budget.endDate, periodStart, periodEnd);
      const variance = budgetAmount.minus(actualAmount);

      items.push({
        accountId: item.accountId,
        accountCode: item.accountCode,
        accountName: item.accountName,
        accountType: (account?.type ?? 'EXPENSE') as AccountType,
        budgetAmount,
        actualAmount,
        variance,
        variancePercentage: percentOf(variance, budgetAmount),
        status: varianceStatus(budgetAmount, actualAmount),
      });

      totals.all.budget = totals.all.budget.plus(budgetAmount);
      totals.all.actual = totals.all.actual.plus(actualAmount);
      if (account?.type === 'INCOME' || account?.type === 'EXPENSE') {
        totals[account.type].budget = totals[account.type].budget.plus(budgetAmount);
        totals[account.type].actual = totals[account.type].actual.plus(actualAmount);
      }
    }

    const summarise = (t: { budget: Decimal; actual: Decimal }): BudgetVarianceSummary => ({
      totalBudget: t.budget,
      totalActual: t.actual,
      totalVariance: t.budget.minus(t.actual),
      variancePercentage: percentOf(t.budget.minus(t.actual), t.budget),
    });

    return {
      budget,
      period: { startDate: periodStart, endDate: periodEnd },
      items,
      summary: summarise(totals.all),
      incomeSummary: summarise(totals.INCOME),
      expenseSummary: summarise(totals.EXPENSE),
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
      createdBy: budget.createdBy,
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
   * Get accounting dashboard data. Months and the year are cut in Lagos time.
   */
  async getDashboard(associationId: number): Promise<AccountingDashboard> {
    const now = new Date();
    const today = lagosDayKey(now);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7)) - 1;
    const startOfYear = lagosDayStart(`${year}-01-01`);

    const balanceSheet = await this.generateBalanceSheet(associationId, now);
    const incomeStatement = await this.generateIncomeStatement(associationId, { startDate: startOfYear, endDate: now }, false);
    const cashBalance = await totalBalance(associationId, await cashAccountIds(associationId), { to: now });

    const recentEntries = await prisma.journalEntry.findMany({ where: { associationId }, include: entryInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5 });
    const pendingApprovals = await this.getPendingApprovalsCount(associationId);

    // The active budget's spending: only expense lines, and only what was posted inside the budget's own dates
    const activeBudget = await prisma.budget.findFirst({ where: { associationId, status: 'ACTIVE' }, include: { items: true } });
    let budgetStatus: AccountingDashboard['budgetStatus'];
    if (activeBudget) {
      const expenseAccounts = await prisma.chartOfAccount.findMany({ where: { associationId, type: 'EXPENSE', id: { in: activeBudget.items.map((i) => i.accountId) } } });
      const expenseIds = new Set(expenseAccounts.map((a) => a.id));
      const planned = activeBudget.items.filter((i) => expenseIds.has(i.accountId)).reduce((sum, i) => sum.plus(i.annualAmount), new Decimal(0));
      const activity = await activityByAccount(associationId, { from: activeBudget.startDate, to: now < activeBudget.endDate ? now : activeBudget.endDate }, [...expenseIds]);
      const spent = expenseAccounts.reduce((sum, a) => {
        const sums = activity.get(a.id);
        return sums ? sum.plus(balanceOf(a.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit)) : sum;
      }, new Decimal(0));
      budgetStatus = { budgetId: activeBudget.id, totalBudget: planned, totalSpent: spent, remainingBudget: planned.minus(spent), percentUsed: percentOf(spent, planned) };
    }

    // The last six months, income and spending, one query a month
    const trendAccounts = await prisma.chartOfAccount.findMany({ where: { associationId, type: { in: ['INCOME', 'EXPENSE'] } } });
    const monthlyTrend: AccountingDashboard['monthlyTrend'] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const first = new Date(Date.UTC(year, month - i, 1));
      const last = new Date(Date.UTC(year, month - i + 1, 0));
      const from = lagosDayStart(first.toISOString().slice(0, 10));
      const to = lagosDayEnd(last.toISOString().slice(0, 10));
      const activity = await activityByAccount(associationId, { from, to }, trendAccounts.map((a) => a.id));
      let income = new Decimal(0);
      let expenses = new Decimal(0);
      for (const account of trendAccounts) {
        const sums = activity.get(account.id);
        if (!sums) continue;
        const balance = balanceOf(account.normalBalance as 'DEBIT' | 'CREDIT', sums.debit, sums.credit);
        if (account.type === 'INCOME') income = income.plus(balance);
        else expenses = expenses.plus(balance);
      }
      monthlyTrend.push({ month: first.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }), income, expenses });
    }

    return {
      quickStats: {
        totalAssets: balanceSheet.assets.total,
        totalLiabilities: balanceSheet.liabilities.total,
        totalEquity: balanceSheet.equity.total,
        netIncome: incomeStatement.netIncome,
        cashBalance,
      },
      recentEntries: recentEntries.map((e) => this.formatJournalEntryResponse(e)),
      pendingApprovals,
      budgetStatus,
      monthlyTrend,
    };
  },

  /**
   * Income or spending of one type inside a stretch of time
   */
  async getMonthlyTotal(associationId: number, type: string, startDate: Date, endDate: Date): Promise<Decimal> {
    return sumBalances(await getAccountBalancesByType(associationId, type as AccountType, { from: startDate, to: endDate }));
  },
};

// ============================================
// SHARED CHECKS
// ============================================

function formatAccount(account: any): ChartOfAccountResponse {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    subType: account.subType,
    description: account.description,
    parentId: account.parentId,
    isActive: account.isActive,
    isSystemAccount: account.isSystemAccount,
    normalBalance: account.normalBalance,
  };
}

/** What has to be true of an entry for it to go into the books. Used when it is sent for approval and again when it is posted. */
async function assertEntryCanBePosted(
  associationId: number,
  entry: { entryDate: Date; lines: { accountId: number; debitAmount: Decimal; creditAmount: Decimal }[] },
): Promise<void> {
  cleanEntryLines(entry.lines.map((l) => ({ accountId: l.accountId, debitAmount: Number(l.debitAmount), creditAmount: Number(l.creditAmount) })));
  const accountIds = [...new Set(entry.lines.map((l) => l.accountId))];
  const accounts = await prisma.chartOfAccount.findMany({ where: { id: { in: accountIds }, associationId, isActive: true }, select: { id: true } });
  if (accounts.length !== accountIds.length) throw rule('One of the accounts in this entry has been switched off or removed.', 409, 'INVALID_ACCOUNT');
  await accountingPeriodsService.assertDateIsPostable(associationId, entry.entryDate);
}

function checkBudgetDates(start: Date | string, end: Date | string): { startDate: Date; endDate: Date } {
  const startDate = lagosDayStart(lagosDayKey(new Date(start)));
  const endDate = lagosDayEnd(lagosDayKey(new Date(end)));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) throw rule('Choose valid start and end dates.', 400, 'INVALID_DATE');
  if (endDate <= startDate) throw rule('The budget must end after it starts.', 400, 'INVALID_DATE');
  return { startDate, endDate };
}

/** Budget lines: income and expense accounts only, each once, amounts in whole kobo, the monthly figure worked out when not given. */
async function checkBudgetItems(associationId: number, items: BudgetInput['items']) {
  if (items.length === 0) throw rule('Add at least one line to the budget.', 400, 'INVALID_BUDGET');
  const ids = items.map((i) => i.accountId);
  if (new Set(ids).size !== ids.length) throw rule('Each account can be in a budget only once.', 400, 'DUPLICATE_ACCOUNT');

  const accounts = await prisma.chartOfAccount.findMany({ where: { id: { in: ids }, associationId, isActive: true }, select: { id: true, type: true } });
  if (accounts.length !== ids.length) throw rule('One or more accounts were not found or are switched off.', 400, 'INVALID_ACCOUNT');
  if (accounts.some((a) => a.type !== 'INCOME' && a.type !== 'EXPENSE')) throw rule('A budget covers income and expense accounts only.', 400, 'INVALID_ACCOUNT');

  const money = (value: number | undefined, label: string): Decimal | null => {
    if (value === undefined || value === null) return null;
    const amount = toMoney(value);
    if (!amount || amount.isNegative()) throw rule(`${label} must be an amount in naira with at most 2 decimal places.`, 400, 'INVALID_AMOUNT');
    return amount;
  };

  return items.map((item) => {
    const annualAmount = money(item.annualAmount, 'The yearly amount');
    if (!annualAmount || annualAmount.isZero()) throw rule('Each budget line needs a yearly amount above zero.', 400, 'INVALID_AMOUNT');
    return {
      accountId: item.accountId,
      annualAmount,
      monthlyAmount: money(item.monthlyAmount, 'The monthly amount') ?? annualAmount.dividedBy(12).toDecimalPlaces(2),
      q1Amount: money(item.q1Amount, 'The first quarter amount'),
      q2Amount: money(item.q2Amount, 'The second quarter amount'),
      q3Amount: money(item.q3Amount, 'The third quarter amount'),
      q4Amount: money(item.q4Amount, 'The fourth quarter amount'),
      notes: item.notes,
    };
  });
}
