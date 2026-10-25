import type { PermissionAlias } from '@/lib/permissions';
import type {
  AnnouncementAudience,
  AnnouncementPriority,
  SmsCampaignStatus,
  SmsCreditTransactionType,
  SmsMessageStatus,
  SmsRecipientType,
  SmsTemplateCategory,
} from '@/types/api/communication';

export const COMMUNICATION_MODULE = 'sms';

/** Announcements: the app feed and push for everyone, plus email and texts when ticked (`notifications.send`). */
export const ANNOUNCE_ACCESS: PermissionAlias = 'NOTIFICATION_SEND';
/** One-to-one and small text sends (`communication.sms.send`). */
export const SMS_SEND_ACCESS: PermissionAlias = 'SMS_SEND';
/** Campaigns to a group (`communication.sms.campaign`). */
export const SMS_CAMPAIGN_ACCESS: PermissionAlias = 'SMS_CAMPAIGN_MANAGE';
/** Message templates (`communication.sms.template`). */
export const SMS_TEMPLATE_ACCESS: PermissionAlias = 'SMS_TEMPLATE_MANAGE';
/** Reading texts, campaigns, templates and the credit history (`communication.sms.view`). */
export const SMS_VIEW_ACCESS: PermissionAlias = 'SMS_VIEW';
/** Anything that opens a Communication screen: what makes it appear in Manage. */
export const COMMUNICATION_ACCESS: PermissionAlias[] = ['NOTIFICATION_SEND', 'SMS_VIEW', 'SMS_SEND', 'SMS_CAMPAIGN_MANAGE', 'SMS_TEMPLATE_MANAGE'];
/** Anything that opens a texting screen (these also need the SMS module on the plan). */
export const SMS_ANY_ACCESS: PermissionAlias[] = ['SMS_VIEW', 'SMS_SEND', 'SMS_CAMPAIGN_MANAGE', 'SMS_TEMPLATE_MANAGE'];

export const ANNOUNCEMENT_AUDIENCE_OPTIONS: { label: string; value: AnnouncementAudience }[] = [
  { label: 'Everyone', value: 'ALL' },
  { label: 'Category', value: 'CATEGORY' },
  { label: 'Chosen', value: 'SELECTED' },
];

export const PRIORITY_OPTIONS: { label: string; value: AnnouncementPriority }[] = [
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Urgent', value: 'urgent' },
];

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = { ALL: 'All active members', CATEGORY: 'By category', SELECTED: 'Chosen members' };

export const RECIPIENT_TYPE_LABELS: Record<SmsRecipientType, string> = {
  ALL_MEMBERS: 'All members',
  SELECTED_MEMBERS: 'Chosen members',
  MEMBER_CATEGORY: 'By category',
  CUSTOM_NUMBERS: 'Phone numbers',
  OWING_MEMBERS: 'Members who owe',
  PAID_MEMBERS: 'Members who are paid up',
};

export const CAMPAIGN_RECIPIENT_OPTIONS = (Object.keys(RECIPIENT_TYPE_LABELS) as SmsRecipientType[]).map((value) => ({ value, label: RECIPIENT_TYPE_LABELS[value] }));

export const CAMPAIGN_STATUS_LABELS: Record<SmsCampaignStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'Sending',
  COMPLETED: 'Sent',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  INTERRUPTED: 'Interrupted',
};

/** The shared status chip looks tones up by this key (ui-tokens.md §1.4). */
const CAMPAIGN_STATUS_KEYS: Record<SmsCampaignStatus, string> = {
  DRAFT: 'draft',
  SCHEDULED: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  INTERRUPTED: 'pending',
};
export const campaignStatusKey = (status: SmsCampaignStatus): string => CAMPAIGN_STATUS_KEYS[status] ?? 'draft';

export const CAMPAIGN_STATUS_FILTERS = (Object.keys(CAMPAIGN_STATUS_LABELS) as SmsCampaignStatus[]).map((value) => ({ value, label: CAMPAIGN_STATUS_LABELS[value] }));

export const MESSAGE_STATUS_LABELS: Record<SmsMessageStatus, string> = {
  PENDING: 'Sending',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  FAILED: 'Failed (refunded)',
  REJECTED: 'Rejected (refunded)',
};
const MESSAGE_STATUS_KEYS: Record<SmsMessageStatus, string> = { PENDING: 'pending', SENT: 'submitted', DELIVERED: 'verified', FAILED: 'failed', REJECTED: 'rejected' };
export const messageStatusKey = (status: SmsMessageStatus): string => MESSAGE_STATUS_KEYS[status] ?? 'pending';
export const MESSAGE_STATUS_FILTERS = (Object.keys(MESSAGE_STATUS_LABELS) as SmsMessageStatus[]).map((value) => ({ value, label: MESSAGE_STATUS_LABELS[value] }));

export const TEMPLATE_CATEGORY_LABELS: Record<SmsTemplateCategory, string> = {
  GENERAL: 'General',
  PAYMENT_REMINDER: 'Payment reminder',
  MEETING: 'Meeting',
  DUES: 'Dues',
  LEVY: 'Levy',
  WELFARE: 'Welfare',
  ELECTION: 'Election',
  CUSTOM: 'Custom',
};
export const TEMPLATE_CATEGORY_OPTIONS = (Object.keys(TEMPLATE_CATEGORY_LABELS) as SmsTemplateCategory[]).map((value) => ({ value, label: TEMPLATE_CATEGORY_LABELS[value] }));

export const CREDIT_TYPE_LABELS: Record<SmsCreditTransactionType, string> = {
  PURCHASE: 'Bought',
  USAGE: 'Used',
  REFUND: 'Refunded',
  BONUS: 'Bonus',
  ADJUSTMENT: 'Adjusted',
};

/** "1 credit" / "2,500 credits": credits are whole counts, never money. */
export function creditsLabel(n: number): string {
  return `${n.toLocaleString('en-NG')} credit${n === 1 ? '' : 's'}`;
}

/** Pulls phone numbers out of what an officer typed or pasted: separated by commas, spaces or new lines. */
export function parseNumbers(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean))];
}

/** How far a campaign has got, 0–100. */
export function campaignProgress(sent: number, failed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((sent + failed) / total) * 100));
}

export const CAMPAIGN_STARTABLE: SmsCampaignStatus[] = ['DRAFT', 'SCHEDULED'];
export const CAMPAIGN_CANCELLABLE: SmsCampaignStatus[] = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'];
export const CAMPAIGN_DELETABLE: SmsCampaignStatus[] = ['DRAFT'];
