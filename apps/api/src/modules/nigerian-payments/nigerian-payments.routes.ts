// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES ROUTES
// ============================================

import { Router } from 'express';
import multer from 'multer';
import { nigerianPaymentsController } from './nigerian-payments.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Files go to memory — the controller streams the buffer to MinIO immediately
// after. No file ever lands on the server's local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  },
});

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ==========================================
// UTILITY ROUTES
// ==========================================

// Get list of Nigerian banks
router.get('/banks',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.getNigerianBanks
);

// ==========================================
// BANK ACCOUNT ROUTES (TASK-PAY-002)
// ==========================================

// List all bank accounts
router.get('/bank-accounts',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  nigerianPaymentsController.listBankAccounts
);

// Get single bank account
router.get('/bank-accounts/:id',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  nigerianPaymentsController.getBankAccountById
);

// Create bank account
router.post('/bank-accounts',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  nigerianPaymentsController.createBankAccount
);

// Update bank account
router.patch('/bank-accounts/:id',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  nigerianPaymentsController.updateBankAccount
);

// Delete bank account
router.delete('/bank-accounts/:id',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  nigerianPaymentsController.deleteBankAccount
);

// ==========================================
// BANK TRANSFER ROUTES (TASK-PAY-001)
// ==========================================

// List all bank transfers
router.get('/bank-transfers',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  nigerianPaymentsController.listBankTransfers
);

// Get single bank transfer
router.get('/bank-transfers/:id',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  nigerianPaymentsController.getBankTransferById
);

// Record new bank transfer
router.post('/bank-transfers',
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  nigerianPaymentsController.createBankTransfer
);

// Update bank transfer
router.patch('/bank-transfers/:id',
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  nigerianPaymentsController.updateBankTransfer
);

// Verify bank transfer (admin action)
router.post('/bank-transfers/:id/verify',
  requirePermission(PERMISSIONS.PAYMENT_CONFIRM),
  nigerianPaymentsController.verifyBankTransfer
);

// ==========================================
// BANK STATEMENT IMPORT ROUTES (TASK-PAY-005)
// ==========================================

// Import bank statement
router.post('/import-statement',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  nigerianPaymentsController.importBankStatement
);

// List statement imports
router.get('/statement-imports',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.listStatementImports
);

// List statement entries
router.get('/statement-entries',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.listStatementEntries
);

// ==========================================
// RECONCILIATION ROUTES (TASK-PAY-003)
// ==========================================

// Reconcile payment
router.post('/reconcile',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  nigerianPaymentsController.reconcilePayment
);

// Confirm reconciliation
router.post('/reconciliations/:id/confirm',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  nigerianPaymentsController.confirmReconciliation
);

// List reconciliations
router.get('/reconciliations',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.listReconciliations
);

// ==========================================
// AUTO-MATCHING ROUTES (TASK-PAY-004)
// ==========================================

// Run auto-matching
router.post('/auto-match',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  nigerianPaymentsController.autoMatchTransactions
);

// Apply auto-matches
router.post('/auto-match/apply',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  nigerianPaymentsController.applyAutoMatches
);

// ==========================================
// PAYMENT PROOF ROUTES (TASK-PAY-007, TASK-PAY-008)
// ==========================================

// Upload payment proof (member action). R7.2 (G17): added PAYMENTS_VIEW_OWN — the
// real `member` role only ever holds payments.view_own, not PAYMENT_CREATE/PAYMENT_VIEW
// (officer-level), so this endpoint was unreachable for any real member despite being
// built as "a member action" (see the comment above).
router.post('/proofs',
  requireAnyPermission([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  upload.single('file'),
  nigerianPaymentsController.uploadPaymentProof
);

// List payment proofs
router.get('/proofs',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  nigerianPaymentsController.listPaymentProofs
);

// Get single payment proof
router.get('/proofs/:id',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  nigerianPaymentsController.getPaymentProofById
);

// Verify payment proof (admin action)
router.post('/proofs/:id/verify',
  requirePermission(PERMISSIONS.PAYMENT_CONFIRM),
  nigerianPaymentsController.verifyPaymentProof
);

// Generate presigned download URL for a proof file — redirects browser to MinIO
router.get('/proofs/:id/download',
  requireAnyPermission([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  nigerianPaymentsController.downloadPaymentProof
);

// Same short-lived link, as JSON — for the mobile app, which can't follow the redirect above with its auth header.
// A member only gets the link to a proof they submitted themselves (enforced in the controller).
router.get('/proofs/:id/file-url',
  requireAnyPermission([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  nigerianPaymentsController.getPaymentProofFileUrl
);

// ==========================================
// DASHBOARD ROUTES (TASK-PAY-006)
// ==========================================

// Get unmatched payments dashboard
router.get('/unmatched-dashboard',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.getUnmatchedPaymentsDashboard
);

export default router;
