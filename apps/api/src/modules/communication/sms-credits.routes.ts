import { Router } from 'express';
import { smsCreditsController } from './sms-credits.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth and tenant middleware
router.use(authMiddleware);
router.use(tenantMiddleware);

// Purchase SMS credits
router.post('/purchase',
  requirePermission(PERMISSIONS.SMS_SEND),
  smsCreditsController.purchaseCredits
);

// Verify SMS credits purchase
router.get('/verify/:reference',
  requirePermission(PERMISSIONS.SMS_SEND),
  smsCreditsController.verifyPurchase
);

export default router;
