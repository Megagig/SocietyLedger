import { Router } from 'express';
import { PlatformRole } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { billingAdmin as c } from './billing-admin.controller';

const router: Router = Router();

// Plans, prices, subscriptions and billing overrides are the platform owner's: nobody else can read or change them.
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

router.get('/catalog', c.catalog);
router.get('/onboarding', c.onboarding);

// Plan Builder
router.get('/plans', c.listPlans);
router.post('/plans', c.createPlan);
router.get('/plans/preview', c.previewCatalog);
router.patch('/plans/:id', c.updatePlan);
router.post('/plans/:id/archive', c.archivePlan);
router.post('/plans/:id/restore', c.restorePlan);
router.post('/plans/:id/duplicate', c.duplicatePlan);
router.post('/plans/:id/draft', c.startDraft);
router.patch('/plans/:id/draft', c.updateDraft);
router.delete('/plans/:id/draft', c.discardDraft);
router.get('/plans/:id/preview-publish', c.previewPublish);
router.post('/plans/:id/publish', c.publish);

// Add-ons
router.get('/addons', c.listAddons);
router.post('/addons', c.createAddon);
router.patch('/addons/:id', c.updateAddon);
router.post('/addons/:id/archive', c.archiveAddon);
router.post('/addons/:id/draft', c.startAddonDraft);
router.patch('/addons/:id/draft', c.updateAddonDraft);
router.post('/addons/:id/publish', c.publishAddon);

// Subscription administration
router.get('/subscriptions', c.listSubscriptions);
router.get('/subscriptions/:associationId', c.getSubscription);
router.post('/subscriptions/:associationId/activate', c.activate);
router.post('/subscriptions/:associationId/extend', c.extend);
router.post('/subscriptions/:associationId/suspend', c.suspend);
router.post('/subscriptions/:associationId/reactivate', c.reactivate);
router.post('/subscriptions/:associationId/addons', c.grantAddon);

// Payments that need a person to look at them
router.get('/payments', c.listPayments);
router.post('/payments/:paymentId/close-review', c.closeReview);

// Moving existing subscribers onto a new plan version
router.get('/migrations', c.listMigrations);
router.post('/migrations/preview', c.previewMigration);
router.post('/migrations', c.scheduleMigration);
router.post('/migrations/:id/cancel', c.cancelMigration);

router.post('/refresh', c.refresh);

export default router;
