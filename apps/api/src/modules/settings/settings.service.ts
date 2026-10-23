/**
 * Settings Service
 * Phase 18: Settings Page Architecture
 * 
 * Handles CRUD operations for association settings with audit logging
 */

import prisma from '../../lib/prisma';
import { 
  SettingsCategory, 
  AssociationProfileSettings,
  MembersAccessSettings,
  FinancialSettings,
  PaymentsSettings,
  NotificationsSettings,
  IntegrationsSettings,
  DataPrivacySettings
} from './settings.types';

// Default settings for each category
const DEFAULT_SETTINGS: Record<SettingsCategory, Record<string, any>> = {
  association: {
    associationType: 'general',
    fiscalYearStart: 1,
    timezone: 'Africa/Lagos',
    currency: 'NGN'
  },
  members_access: {
    selfSignupEnabled: false,
    defaultRole: 'member',
    requireApproval: true,
    requireEmailVerification: true,
    inviteExpiryHours: 72,
    allowMultipleRoles: false,
    memberIdAutoGenerate: true
  },
  financial: {
    defaultGracePeriodDays: 7,
    enableLateFees: false,
    lateFeeType: 'fixed',
    lateFeeAmount: 0,
    enablePartialPayments: true,
    requirePaymentApproval: false,
    fiscalYearStart: 1,
    currencyCode: 'NGN',
    currencySymbol: '₦',
    decimalPlaces: 2
  },
  payments: {
    enabledChannels: ['bank_transfer', 'cash'],
    defaultPaymentMethod: 'bank_transfer',
    enableManualPayments: true,
    manualPaymentApprovalRequired: true,
    enablePartialPayments: true,
    receiptAutoGenerate: true,
    cashLodgmentDueDays: 3
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    paymentReminderDays: [7, 3, 1],
    overdueReminderFrequency: 'weekly',
    senderName: 'SocietyLedger'
  },
  integrations: {
    paystackEnabled: false,
    nombaEnabled: false,
    smsProvider: 'none',
    apiAccessEnabled: false
  },
  data_privacy: {
    dataRetentionMonths: 84, // 7 years
    softDeleteEnabled: true,
    anonymizeInactiveMembers: false,
    allowDataExport: true,
    gdprCompliant: false
  },
  platform: {} // Platform settings are managed separately
};

export class SettingsService {
  /**
   * Get all settings for a category
   */
  static async getSettings(
    associationId: number, 
    category: SettingsCategory
  ): Promise<Record<string, any>> {
    // Get stored settings
    const storedSettings = await prisma.settings.findMany({
      where: {
        associationId,
        key: { startsWith: `${category}.` }
      }
    });

    // Merge with defaults
    const defaults = DEFAULT_SETTINGS[category] || {};
    const result: Record<string, any> = { ...defaults };

    for (const setting of storedSettings) {
      const key = setting.key.replace(`${category}.`, '');
      try {
        result[key] = setting.value ? JSON.parse(setting.value) : null;
      } catch {
        result[key] = setting.value;
      }
    }

    return result;
  }

  /**
   * Update settings for a category
   */
  static async updateSettings(
    associationId: number,
    category: SettingsCategory,
    settings: Record<string, any>,
    userId: number
  ): Promise<Record<string, any>> {
    const updates: Array<{ key: string; value: string; oldValue?: string }> = [];

    // Get current settings for audit
    const currentSettings = await this.getSettings(associationId, category);

    // Process each setting
    for (const [key, value] of Object.entries(settings)) {
      const fullKey = `${category}.${key}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const oldValue = currentSettings[key];

      // Upsert the setting
      await prisma.settings.upsert({
        where: {
          associationId_key: { associationId, key: fullKey }
        },
        update: {
          value: stringValue,
          updatedBy: userId
        },
        create: {
          associationId,
          key: fullKey,
          value: stringValue,
          description: `${category} setting: ${key}`,
          updatedBy: userId
        }
      });

      updates.push({
        key,
        value: stringValue,
        oldValue: oldValue !== undefined ? String(oldValue) : undefined
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'SETTINGS_UPDATED',
        tableName: 'settings',
        oldValues: { category, changes: updates.map(u => ({ key: u.key, old: u.oldValue })) },
        newValues: { category, changes: updates.map(u => ({ key: u.key, new: u.value })) }
      }
    });

    // Return updated settings
    return this.getSettings(associationId, category);
  }

  /**
   * Get a single setting value
   */
  static async getSetting(
    associationId: number,
    category: SettingsCategory,
    key: string
  ): Promise<any> {
    const fullKey = `${category}.${key}`;
    
    const setting = await prisma.settings.findUnique({
      where: {
        associationId_key: { associationId, key: fullKey }
      }
    });

    if (setting?.value) {
      try {
        return JSON.parse(setting.value);
      } catch {
        return setting.value;
      }
    }

    // Return default if not set
    return DEFAULT_SETTINGS[category]?.[key];
  }

  /**
   * Set a single setting value
   */
  static async setSetting(
    associationId: number,
    category: SettingsCategory,
    key: string,
    value: any,
    userId: number
  ): Promise<void> {
    const fullKey = `${category}.${key}`;
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Get old value for audit
    const oldSetting = await prisma.settings.findUnique({
      where: { associationId_key: { associationId, key: fullKey } }
    });

    await prisma.settings.upsert({
      where: {
        associationId_key: { associationId, key: fullKey }
      },
      update: {
        value: stringValue,
        updatedBy: userId
      },
      create: {
        associationId,
        key: fullKey,
        value: stringValue,
        description: `${category} setting: ${key}`,
        updatedBy: userId
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'SETTING_UPDATED',
        tableName: 'settings',
        oldValues: { category, key, value: oldSetting?.value },
        newValues: { category, key, value: stringValue }
      }
    });
  }

  /**
   * Get association profile (combines association table + settings)
   */
  static async getAssociationProfile(associationId: number): Promise<AssociationProfileSettings> {
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      throw new Error('Association not found');
    }

    const settings = await this.getSettings(associationId, 'association');

    return {
      name: association.name,
      logo: association.logo || undefined,
      primaryColor: association.primaryColor || undefined,
      ...settings
    };
  }

  /**
   * Update association profile
   */
  static async updateAssociationProfile(
    associationId: number,
    profile: Partial<AssociationProfileSettings>,
    userId: number
  ): Promise<AssociationProfileSettings> {
    const { name, logo, primaryColor, ...settingsData } = profile;

    // Update association table fields
    if (name || logo !== undefined || primaryColor !== undefined) {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (logo !== undefined) updateData.logo = logo;
      if (primaryColor !== undefined) updateData.primaryColor = primaryColor;

      await prisma.association.update({
        where: { id: associationId },
        data: updateData
      });

      // Audit log for association changes
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'ASSOCIATION_UPDATED',
          tableName: 'associations',
          recordId: associationId,
          newValues: updateData
        }
      });
    }

    // Update settings
    if (Object.keys(settingsData).length > 0) {
      await this.updateSettings(associationId, 'association', settingsData, userId);
    }

    return this.getAssociationProfile(associationId);
  }

  /**
   * Get all settings for export
   */
  static async exportAllSettings(associationId: number): Promise<Record<SettingsCategory, Record<string, any>>> {
    const categories: SettingsCategory[] = [
      'association', 'members_access', 'financial', 'payments',
      'notifications', 'integrations', 'data_privacy'
    ];

    const result: Record<string, Record<string, any>> = {};

    for (const category of categories) {
      result[category] = await this.getSettings(associationId, category);
    }

    return result as Record<SettingsCategory, Record<string, any>>;
  }
}
