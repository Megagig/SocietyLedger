/**
 * The one set of payment statuses (spec §16.3) and the round figures built from them. Pure: no database, no clock.
 *
 * The Circle board, the officer screens and the reports must show the same facts, so every one of them gets a status from `paymentStatus`
 * and every total from `summariseRound`. Nothing else decides whether a payment looks paid.
 *
 * Rules a member can rely on:
 *  - Only a CONFIRMED payment makes a round "paid". A payment someone has reported but an officer has not confirmed is "Reported".
 *  - A round under an open dispute is "Under review". It is never "Missed" while the dispute is open.
 *  - A waived round is "Waived": excused, and left out of what was expected.
 *  - The words are Overdue, Missed and Behind by ₦x. Never "defaulter".
 *
 * All dates are calendar dates (UTC midnight, as a date column returns them) in the group's own timezone.
 */
import { addDays } from './ajo-risk';
import { toCalendarDate } from './ajo-schedule';

export type PaymentStatus = 'PAID_ON_TIME' | 'PAID_LATE' | 'REPORTED' | 'DUE' | 'OVERDUE' | 'MISSED' | 'UNDER_REVIEW' | 'WAIVED' | 'UPCOMING';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['PAID_ON_TIME', 'PAID_LATE', 'REPORTED', 'DUE', 'OVERDUE', 'MISSED', 'UNDER_REVIEW', 'WAIVED', 'UPCOMING'];

/** The words shown for each status. Always text; the screens add an icon, and never rely on colour alone. */
export const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID_ON_TIME: 'Paid on time',
  PAID_LATE: 'Paid late',
  REPORTED: 'Reported, awaiting confirmation',
  DUE: 'Due',
  OVERDUE: 'Overdue',
  MISSED: 'Missed',
  UNDER_REVIEW: 'Under review',
  WAIVED: 'Waived',
  UPCOMING: 'Upcoming',
};

/** Statuses that count a round as paid in full. */
export const isPaid = (s: PaymentStatus): boolean => s === 'PAID_ON_TIME' || s === 'PAID_LATE';

export interface RoundPayment {
  /** The round's due date. */
  dueDate: Date;
  amountKobo: bigint;
  /** Confirmed so far. Reported payments are not in here. */
  paidKobo: bigint;
  /** Money reported or received in cash and waiting for an officer to confirm, worked out for this round oldest first. */
  reportedKobo: bigint;
  /** An officer excused this round. */
  waived: boolean;
  /** The business day of the confirmed payment that completed the round; null while it is unpaid. */
  completedOn: Date | null;
  /** An open dispute is about this round. */
  disputed: boolean;
  /** Days after the due date before a payment counts as missed, from the rule version this member accepted. */
  graceDays: number;
  /** The nearest round that is not yet past its due date. Later rounds are "Upcoming", not "Due". */
  isCurrentRound: boolean;
}

export interface PaymentState {
  status: PaymentStatus;
  /** Only for Overdue: the last day before it counts as missed. */
  graceEndsOn: Date | null;
  /** What is still unpaid after confirmed payments: shown as "Behind by ₦x" only once the round is overdue or missed. */
  behindKobo: bigint;
  /** Whole days after the due date: for an unpaid overdue or missed round, days overdue so far; for a late payment, days late. */
  daysLate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date): number => Math.round((toCalendarDate(to).getTime() - toCalendarDate(from).getTime()) / DAY_MS);

/** The status of one round for one member, as of `today` (the group's business day). */
export function paymentStatus(round: RoundPayment, today: Date): PaymentState {
  const due = toCalendarDate(round.dueDate);
  const stillOwed = round.amountKobo > round.paidKobo ? round.amountKobo - round.paidKobo : 0n;

  if (round.waived) return { status: 'WAIVED', graceEndsOn: null, behindKobo: 0n, daysLate: 0 };

  if (stillOwed === 0n) {
    const late = round.completedOn ? Math.max(0, daysBetween(due, round.completedOn)) : 0;
    return { status: late > 0 ? 'PAID_LATE' : 'PAID_ON_TIME', graceEndsOn: null, behindKobo: 0n, daysLate: late };
  }

  const pastDue = toCalendarDate(today).getTime() > due.getTime();
  const daysOverdue = pastDue ? daysBetween(due, today) : 0;

  // An open dispute is never counted as missed, and a payment that is reported but not confirmed is never counted as paid.
  if (round.disputed) return { status: 'UNDER_REVIEW', graceEndsOn: null, behindKobo: 0n, daysLate: 0 };
  if (round.reportedKobo >= stillOwed) return { status: 'REPORTED', graceEndsOn: null, behindKobo: 0n, daysLate: 0 };

  if (!pastDue) return { status: round.isCurrentRound ? 'DUE' : 'UPCOMING', graceEndsOn: null, behindKobo: 0n, daysLate: 0 };

  const graceEndsOn = addDays(due, round.graceDays);
  const inGrace = toCalendarDate(today).getTime() <= graceEndsOn.getTime();
  return { status: inGrace ? 'OVERDUE' : 'MISSED', graceEndsOn: inGrace ? graceEndsOn : null, behindKobo: stillOwed - round.reportedKobo, daysLate: daysOverdue };
}

