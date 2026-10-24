import type { IsoDateString } from './common';

/**
 * Communication for officers: announcements, quick texts, SMS campaigns, templates, and the message and credit history. Mirrors
 * `apps/api/src/modules/sms/sms.types.ts` and `modules/notifications/announcements.service.ts`. Credits are whole numbers, not money.
 */

export type SmsMessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'REJECTED';
export type SmsCampaignStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'INTERRUPTED';
export type SmsRecipientType = 'ALL_MEMBERS' | 'SELECTED_MEMBERS' | 'MEMBER_CATEGORY' | 'CUSTOM_NUMBERS' | 'OWING_MEMBERS' | 'PAID_MEMBERS';
export type SmsTemplateCategory = 'GENERAL' | 'PAYMENT_REMINDER' | 'MEETING' | 'DUES' | 'LEVY' | 'WELFARE' | 'ELECTION' | 'CUSTOM';
export type SmsCreditTransactionType = 'PURCHASE' | 'USAGE' | 'REFUND' | 'BONUS' | 'ADJUSTMENT';

/** The list endpoints return the rows under their own key next to these paging fields. */
export type PagedMeta = { total: number; page: number; limit: number; totalPages: number };

export type SmsRecipientFilter = {
  memberIds?: number[];
  categories?: string[];
  customNumbers?: string[];
  owingMinAmount?: number;
};

export type SmsMessageDTO = {
  id: number;
  recipientPhone: string;
  recipientName: string | null;
  memberId: number | null;
  message: string;
  messageType: 'SINGLE' | 'BULK' | 'AUTOMATED';
  status: SmsMessageStatus;
  segments: number;
  errorMessage: string | null;
  sentAt: IsoDateString | null;
  deliveredAt: IsoDateString | null;
  createdAt: IsoDateString;
  campaign?: { name: string } | null;
};

export type SmsCampaignDTO = {
  id: number;
  name: string;
  message: string;
  templateId: number | null;
  recipientType: SmsRecipientType;
  recipientFilter: SmsRecipientFilter | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: SmsCampaignStatus;
  scheduledAt: IsoDateString | null;
  startedAt: IsoDateString | null;
  completedAt: IsoDateString | null;
  createdAt: IsoDateString;
  template?: { name: string } | null;
};

export type SmsTemplateDTO = {
  id: number;
  name: string;
  content: string;
  category: SmsTemplateCategory;
  placeholders: string[];
  isActive: boolean;
  usageCount: number;
};

export type SmsCreditBalanceDTO = {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastTopUpAt: IsoDateString | null;
};

export type SmsCreditTransactionDTO = {
  id: number;
  type: SmsCreditTransactionType;
  amount: number;
  description: string | null;
  campaignId: number | null;
  createdAt: IsoDateString;
};

export type SmsDashboardDTO = {
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  deliveryRate: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalTemplates: number;
  creditBalance: number;
};

export type SmsCampaignListDTO = { campaigns: SmsCampaignDTO[] } & PagedMeta;
export type SmsCampaignDetailDTO = SmsCampaignDTO & { _count?: { messages: number } };
export type SmsTemplateListDTO = { templates: SmsTemplateDTO[] } & PagedMeta;
export type SmsMessageListDTO = { messages: SmsMessageDTO[] } & PagedMeta;
export type SmsCreditHistoryDTO = { transactions: SmsCreditTransactionDTO[] } & PagedMeta;

/** POST /sms/send — one-to-one or small sends. `recipients` are phone numbers or member ids as strings. */
export type QuickSmsPayload = { recipients: string[]; message: string; templateId?: number };

export type QuickSmsResultDTO = {
  totalSent: number;
  totalFailed: number;
  creditsUsed: number;
  remainingCredits: number;
  /** A big send carries on in the background: the totals are not final yet. */
  inProgress?: boolean;
  accepted?: number;
};

export type CampaignPayload = {
  name: string;
  message: string;
  templateId?: number;
  recipientType: SmsRecipientType;
  recipientFilter?: SmsRecipientFilter;
  scheduledAt?: string;
};

export type TemplatePayload = { name: string; content: string; category: SmsTemplateCategory; placeholders?: string[] };

/** POST /sms/audience/preview — what a send to this audience would do before it is sent. */
export type AudiencePreviewPayload = { recipientType: SmsRecipientType; recipientFilter?: SmsRecipientFilter; message?: string };

export type AudiencePreviewDTO = {
  members: number;
  willText: number;
  noPhone: number;
  optedOut: number;
  invalidNumbers: string[];
  segments: number | null;
  credits: number | null;
  balance: number;
  enough: boolean | null;
  shortBy: number | null;
};

export type AnnouncementAudience = 'ALL' | 'CATEGORY' | 'SELECTED';
export type AnnouncementPriority = 'info' | 'warning' | 'urgent';
export type AnnouncementStatus = 'SENDING' | 'COMPLETED' | 'INTERRUPTED';

export type AnnouncementPayload = {
  title: string;
  message: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  categories?: string[];
  memberIds?: number[];
  sendEmail: boolean;
  sendSms: boolean;
  smsText?: string;
};

export type AnnouncementReachDTO = {
  members: number;
  withLogin: number;
  noLogin: number;
  withEmail: number;
  willText: number;
  noPhone: number;
  optedOut: number;
};

export type AnnouncementPreviewDTO = {
  reach: AnnouncementReachDTO;
  smsText: string;
  sms: { segments: number; credits: number; balance: number; enough: boolean; shortBy: number } | null;
};

export type AnnouncementResultDTO = {
  id: number;
  count: number;
  inApp: number;
  noLogin: number;
  emailsSent: number;
  smsSent: number;
  smsFailed: number;
  smsInProgress: boolean;
  reach: AnnouncementReachDTO;
};

export type SentAnnouncementDTO = {
  id: number;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  sendEmail: boolean;
  sendSms: boolean;
  status: AnnouncementStatus;
  memberCount: number;
  inAppCount: number;
  noLoginCount: number;
  emailCount: number;
  smsRequested: number;
  smsSent: number;
  smsFailed: number;
  noPhoneCount: number;
  optedOutCount: number;
  creditsUsed: number;
  sentBy: string;
  createdAt: IsoDateString;
};

export type SentAnnouncementListDTO = {
  announcements: SentAnnouncementDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};
