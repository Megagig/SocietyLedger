import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../rule-error';

/**
 * Penalty rules: who earns a late fee, and how a waiver works.
 *
 * A late fee is for a real, overdue debt: a due or a levy. A voided charge is not owed, and a donation pledge is a promise rather
 * than a billed obligation, so neither earns one — unless an officer writes a rule for that exact category on purpose.
 *
 * A waiver forgives some or all of a penalty. It lowers the penalty charge's amount by what was waived, so every balance, overdue
 * list and reminder is right without touching any of them; a full waiver also marks the charge Waived.
 */

/** Charge kinds a rule with no category (a general rule) can penalise. */
export const LATE_FEE_KINDS = ['due', 'levy'] as const;

export type LateFeeCharge = {
  isVoided: boolean;
  status: string;
  dueDate: Date | null;
  categoryId: number;
  categoryType: string;
};

export type LateFeeRuleLike = {
  id: number;
  categoryId: number | null;
  gracePeriodDays: number;
  isCompounding: boolean;
  compoundingDays: number | null;
};

const OPEN = ['pending', 'overdue', 'partial'];
const DAY = 86_400_000;

export function daysPastDue(dueDate: Date, now: Date): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / DAY);
}

/** The rule that governs a charge: one written for its category, else a general one if the charge is a due or a levy. */
export function pickRule<R extends LateFeeRuleLike>(rules: R[], charge: Pick<LateFeeCharge, 'categoryId' | 'categoryType'>): R | undefined {
  const specific = rules.find((r) => r.categoryId === charge.categoryId);
  if (specific) return charge.categoryType === 'penalty' ? undefined : specific;
  if ((LATE_FEE_KINDS as readonly string[]).includes(charge.categoryType)) return rules.find((r) => r.categoryId === null);
  return undefined;
}

/**
 * Whether a charge is due a late fee under a rule right now. `lastApplied` is when this rule last charged this charge (null if never):
 * a rule that doesn't repeat charges once; one that repeats waits its compounding days between charges.
 */
export function lateFeeDue(charge: LateFeeCharge, rule: LateFeeRuleLike, lastApplied: Date | null, now: Date): boolean {
  if (charge.isVoided) return false;
  if (!OPEN.includes(charge.status)) return false;
  if (!charge.dueDate || charge.dueDate.getTime() >= now.getTime()) return false;
  if (daysPastDue(charge.dueDate, now) <= rule.gracePeriodDays) return false;
  if (lastApplied === null) return true;
  if (!rule.isCompounding) return false;
  return Math.floor((now.getTime() - lastApplied.getTime()) / DAY) >= (rule.compoundingDays || 30);
}

// ---------------------------------------------------------------- waivers

export type WaivableCharge = { categoryType: string; isVoided: boolean; status: string };

/** Throws unless `waived` naira can be forgiven on this charge, given what is still owed on it. */
export function assertWaivable(charge: WaivableCharge, outstanding: Decimal, waived: number): void {
  if (charge.categoryType !== 'penalty') {
    throw new RuleError('Only a penalty can be waived. For anything else, void and replace the charge.', 400, 'NOT_A_PENALTY');
  }
  if (charge.isVoided) throw new RuleError('This penalty was voided, so there is nothing to waive.', 409, 'PENALTY_VOIDED');
  if (charge.status === 'waived') throw new RuleError('This penalty has already been waived.', 409, 'ALREADY_WAIVED');
  if (outstanding.lessThanOrEqualTo(0)) throw new RuleError('Nothing is owed on this penalty.', 409, 'NOTHING_OWED');
  if (!(waived > 0)) throw new RuleError('Enter an amount above ₦0 to waive.', 400, 'INVALID_AMOUNT');
  if (new Decimal(waived).greaterThan(outstanding)) {
    throw new RuleError(`You can waive at most ${outstanding.toFixed(2)}, which is what is still owed on this penalty.`, 400, 'WAIVER_TOO_LARGE');
  }
}

/** What the penalty charge becomes after forgiving `waived`: its new amount, and whether nothing is left owed. */
export function waiverOutcome(amount: Decimal, paid: Decimal, waived: number): { newAmount: Decimal; fullyWaived: boolean } {
  const newAmount = amount.minus(waived);
  return { newAmount, fullyWaived: newAmount.minus(paid).lessThanOrEqualTo(0) };
}

/** A rule's fee must make sense: a percentage is above 0 and at most 100, a fixed fee is above 0. */
export function assertFeeValid(feeType: string, feeAmount: number): void {
  if (!(feeAmount > 0)) throw new RuleError('The fee must be above ₦0.', 400, 'INVALID_FEE');
  if (feeType === 'percentage' && feeAmount > 100) throw new RuleError('A percentage fee can be at most 100.', 400, 'INVALID_FEE');
}
