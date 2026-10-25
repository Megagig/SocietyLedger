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
  defaultAssociationTier: string;
  platformVersion: string;
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
