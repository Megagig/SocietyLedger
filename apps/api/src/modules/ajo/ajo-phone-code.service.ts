/**
 * Optional phone confirmation for joining an Ajo group (T2.1). A group can ask for it (default off); the member then types a six-digit
 * code sent by SMS before they can become active.
 *
 * It proves only that the person holding the phone received the code. Whether the number belongs to the right person is SocietyLedger's
 * step-two check. Each code costs the group's association one SMS credit, through the same engine and balance as every other text.
 *
 * Limits: a code lasts 10 minutes; 5 wrong tries lock it; one resend a minute; at most 5 codes a day per person (counted across all of
 * their memberships). The code is stored only as a keyed hash bound to the phone number it was sent to, so changing the number in the
 * meantime makes the old code useless.
 */
import { timingSafeEqual } from 'crypto';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { dispatchMessages, type DispatchInput } from '../sms/sms-engine';
import { normalizePhone, smsSegments } from '../sms/sms-rules';
import { notifyActivated, tryActivate, type ActivationOutcome } from './ajo-membership.service';
import { generatePhoneCode, hashPhoneCode } from './ajo-secrets';
import { auditAjo } from './ajo-support';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_WRONG_TRIES = 5;
export const RESEND_WAIT_MS = 60 * 1000;
export const MAX_CODES_PER_DAY = 5;

const HOUR_MS = 60 * 60 * 1000;

