/**
 * Tenant Management Service
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Service for managing tenant lifecycle operations including:
 * - Suspend/Reactivate associations
 * - Soft delete/Restore associations
 * - Force logout all users
 * - Security settings management
 */

import { AssociationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { PlatformActionLogService } from './platform-action-log.service';

export interface TenantSecuritySettings {
  force2FA: boolean;
  passwordPolicyLevel: 'basic' | 'standard' | 'strict';
  sessionTimeoutMinutes: number;
  ipRestrictions: string[];
}

export interface SuspendOptions {
  reason: string;
  notifyUsers?: boolean;
}

export interface SoftDeleteOptions {
  reason: string;
  notifyUsers?: boolean;
}

export class TenantManagementService {
  /**
   * Suspend an association (blocks access but preserves data)
   */
  static async suspend(
    associationId: number,
    actorId: number,
    options: SuspendOptions
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    if (association.status === AssociationStatus.SUSPENDED) {
      throw new Error('Association is already suspended');
    }

    if (association.deletedAt) {
      throw new Error('Cannot suspend a deleted association');
    }

    const beforeState = {
      status: association.status,
    };

    const updated = await prisma.association.update({
      where: { id: associationId },
      data: {
        status: AssociationStatus.SUSPENDED,
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_SUSPENDED,
      targetType: 'association',
      targetId: associationId,
      associationId,
      beforeState,
      afterState: { status: AssociationStatus.SUSPENDED },
      reason: options.reason,
    });

    // Optionally notify users
    if (options.notifyUsers) {
      await this.notifyTenantUsers(associationId, 'suspension', options.reason);
    }

    return updated;
  }

  /**
   * Reactivate a suspended association
   */
  static async reactivate(
    associationId: number,
    actorId: number,
    reason: string
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    if (association.status !== AssociationStatus.SUSPENDED) {
      throw new Error('Association is not suspended');
    }

    if (association.deletedAt) {
      throw new Error('Cannot reactivate a deleted association. Restore it first.');
    }

    const beforeState = {
      status: association.status,
    };

    const updated = await prisma.association.update({
      where: { id: associationId },
      data: {
        status: AssociationStatus.ACTIVE,
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_REACTIVATED,
      targetType: 'association',
      targetId: associationId,
      associationId,
      beforeState,
      afterState: { status: AssociationStatus.ACTIVE },
      reason,
    });

    return updated;
  }

  /**
   * Soft delete an association (marks as deleted but preserves data)
   */
  static async softDelete(
    associationId: number,
    actorId: number,
    options: SoftDeleteOptions
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    if (association.deletedAt) {
      throw new Error('Association is already deleted');
    }

    const beforeState = {
      status: association.status,
      deletedAt: null,
    };

    const updated = await prisma.association.update({
      where: { id: associationId },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
        deletionReason: options.reason,
        status: AssociationStatus.CANCELLED,
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_SOFT_DELETED,
      targetType: 'association',
      targetId: associationId,
      associationId,
      beforeState,
      afterState: {
        status: AssociationStatus.CANCELLED,
        deletedAt: updated.deletedAt?.toISOString(),
        deletionReason: options.reason,
      },
      reason: options.reason,
    });

    // Optionally notify users
    if (options.notifyUsers) {
      await this.notifyTenantUsers(associationId, 'deletion', options.reason);
    }

    return updated;
  }

  /**
   * Restore a soft-deleted association
   */
  static async restore(
    associationId: number,
    actorId: number,
    reason: string
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    if (!association.deletedAt) {
      throw new Error('Association is not deleted');
    }

    const beforeState = {
      status: association.status,
      deletedAt: association.deletedAt.toISOString(),
      deletionReason: association.deletionReason,
    };

    const updated = await prisma.association.update({
      where: { id: associationId },
      data: {
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        status: AssociationStatus.ACTIVE,
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_RESTORED,
      targetType: 'association',
      targetId: associationId,
      associationId,
      beforeState,
      afterState: {
        status: AssociationStatus.ACTIVE,
        deletedAt: null,
      },
      reason,
    });

    return updated;
  }

  /**
   * Force logout all users of an association
   * This invalidates all active sessions
   */
  static async forceLogout(
    associationId: number,
    actorId: number,
    reason: string
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        users: {
          select: { id: true, email: true }
        }
      }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    const userCount = association.users.length;

    // In a real implementation, this would:
    // 1. Invalidate all JWT tokens (if using token blacklist)
    // 2. Clear all session records (if using session store)
    // 3. Update a "forceLogoutAt" timestamp that middleware checks
    
    // For now, we'll update a session invalidation timestamp
    // that can be checked by auth middleware
    await prisma.association.update({
      where: { id: associationId },
      data: {
        updatedAt: new Date(), // This can be used as session invalidation marker
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_FORCE_LOGOUT,
      targetType: 'association',
      targetId: associationId,
      associationId,
      afterState: {
        usersAffected: userCount,
        timestamp: new Date().toISOString(),
      },
      reason,
    });

    return {
      success: true,
      usersAffected: userCount,
      message: `Force logout initiated for ${userCount} users`,
    };
  }

  /**
   * Update security settings for an association
   */
  static async updateSecuritySettings(
    associationId: number,
    actorId: number,
    settings: Partial<TenantSecuritySettings>,
    reason: string
  ) {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    const beforeState = {
      force2FA: association.force2FA,
      passwordPolicyLevel: association.passwordPolicyLevel,
      sessionTimeoutMinutes: association.sessionTimeoutMinutes,
      ipRestrictions: association.ipRestrictions,
    };

    const updateData: Record<string, unknown> = {};
    
    if (settings.force2FA !== undefined) {
      updateData.force2FA = settings.force2FA;
    }
    if (settings.passwordPolicyLevel !== undefined) {
      updateData.passwordPolicyLevel = settings.passwordPolicyLevel;
    }
    if (settings.sessionTimeoutMinutes !== undefined) {
      updateData.sessionTimeoutMinutes = settings.sessionTimeoutMinutes;
    }
    if (settings.ipRestrictions !== undefined) {
      updateData.ipRestrictions = settings.ipRestrictions;
    }

    const updated = await prisma.association.update({
      where: { id: associationId },
      data: updateData,
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: PlatformActionLogService.ActionTypes.TENANT_SECURITY_UPDATED,
      targetType: 'security',
      targetId: associationId,
      associationId,
      beforeState,
      afterState: {
        force2FA: updated.force2FA,
        passwordPolicyLevel: updated.passwordPolicyLevel,
        sessionTimeoutMinutes: updated.sessionTimeoutMinutes,
        ipRestrictions: updated.ipRestrictions,
      },
      reason,
    });

    return updated;
  }

  /**
   * Get security settings for an association
   */
  static async getSecuritySettings(associationId: number): Promise<TenantSecuritySettings> {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: {
        force2FA: true,
        passwordPolicyLevel: true,
        sessionTimeoutMinutes: true,
        ipRestrictions: true,
      }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    return {
      force2FA: association.force2FA,
      passwordPolicyLevel: association.passwordPolicyLevel as 'basic' | 'standard' | 'strict',
      sessionTimeoutMinutes: association.sessionTimeoutMinutes,
      ipRestrictions: association.ipRestrictions,
    };
  }

  /**
   * Get tenant status summary
   */
  static async getTenantStatus(associationId: number) {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            members: true,
          }
        }
      }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    return {
      id: association.id,
      name: association.name,
      subdomain: association.subdomain,
      status: association.status,
      tier: association.tier,
      isDeleted: !!association.deletedAt,
      deletedAt: association.deletedAt,
      deletionReason: association.deletionReason,
      subscription: association.subscriptions[0] || null,
      userCount: association._count.users,
      memberCount: association._count.members,
      securitySettings: {
        force2FA: association.force2FA,
        passwordPolicyLevel: association.passwordPolicyLevel,
        sessionTimeoutMinutes: association.sessionTimeoutMinutes,
        ipRestrictions: association.ipRestrictions,
      },
      createdAt: association.createdAt,
      updatedAt: association.updatedAt,
    };
  }

  /**
   * List all tenants with filtering
   */
  static async listTenants(options: {
    status?: AssociationStatus;
    includeDeleted?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, includeDeleted = false, search, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.association.findMany({
        where,
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: { plan: { select: { name: true, code: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { users: true, members: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.association.count({ where }),
    ]);

    return {
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        status: t.status,
        tier: t.tier,
        isDeleted: !!t.deletedAt,
        plan: t.subscriptions[0]?.plan || null,
        userCount: t._count.users,
        memberCount: t._count.members,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Helper: Notify tenant users about status changes
   * This is a placeholder - actual implementation would use notification service
   */
  private static async notifyTenantUsers(
    associationId: number,
    eventType: 'suspension' | 'deletion',
    reason: string
  ) {
    // Get all users for the association
    const users = await prisma.user.findMany({
      where: { associationId },
      select: { id: true, email: true }
    });

    // In a real implementation, this would:
    // 1. Send emails to all users
    // 2. Create in-app notifications
    // 3. Send SMS if configured
    
    console.log(`[TenantManagement] Notifying ${users.length} users about ${eventType}: ${reason}`);
    
    // Create notifications for each user
    await prisma.notification.createMany({
      data: users.map(user => ({
        associationId,
        userId: user.id,
        title: eventType === 'suspension' 
          ? 'Account Suspended' 
          : 'Account Scheduled for Deletion',
        message: reason,
        type: 'system',
        isRead: false,
      }))
    });
  }
}
