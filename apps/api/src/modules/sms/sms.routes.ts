/**
 * SMS Routes
 * Phase 6.5: SMS & Bulk Communication
 */

import { Router } from 'express';
import { smsController } from './sms.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Phase 19: Apply module check to all SMS routes
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('sms'));

// ============================================
// Dashboard Routes
// ============================================

/**
 * Get SMS dashboard statistics
 * GET /api/sms/dashboard
 */
router.get(
  '/dashboard',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_SEND]),
  smsController.getDashboard
);

// ============================================
// Quick SMS Routes
// ============================================

/**
 * Send quick SMS to recipients
 * POST /api/sms/send
 */
router.post(
  '/send',
  requirePermission(PERMISSIONS.SMS_SEND),
  smsController.sendQuickSMS
);

// ============================================
// Campaign Routes
// ============================================

/**
 * List SMS campaigns
 * GET /api/sms/campaigns
 */
router.get(
  '/campaigns',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_CAMPAIGN_MANAGE]),
  smsController.listCampaigns
);

/**
 * Create SMS campaign
 * POST /api/sms/campaigns
 */
router.post(
  '/campaigns',
  requirePermission(PERMISSIONS.SMS_CAMPAIGN_MANAGE),
  smsController.createCampaign
);

/**
 * Get SMS campaign by ID
 * GET /api/sms/campaigns/:id
 */
router.get(
  '/campaigns/:id',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_CAMPAIGN_MANAGE]),
  smsController.getCampaign
);

/**
 * Start/execute SMS campaign
 * POST /api/sms/campaigns/:id/start
 */
router.post(
  '/campaigns/:id/start',
  requirePermission(PERMISSIONS.SMS_CAMPAIGN_MANAGE),
  smsController.startCampaign
);

/**
 * Cancel SMS campaign
 * POST /api/sms/campaigns/:id/cancel
 */
router.post(
  '/campaigns/:id/cancel',
  requirePermission(PERMISSIONS.SMS_CAMPAIGN_MANAGE),
  smsController.cancelCampaign
);

/**
 * Delete SMS campaign (draft only)
 * DELETE /api/sms/campaigns/:id
 */
router.delete(
  '/campaigns/:id',
  requirePermission(PERMISSIONS.SMS_CAMPAIGN_MANAGE),
  smsController.deleteCampaign
);

// ============================================
// Template Routes
// ============================================

/**
 * List SMS templates
 * GET /api/sms/templates
 */
router.get(
  '/templates',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_TEMPLATE_MANAGE]),
  smsController.listTemplates
);

/**
 * Create SMS template
 * POST /api/sms/templates
 */
router.post(
  '/templates',
  requirePermission(PERMISSIONS.SMS_TEMPLATE_MANAGE),
  smsController.createTemplate
);

/**
 * Get SMS template by ID
 * GET /api/sms/templates/:id
 */
router.get(
  '/templates/:id',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_TEMPLATE_MANAGE]),
  smsController.getTemplate
);

/**
 * Update SMS template
 * PUT /api/sms/templates/:id
 */
router.put(
  '/templates/:id',
  requirePermission(PERMISSIONS.SMS_TEMPLATE_MANAGE),
  smsController.updateTemplate
);

/**
 * Delete SMS template
 * DELETE /api/sms/templates/:id
 */
router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.SMS_TEMPLATE_MANAGE),
  smsController.deleteTemplate
);

// ============================================
// Message Routes
// ============================================

/**
 * List SMS messages
 * GET /api/sms/messages
 */
router.get(
  '/messages',
  requirePermission(PERMISSIONS.SMS_VIEW),
  smsController.listMessages
);

/**
 * Get SMS message by ID
 * GET /api/sms/messages/:id
 */
router.get(
  '/messages/:id',
  requirePermission(PERMISSIONS.SMS_VIEW),
  smsController.getMessage
);

// ============================================
// Credit Routes
// ============================================

/**
 * Get SMS credit balance
 * GET /api/sms/credits/balance
 */
router.get(
  '/credits/balance',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_CREDIT_MANAGE]),
  smsController.getCreditBalance
);

/**
 * Purchase SMS credits via Paystack
 * POST /api/sms/credits/purchase
 */
router.post(
  '/credits/purchase',
  requirePermission(PERMISSIONS.SMS_SEND),
  smsController.purchaseCredits
);

/**
 * Verify SMS credits purchase
 * GET /api/sms/credits/verify/:reference
 */
router.get(
  '/credits/verify/:reference',
  requirePermission(PERMISSIONS.SMS_SEND),
  smsController.verifyPurchase
);

// POST /credits/topup removed (G41) — granted free credits with zero payment
// verification. Manual grants now go through the platform-only
// POST /admin/associations/:associationId/sms-credits/topup; real purchases
// use /credits/purchase + /credits/verify below.

/**
 * Get SMS credit transaction history
 * GET /api/sms/credits/history
 */
router.get(
  '/credits/history',
  requireAnyPermission([PERMISSIONS.SMS_VIEW, PERMISSIONS.SMS_CREDIT_MANAGE]),
  smsController.getCreditHistory
);

export default router;
