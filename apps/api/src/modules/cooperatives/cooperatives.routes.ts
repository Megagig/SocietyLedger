import { Router } from 'express';
import { cooperativesController } from './cooperatives.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// COOPERATIVES ROUTES - Phase 8.5
// Enterprise Feature - Thrift & Savings, Loans, Guarantors
// ============================================

// ==========================================
// DASHBOARD ROUTES
// ==========================================

/**
 * Get cooperative dashboard
 * GET /api/cooperatives/dashboard
 */
router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getDashboard
);

/**
 * Get current user's cooperative profile
 * GET /api/cooperatives/my-profile
 */
router.get(
  '/my-profile',
  cooperativesController.getMyCooperativeProfile
);

/**
 * Get member's cooperative profile
 * GET /api/cooperatives/members/:id/profile
 */
router.get(
  '/members/:id/profile',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  cooperativesController.getMemberCooperativeProfile
);

// ==========================================
// SAVINGS ACCOUNT ROUTES
// ==========================================

/**
 * Get savings accounts
 * GET /api/cooperatives/savings-accounts
 */
router.get(
  '/savings-accounts',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getSavingsAccounts
);

/**
 * Create a savings account
 * POST /api/cooperatives/savings-accounts
 */
router.post(
  '/savings-accounts',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  cooperativesController.createSavingsAccount
);

/**
 * Get a single savings account
 * GET /api/cooperatives/savings-accounts/:id
 */
router.get(
  '/savings-accounts/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
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
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getSavingsTransactions
);

/**
 * Process a savings transaction (deposit/withdrawal)
 * POST /api/cooperatives/savings-transactions
 */
router.post(
  '/savings-transactions',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  cooperativesController.processSavingsTransaction
);

// ==========================================
// LOAN PRODUCT ROUTES
// ==========================================

/**
 * Get loan products
 * GET /api/cooperatives/loan-products
 */
router.get(
  '/loan-products',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getLoanProducts
);

/**
 * Create a loan product
 * POST /api/cooperatives/loan-products
 */
router.post(
  '/loan-products',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  cooperativesController.createLoanProduct
);

/**
 * Update a loan product
 * PUT /api/cooperatives/loan-products/:id
 */
router.put(
  '/loan-products/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  cooperativesController.updateLoanProduct
);

// ==========================================
// LOAN APPLICATION ROUTES
// ==========================================

/**
 * Get loan applications
 * GET /api/cooperatives/loan-applications
 */
router.get(
  '/loan-applications',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getLoanApplications
);

/**
 * Create a loan application
 * POST /api/cooperatives/loan-applications
 */
router.post(
  '/loan-applications',
  cooperativesController.createLoanApplication
);

/**
 * Get a single loan application
 * GET /api/cooperatives/loan-applications/:id
 */
router.get(
  '/loan-applications/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getLoanApplication
);

/**
 * Review a loan application (approve/reject)
 * POST /api/cooperatives/loan-applications/:id/review
 */
router.post(
  '/loan-applications/:id/review',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  cooperativesController.reviewLoanApplication
);

/**
 * Disburse an approved loan
 * POST /api/cooperatives/loan-applications/:id/disburse
 */
router.post(
  '/loan-applications/:id/disburse',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
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
  cooperativesController.getPendingGuarantorRequests
);

/**
 * Respond to a guarantor request
 * POST /api/cooperatives/guarantor-requests/:id/respond
 */
router.post(
  '/guarantor-requests/:id/respond',
  cooperativesController.respondToGuarantorRequest
);

// ==========================================
// LOAN ROUTES
// ==========================================

/**
 * Get active loans
 * GET /api/cooperatives/loans
 */
router.get(
  '/loans',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getLoans
);

/**
 * Get a single loan
 * GET /api/cooperatives/loans/:id
 */
router.get(
  '/loans/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
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
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  cooperativesController.getLoanRepayments
);

/**
 * Process a loan repayment
 * POST /api/cooperatives/loan-repayments
 */
router.post(
  '/loan-repayments',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  cooperativesController.processLoanRepayment
);

export default router;
