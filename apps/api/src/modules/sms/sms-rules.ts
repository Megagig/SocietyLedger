// ============================================
// SMS RULES
// Pure checks the SMS and announcement code applies before it spends anything, so they can be tested without a database.
// ============================================

import { RuleError } from '../finance/rule-error';

/** Members are stored with a lowercase status. (Campaign queries asked for 'ACTIVE', so they matched nobody.) */
export const ACTIVE_MEMBER = 'active';

/** A charge is outstanding while it is in one of these states and has not been voided. */
export const OUTSTANDING_STATUSES = ['pending', 'partial', 'overdue'] as const;

/**
 * Nigerian numbers in the form the SMS provider wants (234 and ten digits), or null when it isn't a number it could send to.
 * Mirrors `formatPhoneNumber` in lib/sms.ts, but is pure, so it can be used and tested anywhere.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = '234' + cleaned.substring(1);
  else if (cleaned.length === 10 && !cleaned.startsWith('234')) cleaned = '234' + cleaned;
  return /^234\d{10}$/.test(cleaned) ? cleaned : null;
}

// The GSM 03.38 basic character set, and the extension characters that take two places. Anything else (₦, most emoji, curly quotes)
// switches the whole message to UCS-2, which fits far fewer characters in a text.
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(''),
);
const GSM_EXTENDED = new Set('^{}\\[~]|€'.split(''));

/** How many credits one text uses: one per segment, and a segment holds fewer characters when the message isn't plain GSM text. */
export function smsSegments(message: string): number {
  if (message.length === 0) return 1;
  let gsmLength = 0;
  let gsm = true;
  for (const ch of message) {
    if (GSM_BASIC.has(ch)) gsmLength += 1;
    else if (GSM_EXTENDED.has(ch)) gsmLength += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  const units = message.length; // UTF-16 code units: an emoji counts as two
  return units <= 70 ? 1 : Math.ceil(units / 67);
}

export const creditsNeeded = (recipients: number, segments: number): number => recipients * segments;

/** Whether the balance covers it. The message says exactly what is short, so the officer knows what to buy. */
export function assertEnoughCredits(balance: number, needed: number): void {
  if (balance + 0.0001 < needed) {
    throw new RuleError(
      `You need ${needed} SMS ${needed === 1 ? 'credit' : 'credits'} for this and have ${balance}. Buy ${Math.ceil(needed - balance)} more on the web to send it.`,
      409,
      'INSUFFICIENT_CREDITS',
    );
  }
}

export interface Recipient {
  phone: string;
  name?: string;
  memberId?: number;
}

/** One text per phone number, however many times it was listed, keeping the first (so a member listed twice isn't texted or charged twice). */
export function dedupeRecipients<T extends { phone: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const key = normalizePhone(item.phone) ?? item.phone;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export interface AudienceMember {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  userId: number | null;
}

export interface SmsAudience {
  /** Members who will get a text. */
  willText: (Recipient & { phone: string })[];
  /** Members with no phone number on record, or one that isn't a number we can text. */
  noPhone: AudienceMember[];
  /** Members who chose not to receive announcement texts. */
  optedOut: AudienceMember[];
}

/**
 * Who in an audience gets a text: a member with a usable number who has not opted out. Everyone else is counted, so the officer can see
 * who a send will miss and why. Members who share a number get one text.
 */
export function classifyForSms(members: AudienceMember[], optedOutUserIds: ReadonlySet<number>): SmsAudience {
  const willText: SmsAudience['willText'] = [];
  const noPhone: AudienceMember[] = [];
  const optedOut: AudienceMember[] = [];

  for (const m of members) {
    const phone = normalizePhone(m.phone);
    if (!phone) {
      noPhone.push(m);
      continue;
    }
    if (m.userId !== null && optedOutUserIds.has(m.userId)) {
      optedOut.push(m);
      continue;
    }
    willText.push({ phone, name: `${m.firstName} ${m.lastName}`.trim(), memberId: m.id });
  }

  return { willText: dedupeRecipients(willText), noPhone, optedOut };
}

/** What owed means for "owing" and "paid up" audiences: what is still unpaid on charges that are not voided, after payments. */
export function amountStillOwed(charge: { amount: { toString(): string } | number | string; payments: { amountPaid: { toString(): string } | number | string }[] }): number {
  return Math.max(0, Number(charge.amount.toString()) - charge.payments.reduce((sum, p) => sum + Number(p.amountPaid.toString()), 0));
}

export const CAMPAIGN_STARTABLE = ['DRAFT', 'SCHEDULED'] as const;
export const CAMPAIGN_CANCELLABLE = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'] as const;

export function assertCampaignStartable(status: string): void {
  if (!(CAMPAIGN_STARTABLE as readonly string[]).includes(status)) {
    throw new RuleError(
      status === 'IN_PROGRESS' ? 'This campaign is already being sent.' : `A campaign that is ${status.toLowerCase().replace('_', ' ')} can't be started.`,
      409,
      'ALREADY_STARTED',
    );
  }
}

/** A message the carriers will take: not empty, and no more than a handful of segments, so one slip can't cost a fortune. */
export const MAX_SEGMENTS = 6;
export function assertMessageUsable(message: string): number {
  const text = message.trim();
  if (!text) throw new RuleError('Write the message first.', 400, 'EMPTY_MESSAGE');
  const segments = smsSegments(text);
  if (segments > MAX_SEGMENTS) {
    throw new RuleError(`That message would use ${segments} credits for every person. Shorten it to ${MAX_SEGMENTS} or fewer.`, 400, 'MESSAGE_TOO_LONG');
  }
  return segments;
}
