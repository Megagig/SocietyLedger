/**
 * The trust score (T6.4): on-time percentage with bands, an aid for officers and a view for the member. It never blocks anyone.
 *
 * It is worked out for the PERSON across all of their Ajo groups in the association, not for one group. A new group has no history of its
 * own, so a per-group score could never be "At risk" when the draw looks at it; the person's record is what the group needs to see.
 * It is read from the instalments and the payments that completed them, so it is always current; a daily snapshot keeps the history.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { businessDay } from './ajo-schedule';
import { computeTrust, type TrustInstallment, type TrustResult } from './ajo-risk';

type Db = Prisma.TransactionClient | typeof prisma;

/** The person's score across every group they are (or were) in, as of `now`. */
export async function personTrust(db: Db, associationId: number, memberId: number, now: Date, excludeGroupId?: number): Promise<TrustResult> {
  const memberships = await db.ajoMembership.findMany({ where: { associationId, memberId, ...(excludeGroupId ? { groupId: { not: excludeGroupId } } : {}) }, select: { id: true, group: { select: { timezone: true, cutoffTime: true } } } });
  if (!memberships.length) return computeTrust([], now);

  const todayOf = new Map(memberships.map((m) => [m.id, businessDay(now, m.group.timezone, m.group.cutoffTime)]));
  const latestToday = new Date(Math.max(...[...todayOf.values()].map((d) => d.getTime())));
  const installments = await db.ajoInstallment.findMany({
    where: { membershipId: { in: memberships.map((m) => m.id) } },
    select: { id: true, membershipId: true, dueDate: true, amountKobo: true, paidKobo: true, status: true },
  });
  const ids = installments.map((i) => i.id);
  const [allocations, disputes] = await Promise.all([
    db.ajoContributionAllocation.findMany({ where: { installmentId: { in: ids }, contribution: { status: 'CONFIRMED', reversedBy: null } }, select: { installmentId: true, contribution: { select: { businessDate: true, receivedAt: true } } } }),
    db.ajoDispute.findMany({ where: { installmentId: { in: ids }, status: 'OPEN' }, select: { installmentId: true } }),
  ]);
  const lastPaid = new Map<number, Date>();
  for (const a of allocations) {
    if (a.installmentId === null) continue;
    const day = a.contribution.businessDate ?? a.contribution.receivedAt;
    const prev = lastPaid.get(a.installmentId);
    if (!prev || day.getTime() > prev.getTime()) lastPaid.set(a.installmentId, day);
  }
  const disputed = new Set(disputes.map((d) => d.installmentId));

  const rows: TrustInstallment[] = installments
    // Each instalment is judged by its own group's calendar, so one that is not yet due there is not counted.
    .filter((i) => i.dueDate.getTime() < (todayOf.get(i.membershipId) as Date).getTime())
    .map((i) => ({ dueDate: i.dueDate, amountKobo: i.amountKobo, paidKobo: i.paidKobo, completedOn: i.paidKobo >= i.amountKobo ? (lastPaid.get(i.id) ?? null) : null, disputed: disputed.has(i.id), waived: i.status === 'WAIVED' }));
  return computeTrust(rows, latestToday);
}

export function toTrustView(t: TrustResult) {
  return { band: t.band, onTimeCount: t.onTimeCount, dueCount: t.dueCount, onTimePercent: t.onTimeBps === null ? null : t.onTimeBps / 100, excludedDisputed: t.excludedDisputed, excludedWaived: t.excludedWaived, text: t.text };
}

/** A person's own score, in plain words with the counts behind it, for them and for officers. */
export async function getMembershipTrust(input: { associationId: number; membershipId: number; now?: Date }) {
  const m = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { memberId: true } });
  if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const trust = await personTrust(prisma, input.associationId, m.memberId, input.now ?? new Date());
  const history = await prisma.ajoTrustSnapshot.findMany({ where: { membershipId: input.membershipId }, orderBy: { computedAt: 'desc' }, take: 12, select: { band: true, onTimeCount: true, dueCount: true, computedAt: true } });
  return { ...toTrustView(trust), history };
}

/** Everyone in a group with their band, for the officers' list. */
export async function listGroupTrust(input: { associationId: number; groupId: number; now?: Date }) {
  const g = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true } });
  if (!g) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  const people = await prisma.ajoMembership.findMany({ where: { groupId: g.id, status: { in: ['ACTIVE', 'PENDING'] } }, select: { id: true, memberId: true, member: { select: { firstName: true, lastName: true } } }, orderBy: { id: 'asc' } });
  const out = [];
  for (const p of people) out.push({ membershipId: p.id, name: `${p.member.firstName} ${p.member.lastName}`.trim(), ...toTrustView(await personTrust(prisma, input.associationId, p.memberId, input.now ?? new Date())) });
  return out;
}

/**
 * T3's optional "At risk cannot take the first positions" rule used to find nobody. It now finds the people whose record across their other
 * groups puts them in the At-risk band. The group being drawn has no history yet, so it is left out of the count.
 */
export async function atRiskMembershipIds(db: Db, groupId: number, now: Date): Promise<Set<number>> {
  const group = await db.ajoGroup.findUnique({ where: { id: groupId }, select: { associationId: true } });
  if (!group) return new Set();
  const people = await db.ajoMembership.findMany({ where: { groupId, status: 'ACTIVE' }, select: { id: true, memberId: true } });
  const out = new Set<number>();
  for (const p of people) if ((await personTrust(db, group.associationId, p.memberId, now, groupId)).band === 'AT_RISK') out.add(p.id);
  return out;
}

/** The daily job: record each active participant's score when it changes, so there is a history to look back on. */
export async function snapshotTrust(now: Date, groups: Array<{ id: number; associationId: number }>): Promise<number> {
  let written = 0;
  const seen = new Map<string, TrustResult>();
  for (const g of groups) {
    const people = await prisma.ajoMembership.findMany({ where: { groupId: g.id, status: 'ACTIVE' }, select: { id: true, memberId: true } });
    for (const p of people) {
      const key = `${g.associationId}:${p.memberId}`;
      let t = seen.get(key);
      if (!t) {
        t = await personTrust(prisma, g.associationId, p.memberId, now);
        seen.set(key, t);
      }
      const last = await prisma.ajoTrustSnapshot.findFirst({ where: { membershipId: p.id }, orderBy: { computedAt: 'desc' } });
      if (last && last.band === t.band && last.onTimeCount === t.onTimeCount && last.dueCount === t.dueCount) continue;
      await prisma.ajoTrustSnapshot.create({ data: { associationId: g.associationId, membershipId: p.id, onTimeBps: t.onTimeBps, onTimeCount: t.onTimeCount, dueCount: t.dueCount, band: t.band, computedAt: now } });
      written++;
    }
  }
  return written;
}
