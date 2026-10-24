import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Types — mirror apps/api/src/modules/sms/sms.types.ts and schema.prisma's
// real enums exactly. The previous version of this file was never
// reconciled against the real backend (G39/G76-class drift, found at R3).

export type SMSStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'REJECTED';
export type SMSCampaignStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'INTERRUPTED';
export type SMSRecipientType = 'ALL_MEMBERS' | 'SELECTED_MEMBERS' | 'MEMBER_CATEGORY' | 'CUSTOM_NUMBERS' | 'OWING_MEMBERS' | 'PAID_MEMBERS';
export type SMSTemplateCategory = 'GENERAL' | 'PAYMENT_REMINDER' | 'MEETING' | 'DUES' | 'LEVY' | 'WELFARE' | 'ELECTION' | 'CUSTOM';
export type SMSCreditTransactionType = 'PURCHASE' | 'USAGE' | 'REFUND' | 'BONUS' | 'ADJUSTMENT';

export interface SMSMessage {
  id: number;
  recipientPhone: string;
  recipientName: string | null;
  memberId: number | null;
  message: string;
  messageType: 'SINGLE' | 'BULK' | 'AUTOMATED';
  status: SMSStatus;
  termiiMessageId: string | null;
  segments: number;
  cost: number | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  campaign?: { name: string } | null;
}

export interface RecipientFilter {
  memberIds?: number[];
  categories?: string[];
  statuses?: string[];
  customNumbers?: string[];
  owingMinAmount?: number;
}

export interface SMSCampaign {
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
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  template?: { name: string } | null;
}

export interface SMSTemplate {
  id: number;
  name: string;
  content: string;
  category: SMSTemplateCategory;
  placeholders: string[];
  isActive: boolean;
  usageCount: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface SMSCreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastTopUpAt: string | null;
}

export interface SMSCreditTransaction {
  id: number;
  type: SMSCreditTransactionType;
  amount: number;
  description: string | null;
  reference: string | null;
  campaignId: number | null;
  createdAt: string;
}

export interface SMSDashboardStats {
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

export interface PaginatedResult<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SendSMSRequest {
  recipients: string[]; // phone numbers or member IDs, as plain strings
  message: string;
  useTemplate?: boolean;
  templateId?: number;
  templateData?: Record<string, string | number>;
}

export interface QuickSMSResult {
  totalSent: number;
  totalFailed: number;
  messages: Array<{ phone: string; success: boolean; messageId?: string; error?: string }>;
  creditsUsed: number;
  remainingCredits: number;
  /** A big send carries on in the background: the totals above are not final. */
  inProgress?: boolean;
  accepted?: number;
}

export interface CreateCampaignRequest {
  name: string;
  message: string;
  templateId?: number;
  recipientType: SMSRecipientType;
  recipientFilter?: RecipientFilter;
  scheduledAt?: string;
}

export interface CreateTemplateRequest {
  name: string;
  content: string;
  category: SMSTemplateCategory;
  placeholders?: string[];
}

export const smsApi = {
  async getDashboard(): Promise<SMSDashboardStats> {
    const response = await api.get(`${API_URL}/api/sms/dashboard`);
    return response.data.data;
  },

  async sendSMS(data: SendSMSRequest): Promise<QuickSMSResult> {
    const response = await api.post(`${API_URL}/api/sms/send`, data);
    return response.data.data;
  },

  async getCampaigns(params?: { page?: number; limit?: number; status?: SMSCampaignStatus }) {
    const response = await api.get(`${API_URL}/api/sms/campaigns`, { params });
    return response.data.data as { campaigns: SMSCampaign[] } & PaginatedResult<SMSCampaign>;
  },

  async createCampaign(data: CreateCampaignRequest): Promise<SMSCampaign> {
    const response = await api.post(`${API_URL}/api/sms/campaigns`, data);
    return response.data.data;
  },

  async getCampaign(id: number): Promise<SMSCampaign & { _count: { messages: number } }> {
    const response = await api.get(`${API_URL}/api/sms/campaigns/${id}`);
    return response.data.data;
  },

  async startCampaign(id: number) {
    const response = await api.post(`${API_URL}/api/sms/campaigns/${id}/start`);
    return response.data.data;
  },

  async cancelCampaign(id: number) {
    const response = await api.post(`${API_URL}/api/sms/campaigns/${id}/cancel`);
    return response.data.data;
  },

  async deleteCampaign(id: number) {
    const response = await api.delete(`${API_URL}/api/sms/campaigns/${id}`);
    return response.data.data;
  },

  async getTemplates(params?: { page?: number; limit?: number; category?: SMSTemplateCategory; isActive?: boolean }) {
    const response = await api.get(`${API_URL}/api/sms/templates`, { params });
    return response.data.data as { templates: SMSTemplate[] } & PaginatedResult<SMSTemplate>;
  },

  async createTemplate(data: CreateTemplateRequest): Promise<SMSTemplate> {
    const response = await api.post(`${API_URL}/api/sms/templates`, data);
    return response.data.data;
  },

  async getTemplate(id: number): Promise<SMSTemplate> {
    const response = await api.get(`${API_URL}/api/sms/templates/${id}`);
    return response.data.data;
  },

  async updateTemplate(id: number, data: Partial<CreateTemplateRequest> & { isActive?: boolean }) {
    const response = await api.put(`${API_URL}/api/sms/templates/${id}`, data);
    return response.data.data;
  },

  async deleteTemplate(id: number) {
    const response = await api.delete(`${API_URL}/api/sms/templates/${id}`);
    return response.data.data;
  },

  async getMessages(params?: {
    page?: number;
    limit?: number;
    status?: SMSStatus;
    campaignId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.get(`${API_URL}/api/sms/messages`, { params });
    return response.data.data as { messages: SMSMessage[] } & PaginatedResult<SMSMessage>;
  },

  async getMessage(id: number): Promise<SMSMessage> {
    const response = await api.get(`${API_URL}/api/sms/messages/${id}`);
    return response.data.data;
  },

  async getBalance(): Promise<SMSCreditBalance> {
    const response = await api.get(`${API_URL}/api/sms/credits/balance`);
    return response.data.data;
  },

  /**
   * Real Paystack purchase flow — ported from the orphaned
   * /dashboard/communication/sms/* set at R3.1 (G38). The old /credits/topup
   * (free-grant, G41) was removed entirely in R1.4; this is the only real
   * way to add credits from the tenant side now.
   */
  async purchaseCredits(data: { credits: number; packageId: string }): Promise<{
    authorizationUrl: string;
    accessCode: string;
    credits: number;
  }> {
    const response = await api.post(`${API_URL}/api/sms/credits/purchase`, data);
    return response.data.data;
  },

  async verifyPurchase(reference: string): Promise<{
    status: 'success' | 'failed';
    reference: string;
    credits: number;
    amount: number;
  }> {
    const response = await api.get(`${API_URL}/api/sms/credits/verify/${reference}`);
    return response.data.data;
  },

  async getCreditHistory(params?: { page?: number; limit?: number }) {
    const response = await api.get(`${API_URL}/api/sms/credits/history`, { params });
    return response.data.data as { transactions: SMSCreditTransaction[] } & PaginatedResult<SMSCreditTransaction>;
  },
};
