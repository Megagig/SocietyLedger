/**
 * Notifications that keep a rotating pot's members informed about their own circle (spec §16.4.9). Each can be switched off by the member,
 * and the weekly summary is off unless they opt in:
 *
 *   - "Round 4 is fully paid. Musa I. receives ₦100,000.00 on 31 Oct."
 *   - "Payout to Musa I. was recorded as paid."
 *   - "Your turn is in 2 rounds (31 Dec)."
 *   - Weekly (opt in): "7 of 10 paid this round · 1 behind · next payout Friday".
 *
 * Individual overdue notices are not here. They go only to the member concerned and the officers, through the reminder system, and a
 * member cannot switch that off.
 *
 * Only circles with the board on (`memberVisibility = FULL`) send these, and a person is named only if they accepted the rule that lets
 * other members see their name; otherwise the notice says "a member". Every notice is claimed in `ajo_circle_notices` before it is sent,
 * so it goes out once however often an event or the daily job runs.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { formatNaira } from './ajo-collections';
import { isoWeekKey } from './ajo-risk';
import { businessDay, dayInZone, toCalendarDate } from './ajo-schedule';
import { shownName } from './ajo-board.service';
import { notifyUser } from './ajo-support';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A funded round older than this is history, not news: a circle that existed before notices began is not told about its past. */
const NEWS_WINDOW_DAYS = 7;
const dayLabel = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekday = (d: Date) => d.toLocaleDateString('en-NG', { weekday: 'long', timeZone: 'UTC' });

export const NOTICE_PUSH = {
  roundFunded: 'ajo.circle_round_funded',
  payoutRecorded: 'ajo.circle_payout_recorded',
  yourTurn: 'ajo.circle_your_turn',
  weekly: 'ajo.circle_weekly',
} as const;

export type NoticePreferences = { roundFunded: boolean; payoutRecorded: boolean; yourTurn: boolean; weeklySummary: boolean };
export const DEFAULT_PREFERENCES: NoticePreferences = { roundFunded: true, payoutRecorded: true, yourTurn: true, weeklySummary: false };

export async function getNoticePreferences(associationId: number, userId: number): Promise<NoticePreferences> {
  const row = await prisma.ajoNotificationPreference.findUnique({ where: { associationId_userId: { associationId, userId } } });
  return row ? { roundFunded: row.roundFunded, payoutRecorded: row.payoutRecorded, yourTurn: row.yourTurn, weeklySummary: row.weeklySummary } : { ...DEFAULT_PREFERENCES };
}

export async function setNoticePreferences(associationId: number, userId: number, change: Partial<NoticePreferences>): Promise<NoticePreferences> {
  const data = { ...(change.roundFunded !== undefined ? { roundFunded: change.roundFunded } : {}), ...(change.payoutRecorded !== undefined ? { payoutRecorded: change.payoutRecorded } : {}), ...(change.yourTurn !== undefined ? { yourTurn: change.yourTurn } : {}), ...(change.weeklySummary !== undefined ? { weeklySummary: change.weeklySummary } : {}) };
  const row = await prisma.ajoNotificationPreference.upsert({ where: { associationId_userId: { associationId, userId } }, create: { associationId, userId, ...data }, update: data });
  return { roundFunded: row.roundFunded, payoutRecorded: row.payoutRecorded, yourTurn: row.yourTurn, weeklySummary: row.weeklySummary };
}

/** Claim a notice. True the first time, false if it was already sent: the key is unique, so two servers cannot both win. */
async function claim(associationId: number, groupId: number, kind: string, dedupeKey: string): Promise<boolean> {
  try {
    await prisma.ajoCircleNotice.create({ data: { associationId, groupId, kind, dedupeKey } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
}

interface Circle {
  groupId: number;
  associationId: number;
  name: string;
  timezone: string;
  cutoffTime: string;
  nameDisplay: 'FIRST_INITIAL' | 'FULL';
  rounds: Date[];
  people: Array<{ membershipId: number; userId: number | null; first: string; last: string; consented: boolean; positions: number[] }>;
}

/** A running rotating pot whose board is on, or null: only those send circle notices. */
async function loadCircle(groupId: number, now: Date): Promise<Circle | null> {
  const group = await prisma.ajoGroup.findFirst({ where: { id: groupId, model: 'ROTATING_POT', status: 'ACTIVE' } });
  if (!group) return null;
  const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId }, orderBy: { version: 'asc' } });
  const current = [...versions].reverse().find((v) => v.effectiveFrom.getTime() <= now.getTime()) ?? versions[versions.length - 1];
  if (!current || current.memberVisibility !== 'FULL') return null;
  const visible = new Set(versions.filter((v) => v.memberVisibility === 'FULL').map((v) => v.id));
  const memberships = await prisma.ajoMembership.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { id: true, member: { select: { userId: true, firstName: true, lastName: true } }, acceptances: { select: { ruleVersionId: true } }, slots: { select: { position: true } } },
  });
  const dates = await prisma.ajoInstallment.findMany({ where: { membership: { groupId } }, distinct: ['dueDate'], orderBy: { dueDate: 'asc' }, select: { dueDate: true } });
  return {
    groupId,
    associationId: group.associationId,
    name: group.name,
    timezone: group.timezone,
    cutoffTime: group.cutoffTime,
    nameDisplay: current.nameDisplay as 'FIRST_INITIAL' | 'FULL',
    rounds: dates.map((d) => d.dueDate),
    people: memberships.map((m) => ({ membershipId: m.id, userId: m.member.userId, first: m.member.firstName, last: m.member.lastName, consented: m.acceptances.some((a) => visible.has(a.ruleVersionId)), positions: m.slots.map((s) => s.position).sort((a, b) => a - b) })),
  };
}

