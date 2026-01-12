import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Types
export interface SMSDashboard {
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  totalCredits: number;
  creditsUsedThisMonth: number;
  creditsRemaining: number;
}

export interface SMSMessage {
  id: number;
  recipient: string;
  recipientName?: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  segments: number;
  cost: number;
  sentAt: string;
  deliveredAt?: string;
  errorMessage?: string;
  campaignId?: number;
  templateId?: number;
}

export interface SMSCampaign {
  id: number;
  name: string;
  message: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SMSTemplate {
  id: number;
  name: string;
  category: string;
  message: string;
  variables: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SMSCreditBalance {
  totalCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  lastTopupAt?: string;
  lastTopupAmount?: number;
}

export interface SMSCreditTransaction {
  id: number;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface SendSMSRequest {
  recipients: Array<{
    type: 'member' | 'phone';
    value: string | number;
  }>;
  message: string;
  templateId?: number;
  scheduleAt?: string;
}

export interface CreateCampaignRequest {
  name: string;
  message: string;
  recipientType: 'all' | 'category' | 'status' | 'custom';
  recipientValue?: string;
  recipientIds?: number[];
  phoneNumbers?: string[];
  scheduleAt?: string;
}

export interface CreateTemplateRequest {
  name: string;
  category: string;
  message: string;
}

export interface TopupCreditsRequest {
  amount: number;
  paymentMethod: 'paystack' | 'bank_transfer';
}

export const smsApi = {
  /**
   * Get SMS dashboard statistics
   */
  async getDashboard(): Promise<SMSDashboard> {
    const response = await api.get(`${API_URL}/api/sms/dashboard`);
    return response.data.data;
  },

  /**
   * Send quick SMS
   */
  async sendSMS(data: SendSMSRequest) {
    const response = await api.post(`${API_URL}/api/sms/send`, data);
    return response.data.data;
  },

  /**
   * Get all campaigns
   */
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const response = await api.get(`${API_URL}/api/sms/campaigns`, { params });
    return response.data.data;
  },

  /**
   * Create new campaign
   */
  async createCampaign(data: CreateCampaignRequest) {
    const response = await api.post(`${API_URL}/api/sms/campaigns`, data);
    return response.data.data;
  },

  /**
   * Get campaign by ID
   */
  async getCampaign(id: number): Promise<SMSCampaign> {
    const response = await api.get(`${API_URL}/api/sms/campaigns/${id}`);
    return response.data.data;
  },

  /**
   * Start campaign
   */
  async startCampaign(id: number) {
    const response = await api.post(`${API_URL}/api/sms/campaigns/${id}/start`);
    return response.data.data;
  },

  /**
   * Cancel campaign
   */
  async cancelCampaign(id: number) {
    const response = await api.post(`${API_URL}/api/sms/campaigns/${id}/cancel`);
    return response.data.data;
  },

  /**
   * Delete draft campaign
   */
  async deleteCampaign(id: number) {
    const response = await api.delete(`${API_URL}/api/sms/campaigns/${id}`);
    return response.data.data;
  },

  /**
   * Get all templates
   */
  async getTemplates(params?: {
    page?: number;
    limit?: number;
    category?: string;
  }) {
    const response = await api.get(`${API_URL}/api/sms/templates`, { params });
    return response.data.data;
  },

  /**
   * Create new template
   */
  async createTemplate(data: CreateTemplateRequest) {
    const response = await api.post(`${API_URL}/api/sms/templates`, data);
    return response.data.data;
  },

  /**
   * Get template by ID
   */
  async getTemplate(id: number): Promise<SMSTemplate> {
    const response = await api.get(`${API_URL}/api/sms/templates/${id}`);
    return response.data.data;
  },

  /**
   * Update template
   */
  async updateTemplate(id: number, data: Partial<CreateTemplateRequest>) {
    const response = await api.put(`${API_URL}/api/sms/templates/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete template
   */
  async deleteTemplate(id: number) {
    const response = await api.delete(`${API_URL}/api/sms/templates/${id}`);
    return response.data.data;
  },

  /**
   * Get message history
   */
  async getMessages(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    recipient?: string;
  }) {
    const response = await api.get(`${API_URL}/api/sms/messages`, { params });
    return response.data.data;
  },

  /**
   * Get message by ID
   */
  async getMessage(id: number): Promise<SMSMessage> {
    const response = await api.get(`${API_URL}/api/sms/messages/${id}`);
    return response.data.data;
  },

  /**
   * Get SMS credit balance
   */
  async getBalance(): Promise<SMSCreditBalance> {
    const response = await api.get(`${API_URL}/api/sms/credits/balance`);
    return response.data.data;
  },

  /**
   * Top up SMS credits
   */
  async topupCredits(data: TopupCreditsRequest) {
    const response = await api.post(`${API_URL}/api/sms/credits/topup`, data);
    return response.data.data;
  },

  /**
   * Get credit transaction history
   */
  async getCreditHistory(params?: {
    page?: number;
    limit?: number;
    type?: string;
  }) {
    const response = await api.get(`${API_URL}/api/sms/credits/history`, { params });
    return response.data.data;
  },
};
