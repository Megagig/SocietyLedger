import { Router } from 'express';
import { memberFinanceController } from './member-finance.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// All routes require MEMBER_FINANCE_VIEW permission
// These are self-service endpoints for members to view their own financial data

// Get member's finance summary (overview dashboard)
router.get('/finance-summary',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getFinanceSummary
);

// Get member's dues
router.get('/dues',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getDues
);

// Get member's levies
router.get('/levies',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getLevies
);

// Get member's penalties
router.get('/penalties',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getPenalties
);

// Get member's donations
router.get('/donations',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getDonations
);

// Get member's payment history
router.get('/payments',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getPayments
);

// Get all outstanding items for payment
router.get('/outstanding',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.getOutstanding
);

// Process payment for selected transactions
router.post('/pay',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.processPayment
);

// Make a donation
router.post('/donate',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberFinanceController.makeDonation
);

export default router;
