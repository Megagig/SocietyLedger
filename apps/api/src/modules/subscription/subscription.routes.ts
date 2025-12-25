import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all available plans
router.get('/plans', subscriptionController.getPlans);

// Get current association's subscription
router.get('/current', subscriptionController.getCurrentSubscription);

// Initialize subscription payment
router.post('/initialize', subscriptionController.initializePayment);

// Verify payment
router.get('/verify/:reference', subscriptionController.verifyPayment);

// Cancel subscription (mark for cancellation at period end)
router.post('/cancel', subscriptionController.cancelSubscription);

// Reactivate subscription (remove cancellation flag)
router.post('/reactivate', subscriptionController.reactivateSubscription);

export default router;
