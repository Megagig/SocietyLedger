import { Router } from 'express';
import { memberFinanceController } from './member-finance.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
// Note: Tenant context comes from req.user.associationId (set by auth middleware)
// No tenant middleware needed - these are user-specific routes
router.use(authMiddleware);

// Debug: Log when routes are registered
console.log('[Member Finance Routes] Registering member finance routes at /api/members/me');

// All routes require either MEMBER_FINANCE_VIEW (for own data) or LEDGER_VIEW/LEDGER_VIEW_ALL (for admins)
// These are self-service endpoints for members to view their own financial data

// Permission set that allows both members viewing own data and admins viewing any data
const viewPermissions = [
  PERMISSIONS.MEMBER_FINANCE_VIEW,  // ledger.view_own - members viewing their own
  PERMISSIONS.LEDGER_VIEW,           // ledger.view - admins viewing ledger
  PERMISSIONS.LEDGER_VIEW_ALL,       // ledger.view_all - admins viewing all ledgers
];

// Get member's finance summary (overview dashboard)
router.get('/finance-summary',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getFinanceSummary
);

// Get member's dues
router.get('/dues',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getDues
);

// Get member's levies
router.get('/levies',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getLevies
);

// Get member's penalties
router.get('/penalties',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getPenalties
);

// Get member's donations
router.get('/donations',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getDonations
);

// Get member's payment history
router.get('/payments',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getPayments
);

// Get all outstanding items for payment
router.get('/outstanding',
  requireAnyPermission(viewPermissions),
  memberFinanceController.getOutstanding
);

// Process payment for selected transactions
router.post('/pay',
  requireAnyPermission(viewPermissions),
  memberFinanceController.processPayment
);

// Make a donation
router.post('/donate',
  requireAnyPermission(viewPermissions),
  memberFinanceController.makeDonation
);

// Check if current user has a member profile
router.get('/profile',
  requireAnyPermission(viewPermissions),
  memberFinanceController.checkMemberProfile
);

// Create or link member profile for current user
router.post('/profile',
  requireAnyPermission(viewPermissions),
  memberFinanceController.createOrLinkMemberProfile
);

export default router;
