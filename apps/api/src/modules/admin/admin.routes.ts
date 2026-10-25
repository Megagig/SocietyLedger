import { Router } from 'express';
import prisma from '../../lib/prisma';
import { AdminController } from './admin.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformAdminController } from './platform-admin.controller';
import { PaymentSettlementsController } from './payment-settlements.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router: Router = Router();
const ctrl = new AdminController();
const platformCtrl = new PlatformAdminController();
const settlementsCtrl = new PaymentSettlementsController();

// All routes require SUPER_ADMIN
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// Platform admin profile
router.get('/me', (req, res) => ctrl.getMe(req as any, res));
router.patch('/me', (req, res) => ctrl.updateMe(req as any, res));
router.post('/me/password', (req, res) => ctrl.changePassword(req as any, res));

// Dashboard stats and analytics
router.get('/stats', (req, res) => ctrl.stats(req as any, res));
router.get('/analytics', (req, res) => ctrl.analytics(req as any, res));
router.get('/audit-logs', (req, res) => ctrl.auditLogs(req as any, res));

// Association management
router.get('/associations', (req, res) => ctrl.listAssociations(req as any, res));
router.get('/associations/:associationId', (req, res) => ctrl.getAssociation(req as any, res));
router.post('/associations/:associationId/suspend', (req, res) => ctrl.suspendAssociation(req as any, res));
router.post('/associations/:associationId/reactivate', (req, res) => ctrl.reactivateAssociation(req as any, res));
router.post('/associations/:associationId/impersonate', (req, res) => ctrl.impersonate(req as any, res));

