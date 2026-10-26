/**
 * Platform Settings Service
 * Phase 18: TASK-SET-025
 * 
 * Super Admin only - Platform-wide configuration management
 */

import prisma from '../../lib/prisma';

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  maxAssociationsPerUser: number;
  defaultTrialDays: number;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
  /** When on (the default), an association whose trial or subscription has run out is blocked until it pays. */
  enforceSubscriptionAccess: boolean;
  /**
   * What a new association gets once its founding admin is approved. TRIAL: a free trial of `defaultTrialDays`. COMPLIMENTARY: the same
   * length, recorded as a complimentary (unpaid) subscription rather than a trial. BILLABLE: no free time, the association must pay first.
   */
  onboardingPolicy: 'TRIAL' | 'COMPLIMENTARY' | 'BILLABLE';
  /** Code of the plan new associations are given (it must have a published version). */
  onboardingPlanCode: string;
  /** Days of continued access after a paid period ends without renewal. 0 turns the grace period off. */
  gracePeriodDays: number;
  /** How many days before a period ends the owner is reminded, e.g. [7, 3, 1]. */
  expiryReminderDays: number[];
  defaultAssociationTier: string;
  platformVersion: string;
}

export class SettingsValidationError extends Error {}

const POLICIES = ['TRIAL', 'COMPLIMENTARY', 'BILLABLE'] as const;

/**
 * Check the billing-related settings before they are stored. Everything else is passed through as before. These values decide who is
 * locked out and when, so a typo must be refused, not saved.
 */
async function validateBillingSettings(input: Partial<PlatformSettings>): Promise<Partial<PlatformSettings>> {
  const out: Record<string, unknown> = { ...input };

  if (input.onboardingPolicy !== undefined && !POLICIES.includes(input.onboardingPolicy as (typeof POLICIES)[number])) {
    throw new SettingsValidationError('The onboarding policy must be TRIAL, COMPLIMENTARY or BILLABLE.');
  }
  if (input.defaultTrialDays !== undefined) {
    const n = Number(input.defaultTrialDays);
    if (!Number.isInteger(n) || n < 1 || n > 90) throw new SettingsValidationError('The onboarding duration must be a whole number of days from 1 to 90.');
    out.defaultTrialDays = n;
  }
  if (input.gracePeriodDays !== undefined) {
    const n = Number(input.gracePeriodDays);
    if (!Number.isInteger(n) || n < 0 || n > 30) throw new SettingsValidationError('The grace period must be a whole number of days from 0 to 30.');
    out.gracePeriodDays = n;
  }
  if (input.expiryReminderDays !== undefined) {
    const list = Array.isArray(input.expiryReminderDays) ? input.expiryReminderDays : null;
    if (!list || list.length > 6 || !list.every((d) => Number.isInteger(Number(d)) && Number(d) >= 1 && Number(d) <= 60)) {
      throw new SettingsValidationError('Reminder days must be up to 6 whole numbers between 1 and 60.');
    }
    out.expiryReminderDays = [...new Set(list.map(Number))].sort((a, b) => b - a);
  }
  if (input.onboardingPlanCode !== undefined) {
    const code = String(input.onboardingPlanCode).trim().toLowerCase();
    const plan = await prisma.plan.findFirst({
      where: { code, isArchived: false, versions: { some: { status: 'PUBLISHED' } } },
      select: { id: true },
    });
    if (!plan) throw new SettingsValidationError(`"${code}" is not a plan with a published version, so new associations cannot be given it.`);
    out.onboardingPlanCode = code;
  }
  return out as Partial<PlatformSettings>;
}

export interface PlatformStats {
  totalAssociations: number;
  activeAssociations: number;
  suspendedAssociations: number;
  totalUsers: number;
  totalMembers: number;
  totalTransactions: number;
  pendingApprovals: number;
}

export interface AssociationOverride {
  associationId: number;
  maxMembers?: number;
  maxUsers?: number;
  customFeatures?: string[];
  notes?: string;
}

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  maxAssociationsPerUser: 3,
  defaultTrialDays: 14,
  allowNewSignups: true,
  requireEmailVerification: true,
  requireAdminApproval: true,
  enforceSubscriptionAccess: true,
  onboardingPolicy: 'TRIAL',
  onboardingPlanCode: 'enterprise',
  gracePeriodDays: 3,
  expiryReminderDays: [7, 3, 1],
  defaultAssociationTier: 'STARTER',
  platformVersion: '1.0.0',
};

