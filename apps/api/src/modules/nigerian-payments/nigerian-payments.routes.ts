// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES ROUTES
// ============================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nigerianPaymentsController } from './nigerian-payments.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payment-proofs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
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

// Upload payment proof (member action)
router.post('/proofs',
  requireAnyPermission([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_VIEW]),
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

// ==========================================
// DASHBOARD ROUTES (TASK-PAY-006)
// ==========================================

// Get unmatched payments dashboard
router.get('/unmatched-dashboard',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  nigerianPaymentsController.getUnmatchedPaymentsDashboard
);

export default router;
