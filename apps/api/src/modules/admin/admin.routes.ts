import { Router } from 'express';
import { AdminController } from './admin.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformAdminController } from './platform-admin.controller';
import { PaymentSettlementsController } from './payment-settlements.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();
const ctrl = new AdminController();
const platformCtrl = new PlatformAdminController();
const settlementsCtrl = new PaymentSettlementsController();

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
router.post('/end-impersonation', (req, res) => ctrl.endImpersonation(req as any, res));

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

// ==================== PHASE 19: PLATFORM ADMIN CONTROLS ====================

// Tenant Management (Phase 19.3)
router.get('/tenants', (req, res) => platformCtrl.listTenants(req as any, res));
router.get('/tenants/:associationId/status', (req, res) => platformCtrl.getTenantStatus(req as any, res));
router.post('/tenants/:associationId/suspend', (req, res) => platformCtrl.suspendTenant(req as any, res));
router.post('/tenants/:associationId/reactivate', (req, res) => platformCtrl.reactivateTenant(req as any, res));
router.post('/tenants/:associationId/soft-delete', (req, res) => platformCtrl.softDeleteTenant(req as any, res));
router.post('/tenants/:associationId/restore', (req, res) => platformCtrl.restoreTenant(req as any, res));
router.delete('/tenants/:associationId/permanent-delete', (req, res) => platformCtrl.permanentDeleteTenant(req as any, res));
router.post('/tenants/:associationId/force-logout', (req, res) => platformCtrl.forceLogoutTenant(req as any, res));
router.patch('/tenants/:associationId/security', (req, res) => platformCtrl.updateSecuritySettings(req as any, res));

// Module & Feature Management (Phase 19.3)
router.get('/modules', (req, res) => platformCtrl.getAllModules(req as any, res));
router.get('/features', (req, res) => platformCtrl.getAllFeatures(req as any, res));
router.get('/tenants/:associationId/modules', (req, res) => platformCtrl.getModulesAndFeatures(req as any, res));
router.post('/tenants/:associationId/modules/override', (req, res) => platformCtrl.setModuleOverride(req as any, res));
router.delete('/tenants/:associationId/modules/:moduleCode/override', (req, res) => platformCtrl.removeModuleOverride(req as any, res));
router.post('/tenants/:associationId/features/override', (req, res) => platformCtrl.setFeatureOverride(req as any, res));
router.delete('/tenants/:associationId/features/:featureCode/override', (req, res) => platformCtrl.removeFeatureOverride(req as any, res));

// Billing Overrides (Phase 19.3)
router.get('/tenants/:associationId/billing', (req, res) => platformCtrl.getBillingStatus(req as any, res));
router.get('/tenants/:associationId/billing/history', (req, res) => platformCtrl.getBillingOverrideHistory(req as any, res));
router.post('/tenants/:associationId/billing/override', (req, res) => platformCtrl.createBillingOverride(req as any, res));
router.post('/tenants/:associationId/billing/extend-trial', (req, res) => platformCtrl.extendTrial(req as any, res));
router.post('/tenants/:associationId/billing/apply-credit', (req, res) => platformCtrl.applyCredit(req as any, res));
router.post('/billing/overrides/:overrideId/revoke', (req, res) => platformCtrl.revokeBillingOverride(req as any, res));

// Platform Action Logs (Phase 19.3)
router.get('/action-logs', (req, res) => platformCtrl.getActionLogs(req as any, res));
router.get('/action-logs/stats', (req, res) => platformCtrl.getActionLogStats(req as any, res));
router.get('/action-logs/export', (req, res) => platformCtrl.exportActionLogs(req as any, res));

// Platform Analytics (Phase 19.3 - TASK-PA-022)
router.get('/analytics/overview', (req, res) => platformCtrl.getAnalyticsOverview(req as any, res));
router.get('/analytics/module-adoption', (req, res) => platformCtrl.getModuleAdoption(req as any, res));
router.get('/analytics/churn', (req, res) => platformCtrl.getChurnAnalytics(req as any, res));
router.get('/analytics/revenue', (req, res) => platformCtrl.getRevenueTrends(req as any, res));

// Payment Settlements (Phase 19.4)
router.get('/payment-settlements/daily', (req, res) => settlementsCtrl.getDailySettlements(req as any, res));
router.get('/payment-settlements/pending', (req, res) => settlementsCtrl.getPendingSettlements(req as any, res));
router.get('/payment-settlements/monthly', (req, res) => settlementsCtrl.getMonthlySettlements(req as any, res));

export default router;
