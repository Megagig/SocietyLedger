/**
 * Notification Preferences & Dispatch Service (R3.6/G14/G42)
 *
 * Replaces notifications.controller.ts's in-memory preferencesStore (lost on
 * every restart, never read by anything that actually sends a notification)
 * with a real DB-backed model, and centralizes the three real channels —
 * email, in-app, SMS — so every notification sender (notifications.controller.ts,
 * jobs/meeting-jobs.ts) gates consistently instead of re-implementing this.
 */
import { NotificationPreference } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { SMSService } from '../modules/sms/sms.service';
import { sendPushToUsers } from './push.service';

const smsService = new SMSService();

export type NotificationKind = 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
export type NotificationChannel = 'email' | 'sms' | 'inApp';

// F0.2: maps a notification kind to the push payload's `data.type` (the key
// architecture.md §8.2's mobile routing table switches on) and the Android
// channel it belongs to. Deliberately NOT the same string as `kind`/the
// stored `Notification.type` — decoupling the two means a call site can
// override `pushType` for a sharper deep link (see meeting-jobs.ts) without
// changing what gets persisted, so existing stored values and anything that
// reads them elsewhere are unaffected.
const KIND_TO_PUSH_TYPE: Partial<Record<NotificationKind, string>> = {
  payment_received: 'payment.received',
  announcement: 'announcement',
};
const KIND_TO_PUSH_CHANNEL: Partial<Record<NotificationKind, string>> = {
  payment_due: 'payments',
  payment_received: 'payments',
  announcement: 'announcements',
};

const DEFAULTS: Omit<NotificationPreference, 'id' | 'associationId' | 'userId' | 'createdAt' | 'updatedAt'> = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  pushEnabled: true,
  paymentDueEmail: true,
  paymentDueSMS: false,
  paymentDueInApp: true,
  paymentReceivedEmail: true,
  paymentReceivedSMS: false,
  paymentReceivedInApp: true,
  systemEmail: true,
  systemSMS: false,
  systemInApp: true,
  approvalEmail: true,
  approvalSMS: false,
  approvalInApp: true,
  announcementEmail: true,
  announcementSMS: false,
  announcementInApp: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'UTC',
};

function fieldFor(kind: NotificationKind, channel: NotificationChannel): keyof NotificationPreference {
  const channelSuffix = channel === 'inApp' ? 'InApp' : channel === 'sms' ? 'SMS' : 'Email';
  const kindPrefix = kind.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); // payment_due -> paymentDue
  return `${kindPrefix}${channelSuffix}` as keyof NotificationPreference;
}

export async function getPreferences(associationId: number, userId: number): Promise<NotificationPreference | typeof DEFAULTS & { associationId: number; userId: number }> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { associationId_userId: { associationId, userId } },
  });
  return existing || { ...DEFAULTS, associationId, userId, id: 0, createdAt: new Date(), updatedAt: new Date() };
}

export async function upsertPreferences(
  associationId: number,
  userId: number,
  data: Partial<typeof DEFAULTS>
): Promise<NotificationPreference> {
  return prisma.notificationPreference.upsert({
    where: { associationId_userId: { associationId, userId } },
    create: { associationId, userId, ...DEFAULTS, ...data },
    update: data,
  });
}

export function channelAllowed(
  pref: NotificationPreference | (typeof DEFAULTS & { associationId: number; userId: number }),
  kind: NotificationKind,
  channel: NotificationChannel
): boolean {
  const masterKey = channel === 'inApp' ? 'inAppEnabled' : channel === 'sms' ? 'smsEnabled' : 'emailEnabled';
  if (!pref[masterKey as keyof typeof pref]) return false;
  const field = fieldFor(kind, channel);
  // F0.2: a kind added without its own per-kind/channel columns (none of
  // the 5 original kinds hit this — it's forward-looking for new kinds)
  // falls back to the master toggle just checked above, rather than being
  // silently always-disabled because `pref[field]` is undefined.
  if (!(field in pref)) return true;
  return !!pref[field as keyof typeof pref];
}

