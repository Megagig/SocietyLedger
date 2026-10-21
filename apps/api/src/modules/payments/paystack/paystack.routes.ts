import { Router } from 'express';
import { paystackController } from './paystack.controller';
import { handlePaystackWebhook } from './paystack.webhook';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../../middleware/rbac';
import { PERMISSIONS } from '../../../lib/permissions';

const router: Router = Router();

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

// Initialize payment — members (PAYMENTS_VIEW_OWN) and officers both allowed
router.post('/initialize',
  requireAnyPermission([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  paystackController.initializePayment
);

// Verify payment after redirect — members need this to confirm their own checkout
router.get('/verify/:reference',
  requireAnyPermission([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  paystackController.verifyPayment
);

// Get payment status
router.get('/status/:reference',
  requireAnyPermission([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENTS_VIEW_OWN]),
  paystackController.getPaymentStatus
);

export default router;
