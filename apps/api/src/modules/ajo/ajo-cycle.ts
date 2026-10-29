/**
 * The pure rules of collector-thrift cycles (spec §16.5): no database, no clock.
 *
 * A saver chooses one amount and keeps it for the whole cycle. When the cycle ends they withdraw or continue; if they say nothing they
 * withdraw, because keeping someone's money in the group because they did not reply is the riskier mistake. The collector's fee is one
 * contribution per saver per cycle (the existing "days of contribution" fee set to 1 day, so a ₦500.00 saver pays ₦500.00 and a
 * ₦1,000.00 saver pays ₦1,000.00). A continuing saver's savings, less that fee, carry into the next cycle.
 */
import { collectorFeeFor, type FeeType } from './ajo-payout-calc';
import { addDays } from './ajo-risk';
import { addPeriods, toCalendarDate, type CustomInterval, type Frequency } from './ajo-schedule';

/** Savers are asked about the end of the cycle this many days before its last due date. */
export const CYCLE_PROMPT_DAYS = 3;

export type CycleChoice = 'PENDING' | 'WITHDRAW' | 'CONTINUE';

/** What actually happens for a given answer: no answer is a withdrawal. */
export const effectiveChoice = (choice: CycleChoice): 'WITHDRAW' | 'CONTINUE' => (choice === 'CONTINUE' ? 'CONTINUE' : 'WITHDRAW');

/** The largest amount one saver may pay each time, matching the group contribution limit (₦10,000,000.00). */
export const MAX_SAVER_AMOUNT_KOBO = 1_000_000_000n;

/** Why this amount is not allowed, in words a person can read, or null when it is fine. `minKobo` is the group's smallest amount. */
export function checkSaverAmount(amountKobo: bigint, minKobo: bigint, formatNaira: (kobo: bigint) => string, maxKobo: bigint = MAX_SAVER_AMOUNT_KOBO): string | null {
  if (amountKobo <= 0n) return 'Choose an amount more than zero.';
  if (amountKobo < minKobo) return `The smallest amount for this group is ${formatNaira(minKobo)}.`;
  if (amountKobo > maxKobo) return `That is more than the largest allowed (${formatNaira(maxKobo)}).`;
  return null;
}

/** The first day savers are asked what they want to do: three days before the last due date. */
export const promptOpensOn = (endsOn: Date): Date => addDays(endsOn, -CYCLE_PROMPT_DAYS);

/** Is the question open? From three days before the cycle ends until the next cycle starts (the caller stops asking once it has). */
export const isPromptOpen = (endsOn: Date, today: Date): boolean => toCalendarDate(today).getTime() >= promptOpensOn(endsOn).getTime();

/** The first due date of the running cycle: the group's start date for cycle 1, the date the next cycle was started on after that. */
export const cycleStartOf = (group: { startDate: Date; cycleStartsOn: Date | null }): Date => group.cycleStartsOn ?? group.startDate;

/**
 * The first due date of the next cycle: one period after the last due date of this one, so the rhythm carries on. If the admin starts
 * it late, it begins today rather than in the past, so nobody is overdue on day one.
 */
export function nextCycleStart(input: CustomInterval & { cycleStart: Date; frequency: Frequency; cycleLength: number; today: Date }): Date {
  const natural = addPeriods(input.cycleStart, input.frequency, input.cycleLength, input);
  const today = toCalendarDate(input.today);
  return natural.getTime() >= today.getTime() ? natural : today;
}

export interface CarryForward {
  /** This cycle's collector fee, taken from the saver's savings. */
  feeKobo: bigint;
  /** What goes into the next cycle: everything carried in, plus what was confirmed this cycle, less the fee. */
  carriedKobo: bigint;
}

/**
 * What a continuing saver brings into the next cycle. The fee is worked out on this cycle's own money only, never on what was already
 * carried in, so a percentage fee is not charged twice on the same savings.
 */
export function carryForward(input: { carriedInKobo: bigint; confirmedKobo: bigint; feeType: FeeType; feeValue: bigint; amountKobo: bigint }): CarryForward {
  const own = input.confirmedKobo > 0n ? input.confirmedKobo : 0n;
  const feeKobo = collectorFeeFor(input.feeType, input.feeValue, own, input.amountKobo);
  return { feeKobo, carriedKobo: input.carriedInKobo + own - feeKobo };
}