const nameIn = (c: Circle, membershipId: number): string => {
  const p = c.people.find((x) => x.membershipId === membershipId);
  return p && p.consented ? shownName(p.first, p.last, c.nameDisplay) : 'A member';
};

/** Tell these members, except any who switched this kind off. A failed send never stops the others. */
async function tell(c: Circle, userIds: number[], pref: keyof NoticePreferences, push: string, title: string, message: string): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = await prisma.ajoNotificationPreference.findMany({ where: { associationId: c.associationId, userId: { in: userIds } } });
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  let sent = 0;
  for (const userId of userIds) {
    const r = byUser.get(userId);
    const on = r ? (r[pref] as boolean) : DEFAULT_PREFERENCES[pref];
    if (!on) continue;
    await notifyUser(c.associationId, userId, { pushType: push, entityId: c.groupId, title, message });
    sent += 1;
  }
  return sent;
}

const allUsers = (c: Circle) => c.people.map((p) => p.userId).filter((u): u is number => u !== null);

/** The nearest round that has not passed its due date, 1-based; the last round once every date is past. */
const currentRoundOf = (c: Circle, today: Date): number => {
  const i = c.rounds.findIndex((d) => d.getTime() >= toCalendarDate(today).getTime());
  return i === -1 ? c.rounds.length : i + 1;
};

/**
 * Everything the circle should say right now: a round that has just been fully paid, and a member whose turn is two rounds away. Safe to
 * run as often as you like: a notice already sent is never sent again.
 */
export async function sweepCircle(groupId: number, now: Date = new Date()): Promise<{ roundsFunded: number; turns: number }> {
  const c = await loadCircle(groupId, now);
  if (!c) return { roundsFunded: 0, turns: 0 };
  const today = businessDay(now, c.timezone, c.cutoffTime);
  const out = { roundsFunded: 0, turns: 0 };

  // A round that is fully paid, and who receives it.
  const installments = await prisma.ajoInstallment.findMany({ where: { membership: { groupId }, status: { not: 'WAIVED' } }, select: { dueDate: true, amountKobo: true, paidKobo: true } });
  const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId }, select: { position: true, membershipId: true } });
  const recent = toCalendarDate(today).getTime() - NEWS_WINDOW_DAYS * DAY_MS;
  for (const [i, date] of c.rounds.entries()) {
    const round = i + 1;
    if (date.getTime() < recent) continue;
    const rows = installments.filter((x) => x.dueDate.getTime() === date.getTime());
    const expected = rows.reduce((s, x) => s + x.amountKobo, 0n);
    const collected = rows.reduce((s, x) => s + (x.paidKobo > x.amountKobo ? x.amountKobo : x.paidKobo), 0n);
    if (expected <= 0n || collected < expected) continue;
    if (!(await claim(c.associationId, groupId, 'ROUND_FUNDED', `round-funded:${groupId}:${round}`))) continue;
    const slot = slots.find((s) => s.position === round);
    const message = slot ? `Round ${round} is fully paid. ${nameIn(c, slot.membershipId)} receives ${formatNaira(expected)} on ${dayLabel(date)}.` : `Round ${round} is fully paid: ${formatNaira(expected)} collected.`;
    out.roundsFunded += (await tell(c, allUsers(c), 'roundFunded', NOTICE_PUSH.roundFunded, `${c.name}: round ${round} is fully paid`, message)) > 0 ? 1 : 0;
  }

  // "Your turn is in 2 rounds."
  const now1 = currentRoundOf(c, today);
  for (const p of c.people) {
    if (!p.userId) continue;
    for (const position of p.positions) {
      if (position - now1 !== 2 || !c.rounds[position - 1]) continue;
      if (!(await claim(c.associationId, groupId, 'YOUR_TURN', `your-turn:${p.membershipId}:${position}`))) continue;
      out.turns += await tell(c, [p.userId], 'yourTurn', NOTICE_PUSH.yourTurn, `${c.name}: your turn is coming`, `Your turn is in 2 rounds (${dayLabel(c.rounds[position - 1] as Date)}).`);
    }
  }
  return out;
}

