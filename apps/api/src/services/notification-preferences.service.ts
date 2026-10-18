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

const smsService = new SMSService();

export type NotificationKind = 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
export type NotificationChannel = 'email' | 'sms' | 'inApp';

const DEFAULTS: Omit<NotificationPreference, 'id' | 'associationId' | 'userId' | 'createdAt' | 'updatedAt'> = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
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
}

/**
 * Creates the in-app notification (if the recipient allows it) and, if the
 * caller requested it AND the recipient's preferences allow it, sends email
 * and/or SMS too. SMS consumes real credits via smsService — a failure
 * there (insufficient credits, provider error) is caught and logged, same
 * graceful-degradation pattern email failures already use; it never blocks
 * the rest of the dispatch.
 */
export async function dispatchNotification(options: DispatchOptions): Promise<{
  inAppCreated: boolean;
  emailSent: boolean;
  smsSent: boolean;
}> {
  const { associationId, userId, title, message, kind } = options;
  const pref = await getPreferences(associationId, userId);

  const result = { inAppCreated: false, emailSent: false, smsSent: false };

  if (channelAllowed(pref, kind, 'inApp')) {
    await prisma.notification.create({
      data: { associationId, userId, title, message, type: kind },
    });
    result.inAppCreated = true;
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
