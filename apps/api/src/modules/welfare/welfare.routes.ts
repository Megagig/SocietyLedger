// ============================================
// PHASE 5.5: WELFARE & SOCIAL FUNDS ROUTES
// ============================================

import { Router } from 'express';
import { welfareController } from './welfare.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Phase 19: Apply module check to all welfare routes
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('welfare'));

// ==========================================
// DASHBOARD ROUTES
// ==========================================

/**
 * Get welfare dashboard (admin view)
 * GET /api/welfare/dashboard
 */
router.get(
  '/dashboard',
  requireAnyPermission([PERMISSIONS.WELFARE_VIEW, PERMISSIONS.WELFARE_MANAGE]),
  welfareController.getDashboard
);

/**
 * Get fund summaries
 * GET /api/welfare/fund-summaries
 */
router.get(
  '/fund-summaries',
  requireAnyPermission([PERMISSIONS.WELFARE_VIEW, PERMISSIONS.WELFARE_MANAGE]),
  welfareController.getFundSummaries
);

/**
 * Check member eligibility for a fund
 * GET /api/welfare/eligibility
 */
router.get(
  '/eligibility',
  requirePermission(PERMISSIONS.WELFARE_VIEW),
  welfareController.checkEligibility
);

/**
 * Get current user's welfare profile
 * GET /api/welfare/my-profile
 */
router.get(
  '/my-profile',
  requirePermission(PERMISSIONS.WELFARE_VIEW),
  welfareController.getMemberWelfareProfile
);

/**
 * Get member's welfare profile (admin view)
 * GET /api/welfare/members/:memberId/profile
 */
router.get(
  '/members/:memberId/profile',
  requirePermission(PERMISSIONS.WELFARE_MANAGE),
  welfareController.getMemberWelfareProfile
);

// ==========================================
// WELFARE FUND ROUTES
// ==========================================

/**
 * List all welfare funds
 * GET /api/welfare/funds
 */
router.get(
  '/funds',
  requireAnyPermission([PERMISSIONS.WELFARE_VIEW, PERMISSIONS.WELFARE_MANAGE]),
  welfareController.listFunds
);

/**
 * Create a welfare fund (admin only)
 * POST /api/welfare/funds
 */
router.post(
  '/funds',
  requirePermission(PERMISSIONS.WELFARE_MANAGE),
  welfareController.createFund
);

/**
 * Get a single welfare fund
 * GET /api/welfare/funds/:id
 */
router.get(
  '/funds/:id',
  requireAnyPermission([PERMISSIONS.WELFARE_VIEW, PERMISSIONS.WELFARE_MANAGE]),
  welfareController.getFund
);

/**
 * Update a welfare fund (admin only)
 * PUT /api/welfare/funds/:id
 */
router.put(
  '/funds/:id',
  requirePermission(PERMISSIONS.WELFARE_MANAGE),
  welfareController.updateFund
);

/**
 * Delete a welfare fund (admin only)
 * DELETE /api/welfare/funds/:id
 */
router.delete(
  '/funds/:id',
  requirePermission(PERMISSIONS.WELFARE_MANAGE),
  welfareController.deleteFund
);

// ==========================================
// CONTRIBUTION ROUTES
// ==========================================

/**
 * List contributions
 * GET /api/welfare/contributions
 */
router.get(
  '/contributions',
  requireAnyPermission([PERMISSIONS.WELFARE_CONTRIBUTION_VIEW, PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE]),
  welfareController.listContributions
);

/**
 * Record a contribution (admin only)
 * POST /api/welfare/contributions
 */
router.post(
  '/contributions',
  requirePermission(PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE),
  welfareController.recordContribution
);

/**
 * Bulk record contributions (admin only)
 * POST /api/welfare/contributions/bulk
 */
router.post(
  '/contributions/bulk',
  requirePermission(PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE),
  welfareController.bulkRecordContributions
);

/**
 * Confirm/reject a contribution (admin only)
 * POST /api/welfare/contributions/:id/confirm
 */
router.post(
  '/contributions/:id/confirm',
  requirePermission(PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM),
  welfareController.confirmContribution
);

// ==========================================
// PAYOUT REQUEST ROUTES
// ==========================================

/**
 * List payout requests
 * GET /api/welfare/payouts
 */
router.get(
  '/payouts',
  requireAnyPermission([PERMISSIONS.WELFARE_PAYOUT_VIEW, PERMISSIONS.WELFARE_PAYOUT_APPROVE]),
  welfareController.listPayoutRequests
);

/**
 * Create a payout request (members can request)
 * POST /api/welfare/payouts
 */
router.post(
  '/payouts',
  requirePermission(PERMISSIONS.WELFARE_PAYOUT_REQUEST),
  welfareController.createPayoutRequest
);

/**
 * Create a bereavement support request
 * POST /api/welfare/payouts/bereavement
 */
router.post(
  '/payouts/bereavement',
  requirePermission(PERMISSIONS.WELFARE_PAYOUT_REQUEST),
  welfareController.createBereavementRequest
);

/**
 * Review a payout request (approve/reject) - admin only
 * POST /api/welfare/payouts/:id/review
 */
router.post(
  '/payouts/:id/review',
  requirePermission(PERMISSIONS.WELFARE_PAYOUT_APPROVE),
  welfareController.reviewPayoutRequest
);

/**
 * Disburse an approved payout - admin only
 * POST /api/welfare/payouts/:id/disburse
 */
router.post(
  '/payouts/:id/disburse',
  requirePermission(PERMISSIONS.WELFARE_PAYOUT_DISBURSE),
  welfareController.disbursePayoutRequest
);

/**
 * Cancel a payout request (member can cancel own pending requests)
 * POST /api/welfare/payouts/:id/cancel
 */
router.post(
  '/payouts/:id/cancel',
  requirePermission(PERMISSIONS.WELFARE_PAYOUT_REQUEST),
  welfareController.cancelPayoutRequest
);

export default router;
