/**
 * Platform Action Log Service
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Service for logging and querying platform admin actions.
 * Provides comprehensive audit trail for all platform-level operations.
 */

import { PlatformActionLog } from '@prisma/client';
import prisma from '../lib/prisma';

export interface PlatformActionLogData {
  actorId: number;
  actorRole: string;
  actionType: string;
  targetType: 'association' | 'user' | 'module' | 'feature' | 'billing' | 'security' | 'plan';
  targetId?: number;
  associationId?: number;
  beforeState?: object;
  afterState?: object;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActionLogFilters {
  actorId?: number;
  actionType?: string;
  targetType?: string;
  associationId?: number;
  startDate?: Date;
  endDate?: Date;
}

export class PlatformActionLogService {
  /**
   * Log a platform action
   */
  static async log(data: PlatformActionLogData): Promise<void> {
    // Check if logging is enabled (default: true)
    const loggingEnabled = process.env.LOG_PLATFORM_ACTIONS !== 'false';
    
    if (!loggingEnabled) {
      return;
    }

    try {
      await prisma.platformActionLog.create({
        data: {
          actorId: data.actorId,
          actorRole: data.actorRole,
          actionType: data.actionType,
          targetType: data.targetType,
          targetId: data.targetId,
          associationId: data.associationId,
          beforeState: data.beforeState,
          afterState: data.afterState,
          reason: data.reason,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        }
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break operations
      console.error('Failed to log platform action:', error);
    }
  }

  /**
   * Get action logs with filtering and pagination
   */
  static async getActionLogs(
    filters: ActionLogFilters = {},
    page = 1,
    limit = 50
  ) {
    const where: Record<string, unknown> = {};

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.actionType) {
      where.actionType = filters.actionType;
    }

    if (filters.targetType) {
      where.targetType = filters.targetType;
    }

    if (filters.associationId) {
      where.associationId = filters.associationId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.platformActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.platformActionLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get action logs for a specific association
   */
  static async getAssociationLogs(associationId: number, page = 1, limit = 50) {
    return this.getActionLogs({ associationId }, page, limit);
  }

  /**
   * Get action logs by actor
   */
  static async getActorLogs(actorId: number, page = 1, limit = 50) {
    return this.getActionLogs({ actorId }, page, limit);
  }

  /**
   * Get recent actions (last 24 hours)
   */
  static async getRecentActions(limit = 100) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return prisma.platformActionLog.findMany({
      where: {
        createdAt: { gte: yesterday }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get action statistics
   */
  static async getActionStats(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = startDate;
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = endDate;
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayWhere = { ...where, createdAt: { ...(where.createdAt as object), gte: todayStart } };

    const [totalActions, actionsByType, actionsByTarget, actionsToday, actorGroups] = await Promise.all([
      prisma.platformActionLog.count({ where }),
      prisma.platformActionLog.groupBy({
        by: ['actionType'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.platformActionLog.groupBy({
        by: ['targetType'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.platformActionLog.count({ where: todayWhere }),
      prisma.platformActionLog.groupBy({ by: ['actorId'], where }),
    ]);

    return {
      totalActions,
      actionsToday,
      uniqueAdmins: actorGroups.length,
      mostCommonAction: actionsByType[0]?.actionType ?? null,
      actionsByType: actionsByType.map((a: { actionType: string; _count: { id: number } }) => ({
        type: a.actionType,
        count: a._count.id,
      })),
      actionsByTarget: actionsByTarget.map((a: { targetType: string; _count: { id: number } }) => ({
        target: a.targetType,
        count: a._count.id,
      })),
    };
  }

  /**
   * Export action logs to JSON format
   */
  static async exportActionLogs(
    filters: ActionLogFilters = {},
    format: 'json' | 'csv' = 'json'
  ) {
    const where: Record<string, unknown> = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.associationId) where.associationId = filters.associationId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const logs = await prisma.platformActionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit export to 10k records
    });

    if (format === 'csv') {
      const headers = [
        'id', 'actorId', 'actorRole', 'actionType', 'targetType',
        'targetId', 'associationId', 'reason', 'ipAddress', 'createdAt'
      ];
      
      const rows = logs.map((log: PlatformActionLog) => [
        log.id,
        log.actorId,
        log.actorRole,
        log.actionType,
        log.targetType,
        log.targetId || '',
        log.associationId || '',
        log.reason || '',
        log.ipAddress || '',
        log.createdAt.toISOString(),
      ]);

      return {
        format: 'csv',
        headers,
        rows,
        content: [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n'),
      };
    }

    return {
      format: 'json',
      data: logs,
      count: logs.length,
    };
  }

  /**
   * Predefined action types for consistency
   */
  static readonly ActionTypes = {
    // Tenant Management
    TENANT_SUSPENDED: 'TENANT_SUSPENDED',
    TENANT_REACTIVATED: 'TENANT_REACTIVATED',
    TENANT_SOFT_DELETED: 'TENANT_SOFT_DELETED',
    TENANT_RESTORED: 'TENANT_RESTORED',
    TENANT_FORCE_LOGOUT: 'TENANT_FORCE_LOGOUT',
    TENANT_SECURITY_UPDATED: 'TENANT_SECURITY_UPDATED',
    
    // Module & Feature Management
    MODULE_OVERRIDE_SET: 'MODULE_OVERRIDE_SET',
    MODULE_OVERRIDE_REMOVED: 'MODULE_OVERRIDE_REMOVED',
    FEATURE_OVERRIDE_SET: 'FEATURE_OVERRIDE_SET',
    FEATURE_OVERRIDE_REMOVED: 'FEATURE_OVERRIDE_REMOVED',
    
    // Billing Management
    BILLING_OVERRIDE_CREATED: 'BILLING_OVERRIDE_CREATED',
    BILLING_OVERRIDE_REVOKED: 'BILLING_OVERRIDE_REVOKED',
    TRIAL_EXTENDED: 'TRIAL_EXTENDED',
    BILLING_BYPASSED: 'BILLING_BYPASSED',
    BILLING_PAUSED: 'BILLING_PAUSED',
    CREDIT_APPLIED: 'CREDIT_APPLIED',
    MARKED_PAID_EXTERNAL: 'MARKED_PAID_EXTERNAL',
    GRACE_PERIOD_GRANTED: 'GRACE_PERIOD_GRANTED',
    
    // Plan Management
    PLAN_CHANGED: 'PLAN_CHANGED',
    PLAN_CREATED: 'PLAN_CREATED',
    PLAN_UPDATED: 'PLAN_UPDATED',
    
    // User Management
    USER_IMPERSONATED: 'USER_IMPERSONATED',
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  } as const;
}
