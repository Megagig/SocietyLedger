import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Phase 19: Apply module check to all reports routes
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('reports'));

// ==========================================
// REPORT ROUTES
// ==========================================

/**
 * TASK-REP-002: Financial Summary Report
 * GET /api/reports/financial-summary
 * Query params: period, startDate, endDate, includeComparison
 */
router.get(
  '/financial-summary',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  reportsController.getFinancialSummary
);

/**
 * TASK-REP-003: Member Payment Status Report
 * GET /api/reports/member-balances
 * Query params: page, limit, status, search, sortBy, sortOrder
 */
router.get(
  '/member-balances',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  reportsController.getMemberBalances
);

/**
 * TASK-REP-004: Outstanding Balances with Aging Analysis
 * GET /api/reports/aging-analysis
 * Query params: asOfDate, includeDetails
 */
router.get(
  '/aging-analysis',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  reportsController.getAgingAnalysis
);

/**
 * TASK-REP-005: Collection Rate Report
 * GET /api/reports/collection-rate
 * Query params: period, startDate, endDate, groupBy
 */
router.get(
  '/collection-rate',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  reportsController.getCollectionRate
);

/**
 * TASK-REP-006: Category-wise Report
 * GET /api/reports/by-category
 * Query params: categoryId, type, startDate, endDate, includeTransactions, transactionLimit
 */
router.get(
  '/by-category',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  reportsController.getCategoryReport
);

/**
 * The records behind a figure: GET /api/reports/charges and GET /api/reports/payments take the same filters as the reports and
 * return totals that equal the figure tapped. Same permission as the reports.
 */
router.get('/charges', requirePermission(PERMISSIONS.FINANCE_VIEW), reportsController.listCharges);
router.get('/payments', requirePermission(PERMISSIONS.FINANCE_VIEW), reportsController.listPayments);

export default router;
