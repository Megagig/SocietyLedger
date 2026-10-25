import { Request, Response } from 'express';
import { accountingService } from './accounting.service';
import {
  createAccountSchema,
  updateAccountSchema,
  accountQuerySchema,
  createJournalEntrySchema,
  updateJournalEntrySchema,
  journalEntryQuerySchema,
  approvalActionSchema,
  financialStatementQuerySchema,
  createBudgetSchema,
  updateBudgetSchema,
  budgetQuerySchema,
  budgetVarianceQuerySchema,
} from './accounting.validation';
import { z } from 'zod';
import { confirmPassword, reauthFailure } from '../../lib/reauth';
import { respondWithError } from './accounting-http';
import { accountingLedgerService } from './accounting-ledger.service';
import { parseAccountIds, parseLedgerDate } from './accounting-ledger';
import { resolveEntrySource } from './accounting-source';

const postEntrySchema = z.object({ password: z.string().min(1) });

// ============================================
// ACCOUNTING CONTROLLER - Phase 9
// ============================================

export const accountingController = {
  // ==========================================
  // TASK-ACC-001: Chart of Accounts
  // ==========================================

  /**
   * Initialize standard chart of accounts
   * POST /api/accounting/chart-of-accounts/initialize
   */
  async initializeChartOfAccounts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const accounts = await accountingService.initializeChartOfAccounts(associationId);

      return res.status(201).json({
        success: true,
        message: 'Chart of accounts initialized successfully',
        data: accounts,
      });
    } catch (error: any) {
      console.error('Error initializing chart of accounts:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Get chart of accounts
   * GET /api/accounting/chart-of-accounts
   */
  async getChartOfAccounts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = accountQuerySchema.parse(req.query);

      const accounts = await accountingService.getChartOfAccounts(associationId, {
        type: queryParams.type,
        isActive: queryParams.isActive,
        includeBalances: queryParams.includeBalances,
        hierarchical: queryParams.hierarchical,
      });

      return res.status(200).json({
        success: true,
        data: accounts,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting chart of accounts:', error);
      return res.status(500).json({ success: false, message: 'Failed to get chart of accounts' });
    }
  },

  /**
   * Create a new account
   * POST /api/accounting/chart-of-accounts
   */
  async createAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createAccountSchema.parse(req.body);
      const account = await accountingService.createAccount(associationId, data, req.user?.id);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating account:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Update an account
   * PUT /api/accounting/chart-of-accounts/:id
   */
  async updateAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const accountId = parseInt(req.params.id);
      const data = updateAccountSchema.parse(req.body);
      const account = await accountingService.updateAccount(associationId, accountId, data, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: account,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating account:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Delete an account
   * DELETE /api/accounting/chart-of-accounts/:id
   */
  async deleteAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const accountId = parseInt(req.params.id);
      await accountingService.deleteAccount(associationId, accountId, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      return respondWithError(res, error);
    }
  },

  // ==========================================
  // TASK-ACC-002: Journal Entries
  // ==========================================

  /**
   * Create a journal entry
   * POST /api/accounting/journal-entries
   */
  async createJournalEntry(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const data = createJournalEntrySchema.parse(req.body);
      const entry = await accountingService.createJournalEntry(associationId, userId, data);

      return res.status(201).json({
        success: true,
        message: 'Journal entry created successfully',
        data: entry,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating journal entry:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Get journal entries
   * GET /api/accounting/journal-entries
   */
  async getJournalEntries(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = journalEntryQuerySchema.parse(req.query);

      const result = await accountingService.getJournalEntries(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        status: queryParams.status,
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
        search: queryParams.search,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting journal entries:', error);
      return res.status(500).json({ success: false, message: 'Failed to get journal entries' });
    }
  },

  /**
   * Get a single journal entry
   * GET /api/accounting/journal-entries/:id
   */
  async getJournalEntry(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const entryId = parseInt(req.params.id);
      const entry = await accountingService.getJournalEntry(associationId, entryId);

      if (!entry) {
        return res.status(404).json({ success: false, message: 'Journal entry not found' });
      }

      // Where the entry came from: the record behind it, named in plain facts
      const source = await resolveEntrySource(associationId, entry.sourceType, entry.sourceId);

      return res.status(200).json({
        success: true,
        data: { ...entry, source },
      });
    } catch (error) {
      console.error('Error getting journal entry:', error);
      return res.status(500).json({ success: false, message: 'Failed to get journal entry' });
    }
  },

  /**
   * The ledger of an account (or of several together): every posted line with a running balance.
   * GET /api/accounting/ledger
   * Query params: accountId | accountIds | scope (cash, or an account type), from, to, search, page, limit
   */
  async getLedger(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }
      const q = req.query;
      const from = parseLedgerDate(q.from, 'The start date', false);
      const to = parseLedgerDate(q.to, 'The end date', true);
      if (from && to && to < from) {
        return res.status(400).json({ success: false, code: 'INVALID_DATE', message: 'The end date is before the start date.' });
      }
      const data = await accountingLedgerService.getLedger(associationId, {
        accountIds: typeof q.scope === 'string' && q.scope !== '' ? await accountingLedgerService.accountsInScope(associationId, q.scope) : parseAccountIds(q.accountId, q.accountIds),
        from,
        to,
        search: typeof q.search === 'string' ? q.search.slice(0, 100) : undefined,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 30,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  /**
   * Update a journal entry
   * PUT /api/accounting/journal-entries/:id
   */
  async updateJournalEntry(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const entryId = parseInt(req.params.id);
      const data = updateJournalEntrySchema.parse(req.body);
      const entry = await accountingService.updateJournalEntry(associationId, entryId, data, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Journal entry updated successfully',
        data: entry,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating journal entry:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Submit entry for approval
   * POST /api/accounting/journal-entries/:id/submit
   */
  async submitForApproval(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const entryId = parseInt(req.params.id);
      const entry = await accountingService.submitForApproval(associationId, entryId, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Journal entry submitted for approval',
        data: entry,
      });
    } catch (error: any) {
      console.error('Error submitting journal entry:', error);
      return respondWithError(res, error);
    }
  },


  // ==========================================
  // TASK-ACC-007: Approval Workflow
  // ==========================================

  /**
   * Approve or reject a journal entry
   * POST /api/accounting/journal-entries/:id/approval
   */
  async processApproval(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const entryId = parseInt(req.params.id);
      const { action, reason } = approvalActionSchema.parse(req.body);
      const entry = await accountingService.processApproval(associationId, entryId, userId, action, reason);

      return res.status(200).json({
        success: true,
        message: `Journal entry ${action === 'reject' ? 'rejected' : 'approved'} successfully`,
        data: entry,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error processing approval:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Post an approved journal entry
   * POST /api/accounting/journal-entries/:id/post
   */
  async postJournalEntry(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Posting writes to the books for good, so the officer confirms with their password first (403 REAUTH_FAILED when wrong; five wrong ones in 15 minutes lock it, 429 REAUTH_LOCKED)
      const { password } = postEntrySchema.parse(req.body ?? {});
      const confirmed = await confirmPassword(userId, password);
      if (!confirmed.ok) {
        const { status, body } = reauthFailure(confirmed);
        return res.status(status).json(body);
      }

      const entryId = parseInt(req.params.id);
      const entry = await accountingService.postJournalEntry(associationId, entryId, userId);

      return res.status(200).json({
        success: true,
        message: 'Journal entry posted successfully',
        data: entry,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, code: 'REAUTH_REQUIRED', message: 'Enter your password to post this entry.' });
      }
      return respondWithError(res, error);
    }
  },

  // ==========================================
  // TASK-ACC-003, 004, 005: Financial Statements
  // ==========================================

  /**
   * Get Income Statement (P&L)
   * GET /api/accounting/income-statement
   */
  async getIncomeStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = financialStatementQuerySchema.parse(req.query);

      const filter: any = { period: queryParams.period };
      if (queryParams.startDate) filter.startDate = new Date(queryParams.startDate);
      if (queryParams.endDate) filter.endDate = new Date(queryParams.endDate);

      const report = await accountingService.generateIncomeStatement(
        associationId,
        filter,
        queryParams.includeComparison
      );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating income statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate income statement' });
    }
  },

  /**
   * Get Balance Sheet
   * GET /api/accounting/balance-sheet
   */
  async getBalanceSheet(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = financialStatementQuerySchema.parse(req.query);
      const asOfDate = queryParams.asOfDate ? new Date(queryParams.asOfDate) : undefined;

      const report = await accountingService.generateBalanceSheet(associationId, asOfDate);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating balance sheet:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate balance sheet' });
    }
  },

  /**
   * Get Cash Flow Statement
   * GET /api/accounting/cash-flow
   */
  async getCashFlowStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = financialStatementQuerySchema.parse(req.query);

      const filter: any = { period: queryParams.period };
      if (queryParams.startDate) filter.startDate = new Date(queryParams.startDate);
      if (queryParams.endDate) filter.endDate = new Date(queryParams.endDate);

      const report = await accountingService.generateCashFlowStatement(associationId, filter);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating cash flow statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate cash flow statement' });
    }
  },

  // ==========================================
  // TASK-ACC-006: Budget Management
  // ==========================================

  /**
   * Create a budget
   * POST /api/accounting/budgets
   */
  async createBudget(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const data = createBudgetSchema.parse(req.body);
      const budget = await accountingService.createBudget(associationId, userId, data);

      return res.status(201).json({
        success: true,
        message: 'Budget created successfully',
        data: budget,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating budget:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Get budgets
   * GET /api/accounting/budgets
   */
  async getBudgets(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = budgetQuerySchema.parse(req.query);

      const result = await accountingService.getBudgets(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        fiscalYear: queryParams.fiscalYear ? parseInt(queryParams.fiscalYear) : undefined,
        status: queryParams.status,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting budgets:', error);
      return res.status(500).json({ success: false, message: 'Failed to get budgets' });
    }
  },

  /**
   * Get a single budget
   * GET /api/accounting/budgets/:id
   */
  async getBudget(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const budgetId = parseInt(req.params.id);
      const budget = await accountingService.getBudget(associationId, budgetId);

      if (!budget) {
        return res.status(404).json({ success: false, message: 'Budget not found' });
      }

      return res.status(200).json({
        success: true,
        data: budget,
      });
    } catch (error) {
      console.error('Error getting budget:', error);
      return res.status(500).json({ success: false, message: 'Failed to get budget' });
    }
  },

  /**
   * Update a budget
   * PUT /api/accounting/budgets/:id
   */
  async updateBudget(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const budgetId = parseInt(req.params.id);
      const data = updateBudgetSchema.parse(req.body);
      const budget = await accountingService.updateBudget(associationId, budgetId, data, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Budget updated successfully',
        data: budget,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating budget:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Approve a budget
   * POST /api/accounting/budgets/:id/approve
   */
  async approveBudget(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const budgetId = parseInt(req.params.id);
      const budget = await accountingService.approveBudget(associationId, budgetId, userId);

      return res.status(200).json({
        success: true,
        message: 'Budget approved successfully',
        data: budget,
      });
    } catch (error: any) {
      console.error('Error approving budget:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Activate a budget
   * POST /api/accounting/budgets/:id/activate
   */
  async activateBudget(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const budgetId = parseInt(req.params.id);
      const budget = await accountingService.activateBudget(associationId, budgetId, req.user?.id);

      return res.status(200).json({
        success: true,
        message: 'Budget activated successfully',
        data: budget,
      });
    } catch (error: any) {
      console.error('Error activating budget:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Get budget variance report
   * GET /api/accounting/budgets/:id/variance
   */
  async getBudgetVariance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const budgetId = parseInt(req.params.id);
      const queryParams = budgetVarianceQuerySchema.parse({ ...req.query, budgetId: req.params.id });

      const report = await accountingService.getBudgetVariance(
        associationId,
        budgetId,
        queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        queryParams.endDate ? new Date(queryParams.endDate) : undefined
      );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting budget variance:', error);
      return respondWithError(res, error);
    }
  },

  // ==========================================
  // SYNC STATUS & BULK OPERATIONS
  // ==========================================

  /**
   * Get sync status for all modules
   * GET /api/accounting/sync/status
   */
  async getSyncStatus(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');

      // Get sync status for all modules
      const [
        transactionsTotal,
        transactionsSynced,
        paymentsTotal,
        paymentsSynced,
        welfareContributionsTotal,
        welfareContributionsSynced,
        welfarePayoutsTotal,
        welfarePayoutsSynced,
        savingsTransactionsTotal,
        savingsTransactionsSynced,
        loansTotal,
        loansSynced,
        loanRepaymentsTotal,
        loanRepaymentsSynced,
      ] = await Promise.all([
        prisma.transaction.count({ where: { associationId } }),
        prisma.transaction.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.payment.count({ where: { associationId } }),
        prisma.payment.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.welfareContribution.count({ where: { associationId, status: 'CONFIRMED' } }),
        prisma.welfareContribution.count({ where: { associationId, status: 'CONFIRMED', accountingSynced: true } as any }),
        prisma.welfarePayoutRequest.count({ where: { associationId, status: 'DISBURSED' } }),
        prisma.welfarePayoutRequest.count({ where: { associationId, status: 'DISBURSED', accountingSynced: true } as any }),
        prisma.savingsTransaction.count({ where: { associationId } }),
        prisma.savingsTransaction.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.loan.count({ where: { associationId, status: { in: ['ACTIVE', 'PAID_OFF'] } } }),
        prisma.loan.count({ where: { associationId, status: { in: ['ACTIVE', 'PAID_OFF'] }, accountingSynced: true } as any }),
        prisma.loanRepayment.count({ where: { associationId } }),
        prisma.loanRepayment.count({ where: { associationId, accountingSynced: true } as any }),
      ]);

      const status = {
        finance: {
          transactions: {
            total: transactionsTotal,
            synced: transactionsSynced,
            unsynced: transactionsTotal - transactionsSynced,
            syncRate: transactionsTotal > 0 ? ((transactionsSynced / transactionsTotal) * 100).toFixed(2) : '0',
          },
          payments: {
            total: paymentsTotal,
            synced: paymentsSynced,
            unsynced: paymentsTotal - paymentsSynced,
            syncRate: paymentsTotal > 0 ? ((paymentsSynced / paymentsTotal) * 100).toFixed(2) : '0',
          },
        },
        welfare: {
          contributions: {
            total: welfareContributionsTotal,
            synced: welfareContributionsSynced,
            unsynced: welfareContributionsTotal - welfareContributionsSynced,
            syncRate: welfareContributionsTotal > 0 ? ((welfareContributionsSynced / welfareContributionsTotal) * 100).toFixed(2) : '0',
          },
          payouts: {
            total: welfarePayoutsTotal,
            synced: welfarePayoutsSynced,
            unsynced: welfarePayoutsTotal - welfarePayoutsSynced,
            syncRate: welfarePayoutsTotal > 0 ? ((welfarePayoutsSynced / welfarePayoutsTotal) * 100).toFixed(2) : '0',
          },
        },
        cooperatives: {
          savingsTransactions: {
            total: savingsTransactionsTotal,
            synced: savingsTransactionsSynced,
            unsynced: savingsTransactionsTotal - savingsTransactionsSynced,
            syncRate: savingsTransactionsTotal > 0 ? ((savingsTransactionsSynced / savingsTransactionsTotal) * 100).toFixed(2) : '0',
          },
          loans: {
            total: loansTotal,
            synced: loansSynced,
            unsynced: loansTotal - loansSynced,
            syncRate: loansTotal > 0 ? ((loansSynced / loansTotal) * 100).toFixed(2) : '0',
          },
          loanRepayments: {
            total: loanRepaymentsTotal,
            synced: loanRepaymentsSynced,
            unsynced: loanRepaymentsTotal - loanRepaymentsSynced,
            syncRate: loanRepaymentsTotal > 0 ? ((loanRepaymentsSynced / loanRepaymentsTotal) * 100).toFixed(2) : '0',
          },
        },
        overall: {
          total: transactionsTotal + paymentsTotal + welfareContributionsTotal + welfarePayoutsTotal + savingsTransactionsTotal + loansTotal + loanRepaymentsTotal,
          synced: transactionsSynced + paymentsSynced + welfareContributionsSynced + welfarePayoutsSynced + savingsTransactionsSynced + loansSynced + loanRepaymentsSynced,
        },
      };

      status.overall = {
        ...status.overall,
        unsynced: status.overall.total - status.overall.synced,
        syncRate: status.overall.total > 0 ? ((status.overall.synced / status.overall.total) * 100).toFixed(2) : '0',
      } as any;

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting sync status:', error);
      return res.status(500).json({ success: false, message: 'Failed to get sync status' });
    }
  },

  /**
   * Bulk sync unsynced transactions
   * POST /api/accounting/sync/transactions/bulk
   */
  async bulkSyncTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      // Get all unsynced transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          associationId,
          accountingSynced: false,
        } as any,
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true, type: true } },
        },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const transaction of transactions) {
        try {
          await accountingIntegrationService.onTransactionCreated(transaction, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({
            transactionId: transaction.id,
            referenceNumber: transaction.referenceNumber,
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} transactions, ${failed} failed`,
        data: {
          total: transactions.length,
          synced,
          failed,
          errors: errors.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('Error bulk syncing transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync transactions' });
    }
  },

  /**
   * Bulk sync unsynced payments
   * POST /api/accounting/sync/payments/bulk
   */
  async bulkSyncPayments(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      // Get all unsynced payments
      const payments = await prisma.payment.findMany({
        where: {
          associationId,
          accountingSynced: false,
        } as any,
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const payment of payments) {
        try {
          await accountingIntegrationService.onPaymentRecorded(payment, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({
            paymentId: payment.id,
            receiptNumber: payment.receiptNumber,
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} payments, ${failed} failed`,
        data: {
          total: payments.length,
          synced,
          failed,
          errors: errors.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('Error bulk syncing payments:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync payments' });
    }
  },

  /**
   * Bulk sync unsynced welfare contributions
   * POST /api/accounting/sync/welfare-contributions/bulk
   */
  async bulkSyncWelfareContributions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      const contributions = await prisma.welfareContribution.findMany({
        where: { associationId, status: 'CONFIRMED', accountingSynced: false } as any,
        include: { fund: { select: { id: true, name: true } } },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const contribution of contributions) {
        try {
          await accountingIntegrationService.onWelfareContributionConfirmed(contribution, contribution.fund, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({ contributionId: contribution.id, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} welfare contributions, ${failed} failed`,
        data: { total: contributions.length, synced, failed, errors: errors.slice(0, 10) },
      });
    } catch (error) {
      console.error('Error bulk syncing welfare contributions:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync welfare contributions' });
    }
  },

  /**
   * Bulk sync unsynced welfare payouts
   * POST /api/accounting/sync/welfare-payouts/bulk
   */
  async bulkSyncWelfarePayouts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      const payouts = await prisma.welfarePayoutRequest.findMany({
        where: { associationId, status: 'DISBURSED', accountingSynced: false } as any,
        include: { fund: { select: { id: true, name: true } } },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const payout of payouts) {
        try {
          await accountingIntegrationService.onWelfarePayoutDisbursed(payout, payout.fund, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({ payoutId: payout.id, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} welfare payouts, ${failed} failed`,
        data: { total: payouts.length, synced, failed, errors: errors.slice(0, 10) },
      });
    } catch (error) {
      console.error('Error bulk syncing welfare payouts:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync welfare payouts' });
    }
  },

  /**
   * Bulk sync unsynced cooperative savings transactions
   * POST /api/accounting/sync/savings-transactions/bulk
   */
  async bulkSyncSavingsTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      // Only DEPOSIT/WITHDRAWAL are ever synced (same scope the real-time path covers) —
      // INTEREST/TRANSFER_IN/TRANSFER_OUT/FEE have no accounting mapping today.
      const transactions = await prisma.savingsTransaction.findMany({
        where: {
          associationId,
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
          accountingSynced: false,
        } as any,
        include: {
          savingsAccount: {
            include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
          },
        },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const transaction of transactions) {
        try {
          if (transaction.type === 'DEPOSIT') {
            await accountingIntegrationService.onSavingsDeposit(transaction, transaction.savingsAccount, req.user!.id);
          } else {
            await accountingIntegrationService.onSavingsWithdrawal(transaction, transaction.savingsAccount, req.user!.id);
          }
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({ transactionId: transaction.id, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} savings transactions, ${failed} failed`,
        data: { total: transactions.length, synced, failed, errors: errors.slice(0, 10) },
      });
    } catch (error) {
      console.error('Error bulk syncing savings transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync savings transactions' });
    }
  },

  /**
   * Bulk sync unsynced loans (disbursed)
   * POST /api/accounting/sync/loans/bulk
   */
  async bulkSyncLoans(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      const loans = await prisma.loan.findMany({
        where: { associationId, accountingSynced: false } as any,
        include: { application: true },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const loan of loans) {
        try {
          await accountingIntegrationService.onLoanDisbursed(loan, loan.application, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({ loanId: loan.id, loanNumber: loan.loanNumber, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} loans, ${failed} failed`,
        data: { total: loans.length, synced, failed, errors: errors.slice(0, 10) },
      });
    } catch (error) {
      console.error('Error bulk syncing loans:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync loans' });
    }
  },

  /**
   * Bulk sync unsynced loan repayments
   * POST /api/accounting/sync/loan-repayments/bulk
   */
  async bulkSyncLoanRepayments(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      const repayments = await prisma.loanRepayment.findMany({
        where: { associationId, accountingSynced: false } as any,
        include: { loan: true },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const repayment of repayments) {
        try {
          await accountingIntegrationService.onLoanRepayment(repayment, repayment.loan, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({ repaymentId: repayment.id, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} loan repayments, ${failed} failed`,
        data: { total: repayments.length, synced, failed, errors: errors.slice(0, 10) },
      });
    } catch (error) {
      console.error('Error bulk syncing loan repayments:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync loan repayments' });
    }
  },

  /**
   * Get sync error logs
   * GET /api/accounting/sync/errors
   */
  async getSyncErrors(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');

      const errors = await prisma.auditLog.findMany({
        where: {
          associationId,
          action: 'ACCOUNTING_SYNC_FAILED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });

      // Only what an officer needs to act on: what failed, and the plain reason. The stack trace the log keeps is never sent.
      const rows = errors.map((row) => ({
        id: row.id,
        tableName: row.tableName,
        recordId: row.recordId,
        message: String((row.newValues as { error?: unknown } | null)?.error ?? 'Unknown error').slice(0, 300),
        newValues: { error: String((row.newValues as { error?: unknown } | null)?.error ?? 'Unknown error').slice(0, 300) },
        createdAt: row.createdAt,
      }));

      return res.status(200).json({
        success: true,
        data: rows,
      });
    } catch (error) {
      console.error('Error getting sync errors:', error);
      return res.status(500).json({ success: false, message: 'Failed to get sync errors' });
    }
  },

  // ==========================================
  // TASK-ACC-009: Accounting Dashboard
  // ==========================================

  /**
   * Get accounting dashboard
   * GET /api/accounting/dashboard
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const dashboard = await accountingService.getDashboard(associationId);

      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error getting accounting dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to get accounting dashboard' });
    }
  },
};
