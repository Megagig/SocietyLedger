/**
 * Settings Module Types
 * Phase 18: Settings Page Architecture
 */

// Settings categories
export type SettingsCategory = 
  | 'association'
  | 'members_access'
  | 'financial'
  | 'payments'
  | 'notifications'
  | 'integrations'
  | 'data_privacy'
  | 'platform';

// Base setting interface
export interface SettingValue {
  key: string;
  value: string | number | boolean | object | null;
  updatedAt: Date;
  updatedBy: number;
}

// Association Profile Settings
export interface AssociationProfileSettings {
  name: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  associationType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  fiscalYearStart?: number; // Month (1-12)
  timezone?: string;
  currency?: string;
}

// Members Access Settings
export interface MembersAccessSettings {
  selfSignupEnabled: boolean;
  defaultRole: string;
  requireApproval: boolean;
  requireEmailVerification: boolean;
  inviteExpiryHours: number;
  allowMultipleRoles: boolean;
  memberIdPrefix?: string;
  memberIdAutoGenerate: boolean;
}

// Financial Settings
export interface FinancialSettings {
  defaultGracePeriodDays: number;
  enableLateFees: boolean;
  lateFeeType: 'fixed' | 'percentage';
  lateFeeAmount: number;
  maxLateFeeAmount?: number;
  enablePartialPayments: boolean;
  requirePaymentApproval: boolean;
  approvalThreshold?: number;
  fiscalYearStart: number;
  currencyCode: string;
  currencySymbol: string;
  decimalPlaces: number;
}

// Payments Settings
export interface PaymentsSettings {
  enabledChannels: string[];
  defaultPaymentMethod: string;
  enableManualPayments: boolean;
  manualPaymentApprovalRequired: boolean;
  enablePartialPayments: boolean;
  minimumPaymentAmount?: number;
  receiptPrefix?: string;
  receiptAutoGenerate: boolean;
}

// Notifications Settings
export interface NotificationsSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  paymentReminderDays: number[];
  overdueReminderFrequency: 'daily' | 'weekly' | 'monthly' | 'none';
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  senderName?: string;
  senderEmail?: string;
}

// Integrations Settings
export interface IntegrationsSettings {
  paystackEnabled: boolean;
  paystackPublicKey?: string;
  nombaEnabled: boolean;
  nombaAccountId?: string;
  smsProvider: 'termii' | 'none';
  webhookUrl?: string;
  apiAccessEnabled: boolean;
}

// Data Privacy Settings
export interface DataPrivacySettings {
  dataRetentionMonths: number;
  softDeleteEnabled: boolean;
  anonymizeInactiveMembers: boolean;
  anonymizeAfterMonths?: number;
  allowDataExport: boolean;
  gdprCompliant: boolean;
}

// API Request/Response types
export interface GetSettingsRequest {
  category: SettingsCategory;
}

export interface UpdateSettingsRequest {
  category: SettingsCategory;
  settings: Record<string, any>;
}

export interface SettingsResponse<T = Record<string, any>> {
  success: boolean;
  data?: T;
  message?: string;
}

// Audit log entry for settings changes
export interface SettingsAuditEntry {
  category: SettingsCategory;
  key: string;
  oldValue: any;
  newValue: any;
  changedBy: number;
  changedAt: Date;
}
