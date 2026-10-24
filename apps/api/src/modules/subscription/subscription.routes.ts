import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Public route - verify payment (no auth required as user might be redirected from Paystack)
router.get('/verify/:reference', subscriptionController.verifyPayment);

// Apply auth and tenant middleware to protected routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all available plans
router.get('/plans', subscriptionController.getPlans);

// Get current association's subscription
// Plan and billing details are for the people who manage settings, not every member.
router.get('/current', requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_BILLING]), subscriptionController.getCurrentSubscription);

// Changing the plan or the subscription's state needs the billing permission (a plain member could cancel it before).
// Initialize subscription payment
router.post('/initialize', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.initializePayment);

// Start a free trial with no payment step (G56)
router.post('/start-trial', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.startTrial);

// Cancel subscription (mark for cancellation at period end)
router.post('/cancel', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.cancelSubscription);

// Reactivate subscription (remove cancellation flag)
router.post('/reactivate', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.reactivateSubscription);

// Change plan (upgrade/downgrade)
router.post('/change-plan', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.changePlan);

export default router;
