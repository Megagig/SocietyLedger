import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Public route - verify payment (no auth required as user might be redirected from Paystack).
// Verification asks the payment provider, and only a payment that matches the server's stored quote ever activates anything.
router.get('/verify/:reference', subscriptionController.verifyPayment);

// Apply auth and tenant middleware to protected routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// The plans, add-ons and payment providers that can be bought right now (published, visible, purchasable only)
router.get('/plans', subscriptionController.getPlans);

// Get current association's subscription
// Plan and billing details are for the people who manage settings, not every member.
router.get('/current', requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_BILLING]), subscriptionController.getCurrentSubscription);

// A receipt for one confirmed payment
router.get('/payments/:id/receipt', requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_BILLING]), subscriptionController.getReceipt);

// Everything below changes what the association pays for, so it needs the billing permission.
// Price a plan checkout (the review step) without paying
router.post('/quote', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.quote);

// Start paying for a plan: a new subscription, a renewal or a plan change. The amount is always the server's own quote.
router.post('/initialize', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.initializePayment);

// Change plan (upgrade/downgrade): the same checkout, priced with a credit for the unused part of the current plan
router.post('/change-plan', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.initializePayment);

// Add-ons: priced pro rata to the plan's renewal date
router.post('/addons/quote', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.quoteAddons);
router.post('/addons/initialize', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.initializeAddonPayment);
router.post('/addons/:id/renewal', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.setAddonRenewal);

// Cancel subscription (mark for cancellation at period end)
router.post('/cancel', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.cancelSubscription);

// Reactivate subscription (remove cancellation flag)
router.post('/reactivate', requirePermission(PERMISSIONS.SETTINGS_BILLING), subscriptionController.reactivateSubscription);

export default router;
