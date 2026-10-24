/** `/api/notifications/*` — no `X-Tenant` needed — api-contract.md §7, §12. */
import type { IsoDateString } from './common';

/**
 * Real `Notification.type` values actually written today (api-contract.md §7's inventory):
 * `payment_received`, `system`, `announcement` are live; `payment_due`/`approval` are declared
 * but only reachable via manual admin create as of F0.2. Not a Prisma enum (declared as a
 * `NotificationKind` app-level union, not in schema.prisma) — kept as a plain string union here,
 * open-ended (`| string`) so an unmapped future value doesn't break the type.
 */
export type NotificationType = 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement' | string;

/** `entityId` added F0.2 for push deep-link routing — null on every row written before that feature, and on any writer that still doesn't pass one. */
export type NotificationDTO = {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  entityId: number | null;
  /** Deep-link type (same vocabulary as the push `data.type`); null on rows written before it existed. */
  pushType?: string | null;
  isRead: boolean;
  createdAt: IsoDateString;
};

/**
 * GET /notifications/?page&limit&unread — verified 2026-10-19.
 * A FOURTH distinct pagination shape (flat fields on `data`, array key `notifications` —
 * not `items`/`entries`). api-contract.md §10: do not reuse one generic PaginatedResponse<T>.
 */
export type NotificationsListResponseDTO = {
  notifications: NotificationDTO[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type UnreadCountResponseDTO = {
  unreadCount: number;
};

/**
 * GET/PUT /notifications/preferences — verified against the real `NotificationPreference`
 * model (2026-10-19). `pushEnabled` (F0.2) is a master toggle for mobile push, independent of
 * the in-app feed — per-kind push granularity doesn't exist yet (schema.prisma's own comment:
 * not required for v1). PUT has NO server-side Zod validation — the client must validate
 * before sending; the server spreads the body directly into the Prisma upsert.
 */
export type NotificationPreferencesDTO = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  paymentDueEmail: boolean;
  paymentDueSMS: boolean;
  paymentDueInApp: boolean;
  paymentReceivedEmail: boolean;
  paymentReceivedSMS: boolean;
  paymentReceivedInApp: boolean;
  systemEmail: boolean;
  systemSMS: boolean;
  systemInApp: boolean;
  approvalEmail: boolean;
  approvalSMS: boolean;
  approvalInApp: boolean;
  announcementEmail: boolean;
  announcementSMS: boolean;
  /** "Don't send me text messages": stops announcement and campaign texts from officers. */
  announcementSmsOptOut: boolean;
  announcementInApp: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
};
