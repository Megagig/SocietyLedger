// ============================================
// ANNOUNCEMENTS
// One message from the officers to chosen members: in their app feed with a push, and optionally by email and SMS. It is kept as a
// record, so officers can see what was sent, to whom, and what happened to it. Texts go through the same engine as every other SMS, so
// credits are reserved first and given back for texts that don't go out.
// ============================================

import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ModuleFeatureService } from '../../services/module-feature.service';
import { SettingsService } from '../settings/settings.service';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { RuleError } from '../finance/rule-error';
import { resolveSmsAudience, type AudienceFilter } from '../sms/sms-audience';
import { dispatchMessages, INLINE_LIMIT } from '../sms/sms-engine';
import {
  assertAudienceNamed,
  audienceTypeFor,
  defaultSmsText,
  smsCost,
  type AnnouncementAudienceInput,
  type Reach,
} from './announcement-rules';

export interface AnnouncementInput extends AnnouncementAudienceInput {
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'urgent';
  sendEmail: boolean;
  sendSms: boolean;
  /** The text to send instead of the default one. */
  smsText?: string;
}

const filterOf = (input: AnnouncementAudienceInput): AudienceFilter => ({ categories: input.categories, memberIds: input.memberIds });

async function associationName(associationId: number): Promise<string> {
  const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });
  return association?.name || 'Your Association';
}

/** Who an announcement would reach, member by member: the app, email, and SMS, and who it would miss. */
async function reachOf(associationId: number, input: AnnouncementAudienceInput) {
  const audience = await resolveSmsAudience(prisma, associationId, audienceTypeFor(input.audience), filterOf(input));
  const users = await prisma.user.findMany({
    where: { id: { in: audience.members.map((m) => m.userId).filter((id): id is number => id !== null) }, isActive: true },
    select: { id: true, email: true },
  });
  const loginIds = new Set(users.map((u) => u.id));
  const withLogin = audience.members.filter((m) => m.userId !== null && loginIds.has(m.userId));
  const noLogin = audience.members.filter((m) => m.userId === null || !loginIds.has(m.userId));

  const noLoginEmails = noLogin.length
    ? await prisma.member.findMany({ where: { id: { in: noLogin.map((m) => m.id) }, email: { not: null } }, select: { id: true, email: true, firstName: true, lastName: true } })
    : [];

  const reach: Reach = {
    members: audience.members.length,
    withLogin: withLogin.length,
    noLogin: noLogin.length,
    withEmail: users.filter((u) => u.email).length + noLoginEmails.length,
    willText: audience.willText.length,
    noPhone: audience.noPhone.length,
    optedOut: audience.optedOut.length,
  };

  return { audience, reach, withLogin, noLoginEmails };
}

async function requireSmsAllowed(associationId: number): Promise<void> {
  if (!(await ModuleFeatureService.isModuleEnabled(associationId, 'sms'))) {
    throw new RuleError('Texts are not part of your plan. Untick SMS to send this by the app and email.', 403, 'MODULE_DISABLED');
  }
  if ((await SettingsService.getSetting(associationId, 'integrations', 'smsProvider')) === 'none') {
    throw new RuleError('SMS sending is switched off for your association. Untick SMS, or switch it on in Settings.', 403, 'SMS_DISABLED');
  }
}

