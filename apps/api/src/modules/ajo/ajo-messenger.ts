/**
 * Telling a member something (T6): the one place that decides how a message reaches them.
 *
 * Someone with a login gets an in-app notice, a push and an email according to their own preferences, which cost nothing. Someone with no
 * login can only be reached by SMS, which costs the group a credit. The result says whether they were told and, if not, why, so a caller
 * can leave a thing undisclosed (a late fee that nobody has been told about is not owed) instead of pretending.
 */
import prisma from '../../lib/prisma';
import { dispatchNotification, type NotificationKind } from '../../services/notification-preferences.service';
import { RuleError } from '../finance/rule-error';
import { dispatchMessages, type DispatchInput } from '../sms/sms-engine';
import { normalizePhone, smsSegments } from '../sms/sms-rules';

export interface MessageResult {
  delivered: boolean;
  channel: 'inApp' | 'sms' | 'none';
  /** Set when not delivered. */
  reason?: 'NO_PHONE' | 'NO_SMS_CREDITS' | 'SEND_FAILED';
}

export interface MessageInput {
  associationId: number;
  member: { id: number; userId: number | null; firstName: string; lastName: string; phone: string | null };
  title: string;
  message: string;
  pushType: string;
  kind?: NotificationKind;
  entityId?: number;
  /** Allow SMS for someone with no login. Off for things that are not worth a credit. */
  sms?: boolean;
  /** For tests: stands in for the SMS provider. */
  send?: DispatchInput['send'];
}

export async function messageMember(input: MessageInput): Promise<MessageResult> {
  const { member } = input;
  try {
    if (member.userId) {
      await dispatchNotification({ associationId: input.associationId, userId: member.userId, kind: input.kind ?? 'payment_due', title: input.title, message: input.message, entityId: input.entityId, pushType: input.pushType, sendEmail: true, emailSubject: input.title });
      return { delivered: true, channel: 'inApp' };
    }
    if (input.sms === false) return { delivered: false, channel: 'none', reason: 'NO_PHONE' };
    const phone = normalizePhone(member.phone);
    if (!phone) return { delivered: false, channel: 'none', reason: 'NO_PHONE' };
    const sent = await dispatchMessages({
      associationId: input.associationId,
      description: 'Ajo message',
      recipients: [{ phone, name: `${member.firstName} ${member.lastName}`.trim(), memberId: member.id }],
      text: input.message,
      segments: smsSegments(input.message),
      messageType: 'SINGLE',
      inline: true,
      send: input.send,
    });
    const totals = await sent.done;
    return totals.sent >= 1 ? { delivered: true, channel: 'sms' } : { delivered: false, channel: 'none', reason: 'SEND_FAILED' };
  } catch (error) {
    if (error instanceof RuleError && error.code === 'INSUFFICIENT_CREDITS') return { delivered: false, channel: 'none', reason: 'NO_SMS_CREDITS' };
    console.error('[ajo] message to a member failed (non-critical):', error instanceof Error ? error.message : 'unknown error');
    return { delivered: false, channel: 'none', reason: 'SEND_FAILED' };
  }
}

/** The member row a message needs, by membership. */
export async function memberOfMembership(membershipId: number) {
  const m = await prisma.ajoMembership.findUnique({ where: { id: membershipId }, select: { associationId: true, member: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true } } } });
  return m ? { associationId: m.associationId, member: m.member } : null;
}
