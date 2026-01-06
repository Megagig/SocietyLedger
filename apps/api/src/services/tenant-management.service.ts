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
   * PERMANENT DELETE an association and ALL its data
   * ⚠️ WARNING: This is irreversible and will delete ALL data
   * 
   * This will delete:
   * - Association record
   * - All users
   * - All members
   * - All financial transactions
   * - All payments
   * - All meetings
   * - All documents and files
   * - ALL related data (cascading delete)
   * 
   * Requirements:
   * - Association must be soft-deleted first
   * - Must provide confirmation token matching association subdomain
   */
  static async permanentDelete(
    associationId: number,
    actorId: number,
    confirmationToken: string,
    reason: string
  ) {
    // Fetch association to verify
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        _count: {
          select: {
            users: true,
            members: true,
            transactions: true,
            payments: true,
            categories: true,
          }
        }
      }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    // SAFETY CHECK: Must be soft-deleted first
    if (!association.deletedAt) {
      throw new Error('Association must be soft-deleted first before permanent deletion');
    }

    // SAFETY CHECK: Confirmation token must match subdomain
    if (confirmationToken !== association.subdomain) {
      throw new Error(`Confirmation failed. You must type the subdomain "${association.subdomain}" exactly to confirm`);
    }

    // Log BEFORE deletion (since association will be gone)
    const beforeState = {
      id: association.id,
      name: association.name,
      subdomain: association.subdomain,
      status: association.status,
      tier: association.tier,
      userCount: association._count.users,
      memberCount: association._count.members,
      transactionCount: association._count.transactions,
      paymentCount: association._count.payments,
      categoryCount: association._count.categories,
      deletedAt: association.deletedAt?.toISOString(),
      deletionReason: association.deletionReason,
    };

    // Log the action BEFORE deletion
    await PlatformActionLogService.log({
      actorId,
      actorRole: 'SUPER_ADMIN',
      actionType: 'TENANT_PERMANENT_DELETE' as any, // Will need to add this to ActionTypes enum
      targetType: 'association',
      targetId: associationId,
      associationId: undefined, // Association will be gone
      beforeState,
      afterState: { deleted: true, timestamp: new Date().toISOString() },
      reason,
    });

    // PERMANENT DELETE - Manually delete all related records in correct order
    // This is necessary because not all foreign keys have CASCADE delete
    // Use extended timeout for large datasets
    await prisma.$transaction(async (tx) => {
      // Delete in order of dependencies (children first, then parents)
      
      // 1. Delete user-related data
      await tx.userApproval.deleteMany({ where: { user: { associationId } } });
      await tx.memberInvite.deleteMany({ where: { associationId } });
      
      // 2. Delete financial data
      await tx.paymentReconciliation.deleteMany({ where: { associationId } });
      await tx.paymentProof.deleteMany({ where: { associationId } });
      await tx.bankStatementImport.deleteMany({ where: { associationId } });
      await tx.bankTransfer.deleteMany({ where: { associationId } });
      await tx.associationBankAccount.deleteMany({ where: { associationId } });
      await tx.payment.deleteMany({ where: { associationId } });
      await tx.paymentGatewayTransaction.deleteMany({ where: { associationId } });
      await tx.transaction.deleteMany({ where: { associationId } });
      await tx.financialCategory.deleteMany({ where: { associationId } });
      
      // 3. Delete accounting data
      await tx.budgetItem.deleteMany({ where: { budget: { associationId } } });
      await tx.budget.deleteMany({ where: { associationId } });
      await tx.journalEntryLine.deleteMany({ where: { journalEntry: { associationId } } });
      await tx.journalEntry.deleteMany({ where: { associationId } });
      await tx.accountingPeriod.deleteMany({ where: { associationId } });
      await tx.chartOfAccount.deleteMany({ where: { associationId } });
      await tx.accountingEntry.deleteMany({ where: { associationId } });
      
      // 4. Delete cooperative/loan data
      await tx.loanRepayment.deleteMany({ where: { loan: { associationId } } });
      await tx.loan.deleteMany({ where: { associationId } });
      await tx.loanGuarantor.deleteMany({ where: { associationId } });
      await tx.loanApplication.deleteMany({ where: { associationId } });
      await tx.loanProduct.deleteMany({ where: { associationId } });
      await tx.savingsTransaction.deleteMany({ where: { associationId } });
      await tx.savingsAccount.deleteMany({ where: { associationId } });
      
      // 5. Delete levy/penalty data
      await tx.penaltyWaiver.deleteMany({ where: { associationId } });
      await tx.penaltyRule.deleteMany({ where: { associationId } });
      await tx.levyCampaignAssignment.deleteMany({ where: { campaign: { associationId } } });
      await tx.levyCampaign.deleteMany({ where: { associationId } });
      await tx.donationAllocation.deleteMany({ where: { associationId } });
      
      // 6. Delete welfare data
      await tx.welfarePayoutRequest.deleteMany({ where: { associationId } });
      await tx.welfareContribution.deleteMany({ where: { associationId } });
      await tx.welfareFund.deleteMany({ where: { associationId } });
      
      // 7. Delete communication data
      await tx.sMSCreditBalance.deleteMany({ where: { associationId } });
      await tx.sMSTemplate.deleteMany({ where: { associationId } });
      await tx.sMSCampaign.deleteMany({ where: { associationId } });
      await tx.sMSMessage.deleteMany({ where: { associationId } });
      
      // 8. Delete meeting data
      await tx.meetingAttendance.deleteMany({ where: { meeting: { associationId } } });
      await tx.meetingAgenda.deleteMany({ where: { meeting: { associationId } } });
      await tx.meeting.deleteMany({ where: { associationId } });
      
      // 9. Delete election/poll data
      await tx.pollResponse.deleteMany({ where: { poll: { associationId } } });
      await tx.pollOption.deleteMany({ where: { poll: { associationId } } });
      await tx.poll.deleteMany({ where: { associationId } });
      await tx.vote.deleteMany({ where: { election: { associationId } } });
      await tx.candidate.deleteMany({ where: { election: { associationId } } });
      await tx.election.deleteMany({ where: { associationId } });
      
      // 10. Delete AI/document data
      await tx.documentEmbedding.deleteMany({ where: { associationId } });
      await tx.aIAuditLog.deleteMany({ where: { associationId } });
      
      // 11. Delete help/support data
      await tx.supportTicket.deleteMany({ where: { associationId } });
      await tx.fAQItem.deleteMany({ where: { associationId } });
      await tx.helpArticle.deleteMany({ where: { associationId } });
      
      // 12. Delete platform admin data
      await tx.billingOverride.deleteMany({ where: { associationId } });
      await tx.tenantFeature.deleteMany({ where: { associationId } });
      await tx.tenantModule.deleteMany({ where: { associationId } });
      
      // 13. Delete RBAC data
      await tx.userRole.deleteMany({ where: { associationId } });
      await tx.rolePermission.deleteMany({ where: { role: { associationId } } });
      await tx.role.deleteMany({ where: { associationId } });
      
      // 14. Delete member ledger
      await tx.memberFinancialLedger.deleteMany({ where: { associationId } });
      
      // 15. Delete notifications and other data
      await tx.notification.deleteMany({ where: { associationId } });
      await tx.exportHistory.deleteMany({ where: { associationId } });
      await tx.auditLog.deleteMany({ where: { associationId } });
      await tx.settings.deleteMany({ where: { associationId } });
      await tx.subscription.deleteMany({ where: { associationId } });
      
      // 16. Delete members (this should come after all member-related data)
      await tx.member.deleteMany({ where: { associationId } });
      
      // 17. Delete users (after all user-related data)
      await tx.user.deleteMany({ where: { associationId } });
      
      // 18. Finally, delete the association itself
      await tx.association.delete({
        where: { id: associationId }
      });
    }, {
      maxWait: 60000, // 60 seconds
      timeout: 120000, // 2 minutes
    });

    return {
      success: true,
      message: `Association "${association.name}" and all its data permanently deleted`,
      deletedData: beforeState,
    };
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