interface DispatchOptions {
  associationId: number;
  userId: number;
  title: string;
  message: string;
  kind: NotificationKind;
  sendEmail?: boolean;
  sendSMS?: boolean;
  emailSubject?: string;
  emailTemplate?: string;
  emailData?: Record<string, any>;
  smsMessage?: string;
  /** F0.2: the entity (payment, meeting, election...) this is about, for push deep-link routing. */
  entityId?: number;
  /** F0.2: overrides KIND_TO_PUSH_TYPE's default push `data.type` for a sharper deep link — never affects the stored `Notification.type`. */
  pushType?: string;
}

/**
 * Creates the in-app notification (if the recipient allows it) and, if the
 * caller requested it AND the recipient's preferences allow it, sends email
 * and/or SMS too. SMS consumes real credits via smsService — a failure
 * there (insufficient credits, provider error) is caught and logged, same
 * graceful-degradation pattern email failures already use; it never blocks
 * the rest of the dispatch. Push (F0.2) follows the same pattern: sent only
 * if an in-app row was actually created AND the recipient's `pushEnabled`
 * master toggle allows it, and a send failure never blocks anything else.
 */
export async function dispatchNotification(options: DispatchOptions): Promise<{
  inAppCreated: boolean;
  emailSent: boolean;
  smsSent: boolean;
}> {
  const { associationId, userId, title, message, kind, entityId } = options;
  const pref = await getPreferences(associationId, userId);

  const result = { inAppCreated: false, emailSent: false, smsSent: false };

  if (channelAllowed(pref, kind, 'inApp')) {
    await prisma.notification.create({
      data: { associationId, userId, title, message, type: kind, entityId },
    });
    result.inAppCreated = true;

    if (pref.pushEnabled) {
      // Awaited (not fire-and-forget): sendPushToUsers never throws (see
      // push.service.ts), so this can't fail the dispatch — awaiting just
      // makes the dispatch's own completion, and tests asserting on it,
      // deterministic.
      await sendPushToUsers([userId], {
        title,
        body: message,
        data: { type: options.pushType ?? KIND_TO_PUSH_TYPE[kind], entityId },
        channelId: KIND_TO_PUSH_CHANNEL[kind],
      });
    }
  }

  if (options.sendEmail && channelAllowed(pref, kind, 'email')) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: options.emailSubject || title,
          template: options.emailTemplate || 'notification',
          data: options.emailData || { title, message, type: kind },
        });
        result.emailSent = true;
      } catch (error) {
        console.error(`[notification-dispatch] email failed for user ${userId}:`, error);
      }
    }
  }

  if (options.sendSMS && channelAllowed(pref, kind, 'sms')) {
    const member = await prisma.member.findFirst({ where: { associationId, userId }, select: { id: true, phone: true } });
    if (member?.phone) {
      try {
        await smsService.sendQuickSMS(associationId, userId, {
          recipients: [String(member.id)],
          message: options.smsMessage || message,
        });
        result.smsSent = true;
      } catch (error) {
        console.error(`[notification-dispatch] SMS failed for user ${userId}:`, error);
      }
    }
  }

  return result;
}

/** Same as dispatchNotification, but for every active user in an association. */
export async function broadcastNotification(
  associationId: number,
  options: Omit<DispatchOptions, 'associationId' | 'userId'>
): Promise<{ recipientCount: number; emailsSent: number; smsSent: number }> {
  const users = await prisma.user.findMany({
    where: { associationId, isActive: true },
    select: { id: true },
  });

  let emailsSent = 0;
  let smsSent = 0;

  for (const user of users) {
    const result = await dispatchNotification({ ...options, associationId, userId: user.id });
    if (result.emailSent) emailsSent++;
    if (result.smsSent) smsSent++;
  }

  return { recipientCount: users.length, emailsSent, smsSent };
}

/**
 * F0.2: for the two call sites (jobs/meeting-jobs.ts's attendance/bulk paths,
 * tenant-management.service.ts's suspension/deletion notices) that write
 * `Notification` rows directly/in bulk rather than per-user through
 * `dispatchNotification` — narrows a list of user ids down to the ones
 * whose `pushEnabled` preference actually allows push, in one query, so
 * those call sites can add a push step without changing their existing
 * (unconditional) in-app row creation at all.
 */
export async function filterPushEligible(associationId: number, userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];
  const prefs = await prisma.notificationPreference.findMany({
    where: { associationId, userId: { in: userIds }, pushEnabled: false },
    select: { userId: true },
  });
  const optedOut = new Set(prefs.map((p) => p.userId));
  return userIds.filter((id) => !optedOut.has(id));
}
