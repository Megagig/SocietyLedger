import { Router } from 'express';
import { AdminController } from './admin.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();
const ctrl = new AdminController();

// All routes require SUPER_ADMIN
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// Dashboard stats and analytics
router.get('/stats', (req, res) => ctrl.stats(req as any, res));
router.get('/analytics', (req, res) => ctrl.analytics(req as any, res));
router.get('/audit-logs', (req, res) => ctrl.auditLogs(req as any, res));

// Association management
router.get('/associations', (req, res) => ctrl.listAssociations(req as any, res));
router.get('/associations/:associationId', (req, res) => ctrl.getAssociation(req as any, res));
router.post('/associations/:associationId/suspend', (req, res) => ctrl.suspendAssociation(req as any, res));
router.post('/associations/:associationId/reactivate', (req, res) => ctrl.reactivateAssociation(req as any, res));
router.post('/impersonate/:associationId', (req, res) => ctrl.impersonate(req as any, res));

// User approval management
router.get('/approvals', (req, res) => ctrl.listPendingApprovals(req as any, res));
router.patch('/approvals/:userId', (req, res) => ctrl.updateApproval(req as any, res));
router.post('/approvals/bulk', (req, res) => ctrl.bulkUpdateApprovals(req as any, res));

// Platform Settings (TASK-SET-025)
router.get('/settings/platform', PlatformSettingsController.getSettings);
router.patch('/settings/platform', PlatformSettingsController.updateSettings);
router.get('/settings/platform/stats', PlatformSettingsController.getStats);

// Association Overrides
router.get('/associations/:id/override', PlatformSettingsController.getAssociationOverride);
router.post('/associations/:id/override', PlatformSettingsController.setAssociationOverride);

export default router;
