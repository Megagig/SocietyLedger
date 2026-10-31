/**
 * What a collector-thrift saver sees about their own savings (spec §16.6). Their own records only: nothing here reads another saver's
 * money, and none of it gives anyone else access to it.
 *
 * Statuses come from ajo-status.ts, the same words and rules the Circle board and the officer screens use, so a saver, an officer and a
 * report always agree.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { effectiveChoice, isPromptOpen, cycleStartOf, type CycleChoice } from './ajo-cycle';
import { collectorFeeFor, type FeeType } from './ajo-payout-calc';
import { versionInForceOn } from './ajo-risk';
import { businessDay, dayInZone, describeCadence, toCalendarDate, type Frequency } from './ajo-schedule';
import { isPaid, paymentStatus, spreadReported, STATUS_LABEL, type PaymentState, type PaymentStatus } from './ajo-status';
import { getMembershipTrust } from './ajo-trust.service';

const HOUR_MS = 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const k = (kobo: bigint) => kobo.toString();
const lastFour = (text: string | null | undefined) => (text ? text.slice(-4) : null);

/** A cash payment not handed in within this long is shown to the saver as "Not yet handed in", and they can ask about it in one tap. */
export const HAND_IN_TARGET_HOURS = 24;
/** Handed in but not confirmed by the office within this long: "Not yet confirmed by the office". */
export const OFFICE_CONFIRM_TARGET_HOURS = 48;

async function loadSaver(associationId: number, membershipId: number) {
  const m = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, include: { group: true, member: { select: { id: true, firstName: true, lastName: true, userId: true } } } });
  if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (m.group.model !== 'COLLECTOR_THRIFT') throw new RuleError('This is for collector-thrift savers. A rotating pot shows the circle board instead.', 400, 'NOT_COLLECTOR_THRIFT');
  return m;
}
type Saver = Awaited<ReturnType<typeof loadSaver>>;

/** Names by login, for "recorded by" and "confirmed by". First name and last initial only, like the circle board. */
async function namesOf(associationId: number, userIds: Array<number | null>): Promise<Map<number, string>> {
  const ids = [...new Set(userIds.filter((u): u is number => u !== null))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.member.findMany({ where: { associationId, userId: { in: ids } }, select: { userId: true, firstName: true, lastName: true } });
  return new Map(rows.filter((r) => r.userId !== null).map((r) => [r.userId as number, `${r.firstName} ${r.lastName.charAt(0)}.`.trim()]));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Each installment with its status
// ---------------------------------------------------------------------------------------------------------------------------------

interface Day {
  id: number;
  cycleNo: number;
  dueDate: Date;
  amountKobo: bigint;
  paidKobo: bigint;
  state: PaymentState;
  completedOn: Date | null;
}

/** Every installment of the saver's (for the given cycles) with its status as of `today`, using the same rules as the Circle board. */
async function dayStates(m: Saver, today: Date, cycleNos: number[] | null): Promise<Day[]> {
  const rows = await prisma.ajoInstallment.findMany({ where: { membershipId: m.id, ...(cycleNos ? { cycleNo: { in: cycleNos } } : {}) }, orderBy: { dueDate: 'asc' }, select: { id: true, cycleNo: true, dueDate: true, amountKobo: true, paidKobo: true, status: true } });
  const pending = await prisma.ajoContribution.aggregate({ where: { membershipId: m.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, _sum: { amountKobo: true } });
  const spread = spreadReported(rows.map((r) => ({ amountKobo: r.amountKobo, paidKobo: r.paidKobo, waived: r.status === 'WAIVED' })), pending._sum.amountKobo ?? 0n);

  const allocations = await prisma.ajoContributionAllocation.findMany({
    where: { installmentId: { in: rows.map((r) => r.id) }, contribution: { status: 'CONFIRMED', reversedBy: { is: null } } },
    select: { installmentId: true, contribution: { select: { businessDate: true, confirmedAt: true } } },
  });
  const doneOn = new Map<number, Date>();
  for (const a of allocations) {
    if (a.installmentId === null) continue;
    const day = a.contribution.businessDate ?? (a.contribution.confirmedAt ? dayInZone(a.contribution.confirmedAt, m.group.timezone) : null);
    if (day && (!doneOn.has(a.installmentId) || day.getTime() > (doneOn.get(a.installmentId) as Date).getTime())) doneOn.set(a.installmentId, day);
  }
  const disputes = await prisma.ajoDispute.findMany({ where: { membershipId: m.id, status: 'OPEN' }, select: { installmentId: true, contribution: { select: { installmentId: true } } } });
  const disputed = new Set<number>();
  for (const d of disputes) {
    const target = d.installmentId ?? d.contribution?.installmentId ?? null;
    if (target !== null) disputed.add(target);
  }

  const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: m.groupId }, orderBy: { version: 'asc' }, select: { id: true, version: true, effectiveFrom: true, graceDays: true } });
  const accepted = await prisma.ajoRuleAcceptance.findMany({ where: { membershipId: m.id }, select: { ruleVersionId: true, acceptedAt: true } });
  const graceOf = new Map(versions.map((v) => [v.id, v.graceDays]));
  const fallback = versions[0]?.graceDays ?? 3;
  const nextDue = rows.find((r) => r.dueDate.getTime() >= today.getTime() && r.paidKobo < r.amountKobo)?.id ?? null;

  return rows.map((r, i) => {
    const completedOn = r.paidKobo >= r.amountKobo ? doneOn.get(r.id) ?? null : null;
    const vId = versionInForceOn(r.dueDate, versions, accepted);
    const state = paymentStatus({ dueDate: r.dueDate, amountKobo: r.amountKobo, paidKobo: r.paidKobo, reportedKobo: spread[i] ?? 0n, waived: r.status === 'WAIVED', completedOn, disputed: disputed.has(r.id), graceDays: vId !== null ? graceOf.get(vId) ?? fallback : fallback, isCurrentRound: r.id === nextDue }, today);
    return { id: r.id, cycleNo: r.cycleNo, dueDate: r.dueDate, amountKobo: r.amountKobo, paidKobo: r.paidKobo, state, completedOn };
  });
}