export class PlatformSettingsService {
  /**
   * Get platform settings
   * Note: Platform settings are stored using raw SQL since associationId is required in schema
   */
  static async getSettings(): Promise<PlatformSettings> {
    const settings = await prisma.$queryRaw<Array<{ key: string; value: string | null }>>`
      SELECT key, value FROM settings 
      WHERE association_id IS NULL AND key LIKE 'platform.%'
    `;

    const result: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

    for (const setting of settings) {
      const key = setting.key.replace('platform.', '') as keyof PlatformSettings;
      try {
        (result as any)[key] = setting.value ? JSON.parse(setting.value) : null;
      } catch {
        (result as any)[key] = setting.value;
      }
    }

    return result;
  }

  /**
   * Update platform settings
   */
  static async updateSettings(
    settings: Partial<PlatformSettings>,
    userId: number
  ): Promise<PlatformSettings> {
    settings = await validateBillingSettings(settings);
    for (const [key, value] of Object.entries(settings)) {
      const fullKey = `platform.${key}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // Platform settings use associationId = null, but Prisma unique constraint needs a workaround
      // We'll use a special "platform" record approach
      const existing = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM settings WHERE association_id IS NULL AND key = ${fullKey} LIMIT 1
      `;

      if (existing.length > 0) {
        await prisma.settings.update({
          where: { id: existing[0].id },
          data: { value: stringValue, updatedBy: userId }
        });
      } else {
        // For platform settings, we need to handle the null associationId case
        await prisma.$executeRaw`
          INSERT INTO settings (key, value, description, updated_by, created_at, updated_at)
          VALUES (${fullKey}, ${stringValue}, ${'Platform setting: ' + key}, ${userId}, NOW(), NOW())
          ON CONFLICT (association_id, key) WHERE association_id IS NULL
          DO UPDATE SET value = ${stringValue}, updated_by = ${userId}, updated_at = NOW()
        `;
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PLATFORM_SETTINGS_UPDATED',
        tableName: 'settings',
        newValues: JSON.parse(JSON.stringify(settings))
      }
    });

    // The access rules read these (grace period, enforcement) from a short cache; drop it so the change applies at once.
    const { invalidateAccessCache } = await import('../../services/subscription-access.service');
    invalidateAccessCache();

    return this.getSettings();
  }

  /**
   * Get platform statistics
   */
  static async getStats(): Promise<PlatformStats> {
    const [
      totalAssociations,
      activeAssociations,
      suspendedAssociations,
      totalUsers,
      totalMembers,
      totalTransactions,
      pendingApprovals
    ] = await Promise.all([
      prisma.association.count(),
      prisma.association.count({ where: { status: 'ACTIVE' } }),
      prisma.association.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.member.count(),
      prisma.transaction.count(),
      prisma.userApproval.count({ where: { approvalStatus: 'PENDING' } })
    ]);

    return {
      totalAssociations,
      activeAssociations,
      suspendedAssociations,
      totalUsers,
      totalMembers,
      totalTransactions,
      pendingApprovals
    };
  }

  /**
   * Override limits for a specific association
   */
  static async setAssociationOverride(
    override: AssociationOverride,
    userId: number
  ): Promise<void> {
    const { associationId, ...limits } = override;

    // Verify association exists
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    // Store overrides as settings
    for (const [key, value] of Object.entries(limits)) {
      if (value !== undefined) {
        const fullKey = `override.${key}`;
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        await prisma.settings.upsert({
          where: { associationId_key: { associationId, key: fullKey } },
          update: { value: stringValue, updatedBy: userId },
          create: {
            associationId,
            key: fullKey,
            value: stringValue,
            description: `Override: ${key}`,
            updatedBy: userId
          }
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'ASSOCIATION_OVERRIDE_SET',
        tableName: 'settings',
        newValues: JSON.parse(JSON.stringify(override))
      }
    });
  }

  /**
   * Get association overrides
   */
  static async getAssociationOverride(associationId: number): Promise<AssociationOverride | null> {
    const settings = await prisma.settings.findMany({
      where: {
        associationId,
        key: { startsWith: 'override.' }
      }
    });

    if (settings.length === 0) return null;

    const override: AssociationOverride = { associationId };

    for (const setting of settings) {
      const key = setting.key.replace('override.', '') as keyof Omit<AssociationOverride, 'associationId'>;
      try {
        (override as any)[key] = setting.value ? JSON.parse(setting.value) : null;
      } catch {
        (override as any)[key] = setting.value;
      }
    }

    return override;
  }
}
