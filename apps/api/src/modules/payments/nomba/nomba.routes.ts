/**
 * Nomba Payment Routes
 * 
 * Route definitions for Nomba payment endpoints
 */

import { Router } from 'express';
import { nombaController } from './nomba.controller';
import { nombaWebhookHandler } from './nomba.webhook';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../middleware/tenant.middleware';

const router = Router();

/**
 * Initialize payment
 * POST /api/payments/nomba/initialize
 * 
 * Requires authentication and tenant context
 */
router.post(
  '/initialize',
  authMiddleware,
  tenantMiddleware,
  (req, res) => nombaController.initializePayment(req, res)
);

/**
 * Verify payment
 * GET /api/payments/nomba/verify/:reference
 * 
 * Requires authentication and tenant context
 */
router.get(
  '/verify/:reference',
  authMiddleware,
  tenantMiddleware,
  (req, res) => nombaController.verifyPayment(req, res)
);

/**
 * Get payment status
 * GET /api/payments/nomba/status/:reference
 * 
 * Requires authentication and tenant context
 */
router.get(
  '/status/:reference',
  authMiddleware,
  tenantMiddleware,
  (req, res) => nombaController.getPaymentStatus(req, res)
);

/**
 * Webhook endpoint
 * POST /api/payments/webhook/nomba
 * 
 * PUBLIC ENDPOINT - No authentication required
 * Security: Webhook signature verification in handler
 */
router.post(
  '/webhook',
  (req, res) => nombaWebhookHandler.handleWebhook(req, res)
);

export default router;
