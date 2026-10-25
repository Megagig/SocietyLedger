import { Router } from 'express';
import multer from 'multer';
import { cooperativesController } from './cooperatives.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// The deposit receipt goes to memory; the controller streams the buffer to storage right after, so no file
// ever lands on the server's disk (same as payment proofs).
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  },
});

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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_VIEW, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_VIEW, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_VIEW, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getSavingsTransactions
);

/**
 * Process a savings transaction (deposit/withdrawal)
 * POST /api/cooperatives/savings-transactions
 */
router.post(
  '/savings-transactions',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.processSavingsTransaction
);

// ==========================================
// SAVINGS DEPOSIT REQUEST ROUTES
// A member declares a deposit with a receipt; an officer approves it, which is what credits the balance.
// ==========================================

router.post(
  '/savings-deposits',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_DEPOSIT_OWN),
  receiptUpload.single('file'),
  cooperativesController.createSavingsDeposit
);

router.get(
  '/savings-deposits',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getSavingsDeposits
);

router.get(
  '/savings-deposits/:id/receipt',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getSavingsDepositReceipt
);

router.post(
  '/savings-deposits/:id/approve',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.approveSavingsDeposit
);

router.post(
  '/savings-deposits/:id/reject',
  requirePermission(PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE),
  cooperativesController.rejectSavingsDeposit
);

// ==========================================
// LOAN REPAYMENT REQUEST ROUTES
// A member declares a repayment with a receipt; an officer confirms it, which is what records the repayment.
// ==========================================

router.post(
  '/loan-repayment-requests',
  requirePermission(PERMISSIONS.COOPERATIVE_REPAY_OWN),
  receiptUpload.single('file'),
  cooperativesController.createLoanRepaymentRequest
);

router.get(
  '/loan-repayment-requests',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getLoanRepaymentRequests
);

router.get(
  '/loan-repayment-requests/:id/receipt',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getLoanRepaymentRequestReceipt
);

router.post(
  '/loan-repayment-requests/:id/approve',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.approveLoanRepaymentRequest
);

router.post(
  '/loan-repayment-requests/:id/reject',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.rejectLoanRepaymentRequest
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getLoanApplications
);

/**
 * Create a loan application (members can apply)
 * POST /api/cooperatives/loan-applications
 */
router.post(
  '/loan-applications',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_APPLY, PERMISSIONS.COOPERATIVE_APPLY_OWN]),
  cooperativesController.createLoanApplication
);

/**
 * Get a single loan application
 * GET /api/cooperatives/loan-applications/:id
 */
router.get(
  '/loan-applications/:id',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
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
  '/guarantor-candidates',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_APPLY, PERMISSIONS.COOPERATIVE_APPLY_OWN]),
  cooperativesController.getGuarantorCandidates
);

router.get(
  '/guarantor-requests/pending',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_GUARANTOR, PERMISSIONS.COOPERATIVE_GUARANTOR_OWN]),
  cooperativesController.getPendingGuarantorRequests
);

/**
 * Respond to a guarantor request
 * POST /api/cooperatives/guarantor-requests/:id/respond
 */
router.post(
  '/guarantor-requests/:id/respond',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_GUARANTOR, PERMISSIONS.COOPERATIVE_GUARANTOR_OWN]),
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getLoans
);

/**
 * Get a single loan
 * GET /api/cooperatives/loans/:id
 */
router.get(
  '/loans/:id',
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
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
  requireAnyPermission([PERMISSIONS.COOPERATIVE_LOANS_VIEW, PERMISSIONS.COOPERATIVE_LOANS_MANAGE, PERMISSIONS.COOPERATIVE_VIEW_OWN]),
  cooperativesController.getLoanRepayments
);

/**
 * Process a loan repayment (members can pay their own loans)
 * POST /api/cooperatives/loan-repayments
 */
router.post(
  '/loan-repayments',
  requirePermission(PERMISSIONS.COOPERATIVE_LOANS_MANAGE),
  cooperativesController.processLoanRepayment
);

export default router;