/** A payout was recorded as paid: tell the circle, once. */
export async function sweepPayout(payoutId: number, now: Date = new Date()): Promise<number> {
  const p = await prisma.ajoPayout.findUnique({ where: { id: payoutId }, select: { id: true, groupId: true, membershipId: true, status: true, round: true } });
  if (!p || p.status !== 'PAID' || p.round === null) return 0;
  const c = await loadCircle(p.groupId, now);
  if (!c) return 0;
  if (!(await claim(c.associationId, c.groupId, 'PAYOUT_RECORDED', `payout-recorded:${p.id}`))) return 0;
  return tell(c, allUsers(c), 'payoutRecorded', NOTICE_PUSH.payoutRecorded, `${c.name}: a payout was recorded`, `Payout to ${nameIn(c, p.membershipId)} was recorded as paid.`);
}

/** The weekly summary, for members who opted in. Sent on Mondays in the circle's own timezone, once a week per member. */
export async function sendWeeklySummaries(groupId: number, now: Date = new Date()): Promise<number> {
  const c = await loadCircle(groupId, now);
  if (!c) return 0;
  const today = businessDay(now, c.timezone, c.cutoffTime);
  if (dayInZone(now, c.timezone).getUTCDay() !== 1) return 0;
  const week = isoWeekKey(today);
  const optedIn = await prisma.ajoNotificationPreference.findMany({ where: { associationId: c.associationId, userId: { in: allUsers(c) }, weeklySummary: true }, select: { userId: true } });
  if (optedIn.length === 0) return 0;

  const round = currentRoundOf(c, today);
  const date = c.rounds[round - 1];
  const rows = date ? await prisma.ajoInstallment.findMany({ where: { membership: { groupId }, dueDate: date, status: { not: 'WAIVED' } }, select: { amountKobo: true, paidKobo: true } }) : [];
  const paid = rows.filter((r) => r.paidKobo >= r.amountKobo).length;
  const behind = new Set((await prisma.ajoInstallment.findMany({ where: { membership: { groupId }, status: { not: 'WAIVED' }, dueDate: { lt: toCalendarDate(today) } }, select: { membershipId: true, amountKobo: true, paidKobo: true } })).filter((r) => r.paidKobo < r.amountKobo).map((r) => r.membershipId)).size;
  const payouts = await prisma.ajoPayout.findMany({ where: { groupId, status: 'PAID', round: { not: null } }, select: { round: true } });
  const done = new Set(payouts.map((x) => x.round));
  const next = [...new Set(slotsPositions(c))].sort((a, b) => a - b).find((pos) => !done.has(pos));
  const nextDate = next ? c.rounds[next - 1] : undefined;
  const message = `${paid} of ${rows.length} paid this round · ${behind} behind${nextDate ? ` · next payout ${weekday(nextDate)}` : ''}`;

  let sent = 0;
  for (const { userId } of optedIn) {
    if (!(await claim(c.associationId, groupId, 'WEEKLY', `weekly:${groupId}:${userId}:${week}`))) continue;
    await notifyUser(c.associationId, userId, { pushType: NOTICE_PUSH.weekly, entityId: groupId, title: `${c.name}: this week`, message });
    sent += 1;
  }
  return sent;
}
const slotsPositions = (c: Circle): number[] => c.people.flatMap((p) => p.positions);

/** The daily run: every running rotating pot with the board on gets its sweep and, on Mondays, its weekly summaries. */
export async function runCircleNotices(now: Date = new Date(), groupIds?: number[]): Promise<{ circles: number; roundsFunded: number; turns: number; weekly: number }> {
  const groups = await prisma.ajoGroup.findMany({ where: { model: 'ROTATING_POT', status: 'ACTIVE', ...(groupIds ? { id: { in: groupIds } } : {}) }, select: { id: true } });
  const total = { circles: 0, roundsFunded: 0, turns: 0, weekly: 0 };
  for (const { id } of groups) {
    const swept = await sweepCircle(id, now);
    total.circles += 1;
    total.roundsFunded += swept.roundsFunded;
    total.turns += swept.turns;
    total.weekly += await sendWeeklySummaries(id, now);
  }
  return total;
}

// Best-effort hooks for the moments that change a circle. A failure here is logged and never fails the payment or payout that caused it.
const quiet = async (label: string, work: () => Promise<unknown>) => {
  try {
    await work();
  } catch (error) {
    console.error(`[ajo] circle notice after ${label} failed (non-critical):`, error instanceof Error ? error.name : 'unknown error');
  }
};
export const afterContributionChange = (contributionId: number) =>
  quiet('a payment', async () => {
    const c = await prisma.ajoContribution.findUnique({ where: { id: contributionId }, select: { groupId: true } });
    if (c) await sweepCircle(c.groupId);
  });
export const afterHandoverReconciled = (handoverId: number) =>
  quiet('a handover', async () => {
    const h = await prisma.ajoCashHandover.findUnique({ where: { id: handoverId }, select: { groupId: true } });
    if (h) await sweepCircle(h.groupId);
  });
export const afterPayoutPaid = (payoutId: number) =>
  quiet('a payout', async () => {
    await sweepPayout(payoutId);
    const p = await prisma.ajoPayout.findUnique({ where: { id: payoutId }, select: { groupId: true } });
    if (p) await sweepCircle(p.groupId);
  });

