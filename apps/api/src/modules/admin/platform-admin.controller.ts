/**
 * Platform Admin Controller
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * API endpoints for platform-level administration including:
 * - Tenant management (suspend, soft-delete, restore, force-logout)
 * - Module & feature toggles
 * - Billing overrides
 * - Platform action logs
 */

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.middleware';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ModuleFeatureService } from '../../services/module-feature.service';
import { BillingOverrideService } from '../../services/billing-override.service';
import { PlatformActionLogService } from '../../services/platform-action-log.service';

// Validation schemas
const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  notifyUsers: z.boolean().optional().default(true),
});

const softDeleteSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  notifyUsers: z.boolean().optional().default(true),
});

const restoreSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const forceLogoutSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const securitySettingsSchema = z.object({
  force2FA: z.boolean().optional(),
  passwordPolicyLevel: z.enum(['basic', 'standard', 'strict']).optional(),
  sessionTimeoutMinutes: z.number().min(5).max(1440).optional(),
  ipRestrictions: z.array(z.string()).optional(),
  reason: z.string().min(1, 'Reason is required'),
});

const moduleOverrideSchema = z.object({
  moduleCode: z.string().min(1),
  isEnabled: z.boolean(),
  reason: z.string().optional(),
  overrideType: z.enum(['MANUAL', 'TRIAL', 'PROMOTION', 'SUPPORT', 'COMPLIANCE']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const featureOverrideSchema = z.object({
  featureCode: z.string().min(1),
  isEnabled: z.boolean(),
  reason: z.string().optional(),
  overrideType: z.enum(['MANUAL', 'TRIAL', 'PROMOTION', 'SUPPORT', 'COMPLIANCE']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const billingOverrideSchema = z.object({
  overrideType: z.enum([
    'BYPASS_BILLING', 'EXTEND_TRIAL', 'PAUSE_BILLING',
    'APPLY_CREDIT', 'MARK_PAID_EXTERNAL', 'OVERRIDE_PLAN', 'GRACE_PERIOD'
  ]),
  value: z.string().optional(),
  reason: z.string().min(1, 'Reason is required'),
  endDate: z.string().datetime().optional(),
});

const extendTrialSchema = z.object({
  days: z.number().min(1).max(365),
  reason: z.string().min(1, 'Reason is required'),
});

const applyCreditSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1, 'Reason is required'),
});

const actionLogFilterSchema = z.object({
  actorId: z.coerce.number().optional(),
  actionType: z.string().optional(),
  targetType: z.string().optional(),
  associationId: z.coerce.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export class PlatformAdminController {
  // ==================== TENANT MANAGEMENT ====================

  /**
   * Suspend an association
   */
  async suspendTenant(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason, notifyUsers } = suspendSchema.parse(req.body);

      const result = await TenantManagementService.suspend(associationId, actorId, {
        reason,
        notifyUsers,
      });

      return res.json({
        success: true,
        message: 'Association suspended successfully',
        data: { association: result },
      });
    } catch (error) {
      console.error('Suspend tenant error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Reactivate a suspended association
   */
  async reactivateTenant(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason } = restoreSchema.parse(req.body);

      const result = await TenantManagementService.reactivate(associationId, actorId, reason);

      return res.json({
        success: true,
        message: 'Association reactivated successfully',
        data: { association: result },
      });
    } catch (error) {
      console.error('Reactivate tenant error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Soft delete an association
   */
  async softDeleteTenant(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason, notifyUsers } = softDeleteSchema.parse(req.body);

      const result = await TenantManagementService.softDelete(associationId, actorId, {
        reason,
        notifyUsers,
      });

      return res.json({
        success: true,
        message: 'Association soft deleted successfully',
        data: { association: result },
      });
    } catch (error) {
      console.error('Soft delete tenant error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Restore a soft-deleted association
   */
  async restoreTenant(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason } = restoreSchema.parse(req.body);

      const result = await TenantManagementService.restore(associationId, actorId, reason);

      return res.json({
        success: true,
        message: 'Association restored successfully',
        data: { association: result },
      });
    } catch (error) {
      console.error('Restore tenant error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Force logout all users of an association
   */
  async forceLogoutTenant(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason } = forceLogoutSchema.parse(req.body);

      const result = await TenantManagementService.forceLogout(associationId, actorId, reason);

      return res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.error('Force logout error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Update security settings for an association
   */
  async updateSecuritySettings(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { reason, ...settings } = securitySettingsSchema.parse(req.body);

      const result = await TenantManagementService.updateSecuritySettings(
        associationId,
        actorId,
        settings,
        reason
      );

      return res.json({
        success: true,
        message: 'Security settings updated successfully',
        data: { association: result },
      });
    } catch (error) {
      console.error('Update security settings error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get tenant status and details
   */
  async getTenantStatus(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);

      const status = await TenantManagementService.getTenantStatus(associationId);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Get tenant status error:', error);
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * List all tenants with filtering
   */
  async listTenants(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const includeDeleted = req.query.includeDeleted === 'true';
      const search = req.query.search as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await TenantManagementService.listTenants({
        status: status as any,
        includeDeleted,
        search,
        page,
        limit,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('List tenants error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ==================== MODULE & FEATURE MANAGEMENT ====================

  /**
   * Get all modules and features for an association
   */
  async getModulesAndFeatures(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);

      const [modules, features] = await Promise.all([
        ModuleFeatureService.getEnabledModules(associationId),
        ModuleFeatureService.getEnabledFeatures(associationId),
      ]);

      return res.json({
        success: true,
        data: { modules, features },
      });
    } catch (error) {
      console.error('Get modules and features error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Set module override for an association
   */
  async setModuleOverride(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { moduleCode, isEnabled, reason, overrideType, expiresAt } = moduleOverrideSchema.parse(req.body);

      await ModuleFeatureService.setModuleOverride(
        associationId,
        moduleCode,
        isEnabled,
        actorId,
        {
          reason,
          overrideType,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        }
      );

      // Log the action
      await PlatformActionLogService.log({
        actorId,
        actorRole: req.user?.platformRole || 'SUPER_ADMIN',
        actionType: PlatformActionLogService.ActionTypes.MODULE_OVERRIDE_SET,
        targetType: 'module',
        associationId,
        afterState: { moduleCode, isEnabled, overrideType },
        reason,
      });

      return res.json({
        success: true,
        message: `Module '${moduleCode}' ${isEnabled ? 'enabled' : 'disabled'} for association`,
      });
    } catch (error) {
      console.error('Set module override error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Remove module override (revert to plan default)
   */
  async removeModuleOverride(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const moduleCode = req.params.moduleCode;
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      await ModuleFeatureService.removeModuleOverride(associationId, moduleCode);

      // Log the action
      await PlatformActionLogService.log({
        actorId,
        actorRole: req.user?.platformRole || 'SUPER_ADMIN',
        actionType: PlatformActionLogService.ActionTypes.MODULE_OVERRIDE_REMOVED,
        targetType: 'module',
        associationId,
        afterState: { moduleCode },
      });

      return res.json({
        success: true,
        message: `Module override for '${moduleCode}' removed`,
      });
    } catch (error) {
      console.error('Remove module override error:', error);
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Set feature override for an association
   */
  async setFeatureOverride(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { featureCode, isEnabled, reason, overrideType, expiresAt } = featureOverrideSchema.parse(req.body);

      await ModuleFeatureService.setFeatureOverride(
        associationId,
        featureCode,
        isEnabled,
        actorId,
        {
          reason,
          overrideType,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        }
      );

      // Log the action
      await PlatformActionLogService.log({
        actorId,
        actorRole: req.user?.platformRole || 'SUPER_ADMIN',
        actionType: PlatformActionLogService.ActionTypes.FEATURE_OVERRIDE_SET,
        targetType: 'feature',
        associationId,
        afterState: { featureCode, isEnabled, overrideType },
        reason,
      });

      return res.json({
        success: true,
        message: `Feature '${featureCode}' ${isEnabled ? 'enabled' : 'disabled'} for association`,
      });
    } catch (error) {
      console.error('Set feature override error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Remove feature override
   */
  async removeFeatureOverride(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const featureCode = req.params.featureCode;
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      await ModuleFeatureService.removeFeatureOverride(associationId, featureCode);

      // Log the action
      await PlatformActionLogService.log({
        actorId,
        actorRole: req.user?.platformRole || 'SUPER_ADMIN',
        actionType: PlatformActionLogService.ActionTypes.FEATURE_OVERRIDE_REMOVED,
        targetType: 'feature',
        associationId,
        afterState: { featureCode },
      });

      return res.json({
        success: true,
        message: `Feature override for '${featureCode}' removed`,
      });
    } catch (error) {
      console.error('Remove feature override error:', error);
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get all platform modules (for admin UI)
   */
  async getAllModules(req: AuthRequest, res: Response) {
    try {
      const modules = await ModuleFeatureService.getAllModules();

      return res.json({
        success: true,
        data: modules,
      });
    } catch (error) {
      console.error('Get all modules error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get all platform features (for admin UI)
   */
  async getAllFeatures(req: AuthRequest, res: Response) {
    try {
      const features = await ModuleFeatureService.getAllFeatures();

      return res.json({
        success: true,
        data: features,
      });
    } catch (error) {
      console.error('Get all features error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ==================== BILLING OVERRIDES ====================

  /**
   * Get billing status for an association
   */
  async getBillingStatus(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);

      const status = await BillingOverrideService.getBillingStatus(associationId);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Get billing status error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Create a billing override
   */
  async createBillingOverride(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { overrideType, value, reason, endDate } = billingOverrideSchema.parse(req.body);

      const override = await BillingOverrideService.createOverride({
        associationId,
        overrideType: overrideType as any,
        value,
        reason,
        endDate: endDate ? new Date(endDate) : undefined,
        createdBy: actorId,
      });

      return res.json({
        success: true,
        message: 'Billing override created successfully',
        data: override,
      });
    } catch (error) {
      console.error('Create billing override error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Revoke a billing override
   */
  async revokeBillingOverride(req: AuthRequest, res: Response) {
    try {
      const overrideId = Number(req.params.overrideId);
      const actorId = req.user?.id;
      const reason = req.body.reason as string | undefined;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const override = await BillingOverrideService.revokeOverride(overrideId, actorId, reason);

      return res.json({
        success: true,
        message: 'Billing override revoked successfully',
        data: override,
      });
    } catch (error) {
      console.error('Revoke billing override error:', error);
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Extend trial for an association
   */
  async extendTrial(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { days, reason } = extendTrialSchema.parse(req.body);

      const override = await BillingOverrideService.extendTrial(associationId, days, reason, actorId);

      return res.json({
        success: true,
        message: `Trial extended by ${days} days`,
        data: override,
      });
    } catch (error) {
      console.error('Extend trial error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Apply credit to an association
   */
  async applyCredit(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const actorId = req.user?.id;

      if (!actorId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { amount, reason } = applyCreditSchema.parse(req.body);

      const override = await BillingOverrideService.applyCredit(associationId, amount, reason, actorId);

      return res.json({
        success: true,
        message: `Credit of ${amount} applied`,
        data: override,
      });
    } catch (error) {
      console.error('Apply credit error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get billing override history
   */
  async getBillingOverrideHistory(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const limit = Number(req.query.limit) || 50;

      const history = await BillingOverrideService.getOverrideHistory(associationId, limit);

      return res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Get billing override history error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ==================== PLATFORM ACTION LOGS ====================

  /**
   * Get platform action logs
   */
  async getActionLogs(req: AuthRequest, res: Response) {
    try {
      const filters = actionLogFilterSchema.parse(req.query);

      const result = await PlatformActionLogService.getActionLogs(
        {
          actorId: filters.actorId,
          actionType: filters.actionType,
          targetType: filters.targetType,
          associationId: filters.associationId,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        },
        filters.page,
        filters.limit
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get action logs error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get action log statistics
   */
  async getActionLogStats(req: AuthRequest, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await PlatformActionLogService.getActionStats(startDate, endDate);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get action log stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Export action logs
   */
  async exportActionLogs(req: AuthRequest, res: Response) {
    try {
      const format = (req.query.format as 'json' | 'csv') || 'json';
      const filters = actionLogFilterSchema.parse(req.query);

      const result = await PlatformActionLogService.exportActionLogs(
        {
          actorId: filters.actorId,
          actionType: filters.actionType,
          targetType: filters.targetType,
          associationId: filters.associationId,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        },
        format
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=platform-action-logs.csv');
        return res.send((result as any).content);
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Export action logs error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
