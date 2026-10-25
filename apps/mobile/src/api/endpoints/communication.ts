import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AnnouncementPayload,
  AnnouncementPreviewDTO,
  AnnouncementResultDTO,
  AudiencePreviewDTO,
  AudiencePreviewPayload,
  CampaignPayload,
  QuickSmsPayload,
  QuickSmsResultDTO,
  SentAnnouncementListDTO,
  SmsCampaignDetailDTO,
  SmsCampaignListDTO,
  SmsCampaignStatus,
  SmsCreditBalanceDTO,
  SmsCreditHistoryDTO,
  SmsDashboardDTO,
  SmsMessageListDTO,
  SmsMessageStatus,
  SmsTemplateCategory,
  SmsTemplateDTO,
  SmsTemplateListDTO,
  TemplatePayload,
} from '@/types/api/communication';

/**
 * Communication for officers. Announcements need `notifications.send`; texts need `communication.sms.send` (quick sends),
 * `.campaign` (campaigns), `.template` (templates) or `.view` (reading), and the SMS module on the plan. Credits can only be
 * bought on the web.
 */
export const communicationApi = {
  // ---- announcements
  /** POST /notifications/announcement/preview — who it reaches and misses, and what the texts cost. */
  async previewAnnouncement(payload: AnnouncementPayload): Promise<AnnouncementPreviewDTO> {
    return unwrap<AnnouncementPreviewDTO>(client.post('/notifications/announcement/preview', payload));
  },

  /** POST /notifications/announcement — 409 INSUFFICIENT_CREDITS leaves nothing sent and nothing recorded. */
  async sendAnnouncement(payload: AnnouncementPayload): Promise<AnnouncementResultDTO> {
    return unwrap<AnnouncementResultDTO>(client.post('/notifications/announcement', payload));
  },

  async listAnnouncements(params: { page: number; limit: number }): Promise<SentAnnouncementListDTO> {
    return unwrap<SentAnnouncementListDTO>(client.get('/notifications/announcements', { params }));
  },

  // ---- texts
  async getSmsDashboard(): Promise<SmsDashboardDTO> {
    return unwrap<SmsDashboardDTO>(client.get('/sms/dashboard'));
  },

  async getBalance(): Promise<SmsCreditBalanceDTO> {
    return unwrap<SmsCreditBalanceDTO>(client.get('/sms/credits/balance'));
  },

  async getCreditHistory(params: { page: number; limit: number }): Promise<SmsCreditHistoryDTO> {
    return unwrap<SmsCreditHistoryDTO>(client.get('/sms/credits/history', { params }));
  },

  /** POST /sms/audience/preview — who would be texted, who is missed and why, and the cost against the balance. */
  async previewAudience(payload: AudiencePreviewPayload): Promise<AudiencePreviewDTO> {
    return unwrap<AudiencePreviewDTO>(client.post('/sms/audience/preview', payload));
  },

  /** POST /sms/send — credits are set aside first; a text that fails is refunded. */
  async sendQuick(payload: QuickSmsPayload): Promise<QuickSmsResultDTO> {
    return unwrap<QuickSmsResultDTO>(client.post('/sms/send', payload));
  },

  async listMessages(params: { page: number; limit: number; status?: SmsMessageStatus; campaignId?: number }): Promise<SmsMessageListDTO> {
    return unwrap<SmsMessageListDTO>(client.get('/sms/messages', { params }));
  },

  // ---- campaigns
  async listCampaigns(params: { page: number; limit: number; status?: SmsCampaignStatus }): Promise<SmsCampaignListDTO> {
    return unwrap<SmsCampaignListDTO>(client.get('/sms/campaigns', { params }));
  },

  async getCampaign(id: number): Promise<SmsCampaignDetailDTO> {
    return unwrap<SmsCampaignDetailDTO>(client.get(`/sms/campaigns/${id}`));
  },

  async createCampaign(payload: CampaignPayload): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.post('/sms/campaigns', payload));
  },

  /** POST /sms/campaigns/:id/start — 409 ALREADY_STARTED when it was started already; 409 INSUFFICIENT_CREDITS when short. */
  async startCampaign(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`/sms/campaigns/${id}/start`));
  },

  async cancelCampaign(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`/sms/campaigns/${id}/cancel`));
  },

  async deleteCampaign(id: number): Promise<void> {
    await unwrap<unknown>(client.delete(`/sms/campaigns/${id}`));
  },

  // ---- templates
  async listTemplates(params: { page: number; limit: number; category?: SmsTemplateCategory }): Promise<SmsTemplateListDTO> {
    return unwrap<SmsTemplateListDTO>(client.get('/sms/templates', { params }));
  },

  async createTemplate(payload: TemplatePayload): Promise<SmsTemplateDTO> {
    return unwrap<SmsTemplateDTO>(client.post('/sms/templates', payload));
  },

  async updateTemplate(id: number, payload: Partial<TemplatePayload> & { isActive?: boolean }): Promise<SmsTemplateDTO> {
    return unwrap<SmsTemplateDTO>(client.put(`/sms/templates/${id}`, payload));
  },

  async deleteTemplate(id: number): Promise<void> {
    await unwrap<unknown>(client.delete(`/sms/templates/${id}`));
  },
};
