// ============================================
// WHO A MESSAGE GOES TO
// One place that works out an audience, used by campaigns (to count and to send) and by announcements. Campaigns used to ask for members
// with status 'ACTIVE' while members are stored as 'active', so "all members" and "by category" matched nobody; and "owing" matched
// everybody, because "owes at least ₦0" is true of everyone.
// ============================================

import { Prisma } from '@prisma/client';
import { classifyForSms, normalizePhone, OUTSTANDING_STATUSES, ACTIVE_MEMBER, amountStillOwed, dedupeRecipients, type AudienceMember, type SmsAudience } from './sms-rules';

type Db = Prisma.TransactionClient;

export type AudienceType = 'ALL_MEMBERS' | 'SELECTED_MEMBERS' | 'MEMBER_CATEGORY' | 'CUSTOM_NUMBERS' | 'OWING_MEMBERS' | 'PAID_MEMBERS';

export interface AudienceFilter {
  memberIds?: number[];
  categories?: string[];
  customNumbers?: string[];
  /** For "owing members": only those who owe at least this much. */
  owingMinAmount?: number;
}

/** What each member still owes on charges that are not voided and not paid in full. Members who owe nothing are absent. */
export async function outstandingByMember(db: Db, associationId: number): Promise<Map<number, number>> {
  const charges = await db.transaction.findMany({
    where: { associationId, isVoided: false, status: { in: [...OUTSTANDING_STATUSES] } },
    select: { memberId: true, amount: true, payments: { select: { amountPaid: true } } },
  });
  const totals = new Map<number, number>();
  for (const c of charges) totals.set(c.memberId, (totals.get(c.memberId) ?? 0) + amountStillOwed(c));
  for (const [id, owed] of totals) if (owed <= 0) totals.delete(id);
  return totals;
}

/** The members an audience covers, with or without a phone: announcements need to know who has no number. */
export async function loadAudienceMembers(db: Db, associationId: number, type: AudienceType, filter: AudienceFilter | null | undefined): Promise<AudienceMember[]> {
  const select = { id: true, firstName: true, lastName: true, phone: true, userId: true } as const;

  switch (type) {
    case 'ALL_MEMBERS':
      return db.member.findMany({ where: { associationId, status: ACTIVE_MEMBER }, select, orderBy: { id: 'asc' } });

    case 'SELECTED_MEMBERS':
      if (!filter?.memberIds?.length) return [];
      return db.member.findMany({ where: { associationId, id: { in: filter.memberIds } }, select, orderBy: { id: 'asc' } });

    case 'MEMBER_CATEGORY':
      if (!filter?.categories?.length) return [];
      return db.member.findMany({
        where: { associationId, status: ACTIVE_MEMBER, category: { in: filter.categories.map((c) => c.toLowerCase()) } },
        select,
        orderBy: { id: 'asc' },
      });

    case 'OWING_MEMBERS':
    case 'PAID_MEMBERS': {
      const [members, owed] = await Promise.all([
        db.member.findMany({ where: { associationId, status: ACTIVE_MEMBER }, select, orderBy: { id: 'asc' } }),
        outstandingByMember(db, associationId),
      ]);
      const minimum = Math.max(filter?.owingMinAmount ?? 0, 0.01);
      return members.filter((m) => (type === 'OWING_MEMBERS' ? (owed.get(m.id) ?? 0) >= minimum : !owed.has(m.id)));
    }

    default:
      return [];
  }
}

/** Members who asked not to get announcement and campaign texts. Only people with a login have a preference to set. */
export async function optedOutUserIds(db: Db, associationId: number, members: AudienceMember[]): Promise<Set<number>> {
  const userIds = members.map((m) => m.userId).filter((id): id is number => id !== null);
  if (userIds.length === 0) return new Set();
  const rows = await db.notificationPreference.findMany({ where: { associationId, userId: { in: userIds }, announcementSmsOptOut: true }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

export interface ResolvedAudience extends SmsAudience {
  /** Every member in the audience, with or without a number. */
  members: AudienceMember[];
  /** Custom numbers that aren't numbers we could text. */
  invalidNumbers: string[];
}

/**
 * Who gets a text: members with a usable number who have not opted out, one text per number. Custom numbers are texted as given (they
 * aren't members, so there is nothing to opt out of).
 */
export async function resolveSmsAudience(db: Db, associationId: number, type: AudienceType, filter: AudienceFilter | null | undefined): Promise<ResolvedAudience> {
  if (type === 'CUSTOM_NUMBERS') {
    const valid: SmsAudience['willText'] = [];
    const invalid: string[] = [];
    for (const raw of filter?.customNumbers ?? []) {
      const phone = normalizePhone(raw);
      if (phone) valid.push({ phone });
      else invalid.push(raw);
    }
    return { members: [], willText: dedupeRecipients(valid), noPhone: [], optedOut: [], invalidNumbers: invalid };
  }

  const members = await loadAudienceMembers(db, associationId, type, filter);
  const optedOut = await optedOutUserIds(db, associationId, members);
  return { ...classifyForSms(members, optedOut), members, invalidNumbers: [] };
}
