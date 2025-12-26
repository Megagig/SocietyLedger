import { Router } from 'express';
import { financeController } from './finance.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ==========================================
// DASHBOARD
// ==========================================
router.get('/dashboard',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  financeController.getDashboard
);

// ==========================================
// CATEGORY ROUTES
// ==========================================

// Get category statistics
router.get('/categories/stats',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  financeController.getCategoryStats
);

// List all categories
router.get('/categories',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  financeController.listCategories
);

// Get single category
router.get('/categories/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  financeController.getCategoryById
);

// Create category
router.post('/categories',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  financeController.createCategory
);

// Update category
router.patch('/categories/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  financeController.updateCategory
);

// Delete category
router.delete('/categories/:id',
  requirePermission(PERMISSIONS.FINANCE_DELETE),
  financeController.deleteCategory
);

// ==========================================
// TRANSACTION ROUTES
// ==========================================

// Get transaction statistics
router.get('/transactions/stats',
  requirePermission(PERMISSIONS.TRANSACTION_VIEW),
  financeController.getTransactionStats
);

// List all transactions
router.get('/transactions',
  requirePermission(PERMISSIONS.TRANSACTION_VIEW),
  financeController.listTransactions
);

// Get single transaction
router.get('/transactions/:id',
  requirePermission(PERMISSIONS.TRANSACTION_VIEW),
  financeController.getTransactionById
);

// Create transaction
router.post('/transactions',
  requirePermission(PERMISSIONS.TRANSACTION_CREATE),
  financeController.createTransaction
);

// Bulk create transactions (assign to multiple members)
router.post('/transactions/bulk',
  requirePermission(PERMISSIONS.TRANSACTION_CREATE),
  financeController.bulkCreateTransactions
);

// Update transaction
router.patch('/transactions/:id',
  requirePermission(PERMISSIONS.TRANSACTION_EDIT),
  financeController.updateTransaction
);

// Delete transaction
router.delete('/transactions/:id',
  requirePermission(PERMISSIONS.TRANSACTION_DELETE),
  financeController.deleteTransaction
);

// ==========================================
// PAYMENT ROUTES
// ==========================================

// List payments
router.get('/payments',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  financeController.listPayments
);

// Record payment
router.post('/payments',
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  financeController.recordPayment
);

// Bulk mark as paid
router.post('/payments/bulk',
  requireAnyPermission([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_CONFIRM]),
  financeController.bulkMarkPaid
);

// ==========================================
// MEMBER FINANCIAL ROUTES
// ==========================================

// Get member's financial summary
router.get('/members/:memberId/summary',
  requireAnyPermission([PERMISSIONS.FINANCE_VIEW, PERMISSIONS.MEMBER_VIEW]),
  financeController.getMemberFinancialSummary
);

// ==========================================
// REMINDER ROUTES
// ==========================================

// Get members with pending payments for reminder selection
router.get('/reminders/members',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  financeController.getMembersForReminders
);

// Send payment reminders
router.post('/reminders/send',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  financeController.sendPaymentReminders
);

// Update overdue status for transactions
router.post('/reminders/update-overdue',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  financeController.updateOverdueStatus
);

export default router;