/**
 * Spread money waiting for confirmation over a member's unpaid rounds, oldest first, the way confirming it would. This is what makes a
 * reported payment show as "Reported" against the right round. Rounds are given oldest first; returns the amount per round, same order.
 */
export function spreadReported(rounds: Array<{ amountKobo: bigint; paidKobo: bigint; waived: boolean }>, reportedTotalKobo: bigint): bigint[] {
  let left = reportedTotalKobo;
  return rounds.map((r) => {
    if (r.waived || left <= 0n) return 0n;
    const owed = r.amountKobo > r.paidKobo ? r.amountKobo - r.paidKobo : 0n;
    const take = left < owed ? left : owed;
    left -= take;
    return take;
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// One round of the whole circle
// ---------------------------------------------------------------------------------------------------------------------------------

export type StatusCounts = Record<PaymentStatus, number>;

export const emptyCounts = (): StatusCounts => ({ PAID_ON_TIME: 0, PAID_LATE: 0, REPORTED: 0, DUE: 0, OVERDUE: 0, MISSED: 0, UNDER_REVIEW: 0, WAIVED: 0, UPCOMING: 0 });

export interface RoundSummary {
  /** Members expected to pay this round (waived ones are excused, so they are not counted). */
  expectedCount: number;
  paidCount: number;
  /** What the round should bring in, and what has been confirmed so far. Reported money is not counted as collected. */
  expectedKobo: bigint;
  collectedKobo: bigint;
  /** Basis points of expected that is collected (10000 = all of it), or null when nothing is expected. */
  collectionBps: number | null;
  counts: StatusCounts;
}

/** The figures for one round across the circle. Every screen that shows "7 of 10 paid" or "₦70,000.00 of ₦100,000.00" reads this. */
export function summariseRound(rows: Array<{ amountKobo: bigint; paidKobo: bigint; status: PaymentStatus }>): RoundSummary {
  const counts = emptyCounts();
  let expectedCount = 0;
  let paidCount = 0;
  let expectedKobo = 0n;
  let collectedKobo = 0n;
  for (const r of rows) {
    counts[r.status] += 1;
    if (r.status === 'WAIVED') continue;
    expectedCount += 1;
    expectedKobo += r.amountKobo;
    collectedKobo += r.paidKobo > r.amountKobo ? r.amountKobo : r.paidKobo;
    if (isPaid(r.status)) paidCount += 1;
  }
  const collectionBps = expectedKobo > 0n ? Number((collectedKobo * 10_000n) / expectedKobo) : null;
  return { expectedCount, paidCount, expectedKobo, collectedKobo, collectionBps, counts };
}

/** How the board orders a round: who still needs to act first (overdue, then due, reported), then those who have paid. */
const SORT_RANK: Record<PaymentStatus, number> = { MISSED: 0, OVERDUE: 1, DUE: 2, UNDER_REVIEW: 3, REPORTED: 4, UPCOMING: 5, PAID_LATE: 6, PAID_ON_TIME: 7, WAIVED: 8 };
export const statusSortRank = (s: PaymentStatus): number => SORT_RANK[s];

/** On-time rate over rounds that have been decided: paid on time out of paid and missed. A round still inside its grace, reported, under review or waived is not decided yet, so it is left out. */
export function onTimeBps(counts: StatusCounts): number | null {
  const decided = counts.PAID_ON_TIME + counts.PAID_LATE + counts.MISSED;
  return decided > 0 ? Math.round((counts.PAID_ON_TIME * 10_000) / decided) : null;
}

/** "Behind by ₦20,000.00", never "defaulter". */
export function behindText(behindKobo: bigint, formatNaira: (kobo: bigint) => string): string {
  return `Behind by ${formatNaira(behindKobo)}`;
}