/** The calendar day in Nigeria (UTC+1), as a date, so "5 a day" resets at local midnight. */
export function lagosDay(now: Date): Date {
  const shifted = new Date(now.getTime() + HOUR_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** What is hashed: the number the code was sent to, and the code. */
const material = (phone: string, code: string) => `${phone}|${code}`;

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

const maskPhone = (phone: string) => `${phone.slice(0, 6)}•••••${phone.slice(-3)}`;

export interface RequestCodeInput {
  associationId: number;
  membershipId: number;
  now?: Date;
  /** For tests: stands in for the SMS provider. */
  send?: DispatchInput['send'];
}

export async function requestPhoneCode(input: RequestCodeInput): Promise<{ sentTo: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const membership = await prisma.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { group: { select: { name: true, requirePhoneConfirm: true } }, member: { select: { id: true, phone: true, firstName: true, lastName: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (!membership.group.requirePhoneConfirm) throw new RuleError('This circle does not ask members to confirm their phone.', 409, 'PHONE_CONFIRMATION_NOT_REQUIRED');
  if (membership.status !== 'PENDING') throw new RuleError('Only a pending member needs to confirm their phone.', 409, 'INVALID_MEMBERSHIP_STATE');

  const phone = normalizePhone(membership.member.phone);
  if (!phone) throw new RuleError("This member's phone number is missing or not a Nigerian number we can text. Fix it on their profile first.", 400, 'MEMBER_PHONE_INVALID');
  if (membership.phoneConfirmedNumber === phone) throw new RuleError('This phone number is already confirmed.', 409, 'ALREADY_CONFIRMED');

  const today = lagosDay(now);
  const sentToday = await prisma.ajoMembership.aggregate({ _sum: { phoneCodeDayCount: true }, where: { memberId: membership.memberId, phoneCodeDay: today } });
  if ((sentToday._sum.phoneCodeDayCount ?? 0) >= MAX_CODES_PER_DAY) {
    throw new RuleError(`Too many codes were sent to this person today (limit ${MAX_CODES_PER_DAY}). Try again tomorrow.`, 429, 'DAILY_CODE_LIMIT');
  }

  const previous = {
    phoneCodeHash: membership.phoneCodeHash,
    phoneCodeExpiresAt: membership.phoneCodeExpiresAt,
    phoneCodeAttempts: membership.phoneCodeAttempts,
    phoneCodeSentAt: membership.phoneCodeSentAt,
    phoneCodeDay: membership.phoneCodeDay,
    phoneCodeDayCount: membership.phoneCodeDayCount,
  };
  const code = generatePhoneCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const sameDay = membership.phoneCodeDay?.getTime() === today.getTime();

  // The wait guard is in the WHERE, so two requests in the same second cannot both send.
  const claimed = await prisma.ajoMembership.updateMany({
    where: { id: membership.id, OR: [{ phoneCodeSentAt: null }, { phoneCodeSentAt: { lte: new Date(now.getTime() - RESEND_WAIT_MS) } }] },
    data: { phoneCodeHash: hashPhoneCode(membership.id, material(phone, code)), phoneCodeExpiresAt: expiresAt, phoneCodeAttempts: 0, phoneCodeSentAt: now, phoneCodeDay: today, phoneCodeDayCount: sameDay ? membership.phoneCodeDayCount + 1 : 1 },
  });
  if (claimed.count !== 1) {
    const wait = membership.phoneCodeSentAt ? Math.max(1, Math.ceil((membership.phoneCodeSentAt.getTime() + RESEND_WAIT_MS - now.getTime()) / 1000)) : 60;
    throw new RuleError(`A code was sent a moment ago. Wait ${wait} seconds before asking for another.`, 429, 'CODE_TOO_SOON');
  }

  const text = `Your ${membership.group.name} confirmation code is ${code}. It expires in 10 minutes. Do not share it.`;
  const rollback = () => prisma.ajoMembership.update({ where: { id: membership.id }, data: previous }).catch((e) => console.error('[ajo] could not undo a failed phone code:', (e as Error).message));
  try {
    const sent = await dispatchMessages({
      associationId: input.associationId,
      description: 'Ajo phone confirmation',
      recipients: [{ phone, name: `${membership.member.firstName} ${membership.member.lastName}`.trim(), memberId: membership.member.id }],
      text,
      segments: smsSegments(text),
      messageType: 'SINGLE',
      inline: true,
      send: input.send,
    });
    const totals = await sent.done;
    if (totals.sent < 1) {
      await rollback();
      throw new RuleError('The text could not be delivered. No credit was used. Try again in a few minutes.', 503, 'SMS_FAILED');
    }
  } catch (error) {
    if (error instanceof RuleError && error.code === 'INSUFFICIENT_CREDITS') {
      await rollback();
      throw new RuleError('This association has no SMS credits left to send a confirmation code. Buy credits on the web, then try again.', 402, 'NO_SMS_CREDITS');
    }
    if (!(error instanceof RuleError && error.code === 'SMS_FAILED')) await rollback();
    throw error;
  }

  return { sentTo: maskPhone(phone), expiresAt };
}

export interface ConfirmCodeInput {
  associationId: number;
  membershipId: number;
  code: string;
  /** The signed-in user, for the audit trail. */
  actorUserId: number;
  now?: Date;
}

export async function confirmPhoneCode(input: ConfirmCodeInput): Promise<{ confirmed: true; activation: ActivationOutcome }> {
  const now = input.now ?? new Date();
  const code = (input.code ?? '').trim();
  if (!/^[0-9]{6}$/.test(code)) throw new RuleError('Enter the 6-digit code from the text.', 400, 'CODE_INVALID');

  const membership = await prisma.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { member: { select: { phone: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (membership.status !== 'PENDING') throw new RuleError('Only a pending member needs to confirm their phone.', 409, 'INVALID_MEMBERSHIP_STATE');
  if (!membership.phoneCodeHash || !membership.phoneCodeExpiresAt) throw new RuleError('No code is waiting. Ask for a new one.', 409, 'NO_CODE');
  if (membership.phoneCodeExpiresAt.getTime() <= now.getTime()) {
    await prisma.ajoMembership.update({ where: { id: membership.id }, data: { phoneCodeHash: null, phoneCodeExpiresAt: null, phoneCodeAttempts: 0 } });
    throw new RuleError('That code has expired. Ask for a new one.', 409, 'CODE_EXPIRED');
  }

  // Count the try before comparing, atomically, so a burst of guesses cannot slip past the limit.
  const counted = await prisma.ajoMembership.updateMany({ where: { id: membership.id, phoneCodeAttempts: { lt: MAX_WRONG_TRIES } }, data: { phoneCodeAttempts: { increment: 1 } } });
  if (counted.count !== 1) throw new RuleError('Too many wrong tries. Ask for a new code.', 409, 'CODE_LOCKED');
  const used = membership.phoneCodeAttempts + 1;

  const phone = normalizePhone(membership.member.phone);
  const matches = !!phone && sameHash(hashPhoneCode(membership.id, material(phone, code)), membership.phoneCodeHash);
  if (!matches) {
    if (used >= MAX_WRONG_TRIES) await prisma.ajoMembership.update({ where: { id: membership.id }, data: { phoneCodeHash: null, phoneCodeExpiresAt: null } });
    const left = MAX_WRONG_TRIES - used;
    throw new RuleError(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is not right, and the code is now locked. Ask for a new one.', 400, 'CODE_INVALID');
  }

  const activation = await prisma.$transaction(async (tx) => {
    await tx.ajoMembership.update({ where: { id: membership.id }, data: { phoneConfirmedAt: now, phoneConfirmedNumber: phone, phoneCodeHash: null, phoneCodeExpiresAt: null, phoneCodeAttempts: 0 } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PHONE_CONFIRMED', tableName: 'ajo_memberships', recordId: membership.id, newValues: { confirmed: true } });
    return tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId });
  });
  if (activation.activated) await notifyActivated(input.associationId, membership.id);
  return { confirmed: true, activation };
}
