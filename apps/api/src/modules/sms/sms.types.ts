/**
 * SMS Module Types
 * Phase 6.5: SMS & Bulk Communication
 */

import { SMSStatus, SMSCampaignStatus, SMSRecipientType, SMSTemplateCategory, SMSMessageType } from '@prisma/client';

// ============================================
// SMS Message Types
// ============================================

export interface SMSMessageData {
  recipientPhone: string;
  recipientName?: string;
  memberId?: number;
  message: string;
  messageType?: SMSMessageType;
}

export interface SMSMessageResponse {
  id: number;
  recipientPhone: string;
  recipientName: string | null;
  memberId: number | null;
  message: string;
  messageType: SMSMessageType;
  status: SMSStatus;
  termiiMessageId: string | null;
  segments: number;
  cost: number | null;
  errorMessage: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

// ============================================
// SMS Campaign Types
// ============================================

export interface CreateCampaignData {
  name: string;
  message: string;
  templateId?: number;
  recipientType: SMSRecipientType;
  recipientFilter?: RecipientFilter;
  scheduledAt?: Date;
}

export interface RecipientFilter {
  memberIds?: number[];
  categories?: string[];
  statuses?: string[];
  customNumbers?: string[];
  owingMinAmount?: number;
}

export interface CampaignResponse {
  id: number;
  name: string;
  message: string;
  templateId: number | null;
  recipientType: SMSRecipientType;
  recipientFilter: RecipientFilter | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: SMSCampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStats {
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  deliveryRate: number;
  failureRate: number;
}

// ============================================
// SMS Template Types
// ============================================

export interface CreateTemplateData {
  name: string;
  content: string;
  category: SMSTemplateCategory;
  placeholders?: string[];
}

export interface UpdateTemplateData {
  name?: string;
  content?: string;
  category?: SMSTemplateCategory;
  placeholders?: string[];
  isActive?: boolean;
}

export interface TemplateResponse {
  id: number;
  name: string;
  content: string;
  category: SMSTemplateCategory;
  placeholders: string[];
  isActive: boolean;
  usageCount: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SMS Credit Types
// ============================================

export interface CreditBalanceResponse {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastTopUpAt: Date | null;
}

export interface CreditTransactionResponse {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  reference: string | null;
  campaignId: number | null;
  createdAt: Date;
}

// ============================================
// Quick SMS Types
// ============================================

export interface QuickSMSData {
  recipients: string[]; // Phone numbers or member IDs
  message: string;
  useTemplate?: boolean;
  templateId?: number;
  templateData?: Record<string, string | number>;
}

export interface QuickSMSResult {
  totalSent: number;
  totalFailed: number;
  messages: Array<{
    phone: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  creditsUsed: number;
  remainingCredits: number;
}

// ============================================
// SMS Dashboard Types
// ============================================

export interface SMSDashboardStats {
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  deliveryRate: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalTemplates: number;
  creditBalance: number;
  recentMessages: SMSMessageResponse[];
  recentCampaigns: CampaignResponse[];
  messagesByDay: Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

// ============================================
// Automated SMS Types
// ============================================

export interface AutomatedSMSConfig {
  type: 'payment_reminder' | 'meeting_reminder' | 'dues_reminder' | 'levy_reminder';
  enabled: boolean;
  templateId?: number;
  daysBeforeDue?: number;
  daysAfterDue?: number;
}

export interface PaymentReminderData {
  memberId: number;
  memberName: string;
  phone: string;
  amount: number;
  dueDate: Date;
  categoryName: string;
  daysUntilDue: number;
}

export interface MeetingReminderData {
  memberId: number;
  memberName: string;
  phone: string;
  meetingTitle: string;
  meetingDate: Date;
  meetingLocation?: string;
  hoursUntilMeeting: number;
}
