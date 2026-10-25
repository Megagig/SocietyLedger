// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES ROUTES
// ============================================

import { NextFunction, Request, Response, Router } from 'express';
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

// Statements are CSV or Excel files. The type is decided from the file's contents (statement-file.ts), not from what the client says.
const statementUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
function receiveStatement(req: Request, res: Response, next: NextFunction) {
  statementUpload.single('file')(req, res, (error: unknown) => {
    if (!error) return next();
    const tooBig = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({ success: false, code: tooBig ? 'FILE_TOO_LARGE' : 'BAD_UPLOAD', message: tooBig ? 'The file is larger than 5 MB.' : 'The file could not be uploaded.' });
  });
}

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ==========================================
// UTILITY ROUTES
// ==========================================

// Get list of Nigerian banks — a static reference list, needed by anyone who adds a bank account or records a transfer
router.get('/banks',
  requireAnyPermission([PERMISSIONS.FINANCE_VIEW, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE]),
  nigerianPaymentsController.getNigerianBanks
);

// ==========================================
// BANK ACCOUNT ROUTES (TASK-PAY-002)
// ==========================================

// Bank accounts are the association's payment details, so the officers who record payments (treasurer, financial secretary)
// can manage them as well as the administrator who holds settings.edit. Viewing is open to anyone who handles payments.

// List all bank accounts
router.get('/bank-accounts',
  requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.PAYMENT_RECORD, PERMISSIONS.PAYMENT_VIEW]),
  nigerianPaymentsController.listBankAccounts
);

// Get single bank account
router.get('/bank-accounts/:id',
  requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.PAYMENT_RECORD, PERMISSIONS.PAYMENT_VIEW]),
  nigerianPaymentsController.getBankAccountById
);

// Create bank account
router.post('/bank-accounts',
  requireAnyPermission([PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]),
  nigerianPaymentsController.createBankAccount
);

// Update bank account
router.patch('/bank-accounts/:id',
  requireAnyPermission([PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]),
  nigerianPaymentsController.updateBankAccount
);

// Delete bank account
router.delete('/bank-accounts/:id',
  requireAnyPermission([PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]),
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

// Preview a statement: what would be imported, and how its columns were read. Saves nothing.
router.post('/import-statement/preview',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  receiveStatement,
  nigerianPaymentsController.previewStatement
);

// Import a bank statement (CSV or Excel upload). Lines imported before are skipped.
router.post('/import-statement',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  receiveStatement,
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

// Ranked suggestions: each unmatched bank line with the charge it most likely paid
router.get('/reconciliation/suggestions',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  nigerianPaymentsController.getMatchSuggestions
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