const feeText = (type: FeeType, value: bigint, amountKobo: bigint): string => {
  if (type === 'NONE' || value <= 0n) return 'No collector fee.';
  if (type === 'DAYS') return `${value} day${value === 1n ? '' : 's'} of your contribution (${formatNaira(value * amountKobo)}).`;
  if (type === 'FIXED') return `A fixed fee of ${formatNaira(value)}.`;
  return `${Number(value) / 100}% of what you saved.`;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// 5.1 My savings, 5.2 the calendar
// ---------------------------------------------------------------------------------------------------------------------------------

export async function getSavings(input: { associationId: number; membershipId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const m = await loadSaver(input.associationId, input.membershipId);
  const g = m.group;
  const today = businessDay(now, g.timezone, g.cutoffTime);
  const cycle = await prisma.ajoMembershipCycle.findUnique({ where: { membershipId_cycleNo: { membershipId: m.id, cycleNo: g.cycleNo } } });
  const amountKobo = cycle?.amountKobo ?? g.contributionKobo;
  const carriedKobo = cycle?.carriedKobo ?? 0n;
  const choice = (cycle?.choice ?? 'PENDING') as CycleChoice;

  const days = await dayStates(m, today, [g.cycleNo]);
  const countable = days.filter((d) => d.state.status !== 'WAIVED');
  const savedKobo = days.reduce((s, d) => s + d.paidKobo, 0n);
  const pending = await prisma.ajoContribution.aggregate({ where: { membershipId: m.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, _sum: { amountKobo: true } });
  const reportedKobo = pending._sum.amountKobo ?? 0n;

  const made = countable.filter((d) => isPaid(d.state.status)).length;
  const missed = countable.filter((d) => d.state.status === 'MISSED').length;
  const toGo = countable.filter((d) => !isPaid(d.state.status) && d.state.status !== 'MISSED' && d.dueDate.getTime() >= today.getTime()).length;
  const expectedToDate = countable.filter((d) => d.dueDate.getTime() <= today.getTime()).reduce((s, d) => s + d.amountKobo, 0n);
  const behindKobo = expectedToDate > savedKobo ? expectedToDate - savedKobo : 0n;

  const feeKobo = collectorFeeFor(g.collectorFeeType as FeeType, g.collectorFeeValue, savedKobo, amountKobo);
  const heldKobo = savedKobo + carriedKobo;
  const receiveKobo = heldKobo > feeKobo ? heldKobo - feeKobo : 0n;

  const endsOn = g.endsOn;
  const cycleOver = endsOn !== null && today.getTime() > toCalendarDate(endsOn).getTime();
  const payout = await prisma.ajoPayout.findFirst({ where: { membershipId: m.id, cycleNo: g.cycleNo, round: null, status: { in: ['PREPARED', 'APPROVED', 'PAID'] } }, orderBy: { id: 'desc' } });
  const account = await prisma.ajoPayoutAccount.findUnique({ where: { memberId: m.memberId }, select: { id: true } });
  const verified = (await prisma.ajoVerification.count({ where: { memberId: m.memberId, status: 'VERIFIED' } })) > 0;
  const will = effectiveChoice(choice);

  let payoutState: 'UPCOMING' | 'PREPARED' | 'APPROVED' | 'PAID' | 'HELD' | 'CONTINUING';
  let holdReason: string | null = null;
  if (payout) payoutState = payout.status as 'PREPARED' | 'APPROVED' | 'PAID';
  else if (!cycleOver) payoutState = will === 'CONTINUE' ? 'CONTINUING' : 'UPCOMING';
  else if (will === 'CONTINUE') payoutState = 'CONTINUING';
  else {
    payoutState = 'HELD';
    holdReason = !account ? 'Add your payout account' : !verified ? 'Waiting for SocietyLedger verification' : 'Waiting for the office to prepare it';
  }
  // Someone who will withdraw but has no account yet should hear it before the cycle ends, not after.
  if (!account && !payout && will === 'WITHDRAW' && payoutState === 'UPCOMING') holdReason = 'Add your payout account before the cycle ends';

  return {
    membershipId: m.id,
    groupName: g.name,
    cycleNo: g.cycleNo,
    amountKobo: k(amountKobo),
    cadence: describeCadence(g.frequency as Frequency, { intervalCount: g.intervalCount, intervalUnit: g.intervalUnit }),
    startsOn: iso(cycleStartOf(g)),
    endsOn: endsOn ? iso(endsOn) : null,
    timezone: g.timezone,
    saved: { savedKobo: k(savedKobo), carriedKobo: k(carriedKobo), heldKobo: k(heldKobo), reportedKobo: k(reportedKobo) },
    progress: { total: countable.length, made, missed, toGo },
    pace: { expectedToDateKobo: k(expectedToDate), behindKobo: k(behindKobo), upToDate: behindKobo === 0n },
    receive: { savedKobo: k(heldKobo), feeKobo: k(feeKobo), netKobo: k(receiveKobo), feeText: feeText(g.collectorFeeType as FeeType, g.collectorFeeValue, amountKobo), cycleEnds: endsOn ? iso(endsOn) : null, text: `${formatNaira(heldKobo)} saved${feeKobo > 0n ? ` − ${formatNaira(feeKobo)} collector fee` : ''} = ${formatNaira(receiveKobo)}` },
    payout: { state: payoutState, holdReason, paidAt: payout?.paidAt ?? null, referenceLast4: lastFour(payout?.paidReference), netKobo: payout ? k(payout.netKobo) : null, willBe: will },
    cycleChoice: { choice, effective: will, promptOpen: endsOn !== null && isPromptOpen(endsOn, today) },
    calendar: days.map((d) => ({ id: d.id, dueDate: iso(d.dueDate), amountKobo: k(d.amountKobo), paidKobo: k(d.paidKobo), status: d.state.status, label: STATUS_LABEL[d.state.status], graceEndsOn: d.state.graceEndsOn ? iso(d.state.graceEndsOn) : null, behindKobo: k(d.state.behindKobo), datePaid: d.completedOn ? iso(d.completedOn) : null })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 5.3 Payment history, 5.4 where my cash is
// ---------------------------------------------------------------------------------------------------------------------------------

/** Each payment: when, how much, how, who took it, whether it counts yet, when it was confirmed, and its receipt number. */
export async function getPayments(input: { associationId: number; membershipId: number }) {
  const m = await loadSaver(input.associationId, input.membershipId);
  const rows = await prisma.ajoContribution.findMany({ where: { membershipId: m.id }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], take: 300, include: { reversedBy: { select: { id: true, reason: true } } } });
  const names = await namesOf(input.associationId, rows.flatMap((r) => [r.collectorId, r.confirmedBy]));
  return {
    timezone: m.group.timezone,
    payments: rows.map((r) => {
      const reversed = r.reversedBy !== null;
      return {
        id: r.id,
        receivedAt: r.receivedAt,
        amountKobo: k(r.amountKobo),
        method: r.method,
        status: r.status,
        reversed,
        counts: r.status === 'CONFIRMED' && !reversed && r.reversalOfId === null,
        label: reversed ? 'Reversed' : r.status === 'CONFIRMED' ? 'Confirmed' : r.status === 'REJECTED' ? 'Turned down' : r.status === 'REVERSED' ? 'Reversal' : 'Reported, awaiting confirmation',
        recordedBy: r.method === 'CASH' ? (r.collectorId ? names.get(r.collectorId) ?? 'Your collector' : 'The office') : 'You',
        confirmedAt: r.confirmedAt,
        confirmedBy: r.confirmedBy ? names.get(r.confirmedBy) ?? 'The office' : null,
        receiptNumber: r.reference,
        canDownloadReceipt: r.status === 'CONFIRMED' && !reversed && r.reversalOfId === null,
      };
    }),
  };
}

type Stage = 'RECORDED' | 'HANDED_IN' | 'CONFIRMED' | 'REJECTED' | 'REVERSED';

/**
 * For every cash payment, three steps: the collector recorded it, the collector handed it in, the office confirmed it. A step that is
 * late says so, and the saver can ask about it in one tap. This is the answer to the fear of a collector who disappears with the cash.
 */
export async function getCashTracker(input: { associationId: number; membershipId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const m = await loadSaver(input.associationId, input.membershipId);
  const rows = await prisma.ajoContribution.findMany({
    where: { membershipId: m.id, method: 'CASH', reversalOfId: null },
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take: 100,
    include: { handover: { select: { id: true, createdAt: true, forDate: true } }, reversedBy: { select: { id: true } } },
  });
  const names = await namesOf(input.associationId, rows.flatMap((r) => [r.collectorId, r.confirmedBy]));
  const cycleRows = await prisma.ajoInstallment.findMany({ where: { membershipId: m.id, cycleNo: m.group.cycleNo }, orderBy: { dueDate: 'asc' }, select: { id: true, amountKobo: true, paidKobo: true } });
  const openInstallment = cycleRows.find((r) => r.paidKobo < r.amountKobo) ?? null;

  return {
    timezone: m.group.timezone,
    targets: { handInHours: HAND_IN_TARGET_HOURS, officeConfirmHours: OFFICE_CONFIRM_TARGET_HOURS },
    payments: rows.map((r) => {
      const reversed = r.reversedBy !== null;
      const handedAt = r.handover?.createdAt ?? null;
      const stage: Stage = reversed ? 'REVERSED' : r.status === 'REJECTED' ? 'REJECTED' : r.status === 'CONFIRMED' ? 'CONFIRMED' : handedAt ? 'HANDED_IN' : 'RECORDED';
      const sinceRecorded = now.getTime() - r.receivedAt.getTime();
      const handInLate = stage === 'RECORDED' && sinceRecorded > HAND_IN_TARGET_HOURS * HOUR_MS;
      const confirmLate = stage === 'HANDED_IN' && handedAt !== null && now.getTime() - handedAt.getTime() > OFFICE_CONFIRM_TARGET_HOURS * HOUR_MS;
      return {
        id: r.id,
        amountKobo: k(r.amountKobo),
        stage,
        recorded: { by: r.collectorId ? names.get(r.collectorId) ?? 'Your collector' : 'The office', at: r.receivedAt },
        handedIn: handedAt ? { at: handedAt, forDate: iso(r.handover?.forDate as Date) } : null,
        confirmed: r.status === 'CONFIRMED' && !reversed && r.confirmedAt ? { by: r.confirmedBy ? names.get(r.confirmedBy) ?? 'The office' : 'The office', at: r.confirmedAt } : null,
        missingFromHandover: r.missingFromHandover,
        late: handInLate ? { step: 'HANDED_IN' as const, text: 'Not yet handed in' } : confirmLate ? { step: 'CONFIRMED' as const, text: 'Not yet confirmed by the office' } : r.missingFromHandover ? { step: 'HANDED_IN' as const, text: 'Missing from the cash handed in' } : null,
        /** The instalment a question would be about: the one this payment was for, or the oldest still unpaid. */
        queryInstallmentId: r.installmentId ?? openInstallment?.id ?? null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 5.5 My collector, 5.6 fees, 5.7 my record
// ---------------------------------------------------------------------------------------------------------------------------------

/** The saver's own assigned collector, and the fee rule. A collector's phone is shown only to the saver they collect from. */
export async function getCollectorInfo(input: { associationId: number; membershipId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const m = await loadSaver(input.associationId, input.membershipId);
  const today = businessDay(now, m.group.timezone, m.group.cutoffTime);
  const a = await prisma.ajoCollectorAssignment.findFirst({ where: { membershipId: m.id, startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] }, orderBy: { id: 'desc' } });
  const mine = a ? await prisma.member.findFirst({ where: { associationId: input.associationId, userId: a.collectorUserId }, select: { firstName: true, lastName: true, phone: true } }) : null;
  const last = a ? await prisma.ajoContribution.findFirst({ where: { membershipId: m.id, collectorId: a.collectorUserId, method: 'CASH' }, orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }) : null;
  const cycle = await prisma.ajoMembershipCycle.findUnique({ where: { membershipId_cycleNo: { membershipId: m.id, cycleNo: m.group.cycleNo } } });
  const amountKobo = cycle?.amountKobo ?? m.group.contributionKobo;
  return {
    collector: a && mine ? { name: `${mine.firstName} ${mine.lastName}`.trim(), initials: `${mine.firstName.charAt(0)}${mine.lastName.charAt(0)}`.toUpperCase(), phone: mine.phone, since: iso(a.startsOn), dailyTargetKobo: a.dailyTargetKobo ? k(a.dailyTargetKobo) : null, lastVisitAt: last?.receivedAt ?? null } : null,
    fee: { type: m.group.collectorFeeType, text: feeText(m.group.collectorFeeType as FeeType, m.group.collectorFeeValue, amountKobo) },
  };
}

/**
 * The consecutive payments made on time, counting back from the most recent one that was decided. A late or missed payment ends it. One still
 * inside its grace, reported, under review or waived is not decided yet, so it neither counts nor ends the streak.
 */
export function streakOf(days: Array<{ state: { status: PaymentStatus }; dueDate: Date }>, today: Date): number {
  const decided: PaymentStatus[] = ['PAID_ON_TIME', 'PAID_LATE', 'MISSED'];
  const due = days.filter((d) => d.dueDate.getTime() < toCalendarDate(today).getTime() && decided.includes(d.state.status)).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  let n = 0;
  for (const d of due) {
    if (d.state.status !== 'PAID_ON_TIME') break;
    n += 1;
  }
  return n;
}

export async function getRecord(input: { associationId: number; membershipId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const m = await loadSaver(input.associationId, input.membershipId);
  const today = businessDay(now, m.group.timezone, m.group.cutoffTime);
  const [trust, days, cycles, payouts] = await Promise.all([
    getMembershipTrust({ associationId: input.associationId, membershipId: m.id, now }),
    dayStates(m, today, null),
    prisma.ajoMembershipCycle.findMany({ where: { membershipId: m.id }, orderBy: { cycleNo: 'asc' } }),
    prisma.ajoPayout.findMany({ where: { membershipId: m.id, round: null, status: 'PAID' } }),
  ]);
  const past = cycles
    .filter((c) => c.cycleNo < m.group.cycleNo || m.group.status === 'COMPLETED')
    .map((c) => {
      const saved = days.filter((d) => d.cycleNo === c.cycleNo).reduce((s, d) => s + d.paidKobo, 0n);
      const paid = payouts.find((p) => p.cycleNo === c.cycleNo);
      return { cycleNo: c.cycleNo, amountKobo: k(c.amountKobo), savedKobo: k(saved), carriedInKobo: k(c.carriedKobo), feeKobo: k(paid ? paid.collectorFeeKobo : c.feeSettledKobo ?? 0n), receivedKobo: paid ? k(paid.netKobo) : null, payoutDate: paid?.paidAt ?? null, choice: c.choice };
    });
  return { trust: { band: trust.band, onTimeCount: trust.onTimeCount, dueCount: trust.dueCount, onTimePercent: trust.onTimePercent, text: trust.text }, streak: streakOf(days, today), pastCycles: past };
}
