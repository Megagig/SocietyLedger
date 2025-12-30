import { Router } from 'express';
import { accountingController } from './accounting.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router = Router();

// Apply auth middleware to all routes
// Note: Tenant context comes from authenticated user's associationId (set by authMiddleware)
router.use(authMiddleware);

// Phase 19: Apply module check to all accounting routes
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('accounting'));

// ==========================================
// CHART OF ACCOUNTS ROUTES (TASK-ACC-001)
// ==========================================

/**
 * Initialize standard chart of accounts
 * POST /api/accounting/chart-of-accounts/initialize
 */
router.post(
  '/chart-of-accounts/initialize',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.initializeChartOfAccounts
);

/**
 * Get chart of accounts
 * GET /api/accounting/chart-of-accounts
 * Query params: type, isActive, includeBalances, hierarchical
 */
router.get(
  '/chart-of-accounts',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getChartOfAccounts
);

/**
 * Create a new account
 * POST /api/accounting/chart-of-accounts
 */
router.post(
  '/chart-of-accounts',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.createAccount
);

/**
 * Update an account
 * PUT /api/accounting/chart-of-accounts/:id
 */
router.put(
  '/chart-of-accounts/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  accountingController.updateAccount
);

/**
 * Delete an account
 * DELETE /api/accounting/chart-of-accounts/:id
 */
router.delete(
  '/chart-of-accounts/:id',
  requirePermission(PERMISSIONS.FINANCE_DELETE),
  accountingController.deleteAccount
);

// ==========================================
// JOURNAL ENTRY ROUTES (TASK-ACC-002, TASK-ACC-007)
// ==========================================

/**
 * Get journal entries
 * GET /api/accounting/journal-entries
 * Query params: page, limit, status, startDate, endDate, search, sortBy, sortOrder
 */
router.get(
  '/journal-entries',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getJournalEntries
);

/**
 * Create a journal entry
 * POST /api/accounting/journal-entries
 */
router.post(
  '/journal-entries',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.createJournalEntry
);

/**
 * Get a single journal entry
 * GET /api/accounting/journal-entries/:id
 */
router.get(
  '/journal-entries/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getJournalEntry
);

/**
 * Update a journal entry
 * PUT /api/accounting/journal-entries/:id
 */
router.put(
  '/journal-entries/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  accountingController.updateJournalEntry
);

/**
 * Submit entry for approval
 * POST /api/accounting/journal-entries/:id/submit
 */
router.post(
  '/journal-entries/:id/submit',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.submitForApproval
);

/**
 * Approve or reject a journal entry
 * POST /api/accounting/journal-entries/:id/approval
 */
router.post(
  '/journal-entries/:id/approval',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  accountingController.processApproval
);

/**
 * Post an approved journal entry
 * POST /api/accounting/journal-entries/:id/post
 */
router.post(
  '/journal-entries/:id/post',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  accountingController.postJournalEntry
);

// ==========================================
// FINANCIAL STATEMENT ROUTES (TASK-ACC-003, 004, 005)
// ==========================================

/**
 * Get Income Statement (P&L)
 * GET /api/accounting/income-statement
 * Query params: period, startDate, endDate, includeComparison
 */
router.get(
  '/income-statement',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getIncomeStatement
);

/**
 * Get Balance Sheet
 * GET /api/accounting/balance-sheet
 * Query params: asOfDate
 */
router.get(
  '/balance-sheet',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getBalanceSheet
);

/**
 * Get Cash Flow Statement
 * GET /api/accounting/cash-flow
 * Query params: period, startDate, endDate
 */
router.get(
  '/cash-flow',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getCashFlowStatement
);

// ==========================================
// BUDGET ROUTES (TASK-ACC-006)
// ==========================================

/**
 * Get budgets
 * GET /api/accounting/budgets
 * Query params: page, limit, fiscalYear, status
 */
router.get(
  '/budgets',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getBudgets
);

/**
 * Create a budget
 * POST /api/accounting/budgets
 */
router.post(
  '/budgets',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.createBudget
);

/**
 * Get a single budget
 * GET /api/accounting/budgets/:id
 */
router.get(
  '/budgets/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getBudget
);

/**
 * Update a budget
 * PUT /api/accounting/budgets/:id
 */
router.put(
  '/budgets/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  accountingController.updateBudget
);

/**
 * Approve a budget
 * POST /api/accounting/budgets/:id/approve
 */
router.post(
  '/budgets/:id/approve',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  accountingController.approveBudget
);

/**
 * Activate a budget
 * POST /api/accounting/budgets/:id/activate
 */
router.post(
  '/budgets/:id/activate',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  accountingController.activateBudget
);

/**
 * Get budget variance report
 * GET /api/accounting/budgets/:id/variance
 * Query params: startDate, endDate
 */
router.get(
  '/budgets/:id/variance',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getBudgetVariance
);

// ==========================================
// SYNC ROUTES (TASK-ACC-008)
// ==========================================

/**
 * Sync a transaction to accounting
 * POST /api/accounting/sync/transaction/:id
 */
router.post(
  '/sync/transaction/:id',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.syncTransaction
);

/**
 * Sync a payment to accounting
 * POST /api/accounting/sync/payment/:id
 */
router.post(
  '/sync/payment/:id',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  accountingController.syncPayment
);

// ==========================================
// DASHBOARD ROUTE (TASK-ACC-009)
// ==========================================

/**
 * Get accounting dashboard
 * GET /api/accounting/dashboard
 */
router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  accountingController.getDashboard
);

export default router;
