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
      return res.status(400).json({ success: false, message: error.message });
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
      const account = await accountingService.createAccount(associationId, data);

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
      return res.status(400).json({ success: false, message: error.message });
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
      const account = await accountingService.updateAccount(associationId, accountId, data);

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
      return res.status(400).json({ success: false, message: error.message });
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
      await accountingService.deleteAccount(associationId, accountId);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      return res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: error.message });
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

      return res.status(200).json({
        success: true,
        data: entry,
      });
    } catch (error) {
      console.error('Error getting journal entry:', error);
      return res.status(500).json({ success: false, message: 'Failed to get journal entry' });
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
      const entry = await accountingService.updateJournalEntry(associationId, entryId, data);

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
      return res.status(400).json({ success: false, message: error.message });
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
      const entry = await accountingService.submitForApproval(associationId, entryId);

      return res.status(200).json({
        success: true,
        message: 'Journal entry submitted for approval',
        data: entry,
      });
    } catch (error: any) {
      console.error('Error submitting journal entry:', error);
      return res.status(400).json({ success: false, message: error.message });
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
        message: `Journal entry ${action}d successfully`,
        data: entry,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error processing approval:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Post an approved journal entry
   * POST /api/accounting/journal-entries/:id/post
   */
  async postJournalEntry(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const entryId = parseInt(req.params.id);
      const entry = await accountingService.postJournalEntry(associationId, entryId);

      return res.status(200).json({
        success: true,
        message: 'Journal entry posted successfully',
        data: entry,
      });
    } catch (error: any) {
      console.error('Error posting journal entry:', error);
      return res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: error.message });
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
      const budget = await accountingService.updateBudget(associationId, budgetId, data);

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
      return res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: error.message });
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
      const budget = await accountingService.activateBudget(associationId, budgetId);

      return res.status(200).json({
        success: true,
        message: 'Budget activated successfully',
        data: budget,
      });
    } catch (error: any) {
      console.error('Error activating budget:', error);
      return res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // ==========================================
  // TASK-ACC-008: Auto-sync Transactions
  // ==========================================

  /**
   * Sync a transaction to accounting
   * POST /api/accounting/sync/transaction/:id
   */
  async syncTransaction(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const transactionId = parseInt(req.params.id);
      const entry = await accountingService.syncTransactionToAccounting(associationId, transactionId, userId);

      return res.status(201).json({
        success: true,
        message: 'Transaction synced to accounting successfully',
        data: entry,
      });
    } catch (error: any) {
      console.error('Error syncing transaction:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Sync a payment to accounting
   * POST /api/accounting/sync/payment/:id
   */
  async syncPayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const paymentId = parseInt(req.params.id);
      const entry = await accountingService.syncPaymentToAccounting(associationId, paymentId, userId);

      return res.status(201).json({
        success: true,
        message: 'Payment synced to accounting successfully',
        data: entry,
      });
    } catch (error: any) {
      console.error('Error syncing payment:', error);
      return res.status(400).json({ success: false, message: error.message });
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
