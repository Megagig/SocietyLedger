import { Router } from 'express';
import { cooperativesController } from './cooperatives.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Phase 19: Apply module check to all cooperatives routes (Enterprise tier)
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('cooperatives'));

// ============================================
// COOPERATIVES ROUTES - Phase 8.5
// Enterprise Feature - Thrift & Savings, Loans, Guarantors
// ============================================

// ==========================================
// DASHBOARD ROUTES
// ==========================================

/**
 * Get cooperative dashboard (admin view)
 * GET /api/cooperatives/dashboard
 */
router.get(
  '/dashboard',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getDashboard
);

/**
 * Get current user's cooperative profile (member view)
 * GET /api/cooperatives/my-profile
 */
router.get(
  '/my-profile',
  requirePermission(PERMISSIONS.COOPERATIVE_VIEW),
  cooperativesController.getMyCooperativeProfile
);

/**
 * Get member's cooperative profile (admin view)
 * GET /api/cooperatives/members/:id/profile
 */
router.get(
  '/members/:id/profile',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.getMemberCooperativeProfile
);

// ==========================================
// SAVINGS ACCOUNT ROUTES
// ==========================================

/**
 * Get all savings accounts (admin view)
 * GET /api/cooperatives/savings-accounts
 */
router.get(
  '/savings-accounts',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.getSavingsAccounts
);

/**
 * Create a savings account (admin only)
 * POST /api/cooperatives/savings-accounts
 */
router.post(
  '/savings-accounts',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.createSavingsAccount
);

/**
 * Get a single savings account
 * GET /api/cooperatives/savings-accounts/:id
 */
router.get(
  '/savings-accounts/:id',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_VIEW, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE]),
  cooperativesController.getSavingsAccount
);

// ==========================================
// SAVINGS TRANSACTION ROUTES
// ==========================================

/**
 * Get savings transactions
 * GET /api/cooperatives/savings-transactions
 */
router.get(
  '/savings-transactions',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_VIEW, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE]),
  cooperativesController.getSavingsTransactions
);

/**
 * Process a savings transaction (deposit/withdrawal)
 * POST /api/cooperatives/savings-transactions
 */
router.post(
  '/savings-transactions',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_VIEW, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE]),
  cooperativesController.processSavingsTransaction
);

// ==========================================
// LOAN PRODUCT ROUTES
// ==========================================

/**
 * Get loan products (all users can view active products)
 * GET /api/cooperatives/loan-products
 */
router.get(
  '/loan-products',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoanProducts
);

/**
 * Create a loan product (admin only)
 * POST /api/cooperatives/loan-products
 */
router.post(
  '/loan-products',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.createLoanProduct
);

/**
 * Update a loan product (admin only)
 * PUT /api/cooperatives/loan-products/:id
 */
router.put(
  '/loan-products/:id',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.updateLoanProduct
);

// ==========================================
// LOAN APPLICATION ROUTES
// ==========================================

/**
 * Get loan applications (admin sees all, member sees own)
 * GET /api/cooperatives/loan-applications
 */
router.get(
  '/loan-applications',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoanApplications
);

/**
 * Create a loan application (members can apply)
 * POST /api/cooperatives/loan-applications
 */
router.post(
  '/loan-applications',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_APPLY),
  cooperativesController.createLoanApplication
);

/**
 * Get a single loan application
 * GET /api/cooperatives/loan-applications/:id
 */
router.get(
  '/loan-applications/:id',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoanApplication
);

/**
 * Review a loan application (approve/reject) - admin only
 * POST /api/cooperatives/loan-applications/:id/review
 */
router.post(
  '/loan-applications/:id/review',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.reviewLoanApplication
);

/**
 * Disburse an approved loan - admin only
 * POST /api/cooperatives/loan-applications/:id/disburse
 */
router.post(
  '/loan-applications/:id/disburse',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.disburseLoan
);

// ==========================================
// GUARANTOR ROUTES
// ==========================================

/**
 * Get pending guarantor requests for current user
 * GET /api/cooperatives/guarantor-requests/pending
 */
router.get(
  '/guarantor-requests/pending',
  requirePermission(PERMISSIONS.COOPERATIVE_GUARANTOR),
  cooperativesController.getPendingGuarantorRequests
);

/**
 * Respond to a guarantor request
 * POST /api/cooperatives/guarantor-requests/:id/respond
 */
router.post(
  '/guarantor-requests/:id/respond',
  requirePermission(PERMISSIONS.COOPERATIVE_GUARANTOR),
  cooperativesController.respondToGuarantorRequest
);

// ==========================================
// LOAN ROUTES
// ==========================================

/**
 * Get active loans (admin sees all, member sees own)
 * GET /api/cooperatives/loans
 */
router.get(
  '/loans',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoans
);

/**
 * Get a single loan
 * GET /api/cooperatives/loans/:id
 */
router.get(
  '/loans/:id',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoan
);

// ==========================================
// LOAN REPAYMENT ROUTES
// ==========================================

/**
 * Get loan repayments
 * GET /api/cooperatives/loan-repayments
 */
router.get(
  '/loan-repayments',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.getLoanRepayments
);

/**
 * Process a loan repayment (members can pay their own loans)
 * POST /api/cooperatives/loan-repayments
 */
router.post(
  '/loan-repayments',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE]),
  cooperativesController.processLoanRepayment
);

export default router;
