/**
 * Billing Override Service
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Service for managing billing overrides and exceptions.
 * All overrides require a reason and are fully audited.
 */

import { BillingOverride, BillingOverrideType } from '@prisma/client';
import prisma from '../lib/prisma';
import { PlatformActionLogService } from './platform-action-log.service';

export interface BillingOverrideData {
  associationId: number;
  overrideType: BillingOverrideType;
  value?: string;
  reason: string;
  startDate?: Date;
  endDate?: Date;
  createdBy: number;
}

export interface BillingStatus {
  associationId: number;
  isBillingBypassed: boolean;
  isTrialExtended: boolean;
  isBillingPaused: boolean;
  isPaidExternally: boolean;
  hasGracePeriod: boolean;
  creditBalance: number;
  activeOverrides: Array<{
    id: number;
    type: BillingOverrideType;
    value?: string;
    reason: string;
    startDate: Date;
    endDate?: Date | null;
  }>;
}

export class BillingOverrideService {
  /**
   * Get all active billing overrides for an association
   */
  static async getActiveOverrides(associationId: number) {
    return prisma.billingOverride.findMany({
      where: {
        associationId,
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get comprehensive billing status for an association
   */
  static async getBillingStatus(associationId: number): Promise<BillingStatus> {
    const overrides = await this.getActiveOverrides(associationId);

    // Calculate credit balance from APPLY_CREDIT overrides
    const creditOverrides = overrides.filter((o: BillingOverride) => o.overrideType === 'APPLY_CREDIT');
    const creditBalance = creditOverrides.reduce((sum: number, o: BillingOverride) => {
      const value = parseFloat(o.value || '0');
      return sum + value;
    }, 0);

    return {
      associationId,
      isBillingBypassed: overrides.some((o: BillingOverride) => o.overrideType === 'BYPASS_BILLING'),
      isTrialExtended: overrides.some((o: BillingOverride) => o.overrideType === 'EXTEND_TRIAL'),
      isBillingPaused: overrides.some((o: BillingOverride) => o.overrideType === 'PAUSE_BILLING'),
      isPaidExternally: overrides.some((o: BillingOverride) => o.overrideType === 'MARK_PAID_EXTERNAL'),
      hasGracePeriod: overrides.some((o: BillingOverride) => o.overrideType === 'GRACE_PERIOD'),
      creditBalance,
      activeOverrides: overrides.map((o: BillingOverride) => ({
        id: o.id,
        type: o.overrideType,
        value: o.value || undefined,
        reason: o.reason,
        startDate: o.startDate,
        endDate: o.endDate,
      })),
    };
  }

  /**
   * Create a new billing override
   */
  static async createOverride(data: BillingOverrideData) {
    const override = await prisma.billingOverride.create({
      data: {
        associationId: data.associationId,
        overrideType: data.overrideType,
        value: data.value,
        reason: data.reason,
        startDate: data.startDate || new Date(),
        endDate: data.endDate,
        createdBy: data.createdBy,
        isActive: true,
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId: data.createdBy,
      actorRole: 'SUPER_ADMIN',
      actionType: 'BILLING_OVERRIDE_CREATED',
      targetType: 'billing',
      targetId: override.id,
      associationId: data.associationId,
      afterState: {
        overrideType: data.overrideType,
        value: data.value,
        reason: data.reason,
      },
      reason: data.reason,
    });

    return override;
  }

  /**
   * Revoke a billing override
   */
  static async revokeOverride(overrideId: number, revokedBy: number, reason?: string) {
    const override = await prisma.billingOverride.findUnique({
      where: { id: overrideId }
    });

    if (!override) {
      throw new Error('Billing override not found');
    }

    if (!override.isActive) {
      throw new Error('Billing override is already revoked');
    }

    const updated = await prisma.billingOverride.update({
      where: { id: overrideId },
      data: {
        isActive: false,
        revokedBy,
        revokedAt: new Date(),
      }
    });

    // Log the action
    await PlatformActionLogService.log({
      actorId: revokedBy,
      actorRole: 'SUPER_ADMIN',
      actionType: 'BILLING_OVERRIDE_REVOKED',
      targetType: 'billing',
      targetId: overrideId,
      associationId: override.associationId,
      beforeState: {
        overrideType: override.overrideType,
        isActive: true,
      },
      afterState: {
        overrideType: override.overrideType,
        isActive: false,
      },
      reason: reason || 'Override revoked',
    });

    return updated;
  }

  /**
   * Extend trial period for an association
   */
  static async extendTrial(
    associationId: number,
    days: number,
    reason: string,
    createdBy: number
  ) {
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + days);

    // Create the override
    const override = await this.createOverride({
      associationId,
      overrideType: 'EXTEND_TRIAL',
      value: JSON.stringify({ days, newEndDate: newEndDate.toISOString() }),
      reason,
      endDate: newEndDate,
      createdBy,
    });

    // Update the subscription trial end date
    const subscription = await prisma.subscription.findFirst({
      where: {
        associationId,
        status: { in: ['TRIALING', 'ACTIVE'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          trialEndsAt: newEndDate,
          status: 'TRIALING',
        }
      });
    }

    return override;
  }

  /**
   * Bypass billing for an association (free access)
   */
  static async bypassBilling(
    associationId: number,
    reason: string,
    createdBy: number,
    endDate?: Date
  ) {
    return this.createOverride({
      associationId,
      overrideType: 'BYPASS_BILLING',
      reason,
      endDate,
      createdBy,
    });
  }

  /**
   * Pause billing temporarily
   */
  static async pauseBilling(
    associationId: number,
    reason: string,
    createdBy: number,
    resumeDate: Date
  ) {
    return this.createOverride({
      associationId,
      overrideType: 'PAUSE_BILLING',
      reason,
      endDate: resumeDate,
      createdBy,
    });
  }

  /**
   * Apply credit to an association's account
   */
  static async applyCredit(
    associationId: number,
    amount: number,
    reason: string,
    createdBy: number
  ) {
    return this.createOverride({
      associationId,
      overrideType: 'APPLY_CREDIT',
      value: amount.toString(),
      reason,
      createdBy,
    });
  }

  /**
   * Mark association as paid externally (e.g., bank transfer, cash)
   */
  static async markPaidExternally(
    associationId: number,
    reason: string,
    createdBy: number,
    validUntil: Date
  ) {
    // Create the override
    const override = await this.createOverride({
      associationId,
      overrideType: 'MARK_PAID_EXTERNAL',
      reason,
      endDate: validUntil,
      createdBy,
    });

    // Update subscription status to ACTIVE
    const subscription = await prisma.subscription.findFirst({
      where: {
        associationId,
        status: { in: ['TRIALING', 'PAST_DUE', 'EXPIRED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: validUntil,
        }
      });
    }

    return override;
  }

  /**
   * Grant grace period for payment
   */
  static async grantGracePeriod(
    associationId: number,
    days: number,
    reason: string,
    createdBy: number
  ) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.createOverride({
      associationId,
      overrideType: 'GRACE_PERIOD',
      value: JSON.stringify({ days }),
      reason,
      endDate,
      createdBy,
    });
  }

  /**
   * Check if billing should be processed for an association
   * Returns false if any bypass/pause override is active
   */
  static async shouldProcessBilling(associationId: number): Promise<boolean> {
    const status = await this.getBillingStatus(associationId);
    
    if (status.isBillingBypassed) return false;
    if (status.isBillingPaused) return false;
    if (status.isPaidExternally) return false;
    if (status.hasGracePeriod) return false;
    
    return true;
  }

  /**
   * Get override history for an association
   */
  static async getOverrideHistory(associationId: number, limit = 50) {
    return prisma.billingOverride.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