export const announcementsService = {
  /** What sending this would do, before it is sent: who it reaches, who it misses, and what the SMS would cost against the balance. */
  async preview(associationId: number, input: AnnouncementInput) {
    assertAudienceNamed(input);
    const [{ reach }, name, balanceRow] = await Promise.all([
      reachOf(associationId, input),
      associationName(associationId),
      prisma.sMSCreditBalance.findUnique({ where: { associationId }, select: { balance: true } }),
    ]);

    const smsText = input.smsText?.trim() || defaultSmsText(name, input.title, input.message);
    const sms = input.sendSms ? smsCost(reach, smsText, Number(balanceRow?.balance ?? 0)) : null;

    return { reach, smsText, sms };
  },

  async create(associationId: number, userId: number, input: AnnouncementInput) {
    assertAudienceNamed(input);
    if (input.sendSms) await requireSmsAllowed(associationId);

    const name = await associationName(associationId);
    const { audience, reach, withLogin, noLoginEmails } = await reachOf(associationId, input);
    const smsText = input.smsText?.trim() || defaultSmsText(name, input.title, input.message);

    if (input.sendSms && reach.willText === 0) {
      throw new RuleError('No one in this audience can be texted: they have no usable phone number, or have opted out. Untick SMS to send it by the app.', 409, 'NO_RECIPIENTS');
    }
    if (reach.members === 0) throw new RuleError('There is no one in this audience.', 409, 'AUDIENCE_EMPTY');

    const segments = input.sendSms ? smsCost(reach, smsText, Infinity).segments : 1;

    const record = await prisma.announcement.create({
      data: {
        associationId,
        title: input.title,
        message: input.message,
        priority: input.priority,
        audience: input.audience,
        audienceFilter: { categories: input.categories ?? [], memberIds: input.memberIds ?? [] },
        sendEmail: input.sendEmail,
        sendSms: input.sendSms,
        smsText: input.sendSms ? smsText : null,
        status: input.sendSms ? 'SENDING' : 'COMPLETED',
        completedAt: input.sendSms ? null : new Date(),
        createdBy: userId,
        memberCount: reach.members,
        noLoginCount: reach.noLogin,
        smsRequested: input.sendSms ? reach.willText : 0,
        noPhoneCount: input.sendSms ? reach.noPhone : 0,
        optedOutCount: input.sendSms ? reach.optedOut : 0,
      },
    });

    // The texts first: credits are reserved before anything is sent, so if they aren't there nothing at all goes out and no record is left.
    let texts: Awaited<ReturnType<typeof dispatchMessages>> | null = null;
    if (input.sendSms) {
      try {
        texts = await dispatchMessages({
          associationId,
          description: `Announcement: ${input.title}`,
          recipients: audience.willText,
          text: smsText,
          segments,
          messageType: 'BULK',
          announcementId: record.id,
          inline: audience.willText.length <= INLINE_LIMIT,
        });
      } catch (error) {
        await prisma.announcement.delete({ where: { id: record.id } });
        throw error;
      }
    }

    // The app feed and push (each member's own preferences apply), and email, for the members who have a login
    let inAppCount = 0;
    let emailCount = 0;
    const emailData = { title: input.title, message: input.message, priority: input.priority, associationName: name };
    for (const member of withLogin) {
      const result = await dispatchNotification({
        associationId,
        userId: member.userId!,
        title: `📢 ${input.title}`,
        message: input.message,
        kind: 'announcement',
        sendEmail: input.sendEmail,
        sendSMS: false, // texts go through the SMS engine above
        emailSubject: `📢 ${input.title} - ${name}`,
        emailTemplate: 'announcement',
        emailData,
      });
      if (result.inAppCreated) inAppCount++;
      if (result.emailSent) emailCount++;
    }

    // Members with no login can't see the feed: email is how they are reached, if it was ticked
    if (input.sendEmail) {
      for (const member of noLoginEmails) {
        try {
          await sendEmail({ to: member.email!, subject: `📢 ${input.title} - ${name}`, template: 'announcement', data: emailData });
          emailCount++;
        } catch (error) {
          console.error(`[announcement] email to member ${member.id} failed:`, error);
        }
      }
    }

    await prisma.announcement.update({ where: { id: record.id }, data: { inAppCount, emailCount } });

    const totals = texts ? (texts.accepted <= INLINE_LIMIT ? await texts.done : null) : null;
    const saved = await prisma.announcement.findUniqueOrThrow({ where: { id: record.id } });

    return {
      announcement: saved,
      reach,
      inProgress: !!texts && totals === null,
      smsSent: totals?.sent ?? 0,
      smsFailed: totals?.failed ?? 0,
    };
  },

  async list(associationId: number, page = 1, limit = 20) {
    const [rows, totalCount] = await Promise.all([
      prisma.announcement.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.announcement.count({ where: { associationId } }),
    ]);
    const senders = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdBy))] } },
      select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } },
    });
    const nameOf = (id: number) => {
      const u = senders.find((s) => s.id === id);
      return u?.member ? `${u.member.firstName} ${u.member.lastName}`.trim() : u?.email ?? 'An officer';
    };
    return {
      announcements: rows.map((r) => ({ ...r, creditsUsed: Number(r.creditsUsed), sentBy: nameOf(r.createdBy) })),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: page * limit < totalCount },
    };
  },

  async get(associationId: number, id: number) {
    const record = await prisma.announcement.findFirst({ where: { id, associationId } });
    if (!record) throw new Error('Announcement not found');

    // Where the texts stand now, counted from the messages themselves
    const grouped = await prisma.sMSMessage.groupBy({ by: ['status'], where: { announcementId: id }, _count: true });
    const count = (...statuses: string[]) => grouped.filter((g) => statuses.includes(g.status)).reduce((sum, g) => sum + g._count, 0);

    return {
      ...record,
      creditsUsed: Number(record.creditsUsed),
      sms: { pending: count('PENDING'), sent: count('SENT', 'DELIVERED'), delivered: count('DELIVERED'), failed: count('FAILED', 'REJECTED') },
    };
  },
};
