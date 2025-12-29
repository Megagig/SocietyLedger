import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// SMS & BULK COMMUNICATION API CLIENT
// Phase 6.5
// ============================================

// Types
export interface SMSMessage {
  id: number;
  recipientPhone: string;
  recipientName?: string;
  memberId?: number;
  message: string;
  messageType: 'SINGLE' | 'BULK' | 'AUTOMATED';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'REJECTED';
  termiiMessageId?: string;
  segments: number;
  cost?: number;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  campaign?: { name: string };
}

export interface SMSCampaign {
  id: number;
  name: string;
  message: string;
  templateId?: number;
  recipientType: 'ALL_MEMBERS' | 'SELECTED_MEMBERS' | 'MEMBER_CATEGORY' | 'CUSTOM_NUMBERS' | 'OWING_MEMBERS' | 'PAID_MEMBERS';
  recipientFilter?: RecipientFilter;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  template?: { name: string };
}

export interface RecipientFilter {
  memberIds?: number[];
  categories?: string[];
  statuses?: string[];
  customNumbers?: string[];
  owingMinAmount?: number;
}

export interface SMSTemplate {
  id: number;
  name: string;
  content: string;
  category: 'GENERAL' | 'PAYMENT_REMINDER' | 'MEETING' | 'DUES' | 'LEVY' | 'WELFARE' | 'ELECTION' | 'CUSTOM';
  placeholders: string[];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export interface SMSCreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastTopUpAt?: string;
}

export interface SMSCreditTransaction {
  id: number;
  type: 'PURCHASE' | 'USAGE' | 'REFUND' | 'BONUS' | 'ADJUSTMENT';
  amount: number;
  description?: string;
  reference?: string;
  campaignId?: number;
  createdAt: string;
}

export interface SMSDashboard {
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  deliveryRate: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalTemplates: number;
  creditBalance: number;
  recentMessages: SMSMessage[];
  recentCampaigns: SMSCampaign[];
  messagesByDay: Array<{ date: string; sent: number; delivered: number; failed: number }>;
}

export interface QuickSMSResult {
  totalSent: number;
  totalFailed: number;
  messages: Array<{ phone: string; success: boolean; messageId?: string; error?: string }>;
  creditsUsed: number;
  remainingCredits: number;
}

// ============================================
// Dashboard
// ============================================

export async function getSMSDashboard(): Promise<{ success: boolean; data: SMSDashboard }> {
  const response = await apiGet(`${API_URL}/api/sms/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch SMS dashboard');
  return response.json();
}

// ============================================
// Quick SMS
// ============================================

export async function sendQuickSMS(data: {
  recipients: string[];
  message: string;
  useTemplate?: boolean;
  templateId?: number;
  templateData?: Record<string, string | number>;
}): Promise<{ success: boolean; message: string; data: QuickSMSResult }> {
  const response = await apiPost(`${API_URL}/api/sms/send`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send SMS');
  }
  return response.json();
}

// ============================================
// Campaigns
// ============================================

export async function getSMSCampaigns(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);

  const response = await apiGet(`${API_URL}/api/sms/campaigns?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch campaigns');
  return response.json();
}

export async function getSMSCampaign(id: number): Promise<{ success: boolean; data: SMSCampaign }> {
  const response = await apiGet(`${API_URL}/api/sms/campaigns/${id}`);
  if (!response.ok) throw new Error('Failed to fetch campaign');
  return response.json();
}

export async function createSMSCampaign(data: {
  name: string;
  message: string;
  templateId?: number;
  recipientType: string;
  recipientFilter?: RecipientFilter;
  scheduledAt?: string;
}) {
  const response = await apiPost(`${API_URL}/api/sms/campaigns`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create campaign');
  }
  return response.json();
}

export async function startSMSCampaign(id: number) {
  const response = await apiPost(`${API_URL}/api/sms/campaigns/${id}/start`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start campaign');
  }
  return response.json();
}

export async function cancelSMSCampaign(id: number) {
  const response = await apiPost(`${API_URL}/api/sms/campaigns/${id}/cancel`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel campaign');
  }
  return response.json();
}

export async function deleteSMSCampaign(id: number) {
  const response = await apiDelete(`${API_URL}/api/sms/campaigns/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete campaign');
  }
  return response.json();
}

// ============================================
// Templates
// ============================================

export async function getSMSTemplates(params?: {
  page?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

  const response = await apiGet(`${API_URL}/api/sms/templates?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
}

export async function getSMSTemplate(id: number): Promise<{ success: boolean; data: SMSTemplate }> {
  const response = await apiGet(`${API_URL}/api/sms/templates/${id}`);
  if (!response.ok) throw new Error('Failed to fetch template');
  return response.json();
}

export async function createSMSTemplate(data: {
  name: string;
  content: string;
  category: string;
  placeholders?: string[];
}) {
  const response = await apiPost(`${API_URL}/api/sms/templates`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create template');
  }
  return response.json();
}

export async function updateSMSTemplate(id: number, data: {
  name?: string;
  content?: string;
  category?: string;
  placeholders?: string[];
  isActive?: boolean;
}) {
  const response = await apiPut(`${API_URL}/api/sms/templates/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }
  return response.json();
}

export async function deleteSMSTemplate(id: number) {
  const response = await apiDelete(`${API_URL}/api/sms/templates/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }
  return response.json();
}

// ============================================
// Messages
// ============================================

export async function getSMSMessages(params?: {
  page?: number;
  limit?: number;
  status?: string;
  campaignId?: number;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.campaignId) searchParams.set('campaignId', params.campaignId.toString());
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/sms/messages?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}

export async function getSMSMessage(id: number): Promise<{ success: boolean; data: SMSMessage }> {
  const response = await apiGet(`${API_URL}/api/sms/messages/${id}`);
  if (!response.ok) throw new Error('Failed to fetch message');
  return response.json();
}

// ============================================
// Credits
// ============================================

export async function getSMSCreditBalance(): Promise<{ success: boolean; data: SMSCreditBalance }> {
  const response = await apiGet(`${API_URL}/api/sms/credits/balance`);
  if (!response.ok) throw new Error('Failed to fetch credit balance');
  return response.json();
}

export async function topUpSMSCredits(data: {
  amount: number;
  reference?: string;
  description?: string;
}) {
  const response = await apiPost(`${API_URL}/api/sms/credits/topup`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to top up credits');
  }
  return response.json();
}

export async function getSMSCreditHistory(params?: {
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await apiGet(`${API_URL}/api/sms/credits/history?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch credit history');
  return response.json();
}