// Association sub-resources
router.get('/associations/:associationId/audit-logs', async (req, res) => {
  try {
    const associationId = Number(req.params.associationId);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await prisma.auditLog.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        tableName: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
    return res.json({ success: true, data: { logs } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/associations/:associationId/modules', async (req, res) => {
  try {
    const associationId = Number(req.params.associationId);
    const tenantModules = await prisma.tenantModule.findMany({
      where: {
        associationId,
        isEnabled: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { module: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({
      success: true,
      data: {
        modules: tenantModules.map((tm) => ({
          moduleId: tm.module.code,
          moduleName: tm.module.name,
          enabledAt: tm.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/impersonate/:associationId', (req, res) => ctrl.impersonate(req as any, res));
router.post('/end-impersonation', (req, res) => ctrl.endImpersonation(req as any, res));
router.get('/impersonation-sessions', (req, res) => ctrl.listImpersonationSessions(req as any, res));

// User approval management
router.get('/approvals', (req, res) => ctrl.listPendingApprovals(req as any, res));
router.patch('/approvals/:userId', (req, res) => ctrl.updateApproval(req as any, res));
router.post('/approvals/bulk', (req, res) => ctrl.bulkUpdateApprovals(req as any, res));

// Email verification by hand, for people who never got the code
router.post('/users/:userId/verify-email', (req, res) => ctrl.verifyUserEmail(req as any, res));
router.post('/users/:userId/resend-verification', (req, res) => ctrl.resendUserVerification(req as any, res));

// Platform Settings (TASK-SET-025)
router.get('/settings/platform', PlatformSettingsController.getSettings);
router.patch('/settings/platform', PlatformSettingsController.updateSettings);
router.get('/settings/platform/stats', PlatformSettingsController.getStats);

// AI assistant: model, credit price, allowances, and AI cost against credits sold
router.get('/settings/ai', PlatformSettingsController.getAiSettings);
router.patch('/settings/ai', PlatformSettingsController.updateAiSettings);
router.get('/ai/usage', PlatformSettingsController.getAiUsage);

// Association Overrides
router.get('/associations/:id/override', PlatformSettingsController.getAssociationOverride);
router.post('/associations/:id/override', PlatformSettingsController.setAssociationOverride);

// ==================== PHASE 19: PLATFORM ADMIN CONTROLS ====================

// Platform admin invites (A2.12)
router.get('/platform-admins', (req, res) => platformCtrl.listAdmins(req as any, res));
router.post('/platform-admins/invite', (req, res) => platformCtrl.inviteAdmin(req as any, res));
router.delete('/platform-admins/invites/:inviteId', (req, res) => platformCtrl.revokeAdminInvite(req as any, res));

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
router.get('/plans', (req, res) => platformCtrl.listPlans(req as any, res));
router.post('/tenants/:associationId/plan', (req, res) => platformCtrl.changeTenantPlan(req as any, res));
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

// SMS Credits (manual grant, replaces the old tenant-reachable topup — G41)
router.post('/associations/:associationId/sms-credits/topup', (req, res) => platformCtrl.topUpSmsCredits(req as any, res));

// Platform Action Logs (Phase 19.3)
router.get('/action-logs', (req, res) => platformCtrl.getActionLogs(req as any, res));
router.get('/action-logs/stats', (req, res) => platformCtrl.getActionLogStats(req as any, res));
router.get('/action-logs/export', (req, res) => platformCtrl.exportActionLogs(req as any, res));

// Platform Analytics (Phase 19.3 - TASK-PA-022)
router.get('/analytics/overview', (req, res) => platformCtrl.getAnalyticsOverview(req as any, res));
router.get('/analytics/module-adoption', (req, res) => platformCtrl.getModuleAdoption(req as any, res));
router.get('/analytics/churn', (req, res) => platformCtrl.getChurnAnalytics(req as any, res));
router.get('/analytics/revenue', (req, res) => platformCtrl.getRevenueTrends(req as any, res));

// Impersonation — alternate path for admin console (UI uses /impersonation/... not /impersonation-sessions)
router.get('/impersonation/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [active, today, total] = await Promise.all([
      prisma.impersonationHandoff.count({ where: { expiresAt: { gt: now }, usedAt: null } }),
      prisma.impersonationHandoff.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.impersonationHandoff.count(),
    ]);
    const uniqueAdmins = await prisma.impersonationHandoff.groupBy({ by: ['adminUserId'] });
    return res.json({ success: true, data: { activeSessions: active, sessionsToday: today, totalSessions: total, uniqueAdmins: uniqueAdmins.length } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/impersonation/sessions', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const activeOnly = req.query.activeOnly === 'true';
    const now = new Date();
    const where = activeOnly ? { expiresAt: { gt: now }, usedAt: null } : {};
    const [items, total] = await Promise.all([
      prisma.impersonationHandoff.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          durationMinutes: true,
          expiresAt: true,
          usedAt: true,
          createdAt: true,
          adminUser: { select: { id: true, email: true } },
          association: { select: { id: true, name: true, subdomain: true } },
        },
      }),
      prisma.impersonationHandoff.count({ where }),
    ]);
    return res.json({
      success: true,
      data: {
        sessions: items.map((s) => ({
          id: s.id,
          adminId: s.adminUser?.id,
          adminEmail: s.adminUser?.email,
          associationId: s.association?.id,
          associationName: s.association?.name,
          subdomain: s.association?.subdomain,
          reason: s.reason,
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: null,
          createdAt: s.createdAt.toISOString(),
          isActive: s.usedAt === null && s.expiresAt > new Date(),
        })),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/impersonation/sessions/:id/revoke', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const session = await prisma.impersonationHandoff.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await prisma.impersonationHandoff.update({ where: { id }, data: { expiresAt: new Date() } });
    return res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Webhook event logs
router.get('/webhooks/stats', (req, res) => ctrl.getWebhookStats(req as any, res));
router.get('/webhooks/events', (req, res) => ctrl.listWebhookEvents(req as any, res));
router.post('/webhooks/retry-failed', (req, res) => ctrl.retryFailedWebhooks(req as any, res));
router.post('/webhooks/events/:id/retry', (req, res) => ctrl.retryWebhookEvent(req as any, res));

// Payment Settlements (Phase 19.4)
router.get('/payment-settlements/daily', (req, res) => settlementsCtrl.getDailySettlements(req as any, res));
router.get('/payment-settlements/pending', (req, res) => settlementsCtrl.getPendingSettlements(req as any, res));
router.get('/payment-settlements/monthly', (req, res) => settlementsCtrl.getMonthlySettlements(req as any, res));

export default router;
