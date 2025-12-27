import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

// Public route - verify payment (no auth required as user might be redirected from Paystack)
router.get('/verify/:reference', subscriptionController.verifyPayment);

// Apply auth and tenant middleware to protected routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all available plans
router.get('/plans', subscriptionController.getPlans);

// Get current association's subscription
router.get('/current', subscriptionController.getCurrentSubscription);

// Initialize subscription payment
router.post('/initialize', subscriptionController.initializePayment);

// Cancel subscription (mark for cancellation at period end)
router.post('/cancel', subscriptionController.cancelSubscription);

// Reactivate subscription (remove cancellation flag)
router.post('/reactivate', subscriptionController.reactivateSubscription);

// Change plan (upgrade/downgrade)
router.post('/change-plan', subscriptionController.changePlan);

export default router;
