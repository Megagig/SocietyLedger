import { Router } from 'express';
import { advancedController } from './advanced.controller';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../../middleware/rbac';
import { PERMISSIONS } from '../../../lib/permissions';

const router: Router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ==========================================
// LEVY CAMPAIGN ROUTES (TASK-ADV-001, TASK-ADV-002)
// ==========================================

// List all levy campaigns
router.get('/levies/campaigns',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.listCampaigns
);

// Create levy campaign
router.post('/levies/campaigns',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  advancedController.createCampaign
);

// Get single campaign
router.get('/levies/campaigns/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getCampaign
);

// Update campaign
router.patch('/levies/campaigns/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  advancedController.updateCampaign
);

// Get campaign progress
router.get('/levies/campaigns/:id/progress',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getCampaignProgress
);

// Assign members to campaign
router.post('/levies/campaigns/:id/assign',
  requirePermission(PERMISSIONS.TRANSACTION_CREATE),
  advancedController.assignMembers
);

// Remove assignment
router.delete('/levies/campaigns/:id/assignments/:assignmentId',
  requirePermission(PERMISSIONS.TRANSACTION_DELETE),
  advancedController.removeAssignment
);

// ==========================================
// DONATION ROUTES (TASK-ADV-003, TASK-ADV-004)
// ==========================================

// List donation allocations
router.get('/donations/allocations',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.listAllocations
);

// Create donation allocation
router.post('/donations/allocations',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  advancedController.createAllocation
);

// Update allocation
router.patch('/donations/allocations/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  advancedController.updateAllocation
);

// Record donation
router.post('/donations/record',
  requirePermission(PERMISSIONS.TRANSACTION_CREATE),
  advancedController.recordDonation
);

// Get donation receipt
router.get('/donations/:id/receipt',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getDonationReceipt
);

// List all donations
router.get('/donations',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.listDonations
);

// Get donation statistics
router.get('/donations/stats',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getDonationStats
);

// ==========================================
// PENALTY ROUTES (TASK-ADV-005, TASK-ADV-006, TASK-ADV-007)
// ==========================================

// Get penalty statistics
router.get('/penalties/stats',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getPenaltyStats
);

// List penalty rules
router.get('/penalties/rules',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.listRules
);

// Create penalty rule
router.post('/penalties/rules',
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  advancedController.createRule
);

// Get single rule
router.get('/penalties/rules/:id',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.getRule
);

// Update rule
router.patch('/penalties/rules/:id',
  requirePermission(PERMISSIONS.FINANCE_EDIT),
  advancedController.updateRule
);

// Delete rule
router.delete('/penalties/rules/:id',
  requirePermission(PERMISSIONS.FINANCE_DELETE),
  advancedController.deleteRule
);

// What applying late fees now would do — shown to the officer before they confirm
router.get('/penalties/late-fees/preview',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  advancedController.previewLateFees
);

// Apply late fees (manual trigger)
router.post('/penalties/apply-late-fees',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  advancedController.applyLateFees
);

// Waive penalty
router.post('/penalties/:id/waive',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  advancedController.waivePenalty
);

// List waivers
router.get('/penalties/waivers',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  advancedController.listWaivers
);

export default router;
