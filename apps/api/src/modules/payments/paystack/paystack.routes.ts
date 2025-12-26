import { Router } from 'express';
import { paystackController } from './paystack.controller';
import { handlePaystackWebhook } from './paystack.webhook';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../middleware/tenant.middleware';
import { requirePermission } from '../../../middleware/rbac';
import { PERMISSIONS } from '../../../lib/permissions';

const router = Router();

// ==========================================
// WEBHOOK ENDPOINT (NO AUTH - Public)
// ==========================================
// CRITICAL: This must be accessible without authentication
// Security is handled via webhook signature verification
router.post('/webhook', handlePaystackWebhook);

// ==========================================
// AUTHENTICATED PAYMENT ENDPOINTS
// ==========================================
// Apply auth and tenant middleware to all routes below
router.use(authMiddleware);
router.use(tenantMiddleware);

// Initialize payment
router.post('/initialize',
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  paystackController.initializePayment
);

// Verify payment after redirect
router.get('/verify/:reference',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  paystackController.verifyPayment
);

// Get payment status
router.get('/status/:reference',
  requirePermission(PERMISSIONS.PAYMENT_VIEW),
  paystackController.getPaymentStatus
);

export default router;
